# GATE 7B.1 — LOCAL VERIFICATION & TEST LOG REPORT
## Fresh Test Execution, Static Analysis, Artifact Provenance & Verification Evidence

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026 (Execution Window: Gate 7B.1)  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Fresh Test Execution Summary

All verification commands were executed freshly during the Gate 7B.1 preflight session. Zero dependencies were installed, modified, or updated:

| Verification Stage | Command Executed | Exit Code | Checks / Tests | Result | Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Static Typecheck** | `npm run typecheck` | `0` | Full Project Tree | 0 Errors | **PASS** |
| **Numerical Precision** | `npm run verify:numerical` | `0` | 5 Mathematical Scenarios | 5 / 5 | **PASS** |
| **Full Test Suite** | `npm test` | `0` | 130 Tests across 46 Suites | 130 / 130 | **PASS** |
| **Production Build** | `npm run build` | `0` | 8 Bundles + Static Sync | Generated (1.25s) | **PASS** |
| **Vercel Serverless Sim** | `npm run verify:vercel` | `0` | 13 Route & Policy Checks | 13 / 13 | **PASS** |

- **Total Tests Passing:** 130 unit & integration tests + 5 numerical verification cases + 13 simulator checks = **148 verified checks**.
- **Total Tests Failing:** **0**.
- **Total Tests Skipped / Cancelled:** **0**.

---

## 2. Command Execution Evidence

### 1. Static Typecheck
- **Command:** `npm run typecheck` (`tsc --noEmit`)
- **Exit Code:** `0`
- **Output:** Clean exit with zero diagnostics.

### 2. Independent Numerical Precision Suite
- **Command:** `npm run verify:numerical` (`node --experimental-strip-types tests/numericalVerification.ts`)
- **Exit Code:** `0`
- **Verification Output:**
  ```text
  ================================================================
  PHAROS YIELD OPTIMIZER — GATE 3 INDEPENDENT NUMERICAL VERIFICATION
  Chain ID: 1672 (Pharos Pacific Mainnet) | Asset: PROS (18 decimals)
  ================================================================

  --- TEST 1: Faroo Historical Exchange-Rate Trailing Rate Accrual ---
  [PASS] T1 Start Exchange Rate: 1.003900 (Expected ~1.003900, diff=3.76e-9)
  [PASS] T2 End Exchange Rate: 1.004917 (Expected ~1.004917, diff=2.82e-9)
  [PASS] Realized Delta Gain Percentage: 0.100000 (Expected ~0.100000, diff=0.00e+0)
  [PASS] Bootstrapping Trailing Annualized APR: 30.370000 (Expected ~30.370000, diff=0.00e+0)
         Trailing Notice: "Observation window (29.2h < 168h) reflects early episodic reward indexing. It is NOT a sustainable forward APY."

  --- TEST 2: Faroo Patient Staking (1,000 PROS, 60 Days, 14d Queue Exit) ---
  [PASS] Gross Projected Yield (PROS): 13.972603 (Expected ~13.972603, diff=1.78e-15)
  [PASS] Patient Staking Unified Friction Cost (PROS): 0.000331 (Expected ~0.000331, diff=0.00e+0)
  [PASS] Recommendation Decision: MOVE (POSITIVE_NET_ALPHA)
         Target Strategy: faroo-patient-staking
  [PASS] Net Alpha Gain (PROS): 13.972271 (Expected ~13.972271, diff=1.78e-15)

  --- TEST 3: Faroo Instant DEX Staking (1,000 PROS, 10 Days, Instant AMM Exit) ---
  [PASS] Recommendation Decision: STAY_PUT (FRICTION_EXCEEDS_GROSS_YIELD)
  [PASS] Instant DEX Break-Even Horizon (Days): 17.178215 (Expected ~17.178215, diff=7.35e-8)
         Explanation: "Total transaction friction and exit costs exceed expected gross yield over 10 days. Break-even requires 17.178215 days."

  --- TEST 4: Protocol Lockup Constraint (7 Days Horizon vs 14-Day Queue) ---
  [PASS] Recommendation Decision: STAY_PUT (HORIZON_SHORTER_THAN_LOCKUP)
         Explanation: "Investment horizon (7 days) is shorter than mandatory protocol lockup (14 days) for Faroo Patient Staking, and alternative instant DEX liquidity friction exceeds gross yield."

  --- TEST 5: Gate 7A.5 Gas Unification & Sub-Day Break-Even ---
  [PASS] Entry Gas Cost @ 10 Gwei (PROS): 0.001800 (Expected ~0.001800, diff=0.00e+0)
  [PASS] Entry Gas Cost @ 1.25 Gwei (PROS): 0.000225 (Expected ~0.000225, diff=0.00e+0)
  [PASS] Unified Lifecycle Gas Cost @ 10 Gwei (PROS): 0.002650 (Expected ~0.002650, diff=0.00e+0)
  [PASS] Unified Lifecycle Gas Cost @ 1.25 Gwei (PROS): 0.000331 (Expected ~0.000331, diff=0.00e+0)
  [PASS] Break-Even Horizon @ 1.25 Gwei (Days): 0.001422 (Expected ~0.001422, diff=0.00e+0)
  [PASS] Formatted Break-Even @ 1.25 Gwei: "~2 mins (< 1 day)"
  [PASS] Break-Even Horizon @ 10 Gwei (Days): 0.011379 (Expected ~0.011379, diff=0.00e+0)
  [PASS] Formatted Break-Even @ 10 Gwei: "~16 mins (< 1 day)"

  ================================================================
  ALL INDEPENDENT NUMERICAL CHECKS PASSED WITH 100% MATHEMATICAL PRECISION
  ================================================================
  ```

