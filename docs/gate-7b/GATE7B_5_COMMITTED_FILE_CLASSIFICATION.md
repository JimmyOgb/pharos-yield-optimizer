# Gate 7B.5 — Committed File Classification

**Basis:** `git ls-files` at HEAD `d1f033c3517a6cac028db37091e5581143f48766`. All 170 committed files were inventoried. The six Gate 7B.5 reports listed below were created by this audit and are currently untracked; they were not part of the 170-file committed baseline.

## Root files

| Path | Classification | Finding |
|---|---|---|
| `.gitignore` | PUBLICATION APPROPRIATE | Excludes dependencies, builds, env overrides, keys, logs, Vercel metadata, and coverage. |
| `.env.example` | PUBLICATION APPROPRIATE WITH DISCLOSURE | Safe public defaults only; no secrets. |
| `README.md` | OWNER REVIEW REQUIRED | Strong documentation/disclosures, but 10 broken links and an integration-test count discrepancy. |
| `package.json` | OWNER REVIEW REQUIRED | Public manifest; declares MIT without a tracked license file. |
| `package-lock.json` | PUBLICATION APPROPRIATE | Reproducible dev dependency lockfile. |
| `tsconfig.json` | PUBLICATION APPROPRIATE | TypeScript configuration only. |
| `vercel.json` | PUBLICATION APPROPRIATE WITH DISCLOSURE | Public hosting configuration; local simulation is not cloud deployment. |
| License files | DO NOT PUBLISH | None exists; do not invent or add one without approval. |

## Application, scripts, and tests

| Group | Count | Classification | Finding |
|---|---:|---|---|
| `api/*.ts` | 5 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Serverless handlers; read-only/non-custodial behavior documented. |
| `src/**` | 16 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Core engine, UI, adapters, RPC, and reviewer; public contract addresses/RPC references. |
| `public/*` | 3 | PUBLICATION APPROPRIATE WITH DISCLOSURE | User-facing assets with one-source, model-rate, and unsigned-calldata notices. |
| `scripts/*` | 2 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Reproducible build/local Vercel simulation only. |
| `tests/**` | 14 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Unit/live integration/smoke/numerical tests; live tests require network access. |

## Documentation groups

| Group | Count | Classification | Finding |
|---|---:|---|---|
| `docs/GATE1_*.md` | 4 | OWNER REVIEW REQUIRED | Historical records; includes internal-looking Atlantic endpoint. |
| `docs/GATE1B_*.md` | 5 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Historical yield research and qualified financial figures. |
| `docs/GATE1C_*.md` | 3 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Historical source discovery/disqualification. |
| `docs/GATE1D_*.md` | 3 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Historical validator/commission research. |
| `docs/GATE1E_*.md` | 3 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Historical criteria and architecture decisions. |
| `docs/GATE2_*.md` | 9 | OWNER REVIEW REQUIRED | Planning records contain local/file URI paths and planned/stale claims. |
| `docs/GATE3_*.md` | 3 | OWNER REVIEW REQUIRED | Historical records contain absolute links and old test descriptions. |
| `docs/GATE4_*.md` | 7 | OWNER REVIEW REQUIRED | Historical audit records contain machine paths. |
| `docs/GATE5_*.md` and `GATE5_1_*.md` | 12 | OWNER REVIEW REQUIRED | Historical security/UI/test records and prior-state metrics. |
| `docs/GATE6_*.md` and `docs/GATE6_1_*.md` | 12 | OWNER REVIEW REQUIRED | Historical scoring/demo records; planned points/video are not achievements. |
| `docs/GATE7A_*.md` | 41 | OWNER REVIEW REQUIRED | Deployment-readiness history with local paths and prior counts. |
| `docs/gate-7b/GATE7B_1_*` | 7 | OWNER REVIEW REQUIRED | Prior preflight/publication proposals; not proof of publication. |
| `docs/gate-7b/GATE7B_2_*` | 7 | OWNER REVIEW REQUIRED | Prior Git preparation records and unexecuted commands. |
| `docs/gate-7b/GATE7B_3_*` | 7 | PUBLICATION APPROPRIATE WITH DISCLOSURE | Prior documentation audit records with historical/path context. |
| `docs/gate-7b/GATE7B_5_*` (new, untracked) | 6 | OWNER REVIEW REQUIRED | These audit outputs record conditions, not unconditional approval; they are not part of the committed baseline. |

## Generated/local artifacts

Local `dist/` and `node_modules/` exist but are ignored and not committed. No tracked build, coverage, Vercel cache, log, temporary, image, video, screenshot, or binary artifact was found. If manually selected, these are DO NOT PUBLISH; regenerate instead.

No committed file was classified DO NOT PUBLISH because of a confirmed secret. Owner-review classifications concern legal, privacy, historical, and presentation quality.
