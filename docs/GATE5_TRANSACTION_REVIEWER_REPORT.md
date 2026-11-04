# GATE 5 — NON-CUSTODIAL TRANSACTION REVIEWER REPORT
## Verified ABI Investigation, Unsigned Calldata Encoding & Safety Boundaries

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (`Chain ID: 1672`, Currency: `PROS`)  
**Target Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Module:** `src/reviewer/transactionReviewer.ts`  
**Gate:** **Gate 5 — UI Dashboard & Non-Custodial Transaction Reviewer**  
**Execution Date:** November 3, 2026  

---

## 1. Objective & Non-Custodial Mission

The Non-Custodial Transaction Reviewer is an evidence-based transaction inspection tool. It bridges the gap between algorithmic recommendation and user execution without ever touching user funds or private keys:

1. **Explains the Recommended Action:** Translates abstract financial rebalance decisions into human-readable contract operations.
2. **Identifies Target Contracts & Methods:** Pins exact on-chain contract addresses, verified function signatures, and method selectors.
3. **Encodes Unsigned Calldata:** Generates mathematically exact, 32-byte aligned ABI calldata for genuine, on-chain verified contracts.
4. **Enforces Unavailable States:** For protocols whose contract ABI or method signatures are not verified on-chain (e.g. Axil USD credit or Native PoS consensus), the reviewer strictly refuses to fabricate calldata and outputs an explicit `UNAVAILABLE` state.
5. **Absolute Execution Prohibitions:** Zero private key access, zero seed phrase storage, zero wallet auto-connect, zero signing, zero broadcasting. The user retains 100% custody and control in their external Web3 wallet.

---

## 2. On-Chain Verified ABI Discovery (Faroo stPROS)

During Gate 5 bytecode analysis of the Faroo stPROS implementation contract (`0xfd59860894e01773e9780b0d1dfae4ca2b56708d`), the dispatch table was scanned for known function signatures.

### Verified Findings:
- **Architecture Standard:** Faroo implements the canonical **ERC-4626 Tokenized Vault** standard.
- **Underlying Asset Query (`asset()` selector `0x38d52e0f`):**
  - Result: `0x00000000000000000000000052c48d4213107b20bc583832b0d951fb9ca8f0b0`
  - Target Token: **Canonical Wrapped PROS (`WPROS`)** at `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0`.
- **Deposit Selector (`deposit(uint256,address)`):** `0x6e553f65`.
- **Unbonding Period Parameter (`unbondingPeriod()` selector `0x6cf6d675`):**
  - Result: `86,400 seconds` (1 day parameter on this contract version; up to 14 days under protocol queue conditions).

---

## 3. Verified Execution Workflow: Faroo Liquid Staking

Because the Faroo stPROS vault accepts WPROS as its underlying asset, the transaction reviewer prepares a verified 3-step transaction sequence:

```
[User Native PROS]
        │
        ▼ (Step 1: WPROS.deposit() [0xd0e30db0] with msg.value = principal)
[WPROS Balance]
        │
        ▼ (Step 2: WPROS.approve(farooVault, principal) [0x095ea7b3])
[Faroo Vault Allowance Granted]
        │
        ▼ (Step 3: FarooVault.deposit(assets, receiver) [0x6e553f65])
[Minted stPROS Liquid Staking Shares in User Wallet]
```

### Detailed Step Specifications

#### Step 1: Wrap Native PROS into Canonical WPROS
- **Contract Name:** Canonical Wrapped PROS (`WPROS`).
- **Contract Address:** `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0`.
- **Method Signature:** `deposit()`.
- **Method Selector:** `0xd0e30db0`.
- **ABI Status:** `ABI VERIFIED`.
- **Transaction Payload:**
  - `to`: `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0`
  - `value`: `0x3635c9adc5dea00000` (1,000 PROS in wei)
  - `data`: `0xd0e30db0`
  - `gasLimit`: `0xafc8` (45,000 gas units)
  - `chainId`: `1672`

#### Step 2: Approve Faroo stPROS Vault for WPROS
- **Contract Name:** Canonical Wrapped PROS (`WPROS`).
- **Contract Address:** `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0`.
- **Method Signature:** `approve(address spender, uint256 amount)`.
- **Method Selector:** `0x095ea7b3`.
- **ABI Status:** `ABI VERIFIED`.
- **Parameters:**
  - `spender` (address): `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`
  - `amount` (uint256): `1000000000000000000000` (1,000 WPROS in wei)
- **Transaction Payload:**
  - `to`: `0x52C48d4213107b20bC583832b0d951FB9CA8F0B0`
  - `value`: `0x0`
  - `data`: `0x095ea7b30000000000000000000000006b0a44c64190279f7034b77c13a566e914fe5ec400000000000000000000000000000000000000000000003635c9adc5dea00000`
  - `gasLimit`: `0xafc8` (45,000 gas units)
  - `chainId`: `1672`

#### Step 3: Deposit WPROS into Faroo Liquid Staking Vault
- **Contract Name:** Faroo Liquid Staked PROS (`stPROS`).
- **Contract Address:** `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`.
- **Method Signature:** `deposit(uint256 assets, address receiver)`.
- **Method Selector:** `0x6e553f65`.
- **ABI Status:** `ABI VERIFIED`.
- **Parameters:**
  - `assets` (uint256): `1000000000000000000000` (1,000 WPROS in wei)
  - `receiver` (address): User's wallet address (e.g. `0x1111111111111111111111111111111111111111`)
- **Transaction Payload:**
  - `to`: `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`
  - `value`: `0x0`
  - `data`: `0x6e553f6500000000000000000000000000000000000000000000003635c9adc5dea000000000000000000000000000001111111111111111111111111111111111111111`
  - `gasLimit`: `0x15f90` (90,000 gas units)
  - `chainId`: `1672`

---

## 4. Disqualified & Unverified Candidate Handling

In strict accordance with the **Zero-Mock Requirement**, the reviewer refuses to output fabricated calldata for disqualified strategies:

### Axil Prime Credit 3M
- **Review Status:** `PAYLOAD UNAVAILABLE`.
- **Unavailability Reason:** `TRANSACTION_PAYLOAD_UNAVAILABLE: Axil is an off-chain target USD credit product. The agent strictly refuses to prepare rebalance transactions for non-qualifying or cross-asset target rates.`
- **Explanation:** Axil accepts USDC, requires 3-month fixed lockup, and advertises an off-chain target APY rather than an on-chain smart contract accrual mechanism.

### Native PoS Consensus Staking
- **Review Status:** `PAYLOAD UNAVAILABLE`.
- **Unavailability Reason:** `TRANSACTION_PAYLOAD_UNAVAILABLE: Pharos Pacific Mainnet lacks a public delegation registry contract. Users cannot delegate native PROS to individual validators on-chain without running a validator node.`
- **Explanation:** Consensus staking requires running a dedicated validator node with 32,000+ PROS self-stake.

---

## 5. Security & Reviewer Safety Disclosures

Every transaction review report includes non-negotiable metadata:

```json
{
  "safetyNotice": {
    "isNonCustodial": true,
    "canSign": false,
    "canBroadcast": false,
    "disclaimer": "This transaction review provides unsigned calldata for external inspection only. The agent does not hold private keys, cannot sign, and cannot broadcast transactions. You must review and execute using your external wallet."
  }
}
```

The UI displays a persistent warning banner instructing the user to copy the calldata into their external wallet software (e.g. MetaMask, Rabby) to independently verify the recipient, parameters, and gas limits before signing.
