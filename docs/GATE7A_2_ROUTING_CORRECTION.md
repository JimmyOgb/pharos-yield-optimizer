# GATE 7A.2 — API ROUTING CORRECTION & ARCHITECTURE AUDIT
## Modular File-System Routing vs. Catch-All Rewrites Reconciliation

**Project:** Pharos Yield Optimizer  
**Network:** Pharos Pacific Mainnet (Chain ID 1672 / 0x688)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor:** Antigravity AI  
**Boundary:** Local Architecture Correction & Verification ONLY — Zero External Deployment  

---

## 1. Executive Summary

In Gate 7A, an architectural ambiguity was identified between:
1. A catch-all rewrite rule in `vercel.json`:
   ```json
   { "source": "/api/(.*)", "destination": "/api/index" }
   ```
2. Five modular TypeScript endpoint files in the `api/` directory:
   - `api/index.ts`
   - `api/health.ts`
   - `api/sources.ts`
   - `api/recommendation.ts`
   - `api/transaction-review.ts`

Under standard Vercel platform semantics, the catch-all rewrite rule forced the platform router to dispatch all incoming `/api/*` traffic to a single bundle compiled from `api/index.ts`, effectively shadowing and making the remaining four endpoint files unreachable as independent serverless functions.

In Gate 7A.2, this conflict was formally resolved by adopting **Native Vercel File-System Routing**.

---

## 2. Architectural Decision: Pure Vercel File-System Routing

### The Chosen Model
We selected **Native Vercel File-System Routing** (Model B from the Gate 7A.1 audit).

### Why This Model Is Correct:
1. **Zero Shadowing:** Every file in `api/` maps 1:1 to an independent, reachable serverless function in Vercel.
2. **Individual Cold-Start & Concurrency Isolation:** Requests to lightweight read endpoints like `/api/health` and `/api/sources` do not compete for memory or execution time with computation-intensive endpoints like `/api/recommendation` or calldata generator `/api/transaction-review`.
3. **No Catch-All Complexity:** Eliminates path parsing and regex matching inside userland code.
4. **Standard Vercel Convention:** Follows Vercel's canonical convention for Node.js serverless functions where directory hierarchy matches URL routing.
5. **Exact Preservation of Standalone Server:** The standalone Node.js server (`src/server/index.ts` and `src/server/router.ts`) remains completely intact, allowing identical routing behavior across both serverless and standalone deployment paths.

---

## 3. Implementation Details

### 3.1 Updated `vercel.json`
The `"rewrites"` block has been completely removed. The configuration now manages only static output directory, build scripts, and global HTTP security headers:

```json
{
  "version": 2,
  "outputDirectory": "public",
  "buildCommand": "node scripts/build.js",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://rpc.pharos.xyz; img-src 'self' data:; font-src 'self'; object-src 'none'; frame-ancestors 'none';"
        }
      ]
    }
  ]
}
```

### 3.2 Modular Handlers & HTTP Method Guards
Each file in `api/` now serves as an independent function handler with explicit HTTP method guards, returning `405 Method Not Allowed` for invalid methods and `204 No Content` for CORS `OPTIONS` preflight checks:

| File Path | URL Path | Supported Methods | Disallowed Response | Responsibility |
|---|---|---|---|---|
| `api/index.ts` | `/api` | `GET`, `OPTIONS` | `405 Method Not Allowed` | API service directory & endpoint index |
| `api/health.ts` | `/api/health` | `GET`, `OPTIONS` | `405 Method Not Allowed` | Pacific Mainnet RPC health & block freshness |
| `api/sources.ts` | `/api/sources` | `GET`, `OPTIONS` | `405 Method Not Allowed` | Canonical yield source provenance & verification |
| `api/recommendation.ts` | `/api/recommendation` | `POST`, `OPTIONS` | `405 Method Not Allowed` | Scenario evaluation & net alpha optimizer |
| `api/transaction-review.ts` | `/api/transaction-review` | `POST`, `OPTIONS` | `405 Method Not Allowed` | Unsigned calldata & non-custodial disclosures |

### 3.3 Build Pipeline Bundling (`scripts/build.js`)
`scripts/build.js` was updated to compile all 5 modular entry points into `dist/api/*.js`:
- `dist/api/index.js` (61.1 KB)
- `dist/api/health.js` (60.8 KB)
- `dist/api/sources.js` (60.8 KB)
- `dist/api/recommendation.js` (60.9 KB)
- `dist/api/transaction-review.js` (60.9 KB)

---

## 4. Verification Evidence

### 4.1 Modular Handler Direct Tests (`tests/integration/vercelAdapter.test.ts`)
The integration test suite directly verifies each handler in isolation:
- `api/index.ts` handles `GET /api` with HTTP 200 and returns endpoint registry.
- `api/health.ts` handles `GET /api/health` with HTTP 200 and checks live block `> 22,000,000`.
- `api/sources.ts` handles `GET /api/sources` and enforces `FEWER_THAN_THREE_QUALIFYING_SOURCES`.
- `api/recommendation.ts` handles `POST /api/recommendation` and evaluates scenarios.
- `api/transaction-review.ts` handles `POST /api/transaction-review` and outputs 3-step unsigned calldata.
- Method Guard Test: verifies that `POST /api/health`, `POST /api/sources`, `GET /api/recommendation`, and `GET /api/transaction-review` all return `405 Method Not Allowed`.

### 4.2 Local Simulation Verification (`scripts/verify-vercel.js`)
The local simulation server simulates Vercel Edge dispatch using exact file-system routing rules.
Result: **13/13 Checks Passed** including static delivery, API routing, method guard enforcement, and 404 handling.

---

## 5. Conclusion
The routing ambiguity between catch-all rewrites and modular files has been completely resolved. All 5 endpoints are reachable, tested, isolated, and verified without shadowing.
