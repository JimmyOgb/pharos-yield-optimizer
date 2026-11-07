/**
 * Non-Custodial Transaction Reviewer
 * Generates unsigned transaction calldata, explanations, and safety disclosures.
 * STRICT SECURITY INVARIANT: Zero private key access, zero signing, zero broadcasting.
 * ZERO-MOCK INVARIANT: Only verified ABIs produce calldata; unverified ABIs return UNAVAILABLE.
 */

import { CANONICAL_CONTRACTS, NETWORK_CONFIG } from '../types/index.ts';
import { decimalToWei } from '../engine/yieldMath.ts';

export interface UnsignedTransactionPayload {
  to: string;
  data: string;
  value: string; // in wei (hex or decimal string)
  gasLimit: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  chainId: number;
}

export interface TransactionStepReview {
  stepNumber: number;
  title: string;
  contractName: string;
  contractAddress: string;
  methodName: string;
  selector: string;
  isAbiVerified: boolean;
  explanation: string;
  parameters: Array<{
    name: string;
    type: string;
    value: string;
    formatted: string;
  }>;
  payloadStatus: 'AVAILABLE' | 'UNAVAILABLE' | 'INCOMPLETE';
  payload?: UnsignedTransactionPayload;
  unavailabilityReason?: string;
  risksAndConstraints: string[];
}

export type ReceiverValidationStatus = 'VALID' | 'MISSING' | 'INVALID_ZERO_ADDRESS' | 'INVALID_FORMAT';

export interface AddressValidationResult {
  isValid: boolean;
  status: ReceiverValidationStatus;
  normalizedAddress?: string;
  error?: string;
}

export interface TransactionReviewReport {
  timestamp: number;
  strategyId: string;
  strategyName: string;
  actionSummary: string;
  estimatedGasCostWei: string;
  estimatedGasCostPros: string;
  gasPriceGwei: string;
  receiverStatus: ReceiverValidationStatus;
  receiverAddress?: string;
  isReadyForExternalReview: boolean;
  steps: TransactionStepReview[];
  safetyNotice: {
    isNonCustodial: true;
    canSign: false;
    canBroadcast: false;
    disclaimer: string;
  };
}

export class TransactionReviewer {
  /**
   * Validates a recipient EVM address for chain compatibility (Chain ID 1672)
   * Rejects missing, malformed, and zero addresses.
   */
  public static validateReceiverAddress(address?: string): AddressValidationResult {
    if (address === undefined || address === null || typeof address !== 'string' || address.trim() === '') {
      return {
        isValid: false,
        status: 'MISSING',
        error: 'Receiver address was not provided.',
      };
    }

    const trimmed = address.trim();

    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return {
        isValid: false,
        status: 'INVALID_FORMAT',
        error: 'Invalid address syntax: must be 0x followed by exactly 40 hexadecimal characters.',
      };
    }

    if (/^0x0{40}$/i.test(trimmed)) {
      return {
        isValid: false,
        status: 'INVALID_ZERO_ADDRESS',
        error: 'Zero address (0x0000...0000) is rejected as a receiver. Cannot mint shares to address(0).',
      };
    }

