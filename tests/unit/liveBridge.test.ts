import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  LiveRecommendationBridge,
} from '../../src/adapters/liveRecommendationBridge.ts';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';
import { SCALE_18 } from '../../src/engine/yieldMath.ts';

describe('LiveRecommendationBridge - Unit Tests with Mocked Fixtures', () => {
  it('generates MOVE recommendation with fresh live context and live gas price', async () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const nowSeconds = Math.floor(Date.now() / 1000);

    client.verifyChainId = async () => ({ chainId: 1672, chainIdHex: '0x688', isVerified: true });
    client.getGasPrice = async () => ({
      gasPriceWei: 10_000_000_000n,
      gasPriceGwei: 10.0, // Live 10 Gwei
      blockNumber: 22_030_188,
      observationTimestamp: nowSeconds,
      rpcEndpoint: client.rpcUrl,
      isFresh: true,
    });
    client.getLatestBlockHeader = async () => ({
      blockNumber: 22_030_188,
      blockHash: '0xabc',
      blockTimestamp: nowSeconds - 10,
      observationTimestamp: nowSeconds,
      rpcEndpoint: client.rpcUrl,
      isFresh: true,
    });
    client.call = async (_, data) => {
      if (data === '0x01e1d114') return '0x000000000000000000000000000000000000000000029b886d586a3d01ee1709';
      if (data === '0x18160ddd') return '0x00000000000000000000000000000000000000000002984445d7ac484049e4bf';
      if (data === '0xdc4c90d3') return '0x000000000000000000000000d681e96ad464f8f7f7fa7e1e0c5a367175e44550';
      return '0x';
    };
    (client as any).request = async (method: string): Promise<any> => {
      if (method === 'eth_getStorageAt') return '0x000000000000000000000000fd59860894e01773e9780b0d1dfae4ca2b56708d';
      if (method === 'eth_getCode') return '0x60a0...';
      if (method === 'eth_blockNumber') return '0x150276c';
      throw new Error(`Unexpected: ${method}`);
    };

    const bridge = new LiveRecommendationBridge(client);
    const result = await bridge.evaluateLiveRecommendation({
      principalWei: 1_000n * SCALE_18,
      asset: 'PROS',
      horizonDays: 60,
      requireInstantLiquidity: false,
    });

    assert.strictEqual(result.status, 'SUCCESS');
    if (result.status === 'SUCCESS') {
      assert.strictEqual(result.context.gasPriceGwei, 10.0);
      assert.strictEqual(result.context.isDataFresh, true);
      assert.strictEqual(result.recommendation.decision, 'MOVE');
      assert.strictEqual(result.recommendation.targetStrategyId, 'faroo-patient-staking');
    }
  });

  it('outputs INSUFFICIENT_DATA when live RPC fails or is unavailable', async () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    client.verifyChainId = async () => {
      throw new Error('Connection refused to RPC endpoint');
    };

    const bridge = new LiveRecommendationBridge(client);
    const result = await bridge.evaluateLiveRecommendation({
      principalWei: 1_000n * SCALE_18,
      asset: 'PROS',
      horizonDays: 60,
      requireInstantLiquidity: false,
    });

    assert.strictEqual(result.status, 'RPC_UNAVAILABLE');
    if (result.status === 'RPC_UNAVAILABLE') {
      assert.ok(result.error.includes('Connection refused'));
      assert.strictEqual(result.recommendation.decision, 'INSUFFICIENT_DATA');
      assert.strictEqual(result.recommendation.reasonCode, 'STALE_OR_MISSING_ONCHAIN_DATA');
    }
  });
});
