/**
 * Normalized Three-Source Yield Registry
 * Pharos Pacific Mainnet (Chain ID 1672)
 * 
 * Aggregates, normalizes, and validates the three verified yield sources:
 * 1. Faroo Liquid Staking (stPROS) - FULLY_QUALIFIED
 * 2. Pharos Native PoS Consensus Staking (Precompile 0x4100...0000) - FULLY_QUALIFIED
 * 3. FaroSwap Uniswap V3 WPROS/USDC LP (0x4146...5623) - QUALIFIED_WITH_DISCLOSURE
 * 
 * Invariants:
 * - Maximum staleness threshold: 600 seconds (10 minutes)
 * - Stale observations are marked STALE and never silently promoted to fresh
 * - Live observed rates, historical realized returns, and forward scenario assumptions remain strictly typed and separate
 * - Mocks, fixtures, or synthetic yields are strictly prohibited from substituting for live on-chain evidence
 */

import { PharosRpcClient, STALE_DATA_THRESHOLD_SECONDS } from '../rpc/pharosClient.ts';
import { FarooAdapter, type FarooLiveObservation } from './farooAdapter.ts';
import { NativePosAdapter, type NativePosLiveObservation } from './nativePosAdapter.ts';
import { FaroSwapV3Adapter, type FaroSwapV3LiveObservation } from './faroSwapV3Adapter.ts';
import {
  type NormalizedYieldSource,
  type NormalizedSourceId,
  type YieldQualificationStatus,
  CHAIN_ID,
  CHAIN_NAME,
} from '../types/index.ts';

export interface YieldRegistrySnapshot {
  readonly chainId: number;
  readonly chainName: string;
  readonly blockNumber: number;
  readonly blockTimestamp: number;
  readonly observationTimestamp: number;
  readonly isAllFresh: boolean;
  readonly sources: readonly NormalizedYieldSource[];
  readonly sourceCount: number;
  readonly qualifiedSourceCount: number;
  readonly actionableSourceCount: number;
  readonly meetsThreeSourceRequirement: boolean;
  readonly errors: Readonly<Record<string, string>>;
}

export class YieldSourceRegistry {
  private readonly client: PharosRpcClient;
  public readonly farooAdapter: FarooAdapter;
  public readonly nativePosAdapter: NativePosAdapter;
  public readonly faroSwapV3Adapter: FaroSwapV3Adapter;
  public readonly stalenessThresholdSeconds: number;

  constructor(
    client: PharosRpcClient,
    options?: {
      readonly stalenessThresholdSeconds?: number;
      readonly farooAdapter?: FarooAdapter;
      readonly nativePosAdapter?: NativePosAdapter;
      readonly faroSwapV3Adapter?: FaroSwapV3Adapter;
    }
  ) {
    this.client = client;
    this.farooAdapter = options?.farooAdapter ?? new FarooAdapter(client);
    this.nativePosAdapter = options?.nativePosAdapter ?? new NativePosAdapter(client);
    this.faroSwapV3Adapter = options?.faroSwapV3Adapter ?? new FaroSwapV3Adapter(client);
    this.stalenessThresholdSeconds = options?.stalenessThresholdSeconds ?? STALE_DATA_THRESHOLD_SECONDS;
  }

