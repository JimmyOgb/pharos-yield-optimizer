# GATE 7A.6 — SECURITY & NON-CUSTODIAL ARCHITECTURE AUDIT
## Application Threat Model, Boundary Analysis, and Safety Controls

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Safety Boundary Declaration

> **IMPORTANT DISCLAIMER:**  
> This document represents an internal engineering security and architectural review conducted by Antigravity AI. It is **NOT** a commercial security certification or an external third-party smart contract audit.

The Pharos Yield Optimizer is engineered with a strict **read-only and non-custodial** operational boundary. At no point does the application request, manage, store, sign, or broadcast transactions on behalf of users.

---

## 2. Cryptographic & Custodial Review

| Security Control | Implementation Status | Verified Evidence in Codebase |
| :--- | :---: | :--- |
| **Private-Key Handling** | **ZERO KEYS** | Grep of all `.ts` and `.js` files confirms zero private key variables, environment key imports, or keystore dependencies. |
| **Mnemonic Seed Phrases** | **ZERO SEEDS** | No BIP-39, BIP-44, or HD wallet derivation libraries present or referenced. |
| **Transaction Signing** | **NONE** | No signing algorithms (`secp256k1`, `signTransaction`, or `eth_sign`) exist anywhere in the codebase. |
| **Transaction Broadcasting** | **DISABLED** | `PharosRpcClient` explicitly omits `eth_sendRawTransaction` and `eth_sendTransaction`. |
| **Unsigned Calldata Review** | **ISOLATED** | `TransactionReviewer.generateReview()` produces raw hex strings for external wallet inspection only. |
| **Contract Target Validation** | **HARDCODED** | Target addresses are pinned to canonical Pacific Mainnet addresses in `src/reviewer/transactionReviewer.ts`. |
| **Selector Integrity** | **PINNED** | Method selectors (`0xd0e30db0`, `0x095ea7b3`, `0x6e553f65`) verified against standard EVM Keccak-256 hashes. |
| **Approval Allowance Risk** | **EXACT AMOUNT** | Step 2 approval is strictly bounded to the exact rebalance principal in wei; unlimited allowances (`2^256 - 1`) are prohibited. |

---

## 3. Web & API Threat Model Analysis

### 1. Input Validation & Request Body Safeguards
- **64 KB Payload Limit:** `router.ts` strictly enforces a maximum request payload size of $65,536\text{ bytes}$ (64 KB). Any payload exceeding this threshold immediately terminates the stream and returns `HTTP 400 Bad Request` with `Payload too large`.
- **JSON Parse Sanitization:** Malformed JSON strings are caught in a `try/catch` block, preventing unhandled exceptions and returning `HTTP 400 Bad Request`.
- **Type Checking:** All query fields (`principalPros`, `horizonDays`, `requiresInstantLiquidity`, `currentStrategyId`) undergo runtime boundary validation and type coercion.

### 2. HTTP Method Guards
- Every modular Vercel serverless entry point (`api/*.ts`) and internal router handler (`router.ts`) enforces strict method whitelisting:
  - `GET /api`, `GET /api/health`, `GET /api/sources`: Reject all non-`GET` / non-`OPTIONS` requests with `HTTP 405 Method Not Allowed` and an `Allow: GET, OPTIONS` header.
  - `POST /api/recommendation`, `POST /api/transaction-review`: Reject all non-`POST` / non-`OPTIONS` requests with `HTTP 405 Method Not Allowed` and an `Allow: POST, OPTIONS` header.

### 3. Content Security Policy (CSP) & Defensive Headers
Configured identically in `vercel.json`, `dist/server.js`, and `scripts/build.js`:
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://rpc.pharos.xyz; img-src 'self' data:; object-src 'none'; base-uri 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```
- **XSS Mitigation:** `object-src 'none'`, `base-uri 'self'`, and restricted `connect-src` prevent malicious script injection or data exfiltration.
- **Clickjacking Prevention:** `X-Frame-Options: DENY` prevents framing of the dashboard.
- **MIME Sniffing Prevention:** `X-Content-Type-Options: nosniff` is enforced on all JSON and static assets.

### 4. DOM Safety & Event Handling
- **Zero Inline Event Handlers:** Calldata copying uses semantic `data-calldata` attributes with event delegation listeners attached in `src/ui/app.js`.
- **Zero Global Window Pollution:** No functions or sensitive objects are bound to `window`.
- **HTML Sanitization:** All dynamic string outputs are escaped through `escapeHtml()` prior to DOM insertion.

### 5. Rate Limiting & Proxy Trust Assumptions
- **In-Memory Sliding Window:** The server tracks request timestamps per client IP, enforcing a threshold of 60 requests per minute. Exceeding this returns `HTTP 429 Too Many Requests` with a `Retry-After: 60` header.
- **Proxy Header Trust:** When deployed behind a reverse proxy (e.g., Vercel, Cloudflare, NGINX), the IP is extracted from `x-forwarded-for` (first hop) with a fallback to `req.socket.remoteAddress`. In self-hosted production setups, upstream proxies must overwrite (not append) untrusted `x-forwarded-for` headers.

### 6. Error Sanitization
- API error responses return structured JSON with generic, safe error messages:
  ```json
  {
    "error": "Bad Request",
    "message": "Invalid JSON payload"
  }
  ```
- Internal stack traces, server file paths, and environment variables are strictly suppressed in API outputs.

---

## 4. Disqualified Source Safeguards

A critical security vulnerability in many yield aggregators is the fabrication of dummy calldata for unverified or unsupported third-party contracts. 

In Pharos Yield Optimizer:
- If a user queries `/api/transaction-review` for **Axil Prime Credit** or **Native PoS Staking**, the reviewer:
  1. Sets `payloadStatus: 'UNAVAILABLE'`.
  2. Sets `unavailabilityReason: 'TRANSACTION_PAYLOAD_UNAVAILABLE'`.
  3. Omits the `payload` object completely (`to`, `data`, `value`, `gasLimit` are `undefined`).
  4. Issues an explicit disclaimer explaining that the protocol is disqualified from automated rebalancing.
- This prevents users from copying empty or erroneous calldata into their wallets.
