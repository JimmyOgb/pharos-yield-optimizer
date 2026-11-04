# GATE 1 — EVIDENCE REGISTER & AUDIT PROVENANCE
## Pharos Pacific Mainnet (Chain ID 1672)

**Audit Timestamp:** November 3, 2026  
**Auditor:** Antigravity AI  
**Scope:** Complete Catalog of Verified Endpoints, Contract Bytecode, RPC Responses, and Provenance Metadata  
**Operating Standard:** Every claim strictly classified with evidence tags.

---

## 1. Verified Infrastructure Endpoints

| Resource | Value / Endpoint | Evidence Tag | Source Provenance |
| :--- | :--- | :---: | :--- |
| **Pharos Pacific Mainnet RPC** | `https://rpc.pharos.xyz` | `VERIFIED_ONCHAIN` | Tested live via JSON-RPC `eth_chainId` -> `0x688` (1672) |
| **Pharos Atlantic Testnet RPC**| `https://atlantic.dplabs-internal.com` | `VERIFIED_OFFICIAL_DOCUMENTATION`| Documented in official network docs (Chain ID `688689`) |
| **Canonical MultiCall3** | `0xcA11bde05977b3631167028862bE2a173976CA11` | `VERIFIED_ONCHAIN` | Bytecode verified deployed on Pharos Pacific Mainnet |
| **Block Explorer** | `https://pharoscan.com` / `https://pacific.pharosscan.xyz` | `VERIFIED_OFFICIAL_DOCUMENTATION`| Official Pharos block explorer portal |
| **Pharos Port Ecosystem Hub** | `https://port.pharos.xyz` | `VERIFIED_OFFICIAL_DOCUMENTATION`| Production web portal serving staking and Harbor vaults |

---

## 2. On-Chain Contract Verification Register

| Contract Name | Contract Address | Bytecode Size | Verified On-Chain Metadata | Evidence Tag |
| :--- | :--- | :---: | :--- | :---: |
| **Faroo Liquid Staking (`stPROS`)** | `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4` | 2,739 bytes | Name: `Faroo Staked PROS`<br>Symbol: `stPROS`<br>Total Supply: `3,136,910.75 stPROS` | `VERIFIED_ONCHAIN` |
| **Axil Prime Credit 3M Share Token** | `0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0` | 163 bytes (Proxy) | Name: `AxilPrimeCredit-3M`<br>Symbol: `APC3M`<br>Total Supply: `70,278,480.33 APC3M` | `VERIFIED_ONCHAIN` |
| **Axil Prime Credit 3M Core Vault** | `0xD0428799FbC35557834d33121BA4472692c8908a` | 163 bytes (Proxy) | Core vault controller managing R25 protocol credit allocations | `VERIFIED_ONCHAIN` |
| **Pharos Canonical USDC** | `0xC879C018dB60520F4355C26eD1a6D572cdAC1815` | 1,798 bytes | Name: `USDC`<br>Symbol: `USDC`<br>Total Supply: `11,011,379.08 USDC` | `VERIFIED_ONCHAIN` |
| **Canonical Wrapped PROS (`WPROS`)** | `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0` | 3,249 bytes | Name: `Wrapped PROS`<br>Symbol: `WPROS`<br>Total Supply: `22,246,663.81 WPROS`<br>*(0.00% benchmark baseline)* | `VERIFIED_ONCHAIN` |
| **Pharos DEX PoolManager (Uniswap V4)**| `0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550` | 17,151 bytes | Singleton pool management contract for liquidity provision | `VERIFIED_ONCHAIN` |
| **Pharos DEX StateView** | `0x616434e941c5E53d44894bF9ca13D517927BF8aF` | 2,784 bytes | Read-only state viewer for liquidity pool parameters | `VERIFIED_ONCHAIN` |

---

## 3. Protocol Rule & Fee Extraction Evidence

| Protocol | Feature | Extracted Value | Evidence Tag | Source Provenance |
| :--- | :--- | :--- | :---: | :--- |
| **Faroo Liquid Staking** | Minting Mechanism | Deposit native PROS -> receive stPROS | `VERIFIED_OFFICIAL_DOCUMENTATION` | `https://port.pharos.xyz/stake` FAQ Schema |
| **Faroo Liquid Staking** | Reward Model | Compounding exchange rate | `VERIFIED_OFFICIAL_DOCUMENTATION` | `https://port.pharos.xyz/stake` FAQ Schema |
| **Faroo Liquid Staking** | Unbonding Duration | ~14 days standard exit period | `VERIFIED_OFFICIAL_DOCUMENTATION` | `https://port.pharos.xyz/stake` FAQ Schema |
| **Axil Prime Credit** | Term Length | 3 months (90 days) | `VERIFIED_OFFICIAL_DOCUMENTATION` | `https://port.pharos.xyz/apc` Metadata |
| **Axil Prime Credit** | Underlying Asset | USDC (`0xC879...`) | `VERIFIED_ONCHAIN` | Port bundle & contract inspect |
| **Native PoS Staking** | Epoch Duration | ~4 hours per epoch | `VERIFIED_OFFICIAL_DOCUMENTATION` | `https://port.pharos.xyz/stake` FAQ Schema |
| **Native PoS Staking** | Unbonding Period | ~14 days exit period | `VERIFIED_OFFICIAL_DOCUMENTATION` | `https://port.pharos.xyz/stake` FAQ Schema |
| **Native PoS Staking** | Status on Port UI | `Coming Soon` in Anvita Mate | `VERIFIED_OFFICIAL_DOCUMENTATION` | `port.pharos.xyz` index bundle badge |

---

## 4. Live RPC Audit Query Proof

```json
{
  "auditBlock": 22022588,
  "chainId": 1672,
  "chainHex": "0x688",
  "nativeCurrency": "PROS",
  "rpcUrl": "https://rpc.pharos.xyz",
  "auditDate": "2026-11-03T16:15:00Z",
  "verificationVerdict": "ALL_TARGET_CONTRACTS_VERIFIED"
}
```
