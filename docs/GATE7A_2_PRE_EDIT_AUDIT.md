# GATE 7A.2 — PRE-EDIT AUDIT & BASELINE ASSESSMENT
## Workspace State, Uncommitted Files, Root Causes & Remediation Blueprint

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Parent Workspace:** `C:\Users\NO GO NO\PharosBuild`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  
**Execution Boundary:** Local Code Corrections & Local Verification ONLY — ZERO External Deployment  

---

## 1. Workspace & Git Status Confirmation

1. **Workspace Path:**
   - Active Directory: `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`
   - Verified present and containing all source, test, script, and documentation directories.

2. **Git Repository Status:**
   - `git status` inside `skills/pharos-yield-optimizer`: `fatal: not a git repository`.
   - Git repository management is maintained at the sibling workspace level.

3. **Task 14 Sibling Workspace Verification:**
   - Workspace: `C:\Users\NO GO NO\PharosBuild\skills\pharos-portfolio-assistant`
   - Git Branch: `main`
   - Latest Commit: `94ae95454dc38915bd74b394af472310e67e76c2`
   - Status: `nothing to commit, working tree clean`.
   - **Confirmation:** Task 14 is 100% untouched and clean.

---

## 2. Existing Uncommitted State & Inventory of Files

The following files were created or modified during Gates 7A and 7A.1 and are preserved in the workspace:

### Created Files:
- `vercel.json` (Vercel deployment configuration)
- `api/index.ts` (Unified serverless dispatcher)
- `api/health.ts` (Modular health check entry point)
- `api/sources.ts` (Modular sources inspection entry point)
- `api/recommendation.ts` (Modular recommendation entry point)
- `api/transaction-review.ts` (Modular transaction review entry point)
- `public/index.html`, `public/styles.css`, `public/app.js` (Static UI assets for Edge CDN)
- `scripts/verify-vercel.js` (Local Vercel simulator)
- `tests/integration/vercelAdapter.test.ts` (15 serverless adapter integration tests)
- `docs/GATE7A_*` (7 Gate 7A documentation reports)
- `docs/GATE7A_1_*` (5 Gate 7A.1 preflight audit reports)

### Modified Files:
- `src/rpc/pharosClient.ts` (Added 3s cache and cache invalidation)
- `src/server/router.ts` (Added serverless pre-parsed body handling and rate limiting)
- `src/reviewer/transactionReviewer.ts` (Added disqualified strategy aliases)
- `scripts/build.js` (Added serverless bundling and `public/` sync)
- `tsconfig.json` (Added `api/**/*` to include array)
- `package.json` (Added `verify:vercel` script)

---

## 3. Pre-Edit Audit Findings & Root Causes

### Finding 1: API Routing Ambiguity (Rewrites vs. Modular Handlers)
- **Current State:** `vercel.json` rewrites all `/api/(.*)` traffic to `/api/index`.
- **Root Cause:** This rewrite shadows the modular function files `api/health.ts`, `api/sources.ts`, etc., making them unreachable under real Vercel routing while routing everything exclusively through `api/index.ts`.
- **Remediation Plan:** Adopt **Pure Vercel File-System Routing**. Remove the `"rewrites"` block from `vercel.json`. Let Vercel dispatch `/api/health` directly to `api/health.ts`, `/api/sources` to `api/sources.ts`, `/api/recommendation` to `api/recommendation.ts`, `/api/transaction-review` to `api/transaction-review.ts`, and `/api` to `api/index.ts`. Each modular handler will process its specific route and return 405 Method Not Allowed for unsupported verbs.

### Finding 2: Gas Accounting Discrepancy & Lifecycle Incompleteness
- **Current State:**
  - `frictionModel.ts` models a 200,000 gas lifecycle (115,000 deposit + 85,000 withdraw) at 1.25 Gwei = 0.000250 PROS.
  - `transactionReviewer.ts` models a 180,000 gas entry sequence (45k wrap + 45k approve + 90k deposit) at 10 Gwei = 0.0018 PROS.
  - `router.ts` line 326 hardcoded `(180_000 * 10) / 1e9 = 0.0018 PROS`, ignoring both live gas price from RPC and the recommendation engine's computed friction!
  - The UI directly displayed this hardcoded 0.0018 PROS figure.
- **Root Cause:** Disconnection between the recommendation engine's computed friction and the API router's response formatter.
- **Remediation Plan:**
  1. Remove hardcoded gas math from `router.ts`.
  2. Map `estimatedGasCostPros` and `frictionCostPros` directly from the evaluated recommendation target strategy's friction breakdown (`targetProj.friction.gasCostWei` and `totalFrictionWei`).
  3. Clearly expose lifecycle gas breakdown (entry operations vs. exit operations, live gas price vs. baseline assumption).
  4. Ensure `frictionModel.ts`, `recommendationEngine.ts`, `router.ts`, and UI display 100% consistent numbers.

### Finding 3: Sub-Day Break-Even Rounded to `0 Days`
- **Current State:** `calculateBreakEvenDays` in `src/engine/yieldMath.ts` rounds using `Number(days.toFixed(2))`.
- **Root Cause:** On 1,000 PROS generating $\approx 0.2329\text{ PROS/day}$, friction recovery takes $92.8\text{ seconds}$ ($0.0011\text{ days}$) at 1.25 Gwei, or $11.1\text{ minutes}$ ($0.0077\text{ days}$) at 10 Gwei. Because both values are $< 0.005$ days, `.toFixed(2)` rounds them to `0.00` (`0`).
- **Remediation Plan:**
  1. Preserve full numerical precision in `calculateBreakEvenDays` (return exact floating-point days).
  2. Implement `formatBreakEvenDuration(days: number)` to provide human-meaningful sub-day representations (e.g. `'~2 minutes (< 1 day)'` or `'~11 minutes (< 1 day)'`).
  3. Update API response to include `breakEvenDays` (numerical), `breakEvenFormatted` (string), and `breakEvenMinutes` (number).
  4. Update UI dashboard to display `breakEvenFormatted`.

### Finding 4: Evidence & Freshness Labeling
- **Current State:** 10 Gwei and 1.25 Gwei were sometimes cited without distinguishing live RPC queries from baseline assumptions.
- **Remediation Plan:**
  1. Add explicit metadata tags: `'LIVE_OBSERVED_RPC'` vs `'CONFIGURED_BASELINE'`.
  2. Add an explicit cache notice clarifying that the 3-second application cache does not guarantee on-chain block freshness.
  3. Strictly preserve the single-source truth: `FEWER THAN THREE QUALIFYING SOURCES — REQUIREMENT NOT MET`.

---

## 4. Pre-Edit Baseline Tests & Typecheck

Before applying any code changes, the existing baseline test suite was verified:
- `npm run typecheck`: 0 errors.
- `npm run test:all`: 126 passed / 0 failed across 46 suites.
- Standalone production server: 9/9 smoke tests passed.
- Local Vercel simulator: 12/12 checks passed.
