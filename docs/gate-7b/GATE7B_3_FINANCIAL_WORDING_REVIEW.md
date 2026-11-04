# GATE 7B.3 — FINANCIAL WORDING, APY DISCLOSURE & PROVENANCE AUDIT
## Normalized Parameter Disclosures, Epistemological Separation & Financial Boundary Review

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026 (Gate 7B.3 — Fresh Independent Inspection)  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Executive Summary & Mandated Disclosure

In strict compliance with Gate 7B.3 directives, all public-facing surfaces (UI dashboard, API responses, README, and source-code comments) were audited to ensure the 8.5% model input is **never** represented as a guaranteed, live, or verified forward rate.

The exact mandated disclosure is confirmed embedded across the application:

> **"Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ."**

One source-code comment was **corrected** during this gate: the `FORWARD_RATES_BPS` constant header in `src/engine/recommendationEngine.ts` previously read `"Verified Normalized Forward Rates"`, which was misleading. It now reads `"Illustrative Scenario Rates"` with an explicit note that these are model inputs, not verified APYs. This is a documentation-only change with zero effect on calculations or behavior.

---

## 2. Occurrence Audit & Surface Alignment

| Public-Facing Surface | Location | Pre-Gate 7B.3 Wording | Gate 7B.3 Verified Disclosure | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Frontend UI (Simulator)** | `src/ui/index.html` / `public/index.html` | General financial modeling notice | Exact mandated notice embedded: *"Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ."* | **COMPLIANT** |
| **API `/api/recommendation`** | `src/server/router.ts` (line ~391) | Disclosure added earlier | `yieldAssumptionNotice` field confirmed present in API response | **COMPLIANT** |
| **API `/api/recommendation` reasons** | `src/server/router.ts` (line ~399) | Reason strings | Exact string embedded in reasons array | **COMPLIANT** |
| **Public README** | `README.md` (lines ~180–182) | Financial modeling notice | Callout box with exact mandated disclosure | **COMPLIANT** |
| **Source comment `FORWARD_RATES_BPS`** | `src/engine/recommendationEngine.ts` (line 77) | `"// Verified Normalized Forward Rates"` — **MISLEADING** | Now reads: `"// Illustrative Scenario Rates"` + explicit model-input note | **CORRECTED ✓** |

---

## 3. Full Source-Code Scan Results

The following search patterns were executed across all TypeScript source, API, and test files:

| Search Pattern | Occurrences Found | Assessment |
| :--- | :---: | :--- |
| `8.5` | 10 | All in `recommendationEngine.ts` (rate constants with clarified comments), `server/router.ts` (with mandated disclosure), `tests/` (numerical fixture — not public-facing) |
| `APY` | 9 | `yieldMath.ts` (warning: "NOT a sustainable forward APY"), `router.ts` (mandated disclosure), `transactionReviewer.ts` (Axil off-chain target disclaimer), `dexAdapter.ts` (UNAVAILABLE status), test assertions |
| `APR` | 15 | Type field names (`trailingAprBps`), dexAdapter status (`DISQUALIFIED_FROM_LIVE_APR`), router labels — all appropriately qualified |
| `forward APY` | 2 | Both in `yieldMath.ts` episodic reward warning and `server/router.ts` mandated disclosure — both correctly disclaiming |
| `net alpha` | 2 | `src/server/router.ts` informational label — correctly qualified with full net-gain calculation context |
| `gross yield` | 3 | `src/engine/recommendationEngine.ts` and `yieldMath.ts` — engineering calculation variable names; not public-facing as standalone financial claims |
| `expected return` | 0 | Zero occurrences |
| `break.?even` | 15 | All in calculation engine and test assertions — mathematically derived values, not speculative |
| `production release` | 0 | **Zero occurrences confirmed** — phrase removed as directed |

---

## 4. Strict Epistemological Category Separation

The codebase strictly separates these data categories:

### Category 1 — Live On-Chain Observations (Verified)
- **Spot Exchange Rate:** Faroo stPROS/PROS ratio queried live from `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4` via ERC-4626 `totalAssets()` and `totalSupply()`.
- **Current Block Height:** Live `eth_blockNumber` > 22,000,000 confirmed in integration tests.
- **Live Base Gas Price:** `eth_gasPrice` from Pacific Mainnet RPC.
- **DEX Infrastructure:** PoolManager and StateView contracts confirmed deployed on-chain.

### Category 2 — Short-Lived Cached Observations
- 3,000ms TTL in-memory read cache protecting against repeated RPC calls.
- Stale cache (> `FRESHNESS_THRESHOLD_SECONDS` = 600s) triggers `INSUFFICIENT_DATA` guard — engine refuses to issue recommendations on stale data.

### Category 3 — Configured Fallback Baseline
- 10.0 Gwei conservative offline fallback gas price (used only when live gas price unavailable).

### Category 4 — Normalized Scenario Assumptions (Model Inputs — NOT Verified APYs)
- **8.5% annualized illustrative input:** A scenario-modeling configured rate used in `calculateGrossProjectedYield()`. Disclosed on every surface with the mandated notice.
- **0.10% standard retail swap slippage:** Conservative best-effort estimate, not an observed receipt.

### Category 5 — Empirical Benchmark Estimates (Not Measured Receipts)
- **85,000 gas — unbonding queue request:** Tagged as benchmark, not a measured receipt.
- **145,000 gas — instant DEX swap exit:** Tagged `isExitGasAssumed`, not a measured receipt.

### Category 6 — Test Fixtures
- Numerical verification inputs (e.g., `1.003900` and `1.004917` exchange rates) are explicitly labeled as fixture values in `tests/numericalVerification.ts`. They are not live or current observations.

---

## 5. Preserved Financial Invariants (Confirmed Unchanged)

| Invariant | Preserved Value | Source |
| :--- | :--- | :--- |
| Patient lifecycle gas | 265,000 gas (45k wrap + 45k approve + 90k deposit + 85k unbond) | `frictionModel.ts` |
| Entry-only gas | 180,000 gas (45k + 45k + 90k) | `frictionModel.ts` |
| Unbond queue gas benchmark | 85,000 gas — **not a measured receipt** | `frictionModel.ts` comment |
| Instant DEX exit gas assumption | 145,000 gas — **assumed benchmark, not measured receipt** | `frictionModel.ts` comment |
| Instant lifecycle estimate | 325,000 gas (180k + 145k) — **not a measured receipt** | `frictionModel.ts` |
| Patient unstaking queue | 14-day mandatory lockup period | `STRATEGY_PROFILES` |
| Qualifying yield sources | **1 — Faroo stPROS only** | `verifiedQualifyingSourcesCount: 1` in all recommendation outputs |
| Instant DEX exit | NOT counted as a separate qualifying source (`qualifiesTowardReq01: false`) | `STRATEGY_PROFILES` |

---

## 6. Source-Code Acceptability Invariant Banner (Confirmed Present)

The following banner is preserved in `README.md` and enforced by all API responses:

```
╔═══════════════════════════════════════════════════════════════════════╗
║                      TRUTH-FIRST ACCOUNTING                           ║
║  Status: FEWER THAN THREE QUALIFYING SOURCES — REQUIREMENT NOT MET    ║
║  Qualifying Sources: 1 (Faroo Liquid Staking stPROS)                  ║
╚═══════════════════════════════════════════════════════════════════════╝
```

The instant DEX exit alternative is **not** counted toward the requirement. The banner has not been removed or softened.

---

## 7. Verdict

**All public-facing APY and financial wording is FULLY COMPLIANT with Gate 7B.3 directives.**

One internal source code comment (`"Verified Normalized Forward Rates"`) was corrected to `"Illustrative Scenario Rates"` with an explicit model-input clarification. This change is documentation-only — it does not alter any calculation, test, or execution path.
