# PHAROS TASK 15 — WALKTHROUGH VIDEO SCRIPT & TIMELINE
## Comprehensive Scene-by-Scene Production Script for Pharos Yield Optimizer

**Video Title:** Pharos Yield Optimizer — Live Production Walkthrough  
**Target Duration:** ~3 minutes 45 seconds (225 seconds)  
**Resolution:** 1920 × 1080 (1080p, 16:9 widescreen, 30 fps)  
**Voiceover Model:** Microsoft Edge TTS (`en-US-ChristopherNeural`)  
**Production URL Demonstrated:** `https://pharos-yield-optimizer.vercel.app/`  
**GitHub Repository:** `https://github.com/JimmyOgb/pharos-yield-optimizer`  
**Target Network:** Pharos Pacific Mainnet (Chain ID `1672`, RPC `https://rpc.pharos.xyz`)  

---

## Complete Video Script & Action Timeline

### Scene 1: Introduction & Mission Statement (0:00 – 0:25)
- **Visual:** Clean full-page view of `https://pharos-yield-optimizer.vercel.app/` at 1080p.
- **On-Screen Actions:**
  - Red cursor glides into view at `(960, 200)`.
  - Highlights the application header: *"Pharos Yield Optimizer — Non-Custodial Pacific Mainnet Agent"*.
  - Smoothly hovers over the core value proposition tags.
- **Voiceover Narration:**
  > "Welcome to the official walkthrough of the Pharos Yield Optimizer, a truth-first, non-custodial yield intelligence agent built for the Pharos Pacific Mainnet. In decentralized finance, headline APYs are often misleading due to hidden unbonding lockups, dual-asset divergence, and transaction gas. The Pharos Yield Optimizer solves this by providing mathematical rebalancing recommendations backed by verifiable on-chain evidence."

---

### Scene 2: Live Pacific Mainnet Connection & Health Bar (0:25 – 0:50)
- **Visual:** Focus on the Network Status Bar below the header.
- **On-Screen Actions:**
  - Cursor moves down to `#networkStatusBar` at `(960, 160)`.
  - Highlights Chain ID `1672`, block number indicator, live gas price (`10.00 Gwei`), and fresh block age.
  - Moves to `#refreshBtn` (*"Refresh Live Data"*), clicks with an expanding ripple.
  - Data flashes briefly as live RPC calls refresh.
- **Voiceover Narration:**
  > "The application connects directly to Pharos Pacific Mainnet at Chain ID 1672 via official JSON-RPC. Here on the live network status bar, we see real-time block synchronization with sub-four-second freshness, a live gas price of 10.00 Gwei, and sub-150-millisecond RPC latency. Clicking Refresh queries the live chain state dynamically."

---

### Scene 3: Dynamic Yield-Source Coverage & Monitored Sources (0:50 – 1:28)
- **Visual:** Scroll down to the Yield-Source Coverage banner and the three source cards.
- **On-Screen Actions:**
  - Smooth page scroll to reveal `#coverageBanner` and `#sourcesList`.
  - Cursor highlights the badge: *"3 Sources Monitored On-Chain"*.
  - Cursor moves to Card 1: **Faroo Liquid Staking (stPROS)** — highlights `ACTIONABLE VERIFIED` badge and spot exchange rate `1.00741608 PROS per stPROS`.
  - Moves to Card 2: **Pharos Native PoS Consensus Staking** — highlights `LIVE INFORMATIONAL — RESTRICTED ENTRY` badge, historical realized APR `29.98%`, and the amber disqualification audit box explaining non-permissionless retail interface.
  - Moves to Card 3: **FaroSwap Uniswap V3 WPROS/USDC LP** — highlights `LIVE INFORMATIONAL — DUAL-ASSET AMM` badge, `6.26%` full-range benchmark, and impermanent loss disclosure.
- **Voiceover Narration:**
  > "On Pharos Pacific Mainnet, the optimizer monitors three on-chain sources with full provenance disclosures. First, Faroo Liquid Staking is the single actionable verified destination, compounding PROS into stPROS at a live spot exchange rate of 1.0074 PROS per stPROS. Second, Pharos Native PoS Consensus Staking is monitored as an informational benchmark with a historical 29.98% realized delegator return, but is strictly flagged as restricted because retail contract delegation is not permissionless on-chain. Third, FaroSwap V3 WPROS-USDC LP is an informational benchmark showing a 6.26% full-range fee estimate, with clear warnings regarding dual-asset exposure and impermanent loss."

---

### Scene 4: Scenario 1 — Lockup Boundary Enforcement: STAY_PUT (1:28 – 2:05)
- **Visual:** Scroll up to Scenario Modeling controls and Recommendation Card.
- **On-Screen Actions:**
  - Cursor moves to `#principalInput`. Types `1000`.
  - Cursor drags `#horizonInput` slider to `14 Days` (`#horizonValDisplay` shows *"14 Days"*).
  - Selects Patient Unbonding preference.
  - Focuses on `#recommendationCard`:
    - Decision badge renders red: `STAY PUT`.
    - Net Alpha displays: `0.0000 PROS`.
    - Reason: *"Investment horizon (14 days) is shorter than mandatory protocol lockup/unbonding periods (15 days total: 14-day queue + 1-day settlement buffer)."*
