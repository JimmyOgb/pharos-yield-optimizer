# PHAROS TASK 15 — GATE 10B.2 SOURCE INTEGRATION REPORT
## Comprehensive Technical Integration Analysis of Three Live On-Chain Yield Sources

**Product:** Pharos Yield Optimizer  
**Network:** Pharos Pacific Mainnet — Chain ID `1672` (`0x688`)  
**RPC Endpoint:** `https://rpc.pharos.xyz`  
**Date:** November 7, 2026  
**Status:** FULLY INTEGRATED & VALIDATED  

---

## 1. Overview of the Three Monitored Sources

The Pharos Yield Optimizer monitors three distinct on-chain yield mechanisms on Pharos Pacific Mainnet. Each source fulfills strict provenance, freshness, and structural criteria, while maintaining transparent separation between actionable single-asset opportunities and informational benchmarks.

```
+---------------------------------------------------------------------------------------------------+
|                                 PHAROS PACIFIC MAINNET (CHAIN ID 1672)                            |
+---------------------------------------------------------------------------------------------------+
                                                  |
                     +----------------------------+----------------------------+
                     |                                                         |
         [ ACTIONABLE VERIFIED ]                                   [ LIVE INFORMATIONAL ]
                     |                                                         |
          Faroo Liquid Staking                                  +--------------+--------------+
           stPROS ERC-4626 Vault                                |                             |
         (0x6b0A...5Ec4 / Proxy)                      Native PoS Precompile         FaroSwap Uniswap V3 LP
                     |                                  (0x4100...0000)                (0x4146...5623)
        - Actionable MOVE Destination                         |                             |
        - Live exchange rate accrual                 - Consensus benchmark          - Dual-asset benchmark
        - 15-day patient unbonding queue             - 21-day unbonding epoch       - Full-range 6.26% APR
        - Instant DEX exit: UNAVAILABLE              - Retail entry: RESTRICTED     - Pool turnover: 15.56% APR
```

---

## 2. Technical Profile: Faroo Liquid Staking (`faroo-stpros`)

- **Contract Address (ERC-1967 Proxy):** `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`
- **Implementation Address:** `0xfd59860894e01773e9780b0d1dfae4ca2b56708d`
- **Asset Denomination:** `PROS` (Native / `WPROS` underlying)
- **Qualification Status:** `FULLY_QUALIFIED`
- **Operational Classification:** `ACTIONABLE_VERIFIED`
- **Actionable Recommendation Destination:** **TRUE**

### On-Chain Interface & Selectors
- `totalPooledAssets()`: Selector `0x01e1d114` -> `uint256`
- `totalSupply()`: Selector `0x18160ddd` -> `uint256`
- `deposit(uint256,address)`: Selector `0x6e553f65` -> `uint256 shares`
- `requestWithdraw(uint256)`: Selector `0x6e76cf0a` -> Unbonding queue entry

### Empirical Observation (Blocks #21,924,812 to #22,350,000+)
- Total Pooled Assets: ~3,152,335.1227 PROS
- Total Supply: ~3,136,910.7559 stPROS
- Spot Exchange Rate: `1.00491704` PROS per stPROS
- Accrual Mechanism: Value-accumulating ERC-4626 vault share.
- Realized Trailing Return: 26.14% APR observed over initial 4.78-day bootstrapping window (flagged with mandatory short-observation warning).
- Forward Scenario Model Input: 8.50% APR conservative baseline equilibrium.

### Lockup, Exit & Instant Liquidity Status
- **Patient Exit:** 14-day protocol unbonding queue + 1-day settlement buffer = **15 days total**.
- **Instant Exit:** **UNAVAILABLE** (`instantExitAvailable: false`, `instantExitFee: null`, `instantExitStatus: "NO_VERIFIED_SECONDARY_LIQUIDITY"`).
- **Secondary Liquidity Verification:** Exhaustive on-chain factory inspection (FaroSwap V2 & V3) confirmed zero active stPROS liquidity pools on Pacific Mainnet. Calldata preparation for instant DEX exit is refused to protect user funds from unbacked swap execution.

---

## 3. Technical Profile: Native PoS Consensus Staking (`native-pos-staking`)

- **Precompile Address:** `0x4100000000000000000000000000000000000000`
- **Asset Denomination:** `PROS` (Native protocol asset)
- **Qualification Status:** `LIVE_INFORMATIONAL`
- **Operational Classification:** `NOT_AVAILABLE_FOR_ENTRY`
- **Actionable Recommendation Destination:** **FALSE**

### On-Chain Interface & Selector Resolution
During Gate 10B.2, live JSON-RPC `eth_call` testing on Pacific Mainnet definitively resolved prior documentation conflicts:
- **`0x5dd831ae`:** Reverts with empty error data (`code: 3, data: '0x'`).
- **`0x3a6d6bae` (`getDelegator(bytes32,address)`):** Succeeded, returning a valid 288-byte 9-word EVM ABI tuple:
  1. `principalStakeWei` (Word 0)
  2. `stakeWei` (Word 1)
  3. `accumulatedRewardPerShare` (Word 2)
  4. `rewardsWei` (Word 3 — Accrued unclaimed rewards)
  5. `pendingStakeWei` (Word 4)
  6. `pendingWithdrawStakeWei` (Word 5)
  7. `pendingWithdrawWindow` (Word 6)
  8. `totalRewardsClaimedWei` (Word 7 — Cumulative claimed rewards)
  9. `isPendingUndelegate` (Word 8 — Boolean flag)

