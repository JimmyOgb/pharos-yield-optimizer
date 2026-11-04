# Gate 1D: Commission Tier Verification Report

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**Date:** November 3, 2026  
**Status:** COMPLETE (READ-ONLY AUDIT)

---

## 1. Objective & Investigation Scope

In Gate 1C, the proposed "Path C" hypothesized three distinct staking tiers for PROS:
- **Tier 1:** 0% Commission Validator (Direct PoS delegation yielding theoretical ~8.50% gross APR)
- **Tier 2:** 5% Commission Validator (Direct PoS delegation yielding theoretical ~8.075% gross APR)
- **Tier 3:** Faroo Liquid Staking (`stPROS`) (10% protocol fee yielding ~7.65% gross APR with liquid wrapper utility)

The objective of this Gate 1D audit is to determine whether these commission tiers represent actual selectable on-chain strategies or whether they are theoretical mathematical projections.

---

## 2. Commission Tier Verification

### 2.1 The "0% Commission Validator" Candidate
- **Claim:** A user can route PROS to a specific Pacific Mainnet validator taking 0% commission to achieve the full ~8.50% network reward.
- **On-Chain Audit:** We inspected all available RPC methods and system contracts. There is no on-chain contract address or RPC endpoint where a user can pass a validator address and bond PROS to a 0% commission node.
- **Explorer & Registry Audit:** No validator identity directory exists on the Pharos Pacific Mainnet EVM explorer displaying individual validator commission rates.
- **Verdict:** `HYPOTHETICAL_MODEL`. While 0% commission is theoretically possible in PoS consensus designs, no specific 0% validator can be selected or verified on Pacific Mainnet EVM today.

### 2.2 The "5% Commission Validator" Candidate
- **Claim:** A user can route PROS to a professional validator taking a standard 5% commission to achieve ~8.075% APR.
- **On-Chain Audit:** As with the 0% candidate, there is no EVM contract interface or callable staking method to target a 5% commission validator on Pacific Mainnet.
- **Verdict:** `HYPOTHETICAL_MODEL`. The 5% commission rate is an industry standard convention (observed on Ethereum, Cosmos, and Polygon), but it does not represent an independently verifiable standalone contract target on Pharos Pacific Mainnet.

### 2.3 The Faroo Protocol Strategy (`stPROS`)
- **Claim:** A user deposits PROS into Faroo (`0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`) and receives `stPROS`.
- **On-Chain Audit:** 
  - Contract is fully verified and operational on Pharos Pacific Mainnet.
  - Total stake exceeds `3.13M PROS`.
  - Stakers do not choose validators; Faroo’s pool operator manages consensus delegation globally.
  - Protocol takes an internal performance fee (the standard model for liquid staking protocols).
- **Verdict:** `VERIFIED_ONCHAIN`. Faroo `stPROS` is an actual, selectable, executable yield strategy.

---

## 3. Mathematical Comparison: Theoretical Model vs. On-Chain Reality

| Dimension | Tier 1: 0% Direct | Tier 2: 5% Direct | Tier 3: Faroo stPROS |
| :--- | :--- | :--- | :--- |
| **Contract Address** | `None` (Consensus layer only) | `None` (Consensus layer only) | `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4` |
| **Selectable in EVM App?** | No | No | **Yes** (`deposit()` callable) |
| **Base Network Yield** | ~8.50% (Nominal Target) | ~8.50% (Nominal Target) | ~8.50% (Nominal Target) |
| **Validator Commission** | 0.00% | 5.00% | Handled internally by operator |
| **Net Expected APR** | 8.50% (Theoretical) | 8.08% (Theoretical) | **7.65% – 8.90%** (Dynamic pool rate) |
| **Liquidity & Exit** | 14-day unbonding lock | 14-day unbonding lock | **Dual Exit:** 14-day queue OR Instant DEX Swap |
| **Evidence Level** | `INFERRED_THEORETICAL` | `INFERRED_THEORETICAL` | `VERIFIED_ONCHAIN` |

---

## 4. Key Takeaways & Architectural Impact

1. **Path C cannot be substantiated as three independent live on-chain strategies:**
   Attempting to present 0% commission, 5% commission, and Faroo stPROS as three independent smart contract targets in the Yield Optimizer would fail the Hackathon verification audit, because two of the three targets have no deployed EVM addresses or interactive contracts.
2. **Honesty and Rigor Requirement:**
   The Pharos Agent Arena requires authentic, evidence-based development. Fabricating dummy validator addresses or hardcoding mock commission tiers would violate core competition guidelines.
3. **The True Staking Spectrum:**
   What *is* live and verifiable is Faroo's liquid staking mechanics, offering two distinct real-world execution routes (Patient Staking with 14-day lock vs. Instant DEX Staking with liquidity costs), plus the zero-yield benchmark (WPROS/PROS native holding), alongside the distinct real-world asset class represented by Axil Prime Credit (USDC).
