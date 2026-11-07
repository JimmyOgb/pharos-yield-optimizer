import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  FarooAdapter,
  FAROO_STPROS_PROXY,
  EXPECTED_FAROO_IMPLEMENTATION,
  SELECTORS,
  FAROO_IMPLEMENTATION_SLOT,
} from '../../src/adapters/farooAdapter.ts';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';

describe('FarooAdapter - Unit Tests with Mocked Fixtures', () => {
  it('correctly reads Faroo stPROS live state and parses exchange rate', async () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Mock client methods
    client.getLatestBlockHeader = async () => ({
      blockNumber: 22_030_188,
      blockHash: '0xabc',
      blockTimestamp: nowSeconds - 5,
      observationTimestamp: nowSeconds,
      rpcEndpoint: client.rpcUrl,
      isFresh: true,
    });

    client.call = async (to, data) => {
      assert.strictEqual(to, FAROO_STPROS_PROXY);
      if (data === SELECTORS.TOTAL_POOLED_PROS) {
        // 3,152,335.122709121855624969 PROS
        return '0x000000000000000000000000000000000000000000029b886d586a3d01ee1709';
      }
      if (data === SELECTORS.TOTAL_SUPPLY) {
        // 3,136,910.755900000000000000 stPROS
        return '0x00000000000000000000000000000000000000000002984445d7ac484049e4bf';
      }
      throw new Error(`Unexpected call data: ${data}`);
    };

    (client as any).request = async (method: string, params: readonly unknown[] = []): Promise<any> => {
      if (method === 'eth_getStorageAt') {
        assert.strictEqual(params[0], FAROO_STPROS_PROXY);
        assert.strictEqual(params[1], FAROO_IMPLEMENTATION_SLOT);
        return '0x000000000000000000000000fd59860894e01773e9780b0d1dfae4ca2b56708d';
      }
      throw new Error(`Unexpected request: ${method}`);
    };

    const adapter = new FarooAdapter(client);
    const obs = await adapter.fetchLiveState();

    assert.strictEqual(obs.chainId, 1672);
    assert.strictEqual(obs.contractAddress, FAROO_STPROS_PROXY);
    assert.strictEqual(obs.implementationAddress, EXPECTED_FAROO_IMPLEMENTATION);
    assert.strictEqual(obs.blockNumber, 22_030_188);
    assert.strictEqual(obs.isFresh, true);
    assert.strictEqual(obs.provenance, 'VERIFIED_ONCHAIN');
    assert.ok(obs.spotRateDecimal > 1.00491 && obs.spotRateDecimal < 1.00492);
    assert.ok(obs.totalPooledProsFormatted.includes('3,152,335'));
    assert.ok(obs.totalSupplyFormatted.includes('3,136,910'));
  });

  it('rejects zero total supply from contract', async () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    client.getLatestBlockHeader = async () => ({
      blockNumber: 1,
      blockHash: '0xabc',
      blockTimestamp: 1000,
      observationTimestamp: 1005,
      rpcEndpoint: client.rpcUrl,
      isFresh: true,
    });
    client.call = async (_, data) => {
      if (data === SELECTORS.TOTAL_POOLED_PROS) return '0x01';
      if (data === SELECTORS.TOTAL_SUPPLY) return '0x00'; // 0 supply
      return '0x';
    };
    (client as any).request = async (): Promise<any> => '0x000000000000000000000000fd59860894e01773e9780b0d1dfae4ca2b56708d';

    const adapter = new FarooAdapter(client);
    await assert.rejects(
      () => adapter.fetchLiveState(),
      /Invalid Faroo contract state: totalSupply is zero or negative/
    );
  });

  it('rejects zero pooled assets from contract', async () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    client.getLatestBlockHeader = async () => ({
      blockNumber: 1,
      blockHash: '0xabc',
      blockTimestamp: 1000,
      observationTimestamp: 1005,
      rpcEndpoint: client.rpcUrl,
      isFresh: true,
    });
    client.call = async (_, data) => {
      if (data === SELECTORS.TOTAL_POOLED_PROS) return '0x00'; // 0 assets
      if (data === SELECTORS.TOTAL_SUPPLY) return '0x01';
      return '0x';
    };
    (client as any).request = async (): Promise<any> => '0x000000000000000000000000fd59860894e01773e9780b0d1dfae4ca2b56708d';

    const adapter = new FarooAdapter(client);
    await assert.rejects(
      () => adapter.fetchLiveState(),
      /Invalid Faroo contract state: totalPooledAssets is zero or negative/
    );
  });

  it('correctly derives historical realized APR and attaches short-window warning', () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const adapter = new FarooAdapter(client);

    const obsStart = {
      chainId: 1672,
      contractAddress: FAROO_STPROS_PROXY,
      implementationAddress: EXPECTED_FAROO_IMPLEMENTATION,
      blockNumber: 21_924_812,
      blockTimestamp: 1_793_600_000,
      observationTimestamp: 1_793_600_000,
      raw: { totalPooledProsHex: '0x01', totalSupplyHex: '0x01' },
      totalPooledProsWei: 4_300_000n * 10n ** 18n,
      totalSupplyWei: 4_300_000n * 10n ** 18n,
      spotRateScaled: 10n ** 18n, // 1.00000000
      spotRateDecimal: 1.0,
      totalPooledProsFormatted: '4,300,000.0000',
      totalSupplyFormatted: '4,300,000.0000',
      rpcEndpoint: client.rpcUrl,
      provenance: 'VERIFIED_ONCHAIN' as const,
      isFresh: true,
    };

    const obsEnd = {
      ...obsStart,
      blockNumber: 22_348_179,
      blockTimestamp: 1_793_600_000 + 413_367, // 4.78 days later
      spotRateScaled: 1_003_427_000_000_000_000n, // +0.3427% gain
      spotRateDecimal: 1.003427,
    };

    const result = adapter.deriveHistoricalRealizedApr(obsStart, obsEnd);
    assert.strictEqual(result.isShortObservationWarning, true);
    assert.ok(result.aprPercentage > 25 && result.aprPercentage < 27); // ~26.14% APR
    assert.ok(result.warningNotice?.includes('early episodic reward indexing'));
  });

  it('correctly enforces hard 15-day unbonding requirements in normalized source', () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const adapter = new FarooAdapter(client);

    const nowSec = Math.floor(Date.now() / 1000);
    const obs = {
      chainId: 1672,
      contractAddress: FAROO_STPROS_PROXY,
      implementationAddress: EXPECTED_FAROO_IMPLEMENTATION,
      blockNumber: 22_030_188,
      blockTimestamp: nowSec - 30,
      observationTimestamp: nowSec,
      raw: { totalPooledProsHex: '0x01', totalSupplyHex: '0x01' },
      totalPooledProsWei: 4_317_458n * 10n ** 18n,
      totalSupplyWei: 4_266_747n * 10n ** 18n,
      spotRateScaled: 1_011_885_000_000_000_000n,
      spotRateDecimal: 1.011885,
      totalPooledProsFormatted: '4,317,458.7845',
      totalSupplyFormatted: '4,266,747.8860',
      rpcEndpoint: client.rpcUrl,
      provenance: 'VERIFIED_ONCHAIN' as const,
      isFresh: true,
    };

    const normalized = adapter.toNormalizedSource(obs);
    assert.strictEqual(normalized.id, 'faroo-stpros');
    assert.strictEqual(normalized.qualificationStatus, 'FULLY_QUALIFIED');
    assert.strictEqual(normalized.lockupRequirements.lockupDays, 14);
    assert.strictEqual(normalized.lockupRequirements.settlementBufferDays, 1);
    assert.strictEqual(normalized.lockupRequirements.totalSettlementDays, 15);
    assert.strictEqual(normalized.lockupRequirements.isHardEligibilityConstraint, true);
    assert.strictEqual(normalized.lockupRequirements.minHoldingDaysForActionable, 15);
    assert.strictEqual(normalized.isActionableRecommendationDestination, true);
    assert.strictEqual(normalized.forwardScenarioAssumption?.scenarioRateBps, 850);
  });
});
