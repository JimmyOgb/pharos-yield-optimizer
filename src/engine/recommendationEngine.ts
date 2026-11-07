/**
 * Deterministic Recommendation Engine
 * Pharos Pacific Mainnet (Chain ID 1672)
 * 
 * Compares net economic outcomes after all transaction friction, lockup periods,
 * and evidence provenance checks. Never recommends an action based solely on headline APY.
 */

import {
  type OptimizerQueryInput,
  type OptimizerRecommendation,
  type StrategyId,
  type StrategyProfile,
  type StrategyProjection,
  type ReasonCode,
  CANONICAL_CONTRACTS,
} from '../types/index.ts';
import {
  calculateGrossProjectedYield,
  calculateBreakEvenDays,
  scaledToDecimal,
} from './yieldMath.ts';
import { evaluateStrategyFriction } from './frictionModel.ts';

// Canonical Strategy Registry for Pharos Pacific Mainnet
export const STRATEGY_PROFILES: Record<StrategyId, StrategyProfile> = {
  'faroo-patient-staking': {
    id: 'faroo-patient-staking',
    name: 'Faroo Patient Staking (Queue)',
    denomination: 'PROS',
    classification: 'VERIFIED_ONCHAIN',
    qualifiesTowardReq01: true, // Sole strictly qualifying on-chain source
    contractAddress: '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4',
    lockupPeriodDays: 14,
    exitDelayDays: 14,
    exitFeeBps: 0,
    requiresKyc: false,
  },
  'faroo-instant-dex': {
    id: 'faroo-instant-dex',
    name: 'Faroo Liquid DEX Staking (Instant Swap)',
    denomination: 'PROS',
    classification: 'EXECUTION_ALTERNATIVE',
    qualifiesTowardReq01: false, // Execution alternative only
    contractAddress: '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4',
    lockupPeriodDays: 0,
    exitDelayDays: 0,
    exitFeeBps: 30, // 0.30% DEX swap pool fee
    requiresKyc: false,
  },
  'axil-prime-credit-3m': {
    id: 'axil-prime-credit-3m',
    name: 'Axil Prime Credit 3M Vault',
    denomination: 'USDC',
    classification: 'OFFCHAIN_TARGET_RATE',
    qualifiesTowardReq01: false, // Off-chain target rate in USDC
    contractAddress: '0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0',
    lockupPeriodDays: 90,
    exitDelayDays: 90,
    exitFeeBps: 0,
    requiresKyc: true,
    currencyRiskBadge: 'CURRENCY_MISMATCH_RISK (USDC vs PROS)',
  },
  'native-pros-baseline': {
    id: 'native-pros-baseline',
    name: 'Native PROS / WPROS Holding',
    denomination: 'PROS',
    classification: 'BASELINE_ONLY',
    qualifiesTowardReq01: false, // 0.00% Benchmark
    contractAddress: CANONICAL_CONTRACTS.CANONICAL_WPROS,
    lockupPeriodDays: 0,
    exitDelayDays: 0,
    exitFeeBps: 0,
    requiresKyc: false,
  },
};

// Illustrative Scenario Rates (in basis points: 100 bps = 1.00%)
// IMPORTANT: These are model inputs for scenario calculations, NOT verified current or forward APYs.
// 8.50% is a configured fallback assumption used to calculate projected gross yield.
// Actual yield may differ. Live on-chain exchange-rate accrual is used where available.
export const FORWARD_RATES_BPS: Record<StrategyId, number> = {
  'faroo-patient-staking': 850, // 8.50% illustrative annualized scenario assumption (model input only)
  'faroo-instant-dex': 850,     // 8.50% illustrative annualized scenario assumption (friction applied in exit)
  'axil-prime-credit-3m': 925,  // 9.25% off-chain contractual target
  'native-pros-baseline': 0,    // 0.00% baseline
};

/**
 * Evaluates individual strategy projection
 */
