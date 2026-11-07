# GATE 10A.3: MATH AND LOCKUP BOUNDARY CORRECTIONS AUDIT REPORT

**Project:** Pharos Yield Optimizer  
**Workspace:** `skills/pharos-yield-optimizer`  
**Network:** Pharos Pacific Mainnet — Chain ID `1672` (`0x688`)  
**RPC Endpoint:** `https://rpc.pharos.xyz`  
**Accepted Baseline Commit:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`  
**Production URL:** `https://pharos-yield-optimizer.vercel.app`  
**Audit Gate:** Gate 10A.3 (Defect Remediation & Regression Verification)  
**Date:** November 7, 2026  

---

## 1. Executive Summary

During the Gate 10A.2 audit, two discrete implementation defects were identified in the pre-existing baseline recommendation engine and yield math modules:
1. **`scaledToDecimal` Negative BigInt Defect:** In `src/engine/yieldMath.ts`, BigInt division remainder `valueScaled % scale` returned a negative BigInt when `valueScaled < 0n`, resulting in malformed string interpolations such as `"-2.-370269..."` which JavaScript parsed as `NaN`.
2. **Faroo Patient Staking Minimum Lockup Boundary Defect:** In `src/engine/recommendationEngine.ts`, `STRATEGY_PROFILES['faroo-patient-staking']` had `lockupPeriodDays: 14` and `exitDelayDays: 14`, violating the mandatory Gate 9.1/9.2 economic acceptance rule requiring 15 days total ($14\text{d unbonding queue} + 1\text{d settlement safety buffer}$). Consequently, a 14-day user horizon incorrectly permitted automated `MOVE` recommendation when capital could not actually be redeemed and settled within 14 days.

Under explicit authorization for Gate 10A.3, both defects have been surgically corrected, and full regression test coverage has been established. All 184 tests (153 unit tests + 31 live integration & smoke tests) pass with zero errors. Repository baseline ancestry remains strictly preserved at commit `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`. Production remains untouched at HTTP 200 OK.

---

## 2. Pre-Edit Status & Scope Boundaries

### Authorized Scope
The authorization permitted modifications strictly to four files:
1. `src/engine/yieldMath.ts`
2. `src/engine/recommendationEngine.ts`
3. `tests/unit/recommendationEngine.test.ts`
4. `tests/unit/yieldMath.test.ts`

### Prohibited Scope
- Zero changes to Gate 10A adapters (`src/adapters/nativePosAdapter.ts`, `src/adapters/faroSwapV3Adapter.ts`, `src/adapters/yieldSourceRegistry.ts`).
- Zero changes to serverless functions, production build artifacts, or deployment configurations.
- Zero Git commits or pushes.
- Zero blockchain transactions, private key usage, or wallet signing.
- Zero modifications to Task 14 (`pharos-portfolio-assistant`).

---

## 3. Defect Analysis & Implemented Corrections

### 3.1 Correction A: `scaledToDecimal` Signed BigInt Scaling

#### Root Cause
In JavaScript BigInt arithmetic, the remainder operator `%` preserves the sign of the dividend:
```ts
-2_370_269_263_698_630_137n % 10n**18n === -370_269_263_698_630_137n
```
The original implementation formatted the string as:
```ts
const integerPart = valueScaled / scale; // -2n
const fractionalPart = valueScaled % scale; // -370269...n
const fracStr = fractionalPart.toString().padStart(18, '0'); // "-370269..."
return Number(`${integerPart}.${fracStr}`); // Number("-2.-370269...") -> NaN
```

#### Implemented Fix (`src/engine/yieldMath.ts`)
The function now extracts the sign, computes absolute values for both integer and fractional components, formats the fractional component with 18 leading zeros, and prepends the sign:
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

