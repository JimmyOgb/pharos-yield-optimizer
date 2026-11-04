# Gate 2: Yield Calculation Engine & Friction Mathematical Model

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**Status:** PLANNING SPECIFICATION ONLY (NO CODE / NO PACKAGES)  
**Evidence Baseline:** Gate 1E Verdict: `FEWER THAN THREE QUALIFYING SOURCES — REQUIREMENT NOT MET`  
**Current Qualifying Source Count:** **1 (Faroo `stPROS`)**

---

## 1. Mathematical Formulation & Architecture

The Yield Calculation Engine computes the net financial benefit of capital rebalancing by comparing projected economic returns against comprehensive transactional and temporal friction.

---

## 2. Core Mathematical Formulations

### 2.1 Exchange-Rate-Based Realized Accrual
In Faroo liquid staking, yield accumulates via the spot exchange rate $R(t)$, defined as the ratio of total underlying staked PROS to total minted `stPROS` shares:
$$R(t) = \frac{\text{totalPooledPros}(t)}{\text{totalSupply}(t)}$$

For any historical observation window between block time $t_1$ and $t_2$:
$$\Delta R = R(t_2) - R(t_1)$$
$$\text{Realized Yield Percentage } Y_{\text{realized}} = \frac{R(t_2) - R(t_1)}{R(t_1)}$$

Annualizing this short-term rate over elapsed time $\Delta t$ (in days) yields:
$$\text{Trailing Annualized Rate } \text{APR}_{\text{trailing}} = Y_{\text{realized}} \times \left( \frac{365}{\Delta t} \right)$$

> **Audit Warning:** As verified in Gate 1C, short-term trailing rates (e.g. $30.37\%$ over a 29.2-hour bootstrapping window) are episodic. For forward projections, the engine normalizes to the verified consensus equilibrium rate:
> $$\text{Projected Forward Rate } R_{\text{forward}} \approx 8.50\% \text{ gross}$$

---

### 2.2 Gross Yield Projection
Given a starting principal $P$ (in native units) and a user-selected holding horizon $T$ (in days):
$$\text{Gross Return Amount } G = P \times \left[ \left( 1 + \frac{R_{\text{forward}}}{365} \right)^T - 1 \right]$$
For small horizons ($T \ll 365$), the linearized approximation is:
$$G \approx P \times R_{\text{forward}} \times \left( \frac{T}{365} \right)$$

---

### 2.3 Total Transactional Friction Model
Moving funds between positions incurs entry costs, exit costs, network gas, protocol fees, and market slippage:
$$C_{\text{friction}} = C_{\text{gas\_entry}} + C_{\text{fee\_entry}} + C_{\text{gas\_exit}} + C_{\text{fee\_exit}} + C_{\text{slippage}}$$

#### A. Gas Costs ($C_{\text{gas}}$)
Using live gas price $P_{\text{gas}}$ (in Gwei) and estimated execution units $U_{\text{gas}}$:
$$C_{\text{gas}} = U_{\text{gas}} \times P_{\text{gas}} \times 10^{-9} \text{ PROS}$$
- **Entry Gas (Faroo `submit`):** $U_{\text{entry}} \approx 115,000$ gas. At $1.25$ Gwei $\rightarrow C_{\text{gas\_entry}} \approx 0.00014375$ PROS.
- **Exit Gas (Faroo `requestWithdraw`):** $U_{\text{exit}} \approx 85,000$ gas. At $1.25$ Gwei $\rightarrow C_{\text{gas\_exit}} \approx 0.00010625$ PROS.
- **DEX Swap Exit Gas (AMM `swap`):** $U_{\text{swap}} \approx 145,000$ gas. At $1.25$ Gwei $\rightarrow C_{\text{gas\_swap}} \approx 0.00018125$ PROS.

#### B. Protocol Entry and Exit Fees ($C_{\text{fee}}$)
- **Faroo Patient Staking Queue:**
  $$C_{\text{fee\_entry}} = 0.00\% \times P = 0$$
  $$C_{\text{fee\_exit}} = 0.00\% \times P = 0$$
- **Faroo Liquid DEX Exit Route:**
  $$C_{\text{fee\_entry}} = 0.00\% \times P = 0$$
  $$C_{\text{fee\_exit}} = 0.30\% \times P = 0.003 \times P$$

#### C. Market Slippage ($C_{\text{slippage}}$)
For instant DEX liquidation, price impact is modeled as a function of trade size $P$ relative to available pool depth $L_{\text{pool}}$:
$$\text{Slippage Rate } S(P) = \frac{P}{2 \times L_{\text{pool}}}$$
$$C_{\text{slippage}} = P \times S(P)$$
*(For standard retail sizes $P \le 5,000\text{ PROS}$ on active pools, $S(P) \approx 0.05\%\text{ – }0.15\%$.)*

---

### 2.4 Expected Net Gain Formula
The net economic alpha of rebalancing relative to holding the existing baseline is:
$$\text{Net Gain } \mathcal{N} = G - C_{\text{friction}}$$
$$\mathcal{N} = \left[ P \times R_{\text{forward}} \times \left( \frac{T}{365} \right) \right] - \left( C_{\text{gas}} + C_{\text{fee}} + C_{\text{slippage}} \right)$$

