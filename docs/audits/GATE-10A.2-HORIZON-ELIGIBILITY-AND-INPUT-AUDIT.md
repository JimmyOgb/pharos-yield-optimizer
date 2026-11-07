# PHAROS TASK 15 — GATE 10A.2: HORIZON ELIGIBILITY & RECOMMENDATION-INPUT AUDIT REPORT

**Project:** Pharos Yield Optimizer  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Network:** Pharos Pacific Mainnet — Chain ID `1672` (`0x688`)  
**RPC Endpoint:** `https://rpc.pharos.xyz`  
**Accepted Baseline Commit:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`  
**Current Working HEAD:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec` (Strictly Unchanged)  
**Production URL:** `https://pharos-yield-optimizer.vercel.app` (Read-Only Verified: HTTP 200 OK)  
**Audit Timestamp:** `2026-11-07T08:11:00+01:00`  
**Audit Mode:** STRICT READ-ONLY AUDIT (Zero Code / Zero Test / Zero Config Changes)  

---

## 1. Executive Summary & Audit Findings Matrix

| Audit Area | Scope Checked | Status | Key Evidence / Finding |
|---|---|:---:|---|
| **1. Repository Integrity** | Baseline HEAD, ancestry, git status, protected workspaces | **PASS** | HEAD matches `53bbf0f` exactly. Ancestry verified. All Gate 9 and Gate 10A audit deliverables preserved. Task 14 completely clean. |
| **2. Recommendation Execution Path** | End-to-end tracing from live adapter to recommendation output | **PASS** | Exact 8-stage path mapped across adapters, registry, bridge, and engine. Current separation between Gate 10A adapters and baseline engine verified. |
| **3. Horizon Eligibility Matrix (7d, 14d, 15d, 21d, 30d)** | Hard unbonding constraints (Faroo 15d, PoS 21d, FaroSwap info-only) | **NEEDS-REVIEW** | **Defect Identified:** At 14 days, `recommendationEngine.ts` currently evaluates Faroo as eligible ($14 \ge 14$) and outputs `MOVE` (+3.26 PROS), violating the Gate 9.2/9.3 15-day hard unbonding requirement (14d queue + 1d buffer). |
| **4. Negative Value Scaling in yieldMath.ts** | `scaledToDecimal` function on negative BigInts (net loss scenarios) | **NEEDS-REVIEW** | **Defect Identified:** In `src/engine/yieldMath.ts` lines 40–45, negative `valueScaled` produces `NaN` because `fractionalPart.toString()` produces `"-..."`, resulting in invalid string concatenation (e.g. `Number("-2.-370269...")`). |
| **5. Recommendation-Input Integrity** | Isolation of live data, historical returns, and forward scenario assumptions | **PASS** | 8.50% rate is strictly confined to `FORWARD_SCENARIO_ASSUMPTION_850_BPS`. Live observations and historical realized returns reside in distinct typed fields. |
| **6. Economic Decision Invariants** | Staleness $\le 10\text{m}$, fail-closed on RPC error, LP non-actionability | **PASS** | `YieldSourceRegistry` forces `STALE` on observations $> 600\text{s}$. RPC errors force `ERROR`. FaroSwap LP strictly has `isActionableRecommendationDestination: false`. |
| **7. Production & Security Boundaries** | Read-only production check, zero private keys/signing/commits/Arena | **PASS** | Production serving HTTP 200 OK (ETag `"f7fc3d5ea250eb951426233fae7b85a3"`). Zero wallet connection, zero signing, zero transactions, zero commits, zero pushes. |

---

## 2. Repository Preflight & Working Tree Verification

### 2.1 Git HEAD & Ancestry
- **Command:** `git rev-parse HEAD`
- **Output:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`
- **Ancestry Verification:** `git merge-base --is-ancestor 53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec HEAD` returned exit code 0 (`ANCESTOR_OK`). Current HEAD is identical to the accepted baseline commit.

### 2.2 Working Tree Status (`git status --short`)
```
 M src/adapters/farooAdapter.ts
 M src/index.ts
 M src/types/index.ts
 M tests/unit/farooAdapter.test.ts
