import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PharosDexAdapter,
  PHAROS_DEX_POOL_MANAGER,
  PHAROS_DEX_STATE_VIEW,
  DEX_SELECTORS,
} from '../../src/adapters/dexAdapter.ts';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';

describe('PharosDexAdapter - Unit Tests with Mocked Fixtures', () => {
  it('correctly inspects PoolManager and StateView linkage and marks dynamic fee APR as UNAVAILABLE', async () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });

    client.getBlockNumber = async () => 22_030_188;

    (client as any).request = async (method: string, params: readonly unknown[] = []): Promise<any> => {
      if (method === 'eth_getCode') {
        const address = params[0];
        if (address === PHAROS_DEX_POOL_MANAGER) {
          return '0x60a08060405260...'; // Deployed code
        }
        if (address === PHAROS_DEX_STATE_VIEW) {
          return '0x6080604052...';     // Deployed code
        }
        return '0x';
      }
      throw new Error(`Unexpected request: ${method}`);
    };

    client.call = async (to, data) => {
      assert.strictEqual(to, PHAROS_DEX_STATE_VIEW);
      assert.strictEqual(data, DEX_SELECTORS.POOL_MANAGER);
      return '0x000000000000000000000000d681e96ad464f8f7f7fa7e1e0c5a367175e44550';
    };

    const adapter = new PharosDexAdapter(client);
    const report = await adapter.inspectDex();

    assert.strictEqual(report.chainId, 1672);
    assert.strictEqual(report.poolManagerAddress, PHAROS_DEX_POOL_MANAGER);
    assert.strictEqual(report.stateViewAddress, PHAROS_DEX_STATE_VIEW);
    assert.strictEqual(report.isPoolManagerDeployed, true);
    assert.strictEqual(report.isStateViewDeployed, true);
    assert.strictEqual(report.verifiedLinkedManager.toLowerCase(), PHAROS_DEX_POOL_MANAGER.toLowerCase());
    assert.strictEqual(report.dynamicFeeAprStatus, 'UNAVAILABLE');
    assert.ok(report.missingEvidenceReason.includes('off-chain aggregation'));
    assert.strictEqual(report.executionFeeBps, 30); // 0.30%
  });
});
