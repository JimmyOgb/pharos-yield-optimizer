# GATE 7A.3 — AUDIT 4: ROUTING, BUNDLING & DEPLOYMENT LIMITATIONS AUDIT
## Verification of Pure File Routing, Method Guards, Bundler Outputs, and Platform Boundaries

**Project:** Pharos Yield Optimizer  
**Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor:** Antigravity AI  
**Mode:** READ-ONLY Source & Architecture Audit (No Source Edits)  

---

## 1. Executive Summary

This audit inspects the routing configuration, API entry point implementations, build packaging pipeline, and platform boundaries.

### Key Conclusions:
1. **Single Handler Mapping:** Every intended URL path maps directly to exactly one modular handler file in `api/`.
2. **Zero Shadowing:** `vercel.json` contains zero rewrite rules, eliminating all routing shadowing.
3. **HTTP Method Guards:** Each modular entry point strictly validates the HTTP method and returns `405 Method Not Allowed` for unhandled verbs.
4. **CORS Preflight:** All handlers respond with `204 No Content` and standard CORS headers for `OPTIONS` requests.
5. **Local Bundling:** `scripts/build.js` packages all 5 modular entry points into `dist/api/*.js`.
6. **Platform Limitations Acknowledged:** The local Windows symlink limitation (`EPERM` in Vercel CLI cache) is transparently documented without attempting privilege escalation or security modifications.

---

## 2. API Routing Architecture & Entry Point Audit

### 2.1 File-to-Route Mapping Matrix

| URL Path | Modular Source File | Compiled Bundle | Allowed Methods | Guard Behavior |
|---|---|---|---|---|
| `/api` | [`api/index.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/api/index.ts) | `dist/api/index.js` (61.1 KB) | `GET`, `OPTIONS` | Other verbs $\to$ `405 Method Not Allowed` |
| `/api/health` | [`api/health.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/api/health.ts) | `dist/api/health.js` (60.8 KB) | `GET`, `OPTIONS` | Other verbs $\to$ `405 Method Not Allowed` |
| `/api/sources` | [`api/sources.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/api/sources.ts) | `dist/api/sources.js` (60.8 KB) | `GET`, `OPTIONS` | Other verbs $\to$ `405 Method Not Allowed` |
| `/api/recommendation` | [`api/recommendation.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/api/recommendation.ts) | `dist/api/recommendation.js` (60.9 KB) | `POST`, `OPTIONS` | Other verbs $\to$ `405 Method Not Allowed` |
| `/api/transaction-review`| [`api/transaction-review.ts`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/api/transaction-review.ts) | `dist/api/transaction-review.js` (60.9 KB)| `POST`, `OPTIONS` | Other verbs $\to$ `405 Method Not Allowed` |

### 2.2 Inspection of Method Guards & CORS
Inspection of each file in `api/` confirms identical, safe preflight and method guard patterns:

```ts
// Standard CORS & Security Headers
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
res.setHeader('X-Content-Type-Options', 'nosniff');

// Preflight Handling
if (req.method === 'OPTIONS') {
  res.statusCode = 204;
  res.end();
  return;
}

// Method Guard
if (req.method !== 'GET') { // or 'POST' for recommendation & review
  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Allow', 'GET, OPTIONS');
  res.end(JSON.stringify({ error: 'Method Not Allowed' }));
  return;
}
```

### 2.3 Verification of `vercel.json`
[`vercel.json`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/vercel.json) content:
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
- **Confirmation:** Zero `"rewrites"` block present.
- Under Vercel deployment semantics, any request matching `/api/health` invokes `api/health.ts` directly.

---

## 3. Production Bundling Verification (`scripts/build.js`)

Inspection of [`scripts/build.js`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/scripts/build.js):
- **Standalone Server:** Bundles `src/server/index.ts` $\to$ `dist/server.js` (61.8 KB).
- **Core Library:** Bundles `src/index.ts` $\to$ `dist/index.js` (54.4 KB).
- **Serverless Functions:** Iterates over all 5 modular entry points:
  - `api/index.ts` $\to$ `dist/api/index.js` (61,111 bytes)
  - `api/health.ts` $\to$ `dist/api/health.js` (60,858 bytes)
  - `api/sources.ts` $\to$ `dist/api/sources.js` (60,865 bytes)
  - `api/recommendation.ts` $\to$ `dist/api/recommendation.js` (60,918 bytes)
  - `api/transaction-review.ts` $\to$ `dist/api/transaction-review.js` (60,944 bytes)
- **Static Assets:** Synchronizes `index.html`, `styles.css`, `app.js` to both `dist/ui/` and `public/`.
- **Output:** Every file exists and is confirmed present on disk.

---

## 4. Platform Limitations & Local Simulation Distinction

### 4.1 The Windows NTFS Symlink Permission Issue
- When `vercel build` is executed locally on Windows, the Vercel CLI attempts to construct virtual symlink forests inside `%LOCALAPPDATA%\com.vercel.cli\Cache\builders-vlt`.
- On Windows systems without Developer Mode or administrative elevation, NTFS symlink creation fails with `EPERM: operation not permitted, symlink`.
- In strict adherence to security guidelines: **we do not elevate privileges, modify local security policies, or attempt workarounds that breach standard user boundaries.**
- In Vercel's remote cloud CI/CD runners (Linux), symlinks are native and unprivileged. Therefore, this issue is strictly an environmental limitation of running the proprietary Vercel CLI locally on Windows.

### 4.2 Local Simulation vs. Cloud Build
- We do not equate the local simulation server ([`scripts/verify-vercel.js`](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/scripts/verify-vercel.js)) with an actual Vercel cloud deployment.
- The simulator provides verifiable proof that:
  - All 5 handlers accept and process requests according to Vercel's Node.js runtime contract.
  - Method guards, status codes, JSON parsing, and response serialization conform to specs.
  - Security headers match `vercel.json`.
- Cloud deployment readiness remains a potential next phase requiring explicit user authorization.

---

## 5. Audit Verdict on Routing & Build

- **Routing Architecture:** Coherent, verified, and free of shadowing.
- **Method Guards:** Correctly reject unauthorized HTTP verbs with 405.
- **Build Pipeline:** Produces complete, self-contained standalone and serverless bundles.
- **Platform Boundaries:** Transparently disclosed and maintained.
