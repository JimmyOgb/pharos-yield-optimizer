# Gate 4: Read-Only JSON-RPC Client Report

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**Audit Date:** November 3, 2026  
**Auditor:** Antigravity AI  
**Component:** `src/rpc/pharosClient.ts`  
**Status:** VERIFIED & OPERATIONAL

---

## 1. Executive Summary

The read-only JSON-RPC client (`PharosRpcClient`) provides an audit-proof, resilient, non-custodial communication layer between the Pharos Pacific Mainnet execution layer and the Yield Optimizer.

### Core Architectural Features:
- **Strict Chain ID Verification:** Asserts network identity is strictly `1672` (`0x688`) before executing state queries.
- **Resilience Engine:** Configurable request timeout (8,000 ms) and bounded exponential backoff retries (3 attempts: 300 ms, 600 ms, 1,200 ms).
- **Zero Silent Fallbacks:** Network or RPC failures remain explicit `UNAVAILABLE` or error states; the client never manufactures fallback data.
- **Provenance & Freshness Stamping:** Every block and gas observation is stamped with wall-clock retrieval timestamps and checked against a 10-minute freshness window.
- **Zero Custody:** Contains zero private-key, transaction signing, or wallet injection APIs.

---

## 2. Live Network Observations

Direct read-only queries were executed against the official public RPC endpoint `https://rpc.pharos.xyz`:

| Query Field | JSON-RPC Method | Raw On-Chain Hex Result | Normalized Decimal Value | Provenance Status |
| :--- | :--- | :--- | :--- | :--- |
| **Network Chain ID** | `eth_chainId` | `0x688` | **`1672`** | `VERIFIED_ONCHAIN` |
| **Current Block Height** | `eth_blockNumber` | `0x150276c` | **`22,030,188`** | `VERIFIED_ONCHAIN` |
| **Block Timestamp** | `eth_getBlockByNumber` | `0x6aea186c` | **`1,793,726,572`** (UTC) | `VERIFIED_ONCHAIN` |
| **Base Fee Per Gas** | `eth_getBlockByNumber` | `0x2540be400` | **`10.0 Gwei`** (`10^10 wei`) | `VERIFIED_ONCHAIN` |
| **Current Gas Price** | `eth_gasPrice` | `0x2540be400` | **`10.0 Gwei`** (`10^10 wei`) | `VERIFIED_ONCHAIN` |
| **Node Client Version** | `web3_clientVersion` | `portal/1.0.0` | `portal/1.0.0` | `VERIFIED_ONCHAIN` |

---

## 3. Gas Price Audit: Live 10.0 Gwei vs. Gate 3 1.25 Gwei

In Gate 3, unit tests and planning benchmarks utilized a sample gas price of `1.25 Gwei`. Live on-chain observation reveals:
- Current `baseFeePerGas` on Pacific Mainnet: **`10.0 Gwei`** (`0x2540be400`).
- Live `eth_gasPrice` returned by portal proxy: **`10.0 Gwei`**.

### Architectural Impact on Recommendation Engine:
The recommendation bridge (`LiveRecommendationBridge`) dynamically injects the live observed gas price (`10.0 Gwei`) into the friction model.
- At `10.0 Gwei`, Faroo patient staking gas cost (200,000 units) evaluates to:
  $$C_{\text{gas}} = 200,000 \times 10.0 \times 10^{-9} = \mathbf{0.00200\text{ PROS}}$$
- This is an increase from the $0.00025\text{ PROS}$ modeled at $1.25\text{ Gwei}$, but remains negligible compared to the $+13.97\text{ PROS}$ gross yield generated on a 1,000 PROS deposit over 60 days.
- The break-even period increases from $\approx 1.5\text{ minutes}$ to $\approx 12.4\text{ minutes}$, perfectly demonstrating why dynamic RPC gas injection is essential for accurate real-time rebalancing.

---

## 4. Timeout, Retry, and Error Handling Validation

Unit tests in [`tests/unit/rpcClient.test.ts`](file:///C:/Users/NO%20GO%20NO/pharosbuild/skills/pharos-yield-optimizer/tests/unit/rpcClient.test.ts) verified:
1. **Chain ID Mismatch Protection:** A simulated response returning Chain ID 1 (Ethereum Mainnet) is rejected immediately with an explicit error.
2. **Transient Retry Recovery:** An initial HTTP 500 failure is caught, backed off, and successfully recovered on attempt 2 without user-facing failure.
3. **Retry Exhaustion:** Continuous HTTP 504 errors throw after exactly 3 attempts with a clear failure message.
4. **Stale Data Guard:** Blocks timestamped $> 600\text{ seconds}$ in the past are stamped with `isFresh: false`, triggering `INSUFFICIENT_DATA` in the recommendation engine.
