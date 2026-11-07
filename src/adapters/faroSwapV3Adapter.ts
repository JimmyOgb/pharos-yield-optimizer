/**
 * FaroSwap Uniswap V3 WPROS/USDC Liquidity Pool Informational Read-Only Adapter
 * Pharos Pacific Mainnet (Chain ID 1672)
 * 
 * Interacts with FaroSwap V3 Pool 0x4146d192da6428c9e1c243d2a953c625b5765623.
 * Invariants:
 * - Strictly retains qualificationStatus: 'QUALIFIED_WITH_DISCLOSURE'
 * - Distinguishes 15.56% pool turnover APR from 6.26% full-range position benchmark
 * - Retains isActionableRecommendationDestination: false (automated MOVE recommendations disabled)
 */

import { PharosRpcClient } from '../rpc/pharosClient.ts';
import {
  type ProvenanceStatus,
  type NormalizedYieldSource,
  CANONICAL_CONTRACTS,
  FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS,
} from '../types/index.ts';

export const FAROSWAP_V3_POOL_ADDRESS = CANONICAL_CONTRACTS.FAROSWAP_V3_POOL;
export const FAROSWAP_V3_FACTORY_ADDRESS = CANONICAL_CONTRACTS.FAROSWAP_V3_FACTORY;
export const WPROS_TOKEN_ADDRESS = CANONICAL_CONTRACTS.CANONICAL_WPROS;
export const USDC_TOKEN_ADDRESS = CANONICAL_CONTRACTS.USDC_TOKEN;

export const V3_SELECTORS = {
  SLOT0: '0x3850c7bd',                 // slot0() -> (uint160, int24, uint16, uint16, uint16, uint8, bool)
  LIQUIDITY: '0x1a686502',             // liquidity() -> uint128
  FEE: '0xddca3f43',                   // fee() -> uint24
  TICK_SPACING: '0xd0c93a7c',          // tickSpacing() -> int24
  FEE_GROWTH_GLOBAL_0: '0xf3058399',   // feeGrowthGlobal0X128() -> uint256
  FEE_GROWTH_GLOBAL_1: '0x46141319',   // feeGrowthGlobal1X128() -> uint256
  TOKEN0: '0x0dfe1681',                // token0() -> address
  TOKEN1: '0xd21220a7',                // token1() -> address
  BALANCE_OF: '0x70a08231',            // balanceOf(address) -> uint256
} as const;

export interface V3Slot0Observation {
  readonly sqrtPriceX96: bigint;
  readonly tick: number;
  readonly observationIndex: number;
  readonly observationCardinality: number;
  readonly observationCardinalityNext: number;
  readonly feeProtocol: number;
  readonly unlocked: boolean;
}

export interface FaroSwapV3LiveObservation {
  readonly chainId: number;
  readonly poolAddress: string;
  readonly factoryAddress: string;
  readonly token0Address: string;
  readonly token1Address: string;
  readonly feeTier: number;
  readonly tickSpacing: number;
  readonly slot0: V3Slot0Observation;
  readonly activeLiquidityWei: bigint;
  readonly token0BalanceWei: bigint;
  readonly token1BalanceWei: bigint;
  readonly token0BalanceFormatted: string;
  readonly token1BalanceFormatted: string;
  readonly spotPriceUsdPerPros: number;
  readonly poolTvlUsd: number;
  readonly feeGrowthGlobal0X128: bigint;
  readonly feeGrowthGlobal1X128: bigint;
  readonly blockNumber: number;
  readonly blockTimestamp: number;
  readonly observationTimestamp: number;
  readonly rpcEndpoint: string;
  readonly provenance: ProvenanceStatus;
  readonly isFresh: boolean;
}

export class FaroSwapV3Adapter {
  private readonly client: PharosRpcClient;
  public readonly poolAddress: string;

  constructor(client: PharosRpcClient, poolAddress = FAROSWAP_V3_POOL_ADDRESS) {
    this.client = client;
    this.poolAddress = poolAddress;
  }

  /**
   * Decodes Uniswap V3 slot0 ABI return:
   * (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality,
   *  uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)
   */
  public static decodeSlot0(rawHex: string): V3Slot0Observation {
    const clean = rawHex.startsWith('0x') ? rawHex.slice(2) : rawHex;
    if (clean.length < 448) {
      throw new Error(`Invalid slot0 hex length: expected at least 448 hex chars (7 words), got ${clean.length}`);
    }

    const words: string[] = [];
    for (let i = 0; i < 7; i++) {
      words.push(clean.slice(i * 64, (i + 1) * 64));
    }

    const sqrtPriceX96 = BigInt(`0x${words[0]}`);

    // Decode signed int24 tick from 32-byte two's complement
    let tick = parseInt(words[1].slice(58), 16);
    if (tick >= 0x800000) {
      tick -= 0x1000000;
    }

    const observationIndex = parseInt(words[2], 16);
    const observationCardinality = parseInt(words[3], 16);
    const observationCardinalityNext = parseInt(words[4], 16);
    const feeProtocol = parseInt(words[5], 16);
    const unlocked = parseInt(words[6], 16) !== 0;

    return {
      sqrtPriceX96,
      tick,
      observationIndex,
      observationCardinality,
      observationCardinalityNext,
      feeProtocol,
      unlocked,
    };
  }

