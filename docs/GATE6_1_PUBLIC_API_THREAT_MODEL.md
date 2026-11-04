# GATE 6.1 — PUBLIC RPC AND API THREAT MODEL
## Attack Surface Analysis, Threat Vectors & Minimum Safe Public Configuration

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Task #15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor:** Antigravity AI  
**Scope:** Public Exposure Security & Threat Assessment  

---

## 1. Executive Summary

This report evaluates the potential security threats, denial-of-service vectors, proxy abuse risks, and data integrity vulnerabilities that could arise if the Pharos Yield Optimizer API is exposed to the public internet.

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      THREAT MODEL VERDICT: LOW RESIDUAL RISK                  ║
║  • Generic RPC Proxy Abuse: IMPOSSIBLE (No open JSON-RPC proxy endpoint)      ║
║  • Arbitrary RPC Method Execution: IMPOSSIBLE (Strict whitelist in client)    ║
║  • State-Mutation / Fund Theft: ZERO RISK (Client contains zero private keys) ║
║  • Unbounded Body DoS: MITIGATED (64 KB hard request capping)                ║
║  • Path Traversal: IMPOSSIBLE (Exact-match string routing)                    ║
║  • Error Information Leakage: MITIGATED (Sanitized 500 responses)             ║
║  • Cache/Staleness Attack: MITIGATED (600s freshness window enforced)         ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Threat Vector Evaluation

### A. Generic RPC Proxy Abuse
- **Threat:** Malicious actors use public backend endpoints as an unmetered, free proxy to relay arbitrary Ethereum JSON-RPC requests (e.g. scanning addresses, brute-forcing contracts, spamming network nodes).
- **Architecture Inspection:**
  - The Yield Optimizer does **NOT** expose an open `POST /rpc` or `POST /api/rpc` pass-through endpoint.
  - The API router defines exactly four specific REST endpoints:
    1. `GET /api/health`
    2. `GET /api/sources`
    3. `POST /api/recommendation`
    4. `POST /api/transaction-review`
- **Verdict:** **IMMUNE.** Arbitrary RPC methods cannot be relayed through the server.

### B. User-Influenced RPC Queries
- **Threat:** Malicious inputs (e.g., custom contract addresses, gas parameters, payload data) manipulate internal RPC calls to target internal networks or non-canonical contracts (SSRF).
- **Architecture Inspection:**
  - In `POST /api/recommendation`, user inputs are strictly:
    - `principalPros` (number)
    - `horizonDays` (number)
    - `requiresInstantLiquidity` (boolean)
    - `currentStrategyId` (whitelisted enum string)
    None of these parameters are passed into RPC queries! They are consumed strictly by local in-memory math algorithms (`FrictionModel`, `YieldMath`, `RecommendationEngine`).
  - In `POST /api/transaction-review`, the inputs are:
    - `strategyId` (whitelisted enum string)
    - `amountPros` (number)
    - `userAddress` (validated regex `^0x[a-fA-F0-9]{40}$`)
    The `userAddress` is left-padded into local calldata generation in memory. It is **never** dispatched to the RPC server as a parameter.
  - All RPC queries executed by `PharosRpcClient` use hardcoded contract targets from `CANONICAL_CONTRACTS`:
    - Faroo stPROS: `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`
    - WPROS: `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0`
    - DEX PoolManager: `0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550`
    - DEX StateView: `0x616434e941c5E53d44894bF9ca13D517927BF8aF`
- **Verdict:** **IMMUNE TO SSRF.** User input has zero influence over RPC target addresses or call selectors.

### C. Server Resource Exhaustion (Denial-of-Service)
- **Threat:** Flooding the server with multi-megabyte JSON payloads to induce memory exhaustion and CPU lockup.
- **Countermeasure:** `readJsonBody()` enforces a 64 KB (65,536 bytes) limit. As soon as stream chunks exceed 64 KB, the stream is destroyed and throws `Payload too large`.
- **Status:** **MITIGATED.**

### D. Upstream RPC Rate Limiting & Outage Resilience
- **Threat:** An attacker spams `GET /api/sources`, triggering hundreds of concurrent `eth_call` requests to `https://rpc.pharos.xyz`, exhausting public RPC rate limits.
- **Countermeasure:**
  - `PharosRpcClient` implements bounded exponential backoff retries (`DEFAULT_MAX_RETRIES = 3`, 8,000ms timeout).
  - If upstream RPC fails or returns 429/500, the router returns a clean `503 Service Unavailable` with `{ status: "degraded", isFresh: false }`.
  - The recommendation engine refuses to execute projections without fresh data, returning `INSUFFICIENT_DATA`.
