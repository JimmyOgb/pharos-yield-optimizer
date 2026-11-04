# GATE 1B — PHAROS DEX LIQUIDITY POOL YIELD VERIFICATION REPORT
## Contract Authenticity, Pool State, Volume Metrics & Yield Reproducibility

**Audit Date:** November 3, 2026  
**Auditor:** Antigravity AI  
**Reported PoolManager:** `0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550`  
**Reported StateView:** `0x616434e941c5E53d44894bF9ca13D517927BF8aF`  
**Network:** Pharos Pacific Mainnet (`Chain ID: 1672`)  
**Audit Block Number:** `#22024271`  
**Classification:** **`RATE_UNAVAILABLE` / `NOT_REPRODUCIBLE_ONCHAIN`**

---

## 1. Contract Authenticity Verification

- **PoolManager Address (`0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550`):**
  - Bytecode: 17,151 bytes deployed on Pharos Pacific Mainnet.
  - Matches the Uniswap V4 singleton pool architecture referenced in `port.pharos.xyz`.
- **StateView Address (`0x616434e941c5E53d44894bF9ca13D517927BF8aF`):**
  - Bytecode: 2,784 bytes deployed on Pharos Pacific Mainnet.
  - Provides read-only entry points for pool state (`getSlot0`, `getLiquidity`, `getFeeGrowthGlobals`).

---

## 2. Live Pool State & Fee Growth Audit

In Uniswap V4 architecture, liquidity providers earn returns strictly from swap fees accumulated in `feeGrowthGlobal0X128` and `feeGrowthGlobal1X128`:

$$\text{Realized Fee APR} = \frac{\Delta \text{FeeGrowthGlobal}}{\Delta t} \times \frac{365}{\text{Pool Price}}$$

### On-Chain Inspection Findings
1. **Pool Discovery:** Without an off-chain subgraph, factory event indexer, or centralized analytics API, individual pool keys (`currency0`, `currency1`, `fee`, `tickSpacing`, `hooks`) must be pre-known or indexed from historical `Initialize` event logs.
2. **Swap Volume & Fee Growth:**
   - In low-frequency trading windows or newly initialized pairs, $\Delta \text{FeeGrowthGlobal} \approx 0$.
   - A trailing fee rate cannot be deterministically computed from a single static block call without historical transaction history spanning at least 7 to 30 days.
3. **The 14.00% – 22.00% Figure:**
   - This figure is an **`ASSUMED_HYPOTHETICAL_BENCHMARK`** typical of active EVM DEX pools with high trading velocity.
   - It is **not** an on-chain measured rate at block `#22024271`.
   - In accordance with Gate 1B Rule #4: *"Do not report a 14–22% APR unless the underlying data and calculation can be reproduced. If live data cannot establish a credible return, label the rate UNAVAILABLE."*

---

## 3. Financial Risk & Friction Profile

Liquidity provision has distinct financial characteristics that differentiate it from pure single-asset staking:
1. **Impermanent Loss (Divergence Loss):** If the price of PROS doubles against USDC, the LP holds fewer PROS and more USDC than if they had simply held PROS, eroding or wiping out the fee yield.
2. **Dual-Asset Exposure:** Depositing requires holding two tokens, introducing portfolio rebalancing friction.
3. **Gas Friction:** Minting and burning LP positions across multi-tick positions requires 150,000 to 250,000 gas (~0.0015 - 0.0025 PROS).

---

## 4. Verification Verdict

**Pharos DEX LP Yield is classified as `RATE_UNAVAILABLE`:**
- Contracts are genuine and deployed.
- Real-time fee APR cannot be reproducibly derived on-chain without an active off-chain volume indexer.
- It cannot be counted as a verified live yield source for the 3-source requirement at this time.
