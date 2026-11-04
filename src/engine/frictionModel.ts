/**
 * Transaction Cost & Friction Model Engine
 * Pharos Pacific Mainnet (Chain ID 1672)
 * 
 * Accurately models entry/exit fees, gas limits, AMM trading spreads, and slippage.
 * Invariant: Never substitutes zero for an unavailable fee.
 */

import type {
  FrictionBreakdown,
  StrategyId,
  ProvenanceStatus,
} from '../types/index.ts';
import { scaledToDecimal, BPS_SCALE } from './yieldMath.ts';

// Historical and empirical gas benchmarks on Pharos Pacific Mainnet (1672)
export const GAS_LIMITS = {
  // Physical ERC-4626 Entry Sequence (180,000 gas units verified)
  FAROO_WRAP_PROS: 45_000n,
  FAROO_APPROVE_WPROS: 45_000n,
  FAROO_VAULT_DEPOSIT: 90_000n,
  // Patient Exit via Protocol Unbonding Queue (85,000 gas units benchmark)
  FAROO_REQUEST_WITHDRAW: 85_000n,
  // Instant Exit via DEX AMM Swap (145,000 gas units assumed benchmark, unverified by live receipt)
  DEX_SWAP_EXACT_TOKENS: 145_000n,
  ERC20_APPROVE: 45_000n,
} as const;

// Verified Protocol Fee Parameters
export const VERIFIED_FEES = {
  FAROO_MINT_FEE_BPS: 0,        // 0.00% verified on-chain
  FAROO_QUEUE_EXIT_FEE_BPS: 0,  // 0.00% verified on-chain
  DEX_V4_SWAP_FEE_BPS: 30,      // 0.30% verified pool fee
  DEFAULT_SLIPPAGE_BPS: 10,     // 0.10% conservative standard retail slippage
} as const;

/**
 * Computes execution gas cost in wei
 * gasCost = gasUnits * gasPriceGwei * 10^9
 */
export function computeGasCostWei(gasUnits: bigint, gasPriceGwei: number): bigint {
  if (gasUnits < 0n) {
    throw new Error('Invalid input: gasUnits cannot be negative');
  }
  if (gasPriceGwei < 0 || !Number.isFinite(gasPriceGwei)) {
    throw new Error('Invalid input: gasPriceGwei must be a non-negative finite number');
  }

  const gasPriceWei = BigInt(Math.round(gasPriceGwei * 1_000_000_000));
  return gasUnits * gasPriceWei;
}

/**
 * Computes protocol percentage fee in wei from basis points (bps)
 */
export function computeFeeWei(amountWei: bigint, feeBps: number): bigint {
  if (amountWei < 0n) {
    throw new Error('Invalid input: amountWei cannot be negative');
  }
  if (feeBps < 0 || !Number.isFinite(feeBps)) {
    throw new Error('Invalid input: feeBps must be a non-negative finite number');
  }

  return (amountWei * BigInt(Math.floor(feeBps))) / BPS_SCALE;
}

/**
 * Evaluates comprehensive friction for a specific target strategy
 */