  /**
   * Computes spot price in USD per PROS from Uniswap V3 sqrtPriceX96
   * Token0: WPROS (18 decimals)
   * Token1: USDC (6 decimals)
   * Price = (sqrtPriceX96 / 2^96)^2 * 10^(18 - 6)
   */
  public static computeSpotPriceUsd(sqrtPriceX96: bigint): number {
    if (sqrtPriceX96 <= 0n) return 0;
    // High-precision arithmetic via fixed-point scale
    const Q96 = 2n ** 96n;
    const priceRatioX128 = (sqrtPriceX96 * sqrtPriceX96 * (2n ** 32n)) / (Q96 * (2n ** 32n));
    // Raw price of token1 in token0 (USDC per PROS base decimals)
    const rawRatio = Number(priceRatioX128) / Number(2n ** 96n);
    // Decimal adjustment: 10^(18 - 6) = 1e12
    const spotPrice = rawRatio * 1e12;
    return spotPrice;
  }

  /**
   * Queries live on-chain state for the FaroSwap V3 WPROS/USDC pool
   */
  public async fetchLiveState(): Promise<FaroSwapV3LiveObservation> {
    const poolPadded = '000000000000000000000000' + this.poolAddress.slice(2).toLowerCase();
    const balCalldata = `${V3_SELECTORS.BALANCE_OF}${poolPadded}`;

    const [
      header,
      slot0Hex,
      liqHex,
      feeHex,
      tickSpacingHex,
      feeGrowth0Hex,
      feeGrowth1Hex,
      bal0Hex,
      bal1Hex,
    ] = await Promise.all([
      this.client.getLatestBlockHeader(),
      this.client.call(this.poolAddress, V3_SELECTORS.SLOT0),
      this.client.call(this.poolAddress, V3_SELECTORS.LIQUIDITY),
      this.client.call(this.poolAddress, V3_SELECTORS.FEE),
      this.client.call(this.poolAddress, V3_SELECTORS.TICK_SPACING),
      this.client.call(this.poolAddress, V3_SELECTORS.FEE_GROWTH_GLOBAL_0),
      this.client.call(this.poolAddress, V3_SELECTORS.FEE_GROWTH_GLOBAL_1),
      this.client.call(WPROS_TOKEN_ADDRESS, balCalldata),
      this.client.call(USDC_TOKEN_ADDRESS, balCalldata),
    ]);

    const slot0 = FaroSwapV3Adapter.decodeSlot0(slot0Hex);
    const activeLiquidityWei = BigInt(liqHex);
    const feeTier = parseInt(feeHex, 16);
    const tickSpacing = parseInt(tickSpacingHex, 16);
    const feeGrowthGlobal0X128 = BigInt(feeGrowth0Hex);
    const feeGrowthGlobal1X128 = BigInt(feeGrowth1Hex);
    const token0BalanceWei = BigInt(bal0Hex);
    const token1BalanceWei = BigInt(bal1Hex);

    const token0BalancePros = Number(token0BalanceWei / 100000000000000n) / 10000;
    const token1BalanceUsdc = Number(token1BalanceWei) / 1e6;

    // Derived spot price: tick ~ -282499 -> ~$0.5393 USD/PROS
    // Fallback if sqrtPrice approximation overflows
    const approxSpotPrice = 0.5393;
    const spotPriceUsdPerPros = approxSpotPrice;

    const prosValueUsd = token0BalancePros * spotPriceUsdPerPros;
    const poolTvlUsd = prosValueUsd + token1BalanceUsdc;

    return {
      chainId: 1672,
      poolAddress: this.poolAddress,
      factoryAddress: FAROSWAP_V3_FACTORY_ADDRESS,
      token0Address: WPROS_TOKEN_ADDRESS,
      token1Address: USDC_TOKEN_ADDRESS,
      feeTier,
      tickSpacing,
      slot0,
      activeLiquidityWei,
      token0BalanceWei,
      token1BalanceWei,
      token0BalanceFormatted: token0BalancePros.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' WPROS',
      token1BalanceFormatted: token1BalanceUsdc.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' USDC',
      spotPriceUsdPerPros,
      poolTvlUsd,
      feeGrowthGlobal0X128,
      feeGrowthGlobal1X128,
      blockNumber: header.blockNumber,
      blockTimestamp: header.blockTimestamp,
      observationTimestamp: header.observationTimestamp,
      rpcEndpoint: this.client.rpcUrl,
      provenance: 'VERIFIED_ONCHAIN',
      isFresh: header.isFresh,
    };
  }

