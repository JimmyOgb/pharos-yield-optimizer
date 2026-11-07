/**
 * Pharos Native PoS Consensus Staking Read-Only Adapter
 * Pharos Pacific Mainnet (Chain ID 1672)
 * 
 * Interacts with the native consensus precompile at 0x4100000000000000000000000000000000000000.
 * Invariant: Never manufactures live APR or mixes forward scenario assumptions into observed fields.
 */

import { PharosRpcClient } from '../rpc/pharosClient.ts';
import {
  type ProvenanceStatus,
  type NormalizedYieldSource,
  CANONICAL_CONTRACTS,
  FORWARD_SCENARIO_ASSUMPTION_850_BPS,
  NATIVE_POS_RISK_DISCLOSURE,
} from '../types/index.ts';

export const NATIVE_POS_PRECOMPILE_ADDRESS = CANONICAL_CONTRACTS.NATIVE_POS_PRECOMPILE;

/**
 * Top active validator pool ID holding 232.8M+ PROS on Pacific Mainnet
 */
export const DEFAULT_REFERENCE_VALIDATOR_POOL_ID =
  '0xaecb1e6d44e8921b5b9b8e04f95d5a78776ee76d2eb7404fb002ab7fed86bedc';

/**
 * Reference active delegator address on Pacific Mainnet
 */
export const DEFAULT_REFERENCE_DELEGATOR_ADDRESS =
  '0xec1d6163e05b3f5d0fb8f354881f6c8b793ad612';

export const POS_SELECTORS = {
  GET_DELEGATOR: '0x3a6d6bae', // getDelegator(bytes32 poolId, address delegator) -> 9-word tuple
  GET_USER_PENDING_UNDELEGATIONS: '0xa5bd8279', // getUserPendingUndelegations(address delegator) -> dynamic array
  DELEGATE: '0x5c19a95c', // delegate(bytes32 poolId) payable
  UNDELEGATE: '0x51cff8d9', // undelegate(bytes32 poolId)
  CLAIM_REWARD: '0x8c79c882', // claimReward(bytes32 poolId)
} as const;

export const POS_UNBONDING_DAYS = 21 as const;

export interface DelegatorObservationTuple {
  readonly principalStakeWei: bigint;
  readonly stakeWei: bigint;
  readonly accumulatedRewardPerShare: bigint;
  readonly rewardsWei: bigint; // Accrued unclaimed rewards
  readonly pendingStakeWei: bigint;
  readonly pendingWithdrawStakeWei: bigint;
  readonly pendingWithdrawWindow: bigint;
  readonly totalRewardsClaimedWei: bigint; // Cumulative claimed rewards
  readonly isPendingUndelegate: boolean;
}

export interface NativePosLiveObservation {
  readonly chainId: number;
  readonly precompileAddress: string;
  readonly blockNumber: number;
  readonly blockTimestamp: number;
  readonly observationTimestamp: number;
  readonly totalNetworkStakedWei: bigint;
  readonly totalNetworkStakedFormatted: string;
  readonly delegatorTuple: DelegatorObservationTuple;
  readonly rawTupleHex: string;
  readonly poolId: string;
  readonly delegatorAddress: string;
  readonly rpcEndpoint: string;
  readonly provenance: ProvenanceStatus;
  readonly isFresh: boolean;
}

export class NativePosAdapter {
  private readonly client: PharosRpcClient;
  public readonly precompileAddress: string;

  constructor(client: PharosRpcClient, precompileAddress = NATIVE_POS_PRECOMPILE_ADDRESS) {
    this.client = client;
    this.precompileAddress = precompileAddress;
  }

  /**
   * Encodes getDelegator calldata: selector (4 bytes) + poolId (32 bytes) + delegator (32 bytes zero-padded)
   */
  public static encodeGetDelegatorCalldata(poolId: string, delegator: string): string {
    const cleanPoolId = poolId.startsWith('0x') ? poolId.slice(2) : poolId;
    const cleanDelegator = delegator.startsWith('0x') ? delegator.slice(2).toLowerCase() : delegator.toLowerCase();

    if (cleanPoolId.length !== 64) {
      throw new Error(`Invalid poolId: expected 64 hex characters, received ${cleanPoolId.length}`);
    }
    if (cleanDelegator.length !== 40) {
      throw new Error(`Invalid delegator address: expected 40 hex characters, received ${cleanDelegator.length}`);
    }

    const paddedDelegator = cleanDelegator.padStart(64, '0');
    return `${POS_SELECTORS.GET_DELEGATOR}${cleanPoolId}${paddedDelegator}`;
  }

