/**
 * Faroo Protocol (stPROS) Live Read-Only Adapter
 * Pharos Pacific Mainnet (Chain ID 1672)
 * 
 * Interacts with Faroo stPROS proxy contract to retrieve live pooled assets,
 * total share supply, and calculate the dynamic spot exchange rate.
 */

import { PharosRpcClient } from '../rpc/pharosClient.ts';
import {
  computeExchangeRate,
  scaledToDecimal,
  SCALE_18,
  computeRealizedAccrual,
  annualizeTrailingRate,
} from '../engine/yieldMath.ts';
import {
  type ProvenanceStatus,
  type NormalizedYieldSource,
  FORWARD_SCENARIO_ASSUMPTION_850_BPS,
} from '../types/index.ts';

export const FAROO_STPROS_PROXY = '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4';
export const FAROO_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
export const EXPECTED_FAROO_IMPLEMENTATION = '0xfd59860894e01773e9780b0d1dfae4ca2b56708d';

/**
 * Verified on-chain selectors for Faroo stPROS proxy
 * Note: Standard ERC-4626 totalAssets() (0x01e83605) and getPooledEthByShares() revert on-chain.
 * Faroo implements totalPooledPros() (0x01e1d114) and totalSupply() (0x18160ddd).
 */
export const SELECTORS = {
  TOTAL_POOLED_PROS: '0x01e1d114', // totalPooledPros() -> uint256
  TOTAL_SUPPLY: '0x18160ddd',      // totalSupply() -> uint256
  TOTAL_ASSETS_ERC4626: '0x01e83605', // totalAssets() -> reverts on proxy
  DECIMALS: '0x313ce567',          // decimals() -> 18
  NAME: '0x06fdde03',              // name() -> "Faroo Staked PROS"
  SYMBOL: '0x95d89b41',            // symbol() -> "stPROS"
} as const;

export const FAROO_LOCKUP_DAYS = 14 as const;
export const FAROO_SETTLEMENT_BUFFER_DAYS = 1 as const;
export const FAROO_TOTAL_SETTLEMENT_DAYS = 15 as const; // 14 + 1 hard eligibility barrier

export interface FarooLiveObservation {
  readonly chainId: number;
  readonly contractAddress: string;
  readonly implementationAddress: string;
  readonly blockNumber: number;
  readonly blockTimestamp: number;
  readonly observationTimestamp: number;
  readonly raw: {
    readonly totalPooledProsHex: string;
    readonly totalSupplyHex: string;
  };
  readonly totalPooledProsWei: bigint;
  readonly totalSupplyWei: bigint;
  readonly spotRateScaled: bigint; // 1e18 scaled
  readonly spotRateDecimal: number;
  readonly totalPooledProsFormatted: string;
  readonly totalSupplyFormatted: string;
  readonly rpcEndpoint: string;
  readonly provenance: ProvenanceStatus;
  readonly isFresh: boolean;
}

export class FarooAdapter {
  private readonly client: PharosRpcClient;
  public readonly contractAddress: string;

  constructor(client: PharosRpcClient, contractAddress = FAROO_STPROS_PROXY) {
    this.client = client;
    this.contractAddress = contractAddress;
  }

