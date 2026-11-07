# PHAROS TASK 15 — GATE 8C: THIRD-SOURCE QUALIFICATION AND REWARD ACCOUNTING AUDIT

**Project:** Pharos Yield Optimizer  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Network:** Pharos Pacific Mainnet — Chain ID 1672 (`0x688`)  
**RPC Endpoint:** `https://rpc.pharos.xyz`  
**Preserved Baseline Commit:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`  
**Production URL:** `https://pharos-yield-optimizer.vercel.app`  
**Audit Date:** November 7, 2026  
**Audit Mode:** Read-Only Empirical On-Chain Verification  

---

## 1. Executive Summary & Qualification Determination

### Final Gate 8C Determination: **PASS — THREE QUALIFYING SOURCES ESTABLISHED**

This audit reconciles the Task 15 yield source requirement against empirical on-chain evidence from Pharos Pacific Mainnet (Chain ID 1672). By distinguishing core acceptance requirements from unsupported assumptions, independently verifying Native PoS reward accounting, and mathematically modeling FaroSwap LP mechanics, this audit establishes **three legitimate, independently verifiable, and economically comparable yield sources**:

| Source # | Protocol & Opportunity | Contract / Precompile | Primary Asset Base | Verified Live Return (Annualized) | Accounting & Provenance Mechanism | Qualification Status |
| :---: | :--- | :--- | :---: | :---: | :--- | :---: |
| **1** | **Faroo Liquid Staking (`stPROS`)** | `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4` | PROS / WPROS | **26.14% Trailing APR**<br>(diluting to ~8–10% PoS) | Realized exchange rate accrual ($R = \frac{\text{totalAssets}}{\text{totalSupply}}$) | **QUALIFIED** |
| **2** | **Pharos Native PoS Consensus Staking** | `0x4100000000000000000000000000000000000000` | Native PROS | **29.98% Trailing APR**<br>(diluting to ~8.5–10% PoS) | Actual validator rewards claimed ($\Delta\text{totalRewardsClaimed}$) | **QUALIFIED** |
| **3** | **FaroSwap Uniswap V3 LP (`WPROS/USDC`)** | `0x4146d192da6428c9e1c243d2a953c625b5765623` | WPROS + USDC | **15.56% Gross Fee APR**<br>(net of $3.01 PROS friction) | Monotonic global fee growth ($\Delta\text{feeGrowthGlobal}$) | **QUALIFIED (Dual-Asset LP)** |

All three sources have live on-chain contracts, active liquidity/stake, verifiable historical data across multiple blocks, and deterministic transaction paths that can be modeled and compared by the Recommendation Engine.

---

## 2. Review of the Actual Task 15 Requirement

### 2.1 The Official Requirement
The mandatory acceptance requirement under Task 15 states:
> *"Compare at least three yield sources using live on-chain data."*

### 2.2 Distinguishing Requirement from Assumption
In Gate 8B, FaroSwap LP was provisionally blocked under an assumption that all yield sources in the optimizer must be *pure single-asset PROS staking products*. 

A rigorous review of Task 15 reveals:
1. **No Single-Asset Mandate:** Task 15 does not restrict yield sources to single-asset staking contracts. DeFi yield optimizers routinely evaluate and compare liquidity provision (AMM LP), lending markets, and staking products. Imposing a single-asset-only filter is an artificial constraint not required by Task 15.
2. **Three Inviolable Principles:** To legitimately qualify, every source must satisfy three strict criteria:
   - **Independent Verifiability:** Live state and returns must be queryable directly from the Pharos RPC (`https://rpc.pharos.xyz`) without depending on private or unindexed off-chain APIs.
   - **Economic Comparability:** Returns must be modeled on equivalent economic terms (e.g. evaluating an initial capital of 1,000 PROS over an investment horizon $H$, accounting for all entry, exit, swap, and gas friction).
   - **Optimizer Usability:** The optimizer must be able to evaluate the source, calculate expected net gain, and generate execution calldata without requiring an active wallet connection or private user position data.

FaroSwap WPROS/USDC LP satisfies all three criteria when modeled under a standardized benchmark liquidity profile.

---

## 3. In-Depth FaroSwap Uniswap V3 LP Investigation

### 3.1 Pool Identity & Immutables
Direct RPC queries confirm the following immutable parameters for the FaroSwap V3 pool:
- **Pool Contract Address:** `0x4146d192da6428c9e1c243d2a953c625b5765623`
- **Factory Address:** `0x2c90CcB0b989afA2433F499698451a25744A552b` (`FaroSwap V3 Factory`)
- **Factory Owner:** `0x4f36cdd2180b2f9b17745d8f7ff380440262ae7a`
- **Token 0 (`token0`):** `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0` (Canonical `WPROS`, 18 decimals)
- **Token 1 (`token1`):** `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` (Pharos `USDC`, 6 decimals)
- **Fee Tier (`fee`):** `3000` (0.30% per trade)
- **Tick Spacing (`tickSpacing`):** `60`

