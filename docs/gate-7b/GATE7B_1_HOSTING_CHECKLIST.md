# GATE 7B.1 — VERCEL HOSTING & DEPLOYMENT CHECKLIST
## Pre-Deployment Verification, Project Configuration, Smoke Test Plan & Rollback Strategy

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Safety Boundary Declaration

> **MANDATORY NOTICE:**  
> This checklist details the operational procedure for a future deployment phase. **NO VERCEL AUTHENTICATION, ACCOUNT LINKING, PROJECT CREATION, OR CLOUD DEPLOYMENT HAS BEEN PERFORMED.**

---

## 2. Vercel Project & Build Specification

When authorization is granted to deploy:

| Configuration Item | Recommended Value | Justification |
| :--- | :--- | :--- |
| **Framework Preset** | `Other` (None) | Pure Node.js ESM serverless functions + Edge CDN static assets |
| **Root Directory** | `./` (or `skills/pharos-yield-optimizer`) | Directory containing `package.json` and `vercel.json` |
| **Build Command** | `npm run build` | Bundles TypeScript and prepares `dist/` and `public/` |
| **Output Directory** | `public` | Statically served frontend assets (`index.html`, `styles.css`, `app.js`) |
| **Node.js Version** | `22.x` (or `20.x`) | Native fetch and ES module compatibility |
| **Install Command** | `npm install` | Installs devDependencies (`esbuild`, `typescript`, `@types/node`) |

### Environment Variables (Optional):
- `PHAROS_RPC_URL`: `https://rpc.pharos.xyz` (Defaults to public Pacific RPC if omitted).
- `CHAIN_ID`: `1672` (Defaults to 1672 if omitted).
- `CORS_ORIGIN`: `*` (or specific frontend domain).
- **Cost / Tier Note:** Zero paid integrations, zero paid databases, and zero external paid RPC services are required. Operates fully within Vercel standard serverless function quotas.

---

## 3. Post-Deployment Smoke Test Protocol

Immediately following an authorized cloud deployment, the following 6 automated verification requests must be executed against the live deployment URL (`https://<deployment-url>`):

1. **Static UI Smoke Test:**
   ```bash
   curl -I https://<deployment-url>/
   # Verify HTTP 200 OK, Content-Type: text/html, Content-Security-Policy header present
   ```
2. **API Directory Route:**
   ```bash
   curl https://<deployment-url>/api
   # Verify HTTP 200 OK, JSON status: "healthy", service directory returned
   ```
3. **Live Health & RPC Connectivity:**
   ```bash
   curl https://<deployment-url>/api/health
   # Verify HTTP 200 OK, chainId: 1672, latestBlockNumber > 22,000,000, isFresh: true
   ```
4. **Verified Sources & Invariant:**
   ```bash
   curl https://<deployment-url>/api/sources
   # Verify HTTP 200 OK, status: "FEWER_THAN_THREE_QUALIFYING_SOURCES", verifiedCount: 1
   ```
5. **Recommendation Evaluation (Scenario A):**
   ```bash
   curl -X POST https://<deployment-url>/api/recommendation \
     -H "Content-Type: application/json" \
     -d '{"principalPros": 1000, "horizonDays": 60}'
   # Verify HTTP 200 OK, decision: "MOVE", targetStrategyId: "faroo-patient-staking"
   ```
6. **Transaction Review Unsigned Calldata:**
   ```bash
   curl -X POST https://<deployment-url>/api/transaction-review \
     -H "Content-Type: application/json" \
     -d '{"strategyId": "faroo-patient-staking", "amountPros": 1000}'
   # Verify HTTP 200 OK, 3 steps returned, selector: 0xd0e30db0, isNonCustodial: true
   ```

---

## 4. Rollback & Contingency Plan

If unexpected serverless execution errors occur post-deployment:
1. **Instant Rollback:** Use Vercel Dashboard / CLI to promote the previous successful deployment instantly.
2. **DNS / Traffic Switch:** If a custom domain is assigned, redirect traffic back to the standby deployment or display a scheduled maintenance page.
3. **Diagnostics:** Inspect runtime logs in Vercel Function Monitoring to identify cold-start timeout or RPC network blocks.
