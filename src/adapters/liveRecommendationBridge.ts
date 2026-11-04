/**
 * Live Recommendation Bridge
 * Pharos Pacific Mainnet (Chain ID 1672)
 * 
 * Bridges live on-chain observations (gas price, Faroo state, DEX inspection)
 * into the deterministic recommendation engine with non-bypassable freshness guards.
 */

import { PharosRpcClient } from '../rpc/pharosClient.ts';
import { FarooAdapter, type FarooLiveObservation } from './farooAdapter.ts';
import { PharosDexAdapter, type DexInspectionReport } from './dexAdapter.ts';
import { generateRecommendation } from '../engine/recommendationEngine.ts';
import type {
  OptimizerQueryInput,
  OptimizerRecommendation,
} from '../types/index.ts';

export interface LiveEcosystemContext {
  readonly chainId: number;
  readonly blockNumber: number;
  readonly gasPriceGwei: number;
  readonly farooObservation: FarooLiveObservation;
  readonly dexInspection: DexInspectionReport;
  readonly isDataFresh: boolean;
  readonly observationTimestamp: number;
}

export type LiveRecommendationResult =
  | {
      readonly status: 'SUCCESS';
      readonly context: LiveEcosystemContext;
      readonly recommendation: OptimizerRecommendation;
    }
  | {
      readonly status: 'RPC_UNAVAILABLE';
      readonly error: string;
      readonly recommendation: OptimizerRecommendation;
    };

export class LiveRecommendationBridge {
  private readonly client: PharosRpcClient;
  private readonly farooAdapter: FarooAdapter;
  private readonly dexAdapter: PharosDexAdapter;

  constructor(client: PharosRpcClient) {
    this.client = client;
    this.farooAdapter = new FarooAdapter(client);
    this.dexAdapter = new PharosDexAdapter(client);
  }

  /**
   * Fetches fresh on-chain ecosystem context from live RPC
   */
  public async fetchLiveContext(): Promise<LiveEcosystemContext> {
    // 1. Verify Chain ID
    await this.client.verifyChainId();

    // 2. Fetch live gas price, Faroo state, and DEX status in parallel
    const [gasPriceObs, farooObs, dexReport] = await Promise.all([
      this.client.getGasPrice(),
      this.farooAdapter.fetchLiveState(),
      this.dexAdapter.inspectDex(),
    ]);

    const isDataFresh = gasPriceObs.isFresh && farooObs.isFresh;

    return {
      chainId: 1672,
      blockNumber: gasPriceObs.blockNumber,
      gasPriceGwei: gasPriceObs.gasPriceGwei,
      farooObservation: farooObs,
      dexInspection: dexReport,
      isDataFresh,
      observationTimestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Generates recommendation using live on-chain observations
   */
  public async evaluateLiveRecommendation(
    query: OptimizerQueryInput
  ): Promise<LiveRecommendationResult> {
    try {
      const context = await this.fetchLiveContext();

      // Pass fresh live gas price and freshness status to the recommendation engine
      const recommendation = generateRecommendation(
        query,
        context.gasPriceGwei,
        !context.isDataFresh, // isDataStale
        false                 // isDataUnavailable
      );

      return {
        status: 'SUCCESS',
        context,
        recommendation,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // If RPC or network fails, generate explicit INSUFFICIENT_DATA recommendation
      const fallbackRec = generateRecommendation(
        query,
        10.0, // placeholder gas price disregarded due to unavailable flag
        false,
        true  // isDataUnavailable = true
      );

      return {
        status: 'RPC_UNAVAILABLE',
        error: errorMessage,
        recommendation: fallbackRec,
      };
    }
  }
}