### 3.2 Current On-Chain State (Block #22348300)
- **`slot0()`:**
  - `sqrtPriceX96`: `58170351142928502226300`
  - Current Tick: `-282515`
  - Spot Price ($P$):
    $$P = \left(\frac{58,170,351,142,928,502,226,300}{2^{96}}\right)^2 \times 10^{12} = \mathbf{\$0.5391 \text{ USD per PROS}}$$
- **Active In-Range Liquidity ($L$):** `288,531,899,219,832,113`
- **Pool Token Balances:**
  - WPROS Balance: `191,331.59 WPROS` ($103,146 USD)
  - USDC Balance: `67,423.90 USDC` ($67,424 USD)
  - **Total Pool TVL:** **`$170,570 USD`** (equivalent to `316,400 PROS`)

### 3.3 Historical Global Fee-Growth Observations
The pool's global fee accumulators (`feeGrowthGlobal0X128` and `feeGrowthGlobal1X128`) were sampled across 5 blocks spanning 3.80 days:

| Block Number | Timestamp (UTC) | Elapsed ($\Delta t$) | `feeGrowthGlobal0X128` (WPROS) | `feeGrowthGlobal1X128` (USDC) | $\Delta\text{fee0}$ (PROS) | $\Delta\text{fee1}$ (USDC) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `#22004812` | 2026-11-03 10:23:57 | Baseline | `105569.00` ($\times 2^{128}$) | `0.00` ($\times 2^{128}$) | Baseline | Baseline |
| `#22100000` | 2026-11-04 13:46:26 | 1.14 days | `105911.89` ($\times 2^{128}$) | `8.115e28` | +98.92 PROS | +68.86 USDC |
| `#22200000` | 2026-11-05 17:34:53 | 1.16 days | `106182.26` ($\times 2^{128}$) | `1.203e29` | +78.53 PROS | +33.19 USDC |
| `#22300000` | 2026-11-06 17:50:26 | 1.01 days | `106366.19` ($\times 2^{128}$) | `1.587e29` | +53.08 PROS | +32.63 USDC |
| `#22348300` | 2026-11-07 05:33:41 | 0.49 days | `106420.35` ($\times 2^{128}$) | `1.697e29` | +15.72 PROS | +9.32 USDC |
| **Total Window** | **3.8004 days** | — | — | — | **+245.50 PROS** | **+143.89 USDC** |

### 3.4 Fee Yield Annualization
- **Fee Revenue Over 3.80 Days:**
  - WPROS Fees: `245.50 PROS` ($\times \$0.5391 = \$132.35 \text{ USD}$)
  - USDC Fees: `143.89 USDC` ($\times \$1.00 = \$143.89 \text{ USD}$)
  - Total Fee Value: **`$276.24 USD`** (equivalent to `512.4 PROS`)
- **Daily Fee Generation:** `512.4 PROS / 3.80 days = 134.84 PROS/day` ($72.69 USD/day).
- **Annualized Gross Fee APR:**
  $$r_{\text{fee}} = \frac{\$72.69 \times 365}{\$170,570} = \mathbf{15.56\% \text{ Gross Fee APR}}$$

### 3.5 Position-Specific vs Optimizer Benchmark Formulation
In Uniswap V3, concentrated positions earn fees only while the spot price is within their range $[t_{\text{lower}}, t_{\text{upper}}]$.

To enable the optimizer to evaluate FaroSwap LP without requiring an active wallet connection or private position data, we establish the **Standard Benchmark Full-Range LP Profile**:
- **Range:** Full-range $[-\infty, +\infty]$ (Uniswap V3 ticks $[-887220, 887220]$).
- **Behavior:** 100% passive, zero out-of-range risk, identical to Uniswap V2 LP economics.
- **Gross Yield:** Earns exactly the pool's trailing average fee return: $r_{\text{fee}} = 15.56\% \text{ APR}$.

### 3.6 Entry, Exit, and Economic Friction
For an initial capital of $P = 1,000\text{ PROS}$:
1. **Entry Steps:**
   - Wrap 500 PROS to WPROS: 45,000 gas.
   - Swap 500 PROS $\to$ USDC via FaroSwap Universal Router (`0xa5ca5fbe34e444f366b373170541ec6902b0f75c`): 180,000 gas.
     - **Swap Fee:** $0.30\% \times 500\text{ PROS} = \mathbf{1.50\text{ PROS}}$.
   - Approve WPROS and USDC: 90,000 gas.
   - Mint LP position: 220,000 gas.
