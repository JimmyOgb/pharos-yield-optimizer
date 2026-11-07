# PHAROS TASK 15 — GATE 9: THREE-SOURCE YIELD OPTIMIZER IMPLEMENTATION PLAN (REVISED GATE 9.3)

**Project:** Pharos Yield Optimizer  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Network:** Pharos Pacific Mainnet — Chain ID `1672` (`0x688`), RPC `https://rpc.pharos.xyz`  
**Accepted Baseline Commit:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec`  
**Production URL:** `https://pharos-yield-optimizer.vercel.app` (unaffected)  
**Revision Date:** November 7, 2026 (Gate 9.3 Economic Re-Alignment)  
**Status:** Comprehensive Technical Blueprint — Awaiting Authorized Implementation  

---

## 1. Executive Summary & Architecture Mission

The Pharos Yield Optimizer currently operates under an accepted baseline (`53bbf0fc`) where only one source (**Faroo Liquid Staking stPROS**) is fully qualified, while previous secondary candidates (Axil APC3M and Uniswap V4 DEX) were properly disqualified or marked unavailable.

Following the empirical evidence established in Gates 8A–8D, and the final economic reconciliations of Gates 9.1–9.3, this plan outlines the blueprint to transition the application to a **genuine, economically rigorous Three-Source Yield Optimizer** on Pharos Pacific Mainnet (Chain ID 1672):

```
                               ┌──────────────────────────────────────────────────────────┐
                               │           Pharos Pacific Mainnet (Chain ID 1672)         │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │ JSON-RPC (https://rpc.pharos.xyz)
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │             PharosRpcClient (Transport & Cache)          │
                               └──────┬─────────────────────┼──────────────────────┬──────┘
                                      │                     │                      │
                   ┌──────────────────┴────────┐ ┌──────────┴───────────┐ ┌────────┴─────────────────┐
                   │    FarooAdapter (stPROS)  │ │   NativePosAdapter   │ │    FaroSwapV3Adapter     │
                   │    0x6b0A...5Ec4          │ │   0x4100...0000      │ │    0x4146...5623         │
                   │    QUALIFIED_LIVE         │ │   QUALIFIED_LIVE     │ │    QUALIFIED_W_DISCLOSURE│
                   │    (15d Hard Barrier)     │ │   (21d Unbond Epoch) │ │    (Full-Range Benchmark)│
                   └──────────────────┬────────┘ └──────────┬───────────┘ └────────┬─────────────────┘
                                      │                     │                      │
                                      └─────────────────────┼──────────────────────┘
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │             Normalized Yield Registry & Bridge           │
                               │        Dual-Model: Historical Trailing vs Forward Scen   │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                               ┌────────────────────────────┴─────────────────────────────┐
                               │               Deterministic Recommendation Engine        │
                               │          (Horizon Filtering, Friction Model, Alpha)      │
                               │          (TIE_NO_MEANINGFUL_ALPHA Standardized Handler)  │
                               └──────┬────────────────────────────────────────────┬──────┘
                                      │                                            │
                                      ▼                                            ▼
                       ┌──────────────────────────────┐             ┌──────────────────────────────┐
                       │     REST / Serverless API    │             │   Non-Custodial Tx Reviewer  │
                       │   /api/sources, /api/recom   │             │   Unsigned Calldata (No-Sign)│
                       └──────────────┬───────────────┘             └──────────────┬───────────────┘
                                      │                                            │
                                      └─────────────────────┬──────────────────────┘
                                                            ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │          Professional Responsive Dashboard UI           │
                               │    (3 Source Cards, Badges, Disclosures, Comparison Table│
                               └──────────────────────────────────────────────────────────┘
```

---

## 2. Assessment of Existing Baseline Architecture

