# Gate 1E: Strategy Count Reconciliation Report

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**Audit Date:** November 3, 2026  
**Auditor:** Antigravity AI  
**Status:** COMPLETE (READ-ONLY AUDIT)

---

## 1. Objective & Evaluation Framework

Requirement 01 of the Pharos Agent Arena Task 15 specifies:
> *"Compares at least 3 yield sources using live on-chain data."*

To uphold absolute audit integrity, this report evaluates every candidate across the Pharos Pacific Mainnet ecosystem and assigns **exactly one** primary classification to each:
- `VERIFIED_YIELD_SOURCE`
- `PARTIALLY_VERIFIED_YIELD_SOURCE`
- `OFFCHAIN_TARGET_RATE`
- `EXECUTION_ALTERNATIVE`
- `BASELINE_ONLY`
- `UNVERIFIED_CANDIDATE`

Each candidate is evaluated against strict technical criteria to establish whether it genuinely qualifies as an independent yield source under the official task rules.

---

## 2. Individual Candidate Evaluations

### Candidate A: Faroo Patient Staking (`stPROS` Queue)
- **Asset Denomination:** `PROS`
- **Contract Address:** `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`
- **Product Activity:** Active liquid staking protocol pool.
- **On-Chain Evidence:**
  - Block `#22024812` total pooled PROS: `3,152,335.0804 PROS`.
  - Block `#22024812` total stPROS supply: `3,136,910.7559 stPROS`.
  - Verified Spot Exchange Rate: **`1.00491704 PROS per stPROS`**.
- **Yield Trajectory & Forward APR Analysis:**
  - Measuring the rate delta across 100,000 blocks ($\Delta t = 29.21$ hours) revealed a short-term trailing rate of $+0.10128\%$, which annualizes to $30.37\%$.
  - **Critical Audit Distinction:** This $30.37\%$ short-period spike was an artifact of early bootstrapping and episodic reward indexing. It is **NOT** a sustainable, guaranteed forward APY. As pool liquidity matures, the equilibrium forward gross return approaches the documented network PoS consensus rate of **~8.50%**.
- **Exit Mechanics & Costs:**
  - Entry fee: `0.00%` (minting `stPROS` at current exchange rate).
  - Exit fee via protocol unbond queue: `0.00%`.
  - Unbonding lock duration: **14 days** (network consensus unbonding epoch).
