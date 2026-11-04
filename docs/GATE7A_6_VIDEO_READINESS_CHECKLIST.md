# GATE 7A.6 — VIDEO DEMONSTRATION READINESS CHECKLIST
## Structured Walkthrough Protocol, Step-by-Step Script & Presentation Safety Rules

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Safety & Demonstration Boundaries

> **MANDATORY NOTICE:**  
> This checklist prepares the structure and verified script for a future video walkthrough. **NO VIDEO IS BEING RECORDED, PRODUCED, UPLOADED, OR PUBLISHED DURING THIS GATE.**

### Core Demonstration Principles
1. **Zero Fabrication:** Never stage fake wallet balances, fabricated transaction receipts, or synthetic RPC nodes.
2. **Real Network Telemetry:** Record only against live Pharos Pacific Mainnet (`https://rpc.pharos.xyz`, Chain ID 1672).
3. **Truth-First Accounting:** Prominently highlight the `1 of 3 qualifying sources` acceptance banner and explain the engineering justification behind it.

---

## 2. Step-by-Step Walkthrough Protocol

| Scene | Duration | Visual Focus | Key Audio Narration & Demonstration Points | Verification Check |
| :---: | :---: | :--- | :--- | :--- |
| **1** | 0:00–0:40 | Header & Network Health Panel | Introduce Pharos Yield Optimizer. Point to live Pacific Mainnet connection (`Chain ID: 1672`), current block height ($> 22\text{M}$), block timestamp, and live gas price ($1.25\text{ Gwei}$). Point out the data freshness badge (`Fresh (< 10s)`). | Live block counter increments. |
| **2** | 0:40–1:30 | Yield Sources Matrix & Invariant Pill | Walk through the 4 displayed strategies. Show Faroo stPROS verified on-chain at $\approx 1.0049$ exchange rate. Explain why Pharos DEX LP and Axil Prime Credit are disqualified. Highlight the prominent **`1 of 3 Qualifying Sources — Requirement NOT Met`** honesty banner. | Truth-first audit badge visible. |
| **3** | 1:30–2:30 | Scenario A: Patient Staking (`MOVE`) | Enter $1,000\text{ PROS}$, $60\text{ days}$ horizon, uncheck instant liquidity. Click evaluate. Show **`ACTION: MOVE`** badge, $+13.972272\text{ PROS}$ net gain, $0.000331\text{ PROS}$ lifecycle gas ($265\text{k gas}$), and **`"~2 mins (< 1 day)"`** break-even duration. | Net alpha and sub-day break-even render cleanly. |
| **4** | 2:30–3:30 | Scenario B: Lockup Constraint (`STAY_PUT`) | Adjust horizon to $7\text{ days}$. Click evaluate. Show immediate verdict change to **`VERDICT: STAY PUT`** with reason code `HORIZON_SHORTER_THAN_LOCKUP`. Explain that Faroo requires a 14-day unbonding queue. | Prevents capital lockup traps. |
| **5** | 3:30–4:30 | Scenario C: Instant DEX Friction (`STAY_PUT`) | Check "Requires Instant Liquidity" box, horizon $1\text{ day}$. Show verdict remains **`VERDICT: STAY PUT`** with reason `FRICTION_EXCEEDS_GROSS_YIELD`. Point out that the $4.0004\text{ PROS}$ swap fee/slippage exceeds $0.2329\text{ PROS}$ 1-day gross return ($17.18\text{ days}$ break-even). | Discloses DEX swap fees and slippage. |
| **6** | 4:30–5:45 | Non-Custodial Reviewer Modal | Return to Scenario A ($1,000\text{ PROS}$ / $60\text{ days}$). Click "Review Unsigned Transactions". Walk through the 3 execution steps: (1) Wrap PROS to WPROS ($45\text{k gas}$), (2) Approve Faroo vault ($45\text{k gas}$), (3) Deposit into stPROS ($90\text{k gas}$). Show exact Keccak-256 selectors, raw hex calldata, and copy buttons. Emphasize that the agent never holds keys or broadcasts transactions. | Unsigned calldata modal renders with safety disclaimers. |
| **7** | 5:45–6:15 | Terminal / CLI Verification | Show terminal running `npm run verify:numerical` and `npm test` (130 passing tests). Show clean architecture and zero runtime dependencies. | All tests passing in terminal. |

---

## 3. Pre-Recording Technical Checklist

- [ ] Node.js process running locally: `npm run start:prod` (bound to `http://127.0.0.1:3000`).
- [ ] Pacific Mainnet RPC responsive (`https://rpc.pharos.xyz`).
- [ ] Browser window sized to standard 16:9 1080p ($1920 \times 1080$).
- [ ] Dark theme active with clean visual contrast.
- [ ] Console window open to confirm 0 JavaScript errors or CSP violations in browser DevTools.
- [ ] Calldata copy functionality tested via clipboard paste into scratchpad.
- [ ] Disclaimers clearly legible on screen without scrolling occlusions.
