/**
 * Yield Calculation Mathematics Engine
 * Pharos Pacific Mainnet (Chain ID 1672)
 * 
 * Implements high-precision integer and fixed-point decimal arithmetic (1e18 scale)
 * to avoid floating-point inaccuracies in financial accounting.
 */

export const SCALE_18 = 1_000_000_000_000_000_000n; // 10^18
export const BPS_SCALE = 10_000n;                    // 100% = 10,000 bps
export const SECONDS_PER_DAY = 86_400n;
export const SECONDS_PER_YEAR = 31_536_000n;         // 365 days
export const DAYS_PER_YEAR = 365n;

export const SHORT_OBSERVATION_THRESHOLD_SECONDS = 7 * 86_400; // 7 days

/**
 * Computes exact spot exchange rate scaled to 1e18
 * Rate R = totalPooledAssets / totalSupply
 */
export function computeExchangeRate(
  totalPooledAssetsWei: bigint,
  totalSupplyWei: bigint
): bigint {
  if (totalPooledAssetsWei <= 0n) {
    throw new Error('Invalid input: totalPooledAssetsWei must be strictly positive');
  }
  if (totalSupplyWei <= 0n) {
    throw new Error('Invalid input: totalSupplyWei must be strictly positive');
  }

  // Exact fixed-point calculation: (assets * 1e18) / supply
  return (totalPooledAssetsWei * SCALE_18) / totalSupplyWei;
}

/**
 * Converts a 1e18 scaled bigint to a human-readable JavaScript number
 */
export function scaledToDecimal(valueScaled: bigint, scale = SCALE_18): number {
  const integerPart = valueScaled / scale;
  const fractionalPart = valueScaled % scale;
  
  // Format fractional part with leading zeros
  const fracStr = fractionalPart.toString().padStart(18, '0');
  return Number(`${integerPart}.${fracStr}`);
}

/**
 * Converts a standard decimal number or string to a 1e18 scaled bigint
 */
export function decimalToWei(val: number | string): bigint {
  const str = typeof val === 'number' ? val.toFixed(18) : val;
  const [intPart, fracPart = ''] = str.split('.');
  const sanitizedFrac = fracPart.padEnd(18, '0').slice(0, 18);
  const sign = str.startsWith('-') ? -1n : 1n;
  const absInt = BigInt(intPart.replace('-', ''));
  return sign * (absInt * SCALE_18 + BigInt(sanitizedFrac));
}

/**
 * Computes the realized growth percentage between two historical exchange rates
 */
export function computeRealizedAccrual(
  rateStartScaled: bigint,
  rateEndScaled: bigint
): {
  realizedDeltaScaled: bigint;
  realizedGainBps: number;
  realizedGainPercentage: number;
} {
  if (rateStartScaled <= 0n) {
    throw new Error('Invalid input: rateStartScaled must be strictly positive');
  }
  if (rateEndScaled <= 0n) {
    throw new Error('Invalid input: rateEndScaled must be strictly positive');
  }

  const delta = rateEndScaled - rateStartScaled;
  // Scaled percentage: (delta * 10000) / rateStart
  const gainBpsBig = (delta * BPS_SCALE) / rateStartScaled;
  const realizedGainBps = Number(gainBpsBig);
  const realizedGainPercentage = realizedGainBps / 100;

  return {
    realizedDeltaScaled: delta,
    realizedGainBps,
    realizedGainPercentage,
  };
}

/**
 * Annualizes a trailing realized return over an elapsed observation period
 * Strictest Audit Guard: Attaches non-bypassable warning if period < 7 days
 */