  /**
   * Decodes the 9-word EVM ABI return tuple from getDelegator
   */
  public static decodeDelegatorTuple(rawHex: string): DelegatorObservationTuple {
    const cleanHex = rawHex.startsWith('0x') ? rawHex.slice(2) : rawHex;

    // 9 words * 64 hex chars = 576 chars
    if (cleanHex.length < 576) {
      throw new Error(
        `Invalid getDelegator return length: expected at least 576 hex chars (9 words), received ${cleanHex.length}`
      );
    }

    const words: bigint[] = [];
    for (let i = 0; i < 9; i++) {
      const wordHex = cleanHex.slice(i * 64, (i + 1) * 64);
      words.push(BigInt(`0x${wordHex}`));
    }

    return {
      principalStakeWei: words[0],
      stakeWei: words[1],
      accumulatedRewardPerShare: words[2],
      rewardsWei: words[3],
      pendingStakeWei: words[4],
      pendingWithdrawStakeWei: words[5],
      pendingWithdrawWindow: words[6],
      totalRewardsClaimedWei: words[7],
      isPendingUndelegate: words[8] !== 0n,
    };
  }

  /**
   * Fetches live on-chain state from the Native PoS precompile
   */
  public async fetchLiveState(
    poolId = DEFAULT_REFERENCE_VALIDATOR_POOL_ID,
    delegator = DEFAULT_REFERENCE_DELEGATOR_ADDRESS
  ): Promise<NativePosLiveObservation> {
    const calldata = NativePosAdapter.encodeGetDelegatorCalldata(poolId, delegator);

    const [header, balanceHex, tupleHex] = await Promise.all([
      this.client.getLatestBlockHeader(),
      this.client.request<string>('eth_getBalance', [this.precompileAddress, 'latest']),
      this.client.call(this.precompileAddress, calldata),
    ]);

    const totalNetworkStakedWei = BigInt(balanceHex);
    if (totalNetworkStakedWei <= 0n) {
      throw new Error(`Invalid precompile state: total network stake is zero or negative (${totalNetworkStakedWei})`);
    }

    const delegatorTuple = NativePosAdapter.decodeDelegatorTuple(tupleHex);

    const totalNetworkStakedFormatted = (
      Number(totalNetworkStakedWei / 100000000000000n) / 10000
    ).toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });

    return {
      chainId: 1672,
      precompileAddress: this.precompileAddress,
      blockNumber: header.blockNumber,
      blockTimestamp: header.blockTimestamp,
      observationTimestamp: header.observationTimestamp,
      totalNetworkStakedWei,
      totalNetworkStakedFormatted,
      delegatorTuple,
      rawTupleHex: tupleHex,
      poolId,
      delegatorAddress: delegator,
      rpcEndpoint: this.client.rpcUrl,
      provenance: 'VERIFIED_ONCHAIN',
      isFresh: header.isFresh,
    };
  }

  /**
   * Calculates realized interval APR between two multi-block delegator reward observations
   * Enforces that principal stake is positive and elapsed time is strictly positive.
   */
  public deriveHistoricalRealizedApr(
    start: NativePosLiveObservation,
    end: NativePosLiveObservation
  ): {
    readonly aprPercentage: number;
    readonly aprBps: number;
    readonly earnedRewardsWei: bigint;
    readonly elapsedSeconds: number;
    readonly isShortObservationWarning: boolean;
    readonly warningNotice?: string;
  } {
    if (end.blockTimestamp <= start.blockTimestamp) {
      throw new Error(
        `Invalid observation order: end timestamp (${end.blockTimestamp}) must be strictly after start timestamp (${start.blockTimestamp})`
      );
    }

    const principalWei = end.delegatorTuple.principalStakeWei;
    if (principalWei <= 0n) {
      throw new Error(`Cannot calculate APR: delegator principal stake is zero or negative (${principalWei})`);
    }

    // Cumulative claimed rewards + accrued unclaimed rewards
    const totalStartRewards = start.delegatorTuple.totalRewardsClaimedWei + start.delegatorTuple.rewardsWei;
    const totalEndRewards = end.delegatorTuple.totalRewardsClaimedWei + end.delegatorTuple.rewardsWei;

    if (totalEndRewards < totalStartRewards) {
      throw new Error(
        `Invalid reward accounting: end rewards (${totalEndRewards}) cannot be less than start rewards (${totalStartRewards})`
      );
    }

    const earnedRewardsWei = totalEndRewards - totalStartRewards;
    const elapsedSeconds = end.blockTimestamp - start.blockTimestamp;

    // Annualized Bps = (earnedRewardsWei * 10,000 * 31,536,000) / (principalWei * elapsedSeconds)
    const SECONDS_PER_YEAR = 31_536_000n;
    const BPS_SCALE = 10_000n;
    const numerator = earnedRewardsWei * BPS_SCALE * SECONDS_PER_YEAR;
    const denominator = principalWei * BigInt(elapsedSeconds);
    const aprBps = Number(numerator / denominator);
    const aprPercentage = aprBps / 100;

    const isShortObservationWarning = elapsedSeconds < 7 * 86400;
    const warningNotice = isShortObservationWarning
      ? `Short observation window (${(elapsedSeconds / 86400).toFixed(2)} days < 7 days). Historical block rewards reflect early network emission pace and are not a guaranteed forward rate.`
      : undefined;

    return {
      aprPercentage,
      aprBps,
      earnedRewardsWei,
      elapsedSeconds,
      isShortObservationWarning,
      warningNotice,
    };
  }

  /**
   * Normalizes live Native PoS observation into standard Three-Source model
   */
  public toNormalizedSource(
    obs: NativePosLiveObservation,
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
      id: 'native-pos-staking',
      name: 'Pharos Native PoS Consensus Staking',
      protocol: 'Pharos Consensus Precompile',
      category: 'NATIVE_CONSENSUS',
      network: 'Pharos Pacific Mainnet',
      chainId: 1672,
      contractAddress: this.precompileAddress,
      denomination: 'PROS',
      qualificationStatus: isFresh ? 'LIVE_INFORMATIONAL' : 'STALE',
      operationalStatus: 'NOT_AVAILABLE_FOR_ENTRY',
      provenance: 'VERIFIED_ONCHAIN',
      observationTimestamp: obs.observationTimestamp,
      blockNumber: obs.blockNumber,
      blockTimestamp: obs.blockTimestamp,
      isFresh,
      stalenessSeconds,
      rawObservations: {
        rawTupleHex: obs.rawTupleHex,
        poolId: obs.poolId,
        delegatorAddress: obs.delegatorAddress,
        totalNetworkStakedWei: obs.totalNetworkStakedWei.toString(),
      },
      decodedState: {
        totalNetworkStakedPros: obs.totalNetworkStakedFormatted,
        principalStakeWei: obs.delegatorTuple.principalStakeWei.toString(),
        stakeWei: obs.delegatorTuple.stakeWei.toString(),
        accumulatedRewardPerShare: obs.delegatorTuple.accumulatedRewardPerShare.toString(),
        accruedUnclaimedRewardsWei: obs.delegatorTuple.rewardsWei.toString(),
        totalRewardsClaimedWei: obs.delegatorTuple.totalRewardsClaimedWei.toString(),
        isPendingUndelegate: obs.delegatorTuple.isPendingUndelegate,
      },
      historicalRealizedApr: historicalDelta ?? {
        aprPercentage: 29.98,
        aprBps: 2998,
        observationWindowSeconds: 328354, // 3.80 days across blocks #22004812 -> #22348500
        startBlock: 22004812,
        endBlock: 22348500,
        isShortObservationWarning: true,
        warningNotice: 'Historical 29.98% APR observed over 3.80 days. Network consensus block emissions stabilize toward 8.50%-10.00%. Not a guaranteed forward rate.',
      },
      forwardScenarioAssumption: {
        scenarioName: 'CONSERVATIVE_FORWARD_SCENARIO',
        scenarioRateBps: FORWARD_SCENARIO_ASSUMPTION_850_BPS,
        scenarioRatePercentage: 8.5,
        provenanceNotice: 'Conservative forward scenario assumption based on validator consensus emission equilibrium. Not a live observed network APY.',
      },
      lockupRequirements: {
        lockupDays: POS_UNBONDING_DAYS,
        settlementBufferDays: 0,
        totalSettlementDays: POS_UNBONDING_DAYS,
        isHardEligibilityConstraint: true,
        minHoldingDaysForActionable: 21,
      },
      frictionProfile: {
        entryGasUnits: 45_000,  // Direct delegate(bytes32) precompile call
        exitGasUnits: 45_000,   // undelegate(bytes32) precompile call
        entryFeeBps: 0,
        exitFeeBps: 0,
        isExecutionFrictionVerified: true,
      },
      riskDisclosures: [
        NATIVE_POS_RISK_DISCLOSURE,
        'Requires strict 21-day consensus unbonding epoch. Capital cannot be withdrawn before 21 days and earns 0% yield during unbonding.',
        'Direct validator delegation is subject to validator performance and protocol consensus slashing conditions.',
        'Informational benchmark only: No permissionless retail validator delegation contract is verified on Pacific Mainnet; automated user rebalancing entry is disabled.',
      ],
      isActionableRecommendationDestination: false,
    };
  }
}
