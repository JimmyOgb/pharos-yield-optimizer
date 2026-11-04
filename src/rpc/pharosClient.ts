/**
 * Read-Only JSON-RPC Client for Pharos Pacific Mainnet
 * Chain ID: 1672 (0x688)
 * 
 * Non-custodial, read-only client with strict chain verification,
 * request timeouts, bounded exponential backoff retries, and data provenance stamping.
 */

export const DEFAULT_PHAROS_RPC = 'https://rpc.pharos.xyz';
export const EXPECTED_CHAIN_ID = 1672;
export const EXPECTED_CHAIN_HEX = '0x688';
export const DEFAULT_TIMEOUT_MS = 8_000;
export const DEFAULT_MAX_RETRIES = 3;
export const STALE_DATA_THRESHOLD_SECONDS = 600; // 10 minutes
export const DEFAULT_CACHE_TTL_MS = 3_000; // 3 seconds short-lived cache for serverless RPC protection

export interface RpcClientConfig {
  readonly rpcUrl?: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly cacheTtlMs?: number;
}

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly method: string;
  readonly params: readonly unknown[];
  readonly id: number;
}

export interface JsonRpcResponse<T = unknown> {
  readonly jsonrpc: '2.0';
  readonly id: number;
  readonly result?: T;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

export interface BlockHeaderObservation {
  readonly blockNumber: number;
  readonly blockHash: string;
  readonly blockTimestamp: number; // Unix timestamp in seconds
  readonly baseFeePerGasWei?: bigint;
  readonly observationTimestamp: number;
  readonly rpcEndpoint: string;
  readonly isFresh: boolean;
}

export interface GasPriceObservation {
  readonly gasPriceWei: bigint;
  readonly gasPriceGwei: number;
  readonly blockNumber: number;
  readonly observationTimestamp: number;
  readonly rpcEndpoint: string;
  readonly isFresh: boolean;
}

export class PharosRpcClient {
  public readonly rpcUrl: string;
  public readonly timeoutMs: number;
  public readonly maxRetries: number;
  public readonly cacheTtlMs: number;
  private requestId = 1;
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();

  constructor(config: RpcClientConfig = {}) {
    this.rpcUrl = config.rpcUrl ?? DEFAULT_PHAROS_RPC;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }

  /**
   * Clears the in-memory response cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Executes a low-level JSON-RPC request with timeout, caching, and exponential backoff retry
   */
  public async request<T = unknown>(method: string, params: readonly unknown[] = []): Promise<T> {
    const cacheKey = `${method}:${JSON.stringify(params)}`;
    if (this.cacheTtlMs > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.value as T;
      }
    }

    const payload: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: this.requestId++,
    };

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(this.rpcUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as JsonRpcResponse<T>;

        if (data.error) {
          throw new Error(`RPC error [${data.error.code}]: ${data.error.message}`);
        }

        if (data.result === undefined) {
          throw new Error('RPC response missing result field');
        }

        if (this.cacheTtlMs > 0) {
          this.cache.set(cacheKey, {
            value: data.result,
            expiresAt: Date.now() + this.cacheTtlMs,
          });
        }

        return data.result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        
        // If aborted due to timeout, specify timeout error
        if (lastError.name === 'AbortError') {
          lastError = new Error(`RPC request timed out after ${this.timeoutMs}ms (method: ${method})`);
        }

        // Only retry if attempts remain
        if (attempt < this.maxRetries) {
          const backoffDelay = Math.min(300 * Math.pow(2, attempt - 1), 2000);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    throw new Error(
      `RPC request failed after ${this.maxRetries} attempts (method: ${method}, url: ${this.rpcUrl}): ${lastError?.message}`
    );
  }

  /**
   * Verifies that the connected RPC endpoint belongs strictly to Pharos Pacific Mainnet (Chain ID: 1672)
   */
  public async verifyChainId(): Promise<{ chainId: number; chainIdHex: string; isVerified: boolean }> {
    const hex = await this.request<string>('eth_chainId');
    const chainId = parseInt(hex, 16);

    if (chainId !== EXPECTED_CHAIN_ID) {
      throw new Error(
        `Chain ID mismatch! Expected ${EXPECTED_CHAIN_ID} (${EXPECTED_CHAIN_HEX}), received ${chainId} (${hex}) from ${this.rpcUrl}`
      );
    }

    return {
      chainId,
      chainIdHex: hex,
      isVerified: true,
    };
  }

  /**
   * Retrieves the current block number
   */
  public async getBlockNumber(): Promise<number> {
    const hex = await this.request<string>('eth_blockNumber');
    return parseInt(hex, 16);
  }

  /**
   * Retrieves latest block metadata including block timestamp
   */
  public async getLatestBlockHeader(): Promise<BlockHeaderObservation> {
    const rawBlock = await this.request<{
      number: string;
      hash: string;
      timestamp: string;
      baseFeePerGas?: string;
    }>('eth_getBlockByNumber', ['latest', false]);

    const blockNumber = parseInt(rawBlock.number, 16);
    const blockTimestamp = parseInt(rawBlock.timestamp, 16);
    const observationTimestamp = Math.floor(Date.now() / 1000);
    const isFresh = Math.abs(observationTimestamp - blockTimestamp) <= STALE_DATA_THRESHOLD_SECONDS;

    return {
      blockNumber,
      blockHash: rawBlock.hash,
      blockTimestamp,
      baseFeePerGasWei: rawBlock.baseFeePerGas ? BigInt(rawBlock.baseFeePerGas) : undefined,
      observationTimestamp,
      rpcEndpoint: this.rpcUrl,
      isFresh,
    };
  }

  /**
   * Retrieves live gas price from node
   */
  public async getGasPrice(): Promise<GasPriceObservation> {
    const [gasHex, blockNumber] = await Promise.all([
      this.request<string>('eth_gasPrice'),
      this.getBlockNumber(),
    ]);

    const gasPriceWei = BigInt(gasHex);
    const gasPriceGwei = Number(gasPriceWei) / 1e9;
    const observationTimestamp = Math.floor(Date.now() / 1000);

    return {
      gasPriceWei,
      gasPriceGwei,
      blockNumber,
      observationTimestamp,
      rpcEndpoint: this.rpcUrl,
      isFresh: true,
    };
  }

  /**
   * Executes a read-only smart contract call (eth_call)
   */
  public async call(to: string, data: string, blockTag = 'latest'): Promise<string> {
    return this.request<string>('eth_call', [
      {
        to,
        data,
      },
      blockTag,
    ]);
  }
}
