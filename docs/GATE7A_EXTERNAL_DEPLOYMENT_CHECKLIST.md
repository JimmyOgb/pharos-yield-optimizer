# GATE 7A — EXTERNAL DEPLOYMENT CHECKLIST (GATE 7B READINESS)
## Mandatory Preconditions, Configuration & Verification Steps for Future Vercel Hosting

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Status:** PACKAGING COMPLETE — AWAITING EXPLICIT GATE 7B AUTHORIZATION  

---

## 1. Authorization Gate Check

> [!CAUTION]
> **STOP CONDITION IN EFFECT:**  
> External deployment to Vercel or any cloud hosting provider is **NOT AUTHORIZED** in Gate 7A.  
> This checklist is an audit and preparation artifact. DO NOT execute any deployment commands until explicit, separate authorization is granted for Gate 7B.

---

## 2. Pre-Deployment Verification Matrix

Before any external deployment begins, verify the following:

- [x] **Local Build Reproducibility:** `npm run build` succeeds cleanly in < 1 second.
- [x] **Zero TypeScript Errors:** `npm run typecheck` passes with zero diagnostics across `src/`, `tests/`, and `api/`.
- [x] **Full Test Suite:** 126/126 automated tests pass with 100% success rate.
- [x] **Code Coverage:** Core source files maintain $> 98\%$ line coverage.
- [x] **Local Simulation:** `npm run verify:vercel` passes 12/12 simulation probes.
- [x] **Non-Custodial Integrity:** Zero private keys, zero signing libraries, zero transaction broadcasting capability.
- [x] **Disclosure Integrity:** Source qualification discloses `FEWER_THAN_THREE_QUALIFYING_SOURCES — REQUIREMENT NOT MET`.
- [x] **Task 14 Workspace Cleanliness:** Sibling workspace `pharos-portfolio-assistant` is clean on branch `main` at commit `94ae954`.

---

## 3. Required Vercel Environment Variables

When deploying to Vercel in Gate 7B, the following environment variables should be configured in the Vercel Project Dashboard:

| Variable Name | Required? | Recommended Production Value | Description |
| :--- | :---: | :--- | :--- |
| `PHAROS_RPC_URL` | Optional | `https://rpc.pharos.xyz` | Official Pharos Pacific Mainnet RPC endpoint |
| `CHAIN_ID` | Optional | `1672` | Pacific Mainnet Chain ID (guards against chain mismatch) |
| `CORS_ORIGIN` | Recommended | `https://<your-project>.vercel.app` | Restricts cross-origin API calls to the production frontend domain |
| `FRESHNESS_THRESHOLD_SECONDS` | Optional | `600` | Block freshness threshold (default: 10 minutes) |
| `LOG_LEVEL` | Optional | `info` | Serverless logging verbosity (`debug`, `info`, `warn`, `error`) |

> [!NOTE]
> **Zero Secrets Required:** Notice that **no private keys, API secrets, database passwords, or auth tokens** are required. The optimizer is strictly read-only and non-custodial.

---

## 4. Platform Limitations & Hosting Expectations

When hosted on Vercel Serverless Functions:

1. **Ephemeral State:** Serverless functions are stateless and spin down when idle. Any in-memory state (such as the 3-second RPC cache and sliding-window rate limiter) is per-instance and ephemeral.
2. **Execution Timeouts:** Vercel enforces a default 10-second timeout on Hobby accounts (15 seconds on Pro). Because our RPC client enforces an 8-second timeout with 3-second caching, normal execution is 5ms (cached) to 1,500ms (uncached), staying safely under limits.
3. **Payload Limits:** Vercel functions enforce a 4.5 MB request body limit and 4.5 MB response body limit. The optimizer enforces a stricter **64 KB** limit on request payloads, guaranteeing zero platform overflow.
4. **Outbound RPC Connectivity:** Vercel serverless functions require outbound HTTPS access to `https://rpc.pharos.xyz` (port 443).

---

## 5. Gate 7B Execution Procedure (Upon Authorization)

When authorized to proceed with Gate 7B:
1. Log in to Vercel via CLI or connect repository on Vercel Dashboard.
2. Link project root: `skills/pharos-yield-optimizer`.
3. Set Framework Preset: `Other`.
4. Configure Build Command: `npm run build`.
5. Configure Output Directory: `public`.
6. Add recommended environment variable `CORS_ORIGIN`.
7. Trigger deployment (`vercel --prod` or git push).
8. Verify production deployment URL against all four API endpoints and static dashboard.
