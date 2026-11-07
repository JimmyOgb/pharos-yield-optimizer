/**
 * Unit Tests for API Router, HTTP Server & UI Dashboard Endpoints
 * Tests endpoints with real local HTTP requests, mocked RPC fixtures,
 * and edge cases (RPC unavailable, stale data, malformed payloads, 404s).
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../../src/server/index.ts';
import { ApiRouter } from '../../src/server/router.ts';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';

describe('Server & UI Dashboard - Integration & API Endpoints', () => {
  let server: http.Server;
  let baseUrl: string;
  let mockClient: PharosRpcClient;
  let router: ApiRouter;

  before(async () => {
    mockClient = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });

    // Mock RPC calls for deterministic fast unit testing
    (mockClient as any).request = async (method: string, params: readonly unknown[] = []) => {
      if (method === 'eth_chainId') return '0x688'; // 1672
      if (method === 'eth_blockNumber') return '0x14ffd8c'; // 22,019,468
      if (method === 'eth_gasPrice') return '0x2540be400'; // 10 Gwei
      if (method === 'eth_getBalance') return '0xeadb6cf9a9478ea10ae2c0'; // 283.9M PROS
      if (method === 'eth_getBlockByNumber') {
        const nowSec = Math.floor(Date.now() / 1000);
        return {
          number: '0x14ffd8c',
          hash: '0xabc123',
          timestamp: `0x${nowSec.toString(16)}`,
          baseFeePerGas: '0x2540be400',
        };
      }
      if (method === 'eth_call') {
        const callObj = params[0] as { to: string; data: string };
        const data = callObj.data;
        // Faroo totalPooledPros()
        if (data === '0x01e1d114') {
          return '0x000000000000000000000000000000000000000000029b886d586a3d01ee1709'; // 3,152,335.1227 PROS
        }
        // Faroo totalSupply()
        if (data === '0x18160ddd') {
          return '0x00000000000000000000000000000000000000000002984445d7ac484049e4bf'; // 3,136,910.7559 stPROS
        }
        // Native PoS getDelegator()
        if (data.startsWith('0x3a6d6bae')) {
          const word0 = '000000000000000000000000000000000000000000000c3f3522bdae0e40a4ca';
          const zeroes = '0000000000000000000000000000000000000000000000000000000000000000';
          const word7 = '00000000000000000000000000000000000000000000001bc12595adc3695e5f';
          return '0x' + word0 + word0 + zeroes + zeroes + zeroes + zeroes + zeroes + word7 + zeroes;
        }
        // FaroSwap V3 Pool calls
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
        if (data.startsWith('0x70a08231')) return '0x00000000000000000000000000000000000000000000284ab9f73f5509772599';
        // StateView poolManager()
        if (data === '0xdc4c90d3') {
          return '0x000000000000000000000000d681e96ad464f8f7f7fa7e1e0c5a367175e44550';
        }
        return '0x00';
      }
      if (method === 'eth_getStorageAt') {
        return '0x000000000000000000000000fd59860894e01773e9780b0d1dfae4ca2b56708d';
      }
      if (method === 'eth_getCode') {
        return '0x6080604052';
      }
      throw new Error(`Unhandled mock method: ${method}`);
    };

    router = new ApiRouter(mockClient);
    server = createServer(router);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  describe('Static UI Assets', () => {
    it('serves index.html at GET / with 200 OK and text/html', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/html/);
      const text = await res.text();
      assert.match(text, /Pharos Yield Optimizer/);
      assert.match(text, /Yield-Source Coverage/);
      assert.match(text, /3 Sources Monitored On-Chain/);
    });

    it('serves styles.css at GET /styles.css with 200 OK and text/css', async () => {
      const res = await fetch(`${baseUrl}/styles.css`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/css/);
      const text = await res.text();
      assert.match(text, /--bg-base/);
    });

    it('serves app.js at GET /app.js with 200 OK and javascript', async () => {
      const res = await fetch(`${baseUrl}/app.js`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /javascript/);
      const text = await res.text();
      assert.match(text, /refreshHealth/);
    });

    it('returns 404 for unknown route', async () => {
      const res = await fetch(`${baseUrl}/unknown-file.txt`);
      assert.equal(res.status, 404);
    });
  });

  describe('API: GET /api/health', () => {
    it('returns network status, block information, and freshness', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.status, 'healthy');
      assert.equal(data.chainId, 1672);
      assert.equal(data.network, 'Pharos Pacific Mainnet');
      assert.equal(data.latestBlockNumber, 22019468);
      assert.equal(data.gasPriceGwei, '10.00 Gwei');
      assert.equal(data.isFresh, true);
    });

    it('returns degraded status when RPC encounters error', async () => {
      const brokenClient = new PharosRpcClient({ rpcUrl: 'http://broken-rpc' });
      (brokenClient as any).request = async () => {
        throw new Error('Connection refused');
      };
      const brokenRouter = new ApiRouter(brokenClient);
      const brokenServer = createServer(brokenRouter);

      await new Promise<void>((resolve) => brokenServer.listen(0, '127.0.0.1', resolve));
      const brokenPort = (brokenServer.address() as { port: number }).port;

      const res = await fetch(`http://127.0.0.1:${brokenPort}/api/health`);
      assert.equal(res.status, 503);
      const data = await res.json();
      assert.equal(data.status, 'degraded');
      assert.equal(data.isFresh, false);

      await new Promise<void>((resolve) => brokenServer.close(() => resolve()));
    });
  });

  describe('API: GET /api/sources', () => {
    it('returns dynamic three-source yield coverage with instant-exit safety status', async () => {
      const res = await fetch(`${baseUrl}/api/sources`);
      assert.equal(res.status, 200);
      const data = await res.json();

      // Verify dynamic coverage metadata
      assert.ok(data.yieldSourceCoverage);
      assert.equal(data.yieldSourceCoverage.totalMonitoredCount, 3);
      assert.equal(data.yieldSourceCoverage.qualifiedCount, 3);
      assert.equal(data.yieldSourceCoverage.actionableCount, 1);
      assert.equal(data.yieldSourceCoverage.isThreeSourceRequirementMet, true);
      assert.match(data.yieldSourceCoverage.summary, /1 Actionable Verified Yield Source/);

      // Verify instant exit safety
      assert.ok(data.instantExit);
      assert.equal(data.instantExit.instantExitAvailable, false);
      assert.equal(data.instantExit.instantExitFee, null);
      assert.equal(data.instantExit.instantExitStatus, 'NO_VERIFIED_SECONDARY_LIQUIDITY');

      // Verify sources count and classification
      assert.equal(data.sources.length, 3);

      // 1. Faroo stPROS (Actionable Verified)
      const faroo = data.sources.find((s: any) => s.id === 'faroo-stpros');
      assert.ok(faroo);
      assert.equal(faroo.qualificationStatus, 'FULLY_QUALIFIED');
      assert.equal(faroo.operationalStatus, 'ACTIONABLE_VERIFIED');
      assert.equal(faroo.isActionable, true);
      assert.equal(faroo.isVerifiedOnChain, true);
      assert.ok(parseFloat(faroo.liveRate) > 1.0);

      // 2. Native PoS (Live Informational / Restricted Entry)
      const pos = data.sources.find((s: any) => s.id === 'native-pos-staking');
      assert.ok(pos);
      assert.equal(pos.qualificationStatus, 'LIVE_INFORMATIONAL');
      assert.equal(pos.operationalStatus, 'NOT_AVAILABLE_FOR_ENTRY');
      assert.equal(pos.isActionable, false);
      assert.match(pos.exclusionReason, /permissionless validator delegation/i);

      // 3. FaroSwap V3 LP (Live Informational / Dual-Asset Benchmark)
      const lp = data.sources.find((s: any) => s.id === 'faroswap-wpros-usdc-lp');
      assert.ok(lp);
      assert.equal(lp.qualificationStatus, 'QUALIFIED_WITH_DISCLOSURE');
      assert.equal(lp.operationalStatus, 'LIVE_INFORMATIONAL');
      assert.equal(lp.isActionable, false);
      assert.match(lp.exclusionReason, /dual-asset benchmark/i);
    });
  });

  describe('API: POST /api/recommendation', () => {
    it('generates MOVE recommendation for 1,000 PROS over 60 days', async () => {
      const res = await fetch(`${baseUrl}/api/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalPros: 1000,
          horizonDays: 60,
          requiresInstantLiquidity: false,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'SUCCESS');
      assert.equal(data.recommendation.decision, 'MOVE');
      assert.equal(data.recommendation.targetStrategyId, 'faroo-patient-staking');
      assert.equal(data.recommendation.minimumHoldingDays, 15, 'Faroo minimum holding days must be synchronized to 15');
      assert.ok(data.recommendation.projectedNetGainPros > 0);
    });

    it('generates STAY_PUT with NO_VERIFIED_SECONDARY_LIQUIDITY when instant liquidity is requested', async () => {
      const res = await fetch(`${baseUrl}/api/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalPros: 1000,
          horizonDays: 60,
          requiresInstantLiquidity: true,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'SUCCESS');
      assert.equal(data.recommendation.decision, 'STAY_PUT');
      assert.equal(data.recommendation.reasonCode, 'NO_VERIFIED_SECONDARY_LIQUIDITY');
      assert.match(data.recommendation.explanation, /No verified secondary market liquidity pool exists/);
    });

    it('generates STAY_PUT recommendation when horizon (7 days) is less than lockup (14 days)', async () => {
      const res = await fetch(`${baseUrl}/api/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principalPros: 1000,
          horizonDays: 7,
          requiresInstantLiquidity: false,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.status, 'SUCCESS');
      assert.equal(data.recommendation.decision, 'STAY_PUT');
      assert.equal(data.recommendation.reasonCode, 'HORIZON_SHORTER_THAN_LOCKUP');
    });

    it('handles malformed JSON body with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{{{',
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Invalid JSON/);
    });
  });

  describe('API: POST /api/transaction-review', () => {
    it('returns 3-step unsigned transaction review for Faroo Patient Staking', async () => {
      const res = await fetch(`${baseUrl}/api/transaction-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: 'faroo-patient-staking',
          amountPros: 2500,
          userAddress: '0x3333333333333333333333333333333333333333',
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.strategyId, 'faroo-patient-staking');
      assert.equal(data.safetyNotice.isNonCustodial, true);
      assert.equal(data.safetyNotice.canSign, false);
      assert.equal(data.steps.length, 3);
      assert.equal(data.steps[0].payloadStatus, 'AVAILABLE');
      assert.equal(data.steps[1].payloadStatus, 'AVAILABLE');
      assert.equal(data.steps[2].payloadStatus, 'AVAILABLE');
    });

    it('returns UNAVAILABLE status for Axil review request', async () => {
      const res = await fetch(`${baseUrl}/api/transaction-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: 'axil-prime-credit',
          amountPros: 1000,
        }),
      });

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.steps[0].payloadStatus, 'UNAVAILABLE');
      assert.match(data.steps[0].unavailabilityReason, /TRANSACTION_PAYLOAD_UNAVAILABLE/);
    });

    it('handles invalid strategy with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/transaction-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: 'non-existent-strategy',
          amountPros: 1000,
        }),
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.match(data.error, /Unsupported strategy ID/);
    });
  });
});
