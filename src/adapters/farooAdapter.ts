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
} from '../engine/yieldMath.ts';
import type { ProvenanceStatus } from '../types/index.ts';

export const FAROO_STPROS_PROXY = '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4';
export const FAROO_IMPLEMENTATION_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
export const EXPECTED_FAROO_IMPLEMENTATION = '0xfd59860894e01773e9780b0d1dfae4ca2b56708d';

export const SELECTORS = {
  TOTAL_POOLED_PROS: '0x01e1d114', // totalPooledPros()
  TOTAL_SUPPLY: '0x18160ddd',      // totalSupply()
} as const;

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
}
