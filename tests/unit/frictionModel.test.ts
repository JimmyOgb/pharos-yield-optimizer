import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeGasCostWei,
  computeFeeWei,
  evaluateStrategyFriction,
} from '../../src/engine/frictionModel.ts';
import { SCALE_18 } from '../../src/engine/yieldMath.ts';

describe('FrictionModel - Cost & Friction Evaluation', () => {
  describe('computeGasCostWei', () => {
    it('computes gas cost accurately in wei at 1.25 Gwei', () => {
      const gasUnits = 200_000n;
      const gasPriceGwei = 1.25;
      const costWei = computeGasCostWei(gasUnits, gasPriceGwei);

      // 200,000 * 1.25 * 10^9 = 250,000,000,000,000 wei = 0.00025 PROS
      assert.strictEqual(costWei, 250_000_000_000_000n);
    });

    it('rejects negative gas units or negative/non-finite gas prices', () => {
      assert.throws(() => computeGasCostWei(-100n, 1.25), /Invalid input: gasUnits cannot be negative/);
      assert.throws(() => computeGasCostWei(100n, -1.5), /Invalid input: gasPriceGwei must be a non-negative finite number/);
      assert.throws(() => computeGasCostWei(100n, Infinity), /Invalid input: gasPriceGwei must be a non-negative finite number/);
      assert.throws(() => computeGasCostWei(100n, NaN), /Invalid input: gasPriceGwei must be a non-negative finite number/);
    });
  });

  describe('computeFeeWei', () => {
    it('computes zero fee when feeBps is 0', () => {
      const fee = computeFeeWei(1_000n * SCALE_18, 0);
      assert.strictEqual(fee, 0n);
    });

    it('computes 0.30% fee accurately: 3 PROS on 1,000 PROS', () => {
      const principal = 1_000n * SCALE_18;
      const fee = computeFeeWei(principal, 30); // 30 bps = 0.30%
      assert.strictEqual(fee, 3n * SCALE_18);
    });

    it('rejects negative amount or negative/non-finite fee basis points', () => {
      assert.throws(() => computeFeeWei(-100n, 10), /Invalid input: amountWei cannot be negative/);
      assert.throws(() => computeFeeWei(100n, -5), /Invalid input: feeBps must be a non-negative finite number/);
      assert.throws(() => computeFeeWei(100n, NaN), /Invalid input: feeBps must be a non-negative finite number/);
    });
  });

  describe('evaluateStrategyFriction', () => {
    const principal = 1_000n * SCALE_18;
    const gasPriceGwei = 1.25;

    it('evaluates Faroo Patient Staking friction (Unified 265k physical lifecycle: 180k entry + 85k exit)', () => {
      const res = evaluateStrategyFriction('faroo-patient-staking', principal, gasPriceGwei);

      assert.strictEqual(res.provenance, 'VERIFIED_ONCHAIN');
      assert.strictEqual(res.entryFeeWei, 0n);
      assert.strictEqual(res.exitFeeWei, 0n);
      assert.strictEqual(res.swapFeeWei, 0n);
      assert.strictEqual(res.slippageCostWei, 0n);
      // Unified Physical Gas: (180k entry + 85k queue exit) * 1.25 Gwei = 265,000 * 1.25e9 = 331,250,000,000,000 wei = 0.00033125 PROS
      assert.strictEqual(res.gasCostWei, 331_250_000_000_000n);
      assert.strictEqual(res.totalFrictionWei, 331_250_000_000_000n);
      assert.ok(Math.abs(res.totalFrictionPros - 0.00033125) < 1e-8);

      // Verify at 10.0 Gwei fixture
      const res10 = evaluateStrategyFriction('faroo-patient-staking', principal, 10.0);
      assert.strictEqual(res10.gasCostWei, 2_650_000_000_000_000n);
      assert.strictEqual(res10.totalFrictionPros, 0.00265);
    });

    it('evaluates Faroo Instant DEX Exit friction (180k entry + 145k assumed swap gas + 0.30% swap fee + 0.10% slippage)', () => {
      const res = evaluateStrategyFriction('faroo-instant-dex', principal, gasPriceGwei);

      assert.strictEqual(res.provenance, 'EXECUTION_ALTERNATIVE');
      assert.strictEqual(res.entryFeeWei, 0n);
      assert.strictEqual(res.exitFeeWei, 0n);
      // Swap fee 30 bps = 3 PROS
      assert.strictEqual(res.swapFeeWei, 3n * SCALE_18);
      // Slippage 10 bps = 1 PROS
      assert.strictEqual(res.slippageCostWei, 1n * SCALE_18);
      // Total fee + slippage = 4 PROS
      // Unified Physical Gas: (180k entry + 145k assumed DEX swap) * 1.25 Gwei = 325,000 * 1.25e9 = 406,250,000,000,000 wei = 0.00040625 PROS
      assert.strictEqual(res.totalFrictionWei, 4_000_406_250_000_000_000n);
      assert.ok(res.totalFrictionPros > 4.0004 && res.totalFrictionPros < 4.0005);
    });

    it('supports custom slippage in Faroo Instant DEX Exit', () => {
      const res = evaluateStrategyFriction('faroo-instant-dex', principal, gasPriceGwei, 25); // 25 bps = 0.25%
      assert.strictEqual(res.slippageCostWei, 2_500_000_000_000_000_000n); // 2.5 PROS
    });

    it('evaluates Native PROS Baseline friction (Strictly 0)', () => {
      const res = evaluateStrategyFriction('native-pros-baseline', principal, gasPriceGwei);

      assert.strictEqual(res.provenance, 'BASELINE_ONLY');
      assert.strictEqual(res.gasCostWei, 0n);
      assert.strictEqual(res.entryFeeWei, 0n);
      assert.strictEqual(res.exitFeeWei, 0n);
      assert.strictEqual(res.swapFeeWei, 0n);
      assert.strictEqual(res.slippageCostWei, 0n);
      assert.strictEqual(res.totalFrictionWei, 0n);
      assert.strictEqual(res.totalFrictionPros, 0);
    });

    it('evaluates Axil Prime Credit friction with double swap friction', () => {
      const res = evaluateStrategyFriction('axil-prime-credit-3m', principal, gasPriceGwei);

      assert.strictEqual(res.provenance, 'OFFCHAIN_TARGET_RATE');
      assert.ok(res.totalFrictionWei > 0n);
    });

    it('rejects negative principal', () => {
      assert.throws(() => evaluateStrategyFriction('faroo-patient-staking', -100n, 1.25), /Invalid input: principalWei cannot be negative/);
    });

    it('rejects unhandled or unknown strategy identifier', () => {
      assert.throws(
        () => evaluateStrategyFriction('unknown-strategy' as any, principal, gasPriceGwei),
        /Unhandled strategy identifier: unknown-strategy/
      );
    });
  });
});
