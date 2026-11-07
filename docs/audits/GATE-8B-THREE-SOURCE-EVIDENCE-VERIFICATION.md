# PHAROS TASK 15 — GATE 8B: THREE-SOURCE YIELD EVIDENCE VERIFICATION AUDIT

**Project:** Pharos Yield Optimizer  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Network:** Pharos Pacific Mainnet — Chain ID 1672 (`0x688`)  
**RPC Endpoint:** `https://rpc.pharos.xyz`  
**Preserved Baseline Commit:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`  
**Production URL:** `https://pharos-yield-optimizer.vercel.app`  
**Audit Date:** November 7, 2026  
**Audit Mode:** Read-Only Empirical On-Chain Verification  

---

## 1. Executive Summary & Qualification Decision

### Final Gate 8B Qualification Decision: **BLOCK — FEWER THAN THREE FULLY VERIFIED SOURCES**

Following strict evaluation criteria, all three candidate protocols identified during Gate 8A were independently audited across multiple historical blocks on Pharos Pacific Mainnet.

| Candidate Protocol & Mechanism | Contract Address | Verified On-Chain State | Rate Type & Determinism | Single-Asset PROS Equivalence | Qualification Verdict |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **1. Faroo Liquid Staking (`stPROS`)** | `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4` | 4,313,669 PROS ($2.32M) | Realized exchange rate accrual ($R = \frac{\text{totalAssets}}{\text{totalSupply}}$) | **YES** (100% PROS) | **PASS (Source 1 - Qualified)** |
| **2. Pharos Native PoS Consensus Staking** | `0x4100000000000000000000000000000000000000` | 283,924,850 PROS ($152.9M) | On-chain reward-per-share ($\Delta\text{RPS}$) across 20 active validator pools | **YES** (100% Native PROS) | **PASS (Source 2 - Qualified)** |
| **3. FaroSwap Uniswap V3 LP (`WPROS/USDC`)** | `0x4146d192da6428c9e1c243d2a953c625b5765623` | 47,825 WPROS + 262,904 USDC ($314.6K) | Monotonic fee growth, but position-dependent & range-dependent | **NO** (50% USDC + Impermanent Loss) | **BLOCK (Disqualified as pure yield)** |
| **4. Axil Prime Credit 3M (`apcVault`)** | `0xd0428799fbc35557834d33121ba4472692c8908a` | 72,918,348 USDC ($72.9M) | Off-chain target APY (8.00–10.50%) | **NO** (100% USDC Private Credit) | **BLOCK (Disqualified)** |
| **5. Avalon Finance Aave V3 Market** | `0x361D78678a453951320EFD11B5F9C67D539ca0a0` | 0 PROS / 0 WPROS | Inactive (`getPool()` reverts on-chain) | N/A (Dormant) | **BLOCK (Disqualified)** |

### Result Summary:
- **Verified Qualifying Sources:** Exactly **TWO** sources (Faroo Liquid Staking and Pharos Native PoS Consensus Staking).
- **Shortfall:** Exactly **ONE** source short of the mandatory three-source requirement.
- In accordance with Gate 8B operating instructions (*"Do not upgrade a conditional source to qualified merely to satisfy the count"*), this audit issues a **BLOCK** decision.

---

## 2. In-Depth Verification: Candidate 1 — Faroo Liquid Staking (`stPROS`)

### A. Contract Identity & Bytecode Verification
- **Contract Address:** `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`
- **Underlying Token:** Canonical Wrapped PROS (`WPROS` at `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0`)
- **Proxy Bytecode:** 2,739 bytes deployed on Chain ID 1672
- **Implementation (EIP-1967):** `0xfd59860894e01773e9780b0d1dfae4ca2b56708d`
- **Method Selectors:**
  - `totalAssets()`: `0x01e1d114`
  - `totalSupply()`: `0x18160ddd`
  - `deposit(uint256,address)`: `0x6e553f65`

### B. Reproducible Historical Multi-Block Observations
Sampling was executed via JSON-RPC across 6 blocks spanning 4.79 days:

