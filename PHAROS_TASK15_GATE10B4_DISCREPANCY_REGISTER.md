# PHAROS TASK 15 — GATE 10B.4 DISCREPANCY REGISTER
## Comprehensive Discrepancy & Anomaly Register for Pharos Yield Optimizer

**Audit Date:** November 7, 2026  
**Auditor:** Antigravity Autonomous Audit Agent  
**Repository:** `skills/pharos-yield-optimizer` (HEAD `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`)  
**Production URL:** `https://pharos-yield-optimizer.vercel.app`  

---

## 1. Discrepancy Summary Table

| Finding ID | Severity | Affected Area / Subject | Summary Description | Risk Assessment | Recommended Action |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **DISC-01** | **MEDIUM** | Chat Assistant Report (Step 1904) | Truncated phantom address `0x5216...ea34` reported in chat text table instead of Faroo proxy `0x6b0A...5Ec4`. | None to production; confusion in conversational reviews. | Document that production code and API have always used `0x6b0A...5Ec4`. |
| **DISC-02** | **MEDIUM** | Chat Assistant Report (Step 1904) | Phantom rate `12.00%` reported for Native PoS in chat text table instead of actual deployed `29.98%` historical / `8.5%` scenario. | None to production; confusion in conversational reviews. | Clarify actual on-chain rates in official documentation. |
| **DISC-03** | **MEDIUM** | Chat Assistant Report (Step 1904) | Phantom rate `18.50%` reported for FaroSwap in chat text table instead of actual deployed `6.26%` benchmark / `15.56%` turnover. | None to production; confusion in conversational reviews. | Clarify actual on-chain rates in official documentation. |
| **DISC-04** | **LOW** | Frontend Metric Card Labeling (`app.js`) | Metric card header displays `"Advertised / Target APY"` for historical consensus and LP benchmark rates. | Low; value text contains `(Historical Realized APR)` and `(Full-Range LP Benchmark APR)`. | Refine label ternary in `app.js` during next authorized UI update. |
| **DISC-05** | **LOW** | UI Dynamic Array Display (`app.js`) | `src.riskDisclosures` array from `/api/sources` is not iterated in UI cards (only `src.exclusionReason` is shown). | Low; disclosures are fully visible in modal reviewer and API. | Expose bulleted `riskDisclosures` inside the source card. |
| **DISC-06** | **INFORMATIONAL** | Acceptance Criterion Interpretation | Monitored sources = 3; Actionable rebalancing destinations = 1. Acceptance status differs between monitoring vs rebalancing. | Neutral; disclosures explicitly report 1 actionable and 2 informational. | Maintain transparent multi-source coverage disclosure. |

---

## 2. Detailed Item-by-Item Analysis

### DISC-01: Faroo Proxy Address Discrepancy (`0x6b0A...5Ec4` vs `0x5216...ea34`)
- **Finding ID:** `DISC-01`
- **Severity:** Medium (Reporting anomaly; Zero runtime impact)
- **Affected Subject:** Gate 10B.3 chat summary response (Step 1904)
- **Expected Behavior:** All reports, logs, and summaries must consistently cite the verified Faroo stPROS proxy address: `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`.
- **Actual Observed Behavior:** The assistant's conversational response at Step 1904 included an abbreviated table row stating `| Faroo stPROS Contract | 0x5216...ea34 |`.
- **Empirical Evidence & Provenance:**
  1. `src/adapters/farooAdapter.ts` (line 23): `export const FAROO_STPROS_PROXY = '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4';`
  2. `api/sources.js` (lines 304, 328, 695): References `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`.
  3. `PHAROS_TASK15_GATE10B3_RELEASE_REPORT.md` (line 45): `| **Faroo Liquid Staking** | 0x6b0A...5Ec4 (Proxy) |`
  4. `PHAROS_TASK15_GATE10B3_PRODUCTION_VERIFICATION.md` (line 114): `"contractAddress": "0x6b0A44c64190279f7034b77c13a566E914FE5Ec4"`
  5. Live production `https://pharos-yield-optimizer.vercel.app/api/sources` returns `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`.
  6. Git history search (`git log -S "5216"`) returned zero results.
- **Root Cause:** A typographical hallucination occurred during chat summary rendering at Step 1904. The string was likely an unintended blend with the canonical WPROS address (`0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`).
- **Risk Assessment:** No risk to live production execution, smart contract safety, or API users.
- **Recommended Smallest Correction:** Formally record in this audit that `0x5216...ea34` was a conversational typo and that production has always used the correct proxy `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`. No code changes needed.
- **Requires Separate Authorization:** No code modification required.

---

### DISC-02: Native PoS 12.00% Provenance (Phantom Chat Value)
- **Finding ID:** `DISC-02`
- **Severity:** Medium (Reporting anomaly; Zero runtime impact)
- **Affected Subject:** Gate 10B.3 chat summary response (Step 1904)
- **Expected Behavior:** Chat summary tables should mirror the actual production `/api/sources` payload (`29.98% Historical Realized APR` and `8.5% Forward Scenario`).
- **Actual Observed Behavior:** The chat summary table at Step 1904 listed `native-pos-staking: APY 12.00%`.
- **Empirical Evidence & Provenance:**
  1. Production `/api/sources` returns:
     - `liveRate`: `"29.98% (Historical Realized APR)"`
     - `forwardScenarioRate`: `"8.5% (Forward Scenario)"`
  2. `src/adapters/nativePosAdapter.ts` (lines 291 & 302): Defines `29.98%` (historical delegator APR over 3.80 days) and `8.5%` (macro scenario).
  3. `12.00%` does not exist in any Native PoS code, config, or endpoint. (In Gate 1B, `10.50% - 12.00%` was discussed for an off-chain credit vault `APC3M`).
