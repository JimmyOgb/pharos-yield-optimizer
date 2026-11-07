/**
 * Core Type Definitions for Pharos Yield Optimizer
 * Chain: Pharos Pacific Mainnet (Chain ID 1672)
 * Native Asset: PROS (18 decimals)
 */

export const CHAIN_ID = 1672 as const;
export const CHAIN_NAME = 'Pharos Pacific Mainnet' as const;
export const NATIVE_SYMBOL = 'PROS' as const;
export const NATIVE_DECIMALS = 18 as const;

export const CANONICAL_CONTRACTS = {
  FAROO_STPROS: '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4',
  FAROO_IMPLEMENTATION: '0xfd59860894e01773e9780b0d1dfae4ca2b56708d',
  CANONICAL_WPROS: '0x52C48d4213107b20bC583832b0d951FB9CA8F0B0',
  AXIL_CORE_VAULT: '0xD0428799FbC35557834d33121BA4472692c8908a',
  AXIL_APC3M_TOKEN: '0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0',
  DEX_POOL_MANAGER: '0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550',
  DEX_STATE_VIEW: '0x616434e941c5E53d44894bF9ca13D517927BF8aF',
  NATIVE_POS_PRECOMPILE: '0x4100000000000000000000000000000000000000',
  FAROSWAP_V3_POOL: '0x4146d192da6428c9e1c243d2a953c625b5765623',
  FAROSWAP_V3_FACTORY: '0x2c90CcB0b989afA2433F499698451a25744A552b',
  USDC_TOKEN: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815',
} as const;

export const FORWARD_SCENARIO_ASSUMPTION_850_BPS = 850 as const; // 8.50% APR conservative forward scenario
export const FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS = 626 as const; // 6.26% APR full-range LP benchmark
export const MEANINGFUL_ALPHA_THRESHOLD_WEI = 100_000_000_000_000_000n; // 0.10 PROS (SCALE_18 / 10n) BigInt threshold

export const NATIVE_POS_RISK_DISCLOSURE =
  'No ERC-4626 wrapper or third-party staking-contract exposure; native protocol, precompile implementation, consensus, and validator-related risks remain.' as const;

export const FAROO_LOCKUP_NOTICE =
  'Requires 14-day protocol unbonding queue plus 1-day settlement safety buffer (15 days total). Ineligible for horizons of 14 days or less.' as const;

export const NETWORK_CONFIG = {
  chainId: 1672,
  name: 'Pharos Pacific Mainnet',
  nativeCurrency: { name: 'Pharos PROS', symbol: 'PROS', decimals: 18 },
  rpcUrl: 'https://rpc.pharos.xyz',
} as const;

/**
 * Strict Provenance Status Taxonomy as defined in Gate 2
 */
export type ProvenanceStatus =
  | 'VERIFIED_ONCHAIN'          // Live dynamic rate queryable on-chain via JSON-RPC
  | 'OFFICIAL_DOCUMENTATION'    // Documented consensus parameter or whitepaper specification
  | 'OFFCHAIN_TARGET_RATE'      // Advertised or contractual target rate from protocol materials
  | 'EXECUTION_ALTERNATIVE'     // Transactional liquidity/exit pathway for an existing position
  | 'BASELINE_ONLY'             // 0.00% reference benchmark holding
  | 'ESTIMATED'                 // Heuristic or empirical model (e.g. gas units, slippage curve)
  | 'UNVERIFIED_CANDIDATE'      // Mechanism exists on-chain but rate unqueryable via public RPC
  | 'UNAVAILABLE'               // Query failed or no data interface exists
  | 'STALE';                    // Cached data exceeded maximum freshness window (> 10m)

/**
 * Common Yield Qualification Taxonomy for Three-Source Model
 */
export type YieldQualificationStatus =
  | 'FULLY_QUALIFIED'           // Genuine single-asset source backed by live on-chain data
  | 'QUALIFIED_WITH_DISCLOSURE' // Dual-asset / LP source requiring explicit structural risk disclosures
  | 'LIVE_INFORMATIONAL'        // Valid on-chain reference source not open for permissionless retail entry
  | 'NOT_AVAILABLE_FOR_ENTRY'   // Source where retail entry method is restricted or unavailable
  | 'UNAVAILABLE'               // On-chain contract query failed or endpoint down
  | 'STALE'                     // Observation timestamp exceeds 10m maximum staleness threshold
  | 'ERROR';                    // Decoding, RPC malformed response or invariant failure

/**
 * Operational Classification for Source Actionability
 */
