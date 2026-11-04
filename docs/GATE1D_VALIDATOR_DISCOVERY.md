# Gate 1D: Native PROS Validator Discovery Report

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (Chain ID: `1672`)  
**RPC Endpoint:** `https://rpc.pharos.xyz`  
**Date:** November 3, 2026  
**Status:** COMPLETE (READ-ONLY AUDIT)

---

## 1. Executive Summary

During Gate 1C, **Path C** ("Native PROS Validator Staking Tiers") was proposed as a potential architectural direction to compare:
1. Direct PoS Validator Delegation (0% Commission baseline)
2. Direct PoS Validator Delegation (5% Commission standard)
3. Faroo Liquid Staking (`stPROS`) Pool (10% protocol fee on yield)

This Gate 1D discovery was conducted to rigorously test whether Pharos Pacific Mainnet currently exposes an on-chain validator registry, public validator identities, per-validator delegation contracts, and commission queries that would allow an EVM application or retail user to independently select and stake to specific individual validators.

**Audit Finding:**  
Pharos Pacific Mainnet **does NOT** currently expose a public EVM-accessible validator registry or permissionless delegation contract allowing end users to choose individual validator addresses. Direct EVM delegation remains unlaunched on public mainnet (documented as *"Native staking with auto-compound goes live in Anvita Mate soon"*). Consequently, individual 0% and 5% validator delegation targets cannot be queried, selected, or transacted with via standard JSON-RPC.

---

## 2. On-Chain Architecture & Execution Layer Probing

### 2.1 Block Header Miner Inspection
In standard EVM chains with consensus-layer staking (e.g., Ethereum post-Merge, Polygon Bor, or custom PoS), block headers or miner fields frequently expose validator or proposer addresses.

We queried recent canonical blocks on Pharos Pacific Mainnet (`#22025994` through `#22025998`):
```bash
curl -s -X POST https://rpc.pharos.xyz \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x14ff94e", false],"id":1}'
```
**Result:**
- `miner`: `0x0000000000000000000000000000000000000000`
- `extraData`: `0x`
- In Pharos Pacific Mainnet, consensus-layer proposer identities are decoupled from the EVM block header `miner` field. No individual validator addresses or public keys are readable via block headers.

### 2.2 System Precompile & Staking Contract Audit
Many PoS EVM networks host validator registries at reserved system addresses (e.g., `0x0000000000000000000000000000000000001000` through `0x2000`). We probed these ranges on Pacific Mainnet using `eth_getCode`:
- Address `0x0000000000000000000000000000000000001000`: `0x` (0 bytes)
- Address `0x0000000000000000000000000000000000001001`: `0x` (0 bytes)
- Address `0x0000000000000000000000000000000000001002`: `0x` (0 bytes)
- Address `0x0000000000000000000000000000000000001005`: `0x` (0 bytes)
- Address `0x0000000000000000000000000000000000002000`: `0x` (0 bytes)

No on-chain staking precompiles or registry contracts exist at standard system address allocations.

### 2.3 RPC Namespace Verification
We tested proprietary validator-query RPC methods across known PoS conventions:
- `pharos_getValidators`: Returns `{"code": -32601, "message": "method error; invalid method"}`
- `pos_getValidators`: Returns `{"code": -32601, "message": "method error; invalid method"}`
- `bor_getCurrentValidators`: Returns `{"code": -32601, "message": "method error; invalid method"}`
- `web3_clientVersion`: Returns `"portal/1.0.0"`

The public RPC node `https://rpc.pharos.xyz` serves as a standard JSON-RPC proxy and exposes standard `eth_*` methods only. No validator enumeration methods are supported.

---

## 3. Official Documentation & Portal Status

A thorough audit of Pharos Port (`https://port.pharos.xyz/stake`) reveals the following official status:

1. **Native PoS Protocol Parameters:**
   - Base Layer-1 PoS target APR is documented at **~8.50%**.
   - Unbonding period for PoS consensus is **14 days**.
2. **Current Retail Availability:**
   - The portal explicitly notes: *"Native staking with auto-compound goes live in Anvita Mate soon (Coming Soon)."*
   - Direct retail staking to individual PoS validators is pending the Anvita Mate network upgrade and is not accessible as an EVM smart contract on Pacific Mainnet today.
3. **Current Liquid Staking Gateway:**
   - Faroo Protocol (`stPROS`) is officially recognized and linked as the active staking gateway on Pharos Pacific Mainnet.

---

## 4. Faroo Protocol Validator Pool Inspection

Because Faroo (`stPROS`, contract `0x6b0A44c64190279f7034b77c13a566E914FE5Ec4`) is the live staking vehicle, we inspected its on-chain storage to understand how it routes stake to validators:

- **Storage Slot 2 (`totalSupply`):** `3,136,910.7559 stPROS`
- **Storage Slot 3 (`totalAssets` / base stake):** `3,134,604.8123 PROS`
- **Storage Slot 8 (epoch / unbonding time):** `86,400` seconds (1 day epoch)
- **Storage Slot 10 (Operator):** `0xf772b375f93650f798bf724ce7a9a45c9e7a579f`

**Delegation Mechanism:**  
Faroo aggregates all deposited user PROS into its contract pool and delegates to consensus validators via its backend protocol operator (`0xf772...`). The end-user staker has **no parameter** to specify a validator address, nor does Faroo expose sub-pools for different validator commission tiers. All users receive identical `stPROS` shares representing proportional claims on the aggregate pool.

---

## 5. Synthesis & Conclusion

| Requirement | Expected in Path C | Observed on Pacific Mainnet | Status |
| :--- | :--- | :--- | :--- |
| Public Validator Registry | EVM contract listing validators | None at EVM layer; masked in block headers | `UNAVAILABLE` |
| Individual Validator Addresses | Identifiable hex addresses | None publicly queryable via RPC | `UNAVAILABLE` |
| Direct Delegation Contract | `deposit(validatorAddress)` | Pending Anvita Mate ("Coming Soon") | `UNAVAILABLE` |
| Commission Query Function | `getCommission(validator)` | Method `-32601` invalid method | `UNAVAILABLE` |
| Faroo Validator Selection | Custom validator choice | Monolithic pool via operator `0xf772...` | `UNAVAILABLE` |

**Conclusion:**  
Direct retail validator selection does not exist as an EVM-executable feature on Pharos Pacific Mainnet today. Staking is exclusively accessible through Faroo's pooled liquid staking contract or by holding native PROS unstaked.
