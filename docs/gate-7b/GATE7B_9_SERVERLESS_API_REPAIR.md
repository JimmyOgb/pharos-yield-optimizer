# Gate 7B.9 — Production Serverless API Repair & Verification Report

**Project:** Pharos Yield Optimizer  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Current Baseline Commit:** `ea7619ceda8367e8f6a9b36eaea3e20add2d56de`  
**Target Deployment:** `https://pharos-yield-optimizer.vercel.app`  
**Date:** 2026-11-06  

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Failure Observed in Production
When deployed to Vercel Cloud, all API endpoints returned HTTP 500:
- `GET /api`
- `GET /api/health`
- `GET /api/sources`
- `POST /api/recommendation`
- `POST /api/transaction-review`

Lambda execution logs revealed:
```
Error: Cannot find module '/var/task/src/server/router.ts' imported from /var/task/api/index.js
```
Additionally, the dashboard interface displayed:
- `RPC Connection Unreachable`
- `Failed to execute engine evaluation`
- `Failed to load protocol sources`
- `SyntaxError: Unexpected token 'A', "A server e"... is not valid JSON`

### 1.2 Root Cause
1. **Module Resolution on Vercel Node Runtime:**
   The repository contained raw TypeScript files in `api/*.ts` importing `../src/server/router.ts`. In local Node.js v22 with `--experimental-strip-types`, TypeScript syntax is stripped, but module resolution still follows standard Node ESM rules. In Vercel's cloud build environment, `@vercel/node` does not bundle relative TypeScript modules outside the `api/` directory unless instructed by a bundler. Consequently, the compiled Lambda function attempted to dynamically import `/var/task/src/server/router.ts` at runtime, which does not exist in the packaged Lambda environment.
2. **Frontend Fragility Against Non-JSON Cloud Errors:**
   The frontend `src/ui/app.js` unconditionally invoked `await response.json()`. When Vercel returned plain text (`A server error has occurred`), the browser threw a `SyntaxError`, which corrupted the UI state and collapsed the RPC status to "Unreachable", confusing infrastructure serverless failure with blockchain RPC outage.
3. **Missing Catch-All Exception Guards:**
   Top-level errors inside serverless handlers could escape to the runtime rather than returning a formatted JSON error response with appropriate security headers.

---

## 2. Architectural Solution

Following the proven pattern established in Task 14 (`skills/pharos-portfolio-assistant`):

### 2.1 Bundled Serverless Adapters
- Moved TypeScript sources from root `api/*.ts` to `src/api/*.ts`:
  - `src/api/index.ts`
  - `src/api/health.ts`
  - `src/api/sources.ts`
  - `src/api/recommendation.ts`
  - `src/api/transaction-review.ts`
