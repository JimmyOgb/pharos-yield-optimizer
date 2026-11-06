/**
 * Local Vercel Serverless & Static Asset Verification Script
 * Simulates Vercel Edge CDN static serving + Serverless Function execution locally.
 * Zero external dependencies, zero cloud accounts required.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const VERCEL_CONFIG_PATH = path.resolve(ROOT_DIR, 'vercel.json');

// Import the bundled Vercel Serverless Function handlers
const { default: indexHandler, router } = await import('../api/index.js');
const { default: healthHandler } = await import('../api/health.js');
const { default: sourcesHandler } = await import('../api/sources.js');
const { default: recommendationHandler } = await import('../api/recommendation.js');
const { default: transactionReviewHandler } = await import('../api/transaction-review.js');

// Load vercel.json
const vercelConfig = JSON.parse(fs.readFileSync(VERCEL_CONFIG_PATH, 'utf-8'));

function getContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function createSimulationServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      // Apply vercel.json global security headers
      if (vercelConfig.headers) {
        for (const rule of vercelConfig.headers) {
          for (const h of rule.headers) {
            res.setHeader(h.key, h.value);
          }
        }
      }

      // Check if request targets an API endpoint (Vercel file-system routing)
      if (pathname.startsWith('/api')) {
        // Parse request body for POST/PUT if present (simulating Vercel's Node runtime body parser)
        if (req.method === 'POST' || req.method === 'PUT') {
          const bodyBuffer = await new Promise((resolve) => {
            const chunks = [];
            req.on('data', (c) => chunks.push(c));
            req.on('end', () => resolve(Buffer.concat(chunks)));
          });

          const rawBody = bodyBuffer.toString('utf-8');
          try {
            if (rawBody.trim().length > 0) {
              req.body = JSON.parse(rawBody);
            } else {
              req.body = {};
            }
          } catch {
            req.body = rawBody; // Keep raw string if malformed so handler can reject cleanly
          }
        }

        // Vercel native file-system routing dispatch
        if (pathname === '/api' || pathname === '/api/' || pathname === '/api/index') {
          await indexHandler(req, res);
          return;
        }
        if (pathname === '/api/health') {
          await healthHandler(req, res);
          return;
        }
        if (pathname === '/api/sources') {
          await sourcesHandler(req, res);
          return;
        }
        if (pathname === '/api/recommendation') {
          await recommendationHandler(req, res);
          return;
        }
        if (pathname === '/api/transaction-review') {
          await transactionReviewHandler(req, res);
          return;
        }

        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not Found' }));
        return;
      }

      // Static file delivery from public/
      let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
      if (!fs.existsSync(filePath)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Not Found');
        return;
      }

      const content = fs.readFileSync(filePath);
      res.statusCode = 200;
      res.setHeader('Content-Type', getContentType(filePath));
      res.end(content);
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

async function runVerification() {
  console.log(`================================================================`);
  console.log(`  VERCEL SERVERLESS & STATIC PACKAGING LOCAL SIMULATION VERIFIER`);
  console.log(`  Target: Pharos Pacific Mainnet (Chain ID 1672)`);
  console.log(`================================================================`);

  router.resetRateLimits();
  const server = createSimulationServer();

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[SIMULATOR] Vercel local simulation server listening on ${baseUrl}`);

  const results = [];

  async function check(name, testFn) {
    process.stdout.write(`  ▶ ${name}... `);
    try {
      await testFn();
      console.log(`[PASS]`);
      results.push({ name, passed: true });
    } catch (err) {
      console.log(`[FAIL]: ${err.message}`);
      results.push({ name, passed: false, error: err.message });
    }
  }

  // 1. Static HTML + CSP
  await check('Static UI: index.html served with CSP & security headers', async () => {
    const res = await fetch(`${baseUrl}/`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const text = await res.text();
    if (!text.includes('Pharos Yield Optimizer')) throw new Error('Missing page title');
    const csp = res.headers.get('content-security-policy');
    if (!csp || !csp.includes("default-src 'self'")) throw new Error('Missing or invalid CSP header');
    if (res.headers.get('x-content-type-options') !== 'nosniff') throw new Error('Missing nosniff');
  });

  // 2. Static CSS
  await check('Static UI: styles.css served correctly', async () => {
    const res = await fetch(`${baseUrl}/styles.css`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const text = await res.text();
    if (!text.includes('--accent-primary') && !text.includes('--bg-base')) throw new Error('Invalid CSS content');
  });

  // 3. Static JS
  await check('Static UI: app.js served correctly', async () => {
    const res = await fetch(`${baseUrl}/app.js`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const text = await res.text();
    if (!text.includes('Pharos Yield Optimizer')) throw new Error('Invalid JS content');
  });

  // 4. API Service Directory
  await check('Vercel API: GET /api returns service status and directory', async () => {
    const res = await fetch(`${baseUrl}/api`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.chainId !== 1672) throw new Error(`Wrong chainId: ${json.chainId}`);
  });

  // 5. GET /api/health
  await check('Vercel API: GET /api/health retrieves live Pacific Mainnet block', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.status !== 'healthy') throw new Error(`Unhealthy RPC: ${json.status}`);
    if (json.latestBlockNumber < 22000000) throw new Error(`Invalid block number: ${json.latestBlockNumber}`);
    if (!json.isFresh) throw new Error('Block header is stale');
  });

  // 6. GET /api/sources
  await check('Vercel API: GET /api/sources enforces FEWER_THAN_THREE_QUALIFYING_SOURCES', async () => {
    const res = await fetch(`${baseUrl}/api/sources`);
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.invariantNotice.status !== 'FEWER_THAN_THREE_QUALIFYING_SOURCES') {
      throw new Error(`Invariant violated: ${json.invariantNotice.status}`);
    }
    if (json.invariantNotice.verifiedCount !== 1) throw new Error('Must have exactly 1 verified source');
    if (json.invariantNotice.isRequirementMet !== false) throw new Error('Requirement must not be met');
  });

  // 7. POST /api/recommendation (MOVE: 1,000 PROS over 60 days)
  await check('Vercel API: POST /api/recommendation (MOVE 1,000 PROS / 60 days)', async () => {
    const res = await fetch(`${baseUrl}/api/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        principalPros: 1000,
        horizonDays: 60,
        requiresInstantLiquidity: false,
        currentStrategyId: 'native-pros-baseline',
      }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.recommendation.decision !== 'MOVE') {
      throw new Error(`Expected MOVE, got ${json.recommendation.decision}`);
    }
    if (json.recommendation.projectedNetGainPros <= 0) throw new Error('Net gain must be positive');
    if (!json.recommendation.breakEvenFormatted) throw new Error('Missing breakEvenFormatted');
    if (json.recommendation.breakEvenFormatted === '0 days') throw new Error('breakEvenFormatted must not display as 0 days');
    if (!json.recommendation.lifecycleGas) throw new Error('Missing lifecycleGas breakdown');
    if (json.recommendation.lifecycleGas.entryGasUnits !== 180000) throw new Error('Incorrect entryGasUnits');
    if (json.recommendation.lifecycleGas.exitGasUnits !== 85000) throw new Error('Incorrect exitGasUnits');
  });

  // 7b. HTTP Method Guards (405 Method Not Allowed)
  await check('Vercel API: HTTP Method Guards reject invalid methods with 405', async () => {
    const healthPost = await fetch(`${baseUrl}/api/health`, { method: 'POST' });
    if (healthPost.status !== 405) throw new Error(`Expected 405 for POST /api/health, got ${healthPost.status}`);

    const recGet = await fetch(`${baseUrl}/api/recommendation`, { method: 'GET' });
    if (recGet.status !== 405) throw new Error(`Expected 405 for GET /api/recommendation, got ${recGet.status}`);

    const reviewGet = await fetch(`${baseUrl}/api/transaction-review`, { method: 'GET' });
    if (reviewGet.status !== 405) throw new Error(`Expected 405 for GET /api/transaction-review, got ${reviewGet.status}`);
  });

  // 8. POST /api/recommendation (STAY_PUT: 1,000 PROS / 7 days vs 14-day lockup)
  await check('Vercel API: POST /api/recommendation (STAY_PUT 7 days < 14-day lockup)', async () => {
    const res = await fetch(`${baseUrl}/api/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        principalPros: 1000,
        horizonDays: 7,
        requiresInstantLiquidity: false,
        currentStrategyId: 'native-pros-baseline',
      }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.recommendation.decision !== 'STAY_PUT') {
      throw new Error(`Expected STAY_PUT, got ${json.recommendation.decision}`);
    }
    if (json.recommendation.reasonCode !== 'HORIZON_SHORTER_THAN_LOCKUP') {
      throw new Error(`Expected HORIZON_SHORTER_THAN_LOCKUP, got ${json.recommendation.reasonCode}`);
    }
  });

  // 9. POST /api/recommendation (STAY_PUT: 1 day instant exit where friction > yield)
  await check('Vercel API: POST /api/recommendation (STAY_PUT instant exit friction > yield)', async () => {
    const res = await fetch(`${baseUrl}/api/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        principalPros: 1000,
        horizonDays: 1,
        requiresInstantLiquidity: true,
        currentStrategyId: 'native-pros-baseline',
      }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (json.recommendation.decision !== 'STAY_PUT') {
      throw new Error(`Expected STAY_PUT, got ${json.recommendation.decision}`);
    }
  });

  // 10. POST /api/transaction-review (3-step non-custodial)
  await check('Vercel API: POST /api/transaction-review (3 steps, non-custodial)', async () => {
    const res = await fetch(`${baseUrl}/api/transaction-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        strategyId: 'faroo-patient-staking',
        amountPros: 1000,
        userAddress: '0x1111111111111111111111111111111111111111',
      }),
    });
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    const json = await res.json();
    if (!json.safetyNotice || !json.safetyNotice.isNonCustodial) throw new Error('Not non-custodial');
    if (json.steps.length !== 3) throw new Error(`Expected 3 steps, got ${json.steps.length}`);
  });

  // 11. Malformed JSON handling
  await check('Vercel API: Malformed JSON handled safely with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/recommendation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ broken json payload !!!',
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    const json = await res.json();
    if (!json.error) throw new Error('Missing error message');
  });

  // 12. 404 Not Found
  await check('Vercel API: 404 for unmapped endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/unmapped-endpoint`);
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  // Tear down server
  await new Promise((resolve) => server.close(resolve));
  console.log(`[SIMULATOR] Local Vercel simulation server stopped.`);

  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`================================================================`);
  console.log(`  VERIFICATION SUMMARY: ${results.length - failedCount}/${results.length} PASSED`);
  if (failedCount > 0) {
    console.error(`  [FAILURE] ${failedCount} checks failed.`);
    process.exit(1);
  } else {
    console.log(`  [SUCCESS] All Vercel serverless & static delivery checks PASSED.`);
    console.log(`================================================================`);
  }
}

runVerification().catch((err) => {
  console.error('[SIMULATION FATAL ERROR]', err);
  process.exit(1);
});
