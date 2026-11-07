import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeExchangeRate,
  computeRealizedAccrual,
  annualizeTrailingRate,
  calculateGrossProjectedYield,
  calculateBreakEvenDays,
  formatBreakEvenDuration,
  scaledToDecimal,
  decimalToWei,
  SCALE_18,
} from '../../src/engine/yieldMath.ts';

describe('YieldMath - Mathematical Correctness & Edge Cases', () => {
  describe('computeExchangeRate', () => {
    it('computes exact 1:1 spot exchange rate when pooled assets equal supply', () => {
      const assets = 1_000_000n * SCALE_18;
      const supply = 1_000_000n * SCALE_18;
      const rate = computeExchangeRate(assets, supply);
      assert.strictEqual(rate, 1n * SCALE_18);
      assert.strictEqual(scaledToDecimal(rate), 1.0);
    });

    it('computes exact verified Pacific Mainnet rate: 3,152,335.0804 PROS for 3,136,910.7559 stPROS', () => {
      const assets = 3_152_335_080_400_000_000_000_000n; // 3,152,335.0804 * 1e18
      const supply = 3_136_910_755_900_000_000_000_000n; // 3,136,910.7559 * 1e18
      const rate = computeExchangeRate(assets, supply);
      const decimalRate = scaledToDecimal(rate);
      // Expected: 1.00491704...
      assert.ok(decimalRate > 1.00491 && decimalRate < 1.00492, `Expected ~1.004917, got ${decimalRate}`);
    });

    it('rejects zero or negative pooled assets', () => {
      assert.throws(() => computeExchangeRate(0n, 100n), /Invalid input: totalPooledAssetsWei must be strictly positive/);
      assert.throws(() => computeExchangeRate(-100n, 100n), /Invalid input: totalPooledAssetsWei must be strictly positive/);
    });

    it('rejects zero or negative total supply', () => {
      assert.throws(() => computeExchangeRate(100n, 0n), /Invalid input: totalSupplyWei must be strictly positive/);
      assert.throws(() => computeExchangeRate(100n, -50n), /Invalid input: totalSupplyWei must be strictly positive/);
    });
  });

  describe('decimalToWei and scaledToDecimal', () => {
    it('converts integer and decimal numbers accurately to 1e18 scaled bigint', () => {
      assert.strictEqual(decimalToWei(1), 1_000_000_000_000_000_000n);
      assert.strictEqual(decimalToWei('100.5'), 100_500_000_000_000_000_000n);
      assert.strictEqual(decimalToWei('-50.25'), -50_250_000_000_000_000_000n);
    });

    it('converts scaled bigint back to decimal number accurately', () => {
      const wei = 1_500_000_000_000_000_000n;
      assert.strictEqual(scaledToDecimal(wei), 1.5);
    });

    describe('Gate 10A.3 - Signed BigInt Scaling Regression Tests', () => {
      it('Case 1: Positive whole value', () => {
        const val = 2n * SCALE_18;
        const res = scaledToDecimal(val);
        assert.strictEqual(res, 2.0);
        assert.ok(!Number.isNaN(res) && Number.isFinite(res));
      });

      it('Case 2: Positive fractional value', () => {
        const val = 500_000_000_000_000_000n; // 0.5 PROS
        const res = scaledToDecimal(val);
        assert.strictEqual(res, 0.5);
        assert.ok(!Number.isNaN(res) && Number.isFinite(res));
      });

      it('Case 3: Zero', () => {
        const res = scaledToDecimal(0n);
        assert.strictEqual(res, 0);
        assert.ok(!Number.isNaN(res) && Number.isFinite(res));
      });

      it('Case 4: Negative whole value', () => {
        const val = -3n * SCALE_18;
        const res = scaledToDecimal(val);
        assert.strictEqual(res, -3.0);
        assert.ok(!Number.isNaN(res) && Number.isFinite(res));
      });

      it('Case 5: Negative fractional value smaller than one PROS', () => {
        const val = -500_000_000_000_000_000n; // -0.5 PROS
        const res = scaledToDecimal(val);
        assert.strictEqual(res, -0.5);
        assert.ok(!Number.isNaN(res) && Number.isFinite(res));
      });

      it('Case 6: Negative value with both whole and fractional components', () => {
        // -2.370269263698630137 PROS
        const val = -2_370_269_263_698_630_137n;
        const res = scaledToDecimal(val);
        assert.ok(Math.abs(res - (-2.37026926369863)) < 1e-12);
        assert.strictEqual(res < 0, true);
        assert.ok(!Number.isNaN(res) && Number.isFinite(res));
      });

      it('Case 7: Negative value with an exact fractional component', () => {
        // -1.5 PROS exact fractional representation
        const valHalf = -1_500_000_000_000_000_000n;
        const resHalf = scaledToDecimal(valHalf);
        assert.strictEqual(resHalf, -1.5);
        assert.ok(!Number.isNaN(resHalf) && Number.isFinite(resHalf));

        // -1 - 1 wei: verify it does not produce NaN or crash and evaluates to <= -1.0
        const val1Wei = -1_000_000_000_000_000_001n;
        const res1Wei = scaledToDecimal(val1Wei);
        assert.strictEqual(res1Wei <= -1.0, true);
        assert.ok(!Number.isNaN(res1Wei) && Number.isFinite(res1Wei));

        // -1.0000000001 PROS: exact fractional within IEEE-754 precision
        const valPrecise = -1_000_000_000_100_000_000n;
        const resPrecise = scaledToDecimal(valPrecise);
        assert.ok(resPrecise < -1.0 && resPrecise > -1.000000001);
        assert.ok(!Number.isNaN(resPrecise) && Number.isFinite(resPrecise));
      });

      it('Case 8: Very large positive and negative BigInt values', () => {
        const largePos = 283_924_850n * SCALE_18;
        const resPos = scaledToDecimal(largePos);
        assert.strictEqual(resPos, 283924850.0);
        assert.ok(!Number.isNaN(resPos) && Number.isFinite(resPos));

        const largeNeg = -283_924_850n * SCALE_18;
        const resNeg = scaledToDecimal(largeNeg);
        assert.strictEqual(resNeg, -283924850.0);
        assert.ok(!Number.isNaN(resNeg) && Number.isFinite(resNeg));
      });

      it('Case 9: Entry and exit friction greater than gross yield', () => {
        // Gross yield 1.63 PROS, friction 4.0004 PROS -> Net loss ~ -2.3704 PROS
        const grossYieldWei = 1_630_000_000_000_000_000n;
        const totalFrictionWei = 4_000_400_000_000_000_000n;
        const netGainWei = grossYieldWei - totalFrictionWei; // -2_370_400_000_000_000_000n
        const res = scaledToDecimal(netGainWei);
        assert.strictEqual(res, -2.3704);
        assert.ok(!Number.isNaN(res) && Number.isFinite(res));
      });

      it('Case 10: Net gain exactly zero', () => {
        const grossYieldWei = 3_000_000_000_000_000_000n;
        const totalFrictionWei = 3_000_000_000_000_000_000n;
        const netGainWei = grossYieldWei - totalFrictionWei;
        const res = scaledToDecimal(netGainWei);
        assert.strictEqual(res, 0);
        assert.ok(!Number.isNaN(res) && Number.isFinite(res));
      });
    });
  });

  describe('computeRealizedAccrual', () => {
    it('computes zero gain when rate remains unchanged', () => {
      const rate = 1_000_000_000_000_000_000n;
      const res = computeRealizedAccrual(rate, rate);
      assert.strictEqual(res.realizedDeltaScaled, 0n);
      assert.strictEqual(res.realizedGainBps, 0);
      assert.strictEqual(res.realizedGainPercentage, 0);
    });

    it('computes positive gain accurately (e.g. +0.10128% across 100k blocks)', () => {
      const r1 = 1_003_900_300_000_000_000n; // 1.0039003
      const r2 = 1_004_917_040_000_000_000n; // 1.00491704
      const res = computeRealizedAccrual(r1, r2);
      assert.strictEqual(res.realizedDeltaScaled, 1_016_740_000_000_000n);
      assert.strictEqual(res.realizedGainBps, 10); // 10 bps ~ 0.10%
      assert.strictEqual(res.realizedGainPercentage, 0.1);
    });

    it('computes negative delta if rate decreases (slashing scenario)', () => {
      const r1 = 1_005_000_000_000_000_000n;
      const r2 = 1_000_000_000_000_000_000n;
      const res = computeRealizedAccrual(r1, r2);
      assert.strictEqual(res.realizedDeltaScaled, -5_000_000_000_000_000n);
      assert.ok(res.realizedGainBps < 0);
    });

    it('rejects invalid non-positive rate arguments', () => {
      assert.throws(() => computeRealizedAccrual(0n, 100n), /Invalid input: rateStartScaled must be strictly positive/);
      assert.throws(() => computeRealizedAccrual(100n, -1n), /Invalid input: rateEndScaled must be strictly positive/);
    });
  });

  describe('annualizeTrailingRate & Short-Observation Warning', () => {
    it('attaches explicit short-period warning for observation window under 7 days', () => {
      const delta = 1_016_740_000_000_000n; // ~0.10128%
      const r1 = 1_003_900_300_000_000_000n;
      const elapsedSeconds = 105_155; // 29.21 hours < 168 hours
      const res = annualizeTrailingRate(delta, r1, elapsedSeconds);

      assert.strictEqual(res.isShortObservationWarning, true);
      assert.ok(res.warningNotice?.includes('early episodic reward indexing'));
      assert.ok(res.trailingAprPercentage > 30.0 && res.trailingAprPercentage < 31.0, `Expected ~30.4%, got ${res.trailingAprPercentage}%`);
    });

    it('does not attach short-period warning for long-term observation (e.g. 30 days)', () => {
      const delta = 7_000_000_000_000_000n; // 0.70%
      const r1 = 1_000_000_000_000_000_000n;
      const elapsedSeconds = 30 * 86_400; // 30 days > 7 days
      const res = annualizeTrailingRate(delta, r1, elapsedSeconds);

      assert.strictEqual(res.isShortObservationWarning, false);
      assert.strictEqual(res.warningNotice, undefined);
      assert.strictEqual(res.trailingAprPercentage, 8.51); // 0.7% * 365/30 ~ 8.51%
    });

    it('rejects non-positive elapsed seconds or start rates', () => {
      assert.throws(() => annualizeTrailingRate(100n, 100n, 0), /Invalid input: elapsedSeconds must be strictly positive/);
      assert.throws(() => annualizeTrailingRate(100n, 100n, -50), /Invalid input: elapsedSeconds must be strictly positive/);
      assert.throws(() => annualizeTrailingRate(100n, 0n, 1000), /Invalid input: rateStartScaled must be strictly positive/);
    });
  });

  describe('calculateGrossProjectedYield', () => {
    it('returns zero for zero principal, zero rate, or zero days', () => {
      assert.strictEqual(calculateGrossProjectedYield(0n, 850, 30), 0n);
      assert.strictEqual(calculateGrossProjectedYield(1_000n * SCALE_18, 0, 30), 0n);
      assert.strictEqual(calculateGrossProjectedYield(1_000n * SCALE_18, 850, 0), 0n);
    });

    it('calculates gross return accurately for 1,000 PROS @ 8.50% APR over 60 days', () => {
      const principal = 1_000n * SCALE_18;
      const forwardRateBps = 850; // 8.50%
      const horizonDays = 60;
      const grossWei = calculateGrossProjectedYield(principal, forwardRateBps, horizonDays);
      const grossPros = scaledToDecimal(grossWei);

      // Expected: 1,000 * 0.0850 * (60 / 365) = 13.9726027...
      assert.ok(grossPros >= 13.972 && grossPros <= 13.973, `Expected ~13.9726, got ${grossPros}`);
    });

    it('scales linearly with principal and horizon days (within integer truncation bounds)', () => {
      const p1 = 100n * SCALE_18;
      const p2 = 200n * SCALE_18;
      const y1 = calculateGrossProjectedYield(p1, 850, 30);
      const y2 = calculateGrossProjectedYield(p2, 850, 30);
      // Integer division truncates towards zero; 2 * (p1 * rate / denom) can differ from (2*p1 * rate / denom) by at most 1 wei
      const diff = y2 >= y1 * 2n ? y2 - y1 * 2n : y1 * 2n - y2;
      assert.ok(diff <= 1n, `Expected diff <= 1 wei, got ${diff}`);
    });

    it('rejects negative inputs', () => {
      assert.throws(() => calculateGrossProjectedYield(-1n, 850, 30), /Invalid input: principalWei cannot be negative/);
      assert.throws(() => calculateGrossProjectedYield(100n, -10, 30), /Invalid input: forwardRateBps cannot be negative/);
      assert.throws(() => calculateGrossProjectedYield(100n, 850, -5), /Invalid input: horizonDays cannot be negative/);
    });
  });

  describe('calculateBreakEvenDays & formatBreakEvenDuration', () => {
    it('returns 0 if friction is 0 and formats as Immediate', () => {
      const days = calculateBreakEvenDays(0n, 1_000n * SCALE_18, 850);
      assert.strictEqual(days, 0);
      assert.strictEqual(formatBreakEvenDuration(days), 'Immediate (0 days)');
    });

    it('returns Infinity if principal is 0 or forward rate is 0 and formats as Never', () => {
      const days1 = calculateBreakEvenDays(100n, 0n, 850);
      const days2 = calculateBreakEvenDays(100n, 1_000n * SCALE_18, 0);
      assert.strictEqual(days1, Infinity);
      assert.strictEqual(days2, Infinity);
      assert.strictEqual(formatBreakEvenDuration(days1), 'Never (non-recovering)');
      assert.strictEqual(formatBreakEvenDuration(days2), 'Never (non-recovering)');
    });

    it('calculates break-even accurately: 4 PROS friction on 1,000 PROS @ 8.50% APR', () => {
      const friction = 4n * SCALE_18;
      const principal = 1_000n * SCALE_18;
      const forwardRateBps = 850; // 8.50%
      const days = calculateBreakEvenDays(friction, principal, forwardRateBps);

      // Daily yield = 1000 * 0.085 / 365 = 0.2328767 PROS/day
      // Break-even = 4 / 0.2328767 = 17.176471 days
      assert.ok(Math.abs(days - 17.176471) < 0.001, `Expected ~17.176471, got ${days}`);
      assert.strictEqual(formatBreakEvenDuration(days), '17.18 days');
    });

    it('preserves numerical precision on very small sub-day friction without truncating to 0', () => {
      // 0.000250 PROS friction (200k gas @ 1.25 Gwei) on 1,000 PROS @ 8.50% APR
      const friction = 250_000_000_000_000n; // 0.00025 * 1e18
      const principal = 1_000n * SCALE_18;
      const forwardRateBps = 850;
      const days = calculateBreakEvenDays(friction, principal, forwardRateBps);

      // Expectation: ~0.001073 days (~92.8 seconds)
      assert.ok(days > 0, `Expected days > 0, got ${days}`);
      assert.ok(days < 0.005, `Expected days < 0.005, got ${days}`);
      // Must not truncate to 0.00 or 0
      assert.notStrictEqual(days, 0);
      const formatted = formatBreakEvenDuration(days);
      assert.ok(formatted.includes('s (< 1 min, < 1 day)') || formatted.includes('min'), `Expected sub-day formatted string, got ${formatted}`);
    });

    it('formats sub-hour duration accurately (e.g. 180k gas @ 10 Gwei = 0.0018 PROS ~ 11 mins)', () => {
      // 0.0018 PROS friction on 1,000 PROS @ 8.50% APR
      const friction = 1_800_000_000_000_000n; // 0.0018 * 1e18
      const principal = 1_000n * SCALE_18;
      const forwardRateBps = 850;
      const days = calculateBreakEvenDays(friction, principal, forwardRateBps);

      // ~0.007729 days = ~11.1 minutes
      assert.ok(days > 0.005 && days < 0.01);
      const formatted = formatBreakEvenDuration(days);
      assert.strictEqual(formatted, '~11 mins (< 1 day)');
    });

    it('formats rounding boundary values (< 1 day) without zero loss', () => {
      // 0.004 days was previously truncated to 0.00 by toFixed(2)
      const boundaryFormatted = formatBreakEvenDuration(0.004);
      assert.ok(boundaryFormatted.includes('(< 1 day)'));
      assert.notStrictEqual(boundaryFormatted, '0 days');
    });

    it('returns Infinity when daily yield truncates to zero (extremely small principal)', () => {
      // 1 wei principal at 8.5% daily yield is 0 wei
      assert.strictEqual(calculateBreakEvenDays(100n, 1n, 850), Infinity);
    });
  });
});
