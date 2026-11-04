# Gate 2: Technical Specification

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**Status:** PLANNING SPECIFICATION ONLY (NO CODE / NO PACKAGES)  
**Evidence Baseline:** Gate 1E Verdict: `FEWER THAN THREE QUALIFYING SOURCES — REQUIREMENT NOT MET`  
**Current Qualifying Source Count:** **1 (Faroo `stPROS`)**

---

## 1. Technical Environment & Network Constants

| Parameter | Value | Description |
| :--- | :--- | :--- |
| **Network Name** | Pharos Pacific Mainnet | Official Layer-1 EVM Network |
| **Chain ID** | `1672` (`0x688`) | Strict chain validation target |
| **Primary RPC** | `https://rpc.pharos.xyz` | Official public JSON-RPC proxy |
| **Block Time** | $\approx 1.0\text{ – }1.2\text{ seconds}$ | Target block production rate |
| **Native Currency** | `PROS` | 18 decimals |
| **Gas Currency** | `PROS` | Base fee + Priority fee (EIP-1559) |
| **Standard RPC Client** | `portal/1.0.0` | Node client implementation |

---

## 2. On-Chain Contract Registry & Function Selectors

### 2.1 Faroo Liquid Staking Protocol (`stPROS`)
- **Address:** `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`
- **Classification:** `VERIFIED_ONCHAIN`
- **Decimals:** 18
- **Core Function Selectors (ABI Signatures):**
  - `0x18160ddd`: `totalSupply()` $\rightarrow$ Returns `uint256` (Total `stPROS` shares minted)
  - `0x01e1d114`: `totalPooledPros()` $\rightarrow$ Returns `uint256` (Total underlying `PROS` backing pool)
  - `0x3a4b66f1`: `submit(address _referral)` $\rightarrow$ Payable method to stake native `PROS`
  - `0x70a08231`: `balanceOf(address)` $\rightarrow$ Returns `uint256` (`stPROS` share balance)
  - `0x095ea7b3`: `approve(address spender, uint256 amount)` $\rightarrow$ Standard ERC-20 approval
  - `0x76a911e2`: `requestWithdraw(uint256 _amount)` $\rightarrow$ Initiates 14-day protocol unbonding queue

### 2.2 Canonical Wrapped PROS (`WPROS`)
- **Address:** `0x52C46eD4e803a647000e5aA6145B1c110996D872`
- **Classification:** `BASELINE_ONLY`
- **Decimals:** 18
- **Core Function Selectors:**
  - `0xd0e30db0`: `deposit()` $\rightarrow$ Wraps native `PROS` to `WPROS` (1:1)
  - `0x2e1a7d4d`: `withdraw(uint256 wad)` $\rightarrow$ Unwraps `WPROS` to native `PROS` (1:1)

### 2.3 Axil Prime Credit 3M Vault (`APC3M`)
- **Share Token Address:** `0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0`
- **Vault Contract Address:** `0xD0428799FbC35557834d33121BA4472692c8908a`
- **Underlying Asset:** `USDC` (`0xC879C018dB60520F4355C26eD1a6D572cdAC1815`), 6 decimals
- **Classification:** `OFFCHAIN_TARGET_RATE`
- **Core Function Selectors:**
  - `0x01e1d114`: `totalAssets()` $\rightarrow$ Returns `uint256` (Total USDC under management)
  - `0x18160ddd`: `totalSupply()` $\rightarrow$ Returns `uint256` (Total vault shares)
  - `0x6e553f65`: `deposit(uint256 assets, address receiver)` $\rightarrow$ Whitelisted deposit (KYC-restricted)

### 2.4 Pharos DEX (Uniswap V4 Core)
- **PoolManager Address:** `0xD681534E2741BEdf60fc5C7A2De109f6baB5aF0A`
- **StateView Address:** `0x6164222378943fcf3eef3a31c19b0aaef0cf1722`
- **Classification:** `EXECUTION_ALTERNATIVE` (stPROS/WPROS swap route)
- **Swap Method:** V4 `unlock()` with swap router execution callback.

---

## 3. Core TypeScript Type Definitions

