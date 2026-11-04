# Gate 4: Calculation Assumption & Empirical Audit Report

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**Audit Date:** November 3, 2026  
**Auditor:** Antigravity AI  
**Status:** AUDIT COMPLETE — ASSUMPTIONS RIGOROUSLY DOCUMENTED

---

## 1. Executive Summary

In accordance with Gate 4 instructions, every calculation assumption utilized in Gate 3 was audited against live on-chain observations, protocol bytecode, and official documentation.

This report establishes the precise boundary between **verified empirical measurements**, **documented protocol parameters**, and **analytical assumptions**.

---

## 2. Comprehensive Assumption Audit Matrix

### 2.1 Item A: Forward Yield Assumption (~8.50% Gross APR)
- **Gate 3 Formulation:** Projected forward return was modeled as $\approx 8.50\%$ gross APR ($850\text{ bps}$).
- **Audit Finding:**
  - On-chain observation across 100k blocks revealed a short-term trailing rate of $+0.1013\%$ ($30.37\%$ annualized over 29.2 hours).
  - This $30.37\%$ was an episodic bootstrapping spike.
  - The $8.50\%$ figure is the **documented consensus PoS network emission target** published in official Pharos documentation.
- **Audit Rectification & Status:**
  - **Status:** **`OFFICIAL_DOCUMENTATION_ASSUMPTION`**.
  - **Policy:** The UI and reports must explicitly label $8.50\%$ as a **documented protocol target baseline**, NOT a guaranteed or live-measured forward APR. Forward staking yield is subject to total network staked PROS dilution and validator performance.

---

### 2.2 Item B: Gas Price Assumption (1.25 Gwei vs. Live 10.0 Gwei)
- **Gate 3 Formulation:** Used static benchmark of $1.25\text{ Gwei}$.
- **Audit Finding:**
  - Live query to `https://rpc.pharos.xyz` (`eth_gasPrice` and `baseFeePerGas`) returned **`10.0 Gwei`** (`0x2540be400` = $10^{10}\text{ wei}$).
  - A static gas assumption fails to account for network congestion or fee market shifts.
- **Audit Rectification & Status:**
  - **Status:** **`CORRECTED WITH LIVE RPC OBSERVATION`**.
  - **Implementation:** `LiveRecommendationBridge` now queries live `eth_gasPrice` dynamically. If live gas observations are unavailable or stale, the engine emits `INSUFFICIENT_DATA` rather than silently defaulting to $1.25\text{ Gwei}$.

---

### 2.3 Item C: Break-Even Horizon Analysis (1.5 Minutes vs. 14-Day Lockup)
- **Gate 3 Formulation:** Reported $\tau_{\text{breakeven}} \approx 0.001\text{ days}$ ($\approx 1.5\text{ minutes}$) for 1,000 PROS in Faroo Patient Staking.
- **Audit Finding & Clarification:**
  - **What It Measures:** Cost recovery break-even measures the exact elapsed time for gross yield accrual to equal upfront network gas friction ($0.00025\text{ PROS}$ at 1.25 Gwei, or $0.00200\text{ PROS}$ at 10.0 Gwei).
  - **Crucial Distinction:** **Cost Recovery $\neq$ Liquidity Unlock.**
  - Even though capital achieves net-positive yield after 12 minutes of live staking, the user **CANNOT withdraw funds** until completing the mandatory **14-day protocol unbonding queue**.
- **Audit Rectification & Status:**
  - **Policy:** The engine strictly enforces $T \ge 14\text{ days}$ regardless of how fast gas friction is recovered. If a user inputs $T = 7\text{ days}$, the engine outputs `STAY_PUT` with reason `HORIZON_SHORTER_THAN_LOCKUP`.

---

### 2.4 Item D: Exit Costs (0.30% Fee and 0.10% Slippage)
- **Gate 3 Formulation:** Modeled Faroo Instant DEX Exit with $0.30\%$ swap fee and $0.10\%$ slippage.
- **Audit Finding:**
  - $0.30\%$ ($30\text{ bps}$) is the verified Uniswap V4 pool fee tier deployed in the core bytecode.
  - $0.10\%$ slippage is an empirical heuristic valid for retail trade sizes ($P \le 5,000\text{ PROS}$). For larger institutional trades ($P > 100,000\text{ PROS}$), price impact will exceed $0.10\%$ unless pool depth expands.
- **Audit Rectification & Status:**
  - **Status:** **`FEE VERIFIED ON-CHAIN; SLIPPAGE LABELED HEURISTIC`**.
  - **Policy:** The engine labels the $0.30\%$ fee as `VERIFIED_ONCHAIN` and slippage as `ESTIMATED`.

---

### 2.5 Item E: Historical Exchange-Rate Trailing Annualization
- **Gate 3 Formulation:** Annualized the 29.2-hour exchange-rate delta to $30.37\%$.
- **Audit Finding:**
  - Extrapolating a 1-day exchange-rate observation to 365 days is statistically dangerous if presented as a forward yield expectation.
- **Audit Rectification & Status:**
  - **Policy:** `annualizeTrailingRate()` in `yieldMath.ts` has a hardcoded guard: any observation window $< 7\text{ days}$ attaches an explicit, non-bypassable warning notice:  
    *"Observation window (< 168h) reflects early episodic reward indexing. It is NOT a sustainable forward APY."*
  - The recommendation engine strictly uses the normalized equilibrium target ($\approx 8.50\%$) for forward rebalancing decisions.

---

## 3. Summary of Corrections Applied in Gate 4

| Calculation Component | Gate 3 Baseline | Gate 4 Rectified Implementation | Evidence Classification |
| :--- | :--- | :--- | :--- |
| **Network Gas Price** | Static $1.25\text{ Gwei}$ | Live `eth_gasPrice` ($10.0\text{ Gwei}$) | `VERIFIED_ONCHAIN` |
| **Faroo Exchange Rate** | Historical snapshot | Live `totalPooledPros / totalSupply` | `VERIFIED_ONCHAIN` |
| **Cost Recovery vs. Lockup** | Disclosed together | Formally decoupled in UI and logic | `RULE_ENFORCED` |
| **DEX Fee Tier** | Documented parameter | Deployed PoolManager verified | `VERIFIED_ONCHAIN` |
| **DEX Dynamic LP APR** | Unmodeled | Stamped strictly `UNAVAILABLE` | `TRANSPARENT_GAP` |
