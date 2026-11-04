/**
 * Production Artifact Local Smoke Test
 * Tests the compiled production bundle (`dist/server.js`) directly in Node.js.
 * Verifies live Pacific Mainnet (Chain ID 1672) connectivity, static asset delivery,
 * security headers, API endpoints, invariant enforcement, and unsigned calldata generation.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type http from 'node:http';
// @ts-ignore Compiled production artifact
import { startServer } from '../../dist/server.js';

describe('Gate 6 Production Smoke Tests — Standalone dist/server.js Artifact', () => {
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    // Start server directly from the compiled production artifact on an ephemeral port
    const started = await startServer({
      port: 0,
      host: '127.0.0.1',
      rpcUrl: 'https://rpc.pharos.xyz',
      chainId: 1672,
      freshnessThresholdSeconds: 600,
      logLevel: 'warn',
    });
    server = started.server;
    const addr = server.address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('Static UI Assets from Production Artifact', () => {
    it('serves dist/ui/index.html with strict CSP and security headers', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/html/);

      const csp = res.headers.get('content-security-policy');
      assert.ok(csp, 'CSP header missing');
      assert.match(csp, /default-src 'self'/);
      assert.match(csp, /script-src 'self'/);

      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');

      const html = await res.text();
      assert.match(html, /Pharos Yield Optimizer/);
      assert.match(html, /ACCEPTANCE CRITERIA STATUS: FEWER THAN THREE QUALIFYING SOURCES/);
    });

    it('serves dist/ui/styles.css with 200 OK', async () => {
      const res = await fetch(`${baseUrl}/styles.css`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /text\/css/);
      const css = await res.text();
      assert.match(css, /--bg-base/);
    });

    it('serves dist/ui/app.js without inline onclick or window.copyToClipboard', async () => {
      const res = await fetch(`${baseUrl}/app.js`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('content-type') || '', /javascript/);
      const js = await res.text();
      assert.equal(js.includes('onclick='), false, 'Must not contain onclick');
      assert.equal(js.includes('window.copyToClipboard'), false, 'Must not expose global copy helper');
      assert.ok(js.includes('data-calldata='), 'Must use data-calldata attribute');
    });
  });

  describe('API Endpoints against Live Pharos Pacific Mainnet', () => {
    it('GET /api/health returns live chain 1672 state and block freshness', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.status, 'healthy');
      assert.equal(data.chainId, 1672);
      assert.equal(data.network, 'Pharos Pacific Mainnet');
      assert.ok(data.latestBlockNumber > 22_000_000, `Block number should be > 22M, got ${data.latestBlockNumber}`);
      assert.ok(data.isFresh, 'Block observation must be marked fresh');
    });

    it('GET /api/sources returns live Faroo stPROS exchange rate and strictly preserves one-source invariant', async () => {
      const res = await fetch(`${baseUrl}/api/sources`);
      assert.equal(res.status, 200);
      const data = await res.json();

      // Invariant verification
      assert.equal(data.invariantNotice.status, 'FEWER_THAN_THREE_QUALIFYING_SOURCES');
      assert.equal(data.invariantNotice.verifiedCount, 1);
      assert.equal(data.invariantNotice.requiredCount, 3);
      assert.equal(data.invariantNotice.isRequirementMet, false);

      // Sources verification
      assert.equal(data.sources.length, 4);
      const faroo = data.sources.find((s: any) => s.id === 'faroo-stpros');
      assert.ok(faroo);
      assert.equal(faroo.qualificationStatus, 'QUALIFIED_GENUINE_SOURCE');
      assert.ok(parseFloat(faroo.liveRate) >= 1.004, `Faroo rate should be >= 1.004, got ${faroo.liveRate}`);
    });

    it('POST /api/recommendation generates MOVE recommendation for 1,000 PROS over 60 days', async () => {
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
      assert.ok(data.recommendation.projectedNetGainPros > 0);
    });

    it('POST /api/transaction-review returns 3-step unsigned calldata with strict non-custodial boundaries', async () => {
      const res = await fetch(`${baseUrl}/api/transaction-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
          userAddress: '0x1234567890123456789012345678901234567890',
        }),
      });

      assert.equal(res.status, 200);
      const review = await res.json();

      assert.equal(review.safetyNotice.isNonCustodial, true);
      assert.equal(review.safetyNotice.canSign, false);
      assert.equal(review.safetyNotice.canBroadcast, false);
      assert.equal(review.steps.length, 3);

      // Verify Step 1: Wrap deposit()
      assert.equal(review.steps[0].methodName, 'deposit()');
      assert.equal(review.steps[0].selector, '0xd0e30db0');

      // Verify Step 2: Approve WPROS
      assert.equal(review.steps[1].methodName, 'approve(address,uint256)');
      assert.equal(review.steps[1].selector, '0x095ea7b3');

      // Verify Step 3: Deposit Faroo Vault
      assert.equal(review.steps[2].methodName, 'deposit(uint256,address)');
      assert.equal(review.steps[2].selector, '0x6e553f65');
    });

    it('POST /api/transaction-review refuses to fabricate calldata for disqualified sources', async () => {
      const res = await fetch(`${baseUrl}/api/transaction-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: 'axil-prime-credit',
          amountPros: 1000,
        }),
      });

      assert.equal(res.status, 200);
      const review = await res.json();
      assert.equal(review.steps[0].payloadStatus, 'UNAVAILABLE');
      assert.match(review.steps[0].unavailabilityReason, /TRANSACTION_PAYLOAD_UNAVAILABLE/);
    });

    it('POST /api/recommendation safely handles malformed JSON payload', async () => {
      const res = await fetch(`${baseUrl}/api/recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{{{',
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Invalid JSON payload');
    });
  });
});