### 3. Full Unit & Live Integration Test Suite
- **Command:** `npm test` (`node --experimental-strip-types --test tests/unit/*.test.ts tests/integration/*.test.ts`)
- **Exit Code:** `0`
- **Execution Metrics:**
  ```text
  ℹ tests 130
  ℹ suites 46
  ℹ pass 130
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 14187.2079
  ```

### 4. Production Build & Artifact Emission
- **Command:** `npm run build` (`tsc --noEmit && node scripts/build.js`)
- **Exit Code:** `0`
- **Duration:** 1,258ms
- **Generated Artifact Manifest:**

| Artifact File | Size on Disk | Format | Target Environment |
| :--- | :---: | :---: | :--- |
| `dist/server.js` | 61,996 bytes | Standalone ESM | Node.js Runtime HTTP Server (`node dist/server.js`) |
| `dist/api/index.js` | 61,996 bytes | Standalone ESM | Vercel Serverless Function (`GET /api`) |
| `dist/api/health.js` | 61,743 bytes | Standalone ESM | Vercel Serverless Function (`GET /api/health`) |
| `dist/api/sources.js` | 61,750 bytes | Standalone ESM | Vercel Serverless Function (`GET /api/sources`) |
| `dist/api/recommendation.js` | 61,803 bytes | Standalone ESM | Vercel Serverless Function (`POST /api/recommendation`) |
| `dist/api/transaction-review.js` | 61,829 bytes | Standalone ESM | Vercel Serverless Function (`POST /api/transaction-review`)|
| `public/index.html` | 14,640 bytes | HTML5 | Edge CDN Distribution |
| `public/styles.css` | 17,786 bytes | CSS3 | Edge CDN Distribution |
| `public/app.js` | 18,770 bytes | Pure JS | Edge CDN Distribution |

### 5. Vercel Serverless Function Simulation
- **Command:** `npm run verify:vercel` (`node --experimental-strip-types scripts/verify-vercel.js`)
- **Exit Code:** `0`
- **Verified Checks (13/13 PASS):**
  1. Static UI: `index.html` served with CSP & security headers
  2. Static UI: `styles.css` served correctly
  3. Static UI: `app.js` served correctly
  4. Vercel API: `GET /api` returns service status and directory
  5. Vercel API: `GET /api/health` retrieves live Pacific Mainnet block
  6. Vercel API: `GET /api/sources` enforces `FEWER_THAN_THREE_QUALIFYING_SOURCES`
  7. Vercel API: `POST /api/recommendation` (Scenario A: `MOVE` 1,000 PROS / 60 days)
  8. Vercel API: HTTP Method Guards reject invalid methods with `405 Method Not Allowed`
  9. Vercel API: `POST /api/recommendation` (Scenario B: `STAY_PUT` 7 days < 14d lockup)
  10. Vercel API: `POST /api/recommendation` (Scenario C: `STAY_PUT` instant exit friction > yield)
  11. Vercel API: `POST /api/transaction-review` (3-step non-custodial calldata)
  12. Vercel API: Malformed JSON handled safely with `400 Bad Request`
  13. Vercel API: `404 Not Found` for unmapped endpoint