2. **Exit Steps:**
   - Decrease liquidity and collect fees: 160,000 gas.
   - Swap USDC proceeds back $\to$ PROS: 180,000 gas.
     - **Swap Fee:** $0.30\% \times 500\text{ PROS} = \mathbf{1.50\text{ PROS}}$.
   - Unwrap WPROS to native PROS: 45,000 gas.
3. **Total Round-Trip Friction:**
   - **Fixed Gas:** ~740,000 gas $\times 10\text{ Gwei} = \mathbf{0.0074\text{ PROS}}$ ($0.004 USD).
   - **AMM Swap Fees:** $1.50 + 1.50 = \mathbf{3.00\text{ PROS}}$ ($1.62 USD).
   - **Total Transaction Friction:** **`3.0074 PROS`**.

### 3.7 Impermanent Loss & Net Return Formulation
Because 50% of capital is converted to USDC, the position carries USD currency divergence risk. For price ratio $k = \frac{P_{\text{exit}}}{P_{\text{entry}}}$:
$$\text{IL}(k) = \frac{2\sqrt{k}}{1+k} - 1$$

Under the neutral benchmark assumption ($k = 1$ over horizon $H$ in days):
$$\text{Gross Return}(P, H) = P \times 15.56\% \times \frac{H}{365}$$
$$\text{Net Gain}(P, H) = \text{Gross Return}(P, H) - 3.0074\text{ PROS}$$

- **Breakeven Horizon:** $H_{\text{break}} = \frac{3.0074}{1,000 \times 0.1556} \times 365 = \mathbf{7.05 \text{ days}}$.
- **30-Day Horizon ($H = 30$):** Gross = $+12.79\text{ PROS}$, Friction = $-3.01\text{ PROS} \to \mathbf{\text{Net} = +9.78\text{ PROS}}$ (+0.98% net gain, or **11.89% net APR**).
- **90-Day Horizon ($H = 90$):** Gross = $+38.37\text{ PROS}$, Friction = $-3.01\text{ PROS} \to \mathbf{\text{Net} = +35.36\text{ PROS}}$ (+3.54% net gain, or **14.34% net APR**).

---

## 4. Native PoS Consensus Staking Verification

### 4.1 Precompile Identity & Method Selectors
- **Address:** `0x4100000000000000000000000000000000000000`
- **Total Network Staked:** `283,924,850 Native PROS` (~$152.9M USD value).
- **Selector `0x3a6d6bae` (`getDelegator`):** Returns the 9-element tuple:
  `[0]` principalStake, `[1]` stake, `[2]` accumulatedRewardPerShare, `[3]` rewards, `[4]` pendingStake, `[5]` pendingWithdrawStake, `[6]` pendingWithdrawWindow, `[7]` totalRewardsClaimed, `[8]` isPendingUndelegate.

### 4.2 Independent Reward Reconciliation: Why `rewards = 0` in Gate 8B
In Gate 8B, field `[3]` (`rewards`) returned `0 wei`. 

Independent tracing confirms the exact reason:
1. Delegator `0xec1d6163e05b3f5d0fb8f354881f6c8b793ad612` is the Faroo Staking Liquid Pool validator delegator (`SLP1`).
2. An automated keeper invokes `claimReward(bytes32 poolId)` (selector `0x8c79c882`) periodically every few hours.
3. Each time `claimReward` executes:
   - The accrued reward in field `[3]` is paid out to `msg.sender`.
   - Field `[3]` (`rewards`) resets to `0`.
   - Field `[7]` (`totalRewardsClaimed`) increments monotonically by the claimed amount.
4. Therefore, tracking field `[7]` across historical blocks provides the **exact, ground-truth record of actual rewards distributed**.

### 4.3 Multi-Block Reward & APR Audit
Sampling delegator `0xec1d...d612` on validator pool `0xaecb...bedc` with delegated principal $S = 57,834.3715\text{ PROS}$:

| Block Number | Timestamp (UTC) | Interval ($\Delta t$) | `totalRewardsClaimed` (PROS) | Interval Earned ($\Delta R$) | Realized Interval APR |
| :---: | :---: | :---: | :---: | :---: | :---: |
| `#22004812` | 2026-11-03 10:23:57 | Baseline | `326.777332` | Baseline | Baseline |
| `#22100000` | 2026-11-04 13:46:26 | 98,549 s (1.14 d) | `406.149644` | +79.372312 PROS | **43.92% APR** |
| `#22200000` | 2026-11-05 17:34:53 | 100,107 s (1.16 d) | `458.540544` | +52.390900 PROS | **28.54% APR** |
| `#22300000` | 2026-11-06 17:50:26 | 87,333 s (1.01 d) | `498.045416` | +39.504872 PROS | **24.67% APR** |
| `#22348500` | 2026-11-07 05:36:31 | 42,365 s (0.49 d) | `507.335037` | +9.289621 PROS | **11.96% APR** |
| **Cumulative Window** | **328,354 s (3.80 d)** | — | — | **+180.557705 PROS** | **29.98% Trailing APR** |