### Empirical State Observation
- Active Delegator Investigated: `0xec1d6163e05b3f5d0fb8f354881f6c8b793ad612` (Validator Pool `0xaecb1e6d44...86bedc`)
- Total Network Staked: 283,924,850.2879 PROS (queried via `eth_getBalance`)
- Realized Trailing APR: 29.98% APR across blocks #22,004,812 -> #22,348,500 (3.80 days).
- Forward Scenario Equilibrium: 8.50% APR conservative baseline.

### Entry & Retail Availability Rationale
While the precompile state is queryable and proves network staking activity, **no permissionless retail delegation smart contract or router is verified on Pacific Mainnet**. Standard retail wallets cannot delegate to individual validators without validator-level permissions or node infrastructure. Consequently:
- Labeled as `LIVE_INFORMATIONAL` / `NOT_AVAILABLE_FOR_ENTRY`.
- `isActionableRecommendationDestination` is strictly set to `false`.
- Excluded from automated `MOVE` recommendations.

---

## 4. Technical Profile: FaroSwap Uniswap V3 WPROS/USDC LP (`faroswap-wpros-usdc-lp`)

- **Pool Contract Address:** `0x4146d192da6428c9e1c243d2a953c625b5765623`
- **Factory Address:** `0x2c90CcB0b989afA2433F499698451a25744A552b`
- **Token 0:** Canonical WPROS (`0x52C48d4213107b20bC583832b0d951FB9CA8F0B0`)
- **Token 1:** USDC (`0xC879C018dB60520F4355C26eD1a6D572cdAC1815`)
- **Fee Tier:** 3,000 (0.30%) | Tick Spacing: 60
- **Asset Denomination:** Dual-Asset (`WPROS_USDC_LP`)
- **Qualification Status:** `QUALIFIED_WITH_DISCLOSURE`
- **Operational Classification:** `LIVE_INFORMATIONAL`
- **Actionable Recommendation Destination:** **FALSE**

### On-Chain Interface & Selector Resolution
Live RPC `eth_call` confirmed the working Uniswap V3 selectors:
- `slot0()`: Selector `0x3850c7bd` -> returns `sqrtPriceX96`, `tick`, fee protocol, unlocked state.
- `liquidity()`: Selector `0x1a686502` -> returns active liquidity uint128 (`0x1a684332` reverted).
- `feeGrowthGlobal0X128()`: Selector `0xf3058399`
- `feeGrowthGlobal1X128()`: Selector `0x46141319`

### Yield Differentiation & Structural Disclosures
1. **Pool Turnover Gross APR (15.56%):** Measures aggregate 24h trading volume turnover. This is an informational pool health indicator, not achievable by individual passive liquidity providers.
2. **Full-Range Position Benchmark APR (6.26%):** Mathematical return of a passive, non-rebalanced `[-887220, 887220]` full-range liquidity position.
3. **Disqualifications from PROS Rebalancing:**
   - **Dual-Asset Exposure:** Depositing into this pool requires holding both WPROS and USDC.
   - **Impermanent Loss:** Divergence loss risk cannot be captured by single-asset PROS staking math.
   - **Automated MOVE Disabled:** Retained strictly as an informational market benchmark.

---

## 5. API Response Data Structure (`GET /api/sources`)

The integrated endpoint `/api/sources` serves live on-chain data structured with full transparency:

```json
{
  "yieldSourceCoverage": {
    "status": "THREE_SOURCES_MONITORED",
    "totalMonitoredCount": 3,
    "qualifiedCount": 3,
    "actionableCount": 1,
    "isThreeSourceRequirementMet": true,
    "summary": "1 Actionable Verified Yield Source (Faroo stPROS), 2 Live Informational / Benchmark Sources (Native PoS, FaroSwap V3 LP)",
    "actionableSources": ["Faroo Liquid Staking (stPROS)"],
    "informationalSources": ["Pharos Native PoS Consensus Staking", "FaroSwap Uniswap V3 WPROS/USDC LP"]
  },
  "instantExit": {
    "instantExitAvailable": false,
    "instantExitFee": null,
    "instantExitStatus": "NO_VERIFIED_SECONDARY_LIQUIDITY",
    "message": "No verified secondary market liquidity pool exists for stPROS on Pacific Mainnet. Unbonding must use the 15-day patient queue."
  },
  "sources": [
    {
      "id": "faroo-stpros",
      "name": "Faroo Liquid Staking (stPROS)",
      "operationalStatus": "ACTIONABLE_VERIFIED",
      "qualificationStatus": "FULLY_QUALIFIED",
      "isActionable": true,
      "liveRate": "1.00491704",
      "liveRateUnit": "PROS per stPROS",
      "instantExitAvailable": false,
      "instantExitStatus": "NO_VERIFIED_SECONDARY_LIQUIDITY"
    },
    {
      "id": "native-pos-staking",
      "name": "Pharos Native PoS Consensus Staking",
      "operationalStatus": "NOT_AVAILABLE_FOR_ENTRY",
      "qualificationStatus": "LIVE_INFORMATIONAL",
      "isActionable": false,
      "liveRate": "29.98% (Historical Realized APR)",
      "forwardScenarioRate": "8.50% (Forward Scenario)"
    },
    {
      "id": "faroswap-wpros-usdc-lp",
      "name": "FaroSwap Uniswap V3 WPROS/USDC LP",
      "operationalStatus": "LIVE_INFORMATIONAL",
      "qualificationStatus": "QUALIFIED_WITH_DISCLOSURE",
      "isActionable": false,
      "liveRate": "6.26% (Full-Range LP Benchmark APR)",
      "poolTurnoverApr": "15.56% (Pool Turnover APR)"
    }
  ],
  "isAllFresh": true
}
```
