/**
 * Unit Tests for Non-Custodial Transaction Reviewer
 * Tests ABI encoding, unsigned transaction generation, unavailable state handling,
 * and security constraints (zero private keys, zero signing, zero broadcasting).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TransactionReviewer } from '../../src/reviewer/transactionReviewer.ts';
import { CANONICAL_CONTRACTS, NETWORK_CONFIG } from '../../src/types/index.ts';

describe('TransactionReviewer - Non-Custodial Safety & ABI Verification', () => {
  it('correctly encodes 32-byte EVM address parameter', () => {
    const address = '0x6b0A44c64190279f7034b77c13a566E914FE5Ec4';
    const encoded = TransactionReviewer.encodeAddressParam(address);
    assert.equal(encoded.length, 64);
    assert.equal(encoded, '0000000000000000000000006b0a44c64190279f7034b77c13a566e914fe5ec4');
  });

  it('rejects invalid address length in address parameter encoding', () => {
    assert.throws(
      () => TransactionReviewer.encodeAddressParam('0x1234'),
      /Invalid address length/
    );
  });

  it('correctly encodes uint256 parameter as 32-byte hex word', () => {
    const val = 1000000000000000000000n; // 1,000 PROS (1e21 wei)
    const encoded = TransactionReviewer.encodeUint256Param(val);
    assert.equal(encoded.length, 64);
    assert.equal(encoded, '00000000000000000000000000000000000000000000003635c9adc5dea00000');
  });

  it('rejects negative numbers in uint256 parameter encoding', () => {
    assert.throws(
      () => TransactionReviewer.encodeUint256Param(-1n),
      /uint256 cannot be negative/
    );
  });

  describe('Faroo Patient Staking Review Generation', () => {
    const review = TransactionReviewer.generateReview({
      strategyId: 'faroo-patient-staking',
      amountPros: 1000,
      userAddress: '0x1111111111111111111111111111111111111111',
      gasPriceWei: 10_000_000_000n, // 10 Gwei
    });

    it('enforces non-custodial safety boundaries', () => {
      assert.equal(review.safetyNotice.isNonCustodial, true);
      assert.equal(review.safetyNotice.canSign, false);
      assert.equal(review.safetyNotice.canBroadcast, false);
      assert.match(review.safetyNotice.disclaimer, /unsigned calldata/i);
    });

    it('produces exactly 3 verified execution steps', () => {
      assert.equal(review.steps.length, 3);
      assert.equal(review.steps[0].payloadStatus, 'AVAILABLE');
      assert.equal(review.steps[1].payloadStatus, 'AVAILABLE');
      assert.equal(review.steps[2].payloadStatus, 'AVAILABLE');
      assert.equal(review.steps[0].isAbiVerified, true);
      assert.equal(review.steps[1].isAbiVerified, true);
      assert.equal(review.steps[2].isAbiVerified, true);
    });

    it('Step 1: encodes WPROS wrap deposit() with value = 1,000 PROS', () => {
      const step1 = review.steps[0];
      assert.equal(step1.contractAddress, CANONICAL_CONTRACTS.CANONICAL_WPROS);
      assert.equal(step1.selector, '0xd0e30db0');
      assert.equal(step1.payload?.data, '0xd0e30db0');
      assert.equal(step1.payload?.chainId, NETWORK_CONFIG.chainId);
      assert.equal(BigInt(step1.payload!.value), 1000000000000000000000n);
    });

    it('Step 2: encodes WPROS approve(spender, amount) to Faroo vault', () => {
      const step2 = review.steps[1];
      assert.equal(step2.contractAddress, CANONICAL_CONTRACTS.CANONICAL_WPROS);
      assert.equal(step2.selector, '0x095ea7b3');
      assert.equal(step2.payload?.to, CANONICAL_CONTRACTS.CANONICAL_WPROS);
      assert.equal(step2.payload?.value, '0x0');
      
      const expectedData = `0x095ea7b3${TransactionReviewer.encodeAddressParam(CANONICAL_CONTRACTS.FAROO_STPROS)}${TransactionReviewer.encodeUint256Param(1000000000000000000000n)}`;
      assert.equal(step2.payload?.data, expectedData);
    });

    it('Step 3: encodes Faroo stPROS deposit(uint256 assets, address receiver)', () => {
      const step3 = review.steps[2];
      assert.equal(step3.contractAddress, CANONICAL_CONTRACTS.FAROO_STPROS);
      assert.equal(step3.selector, '0x6e553f65');
      assert.equal(step3.payload?.to, CANONICAL_CONTRACTS.FAROO_STPROS);
      assert.equal(step3.payload?.value, '0x0');

      const expectedData = `0x6e553f65${TransactionReviewer.encodeUint256Param(1000000000000000000000n)}${TransactionReviewer.encodeAddressParam('0x1111111111111111111111111111111111111111')}`;
      assert.equal(step3.payload?.data, expectedData);
    });

    it('includes unbonding queue and liquidity disclosures', () => {
      const step3 = review.steps[2];
      const riskText = step3.risksAndConstraints.join(' ');
      assert.match(riskText, /unbonding/i);
      assert.match(riskText, /14 days/i);
    });
  });

  describe('Faroo Instant DEX Review Generation', () => {
    const review = TransactionReviewer.generateReview({
      strategyId: 'faroo-instant-dex',
      amountPros: 500,
      userAddress: '0x2222222222222222222222222222222222222222',
    });

    it('identifies strategy as instant DEX exit and explains swap friction', () => {
      assert.equal(review.strategyId, 'faroo-instant-dex');
      const step3Risk = review.steps[2].risksAndConstraints.join(' ');
      assert.match(step3Risk, /Pharos DEX/i);
      assert.match(step3Risk, /0.30% swap fee/i);
    });
  });

  describe('Disqualified Strategy Handling (Zero-Mock Requirement)', () => {
    it('returns UNAVAILABLE payload status for Axil Prime Credit', () => {
      const review = TransactionReviewer.generateReview({
        strategyId: 'axil-prime-credit',
        amountPros: 1000,
      });

      assert.equal(review.steps.length, 1);
      const step = review.steps[0];
      assert.equal(step.payloadStatus, 'UNAVAILABLE');
      assert.equal(step.isAbiVerified, false);
      assert.equal(step.payload, undefined);
      assert.match(step.unavailabilityReason!, /TRANSACTION_PAYLOAD_UNAVAILABLE/);
      assert.match(step.explanation, /USDC/);
    });

    it('returns UNAVAILABLE payload status for Native PoS Staking', () => {
      const review = TransactionReviewer.generateReview({
        strategyId: 'native-pros-consensus',
        amountPros: 1000,
      });

      assert.equal(review.steps.length, 1);
      const step = review.steps[0];
      assert.equal(step.payloadStatus, 'UNAVAILABLE');
      assert.equal(step.isAbiVerified, false);
      assert.equal(step.payload, undefined);
      assert.match(step.unavailabilityReason!, /TRANSACTION_PAYLOAD_UNAVAILABLE/);
      assert.match(step.explanation, /No public validator delegation contract/);
    });

    it('rejects unknown or invalid strategy identifiers', () => {
      assert.throws(
        () => TransactionReviewer.generateReview({ strategyId: 'unknown-strategy', amountPros: 100 }),
        /Unsupported strategy ID/
      );
    });
  });
});