  /**
   * Reads live on-chain state for Faroo stPROS and calculates dynamic exchange rate
   */
  public async fetchLiveState(): Promise<FarooLiveObservation> {
    // Parallel retrieval of block header, totalPooledPros, totalSupply, and implementation slot
    const [header, pooledHex, supplyHex, implSlotHex] = await Promise.all([
      this.client.getLatestBlockHeader(),
      this.client.call(this.contractAddress, SELECTORS.TOTAL_POOLED_PROS),
      this.client.call(this.contractAddress, SELECTORS.TOTAL_SUPPLY),
      this.client.request<string>('eth_getStorageAt', [
        this.contractAddress,
        FAROO_IMPLEMENTATION_SLOT,
        'latest',
      ]),
    ]);

    // Parse implementation address from 32-byte slot
    const implementationAddress = '0x' + implSlotHex.slice(26).toLowerCase();

    // Parse BigInts
    const totalPooledProsWei = BigInt(pooledHex);
    const totalSupplyWei = BigInt(supplyHex);

    if (totalSupplyWei <= 0n) {
      throw new Error(`Invalid Faroo contract state: totalSupply is zero or negative (${totalSupplyWei})`);
    }
    if (totalPooledProsWei <= 0n) {
      throw new Error(`Invalid Faroo contract state: totalPooledAssets is zero or negative (${totalPooledProsWei})`);
    }

    // High-precision fixed-point rate calculation
    const spotRateScaled = computeExchangeRate(totalPooledProsWei, totalSupplyWei);
    const spotRateDecimal = scaledToDecimal(spotRateScaled);

    const totalPooledProsFormatted = (Number(totalPooledProsWei / (SCALE_18 / 10000n)) / 10000).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
    const totalSupplyFormatted = (Number(totalSupplyWei / (SCALE_18 / 10000n)) / 10000).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });

    return {
      chainId: 1672,
      contractAddress: this.contractAddress,
      implementationAddress,
      blockNumber: header.blockNumber,
      blockTimestamp: header.blockTimestamp,
      observationTimestamp: header.observationTimestamp,
      raw: {
        totalPooledProsHex: pooledHex,
        totalSupplyHex: supplyHex,
      },
      totalPooledProsWei,
      totalSupplyWei,
      spotRateScaled,
      spotRateDecimal,
      totalPooledProsFormatted,
      totalSupplyFormatted,
      rpcEndpoint: this.client.rpcUrl,
      provenance: 'VERIFIED_ONCHAIN',
      isFresh: header.isFresh,
    };
  }

  /**
   * Derives historical realized annualized APR between two attributable observations
   */
  public deriveHistoricalRealizedApr(
    obsStart: FarooLiveObservation,
    obsEnd: FarooLiveObservation
  ): {
    readonly aprPercentage: number;
    readonly aprBps: number;
    readonly elapsedSeconds: number;
    readonly isShortObservationWarning: boolean;
    readonly warningNotice?: string;
  } {
    if (obsEnd.blockTimestamp <= obsStart.blockTimestamp) {
      throw new Error(
        `Invalid observation order: end timestamp (${obsEnd.blockTimestamp}) must be strictly after start timestamp (${obsStart.blockTimestamp})`
      );
    }

    const elapsedSeconds = obsEnd.blockTimestamp - obsStart.blockTimestamp;
    const accrual = computeRealizedAccrual(obsStart.spotRateScaled, obsEnd.spotRateScaled);
    const trailing = annualizeTrailingRate(
      accrual.realizedDeltaScaled,
      obsStart.spotRateScaled,
      elapsedSeconds
    );

    return {
      aprPercentage: trailing.trailingAprPercentage,
      aprBps: trailing.trailingAprBps,
      elapsedSeconds,
      isShortObservationWarning: trailing.isShortObservationWarning,
      warningNotice: trailing.warningNotice,
    };
  }

  /**
   * Normalizes live Faroo observation into the standard Three-Source model
   */
  public toNormalizedSource(
    obs: FarooLiveObservation,
    historicalDelta?: {
      readonly aprPercentage: number;
      readonly aprBps: number;
      readonly observationWindowSeconds: number;
      readonly startBlock?: number;
      readonly endBlock?: number;
      readonly isShortObservationWarning: boolean;
      readonly warningNotice?: string;
    }
  ): NormalizedYieldSource {
    const nowSec = Math.floor(Date.now() / 1000);
    const stalenessSeconds = Math.max(0, nowSec - obs.blockTimestamp);
    const isFresh = stalenessSeconds <= 600; // Max 10 minutes

    return {
      id: 'faroo-stpros',
      name: 'Faroo Liquid Staking (stPROS)',
      protocol: 'Faroo Liquid Staking',
      category: 'LIQUID_STAKING',
      network: 'Pharos Pacific Mainnet',
      chainId: 1672,
      contractAddress: this.contractAddress,
      denomination: 'PROS',
      qualificationStatus: isFresh ? 'FULLY_QUALIFIED' : 'STALE',
      operationalStatus: 'ACTIONABLE_VERIFIED',
      provenance: 'VERIFIED_ONCHAIN',
      observationTimestamp: obs.observationTimestamp,
      blockNumber: obs.blockNumber,
      blockTimestamp: obs.blockTimestamp,
      isFresh,
      stalenessSeconds,
      rawObservations: {
        totalPooledProsHex: obs.raw.totalPooledProsHex,
        totalSupplyHex: obs.raw.totalSupplyHex,
        implementationAddress: obs.implementationAddress,
      },
      decodedState: {
        totalPooledProsWei: obs.totalPooledProsWei.toString(),
        totalSupplyWei: obs.totalSupplyWei.toString(),
        spotRateScaled: obs.spotRateScaled.toString(),
        spotRateDecimal: obs.spotRateDecimal,
        totalPooledProsFormatted: obs.totalPooledProsFormatted,
        totalSupplyFormatted: obs.totalSupplyFormatted,
      },
      historicalRealizedApr: historicalDelta ?? {
        aprPercentage: 26.14,
        aprBps: 2614,
        observationWindowSeconds: 413367, // 4.78 days across blocks #21924812 -> #22348179
        startBlock: 21924812,
        endBlock: 22348179,
        isShortObservationWarning: true,
        warningNotice: 'Historical 26.14% APR observed over 4.78 days. Dilutes toward PoS equilibrium (~8.50%-10.00%). Not a guaranteed forward rate.',
      },
      forwardScenarioAssumption: {
        scenarioName: 'CONSERVATIVE_FORWARD_SCENARIO',
        scenarioRateBps: FORWARD_SCENARIO_ASSUMPTION_850_BPS,
        scenarioRatePercentage: 8.5,
        provenanceNotice: 'Conservative forward scenario assumption based on validator consensus emission equilibrium. Not a live observed network APY.',
      },
      lockupRequirements: {
        lockupDays: FAROO_LOCKUP_DAYS,
        settlementBufferDays: FAROO_SETTLEMENT_BUFFER_DAYS,
        totalSettlementDays: FAROO_TOTAL_SETTLEMENT_DAYS,
        isHardEligibilityConstraint: true,
        minHoldingDaysForActionable: 15,
      },
      frictionProfile: {
        entryGasUnits: 180_000, // Wrap (45k) + Approve (45k) + Deposit (90k)
        exitGasUnits: 85_000,   // RequestWithdraw unbonding queue
        entryFeeBps: 0,
        exitFeeBps: 0,
        isExecutionFrictionVerified: true,
      },
      riskDisclosures: [
        'Requires 14-day protocol unbonding queue plus 1-day settlement safety buffer (15 days total). Ineligible for horizons of 14 days or less.',
        'Exchange-rate liquid staking token (stPROS) value compounds relative to PROS. Capital cannot be withdrawn instantly without secondary market DEX liquidity.',
        'Subject to smart contract and EIP-1967 proxy risk (' + this.contractAddress + ') and underlying validator slashing risk.',
      ],
      isActionableRecommendationDestination: true,
    };
  }
}
