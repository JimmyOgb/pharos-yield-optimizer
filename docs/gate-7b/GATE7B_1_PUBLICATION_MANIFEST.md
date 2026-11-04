# GATE 7B.1 — PROPOSED REPOSITORY PUBLICATION MANIFEST
## File Classification, Git Inclusions/Exclusions, Staging Strategy & README Audit

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer` (Pharos Agent Arena Task 15)  
**Target Network:** Pharos Pacific Mainnet (`Chain ID: 1672` / `0x688`, Native Asset: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Date:** November 4, 2026  
**Auditor / Engineer:** Antigravity AI  

---

## 1. Safety Notice on Repository Publication

> **CRITICAL PREFLIGHT BOUNDARY:**  
> This manifest is a **PROPOSAL ONLY**. No files have been staged, committed, or pushed. No Git repository has been created or published. The proposed Git commands listed below **MUST NOT** be executed until explicit, separate authorization is granted in Gate 7B.2.

---

## 2. File & Directory Classification Matrix

Every item in the workspace is categorized into one of three publication tiers:
- **`INCLUDE`**: Mandatory for public repository, verification, build, or documentation.
- **`EXCLUDE`**: Build artifacts, dependencies, local cache, or secrets that must be omitted via `.gitignore`.
- **`REVIEW REQUIRED`**: Internal audit reports and developer notes evaluated for public exposure.

| File / Directory Path | Classification | Justification & Public Role |
| :--- | :---: | :--- |
| `package.json` | **INCLUDE** | Project manifest, npm scripts, devDependencies |
| `package-lock.json` | **INCLUDE** | Exact dependency tree lockfile for reproducible builds |
| `tsconfig.json` | **INCLUDE** | TypeScript compiler options |
| `vercel.json` | **INCLUDE** | Vercel deployment specification and security headers |
| `README.md` | **INCLUDE** | Core public documentation, setup instructions, and disclaimers |
| `.gitignore` | **INCLUDE** | Repository exclusions (`node_modules/`, `dist/`, `.env`, logs) |
| `.env.example` | **INCLUDE** | Environment configuration template |
| `src/` (All 13 files) | **INCLUDE** | Complete pure TypeScript engine, adapters, RPC client, router, UI |
| `api/` (All 5 files) | **INCLUDE** | Modular Vercel serverless function entry points |
| `public/` (All 3 files) | **INCLUDE** | Edge CDN distribution assets (`index.html`, `styles.css`, `app.js`) |
| `tests/` (All 14 files) | **INCLUDE** | Unit tests, integration tests, and numerical verification script |
| `scripts/build.js` | **INCLUDE** | Production esbuild bundling script |
| `scripts/verify-vercel.js` | **INCLUDE** | Local Vercel serverless simulation script |
| `dist/` | **EXCLUDE** | Generated build artifacts; reproducible via `npm run build` |
| `node_modules/` | **EXCLUDE** | Third-party dependencies; reproducible via `npm install` |
| `.vercel/` | **EXCLUDE** | Local Vercel project linking cache |
| `docs/gate-7b/` | **INCLUDE** | Gate 7B.1 preflight and readiness audit documentation |
| `docs/GATE7A_*.md` | **INCLUDE** | Essential architecture, gas unification, and verification proofs |
| `docs/GATE1_*.md`–`GATE6_*.md` | **REVIEW REQUIRED** | Historical milestone audits (can be retained for complete audit trail) |

---

## 3. Proposed `.gitignore` Specification

```gitignore
# Dependencies
node_modules/
package-lock.json.bak

# Build Artifacts
dist/
build/
*.tsbuildinfo

# Vercel & Hosting Cache
.vercel/
.vercel_build_output/

# Environment & Credentials
.env
.env.local
.env.*.local
*.pem
*.key

# Operating System & Logs
Thumbs.db
Desktop.ini
.DS_Store
*.log
npm-debug.log*
yarn-debug.log*
```

---

## 4. Proposed Git Commands for Future Authorization (DO NOT RUN NOW)

When explicitly authorized to initialize and publish the repository in Gate 7B.2:

```bash
# 1. Initialize standalone Git repository in skills/pharos-yield-optimizer
cd "C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer"
git init -b main

# 2. Stage verified source code, configurations, tests, and documentation
git add package.json tsconfig.json vercel.json README.md .env.example
git add src/ api/ public/ tests/ scripts/ docs/

# 3. Create initial verified release commit
git commit -m "feat: Pharos Yield Optimizer (Task 15) production release"

# 4. (If authorized) Add remote and push to GitHub
# git remote add origin https://github.com/<owner>/pharos-yield-optimizer.git
# git push -u origin main
```

---

## 5. README Readiness Verification Checklist

The current [README.md](file:///C:/Users/NO%20GO%20NO/PharosBuild/skills/pharos-yield-optimizer/README.md) fulfills all required evaluation criteria:

- [x] **Product Purpose:** Clearly defined as a non-custodial yield optimizer for Pharos Pacific Mainnet.
- [x] **Live Network & Chain Information:** `Pharos Pacific Mainnet`, `Chain ID: 1672` (`0x688`), RPC: `https://rpc.pharos.xyz`.
- [x] **Honest Source Qualification Limitation:** Full-width banner disclosing `1 of 3 qualifying sources — requirement NOT met`.
- [x] **Architecture:** Dual execution model (standalone Node.js server + Vercel serverless functions).
- [x] **Security / Non-Custodial Model:** Zero private keys, zero broadcasting, 3-step unsigned calldata generation.
- [x] **How to Test:** Prominently featured near the top with 7 reproducible commands.
- [x] **Build and Run Instructions:** Simple commands (`npm run build`, `npm start`) with zero required secrets.
- [x] **Assumptions and Data Provenance:** Trailing APR notice, 8.5% normalized benchmark, 145k DEX exit assumption.
- [x] **Known Limitations:** Windows Vercel CLI symlink cache barrier, DEX volume indexer unavailability.
- [x] **Deployment Status:** Accurately stated as local packaging verified, ready for authorized deployment.
