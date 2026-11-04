# GATE 7A — LOCAL DEPLOYMENT & VERIFICATION GUIDE
## Step-by-Step Instructions for Local Packaging, Standalone Server & Vercel Simulation

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Execution Boundary:** Local Testing ONLY — ZERO External Deployment  

---

## 1. Prerequisites & Environment

- **Node.js:** Node.js v22.0.0 or higher (uses native `--experimental-strip-types` and native `fetch`).
- **Dependencies:** Installed in `node_modules` (`@types/node`, `esbuild`, `typescript`).
- **Internet Access:** Outbound HTTPS access to `https://rpc.pharos.xyz` (Pharos Pacific Mainnet public RPC).
- **No Credentials Required:** Zero private keys, seed phrases, or API secrets are needed.

---

## 2. Fast Verification Commands

Navigate to the project root:
```powershell
cd C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer
```

### Option A: Run Full Automated Verification (Recommended)
```powershell
# 1. Typecheck TypeScript sources across src/, tests/, and api/
npm run typecheck

# 2. Run all 126 automated tests (unit + integration + Vercel adapter)
npm run test:all

# 3. Run production build pipeline (esbuild standalone + serverless + static assets)
npm run build

# 4. Run local Vercel simulation server & automated probe suite
npm run verify:vercel

# 5. Run independent numerical verification
npm run verify:numerical
```

---

## 3. Running the Standalone Node.js Server

To run the standalone production server locally:

```powershell
# Build first (compiles dist/server.js and dist/ui/)
npm run build

# Start the server (defaults to 127.0.0.1:3000)
npm start
```

### Verified Output
```
========================================================
Pharos Yield Optimizer Dashboard Server Started
URL: http://127.0.0.1:3000
Network: Pharos Pacific Mainnet (Chain ID 1672)
Mode: Strictly Read-Only & Non-Custodial
Binding: Local Loopback Only (127.0.0.1)
========================================================
```

Open your browser and navigate to:
```
http://127.0.0.1:3000
```

---

## 4. Running the Local Vercel Serverless Simulator

The simulator boots a local HTTP server that parses `vercel.json`, serves static files from `public/`, routes `/api/*` to `api/index.ts`, parses JSON bodies, and tests all endpoints:

```powershell
npm run verify:vercel
```

Expected output confirms 12/12 checks passing:
```
  ▶ Static UI: index.html served with CSP & security headers... [PASS]
  ▶ Static UI: styles.css served correctly... [PASS]
  ▶ Static UI: app.js served correctly... [PASS]
  ▶ Vercel API: GET /api returns service status and directory... [PASS]
  ▶ Vercel API: GET /api/health retrieves live Pacific Mainnet block... [PASS]
  ▶ Vercel API: GET /api/sources enforces FEWER_THAN_THREE_QUALIFYING_SOURCES... [PASS]
  ▶ Vercel API: POST /api/recommendation (MOVE 1,000 PROS / 60 days)... [PASS]
  ▶ Vercel API: POST /api/recommendation (STAY_PUT 7 days < 14-day lockup)... [PASS]
  ▶ Vercel API: POST /api/recommendation (STAY_PUT instant exit friction > yield)... [PASS]
  ▶ Vercel API: POST /api/transaction-review (3 steps, non-custodial)... [PASS]
  ▶ Vercel API: Malformed JSON handled safely with 400 Bad Request... [PASS]
  ▶ Vercel API: 404 for unmapped endpoint... [PASS]
```

---

## 5. Manual Endpoint Probing with `curl` / PowerShell

You can query the running server locally:

### Health Check (`GET /api/health`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/health" -Method GET | ConvertTo-Json
```

### Yield Sources (`GET /api/sources`)
```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/sources" -Method GET | ConvertTo-Json -Depth 4
```

### Scenario Evaluation (`POST /api/recommendation`)
```powershell
$body = @{
    principalPros = 1000
    horizonDays = 60
    requiresInstantLiquidity = $false
    currentStrategyId = "native-pros-baseline"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/recommendation" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 4
```

### Transaction Review (`POST /api/transaction-review`)
```powershell
$body = @{
    strategyId = "faroo-patient-staking"
    amountPros = 1000
    userAddress = "0x1111111111111111111111111111111111111111"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/transaction-review" -Method POST -Body $body -ContentType "application/json" | ConvertTo-Json -Depth 5
```