---

### 2.5 Break-Even Holding Period ($\tau_{\text{breakeven}}$)
The break-even holding period is the exact number of days required for cumulative gross yield to fully pay off all transaction friction:
$$\tau_{\text{breakeven}} = \frac{C_{\text{friction}}}{P \times \left( \frac{R_{\text{forward}}}{365} \right)} \text{ days}$$

- If the user's intended investment horizon $T < \tau_{\text{breakeven}}$, any rebalance recommendation results in a guaranteed net financial loss.

---

### 2.6 Lockup & Liquidity Eligibility Rules
1. **Unbonding Delay Constraint:**
   - Faroo Patient Staking has a mandatory 14-day protocol unbonding queue.
   - If user maximum allowable lockup $T_{\text{max\_lock}} < 14\text{ days}$, Faroo Patient Staking is **disqualified** from automated `MOVE` recommendations.
2. **Institutional RWA Constraint:**
   - Axil Prime Credit has a 90-day lockup.
   - If $T < 90\text{ days}$, Axil is **disqualified**.

---

### 2.7 Cross-Currency & FX Risk Formulation (Axil APC3M)
When comparing a PROS position against USDC-denominated Axil Prime Credit:
$$\text{Net USD Value } V(T) = \left( \frac{P}{S_{\text{PROS/USD}}(0)} \right) \times \left( 1 + R_{\text{Axil}} \times \frac{T}{365} \right) \times S_{\text{PROS/USD}}(T)$$
$$\text{Net FX Return } = \frac{V(T) - P}{P}$$
Because future PROS price $S_{\text{PROS/USD}}(T)$ is unknown and unhedgeable on-chain, cross-currency rebalancing carries unbounded directional FX risk. The engine **never** generates an automated `MOVE` from PROS to USDC based on APY alone.

---

## 3. Concrete Worked Numerical Examples

### Scenario A: Small Retail Position ($P = 100\text{ PROS}$, $T = 7\text{ Days}$)
- **Candidate:** Faroo Patient Staking ($R = 8.50\%$)
- **Gross Yield:** $100 \times 0.0850 \times (7 / 365) = +0.1630\text{ PROS}$.
- **Friction:** Gas ($0.00025\text{ PROS}$) + Fees ($0$) = $0.00025\text{ PROS}$.
- **Lockup Check:** Horizon ($7\text{ days}$) is less than 14-day unbonding period.
- **Engine Output:**
  $$\mathbf{STAY\ PUT}$$
  $$\mathbf{REASON:}\ \text{"Investment horizon (7 days) is shorter than mandatory 14-day unbonding queue."}$$

---

### Scenario B: Standard Position ($P = 1,000\text{ PROS}$, $T = 60\text{ Days}$, Queue Exit)
- **Candidate:** Faroo Patient Staking ($R = 8.50\%$)
- **Gross Yield:** $1,000 \times 0.0850 \times (60 / 365) = +13.9726\text{ PROS}$.
- **Total Friction:** Gas ($0.00025\text{ PROS}$) + Fees ($0$) = $0.00025\text{ PROS}$.
- **Net Gain:** $+13.97235\text{ PROS}$ ($+1.397\%$ net return).
- **Break-Even Period:** $\tau_{\text{breakeven}} = \frac{0.00025}{1,000 \times (0.0850 / 365)} \approx 0.001\text{ days} \approx 1.5\text{ minutes}$.
- **Engine Output:**
  $$\mathbf{MOVE\ TO\ FAROO\ STAKING\ (QUEUE)}$$
  $$\mathbf{NET\ GAIN:}\ +13.97\text{ PROS}\ (+1.40\%\text{ over 60 days).}$$

---

### Scenario C: Active Trader Position ($P = 1,000\text{ PROS}$, $T = 10\text{ Days}$, Instant DEX Exit)
- **Candidate:** Faroo Liquid Staking via DEX Exit ($R = 8.50\%$)
- **Gross Yield:** $1,000 \times 0.0850 \times (10 / 365) = +2.3288\text{ PROS}$.
- **Total Friction:**
  - Gas: $0.000325\text{ PROS}$
  - DEX Exit Fee ($0.30\%$): $3.0000\text{ PROS}$
  - Estimated Slippage ($0.10\%$): $1.0000\text{ PROS}$
  - Total Friction: $4.000325\text{ PROS}$.
- **Net Gain:** $2.3288 - 4.0003 = \mathbf{-1.6715\text{ PROS}}$ (NET LOSS).
- **Break-Even Period:** $\tau_{\text{breakeven}} = \frac{4.0003}{0.23288} = \mathbf{17.18\text{ days}}$.
- **Engine Output:**
  $$\mathbf{STAY\ PUT}$$
  $$\mathbf{REASON:}\ \text{"DEX exit fees and slippage (4.00 PROS) exceed gross yield (2.33 PROS) over 10 days. Break-even requires 17.2 days."}$$
