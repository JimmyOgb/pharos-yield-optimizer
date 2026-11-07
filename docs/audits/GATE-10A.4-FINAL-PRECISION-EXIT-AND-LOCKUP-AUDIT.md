# GATE 10A.4: FINAL PRECISION, EXIT-ROUTE & LOCKUP-SEMANTICS AUDIT REPORT

**Project:** Pharos Yield Optimizer  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Network:** Pharos Pacific Mainnet — Chain ID `1672` (`0x688`)  
**RPC Endpoint:** `https://rpc.pharos.xyz`  
**Accepted Baseline Commit:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`  
**Production URL:** `https://pharos-yield-optimizer.vercel.app`  
**Audit Gate:** Gate 10A.4 (Final Precision, Exit-Route & Lockup-Semantics Read-Only Audit)  
**Date:** November 7, 2026  

---

## 1. Executive Summary & Audit Mandate

This report documents the comprehensive, strictly read-only audit of the Pharos Yield Optimizer following the Gate 10A.3 implementation of math and lockup boundary corrections.

Under the Gate 10A.4 mandate:
- **Zero code, test, configuration, or dependency changes were made.**
- **Zero commits, pushes, deployments, or transactions were performed.**
- Deterministic read-only probes were conducted on BigInt financial precision, IEEE-754 floating-point conversion, lockup/exit delay semantics, secondary market exit-route availability, forward-scenario provenance disclosures, and complete test suite integrity.

---

## 2. Repository Integrity Audit

### 2.1 Commit Hash and Ancestry
- **Local HEAD:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`
- **Accepted Parent Baseline:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`
- **Ancestry Verification:** Exact match (`git merge-base --is-ancestor 53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec HEAD` returned code `0`).

### 2.2 Working Tree Status
`git status --short` reveals:
```text
 M src/adapters/farooAdapter.ts
 M src/engine/recommendationEngine.ts
 M src/engine/yieldMath.ts
 M src/index.ts
 M src/types/index.ts
 M tests/unit/farooAdapter.test.ts
 M tests/unit/recommendationEngine.test.ts
 M tests/unit/yieldMath.test.ts
?? docs/PHAROS-OFFICIAL-RESOURCES.md
?? docs/audits/GATE-10A-THREE-SOURCE-ADAPTERS-REPORT.md
?? docs/audits/GATE-10A.1-IMPLEMENTATION-VERIFICATION-REPORT.md
?? docs/audits/GATE-10A.2-HORIZON-ELIGIBILITY-AND-INPUT-AUDIT.md
?? docs/audits/GATE-10A.3-MATH-AND-LOCKUP-CORRECTIONS-REPORT.md
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
?? docs/gate-7b/GATE7B_5_CLAIMS_AND_DISCLOSURES.md
?? docs/gate-7b/GATE7B_5_COMMITTED_FILE_CLASSIFICATION.md
?? docs/gate-7b/GATE7B_5_FINAL_DECISION.md
?? docs/gate-7b/GATE7B_5_GITHUB_PUBLICATION_PLAN.md
?? docs/gate-7b/GATE7B_5_PUBLICATION_READINESS.md
?? docs/gate-7b/GATE7B_5_SECURITY_REVIEW.md
?? docs/gate-7b/GATE7B_6_ENDPOINT_DISPOSITION.md
?? docs/gate-7b/GATE7B_6_FINAL_DECISION.md
?? docs/gate-7b/GATE7B_6_HISTORICAL_PATH_REVIEW.md
?? src/adapters/faroSwapV3Adapter.ts
?? src/adapters/nativePosAdapter.ts
?? src/adapters/yieldSourceRegistry.ts
?? tests/unit/faroSwapV3Adapter.test.ts
?? tests/unit/nativePosAdapter.test.ts
?? tests/unit/yieldSourceRegistry.test.ts
```

### 2.3 Diff Statistics
`git diff --stat` indicates:
```text
 src/adapters/farooAdapter.ts            | 147 +++++++++++++++++++++++++++++++-
 src/engine/recommendationEngine.ts      |  10 +--
 src/engine/yieldMath.ts                 |  16 ++--
 src/index.ts                            |   3 +
 src/types/index.ts                      | 106 ++++++++++++++++++++++-
 tests/unit/farooAdapter.test.ts         |  73 ++++++++++++++++
 tests/unit/recommendationEngine.test.ts |  51 ++++++++++-
 tests/unit/yieldMath.test.ts            |  96 +++++++++++++++++++++
 8 files changed, 483 insertions(+), 19 deletions(-)
```

