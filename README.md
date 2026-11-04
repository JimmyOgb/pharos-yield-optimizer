# Pharos Yield Optimizer

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Arena Task Catalog:** Task #15 (Hard / 200 pts base + 50 pts video = 250 pts)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672`, Currency: `PROS`)  
**Current Gate:** **Gate 7 Complete — Publication & Deployment Preparation (Local Preflight Verified)**  
**Execution Boundary:** Strictly read-only JSON-RPC queries. Zero private keys, zero transactions signed, zero packages published, zero external deployments.

---

## ⚡ How to Build & Run Production Locally

The project includes an embedded native Node.js HTTP server serving the responsive financial dashboard and REST API with zero runtime dependencies.

### 1. Build the Production Artifact
Compile and bundle all TypeScript sources into the standalone ECMAScript Module (ESM) distribution in `dist/`:

```bash
# Typecheck + bundle production artifact via esbuild
npm run build
```

This generates:
- `dist/server.js` (Standalone Node.js HTTP server executable)
- `dist/index.js` (Standalone core library export)
- `dist/ui/` (`index.html`, `styles.css`, `app.js` with zero inline handlers)
- `dist/build-manifest.json` (Build provenance and size verification)

### 2. Run Production Locally
Start the compiled production bundle directly using Node.js without any experimental flags:

```bash
# Start the production server from dist/server.js
npm run start:prod
# or
npm start

# Open your browser to:
# http://127.0.0.1:3000
```

### 3. Development Mode
To run directly from TypeScript sources during development:

```bash
npm run dev
```

---

## 🧪 How to Test & Verify

The project includes static type checking, a complete pure TypeScript unit test suite, live integration tests against Pharos Pacific Mainnet (`https://rpc.pharos.xyz`), code coverage reporting, an independent numerical verification suite, and production artifact smoke tests.

From within the `skills/pharos-yield-optimizer` directory:

```bash
# 1. Static Typecheck (TypeScript compiler with zero emitted output)
npm run typecheck

# 2. Production Build Check (Verifies typecheck, bundles dist/, and copies UI)
npm run build

# 3. Unit Tests (96 fast tests with mocked RPC fixtures and security tests)
npm run test:unit

# 4. Live Integration Tests (34 tests against Pharos Pacific Mainnet RPC, Vercel adapter, and compiled bundle)
npm run test:integration

# 5. Full Test Suite (Runs all 130 unit & live integration tests)
npm run test:all
# or
npm test

# 6. Code Coverage Analysis (Evaluates branch, line, and function coverage)
npm run test:coverage

# 7. Independent Numerical Precision Verification (Accrual, friction, break-even math)
npm run verify:numerical

# 8. Local Vercel Serverless Simulator (13 route, method guard, and security header checks)
npm run verify:vercel
```

### Current Verification Metrics
- **Tests:** 130 passing, 0 failing across 46 suites (100% pass rate).
- **Independent Checks:** 5 numerical precision cases + 13 serverless simulation checks = 148 verified engineering checks (Note: These are local engineering validation results, not official competition scoring points).
- **Source Line Coverage:** 98.22% across all `src/` modules.
- **Zero Runtime Dependencies:** Built strictly using native Node.js standard library (`node:http`, `node:fs`), native `fetch`, native `node:test`, and `esbuild` for build packaging only.

---

## ⚙️ Configuration Reference

The application uses safe, validated configuration loaded via `src/config/index.ts` with zero required secrets:

