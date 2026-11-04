# GATE 7A.4 — AUDIT 2: GAS MODEL COMPARISON & CLASSIFICATION
## Forensic Breakdown of 180k, 200k, and 265k Gas Models across Live and Conservative Assumptions

**Project:** Pharos Yield Optimizer  
**Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor:** Antigravity AI  
**Mode:** READ-ONLY Calculation & Classification Audit (No Source Edits)  

---

## 1. Executive Summary

This audit evaluates the three gas figures cited throughout the Gate 7A documentation:
1. **`180,000 gas`** (ERC-4626 3-step entry sequence)
2. **`200,000 gas`** (Direct-submit entry + unbond request lifecycle model)
3. **`265,000 gas`** (ERC-4626 3-step entry + unbond request cumulative physical lifecycle)

We classify each figure, detail its underlying assumptions, and independently compute its cost at both the live Pacific Mainnet gas price (**1.25 Gwei**) and the conservative baseline fixture (**10.0 Gwei**).

---

## 2. Rigorous Classification of Gas Figures

| Figure | Operations Included | Classification | Source File & Implementation |
|---|---|---|---|
| **`180,000 gas`** | Wrap PROS $\to$ WPROS (`45,000`)<br/>Approve stPROS (`45,000`)<br/>Deposit WPROS (`90,000`) | **Real Supported Execution Path** (Entry-Stage Calldata) | [`src/reviewer/transactionReviewer.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/reviewer/transactionReviewer.ts#L130). Concrete EVM calldata generated for wallet execution. |
| **`200,000 gas`** | Direct submit deposit (`115,000`)<br/>Unbond request queue (`85,000`) | **Theoretical Lifecycle Model** (Simulation Benchmark) | [`src/engine/frictionModel.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/frictionModel.ts#L78). Used by the recommendation engine to evaluate net yield. |
| **`265,000 gas`** | Wrap (`45,000`) + Approve (`45,000`) + Vault Deposit (`90,000`) + Unbond Request (`85,000`) | **Composite Physical Lifecycle** (3-Step Entry + Protocol Exit) | Synthesis of `TransactionReviewer` entry sequence + `frictionModel` exit queue. |

---

## 3. Detailed Model Definitions & Assumptions

### Model A: Canonical ERC-4626 Entry Sequence (180,000 gas units)
- **Applicability:** Native PROS holder entering Faroo Liquid Staking for the first time.
- **Assumptions:**
  1. User holds native PROS, requiring conversion to WPROS via `deposit()` on canonical WPROS contract.
  2. WPROS contract requires standard ERC-20 `approve(address,uint256)` before the Faroo vault can pull tokens.
  3. Faroo stPROS contract executes ERC-4626 `deposit(uint256,address)` which transfers WPROS and mints stPROS shares.
  4. Native asset uses 18-decimal scaling ($10^{18}\text{ wei}$).
- **Gas Breakdown:**
  - Wrap: $45,000\text{ gas}$ ($0xafc8$)
  - Approve: $45,000\text{ gas}$ ($0xafc8$)
  - Vault Deposit: $90,000\text{ gas}$ ($0x15f90$)
  - **Total Entry Gas:** **`180,000 gas units`**

### Model B: Protocol Direct-Submit Lifecycle (200,000 gas units)
- **Applicability:** Recommendation engine scenario evaluation for Faroo Patient Staking.
- **Assumptions:**
  1. Entry is performed via a single direct deposit call (`FAROO_DEPOSIT_SUBMIT: 115_000 gas`).
  2. Exit is performed via protocol queue request (`FAROO_REQUEST_WITHDRAW: 85_000 gas`).
  3. No protocol entry or exit fees are assessed ($0.00\text{ bps}$ verified on-chain).
  4. Native asset uses 18-decimal scaling.
- **Gas Breakdown:**
  - Entry submit: $115,000\text{ gas}$
  - Exit request: $85,000\text{ gas}$
  - **Total Modeled Lifecycle Gas:** **`200,000 gas units`**

### Model C: Composite Physical ERC-4626 Lifecycle (265,000 gas units)
- **Applicability:** Full physical execution for a user who executes the 3-step entry calldata from `TransactionReviewer` and later exits via `requestWithdraw`.
- **Assumptions:**
  1. Entry requires all 3 transactions (Wrap + Approve + Deposit = 180,000 gas).
  2. Exit requires submitting an unbonding queue order (`requestWithdraw` = 85,000 gas).
  3. Does not charge subsequent withdrawal claim or unwrapping (assuming user keeps WPROS or claim gas is negligible).
  4. Native asset uses 18-decimal scaling.
- **Gas Breakdown:**
  - Entry sequence: $180,000\text{ gas}$
  - Exit queue: $85,000\text{ gas}$
  - **Total Composite Lifecycle Gas:** **`265,000 gas units`**

---

## 4. Independent Cost Calculations

$$\text{Gas Cost in PROS} = \frac{\text{Gas Units} \times \text{Gas Price (Gwei)}}{10^9}$$

$$\text{Gas Cost in Wei} = \text{Gas Units} \times \text{Gas Price (Gwei)} \times 10^9$$

### Matrix of Independent Cost Computations:

| Gas Model | Total Gas Units | Gas Price | Cost in Wei | Cost in PROS (Exact) | Formatted PROS |
|---|---|---|---|---|---|
| **Model A (Entry Only)** | 180,000 | **1.25 Gwei** (Live) | $225,000,000,000,000\text{ wei}$ | $0.000225\text{ PROS}$ | `0.000225 PROS` |
| **Model A (Entry Only)** | 180,000 | **10.0 Gwei** (Fixture) | $1,800,000,000,000,000\text{ wei}$ | $0.001800\text{ PROS}$ | `0.001800 PROS` |
| **Model B (Modeled Lifecycle)** | 200,000 | **1.25 Gwei** (Live) | $250,000,000,000,000\text{ wei}$ | $0.000250\text{ PROS}$ | `0.000250 PROS` |
| **Model B (Modeled Lifecycle)** | 200,000 | **10.0 Gwei** (Fixture) | $2,000,000,000,000,000\text{ wei}$ | $0.002000\text{ PROS}$ | `0.002000 PROS` |
| **Model C (Composite Lifecycle)**| 265,000 | **1.25 Gwei** (Live) | $331,250,000,000,000\text{ wei}$ | $0.00033125\text{ PROS}$ | `0.000331 PROS` |
| **Model C (Composite Lifecycle)**| 265,000 | **10.0 Gwei** (Fixture) | $2,650,000,000,000,000\text{ wei}$ | $0.002650\text{ PROS}$ | `0.002650 PROS` |

---

## 5. Critical Distinction: Mutually Exclusive Entry Paths

It is mathematically invalid to add Model A (180,000 gas) and Model B (200,000 gas) together ($380,000\text{ gas}$), because **115,000 gas in Model B is an alternative entry abstraction to the 180,000 gas entry in Model A**:
- Either a user deposits via direct `submit()` (115,000 gas);
- OR a user deposits via `wrap + approve + deposit` (180,000 gas).
- Both entry paths result in the exact same on-chain state: user wallet holds `stPROS` shares.
- The only valid composite full lifecycle that reconciles `TransactionReviewer`'s concrete calldata with `frictionModel`'s queue exit is **Model C (265,000 gas units)**:
  $$\text{Composite Lifecycle} = \text{Model A Entry (180k)} + \text{Model B Exit Queue (85k)} = \mathbf{265,000\text{ gas units}}$$

The variance between Model B (200,000 gas) and Model C (265,000 gas) is exactly **`65,000 gas units`** ($0.00008125\text{ PROS}$ at 1.25 Gwei).