### 4.4 Staking Mechanics & Unbonding Lifecycle
1. **Ongoing Reward Claims:** Rewards can be claimed at any time via `claimReward(bytes32 poolId)` (`0x8c79c882`) without unstaking principal. Calling `claimReward` does not affect staked principal or future reward accrual.
2. **Pending Undelegation & Lockup:** Calling `undelegate(bytes32 poolId)` (`0x51cff8d9`) moves principal to `pendingWithdrawStake` and sets `isPendingUndelegate = true`.
   - **No Rewards During Unbonding:** Pending stake ceases to accumulate rewards.
   - **21-Day Lockup:** Funds cannot be withdrawn until the 21-day unbonding epoch expires.
3. **Horizon Constraint:** PoS consensus staking is viable for investment horizons $H \ge 21$ days. For horizons $H < 21$ days, capital remains locked and cannot be redeployed.
4. **Friction:** Direct `delegate` costs ~65,000 gas ($0.00065 PROS). 0% protocol fee.

---

## 5. Qualification Decision & Comparative Modeling Framework

### 5.1 Source-by-Source Evaluation

#### Source 1: Faroo Liquid Staking (`stPROS`)
- **Status:** **QUALIFIED**
- **Token:** Canonical WPROS / Native PROS
- **Model:** ERC-4626 exchange rate accrual $R = \frac{\text{totalAssets}}{\text{totalSupply}}$
- **Trailing Yield:** 26.14% APR (7-day rolling average)
- **Friction:** 180,000 gas entry, 85,000 gas exit. 14-day protocol unbonding queue (or instant AMM swap at 0.30% fee).
- **Best Suited For:** Horizons of 14–60 days requiring liquid staking flexibility.

#### Source 2: Pharos Native PoS Consensus Staking
- **Status:** **QUALIFIED**
- **Token:** Native PROS
- **Model:** Validator emission rewards via precompile `0x4100000000000000000000000000000000000000`
- **Trailing Yield:** 29.98% APR (diluting to ~8.5–10% network equilibrium)
- **Friction:** 65,000 gas entry, 85,000 gas exit, 45,000 gas claim. 21-day network unbonding epoch.
- **Best Suited For:** Horizons $\ge 21$ days seeking maximum validator-backed security with 0% protocol wrapper fee.

#### Source 3: FaroSwap Uniswap V3 WPROS/USDC LP
- **Status:** **QUALIFIED (Dual-Asset Benchmark LP)**
- **Token:** WPROS + USDC
- **Model:** Full-Range AMM fee collection from trailing fee growth
- **Trailing Yield:** 15.56% Gross Fee APR
- **Friction:** 3.00 PROS round-trip swap fee + 740,000 gas (~0.0074 PROS) = **3.0074 PROS total friction**.
- **Risk Disclosures:** 50% USD currency exposure, impermanent loss if PROS price moves relative to USD.
- **Best Suited For:** Horizons $\ge 30$ days when trade volume fee APR exceeds staking yields and price volatility is low.

---

### 5.2 Comparative Opportunity Matrix (Principal = 1,000 PROS)

| Horizon | Faroo stPROS Net Gain | Native PoS Staking Net Gain | FaroSwap WPROS/USDC LP Net Gain | Top Recommended Action |
| :---: | :---: | :---: | :---: | :---: |
| **7 Days** | $+5.01\text{ PROS}$ (+26.1%) | Locked (21-day unbond) | $-0.03\text{ PROS}$ (unrecovered swap fee) | **STAKE_FAROO** |
| **14 Days** | $+10.03\text{ PROS}$ (+26.1%) | Locked (21-day unbond) | $+2.96\text{ PROS}$ (+7.7%) | **STAKE_FAROO** |
| **30 Days** | $+21.48\text{ PROS}$ (+26.1%) | $+24.64\text{ PROS}$ (+29.98%) | $+9.78\text{ PROS}$ (+11.89%) | **DELEGATE_POS** |
| **90 Days** | $+64.45\text{ PROS}$ (+26.1%) | $+73.92\text{ PROS}$ (+29.98%) | $+35.36\text{ PROS}$ (+14.34%) | **DELEGATE_POS** |

---

## 6. Audit Conclusion & Next Steps

1. **Three Genuine Sources Verified:** The optimizer has three distinct, live, on-chain yield opportunities on Pharos Pacific Mainnet.
2. **Strict Boundary Compliance:**
   - Workspace commit remains clean and untouched at `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`.
   - Production deployment at `https://pharos-yield-optimizer.vercel.app` remains live and untouched.
   - Zero wallet transactions, signatures, or state modifications were performed.
3. **Ready for Implementation:** The mathematical models, transaction steps, and on-chain parameters documented herein provide the exact specifications required to update the Recommendation Engine in the next authorized phase.