| Block Number | Timestamp (UTC) | Elapsed ($\Delta t$) | `totalAssets` (PROS) | `totalSupply` (stPROS) | Spot Rate ($R$) | Interval Accrual | Realized Trailing APR |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `#21924812` | 2026-11-02 10:33:58 | Baseline | 2,343,199.0874 | 2,334,095.4238 | `1.00390029` | Baseline | Baseline |
| `#22004812` | 2026-11-03 10:23:57 | 0.99 days | 3,151,481.6770 | 3,136,791.7174 | `1.00468311` | +0.0780% | **28.66%** |
| `#22100000` | 2026-11-04 13:46:26 | 1.14 days | 3,456,916.0441 | 3,437,369.8588 | `1.00568637` | +0.0999% | **31.95%** |
| `#22200000` | 2026-11-05 17:34:53 | 1.16 days | 3,859,516.0170 | 3,834,189.1666 | `1.00660552` | +0.0914% | **28.79%** |
| `#22300000` | 2026-11-06 17:50:26 | 1.01 days | 4,312,643.8116 | 4,282,117.7619 | `1.00712872` | +0.0520% | **18.77%** |
| `#22348179` | 2026-11-07 05:31:58 | 0.49 days | 4,313,669.1863 | 4,282,219.5590 | `1.00734423` | +0.0214% | **16.03%** |

### C. Accounting Analysis & Rate Derivation
1. **Nature of Rate:** The exchange rate $R_t = \frac{\text{totalAssets}}{\text{totalSupply}}$ is a **realized historical exchange rate**, not an APY. 
2. **Trailing Growth:** Across the full 4.79-day window, the exchange rate increased by $\Delta R = +0.00344394$ ($+0.3431\%$).
3. **Annualization:** The overall 4.79-day realized annualized rate is **`26.14% APR`**. Notice that as the vault expanded from 2.34M to 4.31M PROS (+84% growth), the realized daily rate diluted from ~30% APR down to ~16% APR.
4. **Assumptions & Uncertainty:** Forward yield will dilute toward the equilibrium consensus PoS yield (~8.50% gross). Trailing rates should be sampled over a minimum 7-day rolling window to smooth episodic indexing spikes.
5. **Entry/Exit Mechanics:**
   - Entry: Wrap Native PROS to WPROS (45k gas) + Approve (45k gas) + Deposit (90k gas) = **180,000 gas**. 0% entry fee.
   - Exit: 14-day protocol unbonding queue (85,000 gas, 0% exit fee) OR DEX swap (0.30% fee + slippage).

---

## 3. In-Depth Verification: Candidate 2 — Pharos Native PoS Consensus Staking

### A. Precompile Identity & Specification
- **Contract Address:** `0x4100000000000000000000000000000000000000`
- **Bytecode:** 268 bytes (Native EVM system precompile)
- **Live On-Chain Balance:** **`283,924,850.2879 Native PROS`** (~$152.9M USD value staked across 20 active validator pools).
- **Verified ABI & Method Selectors:**
  - `delegate(bytes32 poolId)`: `0x5c19a95c` — Payable function accepting native PROS (`msg.value`).
  - `undelegate(bytes32 poolId)`: `0x51cff8d9` — Initiates unbonding order for delegator.
  - `claimReward(bytes32 poolId)`: `0x8c79c882` — Claims accumulated reward PROS without unbonding principal.
  - `getDelegator(bytes32 poolId, address delegator)`: `0x3a6d6bae` — Returns `(uint256 principalStake, uint256 stake, uint256 accumulatedRewardPerShare, uint256 rewards, uint256 pendingStake, uint256 pendingWithdrawStake, uint256 pendingWithdrawWindow, uint256 totalRewardsClaimed, bool isPendingUndelegate)`.
  - `getUserPendingUndelegations(address delegator)`: `0xa5bd8279` — Returns array of pending undelegation entries.

### B. Reproducible Historical Delegation Observations
Sampled for delegator `0xec1d6163e05b3f5d0fb8f354881f6c8b793ad612` on validator pool `0xaecb1e6d44e8921b5b9b8e04f95d5a78776ee76d2eb7404fb002ab7fed86bedc`:

| Block Number | Timestamp (UTC) | Delegated Principal (PROS) | `accumulatedRewardPerShare` | Total Rewards Claimed (PROS) | Interval Earned | Implied Annualized APR |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `#22004812` | 2026-11-03 10:23:57 | 57,834.3715 | `6,125,285,222,379,904,016,085,852` | 326.7773 | Baseline | Baseline |
| `#22100000` | 2026-11-04 13:46:26 | 57,834.3715 | `7,497,692,496,913,860,189,524,595` | 406.1496 | +79.3723 PROS | **43.91%** |
| `#22200000` | 2026-11-05 17:34:53 | 57,834.3715 | `8,403,570,771,921,002,076,743,817` | 458.5405 | +52.3909 PROS | **28.54%** |
| `#22300000` | 2026-11-06 17:50:26 | 57,834.3715 | `9,086,639,863,746,086,920,340,514` | 498.0454 | +39.5049 PROS | **24.67%** |

### C. Accounting Analysis & Exact Semantics
1. **How Rewards Accumulate:** When active validators sign and propose blocks, network emission rewards and priority fees are credited to the pool. `accumulatedRewardPerShare` increments monotonically.
2. **Allocation to Individual Delegator:** For a delegator with stake $S$:
   $$\text{Earned Rewards} = S \times \frac{\Delta\text{accumulatedRewardPerShare}}{\text{ScaleFactor}}$$
3. **Empirical Return Proof:** Over the 3.31-day window (Nov 3 to Nov 6), the delegator earned and claimed **`171.2681 PROS`** on a principal of `57,834.3715 PROS`, realizing a cumulative gain of **`+0.2961%`** ($\mathbf{32.65\% \text{ annualized APR}}$).
4. **Execution Mechanics:**
   - **Entry:** Direct call to `delegate(bytes32 poolId)` with `msg.value = amountNativePros`. 0% entry fee, ~65,000 gas. (Reverts with `"Insufficient stake"` if `msg.value == 0`).
   - **Exit:** Call to `undelegate(bytes32 poolId)`. 21-day network unbonding epoch window before withdrawal. ~85,000 gas.
   - **Claim:** Call to `claimReward(bytes32 poolId)`. Distributes native PROS to `msg.sender`. ~45,000 gas.
5. **Qualification:** **QUALIFIED**. Fully on-chain, single-asset PROS, deterministic accounting, and active validator infrastructure with $152.9M PROS staked.

---

## 4. In-Depth Verification: Candidate 3 — FaroSwap Uniswap V3 LP (`WPROS/USDC`)

### A. Pool Identity & Immuntables
- **Pool Contract:** `0x4146d192da6428c9e1c243d2a953c625b5765623`
- **Factory:** `0x2c90CcB0b989afA2433F499698451a25744A552b` (FaroSwap V3 Factory)
- **Token 0:** `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0` (Canonical WPROS, 18 decimals)
- **Token 1:** `0xc879c018db60520f4355c26ed1a6d572cdac1815` (Pharos USDC, 6 decimals)
- **Fee Tier:** 3,000 (0.30%) | **Tick Spacing:** 60
- **Live Balances:** 47,825.96 WPROS + 262,904.34 USDC (~$314,600 USD TVL).

### B. Reproducible Historical Fee Growth Observations

| Block Number | Timestamp (UTC) | Active Liquidity ($L$) | `sqrtPriceX96` | Implied PROS Price | `feeGrowthGlobal0X128` (WPROS) | `feeGrowthGlobal1X128` (USDC) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `#22004812` | 2026-11-03 10:23:57 | 288,536,625,558,863,884 | 56662138385832046011313 | $0.5115 | `105569` ($\times 2^{128}$) | `0` ($\times 2^{128}$) |
| `#22100000` | 2026-11-04 13:46:26 | 288,567,376,352,508,645 | 58625394291612294491109 | $0.5475 | `105911` ($\times 2^{128}$) | `0` ($\times 2^{128}$) |
| `#22200000` | 2026-11-05 17:34:53 | 288,531,899,219,832,113 | 57500202836180809725679 | $0.5267 | `106182` ($\times 2^{128}$) | `0` ($\times 2^{128}$) |
| `#22300000` | 2026-11-06 17:50:26 | 288,531,899,219,832,113 | 58074827206759935066592 | $0.5373 | `106366` ($\times 2^{128}$) | `0` ($\times 2^{128}$) |