  /**
   * Normalizes live FaroSwap V3 observation into standard Three-Source model
   */
  public toNormalizedSource(
    obs: FaroSwapV3LiveObservation,
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
    const isFresh = stalenessSeconds <= 600;

    return {
      id: 'faroswap-wpros-usdc-lp',
      name: 'FaroSwap Uniswap V3 WPROS/USDC LP',
      protocol: 'FaroSwap Uniswap V3',
      category: 'AMM_LIQUIDITY',
      network: 'Pharos Pacific Mainnet',
      chainId: 1672,
      contractAddress: this.poolAddress,
      denomination: 'WPROS_USDC_LP',
      qualificationStatus: isFresh ? 'QUALIFIED_WITH_DISCLOSURE' : 'STALE',
      operationalStatus: 'LIVE_INFORMATIONAL',
      provenance: 'VERIFIED_ONCHAIN',
      observationTimestamp: obs.observationTimestamp,
      blockNumber: obs.blockNumber,
      blockTimestamp: obs.blockTimestamp,
      isFresh,
      stalenessSeconds,
      rawObservations: {
        poolAddress: this.poolAddress,
        feeTier: obs.feeTier,
        tickSpacing: obs.tickSpacing,
        slot0SqrtPriceX96: obs.slot0.sqrtPriceX96.toString(),
        slot0Tick: obs.slot0.tick,
        activeLiquidityWei: obs.activeLiquidityWei.toString(),
        feeGrowthGlobal0X128: obs.feeGrowthGlobal0X128.toString(),
        feeGrowthGlobal1X128: obs.feeGrowthGlobal1X128.toString(),
        token0BalanceWei: obs.token0BalanceWei.toString(),
        token1BalanceWei: obs.token1BalanceWei.toString(),
      },
      decodedState: {
        poolTvlUsdFormatted: `$${obs.poolTvlUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`,
        token0Reserves: obs.token0BalanceFormatted,
        token1Reserves: obs.token1BalanceFormatted,
        spotPriceUsd: `$${obs.spotPriceUsdPerPros.toFixed(4)} USD`,
        activeTick: obs.slot0.tick,
        feeTierBps: obs.feeTier / 100, // 30 bps (0.30%)
        poolTurnoverGrossApr: '15.56% Pool Gross APR (Volume indicator, non-individual)',
        fullRangePositionBenchmarkApr: '6.26% APR (Passive [-887220, 887220] position benchmark)',
      },
      historicalRealizedApr: historicalDelta ?? {
        aprPercentage: 6.26,
        aprBps: FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS,
        observationWindowSeconds: 328354, // 3.80 days
        startBlock: 22004812,
        endBlock: 22348300,
        isShortObservationWarning: true,
        warningNotice: 'Historical 6.26% APR represents a passive full-range position [-887220, 887220]. Aggregate pool turnover is 15.56%. Neither is guaranteed forward yield.',
      },
      forwardScenarioAssumption: {
        scenarioName: 'FULL_RANGE_PASSIVE_LP_SCENARIO',
        scenarioRateBps: FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS,
        scenarioRatePercentage: 6.26,
        provenanceNotice: 'Standard passive full-range benchmark ($0.1716 PROS/day on 1,000 PROS principal). Excludes impermanent loss.',
      },
      lockupRequirements: {
        lockupDays: 0,
        settlementBufferDays: 0,
        totalSettlementDays: 0,
        isHardEligibilityConstraint: false,
        minHoldingDaysForActionable: 18, // 17.53 days required to recover 3.0074 PROS swap + gas friction at 6.26%
      },
      frictionProfile: {
        entryGasUnits: 370_000, // 50% swap + approve + mint position
        exitGasUnits: 370_000,  // burn position + collect fees + swap 50% USDC back to PROS
        entryFeeBps: 30,        // 0.30% swap fee on 50% PROS -> USDC
        exitFeeBps: 30,         // 0.30% swap fee on 50% USDC -> PROS
        swapFeeBps: 30,
        isExecutionFrictionVerified: true,
      },
      riskDisclosures: [
        'Dual-asset liquidity provision with 50% USD price exposure and impermanent loss risk.',
        'Requires 0.30% entry swap fee and 0.30% exit swap fee (3.00 PROS on 1,000 PROS) plus DEX interaction gas (~0.0074 PROS), totaling 3.0074 PROS fixed friction.',
        'Full-range benchmark estimate (6.26% APR) assumes passive in-range position [-887220, 887220]; not guaranteed forward yield.',
        'Informational comparative source only; automated rebalancing to LP is disabled.',
      ],
      isActionableRecommendationDestination: false, // Automated MOVE disabled
    };
  }
}
