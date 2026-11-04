# GATE 7A.5 — PATIENT LIFECYCLE GAS UNIFICATION REPORT
## Physical Execution Sequence, Parameter Reconciliation, and Mathematical Analysis

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`, 18 Decimals)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Executive Summary

In Gate 7A.4, an architectural discrepancy was identified between the analytical friction model (`src/engine/frictionModel.ts`) and the concrete transaction reviewer (`src/server/transactionReviewer.ts`):
- `frictionModel.ts` historically modeled entry as a single hypothetical direct submission benchmark of `115,000 gas units`, giving a lifecycle total of `200,000 gas units` ($115\text{k} + 85\text{k}$).
- `transactionReviewer.ts` generated concrete calldata for the real-world 3-step ERC-4626 vault entry sequence totalling `180,000 gas units` ($45\text{k} + 45\text{k} + 90\text{k}$).

Under Gate 7A.5, the friction model and transaction reviewer have been strictly unified onto the physical 3-step entry sequence and unbonding queue exit. The unified patient staking lifecycle is now established at **`265,000 gas units`**.

---

## 2. Physical Execution Sequence Breakdown

Every step in the patient staking lifecycle is mapped to concrete EVM operations, calldata specifications, and gas consumption benchmarks:

| Step | Operation | Contract Target | Function Selector / Signature | Verified Gas Benchmark |
| :--- | :--- | :--- | :--- | :--- |
| **Entry 1** | Wrap native PROS to WPROS | `0x6000000000000000000000000000000000000006` | `deposit()` (`0xd0e30db0`) | **45,000 gas** |
| **Entry 2** | Approve WPROS for Faroo Vault | `0x6000000000000000000000000000000000000006` | `approve(address,uint256)` (`0x095ea7b3`) | **45,000 gas** |
| **Entry 3** | Vault Deposit into stPROS | `0x192795B4687C5C118B80e668D346b0a7b45A82fF` | `deposit(uint256,address)` (`0x6e553f65`) | **90,000 gas** |
| **Entry Total** | **Full ERC-4626 Entry Sequence** | — | — | **180,000 gas** |
| **Exit** | Faroo Unbonding Queue Request | `0x192795B4687C5C118B80e668D346b0a7b45A82fF` | `requestWithdraw(uint256)` | **85,000 gas** |
| **Lifecycle** | **Complete Physical Staking Lifecycle** | — | — | **265,000 gas** |

### Elimination of the 115k Theoretical Direct Benchmark
The theoretical single-step entry benchmark (`115,000 gas units`), which assumed a native deposit wrapper payable function in a single call, was completely eliminated from `GAS_LIMITS` and `evaluateStrategyFriction('faroo-patient-staking')`. The system now directly references:
```typescript
const entryGasUnits = GAS_LIMITS.FAROO_WRAP_PROS + GAS_LIMITS.FAROO_APPROVE_WPROS + GAS_LIMITS.FAROO_VAULT_DEPOSIT; // 180,000
const exitGasUnits = GAS_LIMITS.FAROO_REQUEST_WITHDRAW; // 85,000
const totalGasUnits = entryGasUnits + exitGasUnits;     // 265,000 gas units
```

---

## 3. Mathematical Translation to PROS Costs

Using the 18-decimal scaling of the native PROS asset ($1\text{ PROS} = 10^{18}\text{ wei}$):

$$\text{Gas Cost (wei)} = \text{Gas Units} \times \text{Gas Price (Gwei)} \times 10^9$$
$$\text{Gas Cost (PROS)} = \frac{\text{Gas Cost (wei)}}{10^{18}}$$

### Case A: Live Network Base Gas Price (1.25 Gwei)
- **Entry Gas Cost (180,000 gas):**
  $$180,000 \times 1.25 \times 10^9 = 225,000,000,000,000\text{ wei} = \mathbf{0.000225\text{ PROS}}$$
- **Exit Gas Cost (85,000 gas):**
  $$85,000 \times 1.25 \times 10^9 = 106,250,000,000,000\text{ wei} = \mathbf{0.00010625\text{ PROS}}$$
- **Unified Lifecycle Gas Cost (265,000 gas):**
  $$265,000 \times 1.25 \times 10^9 = 331,250,000,000,000\text{ wei} = \mathbf{0.00033125\text{ PROS}}$$

### Case B: Conservative Offline Fallback Gas Price (10.0 Gwei)
- **Entry Gas Cost (180,000 gas):**
  $$180,000 \times 10.0 \times 10^9 = 1,800,000,000,000,000\text{ wei} = \mathbf{0.001800\text{ PROS}}$$
- **Exit Gas Cost (85,000 gas):**
  $$85,000 \times 10.0 \times 10^9 = 850,000,000,000,000\text{ wei} = \mathbf{0.000850\text{ PROS}}$$
- **Unified Lifecycle Gas Cost (265,000 gas):**
  $$265,000 \times 10.0 \times 10^9 = 2,650,000,000,000,000\text{ wei} = \mathbf{0.002650\text{ PROS}}$$

---

## 4. Scenario Evaluation & Decision Robustness

### Standard Horizon: 1,000 PROS over 60 Days
- **Principal:** $1,000\text{ PROS}$ ($1,000 \times 10^{18}\text{ wei}$)
- **Forward APY:** $8.50\%$ ($850\text{ bps}$)
- **Investment Horizon:** $60\text{ days}$
- **Gross Projected Yield:**
  $$\text{Gross Yield} = \frac{1,000 \times 0.085 \times 60}{365} = \mathbf{13.9726027\text{ PROS}}$$
- **Unified Friction Cost (at 1.25 Gwei):**
  $$\text{Friction} = \mathbf{0.00033125\text{ PROS}}$$
- **Net Projected Alpha:**
  $$\text{Net Alpha} = 13.9726027 - 0.00033125 = \mathbf{+13.9722715\text{ PROS}}$$
- **Break-Even Horizon:**
  $$\text{Daily Yield} = \frac{1,000 \times 0.085}{365} = 0.2328767\text{ PROS/day}$$
  $$\text{Break-Even Days} = \frac{0.00033125}{0.2328767} \approx \mathbf{0.0014224\text{ days}} \approx 122.9\text{ seconds}$$
  - UI Formatting: **`"~2 mins (< 1 day)"`**
- **Decision:** **`MOVE`** (`POSITIVE_NET_ALPHA`)
- **Robustness Comparison:**
  - Under former 200,000 gas model: Net alpha was $+13.972353\text{ PROS}$, break-even was $92.7\text{s}$ (`"~2 mins (< 1 day)"`).
  - Difference: Exactly $0.00008125\text{ PROS}$ ($\approx 30.1\text{ seconds}$ of yield). The decision, recommendation, and formatted break-even display remain identical and robust.

### Lockup Horizon: 1,000 PROS over 7 Days
- **Decision:** **`STAY_PUT`** (`HORIZON_SHORTER_THAN_LOCKUP`)
- **Reason:** 7-day horizon is less than Faroo protocol's mandatory 14-day unbonding queue lockup.

---

## 5. Provenance & Disclosures

1. **Physical Calldata Alignment:**
   - Both the recommendation engine and the transaction reviewer now model and output the exact same 3-step ERC-4626 sequence.
2. **Deterministic Reproducibility:**
   - All tests in `tests/unit/frictionModel.test.ts`, `tests/numericalVerification.ts`, and `tests/integration/vercelAdapter.test.ts` pass with zero mathematical divergence.
3. **No Phantom Gas Estimates:**
   - Gas benchmarks are documented as deterministic operation upper bounds, not fabricated transaction receipts.
