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

    it('attaches ACTION REQUIRED warning when receiver address is zero-address placeholder', () => {
      const review = TransactionReviewer.generateReview({
        strategyId: 'faroo-patient-staking',
        amountPros: 1000,
        // Default userAddress is omitted -> placeholder/missing
      });

      const step3 = review.steps[2];
      assert.ok(
        step3.risksAndConstraints.some((r) => r.includes('ACTION REQUIRED: Receiver parameter is currently set to placeholder address')),
        'Expected placeholder receiver warning in risksAndConstraints'
      );
    });

    it('omits placeholder warning when explicit user address is provided', () => {
      const review = TransactionReviewer.generateReview({
        strategyId: 'faroo-patient-staking',
        amountPros: 1000,
        userAddress: '0x2222222222222222222222222222222222222222',
      });

      const step3 = review.steps[2];
      assert.ok(
        !step3.risksAndConstraints.some((r) => r.includes('ACTION REQUIRED')),
        'Placeholder warning should not be present when valid user address is provided'
      );
    });
  });

  describe('Receiver-Dependent Calldata Safety & Validation (Gate 7C.1)', () => {
    describe('Missing Receiver Address', () => {
      it('marks Step 3 as INCOMPLETE and omits payload when userAddress is omitted', () => {
        const review = TransactionReviewer.generateReview({
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
        });

        assert.strictEqual(review.receiverStatus, 'MISSING');
        assert.strictEqual(review.receiverAddress, undefined);
        assert.strictEqual(review.isReadyForExternalReview, false);

        // Steps 1 and 2 do not depend on receiver and remain AVAILABLE
        assert.strictEqual(review.steps[0].payloadStatus, 'AVAILABLE');
        assert.ok(review.steps[0].payload?.data);
        assert.strictEqual(review.steps[1].payloadStatus, 'AVAILABLE');
        assert.ok(review.steps[1].payload?.data);

        // Step 3 depends on receiver -> must be INCOMPLETE with NO payload
        const step3 = review.steps[2];
        assert.strictEqual(step3.payloadStatus, 'INCOMPLETE');
        assert.strictEqual(step3.payload, undefined);
        assert.match(step3.unavailabilityReason!, /CALLDATA_INCOMPLETE/);

        const receiverParam = step3.parameters.find((p) => p.name === 'receiver')!;
        assert.strictEqual(receiverParam.value, '');
        assert.match(receiverParam.formatted, /NOT SET|Action Required/);
      });

      it('marks Step 3 as INCOMPLETE when userAddress is empty string or whitespace', () => {
        const review = TransactionReviewer.generateReview({
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
          userAddress: '   ',
        });

        assert.strictEqual(review.receiverStatus, 'MISSING');
        assert.strictEqual(review.isReadyForExternalReview, false);
        assert.strictEqual(review.steps[2].payloadStatus, 'INCOMPLETE');
        assert.strictEqual(review.steps[2].payload, undefined);
      });
    });

    describe('Zero Address Receiver (0x0000...0000)', () => {
      it('rejects zero address and NEVER presents it as a valid receiver', () => {
        const zeroAddress = '0x0000000000000000000000000000000000000000';
        const review = TransactionReviewer.generateReview({
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
          userAddress: zeroAddress,
        });

        assert.strictEqual(review.receiverStatus, 'INVALID_ZERO_ADDRESS');
        assert.strictEqual(review.receiverAddress, undefined);
        assert.strictEqual(review.isReadyForExternalReview, false);

        const step3 = review.steps[2];
        assert.strictEqual(step3.payloadStatus, 'INCOMPLETE');
        assert.strictEqual(step3.payload, undefined);
        assert.match(step3.unavailabilityReason!, /Zero address \(0x0000\.\.\.0000\) is rejected/);

        const receiverParam = step3.parameters.find((p) => p.name === 'receiver')!;
        assert.match(receiverParam.formatted, /REJECTED: 0x0000\.\.\.0000/);
        assert.ok(
          step3.risksAndConstraints.some((r) => r.includes('ACTION REQUIRED: Receiver parameter is currently set to placeholder address')),
          'Expected placeholder rejection warning'
        );
      });
    });

    describe('Malformed Receiver Address', () => {
      it('rejects truncated address syntax (< 40 hex chars)', () => {
        const review = TransactionReviewer.generateReview({
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
          userAddress: '0x1234',
        });

        assert.strictEqual(review.receiverStatus, 'INVALID_FORMAT');
        assert.strictEqual(review.receiverAddress, undefined);
        assert.strictEqual(review.isReadyForExternalReview, false);
        assert.strictEqual(review.steps[2].payloadStatus, 'INCOMPLETE');
        assert.strictEqual(review.steps[2].payload, undefined);
        assert.match(review.steps[2].unavailabilityReason!, /Malformed receiver address syntax/);
      });

      it('rejects non-hex characters in address string', () => {
        const review = TransactionReviewer.generateReview({
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
          userAddress: '0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
        });

        assert.strictEqual(review.receiverStatus, 'INVALID_FORMAT');
        assert.strictEqual(review.steps[2].payloadStatus, 'INCOMPLETE');
        assert.strictEqual(review.steps[2].payload, undefined);
      });

      it('rejects plain text strings without 0x prefix', () => {
        const review = TransactionReviewer.generateReview({
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
          userAddress: 'not-an-evm-address',
        });

        assert.strictEqual(review.receiverStatus, 'INVALID_FORMAT');
        assert.strictEqual(review.steps[2].payloadStatus, 'INCOMPLETE');
        assert.strictEqual(review.steps[2].payload, undefined);
      });
    });

    describe('Valid Receiver Address', () => {
      it('encodes exact receiver into Step 3 calldata and marks review as READY', () => {
        const validReceiver = '0x8888888888888888888888888888888888888888';
        const review = TransactionReviewer.generateReview({
          strategyId: 'faroo-patient-staking',
          amountPros: 1000,
          userAddress: validReceiver,
        });

        assert.strictEqual(review.receiverStatus, 'VALID');
        assert.strictEqual(review.receiverAddress, validReceiver);
        assert.strictEqual(review.isReadyForExternalReview, true);

        // All 3 steps are AVAILABLE
        assert.strictEqual(review.steps[0].payloadStatus, 'AVAILABLE');
        assert.strictEqual(review.steps[1].payloadStatus, 'AVAILABLE');
        assert.strictEqual(review.steps[2].payloadStatus, 'AVAILABLE');

        const step3 = review.steps[2];
        assert.ok(step3.payload);
        assert.strictEqual(step3.payloadStatus, 'AVAILABLE');
        assert.strictEqual(step3.unavailabilityReason, undefined);

        // Parameter shows exact address
        const receiverParam = step3.parameters.find((p) => p.name === 'receiver')!;
        assert.strictEqual(receiverParam.value, validReceiver);
        assert.strictEqual(receiverParam.formatted, validReceiver);

        // Encoded calldata ends with the 32-byte padded receiver address
        const expectedPaddedAddress = '0000000000000000000000008888888888888888888888888888888888888888';
        assert.ok(
          step3.payload.data.endsWith(expectedPaddedAddress),
          'Step 3 calldata data payload must encode the exact receiver address'
        );

        // No ACTION REQUIRED warning present when valid address is provided
        assert.ok(
          !step3.risksAndConstraints.some((r) => r.includes('ACTION REQUIRED')),
          'Should not contain action required warning when receiver is valid'
        );
      });

      it('works identically for Faroo Instant DEX with valid receiver address', () => {
        const validReceiver = '0x7777777777777777777777777777777777777777';
        const review = TransactionReviewer.generateReview({
          strategyId: 'faroo-instant-dex',
          amountPros: 500,
          userAddress: validReceiver,
        });

        assert.strictEqual(review.receiverStatus, 'VALID');
        assert.strictEqual(review.isReadyForExternalReview, true);
        assert.strictEqual(review.steps[2].payloadStatus, 'AVAILABLE');
        assert.ok(review.steps[2].payload!.data.endsWith('0000000000000000000000007777777777777777777777777777777777777777'));
      });
    });

    describe('Standalone Address Validation Method (validateReceiverAddress)', () => {
      it('correctly categorizes all address types', () => {
        assert.strictEqual(TransactionReviewer.validateReceiverAddress(undefined).status, 'MISSING');
        assert.strictEqual(TransactionReviewer.validateReceiverAddress('').status, 'MISSING');
        assert.strictEqual(TransactionReviewer.validateReceiverAddress('   ').status, 'MISSING');
        assert.strictEqual(TransactionReviewer.validateReceiverAddress('0x0000000000000000000000000000000000000000').status, 'INVALID_ZERO_ADDRESS');
        assert.strictEqual(TransactionReviewer.validateReceiverAddress('0x123').status, 'INVALID_FORMAT');
        assert.strictEqual(TransactionReviewer.validateReceiverAddress('0xGGGG567890123456789012345678901234567890').status, 'INVALID_FORMAT');
        assert.strictEqual(TransactionReviewer.validateReceiverAddress('0x1234567890123456789012345678901234567890').status, 'VALID');
      });
    });
  });
});
