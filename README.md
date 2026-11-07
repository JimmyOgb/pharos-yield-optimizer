# Pharos Yield Optimizer

[![Production Status](https://img.shields.io/badge/Production-Live-success)](https://pharos-yield-optimizer.vercel.app/)
[![Network](https://img.shields.io/badge/Network-Pharos%20Pacific%20Mainnet%20(1672)-blue)](https://rpc.pharos.xyz)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Test Suite](https://img.shields.io/badge/Tests-190%20Passing%20(100%25)-brightgreen)](https://github.com/JimmyOgb/pharos-yield-optimizer)

> **Non-custodial, truth-first yield intelligence agent for Pharos Pacific Mainnet.**  
> Solves the headline APY illusion by enforcing verifiable on-chain evidence, complete physical lifecycle gas deductions, mandatory unbonding delay modeling, and fail-closed liquidity protection.

---

## ⚡ How to Test (For Judges & Evaluators)

Reproduce all 190 tests, numerical verifications, and build steps in seconds:

```bash
# 1. Clone the repository
git clone https://github.com/JimmyOgb/pharos-yield-optimizer.git
cd pharos-yield-optimizer

# 2. Install dependencies (Node.js >= 18)
npm install

# 3. Run complete test suite (190 tests across 10 test suites)
npm test

# 4. Run standalone numerical precision verification
npm run verify:numerical

# 5. Typecheck TypeScript sources
npm run typecheck

# 6. Build production bundles
npm run build

# 7. Start local server (Runs at http://localhost:3000)
npm start
```

**Live Production URL:** [`https://pharos-yield-optimizer.vercel.app/`](https://pharos-yield-optimizer.vercel.app/)

---

## 1. What Pharos Yield Optimizer Does

The **Pharos Yield Optimizer** is an autonomous financial intelligence agent designed for **Pharos Pacific Mainnet (Chain ID 1672)**. It provides retail and institutional users with mathematical certainty when evaluating yield opportunities between holding native PROS and delegating or staking into on-chain protocols.

Key capabilities:
- **Real-Time On-Chain Polling:** Direct JSON-RPC connection to `https://rpc.pharos.xyz` tracking blocks, live gas prices, and verifiable contract state.
- **Dynamic Yield-Source Coverage:** Tracks 3 live on-chain protocols with honest classification between actionable staking and informational benchmarks.
- **Complete Physical Lifecycle Accounting:** Models complete transaction costs—including wrapping to WPROS (45k gas), token approvals (45k gas), vault deposit (90k gas), and unbonding queue submission (85k gas), totaling 265,000 gas units.
- **Deterministic Mathematical Engine:** Calculates net alpha after deducting all gas and fees, enforcing a minimum **0.10 PROS meaningful alpha threshold** and mandatory **15-day unbonding period**.
- **Non-Custodial Transaction Reviewer:** Prepares unsigned, human-readable calldata for external review with recipient address validation. Never holds private keys, signs transactions, or broadcasts state changes.
- **Fail-Closed Liquidity Guard:** Detects secondary liquidity availability and refuses to generate calldata for unbacked routes.

---

## 2. The Problem It Solves

Decentralized finance is plagued by **headline APY deception**:
1. **Unbonding & Lockup Traps:** Protocols advertise high annualized yields while hiding 14–21 day unbonding queues during which assets earn 0% and cannot be moved.
2. **Ignored Lifecycle Friction:** Naive calculators ignore multi-step ERC-4626 wrap, approve, and deposit friction, recommending rebalancing moves where transaction gas exceeds total earned yield.
3. **Dual-Asset Divergence & Impermanent Loss:** Platforms conflate AMM liquidity pool turnover with risk-free staking yields, exposing users to 50% foreign token volatility and divergence loss.
4. **Phantom Secondary Liquidity:** Promising instant DEX exits without verifying that an on-chain liquid secondary market pair actually exists.

The Pharos Yield Optimizer resolves these distortions through deterministic, truth-first mathematical evaluation.

---

## 3. Network Architecture & Canonical Contracts

- **Network:** Pharos Pacific Mainnet
- **Chain ID:** `1672` (`0x688`)
- **Native Currency:** `PROS` (18 decimals)
- **RPC Endpoint:** `https://rpc.pharos.xyz`

### Verified On-Chain Protocol Addresses

| Component / Protocol | Contract Address | Type / Mechanism | Operational Role |
| :--- | :--- | :--- | :--- |
| **Canonical WPROS** | `0x52c48d4213107b20bc583832b0d951fb9ca8f0b0` | ERC-20 Wrapper | Intermediate token for ERC-4626 vault interactions. |
| **Faroo Liquid Staking Proxy** | `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4` | EIP-1967 Transparent Proxy | Minting `stPROS` shares compounding via exchange rate. |
| **Faroo Vault Implementation** | `0xfd59860894e01773e9780b0d1dfae4ca2b56708d` | ERC-4626 Implementation | Underlying vault accounting (`totalPooledPros` & `totalSupply`). |
| **Pharos Native PoS Precompile** | `0x4100000000000000000000000000000000000000` | Native Consensus Precompile | Consensus validator staking (queryable via `getDelegator`). |
| **FaroSwap V3 WPROS/USDC Pool** | `0x4146d192da6428c9e1c243d2a953c625b5765623` | Uniswap V3 Pool (0.30% fee) | Dual-asset concentrated liquidity benchmark. |
| **Pharos USDC** | `0xc879c018db60520f4355c26ed1a6d572cdac1815` | ERC-20 Stablecoin | Paired with WPROS in FaroSwap V3 pool. |

---

## 4. Yield Source Coverage & Honest Classifications

The optimizer monitors 3 independent protocols on Pharos Pacific Mainnet with strict classifications:

| Source | Category | Classification | Live On-Chain Metric | Lockup / Horizon | Actionable Rebalance Destination? |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Faroo Liquid Staking (stPROS)** | Liquid Staking | `ACTIONABLE_VERIFIED` | `1.00741608 PROS/stPROS` (Spot Exchange Rate) | 14d Queue + 1d Buffer (15 Days Total) | **YES** (Only single-asset staking pool) |
| **Pharos Native PoS Staking** | Consensus Staking | `NOT_AVAILABLE_FOR_ENTRY` | `29.98% APR` (Historical Delegator Return) | 21 Days (Consensus Epoch) | **NO** (Retail interface not permissionless) |
| **FaroSwap V3 WPROS/USDC LP** | AMM Concentrated Liquidity | `LIVE_INFORMATIONAL` | `6.26% APR` (Full-Range Passive Benchmark) | 0 Days (Dual-Asset Exposure) | **NO** (Informational dual-asset benchmark) |

### APY Provenance & Taxonomy Distinctions
- **`LIVE_DERIVED_ESTIMATE`:** Faroo spot exchange rate (`1.00741608`) is queried directly on-chain by dividing `totalPooledPros()` (`0x01e1d114`) by `totalSupply()` (`0x18160ddd`).
- **`FORWARD_SCENARIO_ASSUMPTION`:** The `8.50% APR` parameter used in forward cash-flow simulations is a conservative macro model of post-dilution consensus equilibrium, clearly disclosed as a scenario input.
- **`HISTORICAL_REALIZED_RATE`:** The Native PoS `29.98%` figure represents the historical annualized reward delta of an observed delegator (`0xec1d...d612`) over 3.80 days, not a guaranteed forward rate.
- **`POOL_LEVEL_BENCHMARK`:** FaroSwap `6.26%` is an empirical fee-growth benchmark for passive full-range liquidity, while `15.56%` represents aggregate 24-hour pool fee turnover.

---

## 5. Recommendation Engine & Decision Rules

The engine evaluates rebalancing opportunities through strict mathematical decision rules:

$$\text{Gross Yield} = \text{Principal} \times \text{Forward Rate} \times \left(\frac{\text{Horizon Days}}{365}\right)$$

$$\text{Net Alpha} = \text{Gross Yield} - \text{Total Lifecycle Friction}$$

### Decision Rules:
1. **Horizon Eligibility Rule:** If $\text{Horizon Days} < \text{Lockup Days}$ (15 days for Faroo), the decision is immediately `STAY_PUT` with reason `HORIZON_SHORTER_THAN_LOCKUP`.
2. **Instant Liquidity Rule:** If the user requires instant liquidity (`requiresInstantLiquidity: true`), the engine verifies secondary DEX liquidity. Because no verified secondary pool exists for stPROS, the decision evaluates to `STAY_PUT` with `NO_VERIFIED_SECONDARY_LIQUIDITY`.
3. **Meaningful Alpha Threshold Rule:** If $\text{Net Alpha} \le 0\text{ PROS}$, the decision is `STAY_PUT`. If $0 < \text{Net Alpha} < 0.10\text{ PROS}$, the decision is `STAY_PUT` with reason `TIE_NO_MEANINGFUL_ALPHA` (protecting against micro-gains that fail to justify smart contract risk).
4. **Actionable MOVE Recommendation:** When $\text{Horizon} \ge 15\text{ days}$ and $\text{Net Alpha} \ge 0.10\text{ PROS}$, the engine issues a `MOVE` recommendation, providing complete break-even elapsed time and net yield advantages.

---

## 6. Non-Custodial Safety Model

1. **Zero Private Key Access:** The agent never requests, stores, or touches private keys, seed phrases, or credentials.
2. **Unsigned Calldata Review:** All recommendations generate reviewable, raw hexadecimal transaction payloads.
3. **Recipient Address Validation:** Step 3 (stPROS vault deposit) requires a valid 40-character hex Pacific Mainnet address. The engine strictly rejects zero-address (`0x0000...0000`) destinations.
4. **Fail-Closed Execution:** If an execution route lacks verifiable on-chain liquidity or unbonding routes, calldata preparation is disabled (`isReadyForExternalReview: false`).

---

## 7. Project Structure

```
pharos-yield-optimizer/
├── api/                          # Vercel serverless function entrypoints
│   ├── health.js                 # GET /api/health
│   ├── index.js                  # GET / (HTML delivery)
│   ├── recommendation.js         # POST /api/recommendation
│   ├── sources.js                # GET /api/sources
│   └── transaction-review.js     # POST /api/transaction-review
├── demo/                         # Walkthrough video and review assets
│   ├── pharos-yield-optimizer-walkthrough.mp4  # 1080p live walkthrough video
│   ├── PHAROS_TASK15_VIDEO_SCRIPT.md           # Timestamped scene script
│   └── PHAROS_TASK15_VIDEO_REVIEW.md           # Production video review
├── docs/                         # Architectural & economic audit documents
├── public/                       # Static web dashboard assets
├── src/
│   ├── adapters/                 # On-chain RPC adapters (Faroo, PoS, FaroSwap)
│   ├── engine/                   # Recommendation engine & BigInt yield math
│   ├── reviewer/                 # Non-custodial calldata reviewer
│   ├── server/                   # Native Node.js router & API handlers
│   └── types/                    # Core TypeScript definitions & constants
└── tests/
    ├── integration/              # Live Pacific Mainnet RPC smoke tests
    └── unit/                     # Unit test suites (Math, Adapters, Reviewer)
```

---

## 8. Configuration

No environment variables are required for standard read-only operations. To customize the RPC endpoint:

```env
# Optional RPC override (Defaults to https://rpc.pharos.xyz)
PHAROS_RPC_URL="https://rpc.pharos.xyz"

# Optional port for local server (Defaults to 3000)
PORT=3000
```

---

## 9. Known Limitations & Disclosures

1. **Single Actionable Source on Mainnet:** Faroo Liquid Staking is currently the only single-asset PROS yield strategy with open public deposit capability on Pacific Mainnet. Native PoS requires validator-level infrastructure, and FaroSwap involves dual-asset exposure.
2. **Secondary DEX Liquidity:** No verified secondary liquidity pool currently exists for stPROS. Unbonding must proceed through the 14-day protocol queue plus 1-day safety buffer.
3. **Macro Model Assumption:** Forward gross yields are modeled using an illustrative 8.50% APR baseline. Actual validator performance and emission dilution may cause realized yield to vary.

---

## 10. License

MIT License. Copyright (c) 2026 JimmyOgb.
