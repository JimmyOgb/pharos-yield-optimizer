# Gate 1E: Official Acceptance Criteria Review

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**Audit Date:** November 3, 2026  
**Auditor:** Antigravity AI  
**Status:** COMPLETE (READ-ONLY AUDIT)

---

## 1. Executive Summary & Audit Scope

This document provides a formal, evidence-based review of the official task requirements for **Task 15: Yield Optimizer** in the Pharos Agent Arena. The objective is to establish the exact official wording, examine every semantic and technical constraint, and determine what qualifies under the official rules for the requirement to *"compare at least 3 yield sources using live on-chain data"*.

---

## 2. Official Source Retrieval & Verbatim Requirements

The live Pharos Agent Arena task page was queried and retrieved on **November 3, 2026, at 17:27 UTC+1** from:
`https://pharos-agent-arena.vercel.app/tasks/yield-optimizer`

### 2.1 Verbatim Task Metadata
- **Task Title:** Yield Optimizer
- **Task Slug:** `yield-optimizer`
- **Difficulty Tier:** `Hard`
- **Category:** `DeFi / Portfolio`
- **Points:** `200` (+50 with video walkthrough)
- **Target Platform:** `ai.pharos.xyz`

### 2.2 Verbatim Description & Scope
> **Short Summary:**  
> *"Compares yields across vaults and recommends or executes a rebalance."*
>
> **What you'll build:**  
> *"An agent that compares yields across vaults or pools, factors in costs, and recommends (or prepares) a rebalance when moving funds is actually worth it."*

### 2.3 Verbatim Acceptance Requirements
The official task defines four numbered requirements:
1. **Requirement 01:**  
   `"Compares at least 3 yield sources using live on-chain data."`
2. **Requirement 02:**  
   `"Accounts for gas, entry/exit fees, and a minimum holding period before recommending a move."`
3. **Requirement 03:**  
   `"Outputs a clear recommendation with expected net gain, or \"stay put\" with the reason."`
4. **Requirement 04:**  
   `"If executing: prepares transactions for user signature only. The agent never holds keys."`

> **Official Scoring Advisory:**  
> *"Reviewers score against this list. Missing items can mean partial points."*

### 2.4 Verbatim Submission Deliverables
- *"A proof link reviewers can open — a share link from ai.pharos.xyz, a tx hash on the explorer, or a deployed demo."*
- *"A repo link if you wrote code."*
- *"Optional: a video walking through the build for +50 points."*

---

## 3. Semantic & Technical Dissection of Requirement 01

The core tension in Task 15 lies in Requirement 01:
> *"Compares at least 3 yield sources using live on-chain data."*

We evaluate each operative phrase against financial and software engineering standards:

### 3.1 "Yield Source" vs. "Execution Alternative"
- **Yield Source (Economic Definition):** The underlying productive activity that generates capital return (e.g., PoS block emissions, borrower interest, trading fee accretion, credit yield).
- **Execution / Exit Alternative:** A transactional pathway to liquidate or enter an existing position (e.g., waiting in a 14-day protocol withdrawal queue vs. executing an instant secondary-market AMM swap).
- **Finding:** Exiting Faroo `stPROS` via an instant DEX swap incurs trading fees and slippage, whereas the protocol unbonding queue incurs zero exit fee and a 14-day time cost. While these represent different *liquidity profiles*, both positions hold identical underlying `stPROS` tokens earning the exact same underlying validator yield. Under strict financial taxonomy, an exit route is an **execution alternative**, NOT an independent yield source.

