# GATE 6 — PRODUCTION SMOKE TEST REPORT
## Local Production Artifact Verification against Live Pacific Mainnet

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Task #15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Test Suite:** `tests/integration/productionSmoke.test.ts`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Executive Summary

This report documents the local smoke testing of the compiled production distribution (`dist/server.js`) of the Pharos Yield Optimizer. The tests were conducted against live Pharos Pacific Mainnet endpoints (`https://rpc.pharos.xyz`, Chain ID 1672), validating static asset delivery, Content Security Policy enforcement, live blockchain RPC communication, deterministic recommendation calculations, non-custodial transaction reviewer payloads, and error resiliency.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                   GATE 6 PRODUCTION SMOKE TEST: 100% PASS                     ║
║  • Executable Under Test: `dist/server.js` (Compiled ESM Production Bundle)   ║
║  • Network Queried: Live Pharos Pacific Mainnet (Chain ID 1672)              ║
║  • Live Block Observed: Block > 22,000,000 (Header Age < 10 seconds)         ║
║  • Qualifying Sources Verified: Exactly 1 (Faroo stPROS spot rate ~1.0049)   ║
║  • Acceptance Invariant: FEWER THAN THREE SOURCES — Strictly Preserved       ║
║  • Non-Custodial Boundaries: ZERO signing, ZERO broadcasting, Unsigned Only   ║
║  • CSP & DOM Hardening: Full CSP header enforcement, Zero inline handlers    ║
║  • Overall Smoke Suite Result: 9 Passed / 0 Failed (100% Pass Rate)          ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Test Execution Details & Exact Outputs

- **Command:** `node --experimental-strip-types --test tests/integration/productionSmoke.test.ts`
- **Execution Date:** November 4, 2026
- **Exit Code:** `0`
- **Duration:** 10,607 ms

### Test Cases & Assertions Matrix

| # | Test Case Description | Target Route / Method | Key Assertion / Verification | Result |
| :-: | :--- | :--- | :--- | :---: |
| **1** | Static HTML & CSP Enforcement | `GET /` | Returns `200 OK`, `text/html`. `Content-Security-Policy` header validated containing `default-src 'self'`, `script-src 'self'`, `object-src 'none'`. `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`. | **PASS** |
| **2** | CSS Delivery | `GET /styles.css` | Returns `200 OK`, `text/css`. Root design tokens (`--bg-base`) verified. | **PASS** |
| **3** | JS Delivery & Event Handler Security | `GET /app.js` | Returns `200 OK`, `application/javascript`. Confirmed `app.js` contains **zero** `onclick=` attributes, **zero** `window.copyToClipboard` globals, and uses `data-calldata` event delegation. | **PASS** |
| **4** | Live RPC Health & Block Freshness | `GET /api/health` | Returns `200 OK`. `status: "healthy"`, `chainId: 1672`, `network: "Pharos Pacific Mainnet"`, `latestBlockNumber > 22,000,000`, `isFresh: true`. | **PASS** |
| **5** | Live Yield Sources & Invariant Preservation | `GET /api/sources` | Returns `200 OK`. Verified `invariantNotice.status === "FEWER_THAN_THREE_QUALIFYING_SOURCES"`, `verifiedCount === 1`, `requiredCount === 3`. Faroo stPROS spot rate confirmed live on-chain ($\ge 1.004$). | **PASS** |
| **6** | Live Recommendation Engine | `POST /api/recommendation` | Returns `200 OK`. Scenario: 1,000 PROS over 60 days. Decision: `MOVE` to `faroo-patient-staking`. Projected Net Gain > 0 PROS. | **PASS** |
| **7** | Non-Custodial Transaction Reviewer | `POST /api/transaction-review` | Returns `200 OK`. Produces 3-step unsigned calldata: Step 1 `deposit()` (`0xd0e30db0`), Step 2 `approve()` (`0x095ea7b3`), Step 3 Faroo `deposit()` (`0x6e553f65`). `safetyNotice.isNonCustodial === true`, `canSign === false`, `canBroadcast === false`. | **PASS** |
| **8** | Disqualified Source Refusal | `POST /api/transaction-review` | Returns `200 OK`. For `axil-prime-credit`, produces `payloadStatus: "UNAVAILABLE"` with reason `TRANSACTION_PAYLOAD_UNAVAILABLE`. Zero calldata fabrication. | **PASS** |
| **9** | Input Sanitization & Anti-DoS | `POST /api/recommendation` | Malformed JSON string (`invalid-json{{{`) returns `400 Bad Request` with `{ error: "Invalid JSON payload" }`. | **PASS** |

---

## 3. Live RPC & Non-Custodial Verification

### Live State Evidence
```json
{
  "status": "healthy",
  "network": "Pharos Pacific Mainnet",
  "chainId": 1672,
  "rpcUrl": "https://rpc.pharos.xyz",
  "latestBlockNumber": 22020148,
  "gasPriceGwei": "10.00 Gwei",
  "isFresh": true,
  "farooSpotRate": "1.00491704"
}
```

### Non-Custodial Boundary Evidence
```json
{
  "safetyNotice": {
    "isNonCustodial": true,
    "canSign": false,
    "canBroadcast": false,
    "requiresExternalSigner": true,
    "notice": "This transaction reviewer produces unsigned calldata only. The application possesses zero private keys and cannot sign or broadcast transactions."
  }
}
```

All 9 production smoke tests verified passing against the compiled `dist/server.js` artifact.
