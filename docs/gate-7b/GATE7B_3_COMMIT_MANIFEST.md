# GATE 7B.3 — FINAL PROPOSED COMMIT MANIFEST & STAGING BLUEPRINT
## Initial Commit File Specification, Staging Script, Commit Message & Execution Policy

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026 (Gate 7B.3)  
**Auditor / Engineer:** Antigravity AI  

---

> **CRITICAL BOUNDARY:**  
> This document specifies the exact manifest and Git commands for a future initial commit.  
> **ZERO FILES HAVE BEEN STAGED (`git add` has NOT been executed). ZERO COMMITS HAVE BEEN CREATED (`git commit` has NOT been executed).**  
> Execution is strictly withheld until explicit project-owner authorization in a future gate.

---

## 1. Final Commit Inclusions & Exclusions Manifest

### Included Files

| File / Directory | Category | Role |
| :--- | :---: | :--- |
| `package.json` | Configuration | Package definition, devDependencies, npm lifecycle scripts |
| `package-lock.json` | Configuration | Deterministic dependency tree lockfile |
| `tsconfig.json` | Configuration | TypeScript compiler configuration (`target: ES2022`, strict mode) |
| `vercel.json` | Configuration | Vercel routing spec, edge CSP headers, function mapping |
| `README.md` | Public Documentation | Core documentation, build/test guide, API reference, APY disclosures |
| `.gitignore` | Configuration | Git ignore specification for build artifacts, secrets, and local caches |
| `.env.example` | Configuration | Safe environment template — 7 variables, zero secrets |
| `src/index.ts` | Source | Core library entry point |
| `src/adapters/dexAdapter.ts` | Source | Pharos DEX (Uniswap V4) adapter — marks dynamic LP APR as UNAVAILABLE |
| `src/adapters/farooAdapter.ts` | Source | Faroo stPROS liquid staking adapter — live ERC-4626 exchange rate |
| `src/adapters/liveRecommendationBridge.ts` | Source | Live RPC data bridge to recommendation engine |
| `src/config/index.ts` | Source | Configuration loader with safe defaults and loopback enforcement |
| `src/engine/frictionModel.ts` | Source | Gas and fee friction model (265k, 325k lifecycle gas) |
| `src/engine/recommendationEngine.ts` | Source | Deterministic MOVE/STAY_PUT recommendation engine |
| `src/engine/yieldMath.ts` | Source | BigInt yield math, break-even calculation, annualization |
| `src/reviewer/transactionReviewer.ts` | Source | Non-custodial 3-step unsigned calldata reviewer |
| `src/rpc/pharosClient.ts` | Source | Zero-dependency JSON-RPC client with TTL cache |
| `src/server/index.ts` | Source | Standalone Node.js HTTP server bootstrap |
| `src/server/router.ts` | Source | Request router with security headers, CSP, and API handlers |
| `src/types/index.ts` | Source | TypeScript interfaces, schemas, and type definitions |
| `src/ui/index.html` | Source / UI | Responsive financial dashboard source |
| `src/ui/styles.css` | Source / UI | Dashboard CSS |
| `src/ui/app.js` | Source / UI | Dashboard client JavaScript |
| `api/index.ts` | Source / Serverless | Vercel function: service status and directory |
| `api/health.ts` | Source / Serverless | Vercel function: live Pacific Mainnet RPC health |
| `api/sources.ts` | Source / Serverless | Vercel function: yield sources matrix with 1-of-3 invariant |
| `api/recommendation.ts` | Source / Serverless | Vercel function: deterministic yield recommendation |
| `api/transaction-review.ts` | Source / Serverless | Vercel function: non-custodial transaction review |
| `public/index.html` | Distribution | Edge CDN static UI (synchronized from `src/ui/` by build) |
| `public/styles.css` | Distribution | Edge CDN static CSS |
| `public/app.js` | Distribution | Edge CDN static JavaScript |
| `scripts/build.js` | Build Tooling | Production bundler: esbuild + UI synchronization |
| `scripts/verify-vercel.js` | Build Tooling | Local Vercel serverless simulation verifier |
| `tests/unit/*.test.ts` (11 files) | Tests | Unit test suites (96 tests, mocked fixtures) |
| `tests/integration/*.test.ts` (3 files) | Tests | Live integration tests (34 tests, Pharos Pacific Mainnet) |
| `tests/numericalVerification.ts` | Tests | Independent numerical precision verification (5 cases) |
| `docs/` (entire tree, ~80+ files) | Documentation | Complete immutable milestone audit history (Gates 1 through 7B) |

### Excluded Files (enforced by `.gitignore`)

| Path | Reason |
| :--- | :--- |
| `dist/` | Generated build artifacts — reproducible via `npm run build` |
| `node_modules/` | Third-party packages — reproducible via `npm install` |
| `.vercel/` | Local Vercel linking IDs and ephemeral build caches |
| `.env` / `.env.local` / `.env.*` | Local developer environment overrides — excluded to prevent credential leakage |

---

## 2. Verified Commit Message Specification

Pursuant to Gate 7B.3 Section 6 directives:
- The phrase `production release` is **strictly absent** (no external cloud deployment has been executed or verified).
- The 148 engineering checks are **not described as hackathon scoring points** — they are local engineering validation results.

### Exact Proposed Commit Message:
```text
feat: add Pharos Yield Optimizer for Arena Task 15

- Pure TypeScript, zero runtime dependencies, non-custodial architecture
- Dual execution: standalone Node.js HTTP server & Vercel serverless functions
- Live integration with Pharos Pacific Mainnet (Chain ID 1672)
- Faroo stPROS liquid staking integration with 265,000 unified lifecycle gas
- Truth-first accounting invariant: 1 of 3 qualifying sources verified on-chain
- Explicit financial disclosures: 8.5% illustrative yield assumption (scenario model input)
- 148-point engineering verification suite: 130 tests, 5 numerical checks, 13 simulator checks
```

---

## 3. Exact Future Git Commands (DO NOT EXECUTE NOW)

When explicit authorization is granted in a future gate:

```bash
# Navigate to project directory
cd "C:\Users\NO GO NO\pharosbuild\skills\pharos-yield-optimizer"

# Step 1: Stage all verified project files
git add .gitignore README.md package.json package-lock.json tsconfig.json vercel.json .env.example
git add src/ api/ public/ scripts/ tests/ docs/

# Step 2: Verify staged files before committing
git status --short

# Step 3: Create initial repository commit
git commit -m "feat: add Pharos Yield Optimizer for Arena Task 15"
```

> **These commands HAVE NOT BEEN EXECUTED. This document is a specification for future execution.**

---

## 4. Post-Commit Verification (Future Reference)

After the initial commit is authorized and executed:

```bash
# Verify commit was created correctly
git log --oneline

# Verify working tree is clean
git status --short --branch
```

Expected output after commit:
```
## main
<hash> feat: add Pharos Yield Optimizer for Arena Task 15
```
```
## main
(clean working tree)
```