- Updated `scripts/build.js` using `esbuild` to compile `src/api/*.ts` into standalone, self-contained ESM JavaScript bundles:
  - `api/*.js` (read directly by Vercel's file-system routing)
  - `dist/api/*.js` (production build distribution)
- Each bundle inlines all internal dependencies (`router.ts`, `pharosClient.ts`, `canonicalContracts.ts`, `math.ts`) into a single standalone file (~62 KB) with zero relative external imports.
- Removed raw `.ts` files from `api/` to prevent `@vercel/node` compiler collisions.

### 2.2 Defensive Serverless Handlers
Every handler in `src/api/*.ts` now features a top-level `try/catch` guard:
- Guarantees `Content-Type: application/json` and `X-Content-Type-Options: nosniff`.
- Returns structured JSON `{ error: string, message: string, status: 'error' }` even on unhandled exceptions.
- Implements strict HTTP method guards (`405 Method Not Allowed`).

### 2.3 Resilient Client-Side Fetching (`fetchJson`)
Added `fetchJson()` in `src/ui/app.js`:
- Verifies `res.ok` before attempting data extraction.
- Checks `Content-Type` header for `application/json`.
- Safely extracts and sanitizes non-JSON text / HTML error pages from cloud providers without crashing the parser.
- Disentangles cloud API failure (`API Error HTTP 500`) from actual node RPC degradation (`RPC Unhealthy / Stale`).

---

## 3. Financial & Operational Invariants Verification

- **Real RPC Data Only:** No mock data or simulated responses introduced. Every endpoint connects directly to Pharos Pacific Mainnet (`https://rpc.pharos.xyz`, Chain ID `1672`).
- **One-of-Three Qualifying Source Invariant:** Strictly preserved:
  - Faroo stPROS: `QUALIFIED_GENUINE_SOURCE` (1/1 verified).
  - Pharos DEX: `DISQUALIFIED_FROM_LIVE_APR` (dynamic fee APR unavailable).
  - Axil Prime Credit: `DISQUALIFIED_FROM_PROS_REBALANCING` (USDC private credit).
  - Status flag: `FEWER_THAN_THREE_QUALIFYING_SOURCES`.
- **Illustrative 8.5% Forward Assumption:** Unchanged; clearly disclaimed as illustrative forward APY assumption in UI and API output.
- **Non-Custodial Boundaries:** Strictly preserved; prepares 3-step unsigned calldata only. Zero private keys, zero signatures, zero custody.

---

## 4. Local Verification & Test Results

All six validation suites executed locally against live Pharos Pacific Mainnet:

| Verification Suite | Command | Result | Details |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Full repository strict typecheck |
| **Numerical Precision** | `npm run verify:numerical` | **PASS (5/5 tests)** | 100% precision across Faroo accrual, APR, break-even |
| **Unit Test Suite** | `npm test` | **PASS (130/130)** | 130 tests across 46 suites |
| **Integration Test Suite** | `npm run test:integration` | **PASS (31/31)** | 31 live integration tests across 11 suites |
| **Production Build** | `npm run build` | **PASS (0 errors)** | Standalone server + 5 bundled serverless adapters |
| **Vercel Simulator** | `npm run verify:vercel` | **PASS (13/13)** | Complete local Vercel CDN + Serverless simulation |

### Vercel Simulator Log Output
```
================================================================
  VERCEL SERVERLESS & STATIC PACKAGING LOCAL SIMULATION VERIFIER
  Target: Pharos Pacific Mainnet (Chain ID 1672)
================================================================
  ▶ Static UI: index.html served with CSP & security headers... [PASS]
  ▶ Static UI: styles.css served correctly... [PASS]
  ▶ Static UI: app.js served correctly... [PASS]
  ▶ Vercel API: GET /api returns service status and directory... [PASS]
  ▶ Vercel API: GET /api/health retrieves live Pacific Mainnet block... [PASS]
  ▶ Vercel API: GET /api/sources enforces FEWER_THAN_THREE_QUALIFYING_SOURCES... [PASS]
  ▶ Vercel API: POST /api/recommendation (MOVE 1,000 PROS / 60 days)... [PASS]
  ▶ Vercel API: HTTP Method Guards reject invalid methods with 405... [PASS]
  ▶ Vercel API: POST /api/recommendation (STAY_PUT 7 days < 14-day lockup)... [PASS]
  ▶ Vercel API: POST /api/recommendation (STAY_PUT instant exit friction > yield)... [PASS]
  ▶ Vercel API: POST /api/transaction-review (3 steps, non-custodial)... [PASS]
  ▶ Vercel API: Malformed JSON handled safely with 400 Bad Request... [PASS]
  ▶ Vercel API: 404 for unmapped endpoint... [PASS]
================================================================
  VERIFICATION SUMMARY: 13/13 PASSED
  [SUCCESS] All Vercel serverless & static delivery checks PASSED.
================================================================
```

---

## 5. Working Tree & Commit Manifest

### Changed / Added Files:
- `src/api/` (5 new TS source files):
  - `src/api/index.ts`
  - `src/api/health.ts`
  - `src/api/sources.ts`
  - `src/api/recommendation.ts`
  - `src/api/transaction-review.ts`
- `api/` (5 bundled standalone JS files replacing previous raw TS files):
  - `api/index.js`
  - `api/health.js`
  - `api/sources.js`
  - `api/recommendation.js`
  - `api/transaction-review.js`
- `scripts/build.js` (updated to bundle `src/api/*.ts` into `api/*.js` and `dist/api/*.js`)
- `scripts/verify-vercel.js` (updated to test bundled `api/*.js`)
- `src/ui/app.js` and `public/app.js` (added `fetchJson()` with HTTP status and Content-Type validation)
- `tests/integration/vercelAdapter.test.ts` (updated imports to `src/api/*.ts`)

### Task 14 Independence:
- `skills/pharos-portfolio-assistant` confirmed clean at commit `94ae95454dc38915bd74b394af472310e67e76c2`.

---

## 6. STOP CONDITION & Recommendations

Local repair and verification are 100% complete.
Per instructions: **No Git commit has been created and no Vercel deployment has been executed.**

Awaiting user authorization to proceed with staging, commit, and production redeployment.