- **Hardening Recommendation for Public Exposure:** Add a lightweight in-memory LRU cache (e.g. 15-second TTL) for `fetchLiveContext()` so repeated public requests share cached observations rather than hammering the RPC endpoint.

### E. Cross-Origin Resource Sharing (CORS) Policy
- **Threat:** Third-party websites issuing cross-origin requests to read user data or impersonate sessions.
- **Assessment:**
  - The application is 100% read-only and stateless. It uses zero session cookies, zero authorization headers, and zero user accounts.
  - Development mode defaults `Access-Control-Allow-Origin: *`.
- **Public Recommendation:** When deployed to production, configure `CORS_ORIGIN=https://<your-domain>` to prevent unauthorized third-party embeds.

### F. Stale Data & Time-Skew Exploitation
- **Threat:** Serving cached or stale exchange rates during extreme market movements, causing misleading recommendations.
- **Countermeasure:** Every block header observation timestamp is evaluated against `STALE_DATA_THRESHOLD_SECONDS = 600`. Any observation older than 10 minutes sets `isFresh = false` and disables recommendation calculations.
- **Status:** **VERIFIED & TESTED.**

### G. Client-Side Browser RPC Exposure
- **Threat:** Frontend leaking private RPC API keys or exposing browser wallets to phishing attacks.
- **Assessment:**
  - The Pharos Pacific Mainnet RPC (`https://rpc.pharos.xyz`) is a free public endpoint requiring zero API keys.
  - The frontend `app.js` makes API calls strictly to `/api/health`, `/api/sources`, `/api/recommendation`, and `/api/transaction-review`.
  - The frontend never connects directly to Ethereum RPC nodes or injected browser providers without user action.
- **Status:** **LOW RISK.**

---

## 3. Threat Assessment Matrix

| Threat ID | Threat Description | Severity | Likelihood | Mitigation Implemented | Residual Risk |
| :-: | :--- | :---: | :---: | :--- | :---: |
| **TH-01** | Arbitrary JSON-RPC relay / proxy abuse | Critical | High | No open RPC proxy endpoint exists. | **NONE** |
| **TH-02** | SSRF via user-supplied contract addresses | High | High | All RPC targets hardcoded in `CANONICAL_CONTRACTS`. | **NONE** |
| **TH-03** | Oversized JSON body memory exhaustion | Medium | High | 64 KB request body limit enforced. | **LOW** |
| **TH-04** | Upstream RPC rate limit exhaustion via floods | Medium | Medium | Bounded retries + 8s timeouts. | **LOW** *(Cache recommended)* |
| **TH-05** | Internal stack trace & directory leakage | Medium | Medium | Sanitized `{ error: "Internal Server Error" }`. | **NONE** |
| **TH-06** | Static directory path traversal | High | High | Exact-match routing; no path concatenation. | **NONE** |
| **TH-07** | Cross-Site Scripting (XSS) via dynamic data | High | Medium | Strict CSP (`script-src 'self'`) + `escapeHtml()`. | **NONE** |
| **TH-08** | Unauthorized transaction signing / broadcast | Critical | Low | Zero signing / broadcasting code in codebase. | **NONE** |

---

## 4. Minimum Safe Public Configuration

When deploying the application to the public internet, enforce the following configuration:

```bash
# 1. Network Interface
HOST=127.0.0.1                     # Keep server bound to loopback behind a reverse proxy

# 2. Reverse Proxy (TLS & DDoS Termination)
# Deploy behind Vercel edge network OR NGINX with Let's Encrypt SSL
# Reverse proxy terminates HTTPS and forwards Host/X-Forwarded-For headers

# 3. CORS Origin Restriction
CORS_ORIGIN=https://pharos-yield-optimizer.vercel.app  # Domain-lock API responses

# 4. HTTP Headers
# Ensure X-Content-Type-Options: nosniff and Content-Security-Policy remain active

# 5. Upstream RPC Rate Shielding
# Cache live context in memory for 15 seconds to absorb public traffic spikes
```
