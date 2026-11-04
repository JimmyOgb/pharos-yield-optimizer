# Gate 2: UI/UX Specification & Screen Architecture

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**Status:** PLANNING SPECIFICATION ONLY (NO CODE / NO PACKAGES)  
**Evidence Baseline:** Gate 1E Verdict: `FEWER THAN THREE QUALIFYING SOURCES — REQUIREMENT NOT MET`  
**Current Qualifying Source Count:** **1 (Faroo `stPROS`)**

---

## 1. UI/UX Design Principles

1. **Zero Mock Data:** Every figure, balance, and rate rendered on screen is either derived from live on-chain RPC queries or clearly labeled as an off-chain target / benchmark.
2. **Transparent Reality Banner:** A permanent top-level status chip indicates the verified on-chain ecosystem state:  
   `[ 1 of 3 Strictly Qualifying Sources Verified On-Chain · Audit Report Available ]`
3. **Explicit Empty & Degraded States:** When RPC calls are slow or data is unavailable, the UI displays explicit skeleton loaders or `UNAVAILABLE` chips rather than placeholder mock numbers.
4. **Friction-Centric Visuals:** Emphasize the break-even horizon $\tau_{\text{breakeven}}$ and fee impact so users immediately understand why "STAY PUT" is often the optimal financial decision.

---

## 2. Screen & Component Architecture

The interface is structured into an intuitive, responsive dashboard comprising eight cohesive viewports/modules:

```
+--------------------------------------------------------------------------------------------------+
|  PHAROS YIELD OPTIMIZER                     Network: Pharos Pacific (1672) | [Connect Wallet]   |
|  [!] Ecosystem Reality: 1 Strictly Qualifying On-Chain Source Verified (Faroo stPROS) [Audit Details] |
+--------------------------------------------------------------------------------------------------+
|  SCREEN 1: PORTFOLIO & POSITION OVERVIEW                                                         |
|  - Active Address / Lookup Input  - Native PROS Balance  - stPROS Staked Balance  - WPROS Balance|
+--------------------------------------------------------------------------------------------------+
|  SCREEN 2: REBALANCE PARAMETER CONTROLS                                                          |
|  - Principal Input (e.g. 1,000 PROS)                                                             |
|  - Horizon Slider (7d | 14d | 30d | 60d | 90d | 180d | 365d)                                     |
|  - Liquidity Need: [X] Flexible (14d Queue OK)  [ ] Instant Only (DEX Exit Required)            |
+--------------------------------------------------------------------------------------------------+
|  SCREEN 3 & 4: STRATEGY COMPARISON & FRICTION MATRIX                                             |
|  +--------------------+---------------------+--------------------+-----------------------------+  |
|  | Faroo Patient      | Faroo Instant DEX   | Axil Prime Credit  | Native PROS Baseline        |  |
|  | Staking Queue      | Staking Swap        | 3M Vault (USDC)    | Holding                     |  |
|  | [VERIFIED_ONCHAIN] | [EXECUTION_ALT]     | [OFFCHAIN_TARGET]  | [BASELINE_ONLY]             |  |
|  | Net APR: ~8.50%    | Net APR: ~8.20%     | Target: 9.25%      | Return: 0.00%               |  |
|  | Lockup: 14 Days    | Lockup: 0 Days      | Lockup: 90 Days    | Lockup: 0 Days              |  |
|  | Exit Fee: 0.00%    | Exit Fee: 0.30%+Slip| Exit Fee: Credit   | Exit Fee: 0.00%             |  |
|  | Break-Even: 0.1d   | Break-Even: 17.2d   | Currency: FX Risk  | Net Alpha: 0.00 PROS        |  |
|  +--------------------+---------------------+--------------------+-----------------------------+  |
+--------------------------------------------------------------------------------------------------+
|  SCREEN 5: OPTIMIZER RECOMMENDATION ENGINE                                                       |
|  >>> RECOMMENDATION: MOVE TO FAROO PATIENT STAKING                                               |
|  - Expected Net Gain: +13.97 PROS (+1.40% over 60 Days)                                          |
|  - Total Friction Cost: 0.00025 PROS (Gas only; 0% protocol fees)                                |
|  - Break-Even Horizon: 0.1 days                                                                  |
|  [ PREPARE UNSIGNED REBALANCE TRANSACTION ]                                                     |
+--------------------------------------------------------------------------------------------------+
|  SCREEN 6 & 7: RISK DISCLOSURES & EVIDENCE PROVENANCE                                            |
|  - Data Freshness: Block #22025998 (12s ago) | RPC: rpc.pharos.xyz (1.25 Gwei)                   |
|  - Contract Verifications: Faroo (0x6b0A...5Ec4) verified | Axil (0xEC47...44d0) verified        |
+--------------------------------------------------------------------------------------------------+
|  SCREEN 8: NON-CUSTODIAL TRANSACTION REVIEW MODAL (Triggered on click)                           |
+--------------------------------------------------------------------------------------------------+
```