| Variable | Type | Default | Description & Security Impact |
| :--- | :---: | :---: | :--- |
| `PORT` | number | `3000` | HTTP server port (1–65535). |
| `HOST` | string | `127.0.0.1` | **Security Critical:** Network binding address. Defaults strictly to loopback (`127.0.0.1`) to prevent exposing the service on the local network. Binding to `0.0.0.0` or LAN IPs triggers a visible security warning. |
| `PHAROS_RPC_URL` | string | `https://rpc.pharos.xyz` | JSON-RPC endpoint for Pharos Pacific Mainnet. |
| `CHAIN_ID` | number | `1672` | Expected EVM Chain ID (`0x688`). Rejects RPC if chain ID mismatches. |
| `FRESHNESS_THRESHOLD_SECONDS` | number | `600` | Observation freshness window (10 minutes). Stale block headers or contract observations trigger `INSUFFICIENT_DATA` guards. |
| `LOG_LEVEL` | string | `info` | Logging verbosity: `debug`, `info`, `warn`, `error`. |
| `CORS_ORIGIN` | string | `*` | Allowed CORS origin. In production, lock to the specific frontend origin (e.g. `https://optimizer.pharos.xyz`). |

A configuration template is provided in [.env.example](.env.example).

---

## 🔌 REST API Endpoints Reference

The service exposes five dedicated REST API endpoints (supported natively both by the standalone HTTP server and by Vercel Serverless Functions):

| Method | Endpoint | Handler | Description | Payload Limit |
| :---: | :--- | :--- | :--- | :---: |
| `GET` | `/api` | `api/index.ts` | Service status, network metadata, and API directory | — |
| `GET` | `/api/health` | `api/health.ts` | Live Pacific Mainnet RPC connection, block freshness, and age | — |
| `GET` | `/api/sources` | `api/sources.ts` | Verified yield sources matrix and truth-first invariant status | — |
| `POST` | `/api/recommendation` | `api/recommendation.ts` | Deterministic yield evaluation (`MOVE` vs `STAY_PUT`), net alpha & break-even | 64 KB |
| `POST` | `/api/transaction-review` | `api/transaction-review.ts` | 3-step non-custodial unsigned transaction calldata review | 64 KB |

*All endpoints strictly reject unpermitted HTTP methods with `HTTP 405 Method Not Allowed`.*

---

## 🔒 Security & Non-Custodial Limitations

### Network & Interface Binding
- Defaults strictly to `127.0.0.1`.
- Any external binding (`0.0.0.0` or LAN IP) requires explicit configuration and produces an operational warning.
- For production internet exposure, an upstream reverse proxy (e.g., NGINX, Cloudflare) with TLS termination and firewall rules must be deployed.

### Content Security Policy (CSP) & Protective Headers
The HTTP server emits strict security headers on all static and dynamic responses:
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://rpc.pharos.xyz; img-src 'self' data:; object-src 'none'; base-uri 'self';
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

### DOM Safety
- Zero inline `onclick` attributes: Calldata copying uses semantic `data-calldata` attributes and standard event delegation.
- Zero global `window.copyToClipboard` attachment.
- All dynamic template variables are sanitized via `escapeHtml()`.

### Non-Custodial Boundaries
The integrated Non-Custodial Transaction Reviewer (`src/reviewer/transactionReviewer.ts`) is designed exclusively for review:
1. **Unsigned Calldata Only:** Prepares raw unsigned hex calldata, method explanations, recipient contract addresses, and gas estimates.
2. **Zero Private Keys:** The agent core never stores, requests, accepts, or interacts with private keys or seed phrases.
3. **Zero Wallet Auto-Connect:** The application never triggers automated `eth_requestAccounts` prompts.
4. **Zero Broadcasting:** The client strictly omits `eth_sendRawTransaction`. It is technically incapable of broadcasting transactions or moving user funds.
5. **Zero Fabrication for Unverified Contracts:** For disqualified sources (Axil APC3M or Native PoS), the reviewer outputs an explicit `TRANSACTION_PAYLOAD_UNAVAILABLE` status.
6. **External User Control:** Users must copy the unsigned calldata into an external, self-custodied wallet (e.g. MetaMask, Rabby) to independently verify, sign, and broadcast.

---

## 📊 Data Provenance & Invariant Enforcement

```
╔═══════════════════════════════════════════════════════════════════════╗
║                      TRUTH-FIRST ACCOUNTING                           ║
║  Status: FEWER THAN THREE QUALIFYING SOURCES — REQUIREMENT NOT MET    ║
║  Qualifying Sources: 1 (Faroo Liquid Staking stPROS)                  ║
╚═══════════════════════════════════════════════════════════════════════╝
```