?? docs/PHAROS-OFFICIAL-RESOURCES.md
?? docs/audits/GATE-10A-THREE-SOURCE-ADAPTERS-REPORT.md
?? docs/audits/GATE-10A.1-IMPLEMENTATION-VERIFICATION-REPORT.md
?? docs/audits/GATE-8A-THREE-SOURCE-DISCOVERY.md
?? docs/audits/GATE-8B-THREE-SOURCE-EVIDENCE-VERIFICATION.md
?? docs/audits/GATE-8C-THIRD-SOURCE-QUALIFICATION.md
?? docs/audits/GATE-8D-INDEPENDENT-THREE-SOURCE-VERIFICATION.md
?? docs/audits/GATE-9-ARCHITECTURE-AND-RISK-REGISTER.md
?? docs/audits/GATE-9-IMPLEMENTATION-ACCEPTANCE-CRITERIA.md
?? docs/audits/GATE-9-THREE-SOURCE-IMPLEMENTATION-PLAN.md
?? docs/audits/GATE-9.1-ECONOMIC-CORRECTIONS.md
?? docs/audits/GATE-9.2-FINAL-ECONOMIC-ACCEPTANCE.md
?? docs/audits/GATE-9.3-FINAL-RISK-AND-EVIDENCE-CORRECTIONS.md
?? docs/gate-7b/...
?? src/adapters/faroSwapV3Adapter.ts
?? src/adapters/nativePosAdapter.ts
?? src/adapters/yieldSourceRegistry.ts
?? tests/unit/faroSwapV3Adapter.test.ts
?? tests/unit/nativePosAdapter.test.ts
?? tests/unit/yieldSourceRegistry.test.ts
```

### 2.3 Task 14 & Protected Workspaces Status
- Sibling workspace `skills/pharos-portfolio-assistant` (Task 14): `git status --short` returned 0 lines (clean, untouched).
- All previous documentation files remain intact and unstaged.

---

## 3. End-to-End Recommendation Execution Path

Tracing the live recommendation flow through the system:

```
[Pharos Pacific Mainnet RPC (https://rpc.pharos.xyz)]
                           │
                           ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Stage 1: Live Source Adapters (Read-Only)                      │
 │  - FarooAdapter: totalPooledPros() [0x01e1d114], totalSupply()│
 │  - NativePosAdapter: getDelegator() [0x3a6d6bae] 9-word tuple │
 │  - FaroSwapV3Adapter: slot0() [0x3850c7bd], liquidity()       │
 │  - PharosDexAdapter: poolManager() [0xdc4c90d3]               │
 └───────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Stage 2: Normalized Source Registry                           │
 │  - File: src/adapters/yieldSourceRegistry.ts                  │
 │  - Method: fetchSnapshot()                                    │
 │  - Invariant checks:                                          │
 │      * Max staleness: 600s (older -> STALE status)            │
 │      * Fail-closed on RPC throw -> ERROR status               │
 │      * Normalizes to NormalizedYieldSource[]                  │
 └───────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Stage 3: Source Qualification Taxonomy                        │
 │  - Faroo stPROS: FULLY_QUALIFIED                              │
 │  - Native PoS Consensus: FULLY_QUALIFIED                      │
 │  - FaroSwap V3 LP: QUALIFIED_WITH_DISCLOSURE                  │
 └───────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Stage 4: Live Bridge Linkage (Current vs Target State)        │
 │  - File: src/adapters/liveRecommendationBridge.ts             │
 │  - Current Gate 10A state: Bridge queries gas price and Faroo │
 │    state, and invokes recommendationEngine.ts.                │
 │  - Note: Registry-to-Engine wiring is scheduled for Gate 10B. │
 └───────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Stage 5: Horizon Eligibility Evaluation                       │
 │  - In Registry: minHoldingDaysForActionable (Faroo: 15, PoS: 21)│
 │  - In Current Engine: lockupPeriodDays (Faroo: 14)            │
 │  - Current Evaluation: isLockupEligible = horizon >= lockup   │
 └───────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Stage 6: Friction & Net Gain Calculation                      │
 │  - File: src/engine/frictionModel.ts                          │
 │  - File: src/engine/yieldMath.ts                              │
 │  - Net Gain = Gross Yield - Total Physical Lifecycle Friction │
 └───────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Stage 7: Deterministic Recommendation Decision                │
 │  - File: src/engine/recommendationEngine.ts                   │
 │  - Decision Rules:                                            │
 │      * If all eligible candidates have net advantage <= 0:    │
 │          STAY_PUT (FRICTION_EXCEEDS_GROSS_YIELD)             │
 │      * If horizon < lockup:                                   │
 │          STAY_PUT (HORIZON_SHORTER_THAN_LOCKUP)              │
 │      * If net advantage > 0:                                  │
 │          MOVE (POSITIVE_NET_ALPHA)                            │
 └───────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ Stage 8: Output Delivery                                      │
 │  - Formatted OptimizerRecommendation JSON payload              │
 └───────────────────────────────────────────────────────────────┘
```

---

## 4. Horizon Eligibility Matrix (Deterministic Execution Audit)

We executed `generateRecommendation` across the five audited horizons for a 1,000 PROS deposit from `native-pros-baseline` at 1.25 Gwei gas price.

| Horizon | Required Standard (Gate 9.3) | Current Engine Observed Output | Finding | Evidence / Reason |
|:---:|---|---|:---:|---|
| **7 Days** | **Must be ineligible for all yield sources** (15d queue+buffer, 21d unbond, LP info-only). Target: `STAY_PUT`. | `Decision: STAY_PUT`<br>`Reason: HORIZON_SHORTER_THAN_LOCKUP`<br>`Faroo isLockupEligible: false` ($7 < 14$). | **PASS** | Faroo queue lockup (14d) correctly prevents `MOVE`. Decision is `STAY_PUT`. |
| **14 Days** | **Must be ineligible** ($14 < 15$ days total queue + safety buffer). Target: `STAY_PUT`. | `Decision: MOVE`<br>`Target: faroo-patient-staking`<br>`Reason: POSITIVE_NET_ALPHA`<br>`Net Advantage: +3.2599 PROS`<br>`Faroo isLockupEligible: true` ($14 \ge 14$). | **NEEDS-REVIEW (DEFECT)** | **Defect:** `STRATEGY_PROFILES['faroo-patient-staking'].lockupPeriodDays` is currently set to `14` instead of `15`. Because $14 \ge 14$, the engine recommends `MOVE` at 14 days, violating the hard 15-day total redemption barrier ($14\text{d queue} + 1\text{d buffer} = 15\text{d}$). |
| **15 Days** | **May qualify for Faroo** subject to friction break-even. Native PoS ineligible ($15 < 21$). Target: `MOVE` (Faroo). | `Decision: MOVE`<br>`Target: faroo-patient-staking`<br>`Reason: POSITIVE_NET_ALPHA`<br>`Net Advantage: +3.4928 PROS`. | **PASS** | $15 \ge 15$ satisfies total redemption duration. Positive net alpha confirmed. |
| **21 Days** | **May qualify for Faroo and Native PoS**. Target: `MOVE`. | `Decision: MOVE`<br>`Target: faroo-patient-staking`<br>`Net Advantage: +4.8901 PROS`. | **PASS (PARTIAL)** | Faroo is correctly eligible. Native PoS is not yet present in `recommendationEngine.ts` comparisons (slated for Gate 10B). |
| **30 Days** | **Both Faroo and Native PoS qualify**. In forward 8.50% scenario, net returns tie ($+6.98\text{ PROS}$, $\Delta = 0.0007\text{ PROS} < 0.10\text{ PROS}$). Target: `TIE_NO_MEANINGFUL_ALPHA`. | `Decision: MOVE`<br>`Target: faroo-patient-staking`<br>`Net Advantage: +6.9860 PROS`. | **PASS (PARTIAL)** | Faroo is eligible. Tie handling and PoS candidate inclusion are slated for Gate 10B. |

---

## 5. Critical Technical Defects & Limitations Identified

### Defect 1: Negative BigInt Handling in `yieldMath.ts:scaledToDecimal`
- **Location:** [`src/engine/yieldMath.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/yieldMath.ts#L39-L46)
- **Code:**
  ```typescript
  export function scaledToDecimal(valueScaled: bigint, scale = SCALE_18): number {
    const integerPart = valueScaled / scale;
    const fractionalPart = valueScaled % scale;
    
    // Format fractional part with leading zeros
    const fracStr = fractionalPart.toString().padStart(18, '0');
    return Number(`${integerPart}.${fracStr}`);
  }
  ```
- **Observed Behavior:**
  When `valueScaled` is negative (e.g. `netGainWei = -2370269263698630137n` when friction exceeds yield over short horizons), `fractionalPart.toString()` produces `"-370269263698630137"`.
  The string template evaluates to `"-2.-370269263698630137"`.
  Calling `Number()` on this string evaluates to **`NaN`**!
  As a result, `netGainPros` and `netGainPercentage` evaluate to `NaN` in all negative net yield projections.
- **Recommended Remediation (for Gate 10A.3 / Gate 10B):**
  ```typescript
  export function scaledToDecimal(valueScaled: bigint, scale = SCALE_18): number {
    const isNegative = valueScaled < 0n;
    const absVal = isNegative ? -valueScaled : valueScaled;
    const integerPart = absVal / scale;
    const fractionalPart = absVal % scale;
    const fracStr = fractionalPart.toString().padStart(18, '0');
    const signStr = isNegative ? '-' : '';
    return Number(`${signStr}${integerPart}.${fracStr}`);
  }
  ```

### Defect 2: Faroo 14-Day Lockup Barrier in `recommendationEngine.ts`
- **Location:** [`src/engine/recommendationEngine.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts#L34)
- **Code:**
  ```typescript
  'faroo-patient-staking': {
    ...
    lockupPeriodDays: 14,
    exitDelayDays: 14,
  }
  ```
- **Observed Behavior:**
  In Gate 10A, [`src/adapters/yieldSourceRegistry.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/adapters/yieldSourceRegistry.ts) was updated with `minHoldingDaysForActionable: 15` and `totalSettlementDays: 15`. However, `recommendationEngine.ts` still holds the baseline value of `14`.
  Consequently, for a 14-day query, the engine determines $14 \ge 14$ and recommends `MOVE` to Faroo Patient Staking, directly contradicting the Gate 9.2/9.3 economic acceptance rule where 14-day queries must return `STAY_PUT`.
- **Recommended Remediation (for Gate 10A.3 / Gate 10B):**
  Update `STRATEGY_PROFILES['faroo-patient-staking'].lockupPeriodDays` to `15`, or evaluate eligibility using `source.lockupRequirements.minHoldingDaysForActionable`.

---

## 6. Recommendation-Input Integrity Audit

### 6.1 Distinction Between Data Types
- **Live On-Chain Data:** Queryable only via live RPC (`totalPooledProsHex`, `totalSupplyHex`, `slot0`, `liquidity`). Stored in `rawObservations` and `decodedState`.
- **Historical Trailing Returns:** Derived only from multi-block observation windows with known timestamps:
  - Faroo stPROS: 26.14% APR over 4.78 days (Blocks `#21924812` $\to$ `#22348179`).
  - Native PoS Consensus: 29.98% APR over 3.80 days (Blocks `#22004812` $\to$ `#22348500`).
  - FaroSwap Full-Range LP: 6.26% APR over 3.80 days.
  - All historical rates are accompanied by explicit `isShortObservationWarning: true` notices ($< 7\text{ days}$).
- **Forward Scenario Assumptions:**
  - Staking baseline: `FORWARD_SCENARIO_ASSUMPTION_850_BPS` ($850\text{ bps} = 8.50\%$).
  - Strictly held in `forwardScenarioAssumption: { scenarioName: 'CONSERVATIVE_FORWARD_SCENARIO', scenarioRateBps: 850, scenarioRatePercentage: 8.5 }`.
  - Never inserted into live observed APR fields or asserted as guaranteed forward yields.
- **Finding:** **PASS**

### 6.2 Complete Physical Lifecycle Friction Accounting
- **Faroo Patient Staking:** Unified 265,000 gas units (Wrap 45k + Approve 45k + Deposit 90k = 180k entry; RequestWithdraw queue 85k exit). 0% protocol fee.
- **Faroo Instant DEX Exit:** 325,000 gas units (180k entry + 145k AMM swap exit) + 0.30% swap fee + 0.10% slippage = 4.00 PROS on 1,000 PROS principal.
- **Native PoS Consensus:** 90,000 gas units (45k delegate entry + 45k undelegate exit). 0% protocol fee.
- **FaroSwap Uniswap V3 LP:** 740,000 gas units (370k entry + 370k exit) + 0.30% swap fee entry (1.50 PROS) + 0.30% swap fee exit (1.50 PROS) = 3.0074 PROS fixed friction.
- Friction is deducted once from gross yield over the requested horizon.
- **Finding:** **PASS**

### 6.3 Staleness and Provenance Guard Verification
- `YieldSourceRegistry` enforces a strict 600-second maximum staleness threshold:
  ```typescript
  const stalenessSeconds = Math.max(0, nowSec - obs.blockTimestamp);
  const isFresh = stalenessSeconds <= this.stalenessThresholdSeconds;
  ```
- If staleness exceeds 600 seconds, `isFresh: false` and `qualificationStatus: 'STALE'`.
- Missing or malformed data produces `qualificationStatus: 'ERROR'` and `isActionableRecommendationDestination: false`.
- **Finding:** **PASS**

---

## 7. Test Suite Execution & Coverage Audit

### 7.1 Test Execution Verification
- **Command:** `npm run test:unit`
  - Output: `140 passed, 0 failed, 0 skipped` (Duration: `2.53s`).
- **Command:** `npm test`
  - Output: `171 passed, 0 failed, 0 skipped` (Duration: `76.42s`).

### 7.2 Critical Coverage Audit Findings
1. **Structural vs Economic Validation:**
   - Adapters (`farooAdapter.test.ts`, `nativePosAdapter.test.ts`, `faroSwapV3Adapter.test.ts`) thoroughly validate on-chain decoding, tuple parsing, signed ticks, fee tiers, and risk disclosures.
   - Registry (`yieldSourceRegistry.test.ts`) verifies staleness flags and fail-closed error handling.
2. **Missing Test Case for 14-Day Lockup Boundary:**
   - In `tests/unit/recommendationEngine.test.ts`, line 88:
     ```typescript
     ✔ 14-day horizon: exactly meets lockup boundary -> outputs MOVE to Faroo Patient Staking
     ```
     This unit test explicitly asserts that 14 days outputs `MOVE`, which contradicts the Gate 9.2/9.3 15-day requirement!
     When `recommendationEngine.ts` is corrected to enforce 15 days, this unit test must be updated to assert `STAY_PUT` at 14 days and `MOVE` at 15 days.
3. **Missing Test Case for Negative BigInt `scaledToDecimal`:**
   - In `tests/unit/yieldMath.test.ts`, `scaledToDecimal` was only tested on positive values (`1e18` $\to$ `1.0`). A negative BigInt test was absent, which allowed the `NaN` defect to remain undetected in previous baselines.

---

## 8. Production & Security Boundary Verification

- **Production Health Check:**
  `curl -sI https://pharos-yield-optimizer.vercel.app`
  - Status: `HTTP/1.1 200 OK`
  - Server: `Vercel`
  - ETag: `"f7fc3d5ea250eb951426233fae7b85a3"`
  - Content-Security-Policy: Enforced.
- **Security Posture:**
  - Zero wallet connections.
  - Zero private keys accessed.
  - Zero blockchain transactions signed or broadcasted.
  - Zero Git commits created (`git log -1` remains `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`).
  - Zero Git pushes or Vercel deployments.
  - Zero Arena submissions.
  - Task 14 sibling workspace remains clean and untouched.
- **Finding:** **PASS**

---

## 9. Conclusion & Recommendations

### Overall Verdict: **NEEDS-REVIEW (DEFECTS IDENTIFIED BEFORE GATE 10B)**

While the Gate 10A adapters and registry are fully verified and compliant, the read-only audit of recommendation inputs and horizon execution paths has identified **two critical mathematical/logical defects** in the underlying baseline engine:

1. **`scaledToDecimal` NaN Defect:** In `src/engine/yieldMath.ts`, negative BigInts convert to `NaN` due to negative fractional string formatting.
2. **14-Day Faroo Eligibility Defect:** In `src/engine/recommendationEngine.ts`, `lockupPeriodDays` is still set to `14` instead of `15`, permitting an unjustified `MOVE` recommendation at 14 days.

### Recommended Next Step
Authorize a narrowly scoped correction gate (**Gate 10A.3: Baseline Math and Lockup Boundary Corrections**) to resolve these two defects in `src/engine/yieldMath.ts` and `src/engine/recommendationEngine.ts` before proceeding to Gate 10B (Three-Source Recommendation Engine Integration).

---

## 10. Strict Stop Condition

Execution has stopped. In adherence to the authorization boundary:
- No code or tests have been modified.
- Gate 10B has NOT been started.
- Awaiting your explicit review and directive.
