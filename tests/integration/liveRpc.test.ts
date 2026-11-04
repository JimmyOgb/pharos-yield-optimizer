import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';
import { FarooAdapter, FAROO_STPROS_PROXY, EXPECTED_FAROO_IMPLEMENTATION } from '../../src/adapters/farooAdapter.ts';
import { PharosDexAdapter, PHAROS_DEX_POOL_MANAGER } from '../../src/adapters/dexAdapter.ts';
import { LiveRecommendationBridge } from '../../src/adapters/liveRecommendationBridge.ts';
import { SCALE_18 } from '../../src/engine/yieldMath.ts';

describe('Live Integration Tests - Pharos Pacific Mainnet (Chain ID 1672)', () => {
  const client = new PharosRpcClient({ rpcUrl: 'https://rpc.pharos.xyz', timeoutMs: 10_000 });

  it('connects to live Pharos RPC and verifies Chain ID 1672 (0x688)', async () => {
    const chainVerification = await client.verifyChainId();
    assert.strictEqual(chainVerification.chainId, 1672);
    assert.strictEqual(chainVerification.chainIdHex, '0x688');
    assert.strictEqual(chainVerification.isVerified, true);
  });

  it('retrieves live block number (> 22,000,000) and block header timestamp', async () => {
    const header = await client.getLatestBlockHeader();
    assert.ok(header.blockNumber > 22_000_000, `Expected block > 22M, got ${header.blockNumber}`);
    assert.ok(header.blockTimestamp > 1_700_000_000);
    assert.strictEqual(header.isFresh, true);
  });

  it('retrieves live gas price from Pacific Mainnet', async () => {
    const gasObs = await client.getGasPrice();
    assert.ok(gasObs.gasPriceWei > 0n);
    assert.ok(gasObs.gasPriceGwei >= 1.0 && gasObs.gasPriceGwei <= 50.0, `Observed Gwei: ${gasObs.gasPriceGwei}`);
  });

  it('reads Faroo stPROS live contract state and verifies spot rate', async () => {
    const adapter = new FarooAdapter(client);
    const obs = await adapter.fetchLiveState();

    assert.strictEqual(obs.chainId, 1672);
    assert.strictEqual(obs.contractAddress, FAROO_STPROS_PROXY);
    assert.strictEqual(obs.implementationAddress.toLowerCase(), EXPECTED_FAROO_IMPLEMENTATION.toLowerCase());
    assert.ok(obs.totalPooledProsWei > 3_000_000n * SCALE_18);
    assert.ok(obs.totalSupplyWei > 3_000_000n * SCALE_18);
    assert.ok(obs.spotRateDecimal > 1.0040 && obs.spotRateDecimal < 1.0100, `Observed rate: ${obs.spotRateDecimal}`);
    assert.strictEqual(obs.provenance, 'VERIFIED_ONCHAIN');
    assert.strictEqual(obs.isFresh, true);
  });

  it('inspects Pharos DEX infrastructure on Pacific Mainnet', async () => {
    const dexAdapter = new PharosDexAdapter(client);
    const report = await dexAdapter.inspectDex();

    assert.strictEqual(report.chainId, 1672);
    assert.strictEqual(report.isPoolManagerDeployed, true);
    assert.strictEqual(report.isStateViewDeployed, true);
    assert.strictEqual(report.verifiedLinkedManager.toLowerCase(), PHAROS_DEX_POOL_MANAGER.toLowerCase());
    assert.strictEqual(report.dynamicFeeAprStatus, 'UNAVAILABLE');
    assert.strictEqual(report.executionFeeBps, 30);
  });

  it('executes full live recommendation bridge for 1,000 PROS over 60 days', async () => {
    const bridge = new LiveRecommendationBridge(client);
    const result = await bridge.evaluateLiveRecommendation({
      principalWei: 1_000n * SCALE_18,
      asset: 'PROS',
      horizonDays: 60,
      requireInstantLiquidity: false,
    });

    assert.strictEqual(result.status, 'SUCCESS');
    if (result.status === 'SUCCESS') {
      assert.strictEqual(result.context.chainId, 1672);
      assert.strictEqual(result.recommendation.decision, 'MOVE');
      assert.strictEqual(result.recommendation.targetStrategyId, 'faroo-patient-staking');
      assert.strictEqual(result.recommendation.verifiedQualifyingSourcesCount, 1);
    }
  });
});
