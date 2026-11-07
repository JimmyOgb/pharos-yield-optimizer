import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  NativePosAdapter,
  NATIVE_POS_PRECOMPILE_ADDRESS,
  DEFAULT_REFERENCE_VALIDATOR_POOL_ID,
  DEFAULT_REFERENCE_DELEGATOR_ADDRESS,
  POS_SELECTORS,
} from '../../src/adapters/nativePosAdapter.ts';
import { PharosRpcClient } from '../../src/rpc/pharosClient.ts';
import { NATIVE_POS_RISK_DISCLOSURE, FORWARD_SCENARIO_ASSUMPTION_850_BPS } from '../../src/types/index.ts';

describe('NativePosAdapter - Unit Tests with Mocked Fixtures', () => {
  it('correctly encodes getDelegator calldata', () => {
    const calldata = NativePosAdapter.encodeGetDelegatorCalldata(
      DEFAULT_REFERENCE_VALIDATOR_POOL_ID,
      DEFAULT_REFERENCE_DELEGATOR_ADDRESS
    );

    assert.ok(calldata.startsWith(POS_SELECTORS.GET_DELEGATOR));
    // Selector (8 hex) + poolId (64 hex) + padded delegator (64 hex) = 136 hex chars + '0x' = 138 (or 136 without 0x)
    assert.strictEqual(calldata.length, 10 + 64 + 64);
    assert.ok(calldata.includes(DEFAULT_REFERENCE_VALIDATOR_POOL_ID.slice(2)));
    assert.ok(calldata.includes(DEFAULT_REFERENCE_DELEGATOR_ADDRESS.slice(2).toLowerCase()));
  });

  it('rejects malformed poolId or delegator address in calldata encoding', () => {
    assert.throws(
      () => NativePosAdapter.encodeGetDelegatorCalldata('0x123', DEFAULT_REFERENCE_DELEGATOR_ADDRESS),
      /Invalid poolId: expected 64 hex characters/
    );
    assert.throws(
      () => NativePosAdapter.encodeGetDelegatorCalldata(DEFAULT_REFERENCE_VALIDATOR_POOL_ID, '0xbad'),
      /Invalid delegator address: expected 40 hex characters/
    );
  });

  it('correctly decodes the 9-word getDelegator EVM ABI return tuple', () => {
    // 9 words of 64 hex chars
    const word0 = '000000000000000000000000000000000000000000000c3f3522bdae0e40a4ca'; // principalStake: 57,834.3715 PROS
    const word1 = '000000000000000000000000000000000000000000000c3f3522bdae0e40a4ca'; // stake
    const word2 = '00000000000000000000000000000000000000000007b730e364feadfc646ace'; // accumulatedRewardPerShare
    const word3 = '0000000000000000000000000000000000000000000000000000000000000000'; // rewards (accrued unclaimed)
    const word4 = '0000000000000000000000000000000000000000000000000000000000000000'; // pendingStake
    const word5 = '0000000000000000000000000000000000000000000000000000000000000000'; // pendingWithdrawStake
    const word6 = '0000000000000000000000000000000000000000000000000000000000000000'; // pendingWithdrawWindow
    const word7 = '00000000000000000000000000000000000000000000001bc12595adc3695e5f'; // totalRewardsClaimed: 511.9797 PROS
    const word8 = '0000000000000000000000000000000000000000000000000000000000000000'; // isPendingUndelegate: false

    const rawHex = '0x' + word0 + word1 + word2 + word3 + word4 + word5 + word6 + word7 + word8;
    const decoded = NativePosAdapter.decodeDelegatorTuple(rawHex);

    assert.strictEqual(decoded.principalStakeWei, 57834371502267923735754n);
    assert.strictEqual(decoded.stakeWei, 57834371502267923735754n);
    assert.strictEqual(decoded.rewardsWei, 0n);
    assert.strictEqual(decoded.totalRewardsClaimedWei, 511979784787156622943n);
    assert.strictEqual(decoded.isPendingUndelegate, false);
  });

  it('rejects truncated delegator tuple with fewer than 9 words', () => {
    assert.throws(
      () => NativePosAdapter.decodeDelegatorTuple('0x1234'),
      /Invalid getDelegator return length: expected at least 576 hex chars/
    );
  });

  it('fetches live state with mocked RPC client', async () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const nowSec = Math.floor(Date.now() / 1000);

    client.getLatestBlockHeader = async () => ({
      blockNumber: 22_350_000,
      blockHash: '0x123',
      blockTimestamp: nowSec - 10,
      observationTimestamp: nowSec,
      rpcEndpoint: client.rpcUrl,
      isFresh: true,
    });

    (client as any).request = async (method: string) => {
      if (method === 'eth_getBalance') {
        // 283,924,850.2879 Native PROS
        return '0xeadb6cf9a9478ea10ae2c0';
      }
      throw new Error(`Unexpected method: ${method}`);
    };

    client.call = async (to) => {
      assert.strictEqual(to, NATIVE_POS_PRECOMPILE_ADDRESS);
      const word0 = '000000000000000000000000000000000000000000000c3f3522bdae0e40a4ca';
      const zeroes = '0000000000000000000000000000000000000000000000000000000000000000';
      const word7 = '00000000000000000000000000000000000000000000001bc12595adc3695e5f';
      return '0x' + word0 + word0 + zeroes + zeroes + zeroes + zeroes + zeroes + word7 + zeroes;
    };

    const adapter = new NativePosAdapter(client);
    const obs = await adapter.fetchLiveState();

    assert.strictEqual(obs.chainId, 1672);
    assert.strictEqual(obs.precompileAddress, NATIVE_POS_PRECOMPILE_ADDRESS);
    assert.strictEqual(obs.blockNumber, 22_350_000);
    assert.ok(obs.totalNetworkStakedFormatted.includes('283,924,850'));
    assert.strictEqual(obs.delegatorTuple.totalRewardsClaimedWei, 511979784787156622943n);
    assert.strictEqual(obs.isFresh, true);
    assert.strictEqual(obs.provenance, 'VERIFIED_ONCHAIN');
  });

  it('correctly derives historical realized APR from multi-block observations', () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const adapter = new NativePosAdapter(client);

    const startObs = {
      chainId: 1672,
      precompileAddress: NATIVE_POS_PRECOMPILE_ADDRESS,
      blockNumber: 22_004_812,
      blockTimestamp: 1_793_600_000,
      observationTimestamp: 1_793_600_000,
      totalNetworkStakedWei: 283_000_000n * 10n ** 18n,
      totalNetworkStakedFormatted: '283,000,000.0000',
      delegatorTuple: {
        principalStakeWei: 57_834n * 10n ** 18n,
        stakeWei: 57_834n * 10n ** 18n,
        accumulatedRewardPerShare: 0n,
        rewardsWei: 0n,
        pendingStakeWei: 0n,
        pendingWithdrawStakeWei: 0n,
        pendingWithdrawWindow: 0n,
        totalRewardsClaimedWei: 326n * 10n ** 18n,
        isPendingUndelegate: false,
      },
      rawTupleHex: '0x',
      poolId: DEFAULT_REFERENCE_VALIDATOR_POOL_ID,
      delegatorAddress: DEFAULT_REFERENCE_DELEGATOR_ADDRESS,
      rpcEndpoint: client.rpcUrl,
      provenance: 'VERIFIED_ONCHAIN' as const,
      isFresh: true,
    };

    const endObs = {
      ...startObs,
      blockNumber: 22_348_500,
      blockTimestamp: 1_793_600_000 + 328_354, // 3.80 days later
      delegatorTuple: {
        ...startObs.delegatorTuple,
        totalRewardsClaimedWei: (326n + 180n) * 10n ** 18n, // +180 PROS earned
      },
    };

    const result = adapter.deriveHistoricalRealizedApr(startObs, endObs);
    assert.strictEqual(result.isShortObservationWarning, true);
    assert.ok(result.aprPercentage > 28 && result.aprPercentage < 31); // ~29.9% APR
    assert.strictEqual(result.earnedRewardsWei, 180n * 10n ** 18n);
  });

  it('enforces 21-day unbonding constraint and exact required risk wording', () => {
    const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
    const adapter = new NativePosAdapter(client);

    const nowSec = Math.floor(Date.now() / 1000);
    const obs = {
      chainId: 1672,
      precompileAddress: NATIVE_POS_PRECOMPILE_ADDRESS,
      blockNumber: 22_350_000,
      blockTimestamp: nowSec - 20,
      observationTimestamp: nowSec,
      totalNetworkStakedWei: 283_924_850n * 10n ** 18n,
      totalNetworkStakedFormatted: '283,924,850.2879',
      delegatorTuple: {
        principalStakeWei: 57_834n * 10n ** 18n,
        stakeWei: 57_834n * 10n ** 18n,
        accumulatedRewardPerShare: 0n,
        rewardsWei: 0n,
        pendingStakeWei: 0n,
        pendingWithdrawStakeWei: 0n,
        pendingWithdrawWindow: 0n,
        totalRewardsClaimedWei: 511n * 10n ** 18n,
        isPendingUndelegate: false,
      },
      rawTupleHex: '0x',
      poolId: DEFAULT_REFERENCE_VALIDATOR_POOL_ID,
      delegatorAddress: DEFAULT_REFERENCE_DELEGATOR_ADDRESS,
      rpcEndpoint: client.rpcUrl,
      provenance: 'VERIFIED_ONCHAIN' as const,
      isFresh: true,
    };

    const normalized = adapter.toNormalizedSource(obs);
    assert.strictEqual(normalized.id, 'native-pos-staking');
    assert.strictEqual(normalized.qualificationStatus, 'LIVE_INFORMATIONAL');
    assert.strictEqual(normalized.operationalStatus, 'NOT_AVAILABLE_FOR_ENTRY');
    assert.strictEqual(normalized.lockupRequirements.lockupDays, 21);
    assert.strictEqual(normalized.lockupRequirements.totalSettlementDays, 21);
    assert.strictEqual(normalized.lockupRequirements.minHoldingDaysForActionable, 21);
    assert.strictEqual(normalized.isActionableRecommendationDestination, false);

    // Exact risk wording verification
    assert.strictEqual(
      normalized.riskDisclosures[0],
      'No ERC-4626 wrapper or third-party staking-contract exposure; native protocol, precompile implementation, consensus, and validator-related risks remain.'
    );
    assert.strictEqual(normalized.riskDisclosures[0], NATIVE_POS_RISK_DISCLOSURE);

    // Forward scenario restriction check: 8.50% only in forwardScenarioAssumption
    assert.strictEqual(normalized.forwardScenarioAssumption?.scenarioRateBps, FORWARD_SCENARIO_ASSUMPTION_850_BPS);
    assert.strictEqual(normalized.forwardScenarioAssumption?.scenarioRatePercentage, 8.5);
    assert.strictEqual((normalized.decodedState as any).liveRateApr, undefined);
  });
});
