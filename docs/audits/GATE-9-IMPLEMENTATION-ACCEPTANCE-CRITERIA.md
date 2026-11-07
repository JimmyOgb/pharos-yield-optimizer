# PHAROS TASK 15 — GATE 9: IMPLEMENTATION ACCEPTANCE CRITERIA (REVISED GATE 9.3)

**Project:** Pharos Yield Optimizer  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Network:** Pharos Pacific Mainnet — Chain ID `1672` (`0x688`), RPC `https://rpc.pharos.xyz`  
**Accepted Baseline Commit:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`  
**Revision Date:** November 7, 2026 (Gate 9.3 Economic Re-Alignment)  
**Status:** Canonical Acceptance Framework for Phase 10 Implementation  

---

## 1. Overview & Verification Purpose

This document establishes the binding acceptance criteria for the implementation of the Three-Source Yield Optimizer on Pharos Pacific Mainnet. Every implementation pull request or commit must satisfy these criteria before being accepted into production.

---

## 2. Source Adapter Acceptance Criteria

### 2.1 Faroo Liquid Staking (`FarooAdapter`)
- [ ] **Contract Binding:** Strictly targets canonical proxy `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4` and verifies EIP-1967 implementation `0xfd59860894e01773e9780b0d1dfae4ca2b56708d`.
- [ ] **EVM Calls:** Successfully executes `totalAssets()` (`0x01e1d114`) and `totalSupply()` (`0x18160ddd`).
- [ ] **Exchange Rate Accrual:** Correctly parses and calculates $R_t = \text{totalAssets} / \text{totalSupply}$ scaled by $10^{18}$. Rejects 0 total supply or 0 pooled assets.
- [ ] **Exit Route Segregation & Empirical Proof:**
  - Strictly distinguishes **Patient 14-Day Protocol Redemption Queue** from **Instant AMM DEX Exit**.
  - Confirms that queries to FaroSwap V3 (`0x2c90...552b`) returned zero addresses for the four fee tiers (100, 500, 3000, 10000 bps), while for V2 (`0x18Fab...7B09`), `getPair` reverted with empty data (absence not conclusively established).
  - Disables the instant DEX exit route from active recommendations.
- [ ] **Hard 15-Day Lockup Constraint:**
  - Enforces mandatory 14-day protocol unbonding queue plus a 1-day block/keeper settlement buffer (**15 days total**).
  - Strictly marks Faroo stPROS as **ineligible for 7-day and 14-day investment horizons**.
  - Any 14-day projection figures are explicitly marked:
    > **INFORMATIONAL ONLY — NOT REALIZABLE WITHIN 14 DAYS (REQUIRES 15 DAYS TOTAL REDEMPTION & SETTLEMENT)**
- [ ] **Dual-Model Reporting:** Returns both historical trailing rate (26.14% APR) and conservative forward baseline scenario (`FORWARD_SCENARIO_ASSUMPTION_850_BPS`).
- [ ] **Quality Tag:** Returns status `QUALIFIED_LIVE`.

### 2.2 Pharos Native PoS Consensus Staking (`NativePosAdapter`)
- [ ] **Precompile Binding:** Strictly targets native precompile `0x4100000000000000000000000000000000000000`.
- [ ] **Risk Disclosure Accuracy:** Accurately states: *"No ERC-4626 wrapper or third-party staking-contract exposure; native protocol, precompile implementation, consensus, and validator-related risks remain."* Never claims native staking is risk-free.
- [ ] **Tuple Decoding:** Correctly decodes the full 9-word ABI return from `getDelegator(bytes32 poolId, address delegator)` (selector `0x3a6d6bae`).
- [ ] **Reward Accounting Invariant:**
  - Accrued unclaimed rewards (`word 3`) and cumulative claimed rewards (`word 7`) are independently verified.
  - Total earned rewards is strictly $\text{claimed} + \text{accrued}$.
  - Under zero circumstances are claimed and unclaimed rewards double-counted.
- [ ] **Unbonding State Invariant:**
  - Evaluates `isPendingUndelegate` (`word 8`).
  - Correctly flags that pending unbonding stake stops earning rewards.
  - Enforces mandatory 21-day unbonding epoch lockup.
  - Strictly marks Native PoS as **ineligible for 7-day and 14-day investment horizons**.
- [ ] **Dual-Model Reporting:** Returns both historical trailing rate (29.98% APR) and conservative forward baseline scenario (`FORWARD_SCENARIO_ASSUMPTION_850_BPS`).
- [ ] **Quality Tag:** Returns status `QUALIFIED_LIVE`.

### 2.3 FaroSwap Uniswap V3 LP (`FaroSwapV3Adapter`)
- [ ] **Pool Binding:** Strictly targets pool `0x4146d192da6428c9e1c243d2a953c625b5765623` and verifies token0 `0x52C4...F0B0` (WPROS), token1 `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` (USDC), and fee tier 3,000 (0.30%).
- [ ] **State Queries:** Reads `slot0()` (`0x3850c7bd`), `liquidity()` (`0x1a684340`), `feeGrowthGlobal0X128()` (`0xf3058399`), and `feeGrowthGlobal1X128()` (`0x46141319`).
- [ ] **Default Full-Range Benchmark:**
  - Uses the **Standard Full-Range Position ($[-887220, 887220]$)** yielding **6.26% APR** as the default benchmark.
  - Displays **Pool-Level Fee APR (15.56%)** separately as the aggregate trading volume activity indicator.
  - Does NOT present concentrated-range APR (71.87%) as the default yield assumption.
- [ ] **Friction Deductions:** Deducts 3.00 PROS round-trip swap fees (0.30% entry + 0.30% exit on 50% USDC capital) and ~740k gas from net returns.
- [ ] **Breakeven Horizon Disclosure:** Explicitly discloses the **17.53-day breakeven horizon**.
- [ ] **Risk Disclosures:** Attaches explicit disclosures for 50% USD exposure and impermanent loss.
- [ ] **Actionable Recommendation Rule:** Disables automated `MOVE` recommendations to LP by default; displays source for comparative transparency.
- [ ] **Quality Tag:** Returns status `QUALIFIED_WITH_DISCLOSURE`.

---

## 3. Recommendation Engine Acceptance Criteria

### 3.1 Horizon & Lockup Filtering (Gate 9.3 Invariants)
- [ ] **7-Day Horizon:**
  - Native PoS is strictly disqualified (21-day lockup > 7 days).
  - Faroo Patient Queue is strictly disqualified (15-day total settlement > 7 days).
  - FaroSwap LP is net negative ($-1.81$ PROS net; breakeven is 17.53 days).
  - **Required Output:** Strictly outputs `STAY_PUT` (Native PROS Baseline) with reason `LOCKUP_EXCEEDS_HORIZON_FOR_ALL_QUALIFIED_SOURCES`.
- [ ] **14-Day Horizon:**
  - Native PoS is strictly disqualified (21-day lockup > 14 days).
  - Faroo Patient Queue is strictly disqualified (15-day total settlement > 14 days).
  - FaroSwap LP is net negative ($-0.61$ PROS net).
  - **Required Output:** Strictly outputs `STAY_PUT` (Native PROS Baseline). 14-day figures are badged informational only.
- [ ] **30-Day & 90-Day Horizons (Historical Model):**
  - Native PoS Staking is fully unlocked and provides maximum net return (+24.64 PROS at 30d, +73.92 PROS at 90d on 1,000 PROS).
  - **Required Output:** Recommends `MOVE` to Native PoS Staking.
- [ ] **30-Day & 90-Day Horizons (Forward Scenario Model):**
  - Faroo ($+6.9837$) and Native PoS ($+6.9844$) differ by an imperceptible $0.0007\text{ PROS}$, falling below the $0.10\text{ PROS}$ meaningful-alpha threshold.
  - **Required Output:** Standardizes on `TIE_NO_MEANINGFUL_ALPHA`. Engine does NOT claim Native PoS is financially superior.
    - If user already holds Faroo or PoS: outputs `STAY_PUT`.
    - If deploying from baseline: presents both as tied choices under threshold with structural trade-off disclosures (PoS = no wrapper exposure, 21d unbond; Faroo = 15d unbond, EIP-1967 proxy risk).

### 3.2 Decision Soundness
- [ ] **Dual-Model Support:** Allows user to toggle between **Historical-Rate Scenario** and **Conservative Forward-Rate Scenario** without altering underlying on-chain state.
- [ ] **Minimum Alpha Threshold:** Requires at least $0.10\text{ PROS}$ net advantage over the current position before recommending `MOVE`.
- [ ] **Data Freshness Guard:** Returns `INSUFFICIENT_DATA` if observation timestamp is older than 10 minutes or RPC call fails.

---

## 4. Transaction Reviewer & Safety Acceptance Criteria

### 4.1 Non-Custodial Boundaries
- [ ] **Zero Private Key Code:** No signing functions, wallet imports, or mnemonic handling code exists in the repository.
- [ ] **Unsigned Calldata Payloads:** All transaction steps return unsigned JSON payloads (`to`, `data`, `value`, `gasLimit`, `chainId: 1672`).
- [ ] **Chain ID Enforcement:** Every unsigned payload strictly includes `chainId: 1672`.

### 4.2 Calldata Accuracy
- [ ] **Faroo Staking:** Correctly formats 3-step sequence (Wrap $\to$ Approve $\to$ Deposit).
- [ ] **Native PoS Delegation:** Correctly formats `delegate(bytes32 poolId)` with `msg.value` equal to the user's principal in wei.
- [ ] **Receiver Validation:** Rejects zero address `0x0000000000000000000000000000000000000000` and malformed strings.

---

## 5. UI / UX Acceptance Criteria

### 5.1 Three Yield Source Presentation
- [ ] **Source Cards:** Renders three distinct cards for Faroo stPROS, Native PoS Staking, and FaroSwap V3 LP.
- [ ] **Quality Badges:**
  - Faroo stPROS displays `QUALIFIED_LIVE` (Green) + `15-Day Settlement` (Amber).
  - Native PoS displays `QUALIFIED_LIVE` (Green) + `21-Day Lockup` (Amber).
  - FaroSwap V3 LP displays `QUALIFIED_WITH_DISCLOSURE` (Amber) + `Dual-Asset LP & IL` (Purple).
- [ ] **Model Toggle:** Interactive selector between Historical Trailing Scenario and Conservative Forward Baseline (`FORWARD_SCENARIO_ASSUMPTION_850_BPS`).
- [ ] **Comparison Matrix:** Clear table displaying Gross APR, Total Friction, Net Return, Lockup, and Net Alpha across all three sources.

---

## 6. Test Suite & Verification Criteria

- [ ] **Unit Tests:** All existing 123 unit tests continue to pass without regression.
- [ ] **New Tests:** Comprehensive unit tests added for `NativePosAdapter`, `FaroSwapV3Adapter`, hard 15-day Faroo guard, forward tie-breaking (`TIE_NO_MEANINGFUL_ALPHA`), and updated decision matrix (target: $\ge 150$ total unit tests).
- [ ] **Zero Mocking of Live Results:** Unit test fixtures are explicitly labeled as mock test vectors and never represented as live chain evidence.
- [ ] **Production Build:** `npm run build` succeeds cleanly with zero TypeScript errors.