### 2.1 Current State & Invariants
- **Git Commit:** `53bbf0fc23bde1ef3bdd97f0c153eca8e5cc27ec` (HEAD).
- **Unit Test Suite:** 123 tests passing with 0 failures across 44 test suites.
- **Legacy Limitations:**
  1. `STRATEGY_PROFILES` defines only `faroo-patient-staking` as `qualifiesTowardReq01: true`.
  2. `axil-prime-credit-3m` remains registered as an off-chain target rate in USDC (properly excluded from rebalance recommendations, but taking up a slot).
  3. `dexAdapter.ts` inspects Uniswap V4 PoolManager (`0xD681...4550`), which lacks volume on Pacific Mainnet and permanently returns `dynamicFeeAprStatus: 'UNAVAILABLE'`.
  4. Integration tests in `liveRpc.test.ts` enforce an aggressive 1,000ms timeout that fails under peak RPC latency.

### 2.2 Refactoring Objectives
- Retire `Axil Prime Credit` and `Uniswap V4 DEX` from active comparison slots.
- Introduce `NativePosAdapter` for consensus precompile `0x4100...0000`.
- Replace `dexAdapter.ts` with `FaroSwapV3Adapter` targeting live pool `0x4146...5623`.
- Update `RecommendationEngine` to compute net outcomes across both **Historical-Rate** and **Forward-Rate** scenarios for 7, 14, 30, and 90 days.
- Implement deterministic tie-breaking logic (`TIE_NO_MEANINGFUL_ALPHA`) and hard 15-day Faroo unbonding constraints.
- Update `TransactionReviewer` with verified calldata encoders for Native PoS delegation and FaroSwap LP actions.

---

## 3. Modular Three-Source Architecture Specification

### 3.1 Common Normalized Yield Interface (`NormalizedYieldSource`)

```typescript
export type SourceQualityStatus = 
  | 'QUALIFIED_LIVE' 
  | 'QUALIFIED_WITH_DISCLOSURE' 
  | 'UNVERIFIED' 
  | 'UNAVAILABLE';

export interface NormalizedYieldSource {
  readonly id: 'faroo-stpros' | 'native-pos-staking' | 'faroswap-wpros-usdc-lp';
  readonly name: string;
  readonly protocol: string;
  readonly contractAddress: string;
  readonly primaryAsset: 'PROS' | 'WPROS' | 'WPROS_USDC_LP';
  readonly qualityStatus: SourceQualityStatus;
  readonly tvlUsd: number;
  readonly tvlNativePros: number;
  readonly spotPriceUsd: number;
  readonly trailingAnnualizedApr: number;      // Empirical rate from historical blocks
  readonly forwardScenarioAprBps: number;       // Configured scenario input (e.g. 850 bps)
  readonly observationBlock: number;
  readonly observationTimestamp: number;
  readonly observationWindowSeconds: number;
  readonly entryGasUnits: number;
  readonly exitGasUnits: number;
  readonly entryFeeBps: number;
  readonly exitFeeBps: number;
  readonly lockupDays: number;                 // Mandatory unbonding epoch
  readonly settlementBufferDays: number;       // Safety buffer (1 day)
  readonly totalSettlementDays: number;        // lockupDays + settlementBufferDays
  readonly currencyRiskBadge?: string;         // e.g. "50% USD Exposure + Impermanent Loss"
  readonly disclosures: string[];              // Mandatory risk & modeling disclosures
}
```

---

### 3.2 Source 1: Faroo Liquid Staking (`stPROS`) & Exit Route Separation

#### A. Route Separation Invariant & On-Chain Observations
On-chain queries at Block `#22351475` on the canonical FaroSwap V3 Factory (`0x2c90CcB0b989afA2433F499698451a25744A552b`) via `getPool(stPROS, WPROS, fee)` across fee tiers 100, 500, 3000, 10000 bps returned zero addresses (`0x000...000`). On the inspected V2 Factory (`0x18Fab...7B09`), `getPair` reverted with empty data, so V2 pair absence was not conclusively established by that query.
Therefore:
1. **Route A: Patient Protocol Redemption Queue (Native Feature)**
   - Status: **CONFIRMED AVAILABLE**.
   - Liquidity: Backed by validator-staked pool reserves.
   - Redemption Fee: 0.00%.
   - Slippage: 0.00% (redeems at exact exchange rate $R_t$).
   - Gas Cost: ~85,000 gas (~0.00085 PROS).
   - Settlement Duration: **14 full days + 1 day settlement buffer = 15 days total**.