    return {
      isValid: true,
      status: 'VALID',
      normalizedAddress: trimmed,
    };
  }

  /**
   * Left-pads a 20-byte address to a 32-byte EVM ABI word
   */
  public static encodeAddressParam(address: string): string {
    const clean = address.toLowerCase().replace(/^0x/, '');
    if (clean.length !== 40 || !/^[a-f0-9]{40}$/.test(clean)) {
      throw new Error(`Invalid address length: expected 40 hex chars, got ${clean.length}`);
    }
    return clean.padStart(64, '0');
  }

  /**
   * Left-pads a uint256 BigInt to a 32-byte EVM ABI word
   */
  public static encodeUint256Param(value: bigint): string {
    if (value < 0n) {
      throw new Error('uint256 cannot be negative');
    }
    return value.toString(16).padStart(64, '0');
  }

  /**
   * Generates a non-custodial transaction review for a given strategy and scenario.
   */
  public static generateReview(params: {
    strategyId: string;
    amountPros: number;
    userAddress?: string;
    gasPriceWei?: bigint;
    observedBlockNumber?: number;
    observedBlockTimestamp?: number;
  }): TransactionReviewReport {
    const { strategyId, amountPros, userAddress } = params;
    const gasPriceWei = params.gasPriceWei ?? 10_000_000_000n; // 10 Gwei default
    const gasPriceGwei = (Number(gasPriceWei) / 1e9).toFixed(2);
    const amountWei = decimalToWei(amountPros);

    if (strategyId === 'faroo-patient-staking') {
      return this.reviewFarooStaking(amountPros, amountWei, userAddress, gasPriceWei, gasPriceGwei);
    }

    if (strategyId === 'faroo-instant-dex') {
      return this.reviewFarooInstantDex(amountPros, amountWei, userAddress, gasPriceWei, gasPriceGwei);
    }

    if (strategyId === 'axil-prime-credit' || strategyId === 'axil-prime-credit-3m' || strategyId === 'axil-apc3m') {
      return this.reviewAxilExcluded(amountPros);
    }

    if (strategyId === 'native-pros-consensus' || strategyId === 'native-pos-consensus') {
      return this.reviewNativePoSExcluded(amountPros);
    }

    throw new Error(`Unsupported strategy ID for transaction review: ${strategyId}`);
  }

  /**
   * Faroo Liquid Staking review:
   * Faroo stPROS is an ERC-4626 vault with underlying asset WPROS.
   * Step 1: Wrap native PROS into WPROS (payable deposit).
   * Step 2: Approve Faroo stPROS vault to spend WPROS.
   * Step 3: Call deposit(uint256 assets, address receiver) on Faroo vault.
   */
  private static reviewFarooStaking(
    amountPros: number,
    amountWei: bigint,
    userAddress: string | undefined,
    gasPriceWei: bigint,
    gasPriceGwei: string
  ): TransactionReviewReport {
    const validation = this.validateReceiverAddress(userAddress);
    const totalGasLimit = 180_000n; // 45k wrap + 45k approve + 90k vault deposit
    const gasCostWei = totalGasLimit * gasPriceWei;
    const gasCostPros = (Number(gasCostWei) / 1e18).toFixed(6);

    const step3Parameters = [
      {
        name: 'assets',
        type: 'uint256',
        value: amountWei.toString(),
        formatted: `${amountPros.toLocaleString()} WPROS`,
      },
      {
        name: 'receiver',
        type: 'address',
        value: validation.isValid ? validation.normalizedAddress! : (userAddress || ''),
        formatted: validation.isValid
          ? validation.normalizedAddress!
          : validation.status === 'MISSING'
            ? 'NOT SET (Action Required: Provide your Pacific Mainnet address)'
            : validation.status === 'INVALID_ZERO_ADDRESS'
              ? 'REJECTED: 0x0000...0000 (Zero address placeholder rejected)'
              : `REJECTED: ${userAddress} (Malformed address syntax)`,
      },
    ];

    const step3Risks: string[] = [
      'Mandatory unbonding delay: Contract on-chain parameter unbondingPeriod = 86,400s (1 day); protocol unbonding queue may take up to 14 days.',
      'Yield compounds into exchange rate (stPROS/PROS increases over time). Token quantity in wallet remains constant.',
    ];

    if (!validation.isValid) {
      if (validation.status === 'INVALID_ZERO_ADDRESS' || validation.status === 'MISSING') {
        step3Risks.push('ACTION REQUIRED: Receiver parameter is currently set to placeholder address (0x0000...0000) or missing. You MUST replace this parameter with your external wallet address in your Web3 wallet or script so minted stPROS shares are delivered to your account.');
      } else {
        step3Risks.push(`ACTION REQUIRED: Receiver address is malformed (${validation.error}). Receiver-dependent calldata cannot be prepared or exported.`);
      }
    }

    const step3Review: TransactionStepReview = {
      stepNumber: 3,
      title: 'Deposit WPROS into Faroo Liquid Staking Vault',
      contractName: 'Faroo Liquid Staked PROS (stPROS)',
      contractAddress: CANONICAL_CONTRACTS.FAROO_STPROS,
      methodName: 'deposit(uint256,address)',
      selector: '0x6e553f65',
      isAbiVerified: true,
      explanation: 'Deposits WPROS into the Faroo ERC-4626 vault and mints yield-bearing stPROS shares to the recipient address.',
      parameters: step3Parameters,
      payloadStatus: validation.isValid ? 'AVAILABLE' : 'INCOMPLETE',
      payload: validation.isValid
        ? {
            to: CANONICAL_CONTRACTS.FAROO_STPROS,
            data: `0x6e553f65${this.encodeUint256Param(amountWei)}${this.encodeAddressParam(validation.normalizedAddress!)}`,
            value: '0x0',
            gasLimit: '0x15f90', // 90,000
            maxFeePerGas: `0x${gasPriceWei.toString(16)}`,
            maxPriorityFeePerGas: `0x${gasPriceWei.toString(16)}`,
            chainId: NETWORK_CONFIG.chainId,
          }
        : undefined,
      unavailabilityReason: validation.isValid
        ? undefined
        : validation.status === 'MISSING'
          ? 'CALLDATA_INCOMPLETE: Receiver address was not provided. A valid non-zero Pacific Mainnet recipient address is required before receiver-dependent calldata can be generated or exported.'
          : validation.status === 'INVALID_ZERO_ADDRESS'
            ? 'CALLDATA_INCOMPLETE: Zero address (0x0000...0000) is rejected as a receiver. Cannot mint shares to null address.'
            : `CALLDATA_INCOMPLETE: Malformed receiver address syntax (${validation.error}). Expected 0x followed by 40 hex characters.`,
      risksAndConstraints: step3Risks,
    };

    const steps: TransactionStepReview[] = [
      {
        stepNumber: 1,
        title: 'Wrap Native PROS into WPROS',
        contractName: 'Canonical Wrapped PROS (WPROS)',
        contractAddress: CANONICAL_CONTRACTS.CANONICAL_WPROS,
        methodName: 'deposit()',
        selector: '0xd0e30db0',
        isAbiVerified: true,
        explanation: 'Converts native PROS into ERC-20 compliant WPROS at a 1:1 ratio. Required because the Faroo vault accepts WPROS as its underlying asset.',
        parameters: [],
        payloadStatus: 'AVAILABLE',
        payload: {
          to: CANONICAL_CONTRACTS.CANONICAL_WPROS,
          data: '0xd0e30db0',
          value: `0x${amountWei.toString(16)}`,
          gasLimit: '0xafc8', // 45,000
          maxFeePerGas: `0x${gasPriceWei.toString(16)}`,
          maxPriorityFeePerGas: `0x${gasPriceWei.toString(16)}`,
          chainId: NETWORK_CONFIG.chainId,
        },
        risksAndConstraints: [
          'Requires native PROS balance equal to principal plus transaction gas.',
          'WPROS is non-rebasing and 1:1 exchangeable for native PROS.',
        ],
      },
      {
        stepNumber: 2,
        title: 'Approve Faroo Vault for WPROS',
        contractName: 'Canonical Wrapped PROS (WPROS)',
        contractAddress: CANONICAL_CONTRACTS.CANONICAL_WPROS,
        methodName: 'approve(address,uint256)',
        selector: '0x095ea7b3',
        isAbiVerified: true,
        explanation: 'Grants the Faroo stPROS vault smart contract permission to pull the specified amount of WPROS.',
        parameters: [
          {
            name: 'spender',
            type: 'address',
            value: CANONICAL_CONTRACTS.FAROO_STPROS,
            formatted: `Faroo Vault (${CANONICAL_CONTRACTS.FAROO_STPROS.slice(0, 8)}...)`,
          },
          {
            name: 'amount',
            type: 'uint256',
            value: amountWei.toString(),
            formatted: `${amountPros.toLocaleString()} WPROS (${amountWei.toString()} wei)`,
          },
        ],
        payloadStatus: 'AVAILABLE',
        payload: {
          to: CANONICAL_CONTRACTS.CANONICAL_WPROS,
          data: `0x095ea7b3${this.encodeAddressParam(CANONICAL_CONTRACTS.FAROO_STPROS)}${this.encodeUint256Param(amountWei)}`,
          value: '0x0',
          gasLimit: '0xafc8', // 45,000
          maxFeePerGas: `0x${gasPriceWei.toString(16)}`,
          maxPriorityFeePerGas: `0x${gasPriceWei.toString(16)}`,
          chainId: NETWORK_CONFIG.chainId,
        },
        risksAndConstraints: [
          'Standard ERC-20 approval pattern. Recommended to approve exact amount only to minimize allowance risk.',
        ],
      },
      step3Review,
    ];

    return {
      timestamp: Date.now(),
      strategyId: 'faroo-patient-staking',
      strategyName: 'Faroo Liquid Staking (stPROS) - Patient Exit',
      actionSummary: `Deposit ${amountPros.toLocaleString()} PROS into Faroo stPROS vault to earn compounding PoS yield with patient 14-day unbonding exit.`,
      estimatedGasCostWei: gasCostWei.toString(),
      estimatedGasCostPros: gasCostPros,
      gasPriceGwei,
      receiverStatus: validation.status,
      receiverAddress: validation.isValid ? validation.normalizedAddress : undefined,
      isReadyForExternalReview: validation.isValid,
      steps,
      safetyNotice: {
        isNonCustodial: true,
        canSign: false,
        canBroadcast: false,
        disclaimer: 'This transaction review provides unsigned calldata for external inspection only. The agent does not hold private keys, cannot sign, and cannot broadcast transactions. You must review and execute using your external wallet.',
      },
    };
  }

  /**
   * Faroo Instant DEX review:
   * Staking is identical to Faroo Patient Staking, but the exit pathway is designated as AMM swap.
   */
  private static reviewFarooInstantDex(
    amountPros: number,
    amountWei: bigint,
    userAddress: string | undefined,
    gasPriceWei: bigint,
    gasPriceGwei: string
  ): TransactionReviewReport {
    const report = this.reviewFarooStaking(amountPros, amountWei, userAddress, gasPriceWei, gasPriceGwei);
    report.strategyId = 'faroo-instant-dex';
    report.strategyName = 'Faroo Liquid Staking (stPROS) - Instant DEX Exit';
    report.actionSummary = `Deposit ${amountPros.toLocaleString()} PROS into Faroo stPROS vault, targeting exit via DEX liquidity pool for instant liquidity (0.30% fee + slippage).`;

    // Add note to step 3 regarding exit difference
    report.steps[2].risksAndConstraints.push(
      'Exit Route: Instant exit will swap stPROS back to PROS on Pharos DEX rather than waiting in the unbonding queue. Subject to 0.30% swap fee and market liquidity slippage.'
    );

    return report;
  }

  /**
   * Axil Prime Credit review:
   * Excluded because it is an off-chain target USD vault, not an on-chain PROS yield source.
   * Transaction payload is strictly UNAVAILABLE to prevent misleading calldata.
   */
  private static reviewAxilExcluded(_amountPros: number): TransactionReviewReport {
    return {
      timestamp: Date.now(),
      strategyId: 'axil-prime-credit',
      strategyName: 'Axil Prime Credit 3M (APC3M)',
      actionSummary: 'Transaction preparation is DISABLED for Axil Prime Credit.',
      estimatedGasCostWei: '0',
      estimatedGasCostPros: '0.000000',
      gasPriceGwei: '0.00',
      receiverStatus: 'MISSING',
      isReadyForExternalReview: false,
      steps: [
        {
          stepNumber: 1,
          title: 'Deposit Excluded',
          contractName: 'Axil Prime Credit Vault',
          contractAddress: CANONICAL_CONTRACTS.AXIL_CORE_VAULT,
          methodName: 'UNAVAILABLE',
          selector: '0x00000000',
          isAbiVerified: false,
          explanation: 'Axil Prime Credit is a private-credit RWA vault accepting USDC (USD pegged), with an off-chain target APY (8.00%). It is disqualified from automated PROS rebalancing.',
          parameters: [],
          payloadStatus: 'UNAVAILABLE',
          unavailabilityReason: 'TRANSACTION_PAYLOAD_UNAVAILABLE: Axil is an off-chain target USD credit product. The agent strictly refuses to prepare rebalance transactions for non-qualifying or cross-asset target rates.',
          risksAndConstraints: [
            'Requires converting native PROS to USDC via secondary AMM (double swap friction).',
            'Subject to 3-month fixed lockup and off-chain borrower credit risk.',
            'Target 8.00% APY is not an on-chain smart contract accrual mechanism.',
          ],
        },
      ],
      safetyNotice: {
        isNonCustodial: true,
        canSign: false,
        canBroadcast: false,
        disclaimer: 'Transaction preparation is unavailable for disqualified sources. The agent does not fabricate transaction calldata.',
      },
    };
  }

  /**
   * Native PoS Consensus review:
   * Excluded because no delegatable validator contract exists on Pacific Mainnet.
   */
  private static reviewNativePoSExcluded(_amountPros: number): TransactionReviewReport {
    return {
      timestamp: Date.now(),
      strategyId: 'native-pros-consensus',
      strategyName: 'Native PoS Consensus Validator Staking',
      actionSummary: 'Transaction preparation is DISABLED for Native PoS Staking.',
      estimatedGasCostWei: '0',
      estimatedGasCostPros: '0.000000',
      gasPriceGwei: '0.00',
      receiverStatus: 'MISSING',
      isReadyForExternalReview: false,
      steps: [
        {
          stepNumber: 1,
          title: 'Delegation Excluded',
          contractName: 'Pharos Consensus Staking',
          contractAddress: '0x0000000000000000000000000000000000000000',
          methodName: 'UNAVAILABLE',
          selector: '0x00000000',
          isAbiVerified: false,
          explanation: 'No public validator delegation contract or permissionless delegation method exists on Pharos Pacific Mainnet.',
          parameters: [],
          payloadStatus: 'UNAVAILABLE',
          unavailabilityReason: 'TRANSACTION_PAYLOAD_UNAVAILABLE: Pharos Pacific Mainnet lacks a public delegation registry contract. Users cannot delegate native PROS to individual validators on-chain without running a validator node.',
          risksAndConstraints: [
            'Requires running a dedicated validator node hardware setup with 32,000+ PROS self-stake.',
            'Cannot be performed via standard EVM user wallet transaction.',
          ],
        },
      ],
      safetyNotice: {
        isNonCustodial: true,
        canSign: false,
        canBroadcast: false,
        disclaimer: 'Transaction preparation is unavailable for non-delegatable mechanisms.',
      },
    };
  }
}
