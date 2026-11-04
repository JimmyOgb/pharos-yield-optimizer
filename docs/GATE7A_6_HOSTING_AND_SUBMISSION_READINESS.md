# GATE 7A.6 — HOSTING & SUBMISSION READINESS AUDIT
## Deployment Configuration, Runtime Packaging, Environment Specifications & Platform Limits

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Hosting Architecture & Packaging Overview

The Pharos Yield Optimizer features dual hosting readiness:
1. **Serverless Platform (Vercel Functions):** Pure file-based routing via `api/*.ts`, zero rewrites, static assets served from `public/`, and edge HTTP security headers defined in `vercel.json`.
2. **Standalone Node.js Server:** Self-contained HTTP server packaged in `dist/server.js` with embedded static asset hosting, loopback binding, and zero runtime dependencies.

> **CRITICAL DISCLAIMER:**  
> Successful local compilation, packaging, and local simulation **MUST NOT** be described or claimed as a successful Vercel cloud deployment. No cloud deployment has taken place, and none is authorized without explicit owner instructions.

---

## 2. Configuration & Manifest Inspection

### 1. `vercel.json` (Vercel Platform Configuration)
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
- **File Routing Architecture:** All rewrites (such as `/api/(.*) -> /api/index`) were completely removed in Gate 7A.2. Vercel maps URLs directly to their corresponding file handlers without path ambiguity or circular routing.

### 2. Vercel Serverless Function Endpoints (`api/`)
| URL Path | Handler File | Allowed HTTP Methods | Purpose |
| :--- | :--- | :---: | :--- |
| `/api` | `api/index.ts` | `GET`, `OPTIONS` | Service directory and API health check |
| `/api/health` | `api/health.ts` | `GET`, `OPTIONS` | Pacific Mainnet RPC health and block freshness |
| `/api/sources` | `api/sources.ts` | `GET`, `OPTIONS` | Verified yield sources and 1-of-3 invariant status |
| `/api/recommendation` | `api/recommendation.ts` | `POST`, `OPTIONS` | Deterministic yield engine evaluation |
| `/api/transaction-review` | `api/transaction-review.ts` | `POST`, `OPTIONS` | Non-custodial 3-step unsigned calldata review |

### 3. Static Assets (`public/` and `dist/ui/`)
- `index.html`: Fully semantic financial dashboard with responsive layout.
- `styles.css`: CSS styling with dark/light theme tokens and status badges.
- `app.js`: Dynamic client-side logic using standard `fetch()` calls to `/api/*` endpoints. Zero inline handlers, zero `eval()`.

---

## 3. Environment Variables & Credential Requirements

- **Zero Required Secrets:** The read-only product experience requires **zero** API keys, database credentials, or private keys.
- **Runtime Defaults:**
  - `PORT`: Defaults to `3000`.
  - `HOST`: Defaults strictly to `127.0.0.1` (loopback only).
  - `PHAROS_RPC_URL`: Defaults to `https://rpc.pharos.xyz` (public Pacific Mainnet endpoint).
  - `CHAIN_ID`: Defaults to `1672` (EVM Chain ID).
- **Security Boundary:** Because no credentials are required, there is zero risk of credential leakage in client bundles or public repositories.

---

## 4. Production Build & Start Verification

1. **Build Command:**
   ```bash
   npm run build
   # Executes: tsc --noEmit && node scripts/build.js
   ```
   - Bundles all TypeScript source code into ESM format in `dist/` using `esbuild`.
   - Bundles `dist/server.js` (61.9 KB).
   - Bundles modular serverless functions in `dist/api/*.js`.
   - Copies static assets to `public/` and `dist/ui/`.
   - Build completes in $\approx 630\text{ms}$.

2. **Production Start Command:**
   ```bash
   npm start
   # or npm run start:prod
   # Executes: node dist/server.js
   ```
   - Launches the native Node.js HTTP server.
   - Binds strictly to `http://127.0.0.1:3000`.
   - Serves dashboard and API seamlessly with zero external dependencies.

---

## 5. Technical Platform Limitations & Environmental Realities

### Windows Vercel CLI Symlink Limitation
During local testing of the official Vercel CLI (`vercel build` / `vercel dev`) on Windows 11:
- The command failed with an `EPERM: operation not permitted, symlink` error inside `%LOCALAPPDATA%\com.vercel.cli\Cache\builders-vlt`.
- **Root Cause:** The Vercel CLI builder requires Windows Developer Mode or elevated Administrator privileges to create NTFS symbolic links in its internal builder cache.
- **Handling:** Rather than compromising host security boundaries or attempting unauthorized privilege escalation, the limitation was documented formally, and an independent local Vercel serverless simulation script (`scripts/verify-vercel.js`) was engineered using native Node.js HTTP primitives.
- **Simulation Coverage:** All 13 serverless routing, method guarding, CORS, CSP, and streaming payload scenarios pass 100% in the simulator.