2. **Route B: Instant Secondary Market AMM Swap**
   - Status: **UNAVAILABLE on inspected V3 pools; V2 absence not conclusively established** (0.00 PROS verified depth).

#### B. Hard 15-Day Horizon Eligibility Constraint
- Because Route B has zero verified liquidity on the inspected pools, the **15-day total redemption and settlement duration is a hard eligibility barrier**.
- **7-Day Horizon:** **STRICTLY INELIGIBLE**. Recommendation: `STAY_PUT` (reason: `LOCKUP_EXCEEDS_HORIZON_FOR_ALL_QUALIFIED_SOURCES`).
- **14-Day Horizon:** **STRICTLY INELIGIBLE**. Capital cannot be returned within 14 days ($15 > 14$). Recommendation: `STAY_PUT`. Any 14-day figures are badged:
  > **INFORMATIONAL ONLY — NOT REALIZABLE WITHIN 14 DAYS (REQUIRES 15 DAYS TOTAL REDEMPTION & SETTLEMENT)**
- **Classification:** **`QUALIFIED_LIVE`**.

---

### 3.3 Source 2: Pharos Native PoS Consensus Staking
- **Precompile Address:** `0x4100000000000000000000000000000000000000`
- **Underlying Asset:** Native PROS.
- **Risk Characterization:**
  > **"No ERC-4626 wrapper or third-party staking-contract exposure; native protocol, precompile implementation, consensus, and validator-related risks remain."**
- **Method Selectors:**
  - `delegate(bytes32 poolId)`: `0x5c19a95c` (payable)
  - `undelegate(bytes32 poolId)`: `0x51cff8d9`
  - `claimReward(bytes32 poolId)`: `0x8c79c882`
  - `getDelegator(bytes32 poolId, address delegator)`: `0x3a6d6bae`
- **Reward Accounting Reconciliation Invariant:**
  - `totalRewardsClaimed` (word 7 of tuple) tracks cumulative claimed rewards.
  - `rewards` (word 3 of tuple) tracks accrued, unclaimed rewards.
  - Total reward attributable to delegator is strictly $\text{totalRewardsClaimed} + \text{rewards}$.
  - Double counting between claimed and unclaimed rewards is strictly prevented.
- **Lockup & Horizon Invariant:**
  - Calling `undelegate(bytes32)` sets `isPendingUndelegate = true` and starts a **strict 21-day network unbonding epoch**.
  - Pending stake does NOT accumulate rewards during unbonding.
  - Capital cannot be withdrawn before 21 days. Strictly ineligible for horizons $< 21$ days (7d and 14d).
- **Classification:** **`QUALIFIED_LIVE`**.

---

### 3.4 Source 3: FaroSwap Uniswap V3 LP (`WPROS/USDC`)

#### A. Full-Range Position Default Benchmark
- In Uniswap V3, concentrated ranges (e.g. $\pm 20\%$) boost capital efficiency to 71.87% APR, but carry severe out-of-range risk and impermanent loss.
- The optimizer **MUST adopt the Standard Full-Range Position ($[-887220, 887220]$) as the default benchmark**:
  - Requires zero active management or price rebalancing.
  - Position liquidity: $L_{\text{pos}} = 3.67196 \times 10^{14}$ in range $[-887220, 887220]$ (confirmed initialized on-chain).
  - Active liquidity share: $0.1273\%$.
  - Daily fee accrual: **0.1716 PROS/day** on 1,000 PROS principal.
  - Gross Fee Return: **6.26% APR**.
- **Pool-Level Fee APR (15.56%)** must be displayed solely as an aggregate pool turnover metric and clearly labeled as non-representative of passive individual LP positions.

