# GATE 7A.5 — INSTANT DEX EXIT EVIDENCE & CALIBRATION GATE
## Verification Status, Parameter Provenance, and Execution Boundary Analysis

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`, 18 Decimals)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Executive Summary & Evidence Gate

In Gate 7A.4, an essential verification question was posed:
> *Is the 145,000 gas figure for instant DEX exit a verified on-chain measurement, or an empirical benchmark assumption? Can 325,000 gas units be certified as verified?*

### The Verdict
The Pharos Yield Optimizer **explicitly rejects** claiming that the instant DEX exit gas (145,000 units) or the combined instant exit lifecycle (325,000 units) are verified on-chain transaction receipts. 

In strict adherence to the project's zero-mock, evidence-based integrity standard:
1. **145,000 Gas Units:** Is an **unverified empirical benchmark assumption**, derived from standard Uniswap V4 single-hop swap profiles on EVM-compatible chains. It has **NOT** been validated by a live transaction receipt on Pharos Pacific Mainnet.
2. **Flagged & Disclosed:** The API and frontend explicitly tag this exit route with `isExitGasAssumed: true` and issue a clear disclaimer in `reasons` and `disclosures`.
3. **No Fabricated Calldata:** The system does **NOT** generate executable calldata for DEX swaps, because no official Uniswap V4 universal router contract address or ABI is integrated in the optimizer.

---

## 2. Parameter Decomposition & Provenance Matrix

The full friction profile for `faroo-instant-dex` is composed of four distinct elements:

| Friction Component | Value | Financial Impact on 1,000 PROS | Parameter Type | Provenance Status |
| :--- | :--- | :--- | :--- | :--- |
| **Entry Gas** | 180,000 units | 0.000225 PROS (@ 1.25 Gwei) | EVM Benchmark | Verified (3-Step ERC-4626) |
| **Exit Gas** | 145,000 units | 0.00018125 PROS (@ 1.25 Gwei) | AMM Benchmark | **Empirical Assumption (Unverified)** |
| **Total Gas** | **325,000 units** | **0.00040625 PROS** (@ 1.25 Gwei) | Combined Lifecycle | **Partially Assumed Benchmark** |
| **Swap Fee** | 30 bps (0.30%) | 3.000000 PROS | Pool Fee Parameter | Verified On-Chain (V4 Pool State) |
| **Slippage** | 10 bps (0.10%) | 1.000000 PROS | Execution Assumption | Conservative Model Standard |
| **Total Friction** | — | **4.00040625 PROS** | Total Drag | Comprehensive Friction |

### Key Insight: Economic Dominance of Fees over Gas
Notice that on 1,000 PROS:
- **Total Gas Cost:** $0.00040625\text{ PROS}$ ($0.0102\%$ of total friction).
- **Total Economic Drag (Fees + Slippage):** $4.000000\text{ PROS}$ ($99.9898\%$ of total friction).

Even if actual DEX swap gas varied between 100,000 and 250,000 gas units, the gas variance is less than $\pm 0.00013\text{ PROS}$. The economic decision is overwhelmingly governed by the $0.40\%$ combined fee/slippage cost ($4\text{ PROS}$ per $1,000\text{ PROS}$), requiring a minimum holding period of **$17.18\text{ days}$** at $8.50\%\text{ APY}$ just to break even.

---

## 3. On-Chain Infrastructure Inspection

During Gate 4 and Gate 7A live mainnet inspections, the following DEX contracts were verified on Pacific Mainnet (`1672`):
- `PoolManager`: `0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550`
- `StateView`: `0x616434e941c5E53d44894bF9ca13D517927BF8aF`

While `StateView` confirms that the Uniswap V4 pool architecture is deployed and operational with a 30 bps tier, the following execution components are intentionally **excluded** from automated transaction execution:
1. **Dynamic Fee Hooks:** Dynamic fee calculation is marked `UNAVAILABLE` because liquidity pool hooks have not established a multi-epoch volume history.
2. **Swap Router Calldata:** No router calldata is produced by `transactionReviewer.ts`. In the transaction review modal, selecting `faroo-instant-dex` renders entry calldata into Faroo stPROS alongside an explicit warning that secondary market liquidity must be accessed manually via external DEX interfaces.

---

## 4. Architectural Safeguards in Codebase

To prevent misrepresentation, the following safeguards are implemented:

### 1. Engine Safeguard (`src/engine/frictionModel.ts`)
```typescript
case 'faroo-instant-dex': {
  // Physical Entry (180k) + Assumed DEX Swap Exit (145k benchmark) = 325,000 gas
  const entryGasUnits = GAS_LIMITS.FAROO_WRAP_PROS + GAS_LIMITS.FAROO_APPROVE_WPROS + GAS_LIMITS.FAROO_VAULT_DEPOSIT; // 180,000
  const exitGasUnits = GAS_LIMITS.DEX_SWAP_EXACT_TOKENS; // 145,000 (assumed benchmark)
  const totalGasUnits = entryGasUnits + exitGasUnits;     // 325,000 gas units
  ...
  return {
    ...
    provenance: 'EXECUTION_ALTERNATIVE' as ProvenanceStatus,
    isComplete: true,
  };
}
```

### 2. Router & API Disclosures (`src/server/router.ts`)
```typescript
lifecycleGas: {
  entryGasUnits: 180_000,
  exitGasUnits: 145_000,
  modeledGasUnits: 325_000,
  gasPriceGwei: effectiveGasPriceGwei,
  gasCostPros: (325_000 * effectiveGasPriceGwei) / 1e9,
  isExitGasAssumed: true,
  exitGasEvidenceStatus: 'EMPIRICAL_BENCHMARK_ASSUMED_NO_LIVE_RECEIPT'
}
```

### 3. Yield Source Invariant Preservation
`faroo-instant-dex` is categorized as an **execution alternative route** for Faroo stPROS liquid staking, **NOT** as an independent or distinct yield-generating protocol.
- Qualifying yield sources remain strictly **1 of 3** (`Faroo Liquid Staking`).
- Status invariant strictly maintained: **`FEWER THAN THREE QUALIFYING SOURCES — REQUIREMENT NOT MET.`**
