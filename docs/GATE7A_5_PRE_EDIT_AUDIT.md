# GATE 7A.5 — PRE-EDIT AUDIT & GAS UNIFICATION BLUEPRINT
## Pre-Change Workspace Assessment, File Inventory, Gas Consumer Trace & Plan

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  
**Authorization Boundary:** Source corrections, tests, local builds, and evidence reports ONLY — Zero External Deployment  

---

## 1. Workspace Confirmation & Repository State

1. **Workspace Path:**
   - Active Directory: `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`
   - Verified present and intact.
2. **Git Repository Status:**
   - Active workspace `skills/pharos-yield-optimizer` is a sub-directory in the monorepo workspace.
   - Sibling workspace `skills/pharos-portfolio-assistant` (Task 14) is on branch `main` at commit `94ae95454dc38915bd74b394af472310e67e76c2`, status: `nothing to commit, working tree clean`.
   - **Confirmation:** Task 14 is 100% untouched and clean.
3. **Inventory of Pre-Existing Uncommitted Files in `skills/pharos-yield-optimizer`:**
   - `vercel.json` (Vercel deployment configuration, pure file routing)
   - `api/*.ts` (5 modular serverless function entry points: `index.ts`, `health.ts`, `sources.ts`, `recommendation.ts`, `transaction-review.ts`)
   - `src/` (Core TypeScript engine, adapters, RPC client, server router, and UI files)
   - `public/` (Edge CDN static assets: `index.html`, `styles.css`, `app.js`)
   - `dist/` (Compiled ESM production artifacts)
   - `docs/GATE7A_*`, `docs/GATE7A_1_*`, `docs/GATE7A_2_*`, `docs/GATE7A_3_*`, `docs/GATE7A_4_*` (Complete Gate 7A series audit documentation)
   - `tests/` (10 unit test files, 3 integration test files, 1 numerical verification script)
   - `scripts/` (Build script and local Vercel verification simulator)

---

## 2. Review of Gate 7A.4 Findings

The Gate 7A.4 audit established the following verified findings:
1. **The Inconsistency:**
   - `frictionModel.ts` modeled Faroo Patient Staking entry using a theoretical single-step benchmark `FAROO_DEPOSIT_SUBMIT: 115_000n` + `FAROO_REQUEST_WITHDRAW: 85_000n` = **`200,000 gas units`**.
   - `transactionReviewer.ts` generated concrete calldata for a 3-step ERC-4626 sequence: Wrap (`45,000`) + Approve (`45,000`) + Deposit (`90,000`) = **`180,000 entry gas units`**.
   - Combining the real 3-step entry sequence with the 85,000 gas queue exit yields a physical lifecycle of **`265,000 gas units`**.
2. **Instant DEX Exit Evidence Status:**
   - The 145,000 gas figure for instant DEX exit is an **unverified empirical benchmark assumption**, not a live measured receipt from Pacific Mainnet.
   - No router calldata exists in the codebase for Uniswap V4 pool swaps; only text disclosures are rendered in the reviewer modal.

---

## 3. Gas Model Consumer Trace

The gas model values are consumed across the following files:
1. [`src/engine/frictionModel.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/frictionModel.ts):
   - Defines `GAS_LIMITS`.
   - Computes `gasCostWei` and `totalFrictionWei` in `evaluateStrategyFriction`.
2. [`src/engine/recommendationEngine.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts):
   - Calls `evaluateStrategyFriction` to compute `netGainWei` and `breakEvenDays`.
3. [`src/server/router.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/server/router.ts):
   - Maps `targetProj.friction` to `estimatedGasCostPros` and `frictionCostPros`.
   - Discloses `lifecycleGas` breakdown (`entryGasUnits`, `exitGasUnits`, `modeledGasUnits`).
4. [`src/ui/app.js`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/ui/app.js) & [`public/app.js`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/public/app.js):
   - Displays `rec.estimatedGasCostPros`, `rec.frictionCostPros`, and `rec.breakEvenFormatted`.
5. [`tests/unit/frictionModel.test.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/tests/unit/frictionModel.test.ts):
   - Asserts exact friction cost for patient staking and instant DEX.
6. [`tests/unit/recommendationEngine.test.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/tests/unit/recommendationEngine.test.ts):
   - Asserts net alpha, break-even days, and decision verdicts.
7. [`tests/numericalVerification.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/tests/numericalVerification.ts):
   - Independent mathematical verification of gas costs and break-even.
8. [`tests/integration/vercelAdapter.test.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/tests/integration/vercelAdapter.test.ts):
   - Asserts `lifecycleGas` parameters on `/api/recommendation`.

---

## 4. Remediation Blueprint for Gate 7A.5

1. **Unify Patient Staking Lifecycle (`frictionModel.ts`):**
   - Replace `FAROO_DEPOSIT_SUBMIT: 115_000n` with the explicit 3-step physical operations:
     - `FAROO_WRAP_PROS: 45_000n`
     - `FAROO_APPROVE_WPROS: 45_000n`
     - `FAROO_VAULT_DEPOSIT: 90_000n`
     - `FAROO_REQUEST_WITHDRAW: 85_000n`
   - Patient staking lifecycle gas becomes **`265,000 gas units`** ($45\text{k} + 45\text{k} + 90\text{k} + 85\text{k}$).
2. **Instant DEX Exit Evidence Annotation (`frictionModel.ts` & `router.ts`):**
   - Instant DEX entry becomes the verified 3-step entry ($180\text{k}$) + assumed DEX swap ($145\text{k}$) = **`325,000 gas units`**.
   - Explicitly tag instant DEX swap gas as an **assumed benchmark** (`isExitGasAssumed: true`), never representing it as a live measured receipt.
   - Preserve 0.30% swap fee and 0.10% slippage.
3. **Synchronize API & UI Disclosures:**
   - In `router.ts`: Update `modeledGasUnits` to `265,000` for patient staking and `325,000` for instant DEX.
   - In `disclosures`: Add explicit note confirming the 265,000 gas unified physical lifecycle.
4. **Update Regression Tests & Run Full Verification:**
   - Update tests in `frictionModel.test.ts`, `recommendationEngine.test.ts`, `numericalVerification.ts`, and `vercelAdapter.test.ts`.
   - Re-run `npm run typecheck`, `npm test`, `npm run build`, `npm run verify:vercel`, `npm run verify:numerical`.