#### B. Friction & Conversion Accounting
For a 1,000 PROS capital deployment:
- Swap 50% PROS $\leftrightarrow$ USDC: 0.30% entry (1.50 PROS) + 0.30% exit (1.50 PROS) = **`3.00 PROS swap fee`**.
- Execution Gas: ~740,000 gas @ 10 Gwei = **`0.0074 PROS`**.
- Total Fixed Friction: **`3.0074 PROS`**.
- Breakeven Horizon: **17.53 days** (Full-Range @ 6.26%) / **7.05 days** (Pool Benchmark @ 15.56%).
- Impermanent Loss formula: $\text{IL}(k) = \frac{2\sqrt{k}}{1+k} - 1$ where $k = P_{\text{exit}} / P_{\text{entry}}$.
- **Actionable Status:** Qualified as `QUALIFIED_WITH_DISCLOSURE` for comparative reporting. Automated `MOVE` recommendations to LP remain disabled by default.

---

## 4. Dual-Model Common Economic Framework

### 4.1 Provenance Classification & Scenarios
1. **Model 1: Historical Realized Trailing Scenario**
   - Faroo stPROS: **26.14% APR** (Blocks `#21924812` $\to$ `#22348179`, 4.79 days).
   - Native PoS Consensus: **29.98% APR** (Blocks `#22004812` $\to$ `#22348500`, 3.80 days).
   - FaroSwap Full-Range LP: **6.26% APR** (Blocks `#22004812` $\to$ `#22348300`, 3.80 days).
   - FaroSwap Pool TVL Average: **15.56% APR** (Pool turnover indicator).
   - *Disclosure:* Realized historical observations. Not guaranteed forward yield.
2. **Model 2: Conservative Forward-Rate Scenario**
   - Staking Baseline Input: **8.50% APR** (`FORWARD_SCENARIO_ASSUMPTION_850_BPS`).
     - *Provenance:* Configured scenario modeling assumption based on network emission equilibrium. Not published as a live APY on `docs.pharos.xyz`.
   - FaroSwap Full-Range LP: **6.26% fee yield**.

### 4.2 Reconciled Universal Economic Horizon Matrix (Principal = 1,000 PROS)

```
========================================================================================================================
                                     HISTORICAL TRAILING SCENARIO
========================================================================================================================
Horizon   Faroo stPROS (26.14%)      Native PoS (29.98%)        FaroSwap LP (6.26% Pos)    Actionable Decision
------------------------------------------------------------------------------------------------------------------------
7 Days    INELIGIBLE (15d Queue+Buf) INELIGIBLE (21d Unbond)    -1.81 PROS (Negative)      STAY_PUT (PROS Baseline)
14 Days   INELIGIBLE (15d Queue+Buf) INELIGIBLE (21d Unbond)    -0.61 PROS (Negative)      STAY_PUT (PROS Baseline)
30 Days   +21.48 PROS (+2.15%)       +24.64 PROS (+2.46%)       +2.14 PROS (+0.21%)        MOVE -> Native PoS Staking
90 Days   +64.45 PROS (+6.45%)       +73.92 PROS (+7.39%)       +12.43 PROS (+1.24%)       MOVE -> Native PoS Staking
========================================================================================================================
                                     CONSERVATIVE FORWARD SCENARIO (8.50% Scenario Baseline)
========================================================================================================================
Horizon   Faroo stPROS (8.50%)       Native PoS (8.50%)         FaroSwap LP (6.26% Pos)    Actionable Decision
------------------------------------------------------------------------------------------------------------------------
7 Days    INELIGIBLE (15d Queue+Buf) INELIGIBLE (21d Unbond)    -1.81 PROS (Negative)      STAY_PUT (PROS Baseline)
14 Days   INELIGIBLE (15d Queue+Buf) INELIGIBLE (21d Unbond)    -0.61 PROS (Negative)      STAY_PUT (PROS Baseline)
30 Days   +6.98 PROS (+0.70%)        +6.98 PROS (+0.70%)        +2.14 PROS (+0.21%)        TIE_NO_MEANINGFUL_ALPHA
90 Days   +20.96 PROS (+2.10%)       +20.96 PROS (+2.10%)       +12.43 PROS (+1.24%)       TIE_NO_MEANINGFUL_ALPHA
========================================================================================================================
```

---

## 5. Deterministic Tie-Breaking & Decision Engine Rules