The Pharos Agent Arena Task 15 specification states:
> *"The agent must query, compare, and optimize yield across at least three distinct on-chain yield sources on Pharos Pacific Mainnet."*

Following rigorous on-chain audits in Gates 1–6:
1. **Faroo Liquid Staking (`stPROS`):** `QUALIFIED`. Fully on-chain live contract state, continuous exchange-rate accrual, verified ERC-4626 proxy and implementation.
2. **Pharos DEX LP (Uniswap V4):** `DISQUALIFIED FROM LIVE APR`. PoolManager and StateView contracts are deployed and verified on-chain, but no active public subgraphs or volume indexers exist on Pacific Mainnet to reliably compute live dynamic LP fee APR via RPC.
3. **Axil Prime Credit (`APC3M`):** `DISQUALIFIED FROM PROS REBALANCING`. RWA Private Credit vault accepting USDC (not PROS), with an off-chain target APY (8.00%) not derived from on-chain rate accrual.
4. **Native PoS Consensus Staking:** `DISQUALIFIED AS DELEGATABLE YIELD SOURCE`. No public delegation smart contract, permissionless validator registry, or delegator unbonding queue exists on Pacific Mainnet.

**The codebase and dashboard faithfully report this status at both the architectural and UI levels without fabricating data or misrepresenting off-chain targets as qualifying sources.**

> **Financial Modeling Notice:** Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ.

---

## 🚀 Deployment Preparation Instructions

