# GATE 6.1 — THREE-SOURCE REQUIREMENT RESEARCH & AUDIT
## Exhaustive Protocol Discovery, On-Chain Accounting & Ecosystem Reality

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Task #15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Official RPC:** `https://rpc.pharos.xyz`  
**Date:** November 4, 2026  
**Auditor:** Antigravity AI  
**Scope:** Read-Only Technical & Financial Investigation  

---

## 1. Executive Summary & Core Invariant Verdict

Requirement 01 of the Pharos Agent Arena Task 15 states:
> *"Compares at least 3 yield sources using live on-chain data."*

Following rigorous on-chain investigation across smart contracts, block explorers, RPC method testing, and documentation on Pharos Pacific Mainnet:

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      TRUTH-FIRST ACCOUNTING INVARIANT                         ║
║  Current Count of Genuinely Qualifying Sources: EXACTLY 1 (Faroo stPROS)      ║
║  Three-Source Acceptance Requirement: NOT YET MET ON PACIFIC MAINNET          ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

The Pharos Pacific Mainnet DeFi ecosystem is in its nascent genesis phase. **Faroo Liquid Staking (`stPROS`)** is the sole deployed protocol that possesses an active economic yield stream, live callable EVM state variables, verifiable exchange-rate accrual, and permissionless rebalancing mechanics.

All other ecosystem candidates either:
1. Represent liquidation exit alternatives of the same protocol (DEX AMM swap exit).
2. Rely on off-chain contractual target returns rather than on-chain rate accrual (Axil APC3M).
3. Lack public indexing infrastructure to compute dynamic fee returns (Pharos DEX LP).
4. Lack permissionless EVM smart contract delegation interfaces (Native PoS staking).
5. Are deployed cross-chain on Ethereum Mainnet rather than Pharos L1 (Ember Alpha).
6. Remain in testnet demonstration phase without Mainnet liquidity (OpenFi / ELFi).

The Yield Optimizer faithfully exposes this reality, demonstrating why 1 source qualifies and why the other candidates are disqualified, rather than fabricating synthetic data to falsely claim 3 sources.

---

## 2. In-Depth Candidate Evaluation Matrix

Every candidate discovered on Pharos Pacific Mainnet is audited against the 13 required evaluation dimensions:

---

### Candidate 1: Faroo Liquid Staking (`stPROS` Patient Unbonding Queue)

