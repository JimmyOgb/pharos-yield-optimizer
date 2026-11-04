# GATE 7B.1 — VERCEL DEPLOYMENT CONFIGURATION & SERVERLESS AUDIT
## Runtime Architecture, Endpoint Specifications, Security Header Analysis & Platform Constraints

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Executive Summary

This audit assesses the deployment readiness of the Pharos Yield Optimizer for Vercel's serverless platform. Following the architectural corrections in Gate 7A.2, the application operates on pure, unshadowed file routing with five dedicated serverless entry points in `api/` and Edge CDN static asset delivery from `public/`.

> **FORMAL VERIFICATION STATUS:**  
> **LOCAL SERVERLESS SIMULATION: PASS (13/13 Checks)**  
> **REAL LOCAL VERCEL CLI BINARY BUILD: UNVERIFIED — WINDOWS CLI LIMITATION**  
> *(The local simulation validates serverless handler execution, routing, security headers, and method guards, but does NOT constitute proof of a successful Vercel cloud build.)*

---

## 2. Configuration File Inspection

### `vercel.json` (Platform Definition)
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "public",
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://rpc.pharos.xyz; img-src 'self' data:; object-src 'none'; base-uri 'self';" }
      ]
    }
  ]
}
```

#### Key Architecture Highlights:
1. **Pure File Routing:** Zero rewrites are defined. Vercel maps incoming HTTP requests directly to matching files under `api/` and `public/`.
2. **Clean URLs:** Enabled (`cleanUrls: true`) for clean browser navigation without `.html` extensions.
3. **HTTP Defensive Headers:** Full suite of security headers applied globally across all routes.
4. **Zero Persistent Storage Reliance:** The serverless handlers are strictly stateless; no local filesystem persistence or database writes are required or assumed.

---

## 3. Serverless Function Endpoints Specification

Each of the five endpoints was inspected for routing clarity, HTTP method guarding, error sanitization, and request boundaries:

| Route | Entry Point File | Supported Methods | Method Guard Behavior | Payload Limit |
| :--- | :--- | :---: | :--- | :---: |
| `/api` | `api/index.ts` | `GET`, `OPTIONS` | Returns `405 Method Not Allowed` with `Allow: GET, OPTIONS` | N/A |
| `/api/health` | `api/health.ts` | `GET`, `OPTIONS` | Returns `405 Method Not Allowed` with `Allow: GET, OPTIONS` | N/A |
| `/api/sources` | `api/sources.ts` | `GET`, `OPTIONS` | Returns `405 Method Not Allowed` with `Allow: GET, OPTIONS` | N/A |
| `/api/recommendation` | `api/recommendation.ts` | `POST`, `OPTIONS` | Returns `405 Method Not Allowed` with `Allow: POST, OPTIONS` | 64 KB |
| `/api/transaction-review` | `api/transaction-review.ts`| `POST`, `OPTIONS` | Returns `405 Method Not Allowed` with `Allow: POST, OPTIONS` | 64 KB |

### Verified Endpoint Behaviors:
- **Preflight Handling:** `OPTIONS` requests receive `HTTP 204 No Content` with CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`).
- **Body Size Guard:** Requests to `POST /api/recommendation` and `POST /api/transaction-review` exceeding 64 KB ($65,536\text{ bytes}$) are terminated immediately with `HTTP 400 Bad Request` (`Payload too large`).
- **Error Sanitization:** Error responses return structured JSON (`{ "error": "...", "message": "..." }`) with zero internal stack traces or environment leakage.
- **Statelessness:** No endpoint reads from or writes to the local filesystem during request processing.

---

## 4. Windows Vercel CLI Limitation Audit

During Gate 7A.1 and re-verified in Gate 7B.1:
- Running `vercel build` locally under standard Windows 11 user permissions fails during the package isolation phase:
  ```text
  Error: EPERM: operation not permitted, symlink '..\..\~npm~@emnapi+core@1.11.3\node_modules\@emnapi\core' -> 
  'C:\Users\NO GO NO\AppData\Local\com.vercel.cli\Cache\builders-vlt\...\node_modules\.vlt\node_modules\@emnapi\core'
  ```
- **Investigation of Safe Alternatives:**
  - Running as Administrator: **PROHIBITED** by security boundaries.
  - Enabling Developer Mode globally: **PROHIBITED** without explicit system authorization.
  - Deleting user caches: Safe, but does not resolve Windows non-elevated symlink creation restrictions.
- **Formal Status Classification:**
  - The genuine local Vercel CLI binary compilation remains: **`UNVERIFIED — WINDOWS CLI LIMITATION`**.
  - In Vercel's cloud build environment (Linux container, Debian/Alpine base), POSIX symbolic links are native and unprivileged, allowing standard compilation of `@vercel/node`.
  - The local simulation script (`scripts/verify-vercel.js`) provides an independent verification that the request/response logic adheres to the Node.js Serverless Function contract.

---

## 5. Deployment Packaging & Exclusion Audit

- **Production Build:** `npm run build` bundles the serverless handlers into `dist/api/*.js` and the standalone server into `dist/server.js`.
- **Exclusion Verification:**
  - No secrets or credentials exist in `public/` or `dist/`.
  - `.env` files (if present) are excluded from Vercel deployment by default.
  - All public assets are minified and free of debug logs.
