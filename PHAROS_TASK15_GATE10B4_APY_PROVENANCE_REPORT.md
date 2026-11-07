# PHAROS TASK 15 — GATE 10B.4 APY PROVENANCE REPORT
## Mathematical, Empirical, and Architectural Provenance of Yield Metrics

**Audit Date:** November 7, 2026  
**Scope:** Independent Provenance and Rate Classification Audit of Pharos Yield Optimizer  
**Target Environment:** Production (`https://pharos-yield-optimizer.vercel.app`) & Local Codebase  
**Network:** Pharos Pacific Mainnet (Chain ID `1672`, RPC `https://rpc.pharos.xyz`)  

---

## 1. Executive Taxonomy & Provenance Summary Matrix

Under the authorized provenance taxonomy, all numerical yield metrics, exchange rates, and benchmarks observed across the codebase, production endpoints, and historical audit reports are classified below:

| Metric Observed | Source / Strategy | Value / Unit | Authorized Classification | Deployed Location / File Reference | Provenance & Calculation Basis |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **Spot Exchange Rate** | Faroo stPROS | `1.00741608`<br>`PROS/stPROS` | `LIVE_DERIVED_ESTIMATE` | [`farooAdapter.ts#L107`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/adapters/farooAdapter.ts#L107)<br>`/api/sources` (`liveRate`) | Exact ratio of `totalPooledPros()` (`0x01e1d114`) / `totalSupply()` (`0x18160ddd`) queried on-chain. |
| **Illustrative Scenario** | Faroo stPROS | `8.50%`<br>APR | `FORWARD_SCENARIO_ASSUMPTION` | [`recommendationEngine.ts#L84`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts#L84)<br>[`types/index.ts#L26`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/types/index.ts#L26) | Configured macro baseline modeling post-dilution PoS equilibrium. Model input only; not observed on-chain. |
| **Trailing Return** | Faroo stPROS | `26.14%`<br>APR | `HISTORICAL_REALIZED_RATE` | [`farooAdapter.ts#L230-L234`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/adapters/farooAdapter.ts#L230-L234) | Annualized growth of spot exchange rate over 4.78 days across blocks `#21924812` to `#22348179`. |
| **Historical Delegator** | Native PoS Consensus | `29.98%`<br>APR | `HISTORICAL_REALIZED_RATE` | [`nativePosAdapter.ts#L291`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/adapters/nativePosAdapter.ts#L291)<br>`/api/sources` (`liveRate`) | Annualized reward delta (+3,118.82 PROS on 1M PROS) of delegator `0xec1d...d612` across 3.80 days (`#22004812` -> `#22348500`). |
| **Consensus Macro Baseline**| Native PoS Consensus | `8.50%`<br>APR | `FORWARD_SCENARIO_ASSUMPTION` | [`nativePosAdapter.ts#L301`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/adapters/nativePosAdapter.ts#L301)<br>`/api/sources` (`forwardScenarioRate`) | Macro consensus emission model estimate assuming 283.9M PROS staked at equilibrium. |
| **Phantom PoS Rate** | Native PoS Consensus | `12.00%`<br>APR | `UNKNOWN_PROVENANCE` | *None in code or production* | Typographical hallucination in previous assistant chat summary; exists nowhere in deployed code or API. |
| **Full-Range Position** | FaroSwap V3 LP | `6.26%`<br>APR | `POOL_LEVEL_BENCHMARK` | [`faroSwapV3Adapter.ts#L273`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/adapters/faroSwapV3Adapter.ts#L273)<br>`/api/sources` (`liveRate`) | Passive full-range position $[-887220, 887220]$ calculated from on-chain fee growth delta ($\Delta\text{feeGrowthGlobalX128}$). |
| **Pool Fee Turnover** | FaroSwap V3 LP | `15.56%`<br>APR | `POOL_LEVEL_BENCHMARK` | [`faroSwapV3Adapter.ts#L272`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/adapters/faroSwapV3Adapter.ts#L272)<br>`/api/sources` (`poolTurnoverApr`) | Aggregate 24h pool fee turnover ($\frac{V \times 0.003 \times 365}{\text{TVL}}$); represents total pool revenue, not an individual LP yield. |
| **Concentrated Model** | FaroSwap V3 LP | `71.87%`<br>APR | `FORWARD_SCENARIO_ASSUMPTION` | `docs/audits/GATE-8D` / Gate 9 | Theoretical modeling assuming $\pm 5\%$ tight tick range with 100% in-range time. |
| **Phantom FaroSwap Rate** | FaroSwap V3 LP | `18.50%`<br>APR | `UNKNOWN_PROVENANCE` | *None in code or production* | Typographical hallucination in previous assistant chat summary; exists nowhere in deployed code or API. |

---

## 2. Source-by-Source Deep Provenance Audit

### 2.1 Faroo Liquid Staking (stPROS)

#### A. Spot Exchange Rate: `1.00741608 PROS per stPROS`
- **Classification:** `LIVE_DERIVED_ESTIMATE`
- **Methodology & Formula:**
  $$\text{Spot Exchange Rate} = \frac{\text{totalPooledPros}}{\text{totalSupply}}$$
- **Empirical On-Chain Verification (Block `#22366724`):**
  - Proxy Target: `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`
  - Function `totalPooledPros()` (`0x01e1d114`): `5,114,011,013,022,908,954,394,647` wei
  - Function `totalSupply()` (`0x18160ddd`): `5,076,364,302,922,915,567,986,135` wei
  - Calculated Ratio: `1.0074160799496033` PROS per stPROS share.
- **Reporting Invariant:** This value represents the instantaneous redemption value of 1 stPROS share in underlying PROS. It is **not** an APY and is never labeled as an APY in `/api/sources`.

#### B. Forward Scenario Assumption: `8.50% APR`
- **Classification:** `FORWARD_SCENARIO_ASSUMPTION`
- **Methodology & Context:**
  Defined in [`types/index.ts#L26`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/types/index.ts#L26) (`FORWARD_SCENARIO_ASSUMPTION_850_BPS = 850`) and applied in [`recommendationEngine.ts#L84`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts#L84).
  - Used strictly as an illustrative gross rate parameter for forward cash-flow simulations over arbitrary horizons ($H$ days).
  - Disclosed in API responses: `"Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ."`
  - Disclosed in UI: `src/ui/index.html` line 212 explicitly warns that 8.5% is an illustrative model assumption.

#### C. Historical Realized Rate: `26.14% APR`
- **Classification:** `HISTORICAL_REALIZED_RATE`
- **Observation Parameters:**
  - Start Block: `#21924812` (Rate: `1.00405102`)
  - End Block: `#22348179` (Rate: `1.00741608`)
  - Elapsed Seconds: `413,367` (~4.78 days)
  - Formula: $\text{Accrual} = \frac{1.00741608 - 1.00405102}{1.00405102} = 0.00335148$ (+0.3351%).
  - Annualized: $0.00335148 \times \left(\frac{31,536,000}{413,367}\right) \approx 26.14\%$.
- **Disclosure:** The adapter explicitly notes that this early burst return will dilute toward validator equilibrium (~8.50%–10.00%) as more capital enters the vault.

---

### 2.2 Native PoS Consensus Staking

#### A. Historical Realized Rate: `29.98% APR`
- **Classification:** `HISTORICAL_REALIZED_RATE`
- **Origin & Observation Scope:**
  Direct query of the native consensus precompile at `0x4100000000000000000000000000000000000000` via selector `0x3a6d6bae` (`getDelegator(address,address)`) for active delegator `0xec1d6163e05b3f5d0fb8f354881f6c8b793ad612`:
  - Principal: `1,000,000.0000 PROS` (`10^24` wei).
  - Observation Interval: `328,354` seconds (~3.80 days) across blocks `#22004812` to `#22348500`.
  - Reward Delta: `+3,118.8249 PROS`.
  - Annualization Formula:
    $$\text{APR} = \left(\frac{3,118.8249}{1,000,000.0000}\right) \times \left(\frac{31,536,000}{328,354}\right) = 0.00311882 \times 96.0427 \approx 29.98\%$$
- **Actionability & Safety Guard:** This is an empirical observation of a single active validator delegation. The adapter strictly classifies Native PoS as `operationalStatus: "NOT_AVAILABLE_FOR_ENTRY"` and `isActionable: false`. It cannot be chosen as a rebalance destination.

#### B. Macro Scenario Rate: `8.50% APR`
- **Classification:** `FORWARD_SCENARIO_ASSUMPTION`
- **Origin:** Theoretical steady-state consensus emission rate assuming protocol validator target reward schedules under 283.9M total network staked PROS.

#### C. Phantom Rate: `12.00% APR`
- **Classification:** `UNKNOWN_PROVENANCE`
- **Findings:** Does not exist in `nativePosAdapter.ts`, `yieldSourceRegistry.ts`, `router.ts`, or `/api/sources`. It was an ungrounded hallucination in the previous assistant's chat message table. (Historically, in Gate 1B, 12.00% appeared in discussion of an off-chain credit vault `APC3M`, never Native PoS).

---

### 2.3 FaroSwap V3 AMM Liquidity (WPROS/USDC 0.30%)

#### A. Full-Range Position Benchmark: `6.26% APR`
- **Classification:** `POOL_LEVEL_BENCHMARK`
- **Origin & Formulation:**
  Calculated from on-chain fee growth accumulators on the FaroSwap V3 pool (`0x4146d192da6428c9e1c243d2a953c625b5765623`):
  - Tokens: Token0 is WPROS (`0x52c48d4213107b20bc583832b0d951fb9ca8f0b0`), Token1 is USDC (`0xc879c018db60520f4355c26ed1a6d572cdac1815`).
  - Fee Tier: 3,000 (0.30%).
  - Active Liquidity: `liquidity()` (`0x1a686502`) verified active.
  - Fee Growth Global: `feeGrowthGlobal0X128` (`0xf3058399`) and `feeGrowthGlobal1X128` (`0x46141319`).
  - Evaluated for a hypothetical passive full-range position across ticks $[-887220, 887220]$.

#### B. Pool Fee Turnover Rate: `15.56% APR`
- **Classification:** `POOL_LEVEL_BENCHMARK`
- **Formulation:**
  $$\text{Turnover APR} = \frac{24\text{h Fee Revenue} \times 365}{\text{Total Pool Liquidity Assets}}$$
  Represents aggregate protocol fee generation across all active positions, not an individual LP position yield.

#### C. Concentrated Liquidity Model: `71.87% APR`
- **Classification:** `FORWARD_SCENARIO_ASSUMPTION`
- **Origin:** Gate 8/9 audit modeling assuming an active LP maintains a narrow range $[\pm 5\%]$ around spot with 100% in-range time.

#### D. Phantom Rate: `18.50% APR`
- **Classification:** `UNKNOWN_PROVENANCE`
- **Findings:** Does not exist in `faroSwapV3Adapter.ts`, `yieldSourceRegistry.ts`, `router.ts`, or `/api/sources`. It was an ungrounded hallucination in the previous assistant's chat message table.

---

## 3. Recommendation Engine Rate Usage Audit

A line-by-line inspection of [`src/engine/recommendationEngine.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts) was conducted to verify whether any benchmark or historical rate can improperly trigger a `MOVE` recommendation:

1. **Rebalancing Destination Whitelist ([`recommendationEngine.ts#L198-L203`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts#L198-L203)):**
   The only strategies evaluated as candidates are:
   - `faroo-patient-staking`
   - `faroo-instant-dex`
   - `axil-prime-credit-3m`
   - `native-pros-baseline`
   **Crucial Invariant:** Neither Native PoS (`native-pos-staking`) nor FaroSwap LP (`faroswap-wpros-usdc-lp`) is in this array. They are strictly informational benchmarks in `/api/sources`. They can **never** be recommended as rebalancing destinations.

2. **Candidate Filtering Rules ([`recommendationEngine.ts#L217-L225`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts#L217-L225)):**
   - `axil-prime-credit-3m` is explicitly excluded from automated rebalancing (currency risk, off-chain target).
   - `faroo-instant-dex` is explicitly excluded from automated MOVE because no verified secondary liquidity exists.
   - `query.requireInstantLiquidity` excludes all strategies with `lockupPeriodDays > 0`.
   - `!c.isLockupEligible` excludes Faroo Patient Staking if $H < 15\text{ days}$.

3. **Rate Applied in Yield Projections ([`recommendationEngine.ts#L84`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts#L84)):**
   - The recommendation engine uses **only** `FORWARD_RATES_BPS['faroo-patient-staking'] = 850` (8.50%) as an illustrative forward gross rate.
   - It **never** uses the historical 26.14% rate or the 29.98% Native PoS rate as a forward projection.

4. **Alpha Threshold & Friction Deductions ([`recommendationEngine.ts#L296`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/engine/recommendationEngine.ts#L296)):**
   - Complete physical lifecycle gas (180k entry + 85k exit = 265k gas) is deducted from gross yield before comparing net advantage.
   - The 0.10 PROS (`10^17` wei) minimum meaningful alpha threshold is strictly enforced.

---

## 4. UI Rate Presentation Audit

Inspection of [`src/ui/app.js`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/src/ui/app.js#L289-L290):
```javascript
<span class="source-metric-label">${src.liveRateUnit && src.liveRateUnit.includes('per') ? 'On-Chain Spot Rate' : 'Advertised / Target APY'}</span>
<span class="source-metric-val font-mono">${escapeHtml(src.liveRate)} <small class="text-dim">${escapeHtml(src.liveRateUnit)}</small></span>
```

### Observations:
1. **Faroo stPROS:** `liveRateUnit` is `"PROS per stPROS"`. Because it includes `"per"`, the label renders as **"On-Chain Spot Rate"** with value `1.00741608 PROS per stPROS`. This is accurate and compliant.
2. **Native PoS Consensus:** `liveRateUnit` is `"Historical Consensus Realized APR"`. Because it does not contain `"per"`, the label renders as **"Advertised / Target APY"** with value `29.98% (Historical Realized APR)`.
   *Audit Note:* While the metric value string itself explicitly clarifies that it is a historical realized rate, the metric card header label `"Advertised / Target APY"` is a minor labeling imprecision.
3. **FaroSwap V3 LP:** `liveRateUnit` is `"Full-Range LP Benchmark APR"`. The label renders as **"Advertised / Target APY"** with value `6.26% (Full-Range LP Benchmark APR)`.
   *Audit Note:* Similar to Native PoS, the metric value clarifies that it is a full-range benchmark, but the header label reads `"Advertised / Target APY"`.
4. **Disqualification / Exclusion Disclosures:**
   The UI dynamically renders `src.exclusionReason` in an amber audit box directly under Native PoS and FaroSwap, clearly warning users of entry restrictions and dual-asset divergence risks.
