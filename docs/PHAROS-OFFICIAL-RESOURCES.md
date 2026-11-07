# PERMANENT OFFICIAL PHAROS RESOURCE REGISTER & CONSULTATION RULES

**Project:** Pharos Yield Optimizer & Pharos Ecosystem Build  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Network:** Pharos Pacific Mainnet — Chain ID `1672` (`0x688`)  
**RPC Endpoint:** `https://rpc.pharos.xyz`  
**Last Comprehensive Verification:** November 7, 2026  
**Status:** Permanent Project Invariant & Mandatory Pre-Flight Register  

---

## 1. Permanent Official Resource Register

Antigravity and all contributing engineers must consult these primary resources prior to proposing or implementing any Pharos-specific architecture, APIs, SDKs, AI integrations, wallet interactions, network configurations, or payment functionality.

| Resource Name | Official URL | Verified Status | Primary Use & Intended Scope | Verified Capabilities & Known Limitations |
| :--- | :--- | :---: | :--- | :--- |
| **1. Pharos AI Agent Hub** | `https://ai.pharos.xyz` | **ACTIVE (HTTP 200)**<br>Verified Nov 7, 2026 | Official Pharos AI Agent Hub, Model Context Protocol (MCP) integrations, agent tooling, and natural language assistant infrastructure. | **Capabilities:** Host MCP tools, agent registry, agent discovery.<br>**Limitations:** Deterministic financial math and on-chain yield comparisons must NEVER be delegated to stochastic AI text models. AI may assist solely with explanatory tool framing or natural language portfolio querying without controlling financial recommendations. |
| **2. Official Pharos Documentation** | `https://docs.pharos.xyz` | **ACTIVE (HTTP 200)**<br>Verified Nov 7, 2026 | Canonical source of truth for Pharos Pacific Mainnet (Chain ID 1672), consensus precompiles, gas models, token registry, and node RPC specifications. | **Capabilities:** Complete network specifications, EVM compatibility rules, precompile definitions (e.g. System Staking at `0x4100...0000`), block explorer guides.<br>**Limitations:** Documentation covers both Atlantic Testnet and Pacific Mainnet; engineers must strictly verify Chain ID 1672 compatibility before applying testnet examples to production. |
| **3. Pharos x402 Developer Guide** | `https://docs.pharos.xyz/developer-guide/x402` | **ACTIVE (HTTP 200)**<br>Verified Nov 7, 2026 | Official specification for the internet-native HTTP 402 "Payment Required" crypto micropayment protocol for AI agents and content monetization. | **Capabilities:** Outlines HTTP 402 flow, `PAYMENT-REQUIRED` headers, `PaymentPayload` signing in `PAYMENT-SIGNATURE`, on-chain settlement via facilitator.<br>**Limitations & Decision:** Evaluated for Task 15. The Yield Optimizer is a public, open-access DeFi utility. Adding x402 paywalls would introduce artificial payment friction, latency, and wallet signature barriers for standard users. **x402 is deferred** from the core optimizer, reserved for future premium automated agent execution endpoints. |
| **4. Pharos DevHub** | `https://www.pharos.xyz/devhub` | **ACTIVE (HTTP 200)**<br>Verified Nov 7, 2026 | Central developer portal for hackathons, ecosystem toolkits, official SDK releases, grants, and community developer resources. | **Capabilities:** Official developer guidelines, RPC endpoints, community faucets, and developer infrastructure indexing.<br>**Limitations:** External links and community tutorials must be validated against official docs and live RPC before adoption. |

---

## 2. Inviolable Resource-Use Rules for Pharos Development

To preserve technical integrity and prevent regressions, all agents and developers must adhere to the following rules across every Pharos task:

1. **Hierarchy of Evidence:**
   - **Tier 1:** Live on-chain EVM bytecode and JSON-RPC state observations (`https://rpc.pharos.xyz`, Chain ID 1672).
   - **Tier 2:** Official Pharos Documentation (`docs.pharos.xyz`) and DevHub (`pharos.xyz/devhub`).
   - **Tier 3:** Verified open-source protocol implementations (e.g. Faroo, Uniswap V3 on Pharos).
   - **Forbidden:** Third-party tutorials, unverified LLM hallucinations, outdated testnet snippets, and unhedged illustrative assumptions.
2. **Network Scoping & Invariant Check:**
   - Always confirm **Chain ID 1672 (`0x688`)**. Never deploy testnet configurations (Atlantic Testnet) to Pacific Mainnet.
   - Verify all contract addresses on-chain via `eth_getCode` before referencing them in code or configuration.
3. **Deterministic Financial Math Invariant:**
   - Yield calculations, exchange rate compounding, transaction friction, and recommendation logic must remain **100% deterministic, reproducible TypeScript code**.
   - Under no circumstances may financial returns, APYs, or rebalance triggers be generated or altered by an LLM prompt or stochastic AI model.
4. **x402 Economic Justification Guard:**
   - Never implement x402 payment requirements unless solving a genuine product requirement where a user or autonomous agent explicitly contracts for paid computational resources.
   - The primary Yield Optimizer recommendation engine must remain free and accessible without micropayment gates.
5. **Durable Memory & Instruction Preservation:**
   - Existing project-level instructions (e.g. in `.gemini`, `README.md`, or `docs/`) must be preserved. Future Pharos tasks must explicitly reference this register in their pre-flight checks.