```typescript
// Strict Provenance Classification Tag
export type ProvenanceStatus =
  | 'VERIFIED_ONCHAIN'          // Live dynamic rate queryable on-chain
  | 'EXECUTION_ALTERNATIVE'     // Liquidity/exit route for an existing position
  | 'OFFCHAIN_TARGET_RATE'      // Advertised or contractual target rate
  | 'BASELINE_ONLY'             // 0.00% reference benchmark
  | 'UNVERIFIED_CANDIDATE'      // Mechanism exists but rate unqueryable
  | 'STALE';                    // Cached data exceeded freshness window

// Recommendation Decision Tag
export type RecommendationDecision =
  | 'MOVE'
  | 'STAY_PUT'
  | 'INSUFFICIENT_DATA'
  | 'NOT_ELIGIBLE'
  | 'RISK_TOO_HIGH';

// On-Chain Rate State Snapshot
export interface OnChainYieldSnapshot {
  protocolId: string;
  contractAddress: string;
  blockNumber: number;
  blockTimestamp: number;
  rawState: {
    totalAssets: bigint;
    totalSupply: bigint;
    exchangeRateMantissa: bigint; // Scaled by 1e18
  };
  provenance: ProvenanceStatus;
  spotExchangeRate: number;       // e.g. 1.00491704
  historicalRateDelta?: number;   // e.g. +0.00101674 over deltaT
  observationDeltaHours?: number; // e.g. 29.21 hours
  normalizedAnnualizedRate: number; // Equilibrium rate ~0.0850 (8.50%)
}

// Comprehensive Transaction Friction Model
export interface FrictionParameters {
  gasEstimateUnits: bigint;
  gasPriceGwei: number;
  gasCostNative: number;          // In PROS
  entryProtocolFeeBps: number;    // Basis points (e.g. 0 bps = 0%)
  exitProtocolFeeBps: number;     // Basis points (e.g. 0 bps queue, 30 bps DEX)
  estimatedSlippageBps: number;   // Dynamic based on size
  lockupDurationDays: number;     // e.g. 0, 14, or 90 days
}

// User Analysis Parameters
export interface OptimizerQuery {
  userAddress?: string;
  principalAmount: number;        // Principal in native units
  assetSymbol: 'PROS' | 'USDC';
  targetHorizonDays: number;      // e.g. 7, 30, 90, 365 days
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  maxAllowableLockupDays: number; // e.g. 0 (instant only) or 14+ days
}

// Net Yield Comparison Result
export interface StrategyComparisonResult {
  strategyId: string;
  name: string;
  classification: ProvenanceStatus;
  qualifiesTowardReq01: boolean;  // Strict Boolean
  grossReturnRate: number;        // Normalized annual rate
  grossReturnAmount: number;      // Gross yield over horizon
  totalFrictionAmount: number;    // Gas + fees + slippage
  netGainAmount: number;          // Gross return - Friction
  netGainPercentage: number;      // Net return / Principal
  breakEvenHorizonDays: number;   // Minimum days to offset friction
  isHorizonEligible: boolean;     // Horizon >= Lockup & Horizon >= Break-Even
  riskBadges: string[];
}

// Final Actionable Recommendation
export interface OptimizerRecommendation {
  decision: RecommendationDecision;
  targetStrategyId?: string;
  reason: string;
  netGainValue: number;           // In asset units
  breakEvenPeriodDays: number;
  comparisonMatrix: StrategyComparisonResult[];
  unsignedTransaction?: {
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    chainId: number;
  };
}
```

---

## 4. Error Handling, Retry Policies & Degraded State Engine

### 4.1 RPC Connection Reliability
- **Timeout Policy:** 8,000 ms per JSON-RPC request.
- **Retry Mechanism:** Exponential backoff (initial delay: 500 ms, multiplier: 2.0, max retries: 3).
- **Graceful Fallback:** If `eth_call` for Faroo `totalPooledPros()` fails or times out:
  - Do NOT invent or mock a fallback exchange rate.
  - Mark data state as `STALE` if cached within 10 minutes, or `UNAVAILABLE` if no recent cache exists.
  - Disable automated `MOVE` recommendation; emit `INSUFFICIENT_DATA` with explicit UI error message.

### 4.2 Malicious / Extreme Rate Volatility Guard
- **Sanity Bounds on Exchange Rate:**
  - $R_{\text{spot}} < 1.0000$: Flag as `IRREGULAR_DOWNWARD_DEPEG` (slashing or contract bug; reject recommendations).
  - $R_{\text{spot}} > 1.2500$: Flag as `ANOMALOUS_SURGE` (requires secondary confirmation).
- **Flash Loan / Single-Block Manipulation Guard:**
  - Any exchange rate delta that implies $> 100\%$ APR over $< 24$ hours is flagged as `EPISODIC_VOLATILITY` and clamped to the verified consensus equilibrium rate ($\sim 8.50\%$) for forward projections.

---

## 5. Non-Custodial Transaction Construction Specification

When execution preparation is triggered:
1. **Selector Matching:** Target function signature ABI encoding (e.g., `submit(address)` = `0x3a4b66f1` + 32-byte zero address).
2. **Value Formatting:** Principal amount parsed to exact 18-decimal wei string.
3. **Safety Simulation:** Perform read-only `eth_estimateGas` or `eth_call` preflight before returning payload to UI. If preflight reverts, payload is blocked.
4. **Zero Key Storage:** The application codebase contains zero key-generation, storage, or transmission logic.