export function annualizeTrailingRate(
  realizedDeltaScaled: bigint,
  rateStartScaled: bigint,
  elapsedSeconds: number
): {
  trailingAprBps: number;
  trailingAprPercentage: number;
  trailingAprFormatted: string;
  isShortObservationWarning: boolean;
  warningNotice?: string;
} {
  if (elapsedSeconds <= 0) {
    throw new Error('Invalid input: elapsedSeconds must be strictly positive');
  }
  if (rateStartScaled <= 0n) {
    throw new Error('Invalid input: rateStartScaled must be strictly positive');
  }

  const isShortObservationWarning = elapsedSeconds < SHORT_OBSERVATION_THRESHOLD_SECONDS;
  const warningNotice = isShortObservationWarning
    ? `Observation window (${(elapsedSeconds / 3600).toFixed(1)}h < 168h) reflects early episodic reward indexing. It is NOT a sustainable forward APY.`
    : undefined;

  // Annualized Bps = (delta * 10000 * 31536000) / (rateStart * elapsedSeconds)
  const numerator = realizedDeltaScaled * BPS_SCALE * SECONDS_PER_YEAR;
  const denominator = rateStartScaled * BigInt(Math.floor(elapsedSeconds));
  const trailingAprBps = Number(numerator / denominator);
  const trailingAprPercentage = trailingAprBps / 100;
  const trailingAprFormatted = `${trailingAprPercentage.toFixed(2)}%`;

  return {
    trailingAprBps,
    trailingAprPercentage,
    trailingAprFormatted,
    isShortObservationWarning,
    warningNotice,
  };
}

/**
 * Calculates projected gross return in wei over a user-specified investment horizon
 * Gross Yield = (Principal * forwardRateBps * horizonDays) / (10000 * 365)
 * Truncates integer division to zero (conservative standard)
 */
export function calculateGrossProjectedYield(
  principalWei: bigint,
  forwardRateBps: number,
  horizonDays: number
): bigint {
  if (principalWei < 0n) {
    throw new Error('Invalid input: principalWei cannot be negative');
  }
  if (forwardRateBps < 0) {
    throw new Error('Invalid input: forwardRateBps cannot be negative');
  }
  if (horizonDays < 0) {
    throw new Error('Invalid input: horizonDays cannot be negative');
  }

  if (principalWei === 0n || forwardRateBps === 0 || horizonDays === 0) {
    return 0n;
  }

  const numerator = principalWei * BigInt(forwardRateBps) * BigInt(horizonDays);
  const denominator = BPS_SCALE * DAYS_PER_YEAR;
  return numerator / denominator;
}

/**
 * Calculates the exact break-even horizon (in days) to offset total friction
 * Break-even Days = Total Friction / Daily Gross Yield
 * Preserves high floating precision (up to 6 decimal places) without zero-clamping positive values.
 */
export function calculateBreakEvenDays(
  totalFrictionWei: bigint,
  principalWei: bigint,
  forwardRateBps: number
): number {
  if (totalFrictionWei <= 0n) {
    return 0; // Zero friction = immediate break-even
  }
  if (principalWei <= 0n || forwardRateBps <= 0) {
    return Infinity;
  }

  // Daily yield in wei = (principal * forwardRateBps) / (10000 * 365)
  const dailyYieldWei = (principalWei * BigInt(forwardRateBps)) / (BPS_SCALE * DAYS_PER_YEAR);
  if (dailyYieldWei === 0n) {
    return Infinity;
  }

  // Compute floating decimal with high precision (6 decimal places to prevent sub-day zero truncation)
  const days = Number(totalFrictionWei) / Number(dailyYieldWei);
  return Number(days.toFixed(6));
}

/**
 * Formats a break-even duration into a human-meaningful string without losing sub-day information.
 * - Sub-minute values (< 0.000694 days) format as seconds e.g. "93s (< 1 min, < 1 day)"
 * - Sub-hour values (< 0.04167 days) format as minutes e.g. "~11 mins (< 1 day)"
 * - Sub-day values (< 1.0 day) format as hours e.g. "~3.5 hrs (< 1 day)"
 * - Multi-day values format as days e.g. "17.18 days"
 * - Zero friction formats as "Immediate (0 days)"
 * - Infinite or non-positive rates format as "Never (non-recovering)"
 */
export function formatBreakEvenDuration(days: number): string {
  if (!Number.isFinite(days) || days < 0) {
    return 'Never (non-recovering)';
  }
  if (days === 0) {
    return 'Immediate (0 days)';
  }

  const totalSeconds = Math.round(days * 86_400);

  if (totalSeconds < 60) {
    const s = Math.max(1, totalSeconds);
    return `${s}s (< 1 min, < 1 day)`;
  }

  if (totalSeconds < 3600) {
    const mins = Math.max(1, Math.round(totalSeconds / 60));
    return `~${mins} min${mins === 1 ? '' : 's'} (< 1 day)`;
  }

  if (days < 1.0) {
    const hours = (totalSeconds / 3600).toFixed(1);
    return `~${hours} hrs (< 1 day)`;
  }

  return `${days.toFixed(2)} days`;
}
