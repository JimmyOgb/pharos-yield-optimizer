import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateRecommendation,
  evaluateStrategyProjection,
  STRATEGY_PROFILES,
  FORWARD_RATES_BPS,
} from '../../src/engine/recommendationEngine.ts';
import { SCALE_18 } from '../../src/engine/yieldMath.ts';
import { CANONICAL_CONTRACTS } from '../../src/types/index.ts';

describe('RecommendationEngine - Deterministic Outcomes & Provenance Safeguards', () => {
  it('strictly preserves the invariant: verifiedQualifyingSourcesCount === 1', () => {
    const res = generateRecommendation({
      principalWei: 1_000n * SCALE_18,
      asset: 'PROS',
      horizonDays: 60,
      requireInstantLiquidity: false,
    });

    assert.strictEqual(res.verifiedQualifyingSourcesCount, 1);
  });

  describe('Outcome: MOVE (Positive Net Alpha)', () => {
    it('recommends MOVE to Faroo Patient Staking for 1,000 PROS over 60 days', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
      });

      assert.strictEqual(res.decision, 'MOVE');
      assert.strictEqual(res.reasonCode, 'POSITIVE_NET_ALPHA');
      assert.strictEqual(res.targetStrategyId, 'faroo-patient-staking');
      // Gross ~13.9726, friction ~0.00025 -> Net ~13.97235 PROS
      assert.ok(res.netAdvantagePros > 13.97 && res.netAdvantagePros < 13.98);
      // Gate 7A.2 Correction: Retains true numerical precision (~0.001074 days / ~93 seconds) rather than zero truncation
      assert.ok(res.breakEvenDays > 0 && res.breakEvenDays < 0.005, `Expected sub-day break-even > 0, got ${res.breakEvenDays}`);
      assert.ok(res.explanation.includes('Faroo Patient Staking'));
    });

    it('recommends MOVE to Faroo Instant DEX when instant liquidity is required and horizon allows break-even', () => {
      // 1,000 PROS over 60 days with instant liquidity
      // Gross yield = 13.97 PROS. Friction = 4.00 PROS. Net = +9.97 PROS.
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: true,
      });

      assert.strictEqual(res.decision, 'MOVE');
      assert.strictEqual(res.reasonCode, 'POSITIVE_NET_ALPHA');
      assert.strictEqual(res.targetStrategyId, 'faroo-instant-dex');
      assert.ok(res.netAdvantagePros > 9.9 && res.netAdvantagePros < 10.0);
      assert.ok(Math.abs(res.breakEvenDays - 17.177866) < 0.01, `Expected ~17.18 days, got ${res.breakEvenDays}`);
    });
  });

  describe('Outcome: STAY_PUT (Friction Exceeds Yield / Horizon Constrained)', () => {
    it('outputs STAY_PUT when investment horizon (7 days) is shorter than mandatory 14-day lockup', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 7,
        requireInstantLiquidity: false,
      });

      assert.strictEqual(res.decision, 'STAY_PUT');
      assert.strictEqual(res.reasonCode, 'HORIZON_SHORTER_THAN_LOCKUP');
      assert.ok(res.explanation.includes('shorter than mandatory protocol lockup'));
      assert.strictEqual(res.netAdvantageWei, 0n);
    });

    it('outputs STAY_PUT when DEX exit friction exceeds yield over short horizon (10 days)', () => {
      // 1,000 PROS over 10 days with instant liquidity
      // Gross yield = 2.33 PROS. Friction = 4.00 PROS. Net loss = -1.67 PROS.
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 10,
        requireInstantLiquidity: true,
      });

      assert.strictEqual(res.decision, 'STAY_PUT');
      assert.strictEqual(res.reasonCode, 'FRICTION_EXCEEDS_GROSS_YIELD');
      assert.ok(Math.abs(res.breakEvenDays - 17.177866) < 0.01, `Expected ~17.18 days, got ${res.breakEvenDays}`);
      assert.ok(res.explanation.includes('exceed expected gross yield'));
    });

    it('outputs STAY_PUT when principal is zero', () => {
      const res = generateRecommendation({
        principalWei: 0n,
        asset: 'PROS',
        horizonDays: 30,
        requireInstantLiquidity: false,
      });

      assert.strictEqual(res.decision, 'STAY_PUT');
      assert.strictEqual(res.reasonCode, 'ZERO_PRINCIPAL_INPUT');
      assert.strictEqual(res.netAdvantageWei, 0n);
    });

    it('outputs STAY_PUT when already in optimal strategy', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
        currentStrategyId: 'faroo-patient-staking',
      });

      assert.strictEqual(res.decision, 'STAY_PUT');
      assert.strictEqual(res.reasonCode, 'ALREADY_IN_OPTIMAL_POSITION');
    });

    it('outputs STAY_PUT when holding Faroo Instant DEX and instant liquidity eliminates all other options', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: true,
        currentStrategyId: 'faroo-instant-dex',
      });

      assert.strictEqual(res.decision, 'STAY_PUT');
      assert.strictEqual(res.reasonCode, 'ALREADY_IN_OPTIMAL_POSITION');
      assert.ok(res.explanation.includes('optimal strategy') || res.explanation.includes('satisfies current liquidity'));
    });
  });

  describe('Outcome: INSUFFICIENT_DATA (Data Freshness & Provenance Guards)', () => {
    it('rejects stale data (> 10m old) and outputs INSUFFICIENT_DATA', () => {
      const res = generateRecommendation(
        {
          principalWei: 1_000n * SCALE_18,
          asset: 'PROS',
          horizonDays: 60,
          requireInstantLiquidity: false,
        },
        1.25,
        true, // isDataStale = true
        false
      );

      assert.strictEqual(res.decision, 'INSUFFICIENT_DATA');
      assert.strictEqual(res.reasonCode, 'STALE_OR_MISSING_ONCHAIN_DATA');
      assert.ok(res.explanation.includes('cached on-chain state is stale'));
    });

    it('rejects unavailable RPC data and outputs INSUFFICIENT_DATA', () => {
      const res = generateRecommendation(
        {
          principalWei: 1_000n * SCALE_18,
          asset: 'PROS',
          horizonDays: 60,
          requireInstantLiquidity: false,
        },
        1.25,
        false,
        true // isDataUnavailable = true
      );

      assert.strictEqual(res.decision, 'INSUFFICIENT_DATA');
      assert.strictEqual(res.reasonCode, 'STALE_OR_MISSING_ONCHAIN_DATA');
      assert.ok(res.explanation.includes('critical on-chain RPC data is unavailable'));
    });
  });

  describe('Exclusion of Off-Chain Target Rate (Axil APC3M)', () => {
    it('never recommends Axil Prime Credit for automated PROS rebalance', () => {
      // Even with 90-day horizon where Axil headline APY (9.25%) is higher than Faroo (8.50%)
      const res = generateRecommendation({
        principalWei: 10_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 90,
        requireInstantLiquidity: false,
      });

      // Target must be Faroo Patient Staking, NOT Axil
      assert.strictEqual(res.decision, 'MOVE');
      assert.strictEqual(res.targetStrategyId, 'faroo-patient-staking');
      assert.notStrictEqual(res.targetStrategyId, 'axil-prime-credit-3m');
    });
  });

  describe('Comparison Matrix Completeness & Badging', () => {
    it('contains all 4 strategies with strict classification tags and risk disclosures', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
      });

      assert.strictEqual(res.comparisons.length, 4);

      const farooQueue = res.comparisons.find((c) => c.profile.id === 'faroo-patient-staking')!;
      assert.strictEqual(farooQueue.profile.classification, 'VERIFIED_ONCHAIN');
      assert.strictEqual(farooQueue.profile.qualifiesTowardReq01, true);

      const farooDex = res.comparisons.find((c) => c.profile.id === 'faroo-instant-dex')!;
      assert.strictEqual(farooDex.profile.classification, 'EXECUTION_ALTERNATIVE');
      assert.strictEqual(farooDex.profile.qualifiesTowardReq01, false);

      const axil = res.comparisons.find((c) => c.profile.id === 'axil-prime-credit-3m')!;
      assert.strictEqual(axil.profile.classification, 'OFFCHAIN_TARGET_RATE');
      assert.strictEqual(axil.profile.qualifiesTowardReq01, false);
      assert.ok(axil.riskDisclosures.some((r) => r.includes('CURRENCY_MISMATCH_RISK')));

      const baseline = res.comparisons.find((c) => c.profile.id === 'native-pros-baseline')!;
      assert.strictEqual(baseline.profile.classification, 'BASELINE_ONLY');
      assert.strictEqual(baseline.profile.qualifiesTowardReq01, false);
      // Canonical WPROS address contract consistency
      assert.strictEqual(baseline.profile.contractAddress, '0x52C48d4213107b20bC583832b0d951FB9CA8F0B0');
    });
  });

  describe('Horizon Spectrum & Rebalancing Sensitivity (Gate 7C)', () => {
    it('1-day horizon: outputs STAY_PUT (lockup constraint + instant DEX friction exceeds yield)', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 1,
        requireInstantLiquidity: false,
      });
      assert.strictEqual(res.decision, 'STAY_PUT');
      assert.strictEqual(res.reasonCode, 'HORIZON_SHORTER_THAN_LOCKUP');
    });

    it('7-day horizon: outputs STAY_PUT (7 days < 14-day queue)', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 7,
        requireInstantLiquidity: false,
      });
      assert.strictEqual(res.decision, 'STAY_PUT');
      assert.strictEqual(res.reasonCode, 'HORIZON_SHORTER_THAN_LOCKUP');
    });

    it('14-day horizon: exactly meets lockup boundary -> outputs MOVE to Faroo Patient Staking', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 14,
        requireInstantLiquidity: false,
      });
      assert.strictEqual(res.decision, 'MOVE');
      assert.strictEqual(res.targetStrategyId, 'faroo-patient-staking');
      assert.ok(res.netAdvantagePros > 3.25);
    });

    it('60-day horizon: outputs MOVE with positive net yield', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
      });
      assert.strictEqual(res.decision, 'MOVE');
      assert.strictEqual(res.targetStrategyId, 'faroo-patient-staking');
      assert.ok(res.netAdvantagePros > 13.96);
    });

    it('180-day horizon: long-term compounder outputs MOVE with sustained net gain', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 180,
        requireInstantLiquidity: false,
      });
      assert.strictEqual(res.decision, 'MOVE');
      assert.strictEqual(res.targetStrategyId, 'faroo-patient-staking');
      assert.ok(res.netAdvantagePros > 41.0);
    });
  });

  describe('Current-Position Option Transitions (Gate 7C)', () => {
    it('currentPosition: native-pros-baseline -> recommends MOVE to Faroo Patient', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
        currentStrategyId: 'native-pros-baseline',
      });
      assert.strictEqual(res.decision, 'MOVE');
      assert.strictEqual(res.targetStrategyId, 'faroo-patient-staking');
    });

    it('currentPosition: faroo-patient-staking -> outputs STAY_PUT (already optimal)', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
        currentStrategyId: 'faroo-patient-staking',
      });
      assert.strictEqual(res.decision, 'STAY_PUT');
      assert.strictEqual(res.reasonCode, 'ALREADY_IN_OPTIMAL_POSITION');
    });

    it('currentPosition: faroo-instant-dex -> recommends MOVE to faroo-patient-staking to eliminate 0.40% DEX friction', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
        currentStrategyId: 'faroo-instant-dex',
      });
      assert.strictEqual(res.decision, 'MOVE');
      assert.strictEqual(res.targetStrategyId, 'faroo-patient-staking');
      // Patient staking saves ~4 PROS in DEX fees/slippage over instant DEX
      assert.ok(res.netAdvantagePros > 3.9);
    });
  });

  describe('WPROS Baseline & Native PROS Economic Integrity (Gate 7C.1)', () => {
    it('baseline represents un-staked capital holding benchmark with 0% yield and 0 friction', () => {
      const profile = STRATEGY_PROFILES['native-pros-baseline'];
      assert.strictEqual(profile.id, 'native-pros-baseline');
      assert.strictEqual(profile.classification, 'BASELINE_ONLY');
      assert.strictEqual(profile.denomination, 'PROS');
      assert.strictEqual(profile.qualifiesTowardReq01, false);
      assert.strictEqual(profile.lockupPeriodDays, 0);
      assert.strictEqual(profile.exitDelayDays, 0);
      assert.strictEqual(profile.exitFeeBps, 0);
      assert.strictEqual(FORWARD_RATES_BPS['native-pros-baseline'], 0);

      const proj = evaluateStrategyProjection('native-pros-baseline', 1_000n * SCALE_18, 60, 10.0);
      assert.strictEqual(proj.grossYieldWei, 0n);
      assert.strictEqual(proj.grossYieldPros, 0);
      assert.strictEqual(proj.friction.totalFrictionWei, 0n);
      assert.strictEqual(proj.friction.totalFrictionPros, 0);
      assert.strictEqual(proj.netGainWei, 0n);
      assert.strictEqual(proj.netGainPros, 0);
      assert.strictEqual(proj.breakEvenDays, 0);
    });

    it('canonical WPROS address is verified and points to the official ERC-20 contract', () => {
      const profile = STRATEGY_PROFILES['native-pros-baseline'];
      assert.strictEqual(profile.contractAddress, CANONICAL_CONTRACTS.CANONICAL_WPROS);
      assert.strictEqual(CANONICAL_CONTRACTS.CANONICAL_WPROS, '0x52C48d4213107b20bC583832b0d951FB9CA8F0B0');
    });

    it('handles native PROS and WPROS balances in identical 1e18 decimal units with 1:1 wrapping equivalence', () => {
      const principalWei = 1_000n * SCALE_18;
      // 1000 PROS = 1000 * 10^18 wei
      assert.strictEqual(principalWei, 1000000000000000000000n);

      // Moving to Faroo accounts for wrapping gas (45k units) inside total entry gas (180k units)
      const res = generateRecommendation({
        principalWei,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
      }, 10.0); // 10 Gwei

      assert.strictEqual(res.decision, 'MOVE');
      const farooProj = res.comparisons.find((c) => c.profile.id === 'faroo-patient-staking')!;
      
      // Faroo lifecycle gas: 265,000 gas units @ 10 Gwei = 0.002650 PROS (includes 45k wrap gas)
      assert.strictEqual(farooProj.friction.gasCostWei, 2_650_000_000_000_000n);
      assert.strictEqual(farooProj.friction.totalFrictionPros, 0.00265);
      // Protocol fees for Faroo Patient Staking are 0%
      assert.strictEqual(farooProj.friction.entryFeeWei, 0n);
      assert.strictEqual(farooProj.friction.exitFeeWei, 0n);
    });

    it('does NOT double-count wrapping gas or conversion when comparing against baseline', () => {
      const principalWei = 1_000n * SCALE_18;
      const res = generateRecommendation({
        principalWei,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
      }, 10.0); // 10 Gwei

      const farooProj = res.comparisons.find((c) => c.profile.id === 'faroo-patient-staking')!;
      const baselineProj = res.comparisons.find((c) => c.profile.id === 'native-pros-baseline')!;

      // Baseline net gain is 0
      assert.strictEqual(baselineProj.netGainWei, 0n);

      // Gross yield: (1000 * 850 * 60) / (10000 * 365) = 13.972602739726027 PROS (scaled)
      // Deducts friction exactly ONCE: grossYield - totalFriction
      const expectedNetGainWei = farooProj.grossYieldWei - farooProj.friction.totalFrictionWei;
      assert.strictEqual(farooProj.netGainWei, expectedNetGainWei);

      // Net advantage over baseline = farooNetGain - baselineNetGain = farooNetGain - 0
      assert.strictEqual(res.netAdvantageWei, farooProj.netGainWei);
    });

    it('baseline cannot be chosen as a yield destination', () => {
      const res = generateRecommendation({
        principalWei: 1_000n * SCALE_18,
        asset: 'PROS',
        horizonDays: 60,
        requireInstantLiquidity: false,
      });

      assert.notStrictEqual(res.targetStrategyId, 'native-pros-baseline');
      assert.strictEqual(res.targetStrategyId, 'faroo-patient-staking');
    });
  });
});