- **Voiceover Narration:**
  > "Let's test the recommendation engine's strict safety boundaries. We input 1,000 PROS with a 14-day holding horizon. Faroo requires a 14-day protocol unbonding queue plus a one-day settlement safety buffer, totaling 15 days. Because our 14-day horizon is shorter than the mandatory 15-day unbonding period, the optimizer automatically issues a STAY_PUT decision. Capital is protected from being locked beyond the user's available investment timeframe."

---

### Scene 5: Scenario 2 — Economically Justified Rebalancing: MOVE (2:05 – 2:48)
- **Visual:** Horizon slider adjusted to 60 Days.
- **On-Screen Actions:**
  - Cursor smoothly drags `#horizonInput` slider to `60 Days` (`#horizonValDisplay` updates to *"60 Days"*).
  - Decision badge turns green: `MOVE`.
  - Net Alpha displays: `+13.9700 PROS (+1.40%)`.
  - Cursor highlights key metrics:
    - Estimated Gas: `0.002650 PROS` (265,000 gas units).
    - Yield Accrual Break-Even: `~16 mins (< 1 day)`.
    - Mandatory Lockup: `15 Days`.
    - Financial modeling notice disclosing 8.50% annualized illustrative assumption.
- **Voiceover Narration:**
  > "Now let's extend the investment horizon to 60 days. The engine re-evaluates and issues a MOVE recommendation to Faroo Patient Staking. Notice the complete lifecycle math: the engine projects gross yield using an illustrative 8.50% consensus equilibrium model, and strictly deducts 265,000 gas units—180,000 for wrap, approve, and deposit, plus 85,000 for unbonding queue submission. This yields an estimated net gain of plus 13.97 PROS over holding baseline PROS, easily exceeding the required 0.10 PROS meaningful alpha threshold."

---

### Scene 6: Non-Custodial Transaction Reviewer & Recipient Validation (2:48 – 3:30)
- **Visual:** Transaction Reviewer Modal.
- **On-Screen Actions:**
  - Cursor moves to `#openReviewerBtn` (*"Review Prepared Transactions"*), clicks with ripple.
  - `#reviewerModal` opens smoothly.
  - Highlights amber banner: *"⚠️ Incomplete Calldata — Receiver wallet address required for Step 3"*.
  - Cursor clicks into `#modalReceiverInput`, types `0x7777777777777777777777777777777777777777`.
  - Clicks `#applyReceiverBtn` (*"Update Calldata"*).
  - Banner turns green: *"✓ Ready for External Review — All execution steps verified with valid receiver"*.
  - Cursor scrolls through the three steps:
    - **Step 1:** Wrap 1,000 PROS to Canonical WPROS (`0x52c4...f0b0`).
    - **Step 2:** Approve Faroo stPROS Vault to spend WPROS.
    - **Step 3:** Deposit 1,000 WPROS to Faroo Proxy (`0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`), minting shares to receiver `0x7777...7777`.
  - Hovers over the *"Copy Calldata"* buttons and the non-custodial disclaimer.
  - Clicks `#closeModalBtn` to return to dashboard.
- **Voiceover Narration:**
  > "Clicking Review Prepared Transactions opens our non-custodial transaction reviewer. The optimizer generates unsigned, reviewable calldata for external inspection. Entering a valid Pacific Mainnet recipient address populates the deposit call parameters. Step 1 deposits native PROS into WPROS. Step 2 approves the Faroo vault. Step 3 deposits WPROS into the verified Faroo proxy. Each step includes target contract addresses, verified selectors, decoded parameters, and raw hex calldata with one-click copy. The agent never asks for private keys and cannot sign or broadcast transactions."

---

### Scene 7: Instant Exit Liquidity Guard — Fail-Closed Protection (3:30 – 4:00)
- **Visual:** Scenario controls — Liquidity Preference Radio.
- **On-Screen Actions:**
  - Cursor moves to Liquidity Preference radio group.
  - Clicks *"Instant Secondary DEX"* radio option.
  - Decision Card updates immediately to `STAY PUT`.
  - Reason Code displays: `NO_VERIFIED_SECONDARY_LIQUIDITY`.
  - Explanation: *"No verified secondary market liquidity pool exists for stPROS on Pharos DEX factories. Immediate liquidity redemption cannot be guaranteed on-chain without waiting in the 15-day protocol unbonding queue."*
  - Shows that calldata preparation is safely refused.
- **Voiceover Narration:**
  > "Next, we test our instant exit safety guard by selecting Instant Liquidity preference. Because no verified secondary market liquidity pool exists for stPROS on Pacific Mainnet, the engine refuses to recommend an instant DEX exit. Instead, it issues a STAY_PUT decision and disables calldata preparation, preventing users from attempting swaps on unbacked pools."

---

### Scene 8: Terminal Test Verification, Reproduction & Conclusion (4:00 – 4:25)
- **Visual:** Terminal window displaying live test suite execution.
- **On-Screen Actions:**
  - Types `npm test`.
  - Terminal scrolls through 60 test suites, 190 passing tests, and numerical verification.
  - Displays GitHub repository URL: `https://github.com/JimmyOgb/pharos-yield-optimizer`.
  - Concluding fade out.
- **Voiceover Narration:**
  > "The complete project is open source on GitHub at JimmyOgb slash pharos-yield-optimizer. The test suite includes 190 automated unit, integration, and live RPC smoke tests covering 100% precision across all boundary conditions. Judges can clone the repository, run npm test, and reproduce every calculation in seconds. Thank you for reviewing the Pharos Yield Optimizer."