export type SourceOperationalStatus =
  | 'ACTIONABLE_VERIFIED'       // Open for verified single-asset user rebalancing
  | 'LIVE_INFORMATIONAL'        // Informational benchmark only; automated MOVE disabled
  | 'NOT_AVAILABLE_FOR_ENTRY'   // Direct retail entry not available or restricted
  | 'UNAVAILABLE'               // Query failed or unqueryable
  | 'STALE';                    // Data exceeded freshness window

/**
 * Supported Strategy Identifiers (Recommendation Engine Scope)
 */
export type StrategyId =
  | 'faroo-patient-staking'     // Faroo stPROS (14-day protocol unbonding queue)
  | 'faroo-instant-dex'         // Faroo stPROS (Instant AMM DEX exit)
  | 'axil-prime-credit-3m'      // Axil APC3M Vault (USDC Institutional Private Credit)
  | 'native-pros-baseline';     // Unstaked PROS / WPROS Holding (0.00% benchmark)

/**
 * Normalized Yield Source Identifiers (Three-Source Architecture Scope)
 */
export type NormalizedSourceId =
  | 'faroo-stpros'              // Faroo Liquid Staking (0x6b0A...5Ec4)
  | 'native-pos-staking'        // Native PoS Consensus Staking (0x4100...0000)
  | 'faroswap-wpros-usdc-lp';   // FaroSwap Uniswap V3 LP (0x4146...5623)

/**
 * Normalized Yield Source Entity for Common Registry
 */
export interface NormalizedYieldSource {
  readonly id: NormalizedSourceId;
  readonly name: string;
  readonly protocol: string;
  readonly category: 'LIQUID_STAKING' | 'NATIVE_CONSENSUS' | 'AMM_LIQUIDITY' | 'PRIVATE_CREDIT' | 'UNSTAKED_BENCHMARK';
  readonly network: string;
  readonly chainId: number;
  readonly contractAddress: string;
  readonly denomination: AssetSymbol | 'WPROS_USDC_LP';
  readonly qualificationStatus: YieldQualificationStatus;
  readonly operationalStatus?: SourceOperationalStatus;
  readonly provenance: ProvenanceStatus;

  // Provenance and Freshness Stamps
  readonly observationTimestamp: number;
  readonly blockNumber: number;
  readonly blockTimestamp: number;
  readonly isFresh: boolean;
  readonly stalenessSeconds: number;

  // Live Observed On-Chain State
  readonly rawObservations: Readonly<Record<string, unknown>>;
  readonly decodedState: Readonly<Record<string, unknown>>;

  // Historical Realized Trailing Return (strictly separated from forward assumptions)
  readonly historicalRealizedApr?: {
    readonly aprPercentage: number;
    readonly aprBps: number;
    readonly observationWindowSeconds: number;
    readonly startBlock?: number;
    readonly endBlock?: number;
    readonly isShortObservationWarning: boolean;
    readonly warningNotice?: string;
  };

  // Conservative Forward Scenario Assumption (strictly typed scenario field)
  readonly forwardScenarioAssumption?: {
    readonly scenarioName: string;
    readonly scenarioRateBps: number;
    readonly scenarioRatePercentage: number;
    readonly provenanceNotice: string;
  };

  // Lockup and Settlement Requirements
  readonly lockupRequirements: {
    readonly lockupDays: number;
    readonly settlementBufferDays: number;
    readonly totalSettlementDays: number;
    readonly isHardEligibilityConstraint: boolean;
    readonly minHoldingDaysForActionable: number;
  };

  // Friction and Execution Profile
  readonly frictionProfile: {
    readonly entryGasUnits: number;
    readonly exitGasUnits: number;
    readonly entryFeeBps: number;
    readonly exitFeeBps: number;
    readonly swapFeeBps?: number;
    readonly isExecutionFrictionVerified: boolean;
  };

  // Risk Disclosures and Actionability
  readonly riskDisclosures: readonly string[];
  readonly isActionableRecommendationDestination: boolean;
  readonly unavailableReason?: string;
}

/**
 * Asset Denominations
 */
export type AssetSymbol = 'PROS' | 'WPROS' | 'USDC';

/**
 * Exchange Rate Observation Snapshot
 */
export interface ExchangeRateObservation {
  readonly protocolId: 'faroo-stpros';
  readonly contractAddress: string;
  readonly totalPooledAssetsWei: bigint;
  readonly totalSupplyWei: bigint;
  readonly spotRateScaled: bigint; // Scaled by 1e18 (e.g. 1.00491704e18)
  readonly spotRateDecimal: number;
  readonly blockNumber: number;
  readonly blockTimestamp: number; // Unix timestamp in seconds
  readonly provenance: ProvenanceStatus;
}

/**
 * Historical Observation Delta
 */
