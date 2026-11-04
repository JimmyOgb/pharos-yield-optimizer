# GATE 7A.6 — SCENARIO REGRESSION & NUMERICAL ANALYSIS
## Independent Verification of Scenarios A, B, and C Across Lifecycle Gas Models

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`, 18 Decimals)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Scenario Verification Overview

All three primary reference scenarios have been independently recalculated from first principles and verified against the execution logs of `tests/numericalVerification.ts`, `tests/integration/vercelAdapter.test.ts`, and the live engine:

- **Scenario A (MOVE):** Standard long-term patient investor (1,000 PROS, 60 days, patient queue exit).
- **Scenario B (STAY_PUT):** Short-horizon investor constrained by protocol lockup (1,000 PROS, 7 days vs 14-day queue).
- **Scenario C (STAY_PUT):** Short-horizon instant liquidity investor dominated by swap friction (1,000 PROS, 1 day, instant DEX exit).

All financial calculations assume:
- **Base Gas Price:** $1.25\text{ Gwei}$ ($1.25 \times 10^{-9}\text{ PROS/gas unit}$).
- **Offline Fallback Gas Price:** $10.0\text{ Gwei}$ ($10.0 \times 10^{-9}\text{ PROS/gas unit}$).
- **Forward APY:** $8.50\%$ ($850\text{ bps}$).
- **Asset Precision:** 18 decimals ($10^{18}\text{ wei} = 1\text{ PROS}$).

---

## 2. In-Depth Scenario Breakdown

### Scenario A — Standard Patient Staking (60 Days)
- **Principal:** $1,000\text{ PROS}$ ($1,000 \times 10^{18}\text{ wei}$)
- **Horizon:** $60\text{ days}$
- **Exit Pathway:** Faroo Unbonding Queue (14-day protocol lockup)
- **Gas Model:** **265,000 lifecycle gas units** (180,000 entry + 85,000 exit queue)

$$\text{Gross Yield} = \frac{1,000 \times 0.085 \times 60}{365} = \mathbf{13.9726027\text{ PROS}}$$

$$\text{Entry Gas Cost (180k gas @ 1.25 Gwei)} = 180,000 \times 1.25 \times 10^{-9} = \mathbf{0.0002250\text{ PROS}}$$
$$\text{Exit Gas Cost (85k gas @ 1.25 Gwei)} = 85,000 \times 1.25 \times 10^{-9} = \mathbf{0.00010625\text{ PROS}}$$
$$\text{Protocol Entry Fee (0 bps)} = \mathbf{0.0000000\text{ PROS}}$$
$$\text{Protocol Exit Fee (0 bps)} = \mathbf{0.0000000\text{ PROS}}$$
$$\text{Slippage Cost (0 bps)} = \mathbf{0.0000000\text{ PROS}}$$
$$\text{Total Friction} = 0.0002250 + 0.00010625 = \mathbf{0.00033125\text{ PROS}}$$

$$\text{Net Expected Alpha} = 13.9726027 - 0.00033125 = \mathbf{+13.9722715\text{ PROS}}$$

$$\text{Daily Yield} = \frac{1,000 \times 0.085}{365} = 0.2328767\text{ PROS/day}$$
$$\text{Break-Even Days} = \frac{0.00033125}{0.2328767} \approx \mathbf{0.0014224\text{ days}} \approx \mathbf{122.9\text{ seconds}}$$
- **Formatted Break-Even:** **`"~2 mins (< 1 day)"`**
- **Recommendation:** **`MOVE`**
- **Reason Code:** **`POSITIVE_NET_ALPHA`**
- **Explanation:** Positive net alpha (+13.972272 PROS) expected after accounting for complete 265,000 lifecycle gas (0.000331 PROS).

---

### Scenario B — Lockup Constraint (7 Days)
- **Principal:** $1,000\text{ PROS}$ ($1,000 \times 10^{18}\text{ wei}$)
- **Horizon:** $7\text{ days}$
- **Exit Pathway:** Faroo Unbonding Queue
- **Gross Yield:** $\frac{1,000 \times 0.085 \times 7}{365} = 1.6301370\text{ PROS}$
- **Protocol Constraint Check:**
  - Selected Horizon: $7\text{ days}$
  - Mandatory Protocol Lockup: $14\text{ days}$
  - Condition: $\text{Horizon (7)} < \text{Lockup (14)}$
- **Alternative Instant Route Check:**
  - Instant DEX friction ($4.000406\text{ PROS}$) exceeds 7-day gross yield ($1.630137\text{ PROS}$).
- **Recommendation:** **`STAY_PUT`**
- **Reason Code:** **`HORIZON_SHORTER_THAN_LOCKUP`**
- **Explanation:** Investment horizon (7 days) is shorter than mandatory protocol lockup (14 days) for Faroo Patient Staking, and alternative instant DEX liquidity friction exceeds gross yield.

---

### Scenario C — Instant DEX Exit Route (1 Day)
- **Principal:** $1,000\text{ PROS}$ ($1,000 \times 10^{18}\text{ wei}$)
- **Horizon:** $1\text{ day}$
- **Exit Pathway:** Pharos DEX AMM Swap (Uniswap V4 pool)
- **Gas Model:** **325,000 lifecycle gas units** (180,000 entry + 145,000 assumed exit)

$$\text{Gross Yield} = \frac{1,000 \times 0.085 \times 1}{365} = \mathbf{0.2328767\text{ PROS}}$$

$$\text{Entry Gas Cost (180k gas @ 1.25 Gwei)} = 180,000 \times 1.25 \times 10^{-9} = \mathbf{0.0002250\text{ PROS}}$$
$$\text{Exit Gas Cost (145k gas @ 1.25 Gwei)} = 145,000 \times 1.25 \times 10^{-9} = \mathbf{0.00018125\text{ PROS}}$$
$$\text{Protocol Entry Fee (0 bps)} = \mathbf{0.0000000\text{ PROS}}$$
$$\text{DEX Swap Fee (30 bps)} = 1,000 \times 0.0030 = \mathbf{3.0000000\text{ PROS}}$$
$$\text{Slippage Cost (10 bps)} = 1,000 \times 0.0010 = \mathbf{1.0000000\text{ PROS}}$$
$$\text{Total Friction} = 0.0002250 + 0.00018125 + 3.00 + 1.00 = \mathbf{4.00040625\text{ PROS}}$$

$$\text{Net Expected Alpha} = 0.2328767 - 4.00040625 = \mathbf{-3.76752955\text{ PROS (NET LOSS)}}$$

$$\text{Break-Even Days} = \frac{4.00040625}{0.2328767} \approx \mathbf{17.178215\text{ days}}$$
- **Formatted Break-Even:** **`"17.18 days"`**
- **Recommendation:** **`STAY_PUT`**
- **Reason Code:** **`FRICTION_EXCEEDS_GROSS_YIELD`**
- **Explanation:** Total transaction friction and exit costs (4.000406 PROS) exceed expected gross yield (0.232877 PROS) over 1 day. Break-even requires 17.18 days.

---

## 3. Comparison with Pre-Gate 7A.5 Reports

The table below contrasts the current Gate 7A.6 verified metrics against the pre-Gate 7A.5 implementation:

| Metric / Parameter | Pre-Gate 7A.5 State | Gate 7A.6 Verified State | Mathematical Variance & Cause |
| :--- | :--- | :--- | :--- |
| **Scenario A Gas Units** | 200,000 gas units | **265,000 gas units** | $+65,000\text{ gas units}$ (Replaced 115k single-step with 180k 3-step ERC-4626) |
| **Scenario A Gas Cost (@ 1.25 Gwei)** | 0.0002500 PROS | **0.00033125 PROS** | $+0.00008125\text{ PROS}$ ($30.1\text{s}$ of yield) |
| **Scenario A Net Alpha** | $+13.972353\text{ PROS}$ | **$+13.972272\text{ PROS}$** | $-0.000081\text{ PROS}$ ($0.00058\%$ variance) |
| **Scenario A Break-Even** | `"0.00 days"` (or `92.7s`) | **`"~2 mins (< 1 day)"`** | Precision formatting eliminates zero-clamping loss |
| **Scenario A Decision** | `MOVE` | **`MOVE`** | Identical |
| **Scenario B Decision** | `STAY_PUT` | **`STAY_PUT`** | Identical (`HORIZON_SHORTER_THAN_LOCKUP`) |
| **Scenario C Gas Units** | 260,000 gas units | **325,000 gas units** | $+65,000\text{ gas units}$ (180k entry + 145k assumed exit) |
| **Scenario C Total Friction** | 4.0003250 PROS | **4.00040625 PROS** | $+0.00008125\text{ PROS}$ |
| **Scenario C Break-Even** | 17.177866 days | **17.178215 days** | $+0.000349\text{ days}$ ($30.2\text{ seconds}$) |
| **Scenario C Decision** | `STAY_PUT` | **`STAY_PUT`** | Identical (`FRICTION_EXCEEDS_GROSS_YIELD`) |

### Critical Finding on Economic Robustness
Despite unifying the gas model to the physical 265,000 and 325,000 gas benchmarks, all qualitative recommendations (`MOVE`, `STAY_PUT`, `STAY_PUT`) and quantitative reason codes remain 100% consistent. This demonstrates that the optimizer's financial decision logic is highly robust to micro-gas fluctuations on Pharos Pacific Mainnet.
