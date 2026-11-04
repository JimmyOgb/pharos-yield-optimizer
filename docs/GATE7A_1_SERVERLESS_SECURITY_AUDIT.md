# GATE 7A.1 — SERVERLESS SECURITY & RATE-LIMITING AUDIT
## Detailed Threat Model, Proxy IP Analysis, Cache Isolation & Non-Custodial Bounds

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  
**Execution Boundary:** READ-ONLY INSPECTION & LOCAL VERIFICATION ONLY  

---

## 1. Executive Summary & Security Verdict

| Security Dimension | Audit Result | Classification |
| :--- | :--- | :---: |
| **In-Memory Rate Limiting** | Operational per function instance (60 req/min); resets on cold start | **PASS WITH WARNING** |
| **IP Header Spoofing** | Uses first element of `x-forwarded-for`; vulnerable to client spoofing if untrusted proxy precedes edge | **PASS WITH WARNING** |
| **3-Second RPC Cache Isolation**| Deterministic `${method}:${JSON.stringify(params)}` key; zero user data in cache; errors unmanaged/uncached | **PASS** |
| **Cross-Request Data Leakage** | Strictly zero. RPC calls are public read-only Ethereum queries only | **PASS** |
| **Content Security Policy (CSP)**| Strict header enforced in `vercel.json` and standalone server | **PASS** |
| **Payload Size Protection** | Strict 64 KB maximum payload enforced in `readJsonBody` | **PASS** |
| **Non-Custodial Invariant** | Zero private keys, zero signing, zero mutating RPC methods | **PASS** |
| **Secrets & Credential Exposure**| Verified: zero secrets required, zero credentials stored or bundled | **PASS** |

---

## 2. In-Depth Audit of the Rate Limiting Implementation

### Implementation in `src/server/router.ts`:
```ts
private checkRateLimit(req: IncomingMessage): boolean {
  if (!this.rateLimitConfig.enabled) return false;

  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress) || '127.0.0.1';
  const now = Date.now();
  const windowStart = now - this.rateLimitConfig.windowMs;

  let timestamps = this.ipRequests.get(ip) ?? [];
  timestamps = timestamps.filter(t => t > windowStart);

  if (timestamps.length >= this.rateLimitConfig.maxRequests) {
    this.ipRequests.set(ip, timestamps);
    return true; // Rate limited
  }

  timestamps.push(now);
  this.ipRequests.set(ip, timestamps);
  return false;
}
```

### Critical Security Findings & Clarifications:

1. **Per-Instance Memory vs. Global Rate Limiter:**
   - **Finding:** `this.ipRequests` is stored in process RAM (`Map<string, number[]>`).
   - In a serverless architecture like Vercel, requests are distributed across dynamic microVMs / function instances.
   - Each instance maintains its own memory. Therefore, this limiter is strictly a **per-instance local rate limiter**, NOT a globally synchronized limiter.
   - An attacker distributing requests across multiple concurrent Vercel function instances could send more than 60 requests/minute before triggering an instance-level limit.
   - **Assessment:** Per-instance rate limiting protects individual container resources and prevents single-client loop DOS, but production multi-instance DDoS mitigation relies on Vercel's Edge Firewall.

2. **Cold-Start Resilience:**
   - When a Vercel function instance goes cold and terminates after idle time, its in-memory map is completely cleared.
   - On cold start, the rate-limiting history begins fresh.

3. **IP Header Spoofing Vulnerability:**
   - `forwarded.split(',')[0].trim()` takes the leftmost IP in the `X-Forwarded-For` header.
   - If an untrusted client sends `X-Forwarded-For: 8.8.8.8` to a serverless function, and the intermediary proxy appends rather than replaces the header (`8.8.8.8, <real_ip>`), taking index 0 will attribute the request to `8.8.8.8`.
   - **Recommended Gate 7B Fix:** When running on Vercel, use the edge-sanitized headers `x-real-ip` or `x-vercel-forwarded-for` before falling back to `x-forwarded-for`.

---

## 3. In-Depth Audit of the 3-Second RPC Cache

### Implementation in `src/rpc/pharosClient.ts`:
```ts
const cacheKey = `${method}:${JSON.stringify(params)}`;
if (this.cacheTtlMs > 0) {
  const cached = this.cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value as T;
  }
}
```

### Critical Cache Isolation Findings:

1. **Cache Key Construction:**
   - Formatted as `${method}:${JSON.stringify(params)}`.
   - Idempotent queries are strictly isolated by method and arguments:
     - `eth_chainId:[]`
     - `eth_blockNumber:[]`
     - `eth_getBlockByNumber:["latest",false]`
     - `eth_gasPrice:[]`
     - `eth_call:[{"to":"0x18160...","data":"0x01e1d114"},"latest"]`
   - Different contract calls or parameter variations generate distinct, non-overlapping cache keys.

2. **Error Handling & Failure Caching:**
   - **Finding:** Errors are **NOT cached**.
   - If an RPC query encounters a network timeout, HTTP 500, or node error, it throws an exception immediately without writing to `this.cache`.
   - This guarantees that a transient RPC glitch does not pollute subsequent requests with stale error states.

3. **Cross-User Data Leakage Risk:**
   - **Finding:** **ZERO risk of cross-user leakage.**
   - The RPC client only calls public, unauthenticated EVM node methods querying canonical on-chain addresses (`CANONICAL_CONTRACTS.FAROO_STPROS`, `CANONICAL_CONTRACTS.CANONICAL_WPROS`).
   - No user addresses, session IDs, private parameters, or personal data ever pass into `PharosRpcClient.request()`.
   - Cached responses are 100% public blockchain observations.

4. **Freshness & Recommendation Defensibility:**
   - The cache TTL is **3,000ms (3.0 seconds)**.
   - Block production time on Pharos Pacific Mainnet is $\approx 2.0\text{ seconds}$.
   - The project's stale data threshold is **600 seconds (10 minutes)**.
   - A 3-second cache TTL guarantees that recommendation outcomes reflect live on-chain reality while preventing concurrent requests from overloading the public node.

---

## 4. Content Security Policy & Client Protection

The application enforces an institutional Content Security Policy in `vercel.json` and `src/server/index.ts`:

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://rpc.pharos.xyz; img-src 'self' data:; object-src 'none'; base-uri 'self';
```

- **Outbound Connections:** Strictly restricted to `self` and `https://rpc.pharos.xyz`. Any attempt by an injected script to communicate with external servers is blocked at the browser network layer.
- **Script Execution:** Restricted to `'self'`, blocking inline JavaScript and third-party script injection.
- **Clickjacking Prevention:** `X-Frame-Options: DENY` is applied globally.
- **MIME Sniffing:** `X-Content-Type-Options: nosniff` is applied across all static and API routes.

---

## 5. Non-Custodial Safety & Secret Auditing

1. **Private Keys:** A recursive scan of all TypeScript, JavaScript, JSON, and markdown files confirms zero private keys, mnemonic phrases, or keystore files.
2. **Signing Algorithms:** No cryptographic signing routines (`secp256k1`, `ethers.Wallet`, `web3.eth.accounts`) exist in the workspace.
3. **RPC Mutation:** The RPC client completely omits `eth_sendRawTransaction`, `eth_sendTransaction`, and `eth_sign`.
4. **Transaction Reviewer Output:** Every transaction preview generates unsigned calldata only, accompanied by the explicit non-custodial disclosure:
   ```json
   "safetyNotice": {
     "isNonCustodial": true,
     "canSign": false,
     "canBroadcast": false
   }
   ```
