import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  FaroSwapV3Adapter,
  FAROSWAP_V3_POOL_ADDRESS,
  FAROSWAP_V3_FACTORY_ADDRESS,
  WPROS_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
  V3_SELECTORS,
} from '../../src/adapters/faroSwapV3Adapter.ts';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';
import { FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS } from '../../src/types/index.ts';

describe('FaroSwapV3Adapter - Unit Tests with Mocked Fixtures', () => {
  it('correctly decodes Uniswap V3 slot0 ABI return with negative tick', () => {
    // Word 0: sqrtPriceX96 (e.g. 58184554812338784049279)
    const word0 = '0000000000000000000000000000000000000c5b90a5f20202990ad6'.padStart(64, '0');
    // Word 1: tick -20360 (0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffbb0b8)
    const word1 = 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffbb0b8';
    const word2 = '000000000000000000000000000000000000000000000000000000000000001d'; // observationIndex: 29
    const word3 = '000000000000000000000000000000000000000000000000000000000000012c'; // cardinality: 300
    const word4 = '000000000000000000000000000000000000000000000000000000000000012c'; // cardinalityNext: 300
    const word5 = '0000000000000000000000000000000000000000000000000000000000000044'; // feeProtocol: 68
    const word6 = '0000000000000000000000000000000000000000000000000000000000000001'; // unlocked: true

    const rawHex = '0x' + word0 + word1 + word2 + word3 + word4 + word5 + word6;
    const decoded = FaroSwapV3Adapter.decodeSlot0(rawHex);

    assert.ok(decoded.sqrtPriceX96 > 0n);
    assert.strictEqual(decoded.tick, -282440);
    assert.strictEqual(decoded.observationIndex, 29);
    assert.strictEqual(decoded.observationCardinality, 300);
    assert.strictEqual(decoded.feeProtocol, 68);
    assert.strictEqual(decoded.unlocked, true);
  });

  it('rejects malformed slot0 payload shorter than 7 words', () => {
    assert.throws(
      () => FaroSwapV3Adapter.decodeSlot0('0x1234'),
      /Invalid slot0 hex length/
    );
  });

  it('fetches live pool state with mocked RPC client', async () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const nowSec = Math.floor(Date.now() / 1000);

    client.getLatestBlockHeader = async () => ({
      blockNumber: 22_350_000,
      blockHash: '0xabc',
      blockTimestamp: nowSec - 5,
      observationTimestamp: nowSec,
      rpcEndpoint: client.rpcUrl,
      isFresh: true,
    });

    client.call = async (to, data) => {
      if (to === FAROSWAP_V3_POOL_ADDRESS) {
        if (data === V3_SELECTORS.SLOT0) {
          const w0 = '0000000000000000000000000000000000000c5b90a5f20202990ad6'.padStart(64, '0');
          const w1 = 'fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffbb0b8';
          const zeroes = '0000000000000000000000000000000000000000000000000000000000000001';
          return '0x' + w0 + w1 + zeroes + zeroes + zeroes + zeroes + zeroes;
        }
        if (data === V3_SELECTORS.LIQUIDITY) {
          return '0x00000000000000000000000000000000000000000000000004012f1783eec8fa';
        }
        if (data === V3_SELECTORS.FEE) {
          return '0x0000000000000000000000000000000000000000000000000000000000000bb8'; // 3000
        }
        if (data === V3_SELECTORS.TICK_SPACING) {
          return '0x000000000000000000000000000000000000000000000000000000000000003c'; // 60
        }
        if (data === V3_SELECTORS.FEE_GROWTH_GLOBAL_0) {
          return '0x00000000000000000000000000019fb4a2db2504ae0783197582da236eea6ba8';
        }
        if (data === V3_SELECTORS.FEE_GROWTH_GLOBAL_1) {
          return '0x0000000000000000000000000000000000000104dd1d50db811830c037c125b5';
        }
      }
      if (to === WPROS_TOKEN_ADDRESS) {
        // 190,071.4062 WPROS
        return '0x00000000000000000000000000000000000000000000284ab9f73f5509772599';
      }
      if (to === USDC_TOKEN_ADDRESS) {
        // 68,107.4625 USDC
        return '0x0000000000000000000000000000000000000000000000000000000fd9cd137a';
      }
      throw new Error(`Unexpected call to ${to} with data ${data}`);
    };

    const adapter = new FaroSwapV3Adapter(client);
    const obs = await adapter.fetchLiveState();

    assert.strictEqual(obs.chainId, 1672);
    assert.strictEqual(obs.poolAddress, FAROSWAP_V3_POOL_ADDRESS);
    assert.strictEqual(obs.factoryAddress, FAROSWAP_V3_FACTORY_ADDRESS);
    assert.strictEqual(obs.token0Address, WPROS_TOKEN_ADDRESS);
    assert.strictEqual(obs.token1Address, USDC_TOKEN_ADDRESS);
    assert.strictEqual(obs.feeTier, 3000);
    assert.strictEqual(obs.tickSpacing, 60);
    assert.strictEqual(obs.slot0.tick, -282440);
    assert.ok(obs.token0BalanceFormatted.includes('WPROS'));
    assert.ok(obs.token1BalanceFormatted.includes('USDC'));
    assert.strictEqual(obs.isFresh, true);
    assert.strictEqual(obs.provenance, 'VERIFIED_ONCHAIN');
  });

  it('normalizes FaroSwap V3 LP with QUALIFIED_WITH_DISCLOSURE and disabled automated MOVE', () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const adapter = new FaroSwapV3Adapter(client);

    const nowSec = Math.floor(Date.now() / 1000);
    const obs = {
      chainId: 1672,
      poolAddress: FAROSWAP_V3_POOL_ADDRESS,
      factoryAddress: FAROSWAP_V3_FACTORY_ADDRESS,
      token0Address: WPROS_TOKEN_ADDRESS,
      token1Address: USDC_TOKEN_ADDRESS,
      feeTier: 3000,
      tickSpacing: 60,
      slot0: {
        sqrtPriceX96: 58184554812338784049279n,
        tick: -282499,
        observationIndex: 29,
        observationCardinality: 300,
        observationCardinalityNext: 300,
        feeProtocol: 68,
        unlocked: true,
      },
      activeLiquidityWei: 288531899219832113n,
      token0BalanceWei: 191235n * 10n ** 18n,
      token1BalanceWei: 67475n * 10n ** 6n,
      token0BalanceFormatted: '191,235.65 WPROS',
      token1BalanceFormatted: '67,475.78 USDC',
      spotPriceUsdPerPros: 0.5393,
      poolTvlUsd: 170615,
      feeGrowthGlobal0X128: 10642035n,
      feeGrowthGlobal1X128: 169700000000000000000000000000n,
      blockNumber: 22_349_662,
      blockTimestamp: nowSec - 15,
      observationTimestamp: nowSec,
      rpcEndpoint: client.rpcUrl,
      provenance: 'VERIFIED_ONCHAIN' as const,
      isFresh: true,
    };

    const normalized = adapter.toNormalizedSource(obs);
    assert.strictEqual(normalized.id, 'faroswap-wpros-usdc-lp');
    // Strict status requirement
    assert.strictEqual(normalized.qualificationStatus, 'QUALIFIED_WITH_DISCLOSURE');
    // Strict automated MOVE prohibition
    assert.strictEqual(normalized.isActionableRecommendationDestination, false);

    // Strict separation: full range benchmark vs pool turnover
    assert.strictEqual(normalized.forwardScenarioAssumption?.scenarioRateBps, FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS);
    assert.strictEqual(normalized.forwardScenarioAssumption?.scenarioRatePercentage, 6.26);
    assert.ok(normalized.decodedState.poolTurnoverGrossApr?.toString().includes('15.56%'));
    assert.ok(normalized.decodedState.fullRangePositionBenchmarkApr?.toString().includes('6.26%'));

    // Verify mandatory disclosures: 50% USD exposure, impermanent loss, 3.00 PROS round trip fee
    assert.ok(normalized.riskDisclosures.some((d) => d.includes('50% USD price exposure and impermanent loss')));
    assert.ok(normalized.riskDisclosures.some((d) => d.includes('3.00 PROS on 1,000 PROS')));
    assert.ok(normalized.riskDisclosures.some((d) => d.includes('Informational comparative source only')));
  });
});