export function evaluateStrategyProjection(
  strategyId: StrategyId,
  principalWei: bigint,
  horizonDays: number,
  gasPriceGwei: number
): StrategyProjection {
  const profile = STRATEGY_PROFILES[strategyId];
  const forwardRateBps = FORWARD_RATES_BPS[strategyId];
  const grossYieldWei = calculateGrossProjectedYield(principalWei, forwardRateBps, horizonDays);
  const friction = evaluateStrategyFriction(strategyId, principalWei, gasPriceGwei);

  // Net Gain = Gross Yield - Total Friction (floor at negative if friction exceeds yield)
  const isLoss = friction.totalFrictionWei > grossYieldWei;
  const netGainWei = isLoss ? -(friction.totalFrictionWei - grossYieldWei) : grossYieldWei - friction.totalFrictionWei;
  const netGainPros = scaledToDecimal(netGainWei);
  const principalPros = scaledToDecimal(principalWei);
  const netGainPercentage = principalPros > 0 ? (netGainPros / principalPros) * 100 : 0;
  const breakEvenDays = calculateBreakEvenDays(friction.totalFrictionWei, principalWei, forwardRateBps);

  const isLockupEligible = horizonDays >= profile.lockupPeriodDays;
  const riskDisclosures: string[] = [];

  if (profile.lockupPeriodDays > 0) {
    riskDisclosures.push(`Mandatory ${profile.lockupPeriodDays}-day lockup / unbonding delay`);
  }
  if (profile.currencyRiskBadge) {
    riskDisclosures.push(profile.currencyRiskBadge);
  }
  if (profile.classification === 'OFFCHAIN_TARGET_RATE') {
    riskDisclosures.push('Rate is an off-chain target; not queryable dynamically on-chain');
  }

  return {
    profile,
    principalWei,
    horizonDays,
    forwardRateBps,
    grossYieldWei,
    grossYieldPros: scaledToDecimal(grossYieldWei),
    friction,
    netGainWei,
    netGainPros,
    netGainPercentage,
    breakEvenDays,
    isLockupEligible,
    isDataComplete: true,
    riskDisclosures,
  };
}

/**
 * Main Deterministic Recommendation Engine
 */
