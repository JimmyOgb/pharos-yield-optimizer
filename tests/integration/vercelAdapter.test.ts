/**
 * Vercel Serverless Function Adapter Integration Tests
 * Validates serverless execution, request body formats, routing, caching,
 * non-custodial boundaries, and scenario evaluations on Pharos Pacific Mainnet (Chain ID 1672).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

import handler, { router } from '../../src/api/index.ts';
import healthHandler from '../../src/api/health.ts';
import sourcesHandler from '../../src/api/sources.ts';
import recommendationHandler from '../../src/api/recommendation.ts';
import transactionReviewHandler from '../../src/api/transaction-review.ts';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';

// Mock Serverless Request
class MockServerlessRequest extends EventEmitter {
  public method: string;
  public url: string;
  public headers: Record<string, string>;
  public body?: unknown;
  public socket: { remoteAddress: string };

  constructor(options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: unknown;
    remoteAddress?: string;
  } = {}) {
    super();
    this.method = options.method ?? 'GET';
    this.url = options.url ?? '/';
    this.headers = { host: 'localhost:3000', ...options.headers };
    this.body = options.body;
    this.socket = { remoteAddress: options.remoteAddress ?? '127.0.0.1' };
  }
}

// Mock Serverless Response
class MockServerlessResponse {
  public statusCode = 200;
  public headers: Record<string, string> = {};
  public body = '';
  public finished = false;

  public setHeader(name: string, value: string): void {
    this.headers[name.toLowerCase()] = value;
  }

  public getHeader(name: string): string | undefined {
    return this.headers[name.toLowerCase()];
  }

  public end(chunk?: string | Buffer): void {
    if (chunk) {
      this.body += chunk.toString();
    }
    this.finished = true;
  }

  public json<T = unknown>(): T {
    return JSON.parse(this.body) as T;
  }
}

describe('Vercel Serverless Function Adapter — Gate 7A Verification', () => {
  beforeEach(() => {
    router.resetRateLimits();
  });

  describe('Serverless Request Invocations & Routing', () => {
    it('handles GET /api service directory route', async () => {
      const req = new MockServerlessRequest({ method: 'GET', url: '/api' });
      const res = new MockServerlessResponse();

      await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 200);
      assert.equal(res.getHeader('content-type'), 'application/json');
      assert.equal(res.getHeader('x-content-type-options'), 'nosniff');
      const data = res.json<{ service: string; chainId: number; endpoints: string[] }>();
      assert.equal(data.service, 'pharos-yield-optimizer-api');
      assert.equal(data.chainId, 1672);
      assert.ok(data.endpoints.includes('GET /api/health'));
    });

    it('returns 404 for unknown API path', async () => {
      const req = new MockServerlessRequest({ method: 'GET', url: '/api/unknown-endpoint' });
      const res = new MockServerlessResponse();

      await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 404);
      const data = res.json<{ error: string }>();
      assert.equal(data.error, 'Not Found');
    });

    it('handles OPTIONS preflight request with 204 No Content', async () => {
      const req = new MockServerlessRequest({ method: 'OPTIONS', url: '/api/recommendation' });
      const res = new MockServerlessResponse();

      await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 204);
      assert.ok(res.getHeader('access-control-allow-origin'));
      assert.ok(res.getHeader('access-control-allow-methods'));
    });

    it('rejects unsupported HTTP methods with 405 Method Not Allowed across modular handlers', async () => {
      // POST to /api/health
      const healthReq = new MockServerlessRequest({ method: 'POST', url: '/api/health' });
      const healthRes = new MockServerlessResponse();
      await healthHandler(healthReq as unknown as IncomingMessage, healthRes as unknown as ServerResponse);
      assert.equal(healthRes.statusCode, 405);

      // POST to /api/sources
      const sourcesReq = new MockServerlessRequest({ method: 'POST', url: '/api/sources' });
      const sourcesRes = new MockServerlessResponse();
      await sourcesHandler(sourcesReq as unknown as IncomingMessage, sourcesRes as unknown as ServerResponse);
      assert.equal(sourcesRes.statusCode, 405);

      // GET to /api/recommendation
      const recReq = new MockServerlessRequest({ method: 'GET', url: '/api/recommendation' });
      const recRes = new MockServerlessResponse();
      await recommendationHandler(recReq as unknown as IncomingMessage, recRes as unknown as ServerResponse);
      assert.equal(recRes.statusCode, 405);

      // GET to /api/transaction-review
      const revReq = new MockServerlessRequest({ method: 'GET', url: '/api/transaction-review' });
      const revRes = new MockServerlessResponse();
      await transactionReviewHandler(revReq as unknown as IncomingMessage, revRes as unknown as ServerResponse);
      assert.equal(revRes.statusCode, 405);
    });
  });

  describe('Live Endpoints against Pharos Pacific Mainnet (Chain ID 1672)', () => {
    it('GET /api/health via api/health.ts serverless entry point', async () => {
      const req = new MockServerlessRequest({ method: 'GET', url: '/api/health' });
      const res = new MockServerlessResponse();

      await healthHandler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 200);
      const data = res.json<{
        status: string;
        chainId: number;
        latestBlockNumber: number;
        isFresh: boolean;
      }>();
      assert.equal(data.status, 'healthy');
      assert.equal(data.chainId, 1672);
      assert.ok(data.latestBlockNumber > 22_000_000);
      assert.equal(data.isFresh, true);
    });

    it('GET /api/sources via api/sources.ts strictly enforces one-source invariant', async () => {
      const req = new MockServerlessRequest({ method: 'GET', url: '/api/sources' });
      const res = new MockServerlessResponse();

      await sourcesHandler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 200);
      const data = res.json<{
        invariantNotice: {
          status: string;
          verifiedCount: number;
          requiredCount: number;
          isRequirementMet: boolean;
        };
        sources: Array<{ id: string; qualificationStatus: string; liveRate: string }>;
      }>();

      assert.equal(data.invariantNotice.status, 'FEWER_THAN_THREE_QUALIFYING_SOURCES');
      assert.equal(data.invariantNotice.verifiedCount, 1);
      assert.equal(data.invariantNotice.requiredCount, 3);
      assert.equal(data.invariantNotice.isRequirementMet, false);

      const faroo = data.sources.find(s => s.id === 'faroo-stpros');
      assert.ok(faroo);
      assert.equal(faroo.qualificationStatus, 'QUALIFIED_GENUINE_SOURCE');
      assert.ok(parseFloat(faroo.liveRate) > 1.0);
    });
  });

  describe('Financial Scenario Evaluations (MOVE vs STAY_PUT)', () => {
    it('Scenario 1 (MOVE): 1,000 PROS over 60 days -> Recommends MOVE with positive alpha', async () => {
      const req = new MockServerlessRequest({
        method: 'POST',
        url: '/api/recommendation',
        body: {
          principalPros: 1000,
          horizonDays: 60,
          requiresInstantLiquidity: false,
          currentStrategyId: 'native-pros-baseline',
        },
      });
      const res = new MockServerlessResponse();

      await recommendationHandler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 200);
      const data = res.json<{
        status: string;
        recommendation: {
          decision: string;
          targetStrategyId: string;
          projectedNetGainPros: number;
          breakEvenFormatted: string;
          breakEvenDays: number;
          estimatedGasCostPros: string;
          lifecycleGas: {
            entryGasUnits: number;
            exitGasUnits: number;
            modeledGasUnits: number;
            gasPriceGwei: number;
          };
          reasons: string[];
        };
      }>();

      assert.equal(data.recommendation.decision, 'MOVE');
      assert.equal(data.recommendation.targetStrategyId, 'faroo-patient-staking');
      assert.ok(data.recommendation.projectedNetGainPros > 0);
      assert.ok(data.recommendation.breakEvenFormatted);
      assert.notEqual(data.recommendation.breakEvenFormatted, '0 days');
      assert.ok(data.recommendation.lifecycleGas);
      assert.equal(data.recommendation.lifecycleGas.entryGasUnits, 180000);
      assert.equal(data.recommendation.lifecycleGas.exitGasUnits, 85000);
      assert.equal(data.recommendation.lifecycleGas.modeledGasUnits, 265000);
      assert.ok(data.recommendation.reasons.some(r => r.includes('Strict Acceptance Status: 1 of 3')));
    });

    it('Scenario 2 (STAY_PUT): 1,000 PROS over 7 days against 14-day lockup -> Recommends STAY_PUT', async () => {
      const req = new MockServerlessRequest({
        method: 'POST',
        url: '/api/recommendation',
        body: {
          principalPros: 1000,
          horizonDays: 7,
          requiresInstantLiquidity: false,
          currentStrategyId: 'native-pros-baseline',
        },
      });
      const res = new MockServerlessResponse();

      await recommendationHandler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 200);
      const data = res.json<{
        recommendation: {
          decision: string;
          reasonCode: string;
        };
      }>();

      assert.equal(data.recommendation.decision, 'STAY_PUT');
      assert.equal(data.recommendation.reasonCode, 'HORIZON_SHORTER_THAN_LOCKUP');
    });

    it('Scenario 3 (STAY_PUT): Short horizon (1 day) instant exit where DEX friction exceeds yield', async () => {
      const req = new MockServerlessRequest({
        method: 'POST',
        url: '/api/recommendation',
        body: {
          principalPros: 1000,
          horizonDays: 1,
          requiresInstantLiquidity: true,
          currentStrategyId: 'native-pros-baseline',
        },
      });
      const res = new MockServerlessResponse();

      await recommendationHandler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 200);
      const data = res.json<{
        recommendation: {
          decision: string;
          reasonCode: string;
        };
      }>();

      assert.equal(data.recommendation.decision, 'STAY_PUT');
      assert.ok(
        data.recommendation.reasonCode === 'FRICTION_EXCEEDS_GROSS_YIELD' ||
        data.recommendation.reasonCode === 'NEGATIVE_NET_ADVANTAGE'
      );
    });
  });

  describe('Transaction Reviewer Safety & Non-Custodial Boundaries', () => {
    it('POST /api/transaction-review produces 3-step unsigned calldata for Faroo Patient Staking', async () => {
      const req = new MockServerlessRequest({
        method: 'POST',
        url: '/api/transaction-review',
        body: {
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
          userAddress: '0x1111111111111111111111111111111111111111',
        },
      });
      const res = new MockServerlessResponse();

      await transactionReviewHandler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 200);
      const data = res.json<{
        safetyNotice: {
          isNonCustodial: boolean;
          canSign: boolean;
          canBroadcast: boolean;
        };
        steps: Array<{ stepNumber: number; methodName: string; contractAddress: string; payload?: { data: string } }>;
      }>();

      assert.equal(data.safetyNotice.isNonCustodial, true);
      assert.equal(data.safetyNotice.canSign, false);
      assert.equal(data.safetyNotice.canBroadcast, false);
      assert.equal(data.steps.length, 3);
      assert.equal(data.steps[0].methodName, 'deposit()');
      assert.equal(data.steps[1].methodName, 'approve(address,uint256)');
      assert.equal(data.steps[2].methodName, 'deposit(uint256,address)');
    });

    it('POST /api/transaction-review refuses to fabricate calldata for disqualified sources', async () => {
      const req = new MockServerlessRequest({
        method: 'POST',
        url: '/api/transaction-review',
        body: {
          strategyId: 'axil-prime-credit-3m',
          amountPros: 1000,
        },
      });
      const res = new MockServerlessResponse();

      await transactionReviewHandler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 200);
      const data = res.json<{
        strategyId: string;
        actionSummary: string;
        steps: Array<{ payloadStatus: string; unavailabilityReason: string }>;
      }>();
      assert.equal(data.steps[0].payloadStatus, 'UNAVAILABLE');
      assert.ok(data.steps[0].unavailabilityReason.includes('TRANSACTION_PAYLOAD_UNAVAILABLE'));
    });
  });

  describe('Validation, Error Handling & Streaming Compatibility', () => {
    it('accepts streaming JSON request body (standard Node.js http.createServer mode)', async () => {
      const req = new MockServerlessRequest({
        method: 'POST',
        url: '/api/recommendation',
      });
      const res = new MockServerlessResponse();

      const promise = handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      // Simulate stream chunks
      req.emit('data', Buffer.from(JSON.stringify({ principalPros: 500, horizonDays: 30 })));
      req.emit('end');

      await promise;

      assert.equal(res.statusCode, 200);
      const data = res.json<{ recommendation: { decision: string } }>();
      assert.ok(data.recommendation.decision);
    });

    it('rejects malformed string JSON payload with 400 Bad Request', async () => {
      const req = new MockServerlessRequest({
        method: 'POST',
        url: '/api/recommendation',
        body: 'invalid-non-json-payload{{{',
      });
      const res = new MockServerlessResponse();

      await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 400);
      const data = res.json<{ error: string }>();
      assert.equal(data.error, 'Invalid JSON payload');
    });

    it('rejects oversized payloads exceeding 64 KB with 400 Bad Request', async () => {
      const giantString = 'x'.repeat(70 * 1024);
      const req = new MockServerlessRequest({
        method: 'POST',
        url: '/api/recommendation',
        body: giantString,
      });
      const res = new MockServerlessResponse();

      await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);

      assert.equal(res.statusCode, 400);
      const data = res.json<{ error: string }>();
      assert.equal(data.error, 'Payload too large');
    });
  });

  describe('Caching & Concurrency Performance Protection', () => {
    it('short-lived cache serves concurrent requests within TTL without redundant RPC calls', async () => {
      const client = new PharosRpcClient({ cacheTtlMs: 2_000 });
      client.clearCache();

      const start = Date.now();
      const first = await client.verifyChainId();
      const elapsedFirst = Date.now() - start;

      const cachedStart = Date.now();
      const second = await client.verifyChainId();
      const elapsedSecond = Date.now() - cachedStart;

      assert.equal(first.chainId, 1672);
      assert.equal(second.chainId, 1672);
      // Cached call should complete near instantaneously (< 5ms vs network round-trip)
      assert.ok(elapsedSecond < elapsedFirst || elapsedSecond < 10);
    });

    it('rate limiter triggers HTTP 429 when threshold exceeded from same IP', async () => {
      const reqGenerator = () => new MockServerlessRequest({
        method: 'GET',
        url: '/api',
        remoteAddress: '198.51.100.42',
      });

      // Send requests up to limit
      for (let i = 0; i < 60; i++) {
        const req = reqGenerator();
        const res = new MockServerlessResponse();
        await handler(req as unknown as IncomingMessage, res as unknown as ServerResponse);
        assert.equal(res.statusCode, 200);
      }

      // 61st request should be rate limited
      const req61 = reqGenerator();
      const res61 = new MockServerlessResponse();
      await handler(req61 as unknown as IncomingMessage, res61 as unknown as ServerResponse);

      assert.equal(res61.statusCode, 429);
      assert.equal(res61.getHeader('retry-after'), '60');
      const data = res61.json<{ error: string; retryAfterSeconds: number }>();
      assert.equal(data.error, 'Too Many Requests');
      assert.equal(data.retryAfterSeconds, 60);
    });
  });
});