### 5.1 Deterministic Forward-Scenario Tie Handling (`TIE_NO_MEANINGFUL_ALPHA`)
In the 8.50% forward scenario, Native PoS ($+6.9844\text{ PROS}$) and Faroo stPROS ($+6.9837\text{ PROS}$) differ by $0.0007\text{ PROS}$ at 30 days. The returns are not mathematically identical, but the difference falls below our stated **$0.10\text{ PROS}$ meaningful-alpha threshold**.

1. **Current Position Invariance:** If the user currently holds either `Native PoS` or `Faroo stPROS`, the engine strictly outputs **`STAY_PUT`** with reason `TIE_NO_MEANINGFUL_ALPHA`.
2. **Rebalance from Baseline (Tie-Breaker Rule):** When deploying uncommitted capital from `native-pros-baseline`, the engine presents both as top contenders tied under the threshold and discloses their structural trade-offs:
   - **Native PoS Profile:** No ERC-4626 wrapper or third-party staking-contract exposure; native protocol, precompile implementation, consensus, and validator-related risks remain. Unbonding: 21 days.
   - **Faroo stPROS Profile:** Shorter total unbonding duration: 15 days (14d queue + 1d buffer) vs 21 days for PoS. ERC-20 composability. Carries EIP-1967 proxy risk (`0x6b0A...5Ec4`) and protocol dependency.
3. **Engine Output:** If no user preference is specified, the system outputs `TIE_NO_MEANINGFUL_ALPHA` with structural trade-off disclosures.

---

## 6. Non-Custodial Wallet & Transaction Safety Architecture

- **Zero Private Key Access:** Application code never accesses, manages, or stores private keys or seed phrases.
- **Unsigned Calldata Payloads:** All transaction steps return unsigned inspection JSON payloads (`to`, `data`, `value`, `gasLimit`, `chainId: 1672`).
- **Chain ID Enforcement:** Hardcoded verification of `1672` (`0x688`).
- **Receiver Address Validation:** Zero address (`0x000...000`) and malformed strings are rejected with actionable errors.

---

## 7. Official Pharos AI & x402 Technical Assessment

- **Pharos AI Hub (`https://ai.pharos.xyz`):** Evaluated. All financial math, APY compounding, and rebalance triggers must remain 100% deterministic TypeScript. Pharos AI may serve only as an optional conversational client communicating with our deterministic API.
- **Pharos x402 Protocol (`https://docs.pharos.xyz/developer-guide/x402`):** Evaluated. **DEFERRED**. The Yield Optimizer is a public public good. Imposing an x402 paywall would introduce UX friction for standard users. Reserved for future B2B automated execution endpoints.

---

## 8. Implementation Roadmap (Phases 1–5)

```
Phase 1: Adapter Infrastructure & Types
  ├─ Update src/types/index.ts (Normalized interfaces & canonical registry)
  ├─ Implement src/adapters/nativePosAdapter.ts (Consensus Staking)
  └─ Implement src/adapters/faroSwapV3Adapter.ts (Uniswap V3 LP)

Phase 2: Mathematical Engine & Friction Model
  ├─ Update src/engine/frictionModel.ts (Swap fees & round-trip LP costs)
  ├─ Update src/engine/yieldMath.ts (LP impermanent loss & dual-model APR)
  └─ Update src/engine/recommendationEngine.ts (Hard 15d lockup & TIE_NO_MEANINGFUL_ALPHA rules)

Phase 3: Calldata Reviewer & Serverless API
  ├─ Update src/reviewer/transactionReviewer.ts (delegate calldata)
  ├─ Update src/server/router.ts & api/*.ts (3-source API responses)
  └─ Verify live bridge orchestration

Phase 4: Responsive Dashboard UI
  ├─ Update src/ui/index.html (3 Source Cards & Disclosures)
  ├─ Update src/ui/app.js (Quality Badges & Dual-Model Selectors)
  └─ Update src/ui/styles.css (Card layouts & disclosure alerts)

Phase 5: Full Test Suite & Production Acceptance
  ├─ Run all unit tests (target: > 150 passing tests)
  ├─ Run integration smoke tests against Pacific Mainnet
  └─ Final change-scope and safety review
```