When authorized to proceed with external hosting:
1. **Prerequisites:**
   - Node.js $\ge$ 20.x, 22.x, or 24.x LTS runtime.
   - Domain name with DNS A/AAAA records pointing to the hosting environment.
   - TLS/SSL certificate (Let's Encrypt, Cloudflare, AWS ACM).
2. **Build Production Artifacts:**
   ```bash
   npm run build
   ```
3. **Environment Setup:**
   Create `.env` based on `.env.example`:
   ```bash
   PORT=3000
   HOST=127.0.0.1  # Keep loopback if behind reverse proxy
   CORS_ORIGIN=https://your-production-domain.com
   ```
4. **Process Supervision:**
   Use PM2, systemd, or container orchestration:
   ```bash
   pm2 start dist/server.js --name pharos-yield-optimizer
   ```
5. **Reverse Proxy Configuration (NGINX Example):**
   ```nginx
   server {
       listen 443 ssl http2;
       server_name optimizer.pharos.xyz;
       ssl_certificate /path/to/fullchain.pem;
       ssl_certificate_key /path/to/privkey.pem;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
6. **Vercel Serverless Hosting Configuration:**
   - Framework preset: `Other` (None).
   - Build command: `npm run build`.
   - Output directory: `public`.
   - Serverless functions: Automatically mapped from `api/*.ts`.
   - *Status: Fully packaged and verified locally (`npm run verify:vercel`). External cloud deployment is pending separate authorization.*
7. **Publication Boundary:** Stop before executing live deployment, public repository publishing, or DNS propagation until explicit authorization is granted.

---

## 📚 Workspace Documentation & Evidence Register

Comprehensive documentation for all completed gates is preserved in `docs/`:

- **Gate 1:** [Official Requirements Audit](docs/GATE1_OFFICIAL_REQUIREMENTS_AUDIT.md), [Yield Source Feasibility](docs/GATE1_YIELD_SOURCE_FEASIBILITY.md), [Technical Feasibility](docs/GATE1_TECHNICAL_FEASIBILITY.md), [Evidence Register](docs/GATE1_EVIDENCE_REGISTER.md)
- **Gate 1B:** [Yield Model Audit](docs/GATE1B_FAROO_YIELD_AUDIT.md)
- **Gate 1C:** [Third Yield Source Discovery](docs/GATE1C_DISCOVERY_REPORT.md)
- **Gate 1D:** [Native PoS Validator Verification](docs/GATE1D_VALIDATOR_STRATEGY_REPORT.md)
- **Gate 1E:** [Acceptance-Criteria Reconciliation](docs/GATE1E_ACCEPTANCE_RECONCILIATION.md)
- **Gate 2:** [System Architecture](docs/GATE2_SYSTEM_ARCHITECTURE.md), [Data Flow & Integration](docs/GATE2_DATA_FLOW_AND_INTEGRATION_PLAN.md), [Mathematical Methodology](docs/GATE2_MATHEMATICAL_METHODOLOGY.md), [UI/UX Specification](docs/GATE2_UI_UX_SPECIFICATION.md), [Testing Strategy](docs/GATE2_TESTING_STRATEGY.md), [Implementation Roadmap](docs/GATE2_IMPLEMENTATION_ROADMAP.md)
- **Gate 3:** [Preflight Report](docs/GATE3_PREFLIGHT_REPORT.md), [Core Engine Architecture](docs/GATE3_CORE_ENGINE_ARCHITECTURE.md), [Mathematical Specification](docs/GATE3_MATHEMATICAL_SPECIFICATION.md), [Test Execution Report](docs/GATE3_TEST_EXECUTION_REPORT.md), [Final Report](docs/GATE3_FINAL_REPORT.md)
- **Gate 4:** [Preflight Report](docs/GATE4_PREFLIGHT_REPORT.md), [RPC Client Report](docs/GATE4_RPC_CLIENT_REPORT.md), [Faroo Adapter Report](docs/GATE4_FAROO_ADAPTER_REPORT.md), [DEX Investigation Report](docs/GATE4_DEX_INVESTIGATION_REPORT.md), [Assumption Audit](docs/GATE4_ASSUMPTION_AUDIT.md), [Test Report](docs/GATE4_TEST_REPORT.md), [Final Report](docs/GATE4_FINAL_REPORT.md)
- **Gate 5:** [Preflight Report](docs/GATE5_PREFLIGHT_REPORT.md), [UI Implementation Report](docs/GATE5_UI_IMPLEMENTATION_REPORT.md), [Transaction Reviewer Report](docs/GATE5_TRANSACTION_REVIEWER_REPORT.md), [Security Report](docs/GATE5_SECURITY_REPORT.md), [Test Report](docs/GATE5_TEST_REPORT.md), [Final Report](docs/GATE5_FINAL_REPORT.md)
- **Gate 5.1:** [Preflight Report](docs/GATE5_1_PREFLIGHT_REPORT.md), [Transaction Security Audit](docs/GATE5_1_TRANSACTION_SECURITY_AUDIT.md), [API Security Audit](docs/GATE5_1_API_SECURITY_AUDIT.md), [Data Integrity Audit](docs/GATE5_1_DATA_INTEGRITY_AUDIT.md), [Test Reproduction Report](docs/GATE5_1_TEST_REPRODUCTION_REPORT.md), [Final Audit](docs/GATE5_1_FINAL_AUDIT.md)
- **Gate 6:** [Preflight Report](docs/GATE6_PREFLIGHT_REPORT.md), [Security Hardening Report](docs/GATE6_SECURITY_HARDENING_REPORT.md), [Build and Packaging Report](docs/GATE6_BUILD_AND_PACKAGING_REPORT.md), [Production Smoke Test Report](docs/GATE6_PRODUCTION_SMOKE_TEST_REPORT.md), [Final Report](docs/GATE6_FINAL_REPORT.md)
- **Gate 7A:** [Gas Model Unification](docs/GATE7A_5_FINAL_REPORT.md), [Deployment Readiness Audit](docs/GATE7A_6_FINAL_READINESS_DECISION.md)
- **Gate 7B:** [Controlled Preflight](docs/gate-7b/GATE7B_1_FINAL_DECISION.md), [Git Preparation](docs/gate-7b/GATE7B_2_FINAL_DECISION.md)
