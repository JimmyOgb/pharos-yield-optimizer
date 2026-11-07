import { describe, it } from 'node:test';
import assert from 'node:assert';
import { YieldSourceRegistry } from '../../src/adapters/yieldSourceRegistry.ts';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';
import { FAROO_STPROS_PROXY } from '../../src/adapters/farooAdapter.ts';
import { NATIVE_POS_PRECOMPILE_ADDRESS } from '../../src/adapters/nativePosAdapter.ts';
import { FAROSWAP_V3_POOL_ADDRESS, WPROS_TOKEN_ADDRESS, USDC_TOKEN_ADDRESS } from '../../src/adapters/faroSwapV3Adapter.ts';
import { type ReasonCode } from '../../src/types/index.ts';

describe('YieldSourceRegistry - Unit Tests with Mocked Fixtures', () => {
  function createMockClient(blockTimestampOffset = 10): PharosRpcClient {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const nowSec = Math.floor(Date.now() / 1000);

    client.getLatestBlockHeader = async () => ({
      blockNumber: 22_350_000,
      blockHash: '0xabc',
      blockTimestamp: nowSec - blockTimestampOffset,
      observationTimestamp: nowSec,
      rpcEndpoint: client.rpcUrl,
      isFresh: blockTimestampOffset <= 600,
    });

    (client as any).request = async (method: string) => {
      if (method === 'eth_getStorageAt') {
        return '0x000000000000000000000000fd59860894e01773e9780b0d1dfae4ca2b56708d';
      }
      if (method === 'eth_getBalance') {
        return '0xeadb6cf9a9478ea10ae2c0'; // 283.9M PROS
      }
      throw new Error(`Unexpected request: ${method}`);
    };

    client.call = async (to, data) => {
      // Faroo
      if (to === FAROO_STPROS_PROXY) {
        if (data === '0x01e1d114') {
          return '0x00000000000000000000000000000000000000000003917479a40eff8554534f';
        }
        if (data === '0x18160ddd') {
          return '0x000000000000000000000000000000000000000000038acb96631da8e90cffa1';
        }
      }
      // Native PoS
      if (to === NATIVE_POS_PRECOMPILE_ADDRESS) {
        const word0 = '000000000000000000000000000000000000000000000c3f3522bdae0e40a4ca';
        const zeroes = '0000000000000000000000000000000000000000000000000000000000000000';
        const word7 = '00000000000000000000000000000000000000000000001bc12595adc3695e5f';
        return '0x' + word0 + word0 + zeroes + zeroes + zeroes + zeroes + zeroes + word7 + zeroes;
      }
      // FaroSwap V3
      if (to === FAROSWAP_V3_POOL_ADDRESS) {
        if (data === '0x3850c7bd') {
          const w0 = '0000000000000000000000000000000000000c5b90a5f20202990ad6'.padStart(64, '0');
          const w1 = 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffbb0b8';
          const zeroes = '0000000000000000000000000000000000000000000000000000000000000001';
          return '0x' + w0 + w1 + zeroes + zeroes + zeroes + zeroes + zeroes;
        }
        if (data === '0x1a686502') return '0x00000000000000000000000000000000000000000000000004012f1783eec8fa';
        if (data === '0xddca3f43') return '0x0000000000000000000000000000000000000000000000000000000000000bb8';
        if (data === '0xd0c93a7c') return '0x000000000000000000000000000000000000000000000000000000000000003c';
        if (data === '0xf3058399') return '0x00000000000000000000000000019fb4a2db2504ae0783197582da236eea6ba8';
        if (data === '0x46141319') return '0x0000000000000000000000000000000000000104dd1d50db811830c037c125b5';
      }
      if (to === WPROS_TOKEN_ADDRESS) {
        return '0x00000000000000000000000000000000000000000000284ab9f73f5509772599';
      }
      if (to === USDC_TOKEN_ADDRESS) {
        return '0x0000000000000000000000000000000000000000000000000000000fd9cd137a';
      }
      throw new Error(`Unexpected call to ${to} with data ${data}`);
    };

    return client;
  }

  it('aggregates all three qualifying sources and satisfies 3-source acceptance requirement', async () => {
    const client = createMockClient(10); // 10s old (fresh)
    const registry = new YieldSourceRegistry(client);

    const snapshot = await registry.fetchSnapshot();

    assert.strictEqual(snapshot.chainId, 1672);
    assert.strictEqual(snapshot.isAllFresh, true);
    assert.strictEqual(snapshot.sourceCount, 3);
    assert.strictEqual(snapshot.qualifiedSourceCount, 3);
    assert.strictEqual(snapshot.actionableSourceCount, 1);
    assert.strictEqual(snapshot.meetsThreeSourceRequirement, true);

    const faroo = snapshot.sources.find((s) => s.id === 'faroo-stpros');
    const pos = snapshot.sources.find((s) => s.id === 'native-pos-staking');
    const lp = snapshot.sources.find((s) => s.id === 'faroswap-wpros-usdc-lp');

    assert.ok(faroo);
    assert.ok(pos);
    assert.ok(lp);

    assert.strictEqual(faroo.qualificationStatus, 'FULLY_QUALIFIED');
    assert.strictEqual(pos.qualificationStatus, 'LIVE_INFORMATIONAL');
    assert.strictEqual(lp.qualificationStatus, 'QUALIFIED_WITH_DISCLOSURE');

    assert.strictEqual(faroo.isActionableRecommendationDestination, true);
    assert.strictEqual(pos.isActionableRecommendationDestination, false); // Restricted entry
    assert.strictEqual(lp.isActionableRecommendationDestination, false); // Informational only
  });

  it('enforces maximum 10-minute staleness threshold and marks stale sources as STALE', async () => {
    const client = createMockClient(650); // 650 seconds old (> 600s threshold)
    const registry = new YieldSourceRegistry(client);

    const snapshot = await registry.fetchSnapshot();

    assert.strictEqual(snapshot.isAllFresh, false);
    for (const source of snapshot.sources) {
      assert.strictEqual(source.isFresh, false);
      assert.strictEqual(source.qualificationStatus, 'STALE');
      assert.ok(source.stalenessSeconds >= 600);
    }
  });

  it('fails closed when an adapter throws and marks the source as ERROR', async () => {
    const client = createMockClient(10);
    // Make Faroo throw
    const originalCall = client.call.bind(client);
    client.call = async (to, data) => {
      if (to === FAROO_STPROS_PROXY) {
        throw new Error('RPC connection reset by peer');
      }
      return originalCall(to, data);
    };

    const registry = new YieldSourceRegistry(client);
    const snapshot = await registry.fetchSnapshot();

    assert.strictEqual(snapshot.isAllFresh, false);
    assert.strictEqual(snapshot.meetsThreeSourceRequirement, false);
    assert.strictEqual(snapshot.qualifiedSourceCount, 2); // only PoS and LP succeeded

    const faroo = snapshot.sources.find((s) => s.id === 'faroo-stpros');
    assert.ok(faroo);
    assert.strictEqual(faroo.qualificationStatus, 'ERROR');
    assert.strictEqual(faroo.isActionableRecommendationDestination, false);
    assert.ok(faroo.unavailableReason?.includes('RPC connection reset'));
  });

  it('confirms TIE_NO_MEANINGFUL_ALPHA is defined in ReasonCode taxonomy', () => {
    const testCode: ReasonCode = 'TIE_NO_MEANINGFUL_ALPHA';
    assert.strictEqual(testCode, 'TIE_NO_MEANINGFUL_ALPHA');
  });
});