| # | Dimension | Evaluation Finding |
| :-: | :--- | :--- |
| **1** | **Exact Contract Address** | Proxy: `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`<br>Implementation: `0xfd59860894e01773e9780b0d1dfae4ca2b56708d` |
| **2** | **Verified Identity & ABI** | ERC-4626 / ERC-20 Proxy compliant with EIP-1967 implementation slot (`0x360894a1...`). Verified methods: `deposit()`, `totalPooledPros()`, `totalSupply()`, `asset()`. |
| **3** | **Underlying Asset** | `PROS` (Native Layer-1 currency wrapped into WPROS `0x52C4...F0B0`). |
| **4** | **Live On-Chain Data Availability** | **AVAILABLE & DYNAMIC.** Queryable via `eth_call`: `0x01e1d114` (`totalPooledPros()`) and `0x18160ddd` (`totalSupply()`). |
| **5** | **Actual Yield Mechanism** | Proof-of-Stake validator consensus emissions + transaction fees aggregated by the Faroo node operator pool and credited to `totalPooledPros()`. |
| **6** | **Historical Accrual Evidence** | Verified across 100,000 blocks: Spot rate grew from `1.00390030` at block `#21924812` to `1.00491704` at block `#22024812` (+0.10128% over 29.2h). |
| **7** | **Entry Costs** | Gas only: ~180,000 gas units (~0.0018 PROS @ 10 Gwei) for Wrap + Approve + Deposit. 0% mint fee. |
| **8** | **Exit Costs** | Gas only: ~120,000 gas units (~0.0012 PROS) to queue and claim withdrawal. 0% protocol exit fee. |
| **9** | **Lockup / Minimum Period** | **14-day protocol unbonding epoch**. |
| **10** | **Liquidity & Exit Constraints** | Illiquid during the 14-day unbonding period. Funds cannot be redeemed prematurely through the queue. |
| **11** | **Independently Selectable?** | **YES.** Can be chosen independently as a primary holding strategy. |
| **12** | **Comparable to Other Sources?** | **YES.** Direct PROS denomination, exact mathematical APR calculation. |
| **13** | **Reliable Net Gain Calculation?** | **YES.** Formula: $\text{Gross Yield} - \text{Gas Costs} = \text{Net Alpha}$. |
| **VERDICT** | **QUALIFIES TOWARD REQ 01** | **QUALIFIED GENUINE SOURCE (Source #1 of 1).** |

---

### Candidate 2: Faroo Liquid DEX Exit (`stPROS` Instant AMM Liquidation)

| # | Dimension | Evaluation Finding |
| :-: | :--- | :--- |
| **1** | **Exact Contract Address** | DEX PoolManager: `0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550`<br>Paired Asset: `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0` (WPROS) |
| **2** | **Verified Identity & ABI** | Uniswap V4 PoolManager singleton architecture with pool swap methods. |
| **3** | **Underlying Asset** | `stPROS` / `WPROS` (Dual-asset liquidity pool). |
| **4** | **Live On-Chain Data Availability** | Secondary AMM spot price queryable via StateView `getSlot0()`. |
| **5** | **Actual Yield Mechanism** | **Same as Candidate 1.** Yield is generated entirely by Faroo's underlying validator pool. |
| **6** | **Historical Accrual Evidence** | Identical underlying stPROS share token accrual. |
| **7** | **Entry Costs** | Gas only: ~180,000 gas units (0% mint fee). |
| **8** | **Exit Costs** | Gas (~100,000 gas) + **0.30% swap fee + AMM slippage (~0.10%)** = **~0.40% total friction**. |
| **9** | **Lockup / Minimum Period** | **0 days (Instant execution)**. |
| **10** | **Liquidity & Exit Constraints** | Constrained by available AMM pool depth and dynamic price impact for large orders. |
| **11** | **Independently Selectable?** | As an execution/exit preference only, not as an independent yield asset. |
| **12** | **Comparable to Other Sources?** | Yes, evaluated within the friction model. |
| **13** | **Reliable Net Gain Calculation?** | **YES.** Requires break-even holding period of **$\ge 17.18\text{ days}$** to amortize exit fees. |
| **VERDICT** | **DISQUALIFIED AS INDEPENDENT SOURCE** | **EXECUTION ALTERNATIVE ONLY.** Changing the liquidation speed from 14-day queue to instant DEX swap does not create a separate yield source. |

---

### Candidate 3: Axil Prime Credit 3M RWA Vault (`APC3M`)

| # | Dimension | Evaluation Finding |
| :-: | :--- | :--- |
| **1** | **Exact Contract Address** | Vault: `0xD0428799FbC35557834d33121BA4472692c8908a`<br>Share Token: `0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0` |
| **2** | **Verified Identity & ABI** | R25 institutional credit vault contract; share token standard. |
| **3** | **Underlying Asset** | **`USDC`** (`0xC879C018dB60520F4355C26eD1a6D572cdAC1815`) — Not PROS. |
| **4** | **Live On-Chain Data Availability** | Token balances queryable, but **zero dynamic interest accrual or rebasing is queryable on-chain**. |
| **5** | **Actual Yield Mechanism** | Off-chain institutional private credit loans to real-world corporate borrowers. |
| **6** | **Historical Accrual Evidence** | **NONE on-chain.** The advertised rate (**8.00% – 9.25% APY**) is an off-chain target net return set by loan agreements. |
| **7** | **Entry Costs** | Gas + Double AMM swap friction (PROS $\to$ USDC) + institutional onboarding costs. |
| **8** | **Exit Costs** | Gas + Double AMM swap friction (USDC $\to$ PROS) + redemption fee. |
| **9** | **Lockup / Minimum Period** | **90 days (Quarterly redemption windows)**. |
| **10** | **Liquidity & Exit Constraints** | Requires institutional KYC/AML whitelisting; non-permissionless. |
| **11** | **Independently Selectable?** | Not for retail PROS rebalancing. |
| **12** | **Comparable to Other Sources?** | **NO.** Cross-currency risk (PROS vs. USDC price volatility dominates yield differential). |
| **13** | **Reliable Net Gain Calculation?** | **NO.** Model refuses to present off-chain target APY as verified on-chain yield. |
| **VERDICT** | **DISQUALIFIED AS ON-CHAIN SOURCE** | **OFF-CHAIN TARGET RATE & CROSS-CURRENCY RWA.** Disqualified under strict live on-chain criteria. |

---

### Candidate 4: Pharos DEX Liquidity Pool (Uniswap V4 Architecture)

| # | Dimension | Evaluation Finding |
| :-: | :--- | :--- |
| **1** | **Exact Contract Address** | PoolManager: `0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550`<br>StateView: `0x616434e941c5E53d44894bF9ca13D517927BF8aF` |
| **2** | **Verified Identity & ABI** | Uniswap V4 PoolManager singleton managing multiple pool keys with `unlock()` callbacks. |
| **3** | **Underlying Asset** | Dual-asset pairs (e.g., `stPROS/WPROS`, `PROS/USDC`). |
| **4** | **Live On-Chain Data Availability** | Instantaneous pool slot and cumulative fee growth queryable via StateView, but **dynamic 24h trading volume and annualized fee rate are NOT queryable via RPC**. |
| **5** | **Actual Yield Mechanism** | Liquidity provider fee accretion (0.30% per swap across pool ticks). |
| **6** | **Historical Accrual Evidence** | Requires multi-day continuous event log accumulation. No public subgraph (The Graph / Goldsky) is deployed on Pacific Mainnet. |
| **7** | **Entry Costs** | Gas: ~120,000 gas (~0.0012 PROS). |
| **8** | **Exit Costs** | Gas: ~100,000 gas (~0.0010 PROS) + LP divergence/impermanent loss risk. |
| **9** | **Lockup / Minimum Period** | 0 days (Permissionless LP withdrawal). |
| **10** | **Liquidity & Exit Constraints** | Dual-asset inventory exposure; tick range concentration. |
| **11** | **Independently Selectable?** | Yes, for liquidity providers. |
| **12** | **Comparable to Other Sources?** | Impermanent loss risk profile differs substantially from single-sided staking. |
| **13** | **Reliable Net Gain Calculation?** | **NO.** Rate is strictly marked `UNAVAILABLE`. Model refuses to fabricate synthetic volume. |
| **VERDICT** | **DISQUALIFIED DUE TO MISSING INDEXER** | **UNVERIFIED CANDIDATE (RATE UNAVAILABLE).** Valid yield primitive, but fee APR cannot be proven from on-chain RPC alone. |

---

### Candidate 5: Pharos Native PoS Consensus Staking (Direct Validator Bonding)

| # | Dimension | Evaluation Finding |
| :-: | :--- | :--- |
| **1** | **Exact Contract Address** | None deployed on EVM layer. (`0x0000000000000000000000000000000000000000`). |
| **2** | **Verified Identity & ABI** | Consensus-layer protocol mechanism documented in Pharos whitepaper. |
| **3** | **Underlying Asset** | `PROS` (Native Layer-1 currency). |
| **4** | **Live On-Chain Data Availability** | **NONE via EVM JSON-RPC.** RPC returned `-32601` for `pharos_getValidators` and `pos_getStakingInfo`. |
| **5** | **Actual Yield Mechanism** | L1 consensus block proposal emissions and transaction tip fees. |
| **6** | **Historical Accrual Evidence** | Documented nominal network parameter is **~8.50% gross APR**, but not queryable via contract state. |
| **7** | **Entry Costs** | Minimum validator hardware bond (32,000+ PROS deposit) + node infrastructure. |
| **8** | **Exit Costs** | 21-day consensus unbonding period. |
| **9** | **Lockup / Minimum Period** | **21 days**. |
| **10** | **Liquidity & Exit Constraints** | No permissionless retail delegation contract exists on Pacific Mainnet. Retail staking is marked *"Coming Soon" in Anvita Mate* on `port.pharos.xyz/stake`. |
| **11** | **Independently Selectable?** | Not by an EVM agent or retail user without running validator hardware. |
| **12** | **Comparable to Other Sources?** | Yes, represents the underlying benchmark for Faroo. |
| **13** | **Reliable Net Gain Calculation?** | **NO.** Cannot be executed or queried on-chain. |
| **VERDICT** | **DISQUALIFIED AS DELEGATABLE SOURCE** | **PARTIALLY VERIFIED (NO EVM INTERFACE).** Underlying consensus emission exists, but is inaccessible via EVM contracts. |

---

### Candidate 6: Ember Pharos Alpha Institutional Vault (`pAlpha`)

| # | Dimension | Evaluation Finding |
| :-: | :--- | :--- |
| **1** | **Exact Contract Address** | `0xC3AaCB558AFb635307B66fDb405188138576fc4c` (Deployed on **Ethereum Mainnet**, Chain ID 1). |
| **2** | **Verified Identity & ABI** | Institutional cross-chain ecosystem fund. |
| **3** | **Underlying Asset** | Multi-asset fund portfolio. |
| **4** | **Live On-Chain Data Availability** | Deployed on Ethereum L1, not Pharos Pacific Mainnet. |
| **VERDICT** | **DISQUALIFIED (CROSS-CHAIN)** | Not deployed on Pharos Pacific Mainnet (Chain ID 1672). |

---

### Candidate 7: Money Market / Lending Protocols (OpenFi / ELFi)

| # | Dimension | Evaluation Finding |
| :-: | :--- | :--- |
| **1** | **Status** | Tested in early private testnets. |
| **2** | **Mainnet Verification** | Zero verified lending pool contracts with active liquidity or borrowing demand exist on Pacific Mainnet at this time. |
| **VERDICT** | **DISQUALIFIED (UNLAUNCHED)** | No active contracts or liquidity on Mainnet. |

---

## 3. Summary of Disqualification Reasons

```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║ Candidate                 │ Primary Disqualification Reason                                  ║
╠═══════════════════════════╪══════════════════════════════════════════════════════════════════╣
║ 1. Faroo stPROS (Queue)   │ QUALIFIED — Sole genuine live on-chain yield source (1/1)        ║
║ 2. Faroo stPROS (DEX Swap)│ DISQUALIFIED — Exit/liquidity alternative of Faroo (same source) ║
║ 3. Axil Prime Credit      │ DISQUALIFIED — Off-chain target APY, USDC cross-currency, non-EVM║
║ 4. Pharos DEX LP          │ DISQUALIFIED — Fee APR unavailable without public indexer/subgraph║
║ 5. Native PoS Staking     │ DISQUALIFIED — Protocol parameter only; no EVM delegator contract ║
║ 6. Ember Alpha            │ DISQUALIFIED — Deployed cross-chain on Ethereum L1, not Pharos L1 ║
║ 7. Lending (OpenFi/ELFi)  │ DISQUALIFIED — Unlaunched on Pacific Mainnet; testnet only        ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 4. Legitimate Path to Close the Gap

To legitimately close the three-source requirement without violating Operating Rules #8 and #9, the following ecosystem developments must occur:

1. **Path 1: Deployment of a Public DEX Indexer / Subgraph:**  
   If the Pharos Foundation or an ecosystem indexer (e.g. Goldsky / The Graph) deploys a public GraphQL endpoint indexing Uniswap V4 pool swap events on Pacific Mainnet, the Yield Optimizer can consume historical 24h/7d volume to calculate live fee APR on-chain, qualifying **Pharos DEX LP as Source #2**.
2. **Path 2: Launch of Permissionless PoS Delegation Contract ("Anvita Mate"):**  
   When Pharos deploys its documented retail validator delegation smart contract on EVM layer (`port.pharos.xyz/stake`), direct native staking can be queried and executed via standard JSON-RPC, qualifying **Native PoS Consensus Staking as Source #3**.
3. **Path 3: Mainnet Launch of a Lending Protocol:**  
   When a decentralized money market (e.g. OpenFi or equivalent Compound/Aave fork) deploys on Pacific Mainnet, PROS supply rate interest can be queried via `supplyRatePerBlock()`, qualifying as a genuine lending source.

Until these external protocols deploy on Pacific Mainnet, maintaining the **honest disclosure of 1 qualifying source** is the single mathematically sound and auditor-defensible stance.