#### Regression Tests (`tests/unit/yieldMath.test.ts`)
A dedicated test suite `Gate 10A.3 - Signed BigInt Scaling Regression Tests` with 10 comprehensive cases was added:
1. **Case 1 (Positive whole):** `2n * 1e18` $\to$ `2.0`
2. **Case 2 (Positive fractional):** `5e17` $\to$ `0.5`
3. **Case 3 (Zero):** `0n` $\to$ `0.0`
4. **Case 4 (Negative whole):** `-3n * 1e18` $\to$ `-3.0`
5. **Case 5 (Negative fractional):** `-5e17` $\to$ `-0.5`
6. **Case 6 (Negative whole + fractional):** `-2_370_269_263_698_630_137n` $\to$ `-2.37026926369863`
7. **Case 7 (Negative exact fractional):** `-1.5 PROS`, `-1 - 1 wei`, and `-1.0000000001` verified without `NaN`
8. **Case 8 (Extreme magnitudes):** $\pm 283,924,850\text{ PROS} \times 10^{18}$ scaled accurately
9. **Case 9 (Friction > Gross Yield):** Net gain $-2.3704\text{ PROS}$ evaluated accurately
10. **Case 10 (Net gain exactly zero):** Gross yield equals friction $\to$ `0.0`

---

### 3.2 Correction B: Faroo Patient Staking 15-Day Lockup Boundary

#### Root Cause
Gate 9.1 and 9.2 established that Faroo Liquid Staking requires 14 days in the unbonding queue plus a mandatory 1-day settlement safety buffer ($14 + 1 = 15$ days total). Capital cannot be returned to the user within a 14-day horizon. The engine previously had `lockupPeriodDays: 14`, allowing a 14-day query to trigger `MOVE`.

#### Implemented Fix (`src/engine/recommendationEngine.ts`)
1. Updated `STRATEGY_PROFILES['faroo-patient-staking']`:
   - `lockupPeriodDays: 15`
   - `exitDelayDays: 15`
2. Updated user explanation strings to explicitly disclose the 15-day total requirement:
   ```ts
   `Investment horizon (${query.horizonDays} days) is shorter than mandatory protocol lockup/unbonding periods (15 days total: 14-day queue + 1-day settlement buffer).`
   ```

#### Regression Tests (`tests/unit/recommendationEngine.test.ts`)
1. **7-Day Horizon:** Confirmed `STAY_PUT` with reason `HORIZON_SHORTER_THAN_LOCKUP`.
2. **14-Day Horizon:** Confirmed `STAY_PUT` with reason `HORIZON_SHORTER_THAN_LOCKUP` (14 days < 15-day total requirement).
3. **15-Day Horizon:** Exactly meets boundary $\to$ Confirmed `MOVE` to `faroo-patient-staking` (+3.4928 PROS net advantage).
4. **21-Day Horizon:** Confirmed `MOVE` to `faroo-patient-staking` (+4.8900 PROS net advantage).
5. **Negative Net Gain Projection Guard:** Confirmed that `faroo-instant-dex` over 10 days generates `netGainPros: -1.671233` (valid negative number, `Number.isNaN === false`) and triggers `STAY_PUT`.

---

## 4. Horizon Sensitivity Matrix Verification

A 1,000 PROS allocation query evaluated across the horizon spectrum yields deterministic, economically accurate results:

| Horizon | Liquidity Constraint | Primary Eligible Strategy | Net Advantage (PROS) | Decision | Reason Code |
|:---|:---:|:---:|:---:|:---:|:---|
| **1 Day** | Flexible | None ($1\text{d} < 15\text{d}$) | 0.0000 | `STAY_PUT` | `HORIZON_SHORTER_THAN_LOCKUP` |
| **7 Days** | Flexible | None ($7\text{d} < 15\text{d}$) | 0.0000 | `STAY_PUT` | `HORIZON_SHORTER_THAN_LOCKUP` |
| **10 Days** | Instant Required | `faroo-instant-dex` | -1.6712 (Gross 2.33 - Friction 4.00) | `STAY_PUT` | `FRICTION_EXCEEDS_GROSS_YIELD` |
| **14 Days** | Flexible | None ($14\text{d} < 15\text{d}$) | 0.0000 | `STAY_PUT` | `HORIZON_SHORTER_THAN_LOCKUP` |
| **15 Days** | Flexible | `faroo-patient-staking` | +3.4928 (Gross 3.4931 - Gas 0.0003) | `MOVE` | `POSITIVE_NET_ALPHA` |
| **21 Days** | Flexible | `faroo-patient-staking` | +4.8900 (Gross 4.8904 - Gas 0.0003) | `MOVE` | `POSITIVE_NET_ALPHA` |
| **30 Days** | Flexible | `faroo-patient-staking` | +6.9859 (Gross 6.9863 - Gas 0.0003) | `MOVE` | `POSITIVE_NET_ALPHA` |
| **60 Days** | Flexible | `faroo-patient-staking` | +13.9723 (Gross 13.9726 - Gas 0.0003) | `MOVE` | `POSITIVE_NET_ALPHA` |
| **180 Days** | Flexible | `faroo-patient-staking` | +41.9175 (Gross 41.9178 - Gas 0.0003) | `MOVE` | `POSITIVE_NET_ALPHA` |

---

## 5. Test Suite & Verification Results

### 5.1 Typecheck
```
npm run typecheck
> pharos-yield-optimizer@0.1.0 typecheck
> tsc --noEmit
Result: 0 errors
```

### 5.2 Unit Test Execution
```
npm run test:unit
Result:
ℹ tests 153
ℹ suites 48
ℹ pass 153
ℹ fail 0
ℹ duration_ms 2952.9ms
```

### 5.3 Full Integration & Smoke Suite Execution
```
npm test
Result:
ℹ tests 184
ℹ suites 59
ℹ pass 184
ℹ fail 0
ℹ duration_ms 15376.7ms
```

---

## 6. Repository Integrity & Production Status

1. **Local HEAD:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec` (matches accepted baseline).
2. **Git Working Tree:**
   - Modified tracked files:
     - `src/engine/yieldMath.ts` (Correction A)
     - `src/engine/recommendationEngine.ts` (Correction B)
     - `tests/unit/yieldMath.test.ts` (10 regression tests)
     - `tests/unit/recommendationEngine.test.ts` (14d/15d/21d horizon & non-NaN checks)
     - Gate 10A files: `src/adapters/farooAdapter.ts`, `src/index.ts`, `src/types/index.ts`, `tests/unit/farooAdapter.test.ts`
   - Untracked files: Gate 10A new adapters (`nativePosAdapter.ts`, `faroSwapV3Adapter.ts`, `yieldSourceRegistry.ts`), tests, and audit documentation.
3. **Production Endpoint:** `https://pharos-yield-optimizer.vercel.app`
   - Status: HTTP 200 OK
   - ETag: `"f7fc3d5ea250eb951426233fae7b85a3"`
   - Server: Vercel (unmodified)
4. **Protected Workspaces:**
   - `skills/pharos-portfolio-assistant` (Task 14): HEAD `94ae95454dc38915bd74b394af472310e67e76c2`, status completely clean.
5. **Operational Safeguards:** Zero commits, zero pushes, zero deployments, zero blockchain write transactions.

---

## 7. Gate 10A.3 Conclusion & Sign-Off

Both defects identified during Gate 10A.2 have been completely resolved, mathematically validated, and locked in with automated tests:
- `scaledToDecimal` reliably handles negative, positive, and zero BigInts across all magnitudes without producing `NaN`.
- Faroo Patient Staking strictly enforces the 15-day unbonding and settlement horizon boundary ($14\text{d queue} + 1\text{d buffer}$).
- The codebase is clean, robust, and fully prepared for Gate 10B (Engine Rebalancing & Tie-Handling Rules).
