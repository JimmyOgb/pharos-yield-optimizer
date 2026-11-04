# GATE 7A — SECURITY & NON-CUSTODIAL REVIEW
## Threat Analysis, Platform Boundaries & Defense-in-Depth for Serverless Deployment

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Execution Boundary:** Local Packaging & Testing ONLY — ZERO External Deployment  

---

## 1. Security Baseline & Invariants

The security model of the Pharos Yield Optimizer is anchored by four absolute, non-negotiable invariants:

```
╔═════════════════════════════════════════════════════════════════════════════════════════════╗
║                               CORE SECURITY INVARIANTS                                      ║
║                                                                                             ║
║  1. ZERO PRIVATE KEYS:        No private keys, seed phrases, or credentials stored/accepted ║
║  2. STRICTLY READ-ONLY:       Zero signing, zero broadcast, zero mutating RPC methods       ║
║  3. TRUTH-FIRST DISCLOSURE:   FEWER THAN THREE QUALIFYING SOURCES — REQUIREMENT NOT MET     ║
║  4. AIR-TIGHT ISOLATION:      Zero modifications to Task 14 or sibling workspaces           ║
╚═════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Serverless Threat Model & Mitigations

Deploying on a public serverless platform like Vercel introduces architectural differences from local loopback binding (`127.0.0.1`). Each threat has been systematically addressed:

### A. Denial of Service & RPC Exhaustion
- **Threat:** Unauthenticated public requests could trigger rapid RPC calls to `https://rpc.pharos.xyz`, exhausting public RPC rate limits or inflating compute costs.
- **Mitigation:**
  1. **Sliding-Window Rate Limiter:** Enforced in `ApiRouter` tracking client IPs (via `x-forwarded-for` and socket address). Limits clients to **60 requests per minute**. Rejections return `HTTP 429 Too Many Requests` with a `Retry-After: 60` header.
  2. **Short-Lived Response Caching:** Idempotent read calls in `PharosRpcClient` are cached with a **3,000ms TTL**. Rapid concurrent requests share cached observations without issuing upstream HTTP requests.
  3. **Bounded Request Payload:** Body size is strictly capped at **64 KB**; oversized requests are rejected immediately with `HTTP 400 Bad Request`.

### B. Information Disclosure & Stack Trace Leaks
- **Threat:** Unexpected runtime exceptions in serverless functions could expose server file paths, dependency versions, or environmental internals.
- **Mitigation:**
  1. **Shielded Handlers:** `api/index.ts` wraps all invocations in `try/catch`. Unhandled errors return a sanitized JSON error payload:
     ```json
     {
       "error": "Internal Server Error",
       "message": "Sanitized error message"
     }
     ```
  2. **Header Enforcement:** All serverless responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.

### C. Content Security Policy (CSP) & Cross-Site Scripting (XSS)
- **Threat:** Client dashboard could be subjected to unauthorized script execution or data exfiltration.
- **Mitigation:**
  - `vercel.json` and standalone server enforce an identical, strict Content Security Policy:
    ```http
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://rpc.pharos.xyz; img-src 'self' data:; object-src 'none'; base-uri 'self';
    ```
  - Eliminates external scripts, restricts outbound network connections exclusively to `self` and `https://rpc.pharos.xyz`, forbids flash/plugins (`object-src 'none'`), and prevents clickjacking (`X-Frame-Options: DENY`).

### D. CORS Misconfiguration
- **Threat:** Wildcard CORS on sensitive endpoints could permit malicious origins to spoof user queries.
- **Mitigation:**
  - `corsOrigin` is configurable via environment variable `CORS_ORIGIN`.
  - When deployed to production, `CORS_ORIGIN` can be locked to the exact deployment domain (e.g., `https://pharos-optimizer.vercel.app`).
  - Preflight `OPTIONS` requests are answered with `HTTP 204 No Content` and appropriate allowed methods (`GET, POST, OPTIONS`).

---

## 3. Non-Custodial Boundaries & Transaction Safety

The Transaction Reviewer (`src/reviewer/transactionReviewer.ts`) was audited for non-custodial compliance:

| Dimension | Audit Finding | Verification Status |
| :--- | :--- | :--- |
| **Private Key Imports** | Completely absent. Codebase contains zero key handling routines. | **PASSED** |
| **Signing Algorithms** | Zero ECDSA, secp256k1, or Web3 signing dependencies. | **PASSED** |
| **Broadcasting Capability** | RPC client lacks `eth_sendRawTransaction` and `eth_sendTransaction`. | **PASSED** |
| **Calldata Generation** | Only strictly verified ABIs (Faroo ERC-4626 and WPROS) generate calldata. | **PASSED** |
| **Disqualified Sources** | Disqualified sources (Axil APC3M, Native PoS) emit `UNAVAILABLE` status; zero mock calldata. | **PASSED** |
| **Safety Disclosures** | Every review payload explicitly includes `safetyNotice.isNonCustodial: true` and `canSign: false`. | **PASSED** |

---

## 4. Verification Check: No Sensitive Credentials Required

A scan of the environment and configuration confirms:
- **Zero Secrets Required:** The application requires no private keys, seed phrases, API keys, or database credentials.
- **Required Environment Variables:** Only non-secret public parameters (`PHAROS_RPC_URL`, `CHAIN_ID`, `CORS_ORIGIN`, `LOG_LEVEL`).
- **`.env.example`:** Fully audited; contains only public documentation defaults.