- **Classification:** **`VERIFIED_YIELD_SOURCE`**
- **Qualifies toward Requirement 01?** **YES (Qualifying Source #1)**. Fully verified on-chain, dynamic rate, callable contract.

---

### Candidate B: Faroo Liquid DEX Exit (`stPROS` Instant Swap)
- **Asset Denomination:** `PROS`
- **Contract Address:** Faroo `stPROS` (`0x6b0A...`) paired with `WPROS` on Pharos DEX (`0xD681...`).
- **Nature of the Candidate:** 
  - An investor holding `stPROS` swaps back to `WPROS`/`PROS` on an automated market maker rather than waiting 14 days in Faroo's unbonding queue.
- **Yield Source vs. Execution Mechanism Audit:**
  - The yield accrued during the holding period is generated **entirely by Faroo's underlying validator staking pool**.
  - The AMM swap is merely a liquidation pathway that trades time delay for liquidity cost.
  - Swap fee: `0.30%` pool fee + dynamic price slippage / pool discount against spot par value.
- **Strict Financial Taxonomy:**
  - Changing the liquidation channel or exit speed does not create a new economic yield source.
- **Classification:** **`EXECUTION_ALTERNATIVE`**
- **Qualifies toward Requirement 01?** **NO**. It is an exit and liquidity feature of Candidate A, not an independent yield source.

---

### Candidate C: Axil Prime Credit 3M Vault (`APC3M`)
- **Asset Denomination:** **`USDC`** (`0xC879C018dB60520F4355C26eD1a6D572cdAC1815`)
- **Contract Addresses:**
  - Share Token: `0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0`
  - Vault Contract: `0xD0428799FbC35557834d33121BA4472692c8908a`
- **Product Activity:** Active R25 institutional private credit vault on Pharos Pacific Mainnet.
- **Rate Verification Audit:**
  - Advertised return: **`9.25% APY`**.
  - On-chain inspection of the vault contract confirms ERC-20 share token standards, but the 9.25% rate is an **off-chain target net return** negotiated with credit underwriters.
  - The contract does NOT feature an on-chain automated continuous rebasing or oracle-driven interest stream that can be independently calculated from block deltas alone.
- **Exit & Liquidity Constraints:**
  - Lockup period: **90 days** (quarterly institutional liquidity windows).
  - Access restriction: Requires institutional whitelisting / KYC / AML compliance check.
- **Currency & Risk Mismatch:**
  - Denominated in USDC. Comparing PROS yield directly to USDC yield ignores PROS/USDC exchange rate volatility. A user cannot rebalance between PROS and APC3M without performing a cross-currency DEX swap.
- **Classification:** **`OFFCHAIN_TARGET_RATE`**
- **Qualifies toward Requirement 01?** **NO (Disqualified under strict live on-chain criteria)**. The rate is an off-chain target, requires institutional permissioning, and is cross-currency.

---

### Candidate D: Native PROS Holding / Canonical Wrapped PROS (`WPROS`)
- **Asset Denomination:** `PROS`
- **Contract Address:** Canonical WPROS (`0x52C46eD4e803a647000e5aA6145B1c110996D872`) / Native PROS.
- **Yield Generation:** `0.00%`.
- **Purpose:** Holding native un-staked tokens earns zero yield. It serves exclusively as the benchmark reference asset against which net yield alpha and fee recovery are evaluated.
- **Classification:** **`BASELINE_ONLY`**
- **Qualifies toward Requirement 01?** **NO**. A zero-yield holding position cannot be counted as an active yield source.

---

### Candidate E1: Pharos Native PoS Consensus Staking (Direct Delegation)
- **Asset Denomination:** `PROS`
- **Mechanism:** Direct validator bonding at the L1 consensus layer.
- **On-Chain Audit Finding:**
  - Official documented baseline emission parameter is **~8.50% gross APR**.
  - As established in Gate 1D, there is **no deployed EVM smart contract** or public JSON-RPC method allowing an EVM agent to deposit or rebalance into individual validators on Pacific Mainnet today.
  - Marked as *"Coming Soon in Anvita Mate"* on `port.pharos.xyz/stake`.
- **Classification:** **`PARTIALLY_VERIFIED_YIELD_SOURCE`** (Documented L1 parameter, but no interactive EVM contract).
- **Qualifies toward Requirement 01?** **NO (Cannot be executed or dynamically queried via EVM)**.

---

### Candidate E2: Pharos DEX Liquidity Pool (Uniswap V4 PoolManager)
- **Asset Denomination:** Dual-asset LP (e.g., `PROS/USDC` or `stPROS/WPROS`)
- **Contract Addresses:** PoolManager (`0xD681...`), StateView (`0x6164...`)
- **Yield Mechanism:** Trading fee accrual from swap transactions.
- **On-Chain Audit Finding:**
  - Contracts are deployed and operational.
  - However, calculating dynamic fee APR requires continuous off-chain transaction indexing over time. Pacific Mainnet does not have a public indexing subgraph or live fee APR query endpoint exposed via RPC.
  - The live rate is therefore `UNAVAILABLE` through standard on-chain JSON-RPC calls.
- **Classification:** **`UNVERIFIED_CANDIDATE`** (Yield mechanism exists, but dynamic rate cannot be verified on-chain).
- **Qualifies toward Requirement 01?** **NO**.

---

## 3. Comprehensive Reconciliation & Classification Table

| Candidate Name | Underlying Asset | Deployed Contract | Primary Classification | Live On-Chain Rate? | Callable Rebalance? | Qualifies for Req 01? |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Faroo Patient Staking** (`stPROS` queue) | `PROS` | `0x6b0A...5Ec4` | **`VERIFIED_YIELD_SOURCE`** | **YES** (`1.00491704`) | **YES** | **QUALIFIES (Source #1)** |
| **Faroo Liquid DEX Exit** (`stPROS` swap) | `PROS` | `0x6b0A...` + DEX | **`EXECUTION_ALTERNATIVE`** | Secondary AMM price | **YES** | **DISQUALIFIED (Exit Mechanism)** |
| **Axil Prime Credit 3M** (`APC3M`) | `USDC` | `0xEC47...44d0` | **`OFFCHAIN_TARGET_RATE`** | **NO** (Target 9.25%) | Restricted (AML/KYC) | **DISQUALIFIED (Off-Chain Target & FX)** |
| **Native PROS Holding / WPROS** | `PROS` | `0x52C4...D872` | **`BASELINE_ONLY`** | **YES** (0.00% constant) | **YES** | **DISQUALIFIED (Benchmark Only)** |
| **Pharos Native PoS Direct Staking** | `PROS` | None on EVM | **`PARTIALLY_VERIFIED_YIELD_SOURCE`** | **NO** (Parameter only) | **NO** (Unlaunched) | **DISQUALIFIED (No EVM Contract)** |
| **Pharos DEX Liquidity Pools** | Multi | `0xD681...` | **`UNVERIFIED_CANDIDATE`** | **NO** (Rate unavailable) | **YES** | **DISQUALIFIED (Rate Unavailable)** |

---

## 4. Final Count of Genuinely Qualifying Sources

- **Genuinely Qualifying Sources Under Strict Arena Criteria:** **EXACTLY 1 SOURCE**
  - **Faroo Liquid Staking (`stPROS`)** is the only protocol on Pharos Pacific Mainnet that simultaneously satisfies:
    1. Active economic yield generation.
    2. Verified on-chain contract with public callable methods.
    3. Live, reproducible exchange rate queryable via JSON-RPC.
    4. Known entry, exit, and duration mechanics.
    5. Direct PROS denomination.

All other candidates either represent execution alternatives (DEX swap exit), off-chain target rates (Axil credit), zero-yield baselines (WPROS), unlaunched L1 parameters (direct PoS), or indexer-dependent fee pools (DEX LPs).