export function generateRecommendation(
  query: OptimizerQueryInput,
  gasPriceGwei = 1.25,
  isDataStale = false,
  isDataUnavailable = false
): OptimizerRecommendation {
  const currentStrategyId = query.currentStrategyId ?? 'native-pros-baseline';
  const timestamp = Math.floor(Date.now() / 1000);

  // Safeguard 1: Reject stale or unavailable on-chain data
  if (isDataUnavailable || isDataStale) {
    return {
      decision: 'INSUFFICIENT_DATA',
      reasonCode: 'STALE_OR_MISSING_ONCHAIN_DATA',
      explanation: isDataUnavailable
        ? 'Cannot evaluate recommendation: critical on-chain RPC data is unavailable.'
        : 'Cannot evaluate recommendation: cached on-chain state is stale (> 10 minutes old). Refresh required.',
      netAdvantageWei: 0n,
      netAdvantagePros: 0,
      breakEvenDays: 0,
      selectedHorizonDays: query.horizonDays,
      verifiedQualifyingSourcesCount: 1,
      comparisons: [],
      timestamp,
    };
  }

  // Safeguard 2: Zero or negative principal input
  if (query.principalWei <= 0n) {
    return {
      decision: 'STAY_PUT',
      reasonCode: 'ZERO_PRINCIPAL_INPUT',
      explanation: 'Principal amount must be strictly greater than zero to calculate yield rebalancing.',
      netAdvantageWei: 0n,
      netAdvantagePros: 0,
      breakEvenDays: 0,
      selectedHorizonDays: query.horizonDays,
      verifiedQualifyingSourcesCount: 1,
      comparisons: [],
      timestamp,
    };
  }

  // Evaluate all strategies
  const strategyIds: StrategyId[] = [
    'faroo-patient-staking',
    'faroo-instant-dex',
    'axil-prime-credit-3m',
    'native-pros-baseline',
  ];

  const comparisons = strategyIds.map((id) =>
    evaluateStrategyProjection(id, query.principalWei, query.horizonDays, gasPriceGwei)
  );

  const currentProjection = comparisons.find((c) => c.profile.id === currentStrategyId)!;

  // Safeguard 3: Candidate Eligibility Filtering
  // If user requests instant liquidity, Faroo Patient Staking (14d lock) is excluded
  // Axil is excluded from automated PROS rebalance due to foreign denomination and off-chain target rate
  const eligibleCandidates = comparisons.filter((c) => {
    if (c.profile.id === currentStrategyId) return false;
    if (c.profile.id === 'native-pros-baseline') return false; // Baseline benchmark is not a yield destination
    if (c.profile.id === 'axil-prime-credit-3m') return false; // Strictly excluded from automated PROS rebalance
    if (query.requireInstantLiquidity && c.profile.lockupPeriodDays > 0) return false;
    if (!c.isLockupEligible) return false; // Horizon < lockup period
    return true;
  });

  // If no candidates are eligible due to duration or liquidity
  if (eligibleCandidates.length === 0) {
    const isHorizonConstrained =
      currentStrategyId === 'native-pros-baseline' &&
      comparisons.some((c) => c.profile.id !== currentStrategyId && !c.isLockupEligible);

    return {
      decision: 'STAY_PUT',
      reasonCode: isHorizonConstrained ? 'HORIZON_SHORTER_THAN_LOCKUP' : 'ALREADY_IN_OPTIMAL_POSITION',
      explanation: isHorizonConstrained
        ? `Investment horizon (${query.horizonDays} days) is shorter than mandatory protocol lockup/unbonding periods (14 days).`
        : 'Currently held position remains optimal; no alternative satisfies current liquidity and horizon constraints.',
      netAdvantageWei: 0n,
      netAdvantagePros: 0,
      breakEvenDays: 0,
      selectedHorizonDays: query.horizonDays,
      verifiedQualifyingSourcesCount: 1,
      comparisons,
      timestamp,
    };
  }

  // Sort eligible candidates by net gain descending
  eligibleCandidates.sort((a, b) => (b.netGainWei > a.netGainWei ? 1 : -1));
  const bestCandidate = eligibleCandidates[0];

  const netAdvantageWei = bestCandidate.netGainWei - currentProjection.netGainWei;

  // Decision Rule: Must provide positive net advantage after all friction
  if (netAdvantageWei <= 0n) {
    // If user is already in a non-baseline strategy that outperforms all alternatives
    if (currentStrategyId !== 'native-pros-baseline') {
      return {
        decision: 'STAY_PUT',
        reasonCode: 'ALREADY_IN_OPTIMAL_POSITION',
        explanation: `Currently held position (${currentProjection.profile.name}) remains the optimal strategy. No alternative provides positive incremental net yield.`,
        netAdvantageWei: 0n,
        netAdvantagePros: 0,
        breakEvenDays: 0,
        selectedHorizonDays: query.horizonDays,
        verifiedQualifyingSourcesCount: 1,
        comparisons,
        timestamp,
      };
    }

    // If horizon was too short for the primary 0% fee queue (14-day lockup)
    const isHorizonTooShort = !query.requireInstantLiquidity && query.horizonDays < STRATEGY_PROFILES['faroo-patient-staking'].lockupPeriodDays;
    const reasonCode: ReasonCode = isHorizonTooShort ? 'HORIZON_SHORTER_THAN_LOCKUP' : 'FRICTION_EXCEEDS_GROSS_YIELD';
    const explanation = isHorizonTooShort
      ? `Investment horizon (${query.horizonDays} days) is shorter than mandatory protocol lockup (14 days) for Faroo Patient Staking, and alternative instant DEX liquidity friction exceeds gross yield.`
      : `Total transaction friction and exit costs exceed expected gross yield over ${query.horizonDays} days. Break-even requires ${bestCandidate.breakEvenDays} days.`;

    return {
      decision: 'STAY_PUT',
      reasonCode,
      explanation,
      netAdvantageWei: 0n,
      netAdvantagePros: 0,
      breakEvenDays: bestCandidate.breakEvenDays,
      selectedHorizonDays: query.horizonDays,
      verifiedQualifyingSourcesCount: 1,
      comparisons,
      timestamp,
    };
  }

  // Defensible positive alpha confirmed
  const netAdvantagePros = scaledToDecimal(netAdvantageWei);
  return {
    decision: 'MOVE',
    reasonCode: 'POSITIVE_NET_ALPHA',
    explanation: `Rebalancing to ${bestCandidate.profile.name} yields an estimated net gain of +${netAdvantagePros.toFixed(4)} PROS (+${bestCandidate.netGainPercentage.toFixed(2)}%) over ${query.horizonDays} days after all gas, protocol fees, and break-even friction (${bestCandidate.breakEvenDays} days).`,
    targetStrategyId: bestCandidate.profile.id,
    netAdvantageWei,
    netAdvantagePros,
    breakEvenDays: bestCandidate.breakEvenDays,
    selectedHorizonDays: query.horizonDays,
    verifiedQualifyingSourcesCount: 1,
    comparisons,
    timestamp,
  };
}