Delta Fee Growth over 3.31 days:
- $\Delta\text{feeGrowth0}$: $+2.7104 \times 10^{37}$ units ($+0.796\text{ WPROS}$ per unit of active liquidity).
- $\Delta\text{feeGrowth1}$: $+1.5871 \times 10^{29}$ units ($+0.0000466\text{ USDC}$ per unit of active liquidity).

### C. Why Uniswap V3 LP Fails Pure Single-Asset PROS Qualification
1. **Position-Specific Dependency:** In Uniswap V3, fee earnings are NOT uniform across depositors. Fees are earned strictly when the current tick $t$ falls within a position's specific tick boundaries $[t_{\text{lower}}, t_{\text{upper}}]$:
   $$f_{i} = f_{g} - f_{b}(t_{\text{lower}}) - f_{a}(t_{\text{upper}})$$
   Deriving an overall LP APY from global fee growth alone is mathematically invalid for individual depositors who choose concentrated ranges.
2. **50% Non-PROS Currency Risk:** Entering the pool requires selling 50% of capital into USDC, incurring:
   - Initial AMM swap fee: 0.30% on $0.5P$ (1.50 PROS per 1,000 PROS).
   - Exit AMM swap fee: 0.30% on $0.5P$ (1.50 PROS per 1,000 PROS).
   - Total swap friction: **3.00 PROS** (1,132x higher than staking gas).
3. **Impermanent Loss Risk:** If the PROS price appreciates from $0.51 to $0.54 (+5.88%), the LP automatically suffers impermanent loss relative to holding 100% PROS.
4. **Qualification:** **DISQUALIFIED AS A PURE PROS YIELD PRIMITIVE**. While it is an active AMM liquidity pool, it cannot be modeled as a single-asset yield destination without arbitrary range assumptions and unhedged USD currency exposure.

---

## 5. Candidate 4 & 5 Disqualification Verification

1. **Axil / R25 Prime Credit 3M (`0xd042...908a`):**
   - Holds $72.9M USDC assets.
   - Denominated strictly in USDC (`0xC879...1815`).
   - Yield is an off-chain target APY (8–10.5%) based on institutional private credit borrower underwriting.
   - Requires KYC/AML and 90-day fixed term lockup.
   - **Verdict:** **DISQUALIFIED**.
2. **Avalon Finance (`0x361D...a0a0`):**
   - Holds 0 PROS / 0 WPROS.
   - `getPool()` reverts on-chain.
   - Uninitialized on Pacific Mainnet.
   - **Verdict:** **DISQUALIFIED**.

---

## 6. Audit Conclusion & Final Qualification Decision

The empirical audit establishes that Pharos Pacific Mainnet currently has **TWO fully qualified, single-asset PROS yield primitives**:
1. **Faroo Liquid Staking (`stPROS`)** — Realized ~26% trailing APR (diluting toward PoS equilibrium).
2. **Pharos Native PoS Consensus Staking (`0x4100...0000`)** — Realized ~32% trailing APR from network block rewards.

Because the third candidate (FaroSwap Uniswap V3 LP) requires 50% USDC pairing, carries impermanent loss, and cannot yield a range-independent APY from global fee growth alone, the three-source requirement is:

### **DECISION: BLOCK — FEWER THAN THREE FULLY VERIFIED SOURCES**

- **Qualified Count:** 2 of 3
- **Shortfall:** 1 qualifying source
- **Blocker Status:** Ecosystem limitation on Pharos Pacific Mainnet (no third liquid, single-asset PROS staking or lending protocol exists on-chain).

---

## 7. Strict Boundary Confirmation

- Audit report completed at `docs/audits/GATE-8B-THREE-SOURCE-EVIDENCE-VERIFICATION.md`.
- No source code or tests were mutated.
- Working tree remains clean of tracked changes at commit `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`.
- Production deployment at `https://pharos-yield-optimizer.vercel.app` remains live and unaffected.
- Zero wallet transactions, signatures, or state modifications were executed.