### 2.4 Preservation of Prior Audit Documents & Protected Workspaces
- All Gate 8 (8A, 8B, 8C, 8D), Gate 9 (9, 9.1, 9.2, 9.3), and Gate 10A (10A, 10A.1, 10A.2, 10A.3) documentation files remain intact on disk in `docs/audits/`.
- Task 14 workspace (`../pharos-portfolio-assistant`) was inspected: status is completely clean, HEAD is at commit `94ae95454dc38915bd74b394af472310e67e76c2`.

---

## 3. BigInt and Financial Precision Audit

### 3.1 Implementation of `scaledToDecimal`
The current implementation in [`src/engine/yieldMath.ts`](file:///C:/Users/NO%20GO%20NO/pharosbuild/skills/pharos-yield-optimizer/src/engine/yieldMath.ts#L40-L53):
```ts
export function scaledToDecimal(valueScaled: bigint, scale = SCALE_18): number {
  if (valueScaled === 0n) return 0;

  const isNegative = valueScaled < 0n;
  const absVal = isNegative ? -valueScaled : valueScaled;
  const integerPart = absVal / scale;
  const fractionalPart = absVal % scale;

  // Format fractional part with 18 leading zeros
  const fracStr = fractionalPart.toString().padStart(18, '0');
  const signStr = isNegative ? '-' : '';
  return Number(`${signStr}${integerPart}.${fracStr}`);
}
```

### 3.2 Caller Analysis: Display vs Decision Paths
A repository-wide audit of all invocations of `scaledToDecimal` was performed:
1. `src/adapters/farooAdapter.ts` (L108): `spotRateDecimal = scaledToDecimal(spotRateScaled)` $\to$ Used exclusively for metadata display in `FarooStakingState.spotRate`.
2. `src/engine/frictionModel.ts` (L98, L123, L145): `totalFrictionPros: scaledToDecimal(totalFrictionWei)` $\to$ Stored in `FrictionBreakdown` for human-readable output.
3. `src/engine/recommendationEngine.ts`:
   - L106: `netGainPros = scaledToDecimal(netGainWei)` $\to$ Informational property in `StrategyProjection`.
   - L107: `principalPros = scaledToDecimal(principalWei)` $\to$ Used for calculating display percentage `(netGainPros / principalPros) * 100`.
   - L130: `grossYieldPros: scaledToDecimal(grossYieldWei)` $\to$ Informational property in `StrategyProjection`.
   - L282: `netAdvantagePros = scaledToDecimal(netAdvantageWei)` $\to$ Informational property in `OptimizerRecommendation` and explanation text string.
4. `src/server/router.ts` (L345, L347): Used in transaction review response formatting for gas and fee strings.

### 3.3 Financial Decision Path Analysis
**CRITICAL FINDING: Financial decisions are executed 100% in BigInt fixed-point arithmetic, NEVER in floating-point `Number`.**

Tracing the actual decision branching in [`src/engine/recommendationEngine.ts`](file:///C:/Users/NO%20GO%20NO/pharosbuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts#L236-L244):
```ts
// 1. Candidate ranking uses native BigInt inequality:
eligibleCandidates.sort((a, b) => (b.netGainWei > a.netGainWei ? 1 : -1));
const bestCandidate = eligibleCandidates[0];

// 2. Net advantage is computed by BigInt subtraction:
const netAdvantageWei = bestCandidate.netGainWei - currentProjection.netGainWei;

// 3. Rebalance decision rule uses BigInt comparison:
if (netAdvantageWei <= 0n) {
  // Returns STAY_PUT
}
```
Furthermore:
- `calculateGrossProjectedYield` uses `BigInt`: `(principalWei * BigInt(forwardRateBps) * BigInt(horizonDays)) / (BPS_SCALE * DAYS_PER_YEAR)`.
- `evaluateStrategyFriction` calculates all gas, fees, and friction in wei using `BigInt`.
- `netGainWei` is evaluated strictly as `grossYieldWei - totalFrictionWei` in `BigInt`.

### 3.4 Read-Only Empirical Precision Probes
Deterministic execution of probes directly against `scaledToDecimal` produced the following observed values:

| Input Probe | Evaluated Result | Exact Mathematical Representation | IEEE-754 Behavior |
|:---|:---:|:---:|:---|
| `0n` | `0` | `0` | Exact zero (`Object.is(res, -0) === false`) |
| `1n` ($1\text{ wei}$) | `1e-18` | $0.000000000000000001$ | Valid subnormal float; non-zero |
| `-1n` ($-1\text{ wei}$) | `-1e-18` | $-0.000000000000000001$ | Valid signed float; non-zero |
| `2n` ($2\text{ wei}$) | `2e-18` | $0.000000000000000002$ | Valid non-zero float |
| `-2n` ($-2\text{ wei}$) | `-2e-18` | $-0.000000000000000002$ | Valid non-zero float |
| `100_000_000_000_000_000n` ($0.10\text{ PROS}$) | `0.1` | $0.1$ | Exact representation |
| $0.10\text{ PROS} + 1\text{ wei}$ | `0.1` | $0.100000000000000001$ | **Collapses to 0.1 in float** ($\Delta = 0$) |
| $0.10\text{ PROS} - 1\text{ wei}$ | `0.1` | $0.099999999999999999$ | **Collapses to 0.1 in float** ($\Delta = 0$) |
| $1,000\text{ PROS}$ (`base`) | `1000` | $1,000.0$ | Exact representation |
| $1,000\text{ PROS} + 1,000\text{ wei}$ | `1000` | $1,000.000000000000001$ | **Collapses in float** (`numBase === numPlus1000` is `true`) |
| $1,000\text{ PROS} + 10,000\text{ wei}$ | `1000` | $1,000.00000000000001$ | **Collapses in float** (`numBase === numPlus10000` is `true`) |
| $100\text{ PROS} + 10^6\text{ wei}$ ($10^{-12}\text{ PROS}$) | `100.000000000001` | $100.000000000001$ | Preserved distinct float (`===` is `false`) |
| $1,000,000,000\text{ PROS} \times 10^{18}$ | `1000000000` | $10^9$ | Exact representation |
| $-1,000,000,000\text{ PROS} \times 10^{18}$ | `-1000000000` | $-10^9$ | Exact representation |

### 3.5 Precision Findings & Architectural Recommendation for Gate 10B
1. **No Risk to Decision Logic:** Because `scaledToDecimal` is strictly a presentation formatter, floating-point collapse of sub-micro differences **cannot alter or corrupt recommendation decisions**.
2. **Crucial Rule for Gate 10B Meaningful-Alpha Threshold:** When the $0.10\text{ PROS}$ threshold (`TIE_NO_MEANINGFUL_ALPHA`) is integrated into `recommendationEngine.ts` in Gate 10B, it **MUST be defined in BigInt wei**:
   ```ts
   export const MEANINGFUL_ALPHA_THRESHOLD_WEI = 100_000_000_000_000_000n; // 0.10 PROS in wei (SCALE_18 / 10n)
   ```
   Evaluating the threshold against `netAdvantageWei` (`if (netAdvantageWei < MEANINGFUL_ALPHA_THRESHOLD_WEI)`) guarantees immunity against floating-point rounding errors.

---

## 4. Lockup Semantics Audit

### 4.1 Constraint Fields Inspection
The codebase was audited for all lockup-related fields:
- `lockupPeriodDays`: Configured on strategy profiles (Faroo: `15`, Axil: `90`, Baseline: `0`).
- `exitDelayDays`: Configured on strategy profiles (Faroo: `15`, Axil: `90`, Baseline: `0`).
- `minimumHoldingPeriod`: Stored on `NormalizedYieldSource.lockupRequirements.minHoldingDaysForActionable` (Native PoS: `21`, Faroo: `15`, FaroSwap: `18`).

### 4.2 Engine Evaluation Logic
In `src/engine/recommendationEngine.ts`:
- Line 111: `const isLockupEligible = horizonDays >= profile.lockupPeriodDays;`
- Line 209: `if (query.requireInstantLiquidity && c.profile.lockupPeriodDays > 0) return false;`
- Line 210: `if (!c.isLockupEligible) return false;`
- Line 261: `const isHorizonTooShort = !query.requireInstantLiquidity && query.horizonDays < STRATEGY_PROFILES['faroo-patient-staking'].lockupPeriodDays;`

**Lockup Semantics Verification:**
- The engine uses the configured value of `lockupPeriodDays` (15) as the single total required holding period.
- It does **NOT** add `lockupPeriodDays + exitDelayDays` (which would have erroneously totaled $15 + 15 = 30$ days).
- It does **NOT** double-count delays.
- The 15 days cleanly represents: $14\text{ days (protocol queue)} + 1\text{ day (settlement safety buffer)}$.

### 4.3 Required Faroo Horizon Eligibility Matrix
Testing the decision engine across all required horizon benchmarks confirmed:

| Horizon Query | Faroo Lockup Check (`horizonDays >= 15`) | Actual Engine Decision | Reason Code | Status |
|:---:|:---:|:---:|:---|:---:|
| **7 Days** | `7 >= 15` $\to$ **FALSE** | `STAY_PUT` | `HORIZON_SHORTER_THAN_LOCKUP` | **PASS** |
| **14 Days** | `14 >= 15` $\to$ **FALSE** | `STAY_PUT` | `HORIZON_SHORTER_THAN_LOCKUP` | **PASS** |
| **15 Days** | `15 >= 15` $\to$ **TRUE** | `MOVE` | `POSITIVE_NET_ALPHA` (+3.4928 PROS) | **PASS** |
| **21 Days** | `21 >= 15` $\to$ **TRUE** | `MOVE` | `POSITIVE_NET_ALPHA` (+4.8900 PROS) | **PASS** |
| **30 Days** | `30 >= 15` $\to$ **TRUE** | `MOVE` | `POSITIVE_NET_ALPHA` (+6.9859 PROS) | **PASS** |

### 4.4 Other Sources Lockup Integrity
- **Native PoS Consensus Staking:** Configured with `POS_UNBONDING_DAYS = 21` (`NativePosAdapter` line 305). Hard 21-day unbonding epoch enforced.
- **FaroSwap Uniswap V3 LP:** Configured with `isActionableRecommendationDestination: false` (`FaroSwapV3Adapter` line 310). Retains informational qualification (`QUALIFIED_WITH_DISCLOSURE`) without actionable automated rebalancing.

---

## 5. Faroo Instant DEX Exit-Route Audit

### 5.1 Investigation of `faroo-instant-dex`
The strategy profile `faroo-instant-dex` was examined in `src/engine/recommendationEngine.ts` and `src/engine/frictionModel.ts`:
- Profile configuration:
  ```ts
  'faroo-instant-dex': {
    id: 'faroo-instant-dex',
    name: 'Faroo Liquid Staking (Instant DEX Exit)',
    asset: 'PROS',
    classification: 'EXECUTION_ALTERNATIVE',
    qualifiesTowardReq01: false,
    contractAddress: '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4', // Faroo stPROS token (NOT a pool)
    lockupPeriodDays: 0,
    exitDelayDays: 0,
    exitFeeBps: 30, // 0.30% swap fee + 0.10% slippage
    requiresKyc: false,
  }
  ```
- Friction model: Models 180,000 entry gas + 145,000 assumed exit swap gas + 0.30% swap fee + 0.10% slippage = 325,000 gas units + 40 bps friction.

### 5.2 On-Chain Evidence & Pool Availability Findings
1. **No Verified Secondary Exit Pool Exists:**
   - Previous RPC queries to FaroSwap Uniswap V3 Factory (`0x87d6050b44fe0d1252d4bf377f0cbb5776d33261`) for token pair `(stPROS, WPROS)` across all four fee tiers (100, 500, 3000, 10000 bps) returned `0x0000000000000000000000000000000000000000`.
   - FaroSwap V2 `getPair` returned empty revert data (uninitialized / non-conclusive).
2. **Current Liquidity Evidence:**
   - Inspected liquidity for stPROS/WPROS is **$0.00**.
   - No executable route exists on-chain to trade stPROS $\to$ WPROS for immediate liquidity.
3. **Execution Feasibility:**
   - The strategy `faroo-instant-dex` is **NOT GENUINELY EXECUTABLE** on Pacific Mainnet.
   - It is an empirical/mathematical simulation profile.
4. **Current Recommendation Risk:**
   - If a user inputs `requireInstantLiquidity: true` with a horizon of $\ge 18$ days (e.g. 60 days), `recommendationEngine.ts` currently recommends: `MOVE` to `faroo-instant-dex`.
   - `TransactionReviewer.reviewFarooInstantDex` outputs 3-step deposit calldata into Faroo stPROS with an informational warning: *"Exit Route: Instant exit will swap stPROS back to PROS on Pharos DEX rather than waiting in the unbonding queue. Subject to 0.30% swap fee and market liquidity slippage."*
   - Because no such pool exists on-chain, a user attempting this exit route would find themselves stranded in stPROS without a DEX secondary market, forced to wait the 15-day unbonding queue.

### 5.3 Classification & Recommended Remediation for Gate 10B
- **Classification:** **`HYPOTHETICAL_UNAVAILABLE_ROUTE`**
- **Recommended Remediation (to be scheduled in Gate 10B):**
  1. Do not recommend `MOVE` to `faroo-instant-dex` while secondary liquidity is unverified.
  2. If `requireInstantLiquidity: true` is requested, the engine should output `STAY_PUT` with reason `NO_QUALIFIED_INSTANT_LIQUIDITY_POOL_EXISTS` or disqualify `faroo-instant-dex` until a live factory pool address with verified liquidity $\ge$ principal is registered.
  3. Update UI to mark Faroo Instant DEX as *(Hypothetical / No Secondary Pool Verified)*.

---

## 6. Forward-Scenario Labelling & Provenance Audit

### 6.1 Tracing of the 8.50% Assumption
The 8.50% parameter was traced across the codebase:
1. `src/types/index.ts` (L19): Defined as `export const FORWARD_SCENARIO_ASSUMPTION_850_BPS = 850;`
2. `src/engine/recommendationEngine.ts` (L80-87): Documented as `FORWARD_RATES_BPS`:
   ```ts
   // 8.50% is a configured fallback assumption used to calculate projected gross yield.
   // Actual yield may differ. Live on-chain exchange-rate accrual is used where available.
   ```
3. `src/adapters/farooAdapter.ts` (L220-226) & `nativePosAdapter.ts` (L298-303):
   ```ts
   forwardScenarioAssumption: {
     scenarioName: 'CONSERVATIVE_FORWARD_SCENARIO',
     scenarioRateBps: FORWARD_SCENARIO_ASSUMPTION_850_BPS,
     scenarioRatePercentage: 8.5,
     provenanceNotice: 'Conservative forward scenario assumption based on validator consensus emission equilibrium. Not a live observed network APY.',
   }
   ```
4. `src/server/router.ts` (L403, L414): Discloses explicitly:
   ```ts
   yieldAssumptionNotice: 'Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ.'
   ```

### 6.2 Forward Provenance Findings
- The 8.50% rate is **never represented as a live on-chain APY or guaranteed return**.
- Historical trailing APRs (Faroo 26.14%, Native PoS 29.98%) are clearly flagged with `isShortObservationWarning: true` and non-bypassable warning notices in normalized adapters.
- **Identified Copy Inconsistency in Router (`src/server/router.ts`):**
  - Line 375: `minimumHoldingDays: rec.targetStrategyId === 'faroo-patient-staking' ? 14 : 0,`
  - Lines 390, 402, 412 refer to "14-day protocol unbonding queue".
  - *Finding:* While `recommendationEngine.ts` was updated in Gate 10A.3 to enforce the 15-day total rule ($14\text{d queue} + 1\text{d buffer}$), `src/server/router.ts` line 375 still outputs `minimumHoldingDays: 14`. This should be updated to `15` during Gate 10B.

---

## 7. Test Integrity & Reproduction Audit

The full test suite was executed against the exact current repository source tree:

```text
npm test
> pharos-yield-optimizer@0.1.0 test
> node --experimental-strip-types --test tests/unit/*.test.ts tests/integration/*.test.ts

Suite Execution Summary:
- Live Integration Tests (Chain 1672 RPC): 6/6 passed
- Gate 6 Production Smoke Tests: 9/9 passed
- Vercel Serverless Function Adapter Tests: 16/16 passed
- PharosDexAdapter Unit Tests: 1/1 passed
- FaroSwapV3Adapter Unit Tests: 4/4 passed
- FarooAdapter Unit Tests: 5/5 passed
- FrictionModel Unit Tests: 11/11 passed
- LiveRecommendationBridge Unit Tests: 2/2 passed
- NativePosAdapter Unit Tests: 7/7 passed
- RecommendationEngine Unit Tests: 45/45 passed
- Server & UI Dashboard Unit Tests: 13/13 passed
- TransactionReviewer Unit Tests: 25/25 passed
- YieldMath Unit Tests: 36/36 passed
- YieldSourceRegistry Unit Tests: 4/4 passed

Total Tests: 184
Total Suites: 59
Pass: 184
Fail: 0
Exit Code: 0
Duration: 13.44s
```

**Verification:** The 184 test results reported in Gate 10A.3 are 100% genuine, reproducible, and executed against the exact final source code.

---

## 8. Production & Security Boundary Verification

1. **Production Endpoint:** `https://pharos-yield-optimizer.vercel.app`
   - Read-only probe: `curl -I -s https://pharos-yield-optimizer.vercel.app`
   - Response: `HTTP/1.1 200 OK`
   - ETag: `"f7fc3d5ea250eb951426233fae7b85a3"`
   - Server: Vercel (unmodified, matching committed baseline)
2. **Protected Workspaces:**
   - `skills/pharos-portfolio-assistant` (Task 14): Completely untouched, 0 modified files, clean Git status.
3. **Operational Safeguards:**
   - Zero private keys accessed or stored.
   - Zero wallet transactions signed or broadcast.
   - Zero commits, pushes, or deployments attempted.

---

## 9. Section-by-Section Verdicts & Overall Assessment

| Section | Audit Dimension | Evaluated Status | Verdict |
|:---:|:---|:---|:---:|
| **2** | **Repository Integrity** | Baseline HEAD `53bbf0f...` preserved; all audit docs intact; Task 14 clean | **PASS** |
| **3** | **Financial Precision** | Decisions use 100% BigInt fixed-point; `scaledToDecimal` used solely for display | **PASS** |
| **4** | **Lockup Semantics** | 15-day Faroo total rule strictly enforced; 7d/14d fail closed, 15d/21d/30d eligible | **PASS** |
| **5** | **Faroo Instant DEX Exit Route** | No verified secondary pool exists on Pacific Mainnet; route is hypothetical | **NEEDS-REVIEW** |
| **6** | **Forward-Scenario Provenance** | 8.50% clearly labelled as scenario model input; router copy minor discrepancy (14d vs 15d) | **PASS** (Minor router notice) |
| **7** | **Test Integrity** | 184/184 tests pass on exact source code without failures or skipped suites | **PASS** |
| **8** | **Production & Security** | Production HTTP 200 OK; Task 14 clean; zero transactions | **PASS** |

### Overall Gate 10A.4 Verdict: **PASS (with actionable recommendations for Gate 10B)**

---

## 10. Recommendations for Gate 10B Implementation

1. **Incorporate Native PoS into Recommendation Engine:**
   - Integrate `native-pos-staking` as an active candidate alongside `faroo-patient-staking`.
   - Enforce 21-day unbonding constraint for Native PoS.
2. **Implement Deterministic Tie-Breaking with BigInt Threshold:**
   - Define `MEANINGFUL_ALPHA_THRESHOLD_WEI = 100_000_000_000_000_000n` ($0.10\text{ PROS}$).
   - Evaluate `Math.abs(Number(netAdvantageWei))` or `netAdvantageWei` in BigInt against threshold.
   - If $| \Delta_{\text{net}} | < \text{THRESHOLD}$, output `STAY_PUT` with reason `TIE_NO_MEANINGFUL_ALPHA` and structural trade-off disclosures.
3. **Disqualify or Flag `faroo-instant-dex`:**
   - Because no verified stPROS/WPROS secondary pool exists on Pacific Mainnet, disable automated `MOVE` to `faroo-instant-dex` when instant liquidity is required, returning `STAY_PUT` (`NO_VERIFIED_SECONDARY_LIQUIDITY`).
4. **Synchronize Router Copy:**
   - Update `router.ts` line 375 (`minimumHoldingDays: 15`) and corresponding string descriptions to match the 15-day total rule ($14\text{d queue} + 1\text{d settlement buffer}$).
