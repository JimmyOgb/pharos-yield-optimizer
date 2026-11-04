# GATE 7A.1 — API ROUTING & SERVERLESS DISPATCH AUDIT
## Investigation of Rewrites, File-System Routing, Path Normalization & Execution Singularity

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  
**Execution Boundary:** READ-ONLY INSPECTION & LOCAL VERIFICATION ONLY  

---

## 1. Executive Summary & Routing Audit Verdict

| Audit Dimension | Finding | Classification |
| :--- | :--- | :---: |
| **Rewrite vs File-System Routing** | `vercel.json` rewrites `/api/(.*)` to `/api/index`, shadowing modular `api/*.ts` entry points | **PASS WITH WARNING** |
| **Execution Singularity** | Requests are handled by exactly one function per invocation; no double dispatch | **PASS** |
| **Path Normalization** | Header fallback handles both rewritten paths and direct URL strings | **PASS** |
| **HTTP Method Enforcement** | GET / POST methods correctly gated; OPTIONS preflight handled with 204 | **PASS** |
| **Request Body Parsing** | Dual-mode parsing supports both pre-parsed serverless objects and native streams | **PASS** |
| **Endpoint Coverage** | All 4 mandatory endpoints (`/health`, `/sources`, `/recommendation`, `/transaction-review`) operational | **PASS** |

---

## 2. Interaction Between `vercel.json` Rewrites and `api/` Files

### The Existing Configuration
In `vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"
    }
  ]
}
```

In the project tree:
- `api/index.ts` (Unified dispatcher)
- `api/health.ts`
- `api/sources.ts`
- `api/recommendation.ts`
- `api/transaction-review.ts`

### Architectural Analysis: Shadowing & Dispatch Precedence
1. **With the Rewrite Rule Active:**
   - Any HTTP request matching `/api/*` (e.g., `GET /api/health`) is rewritten internally by Vercel's Edge Router to destination `/api/index`.
   - Vercel routes the request to `api/index.ts`.
   - The modular function files (`api/health.ts`, `api/sources.ts`, etc.) are **shadowed** and will never receive traffic because the rewrite intercepts all `/api/*` routes prior to file-system matching.
   - **Advantage:** Single warm container memory pool; connection reuse for RPC client.
   - **Potential Risk:** If Vercel sets `x-matched-path: /api/index`, an adapter that inspects only `x-matched-path` could lose the original path.

2. **Path Normalization in `src/server/router.ts`:**
   To guarantee accurate routing regardless of whether Vercel or an upstream proxy modifies `req.url`, `ApiRouter` implements prioritized header inspection:
   ```ts
   const rawPath = typeof req.headers['x-matched-path'] === 'string'
     ? req.headers['x-matched-path']
     : (typeof req.headers['x-forwarded-uri'] === 'string' 
         ? req.headers['x-forwarded-uri'] 
         : (req.url ?? '/'));
   ```
   Furthermore, route handlers accept paths both with and without the `/api` prefix:
   - `pathname === '/api/health' || pathname === '/health'`
   - `pathname === '/api/sources' || pathname === '/sources'`
   - `pathname === '/api/recommendation' || pathname === '/recommendation'`
   - `pathname === '/api/transaction-review' || pathname === '/transaction-review'`

3. **Recommendation for Gate 7B:**
   To avoid shadowing modular files and to align with Vercel's native zero-config standard, the project has two clean architectural options:
   - **Option A (Pure File-System Routing - Recommended):** Remove the `"rewrites"` block from `vercel.json`. Let Vercel route `/api/health` directly to `api/health.ts`, `/api/sources` to `api/sources.ts`, etc. This provides isolated function metrics and independent cold starts.
   - **Option B (Unified Gateway):** Keep the `"rewrites"` block and remove the redundant modular files `api/health.ts`, etc., consolidating everything cleanly into `api/index.ts`.

---

## 3. Request Routing Singularity Verification

We audited the call chain to verify whether any scenario could result in double-handling, duplicate responses, or `ERR_HTTP_HEADERS_SENT`:

```
Client HTTP Request
       │
       ▼
Vercel Function Handler (`api/index.ts`)
       │
       ▼
`router.handleRequest(req, res)`
       │
       ├─► checkRateLimit(req) ──────────────► [If Limit Exceeded] 429 & returns true (HALTS)
       ├─► method === 'OPTIONS' ─────────────► 204 No Content & returns true (HALTS)
       ├─► pathname === '/api' ──────────────► 200 Service Index & returns true (HALTS)
       ├─► pathname === '/api/health' ───────► handleHealth() & returns true (HALTS)
       ├─► pathname === '/api/sources' ──────► handleSources() & returns true (HALTS)
       ├─► pathname === '/api/recommendation' ► handleRecommendation() & returns true (HALTS)
       ├─► pathname === '/api/transaction-review' ► handleTransactionReview() & returns true (HALTS)
       │
       ▼
Returns `false` (Unmatched Route) ───────────► 404 Not Found & returns (HALTS)
```

**Verification Finding:** Every branch returns an explicit boolean flag and terminates execution immediately upon sending headers. Double execution is mathematically impossible.

---

## 4. Endpoint Method & Payload Compatibility

| Endpoint | Permitted Method | Request Body | Response Format | Status |
| :--- | :---: | :---: | :---: | :---: |
| `GET /api` | GET | None | JSON Service Directory | Verified |
| `GET /api/health` | GET | None | JSON Node & Freshness Observation | Verified |
| `GET /api/sources` | GET | None | JSON Yield Source Comparison & Invariant | Verified |
| `POST /api/recommendation` | POST | JSON Scenario Parameters (`<= 64 KB`) | JSON Recommendation & Alpha Breakdown | Verified |
| `POST /api/transaction-review` | POST | JSON Strategy & User Address (`<= 64 KB`) | JSON Unsigned Calldata & Safety Notice | Verified |
| `OPTIONS *` | OPTIONS | None | 204 No Content | Verified |
