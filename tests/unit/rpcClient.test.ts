import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  PharosRpcClient,
  EXPECTED_CHAIN_ID,
  EXPECTED_CHAIN_HEX,
} from '../../src/rpc/pharosClient.ts';

// Deterministic test fixtures for mocked fetch
function createMockFetch(
  handler: (method: string, params: readonly unknown[]) => Promise<unknown> | unknown
) {
  return async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse((init?.body as string) || '{}');
    try {
      const result = await handler(body.method, body.params || []);
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (err: any) {
      if (err.rpcCode) {
        return new Response(
          JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            error: { code: err.rpcCode, message: err.message },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }
  };
}

describe('PharosRpcClient - Unit Tests with Mocked Fixtures', () => {
  it('verifies correct chain ID (1672 / 0x688)', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = createMockFetch((method) => {
        if (method === 'eth_chainId') return EXPECT_HEX_ID;
        throw new Error(`Unexpected method: ${method}`);
      }) as any;
      const EXPECT_HEX_ID = EXPECTED_CHAIN_HEX;

      const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
      const verification = await client.verifyChainId();

      assert.strictEqual(verification.chainId, EXPECTED_CHAIN_ID);
      assert.strictEqual(verification.chainIdHex, EXPECTED_CHAIN_HEX);
      assert.strictEqual(verification.isVerified, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects chain ID mismatch (e.g. Chain ID 1 Ethereum Mainnet)', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = createMockFetch((method) => {
        if (method === 'eth_chainId') return '0x1'; // Chain 1
        throw new Error(`Unexpected method: ${method}`);
      }) as any;

      const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
      await assert.rejects(
        () => client.verifyChainId(),
        /Chain ID mismatch! Expected 1672/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles RPC error responses cleanly', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = createMockFetch(() => {
        const err: any = new Error('Method not found');
        err.rpcCode = -32601;
        throw err;
      }) as any;

      const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc', maxRetries: 1 });
      await assert.rejects(
        () => client.request('custom_invalidMethod'),
        /RPC error \[-32601\]: Method not found/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('handles malformed responses missing result field', async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }) as any;

      const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc', maxRetries: 1 });
      await assert.rejects(
        () => client.request('eth_blockNumber'),
        /RPC response missing result field/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retries on transient HTTP 500 failure and succeeds on retry', async () => {
    const originalFetch = globalThis.fetch;
    let attempts = 0;
    try {
      globalThis.fetch = (async (_input: any, init: any) => {
        attempts++;
        if (attempts === 1) {
          return new Response('Internal Server Error', { status: 500 });
        }
        const body = JSON.parse(init.body);
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: body.id, result: '0x150276c' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }) as any;

      const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc', maxRetries: 3 });
      const blockNum = await client.getBlockNumber();

      assert.strictEqual(attempts, 2);
      assert.strictEqual(blockNum, 22_030_188);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('exhausts bounded retries and throws descriptive error', async () => {
    const originalFetch = globalThis.fetch;
    let attempts = 0;
    try {
      globalThis.fetch = (async () => {
        attempts++;
        return new Response('Gateway Timeout', { status: 504 });
      }) as any;

      const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc', maxRetries: 2 });
      await assert.rejects(
        () => client.getBlockNumber(),
        /RPC request failed after 2 attempts/
      );
      assert.strictEqual(attempts, 2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retrieves block header observation and marks fresh data correctly', async () => {
    const originalFetch = globalThis.fetch;
    const nowSeconds = Math.floor(Date.now() / 1000);
    try {
      globalThis.fetch = createMockFetch((method) => {
        if (method === 'eth_getBlockByNumber') {
          return {
            number: '0x150276c',
            hash: '0xfaa894ae4be9bce1d96a77d97675c713e9c388ed464f1b3f6d6140d31e07a30a',
            timestamp: '0x' + (nowSeconds - 15).toString(16), // 15 seconds ago
            baseFeePerGas: '0x2540be400',
          };
        }
        throw new Error(`Unexpected: ${method}`);
      }) as any;

      const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
      const header = await client.getLatestBlockHeader();

      assert.strictEqual(header.blockNumber, 22_030_188);
      assert.strictEqual(header.isFresh, true);
      assert.strictEqual(header.baseFeePerGasWei, 10_000_000_000n);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('marks data as not fresh if block timestamp is over threshold (> 10m)', async () => {
    const originalFetch = globalThis.fetch;
    const nowSeconds = Math.floor(Date.now() / 1000);
    try {
      globalThis.fetch = createMockFetch((method) => {
        if (method === 'eth_getBlockByNumber') {
          return {
            number: '0x1000000',
            hash: '0xabc',
            timestamp: '0x' + (nowSeconds - 1200).toString(16), // 20 minutes ago
          };
        }
        throw new Error(`Unexpected: ${method}`);
      }) as any;

      const client = new PharosRpcClient({ rpcUrl: 'http://mock-rpc' });
      const header = await client.getLatestBlockHeader();

      assert.strictEqual(header.isFresh, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