### 3.2 "Using Live On-Chain Data"
- **Live On-Chain Data:** State variables queryable via JSON-RPC from deployed bytecode on Pharos Pacific Mainnet that dynamically reflect economic value (e.g., `totalPooledPros() / totalSupply()` in `stPROS`, or cumulative fee growth in an AMM pool).
- **Off-Chain Target Rates:** Statically declared or advertised APYs that originate from off-chain legal contracts or marketing pages (e.g., Axil Prime Credit's 9.25% target APY).
- **Finding:** A contract that merely stores token balances without an on-chain automated yield accrual function does not provide "live on-chain yield data" unless the yield rate itself is calculable from on-chain state deltas.

### 3.3 "Across Vaults or Pools"
- The overview text states: *"An agent that compares yields across vaults or pools..."*
- This indicates the task expects comparison across deployed smart contract containers (ERC-4626 style vaults, staking pools, or liquidity pools) on Pharos Pacific Mainnet.

---

## 4. Semantic Dissection of Requirements 02, 03 & 04

### 4.1 Requirement 02: Cost Accounting & Holding Periods
- **Gas Costs:** Must be estimated using live `eth_gasPrice` and historical execution gas units.
- **Entry / Exit Fees:** 
  - Faroo Staking: 0% mint fee; 0% queue exit fee (with 14d delay) OR 0.30% DEX fee + swap slippage (instant).
  - Axil Prime Credit: Protocol performance/management fees and potential redemption fees.
- **Minimum Holding Period:** The optimizer cannot recommend a rebalance based on annualized headline return alone. If a move costs $1.50 in gas and fees, and the yield differential is 0.50% on a $100 position, the break-even holding period is 3 years! The agent must compute the break-even horizon $\tau_{\text{breakeven}}$ before recommending a rebalance.

### 4.2 Requirement 03: Decision Logic ("Move" vs. "Stay Put")
- If $\Delta \text{Net Yield} \times \text{Principal} \times \text{Holding Period} \le \text{Total Rebalance Costs}$, the agent **MUST** output `"stay put"` and explicitly display the economic reason (e.g., fees exceed projected yield benefit over the user's intended horizon).
- If switching yields positive net alpha after all friction, the agent outputs a clear recommendation with expected net gain in token units and percentage.

### 4.3 Requirement 04: Non-Custodial Transaction Preparation
- The agent must never request or store private keys.
- If rebalancing is selected, the agent must output an unsigned transaction payload (`to`, `data`, `value`, `gasLimit`) formatted for user signature via an injected wallet (EIP-1193 / MetaMask / Rabby).

---

## 5. Cross-Currency & Asset Class Boundaries

The prompt asks: *Can a cross-currency product qualify?*
- Faroo `stPROS` is denominated in **PROS**.
- Axil Prime Credit `APC3M` is denominated in **USDC**.
- Native holding baseline is **PROS**.

### Technical Evaluation:
Comparing a PROS staking yield (e.g., 8.0%) against a USDC private credit yield (e.g., 9.25%) is **apples-to-oranges** unless currency exchange rate volatility is factored in:
1. An investor holding PROS who swaps to USDC to capture an extra 1.25% APY takes on 100% directional exposure against PROS price appreciation. If PROS appreciates by 5% over the 90-day lockup, the user suffers severe net economic loss.
2. In Gate 2, if cross-currency assets are presented, the agent must clearly segregate them with a prominent **`CURRENCY_MISMATCH_RISK`** badge, or restrict direct automated rebalance recommendations to same-denomination assets.

---

## 6. Official Criteria Compliance Matrix

| Requirement | Strict Arena Standard | Feasibility on Pharos Pacific Mainnet |
| :--- | :--- | :--- |
| **01: ≥ 3 Yield Sources** | 3 independent yield sources with live on-chain rates | **TENSION:** Only 1 native liquid staking contract (`stPROS`) has live on-chain rate accrual. Axil is off-chain targeted; Native PoS has no EVM contract; DEX LP has no live rate query. |
| **02: Cost Accounting** | Gas + entry/exit fees + holding period | **FEASIBLE:** Fully calculable via RPC gas prices, protocol parameters, and break-even math. |
| **03: Move vs. Stay Put** | Defensible recommendation logic | **FEASIBLE:** Standard optimization engine with break-even thresholding. |
| **04: Non-Custodial** | Unsigned tx preparation only | **FEASIBLE:** Standard Web3 transaction construction. |