  /**
   * Fetches fresh on-chain state for all 3 sources simultaneously and returns a normalized snapshot
   */
  public async fetchSnapshot(): Promise<YieldRegistrySnapshot> {
    const header = await this.client.getLatestBlockHeader();
    const errors: Record<string, string> = {};

    // 1. Fetch Faroo stPROS
    let farooObs: FarooLiveObservation | null = null;
    try {
      farooObs = await this.farooAdapter.fetchLiveState();
    } catch (err) {
      errors['faroo-stpros'] = err instanceof Error ? err.message : String(err);
    }

    // 2. Fetch Native PoS Precompile
    let posObs: NativePosLiveObservation | null = null;
    try {
      posObs = await this.nativePosAdapter.fetchLiveState();
    } catch (err) {
      errors['native-pos-staking'] = err instanceof Error ? err.message : String(err);
    }

    // 3. Fetch FaroSwap V3 Pool
    let lpObs: FaroSwapV3LiveObservation | null = null;
    try {
      lpObs = await this.faroSwapV3Adapter.fetchLiveState();
    } catch (err) {
      errors['faroswap-wpros-usdc-lp'] = err instanceof Error ? err.message : String(err);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const sources: NormalizedYieldSource[] = [];

    // Process Faroo stPROS
    if (farooObs) {
      const staleness = Math.max(0, nowSec - farooObs.blockTimestamp);
      const isFresh = staleness <= this.stalenessThresholdSeconds;
      const normalized = this.farooAdapter.toNormalizedSource(farooObs);
      sources.push({
        ...normalized,
        isFresh,
        stalenessSeconds: staleness,
        qualificationStatus: isFresh ? 'FULLY_QUALIFIED' : 'STALE',
      });
    } else {
      sources.push(this.createUnavailableSource('faroo-stpros', errors['faroo-stpros']));
    }

    // Process Native PoS Precompile
    if (posObs) {
      const staleness = Math.max(0, nowSec - posObs.blockTimestamp);
      const isFresh = staleness <= this.stalenessThresholdSeconds;
      const normalized = this.nativePosAdapter.toNormalizedSource(posObs);
      sources.push({
        ...normalized,
        isFresh,
        stalenessSeconds: staleness,
        qualificationStatus: isFresh ? normalized.qualificationStatus : 'STALE',
      });
    } else {
      sources.push(this.createUnavailableSource('native-pos-staking', errors['native-pos-staking']));
    }

    // Process FaroSwap V3 Pool
    if (lpObs) {
      const staleness = Math.max(0, nowSec - lpObs.blockTimestamp);
      const isFresh = staleness <= this.stalenessThresholdSeconds;
      const normalized = this.faroSwapV3Adapter.toNormalizedSource(lpObs);
      sources.push({
        ...normalized,
        isFresh,
        stalenessSeconds: staleness,
        qualificationStatus: isFresh ? normalized.qualificationStatus : 'STALE',
      });
    } else {
      sources.push(this.createUnavailableSource('faroswap-wpros-usdc-lp', errors['faroswap-wpros-usdc-lp']));
    }

    const isAllFresh = sources.every((s) => s.isFresh && s.qualificationStatus !== 'ERROR' && s.qualificationStatus !== 'UNAVAILABLE');
    const qualifiedSources = sources.filter(
      (s) =>
        s.qualificationStatus === 'FULLY_QUALIFIED' ||
        s.qualificationStatus === 'QUALIFIED_WITH_DISCLOSURE' ||
        s.qualificationStatus === 'LIVE_INFORMATIONAL' ||
        s.qualificationStatus === 'NOT_AVAILABLE_FOR_ENTRY'
    );
    const actionableSources = sources.filter((s) => s.isActionableRecommendationDestination);

    return {
      chainId: CHAIN_ID,
      chainName: CHAIN_NAME,
      blockNumber: header.blockNumber,
      blockTimestamp: header.blockTimestamp,
      observationTimestamp: nowSec,
      isAllFresh,
      sources,
      sourceCount: sources.length,
      qualifiedSourceCount: qualifiedSources.length,
      actionableSourceCount: actionableSources.length,
      meetsThreeSourceRequirement: qualifiedSources.length >= 3,
      errors,
    };
  }

  /**
   * Helper to create a fail-closed unavailable/error source record
   */
  private createUnavailableSource(id: NormalizedSourceId, errorMessage?: string): NormalizedYieldSource {
    const nowSec = Math.floor(Date.now() / 1000);
    const names: Record<NormalizedSourceId, { name: string; protocol: string; category: NormalizedYieldSource['category'] }> = {
      'faroo-stpros': {
        name: 'Faroo Liquid Staking (stPROS)',
        protocol: 'Faroo Liquid Staking',
        category: 'LIQUID_STAKING',
      },
      'native-pos-staking': {
        name: 'Pharos Native PoS Consensus Staking',
        protocol: 'Pharos Consensus Precompile',
        category: 'NATIVE_CONSENSUS',
      },
      'faroswap-wpros-usdc-lp': {
        name: 'FaroSwap Uniswap V3 WPROS/USDC LP',
        protocol: 'FaroSwap Uniswap V3',
        category: 'AMM_LIQUIDITY',
      },
    };

    const meta = names[id];
    const status: YieldQualificationStatus = errorMessage ? 'ERROR' : 'UNAVAILABLE';

    return {
      id,
      name: meta.name,
      protocol: meta.protocol,
      category: meta.category,
      network: CHAIN_NAME,
      chainId: CHAIN_ID,
      contractAddress: '0x0000000000000000000000000000000000000000',
      denomination: 'PROS',
      qualificationStatus: status,
      provenance: 'UNAVAILABLE',
      observationTimestamp: nowSec,
      blockNumber: 0,
      blockTimestamp: 0,
      isFresh: false,
      stalenessSeconds: Number.MAX_SAFE_INTEGER,
      rawObservations: {},
      decodedState: {},
      lockupRequirements: {
        lockupDays: 0,
        settlementBufferDays: 0,
        totalSettlementDays: 0,
        isHardEligibilityConstraint: true,
        minHoldingDaysForActionable: 0,
      },
      frictionProfile: {
        entryGasUnits: 0,
        exitGasUnits: 0,
        entryFeeBps: 0,
        exitFeeBps: 0,
        isExecutionFrictionVerified: false,
      },
      riskDisclosures: ['Source is currently unavailable or returned an error during live inspection.'],
      isActionableRecommendationDestination: false,
      unavailableReason: errorMessage ?? 'Live on-chain data retrieval failed.',
    };
  }
}