---

## 3. Screen Specifications & Data Mappings

### Screen 1: Portfolio & Position Overview
- **Data Displayed:**
  - `user.prosBalance`: Queried via `eth_getBalance(address)`.
  - `user.stProsBalance`: Queried via `eth_call(0x70a08231)` on Faroo.
  - `user.wprosBalance`: Queried via `eth_call(0x70a08231)` on Canonical WPROS.
  - Total portfolio valuation in PROS.
- **Degraded State:** If no wallet connected, defaults to editable public address input or sample balance ($1,000\text{ PROS}$).

### Screen 2: Rebalance Parameter Controls
- **User Inputs:**
  - Principal amount input field with `MAX` button.
  - Interactive horizon slider: $7$, $14$, $30$, $60$, $90$, $180$, $365$ days.
  - Liquidity toggle: "Flexible (Patient 14d unbonding)" vs. "Instant Liquidity (DEX exit)".
- **Dynamic Updates:** Changes in inputs immediately recalculate net yield across all strategy cards without reloading page.

### Screen 3: Strategy Comparison Cards
- **Card 1: Faroo Patient Staking**
  - Badge: Green `VERIFIED_ONCHAIN` chip.
  - Yield: Live dynamic rate ($\sim 8.50\%$ normalized forward projection).
  - Unbonding: 14-day protocol queue with 0% exit fee.
- **Card 2: Faroo Instant DEX Staking**
  - Badge: Blue `EXECUTION_ALTERNATIVE` chip.
  - Yield: Live rate minus $0.30\%$ DEX pool fee and estimated slippage.
  - Unbonding: 0 days (Instant execution).
- **Card 3: Axil Prime Credit 3M**
  - Badge: Purple `OFFCHAIN_TARGET_RATE` chip + Red `CURRENCY_MISMATCH_RISK` chip.
  - Yield: $9.25\%$ target APY in USDC.
  - Unbonding: 90-day institutional lockup.
- **Card 4: Native PROS Holding**
  - Badge: Gray `BASELINE_ONLY` chip.
  - Yield: $0.00\%$ baseline return.
  - Unbonding: 0 days.

### Screen 4: Cost, Fee & Break-Even Analysis
- Visualizes:
  - Estimated gas costs (entry + exit).
  - Protocol fees (mint + burn).
  - AMM slippage curve.
  - Break-even day threshold $\tau_{\text{breakeven}}$ overlaid on the user's selected horizon $T$.

### Screen 5: Recommendation & Explanation Panel
- **Decision Display:**
  - If $\mathcal{N} > 0$ and $T \ge \text{Lockup}$: Displays high-contrast green banner `MOVE TO [STRATEGY]`.
  - If $\mathcal{N} \le 0$ or $T < \text{Lockup}$: Displays high-contrast amber banner `STAY PUT`.
- **Reasoning Box:** Plain-English explanation detailing why moving or staying put produces superior risk-adjusted net capital.

### Screen 6: Risk & Liquidity Disclosures
- Detailed disclosures regarding:
  - Smart contract security risk.
  - Consensus slashing risk.
  - 14-day unbonding capital lockup.
  - FX volatility risk for cross-currency products.

### Screen 7: Evidence & Provenance Inspector
- Collapsible audit drawer showing:
  - Exact queried contract addresses.
  - Function selectors called.
  - Current block number and timestamp.
  - Link to GitHub Gate 1–1E audit documentation.

### Screen 8: Non-Custodial Transaction Review Modal
- Modal triggered when user clicks "Prepare Rebalance Transaction".
- Displays unsigned transaction payload: target address, value in wei, encoded calldata, gas estimate, and chain ID `1672`.
- Action buttons: `Cancel` and `Submit to Wallet for Signature`.

---

## 4. Visual Design Tokens & Component Styling

- **Background:** Deep dark slate (`#0B0F19`)
- **Card Surfaces:** Dark card navy (`#111827`) with subtle border (`#1F2937`)
- **Primary Accent / Action:** Electric Emerald (`#10B981`)
- **Warning / Alert:** Amber Gold (`#F59E0B`)
- **Risk / Disqualification:** Crimson Red (`#EF4444`)
- **Typography:** Inter Tight / Monospace for on-chain addresses, numbers, and hex calldata.
- **Accessibility:** WCAG AA compliant contrast ratios across all text and interactive elements.
