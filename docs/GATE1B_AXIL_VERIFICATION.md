# GATE 1B — AXIL PRIME CREDIT 3M VAULT INDEPENDENT VERIFICATION REPORT
## Protocol Identity, Underlying Asset, Currency Risk & Yield Audit

**Audit Date:** November 3, 2026  
**Auditor:** Antigravity AI  
**Reported Share Token:** `0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0`  
**Reported Core Vault:** `0xD0428799FbC35557834d33121BA4472692c8908a`  
**Network:** Pharos Pacific Mainnet (`Chain ID: 1672`)  
**Audit Block Number:** `#22024271`  
**Classification:** **`PARTIALLY_VERIFIED_RWA` / `EXCLUDED_FROM_PROS_ACCEPTANCE_CRITERIA`**

---

## 1. Protocol Documentation & Address Verification

- **Official Product Name:** Axil Prime Credit 3M Vault (`APC3M`).
- **Official Documentation Source:**
  - Pharos Port Ecosystem Portal: [https://port.pharos.xyz/apc](https://port.pharos.xyz/apc)
  - Description: *"Axil Prime Credit 3M is a 3-month USDC vault on Pharos Mainnet (R25 Protocol), with Axil as the Risk Curator."*
- **Independent On-Chain Address Verification:**
  - **Share Token (`0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0`):**
    - Bytecode: 163 bytes (ERC-1967 minimal proxy).
    - Implementation slot (`0x360894a1...`): `0x5f7626897a6dc95c576d0b60b791a1f3bd238622`.
    - Name: `AxilPrimeCredit-3M`.
    - Symbol: `APC3M`.
    - Decimals: `18`.
    - Total Supply: `70,278,480.3344 APC3M`.
  - **Core Vault (`0xD0428799FbC35557834d33121BA4472692c8908a`):**
    - Bytecode: 163 bytes (ERC-1967 minimal proxy).
    - Implementation slot (`0x360894a1...`): `0x880ac096be22069751445bd17b3cd6e40b8575fc`.

---

## 2. Underlying Asset & Currency Mismatch

- **Underlying Asset:** **Pharos USDC** (`0xC879C018dB60520F4355C26eD1a6D572cdAC1815`).
  - Total USDC Supply on Pharos: `11,011,379.08 USDC` (6 decimals).
- **Critical Currency Mismatch Risk:**
  - Faroo stPROS, Native Staking, and WPROS are denominated in native **PROS**.
  - Axil Prime Credit is denominated in **USDC** (stablecoin).
  - Comparing a 10.50% - 12.00% USDC yield directly against an 8.50% PROS yield introduces severe **FX Currency Risk**: if PROS appreciates 15% against the US Dollar during the 90-day lockup, the USDC investor suffers a net opportunity loss in PROS terms regardless of the private credit return.
  - A strict DeFi yield optimizer cannot treat USDC and PROS as interchangeable without dynamic foreign exchange rate conversion.

---

## 3. Yield Mechanism: Target APY vs. On-Chain Accrual

- **Nature of the 10.50% – 12.00% Figure:**
  - This is an **`ADVERTISED_TARGET_APY`** based on institutional off-chain real-world asset credit portfolios curated by Axil.
  - Unlike stPROS (which accumulates algorithmic validator consensus rewards on-chain every block), RWA credit yield depends on off-chain borrower debt repayment and periodic net-asset-value (NAV) oracle updates.
  - Live on-chain fee accrual cannot be independently derived from pure math without trusting off-chain curator feeds.

---

## 4. Accessibility and Eligibility Restrictions

- **Compliance Guardrails:**
  - Inspection of the Pharos Port codebase reveals mandatory compliance endpoints:
    `fWe = "/omni_port/aml/check"`
  - Depositors are subject to AML / sanctions screening before being permitted to mint vault shares.
  - Unvetted public wallet addresses cannot freely deposit into this vault.
- **Lockup Restrictions:**
  - The 3-month (90 days) term is legally and contractually binding. Redemptions are queued until maturity. Early exit is not permissionlessly guaranteed on-chain.

---

## 5. Verification Verdict

**Axil Prime Credit 3M is a legitimate deployed RWA product, BUT MUST BE EXCLUDED from the 3-source like-for-like native yield comparison under Gate 1B rules:**
- Yield is an off-chain target APY (`UNVERIFIED_LIVE_ACCRUAL`).
- Denominated in USDC, creating severe foreign exchange risk against native PROS.
- Requires off-chain AML verification, preventing unrestricted agent-directed rebalancing.