export interface HistoricalRateDelta {
  readonly observationStart: ExchangeRateObservation;
  readonly observationEnd: ExchangeRateObservation;
  readonly deltaRateScaled: bigint;
  readonly realizedGainPercentage: number;
  readonly elapsedSeconds: number;
  readonly trailingAnnualizedRateBps: number;
  readonly isShortObservationWarning: boolean;
  readonly warningNotice?: string;
}

/**
 * Cost & Friction Model Input
 */
export interface FrictionCalculationInput {
  readonly principalWei: bigint;
  readonly gasUnits: bigint;
  readonly gasPriceGwei: number;
  readonly entryFeeBps: number;
  readonly exitFeeBps: number;
  readonly swapFeeBps?: number;
  readonly slippageBps?: number;
  readonly isFeeVerified: boolean;
  readonly isGasVerified: boolean;
}

/**
 * Detailed Cost & Friction Breakdown
 */
export interface FrictionBreakdown {
  readonly gasCostWei: bigint;
  readonly entryFeeWei: bigint;
  readonly exitFeeWei: bigint;
  readonly swapFeeWei: bigint;
  readonly slippageCostWei: bigint;
  readonly totalFrictionWei: bigint;
  readonly totalFrictionPros: number;
  readonly provenance: ProvenanceStatus;
  readonly isComplete: boolean;
  readonly missingFields?: readonly string[];
}

/**
 * Strategy Parameter Profile
 */
export interface StrategyProfile {
  readonly id: StrategyId;
  readonly name: string;
  readonly denomination: AssetSymbol;
  readonly classification: ProvenanceStatus;
  readonly qualifiesTowardReq01: boolean; // Only 1 source strictly qualifies
  readonly contractAddress?: string;
  readonly lockupPeriodDays: number;
  readonly exitDelayDays: number;
  readonly exitFeeBps: number;
  readonly requiresKyc: boolean;
  readonly currencyRiskBadge?: string;
}

/**
 * Projection Analysis Result for a single Strategy
 */
export interface StrategyProjection {
  readonly profile: StrategyProfile;
  readonly principalWei: bigint;
  readonly horizonDays: number;
  readonly forwardRateBps: number; // Projected annual rate in basis points (e.g. 850 = 8.50%)
  readonly grossYieldWei: bigint;
  readonly grossYieldPros: number;
  readonly friction: FrictionBreakdown;
  readonly netGainWei: bigint;
  readonly netGainPros: number;
  readonly netGainPercentage: number;
  readonly breakEvenDays: number;
  readonly isLockupEligible: boolean;
  readonly isDataComplete: boolean;
  readonly riskDisclosures: readonly string[];
}

/**
 * Deterministic Recommendation Decision
 */
export type RecommendationDecision =
  | 'MOVE'
  | 'STAY_PUT'
  | 'INSUFFICIENT_DATA'
  | 'NOT_ELIGIBLE'
  | 'RISK_TOO_HIGH';

/**
 * Structured Recommendation Reason Code
 */
export type ReasonCode =
  | 'POSITIVE_NET_ALPHA'
  | 'FRICTION_EXCEEDS_GROSS_YIELD'
  | 'HORIZON_SHORTER_THAN_LOCKUP'
  | 'ALREADY_IN_OPTIMAL_POSITION'
  | 'STALE_OR_MISSING_ONCHAIN_DATA'
  | 'UNVERIFIED_TARGET_RATE_RESTRICTION'
  | 'CURRENCY_MISMATCH_EXCLUSION'
  | 'ZERO_PRINCIPAL_INPUT'
  | 'INVALID_OBSERVATION_INTERVAL'
  | 'TIE_NO_MEANINGFUL_ALPHA'
  | 'NO_VERIFIED_SECONDARY_LIQUIDITY';

/**
 * Comprehensive Optimizer Recommendation Output
 */
export interface OptimizerRecommendation {
  readonly decision: RecommendationDecision;
  readonly reasonCode: ReasonCode;
  readonly explanation: string;
  readonly targetStrategyId?: StrategyId;
  readonly netAdvantageWei: bigint;
  readonly netAdvantagePros: number;
  readonly breakEvenDays: number;
  readonly selectedHorizonDays: number;
  readonly verifiedQualifyingSourcesCount: 1; // Strict invariant
  readonly comparisons: readonly StrategyProjection[];
  readonly timestamp: number;
}

/**
 * User Query Input
 */
export interface OptimizerQueryInput {
  readonly principalWei: bigint;
  readonly asset: AssetSymbol;
  readonly horizonDays: number;
  readonly requireInstantLiquidity: boolean;
  readonly currentStrategyId?: StrategyId;
}
