import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  generateRecommendation,
} from '../../src/engine/recommendationEngine.ts';
import { SCALE_18 } from '../../src/engine/yieldMath.ts';

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
    });
  });
});