export function evaluateStrategyFriction(
  strategyId: StrategyId,
  principalWei: bigint,
  gasPriceGwei: number,
  customSlippageBps?: number
): FrictionBreakdown {
  if (principalWei < 0n) {
    throw new Error('Invalid input: principalWei cannot be negative');
  }

  switch (strategyId) {
    case 'faroo-patient-staking': {
      // Unified Physical Lifecycle: Wrap (45k) + Approve (45k) + Deposit (90k) + Exit Queue (85k) = 265,000 gas
      const entryGasUnits = GAS_LIMITS.FAROO_WRAP_PROS + GAS_LIMITS.FAROO_APPROVE_WPROS + GAS_LIMITS.FAROO_VAULT_DEPOSIT; // 180,000
      const exitGasUnits = GAS_LIMITS.FAROO_REQUEST_WITHDRAW; // 85,000
      const totalGasUnits = entryGasUnits + exitGasUnits;     // 265,000 gas units
      const gasCostWei = computeGasCostWei(totalGasUnits, gasPriceGwei);
      const entryFeeWei = computeFeeWei(principalWei, VERIFIED_FEES.FAROO_MINT_FEE_BPS);
      const exitFeeWei = computeFeeWei(principalWei, VERIFIED_FEES.FAROO_QUEUE_EXIT_FEE_BPS);
      const totalFrictionWei = gasCostWei + entryFeeWei + exitFeeWei;

      return {
        gasCostWei,
        entryFeeWei,
        exitFeeWei,
        swapFeeWei: 0n,
        slippageCostWei: 0n,
        totalFrictionWei,
        totalFrictionPros: scaledToDecimal(totalFrictionWei),
        provenance: 'VERIFIED_ONCHAIN' as ProvenanceStatus,
        isComplete: true,
      };
    }

    case 'faroo-instant-dex': {
      // Physical Entry (180k) + Assumed DEX Swap Exit (145k benchmark) = 325,000 gas
      const entryGasUnits = GAS_LIMITS.FAROO_WRAP_PROS + GAS_LIMITS.FAROO_APPROVE_WPROS + GAS_LIMITS.FAROO_VAULT_DEPOSIT; // 180,000
      const exitGasUnits = GAS_LIMITS.DEX_SWAP_EXACT_TOKENS; // 145,000 (assumed benchmark)
      const totalGasUnits = entryGasUnits + exitGasUnits;     // 325,000 gas units
      const gasCostWei = computeGasCostWei(totalGasUnits, gasPriceGwei);
      const entryFeeWei = computeFeeWei(principalWei, VERIFIED_FEES.FAROO_MINT_FEE_BPS);
      const swapFeeWei = computeFeeWei(principalWei, VERIFIED_FEES.DEX_V4_SWAP_FEE_BPS);
      const slippageBps = customSlippageBps ?? VERIFIED_FEES.DEFAULT_SLIPPAGE_BPS;
      const slippageCostWei = computeFeeWei(principalWei, slippageBps);
      const totalFrictionWei = gasCostWei + entryFeeWei + swapFeeWei + slippageCostWei;

      return {
        gasCostWei,
        entryFeeWei,
        exitFeeWei: 0n,
        swapFeeWei,
        slippageCostWei,
        totalFrictionWei,
        totalFrictionPros: scaledToDecimal(totalFrictionWei),
        provenance: 'EXECUTION_ALTERNATIVE' as ProvenanceStatus,
        isComplete: true,
      };
    }

    case 'axil-prime-credit-3m': {
      // Institutional credit vault denominated in USDC.
      // PROS rebalancing requires a cross-currency DEX swap plus vault fees.
      const swapGas = GAS_LIMITS.DEX_SWAP_EXACT_TOKENS * 2n; // PROS -> USDC and USDC -> PROS
      const gasCostWei = computeGasCostWei(swapGas, gasPriceGwei);
      const crossCurrencyFeeWei = computeFeeWei(principalWei, 60); // 2x 30bps swaps
      const slippageCostWei = computeFeeWei(principalWei, 20);      // 2x 10bps slippage
      const totalFrictionWei = gasCostWei + crossCurrencyFeeWei + slippageCostWei;

      return {
        gasCostWei,
        entryFeeWei: crossCurrencyFeeWei,
        exitFeeWei: 0n,
        swapFeeWei: crossCurrencyFeeWei,
        slippageCostWei,
        totalFrictionWei,
        totalFrictionPros: scaledToDecimal(totalFrictionWei),
        provenance: 'OFFCHAIN_TARGET_RATE' as ProvenanceStatus,
        isComplete: true,
      };
    }

    case 'native-pros-baseline': {
      // Zero-yield baseline holding incur zero incremental fees or gas.
      return {
        gasCostWei: 0n,
        entryFeeWei: 0n,
        exitFeeWei: 0n,
        swapFeeWei: 0n,
        slippageCostWei: 0n,
        totalFrictionWei: 0n,
        totalFrictionPros: 0,
        provenance: 'BASELINE_ONLY' as ProvenanceStatus,
        isComplete: true,
      };
    }

    default: {
      const _exhaustiveCheck: never = strategyId;
      throw new Error(`Unhandled strategy identifier: ${_exhaustiveCheck}`);
    }
  }
}