- **Root Cause:** Assistant chat summary hallucination at Step 1904.
- **Risk Assessment:** Zero risk to users or production calculations because Native PoS is informational (`isActionable: false`) and 12.00% is never fed into any math calculation.
- **Recommended Smallest Correction:** Preserve the true on-chain figures (`29.98%` historical / `8.5%` scenario) in documentation and release reports.

---

### DISC-03: FaroSwap V3 18.50% Provenance (Phantom Chat Value)
- **Finding ID:** `DISC-03`
- **Severity:** Medium (Reporting anomaly; Zero runtime impact)
- **Affected Subject:** Gate 10B.3 chat summary response (Step 1904)
- **Expected Behavior:** Chat summary tables should mirror the actual production `/api/sources` payload (`6.26% Full-Range LP Benchmark APR` and `15.56% Pool Turnover APR`).
- **Actual Observed Behavior:** The chat summary table at Step 1904 listed `faroswap-wpros-usdc-lp: estimated APY 18.50%`.
- **Empirical Evidence & Provenance:**
  1. Production `/api/sources` returns:
     - `liveRate`: `"6.26% (Full-Range LP Benchmark APR)"`
     - `poolTurnoverApr`: `"15.56% (Pool Turnover APR)"`
  2. `src/adapters/faroSwapV3Adapter.ts` (lines 272-273): Defines `15.56%` turnover APR and `6.26%` full-range benchmark APR.
  3. `18.50%` does not exist in any FaroSwap code, config, or endpoint.
- **Root Cause:** Assistant chat summary hallucination at Step 1904.
- **Risk Assessment:** Zero risk to users or production calculations because FaroSwap is informational (`isActionable: false`) and 18.50% is never fed into any math calculation.
- **Recommended Smallest Correction:** Preserve the true on-chain figures (`6.26%` benchmark / `15.56%` turnover) in documentation and release reports.

---

### DISC-04: Frontend Metric Card Labeling (`app.js`)
- **Finding ID:** `DISC-04`
- **Severity:** Low (Cosmetic UI Labeling)
- **Affected Subject:** `src/ui/app.js` and `public/app.js` (lines 289-290)
- **Expected Behavior:** Metric card labels should distinguish between spot exchange rates, forward assumptions, historical realized rates, and pool benchmarks.
- **Actual Observed Behavior:** The label logic uses:
  ```javascript
  ${src.liveRateUnit && src.liveRateUnit.includes('per') ? 'On-Chain Spot Rate' : 'Advertised / Target APY'}
  ```
  Consequently, Native PoS (`"Historical Consensus Realized APR"`) and FaroSwap (`"Full-Range LP Benchmark APR"`) display the label `"Advertised / Target APY"` above their metric value.
- **Mitigating Factor:** The value text itself explicitly states `29.98% (Historical Realized APR)` and `6.26% (Full-Range LP Benchmark APR)`, and the cards feature prominent warning boxes explaining their restricted entry and informational status.
- **Recommended Smallest Correction:** When authorized in a future UI gate, update the ternary in `app.js` to:
  ```javascript
  ${src.liveRateUnit?.includes('per') ? 'On-Chain Spot Rate' : src.liveRateUnit?.includes('Benchmark') ? 'LP Benchmark APR' : src.liveRateUnit?.includes('Historical') ? 'Historical Realized APR' : 'Advertised / Target APY'}
  ```
- **Requires Separate Authorization:** Yes (requires modifying `src/ui/app.js` and redeploying).

---

### DISC-05: Source Card Risk Disclosures Display
- **Finding ID:** `DISC-05`
- **Severity:** Low (UI Presentation Depth)
- **Affected Subject:** `src/ui/app.js` (`renderSources()`)
- **Expected Behavior:** All `riskDisclosures` returned in `/api/sources` should be visible directly on the cards.
- **Actual Observed Behavior:** `renderSources()` renders `src.exclusionReason` in an amber box, but does not render the bulleted `src.riskDisclosures` array on the card.
- **Mitigating Factor:** Risk disclosures are fully rendered inside the transaction reviewer modal and returned in the `/api/sources` JSON payload.
- **Recommended Smallest Correction:** In a future UI enhancement, map over `src.riskDisclosures` inside `renderSources()`.
- **Requires Separate Authorization:** Yes.

---

### DISC-06: Three-Source Qualifying Criterion Status
- **Finding ID:** `DISC-06`
- **Severity:** Informational / Architectural
- **Affected Subject:** Acceptance status across `/api/sources` and `/api/recommendation`
- **Expected Behavior:** Coherent definition of the "Three Qualifying Sources" requirement.
- **Actual Observed Behavior:**
  - `/api/sources` reports: `isThreeSourceRequirementMet: true` (based on monitoring 3 distinct on-chain protocols on Pacific Mainnet: Faroo stPROS, Native PoS Precompile, and FaroSwap V3 Pool).
  - `/api/recommendation` disclosures state: `FEWER_THAN_THREE_QUALIFYING_SOURCES: Requirement not met (1 verified on-chain, 0 execution alternatives counted toward requirement).`
- **Evidence & Provenance:**
  On Pharos Pacific Mainnet, only **1 single-asset liquid staking protocol with permissionless retail entry** exists (Faroo stPROS). Native PoS lacks a public retail staking contract, and FaroSwap is a dual-asset LP.
- **Risk Assessment:** No risk of financial loss. The recommendation engine safely refuses to recommend non-actionable or unbacked sources.
- **Recommended Action:** Preserve both disclosures transparently: confirm that 3 sources are actively monitored via RPC, but only 1 qualifies as an automated single-asset PROS rebalancing destination.
