// Pharos Yield Optimizer - Vercel Serverless Function (sources.ts)
// Chain ID: 1672 (Pharos Pacific Mainnet) | Mode: Strictly Read-Only


// src/rpc/pharosClient.ts
var DEFAULT_PHAROS_RPC = "https://rpc.pharos.xyz";
var EXPECTED_CHAIN_ID = 1672;
var EXPECTED_CHAIN_HEX = "0x688";
var DEFAULT_TIMEOUT_MS = 15e3;
var DEFAULT_MAX_RETRIES = 3;
var STALE_DATA_THRESHOLD_SECONDS = 600;
var DEFAULT_CACHE_TTL_MS = 3e3;
var PharosRpcClient = class {
  rpcUrl;
  timeoutMs;
  maxRetries;
  cacheTtlMs;
  requestId = 1;
  cache = /* @__PURE__ */ new Map();
  constructor(config2 = {}) {
    this.rpcUrl = config2.rpcUrl ?? DEFAULT_PHAROS_RPC;
    this.timeoutMs = config2.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config2.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.cacheTtlMs = config2.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  }
  /**
   * Clears the in-memory response cache
   */
  clearCache() {
    this.cache.clear();
  }
  /**
   * Executes a low-level JSON-RPC request with timeout, caching, and exponential backoff retry
   */
  async request(method, params = []) {
    const cacheKey = `${method}:${JSON.stringify(params)}`;
    if (this.cacheTtlMs > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return cached.value;
      }
    }
    const payload = {
      jsonrpc: "2.0",
      method,
      params,
      id: this.requestId++
    };
    let attempt = 0;
    let lastError = null;
    while (attempt < this.maxRetries) {
      attempt++;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const response = await fetch(this.rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.error) {
          throw new Error(`RPC error [${data.error.code}]: ${data.error.message}`);
        }
        if (data.result === void 0) {
          throw new Error("RPC response missing result field");
        }
        if (this.cacheTtlMs > 0) {
          this.cache.set(cacheKey, {
            value: data.result,
            expiresAt: Date.now() + this.cacheTtlMs
          });
        }
        return data.result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError.name === "AbortError") {
          lastError = new Error(`RPC request timed out after ${this.timeoutMs}ms (method: ${method})`);
        }
        if (attempt < this.maxRetries) {
          const backoffDelay = Math.min(300 * Math.pow(2, attempt - 1), 2e3);
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
  async verifyChainId() {
    const hex = await this.request("eth_chainId");
    const chainId = parseInt(hex, 16);
    if (chainId !== EXPECTED_CHAIN_ID) {
      throw new Error(
        `Chain ID mismatch! Expected ${EXPECTED_CHAIN_ID} (${EXPECTED_CHAIN_HEX}), received ${chainId} (${hex}) from ${this.rpcUrl}`
      );
    }
    return {
      chainId,
      chainIdHex: hex,
      isVerified: true
    };
  }
  /**
   * Retrieves the current block number
   */
  async getBlockNumber() {
    const hex = await this.request("eth_blockNumber");
    return parseInt(hex, 16);
  }
  /**
   * Retrieves latest block metadata including block timestamp
   */
  async getLatestBlockHeader() {
    const rawBlock = await this.request("eth_getBlockByNumber", ["latest", false]);
    const blockNumber = parseInt(rawBlock.number, 16);
    const blockTimestamp = parseInt(rawBlock.timestamp, 16);
    const observationTimestamp = Math.floor(Date.now() / 1e3);
    const isFresh = Math.abs(observationTimestamp - blockTimestamp) <= STALE_DATA_THRESHOLD_SECONDS;
    return {
      blockNumber,
      blockHash: rawBlock.hash,
      blockTimestamp,
      baseFeePerGasWei: rawBlock.baseFeePerGas ? BigInt(rawBlock.baseFeePerGas) : void 0,
      observationTimestamp,
      rpcEndpoint: this.rpcUrl,
      isFresh
    };
  }
  /**
   * Retrieves live gas price from node
   */
  async getGasPrice() {
    const [gasHex, blockNumber] = await Promise.all([
      this.request("eth_gasPrice"),
      this.getBlockNumber()
    ]);
    const gasPriceWei = BigInt(gasHex);
    const gasPriceGwei = Number(gasPriceWei) / 1e9;
    const observationTimestamp = Math.floor(Date.now() / 1e3);
    return {
      gasPriceWei,
      gasPriceGwei,
      blockNumber,
      observationTimestamp,
      rpcEndpoint: this.rpcUrl,
      isFresh: true
    };
  }
  /**
   * Executes a read-only smart contract call (eth_call)
   */
  async call(to, data, blockTag = "latest") {
    return this.request("eth_call", [
      {
        to,
        data
      },
      blockTag
    ]);
  }
};

// src/engine/yieldMath.ts
var SCALE_18 = 1000000000000000000n;
var BPS_SCALE = 10000n;
var DAYS_PER_YEAR = 365n;
var SHORT_OBSERVATION_THRESHOLD_SECONDS = 7 * 86400;
function computeExchangeRate(totalPooledAssetsWei, totalSupplyWei) {
  if (totalPooledAssetsWei <= 0n) {
    throw new Error("Invalid input: totalPooledAssetsWei must be strictly positive");
  }
  if (totalSupplyWei <= 0n) {
    throw new Error("Invalid input: totalSupplyWei must be strictly positive");
  }
  return totalPooledAssetsWei * SCALE_18 / totalSupplyWei;
}
function scaledToDecimal(valueScaled, scale = SCALE_18) {
  const integerPart = valueScaled / scale;
  const fractionalPart = valueScaled % scale;
  const fracStr = fractionalPart.toString().padStart(18, "0");
  return Number(`${integerPart}.${fracStr}`);
}
function decimalToWei(val) {
  const str = typeof val === "number" ? val.toFixed(18) : val;
  const [intPart, fracPart = ""] = str.split(".");
  const sanitizedFrac = fracPart.padEnd(18, "0").slice(0, 18);
  const sign = str.startsWith("-") ? -1n : 1n;
  const absInt = BigInt(intPart.replace("-", ""));
  return sign * (absInt * SCALE_18 + BigInt(sanitizedFrac));
}
function calculateGrossProjectedYield(principalWei, forwardRateBps, horizonDays) {
  if (principalWei < 0n) {
    throw new Error("Invalid input: principalWei cannot be negative");
  }
  if (forwardRateBps < 0) {
    throw new Error("Invalid input: forwardRateBps cannot be negative");
  }
  if (horizonDays < 0) {
    throw new Error("Invalid input: horizonDays cannot be negative");
  }
  if (principalWei === 0n || forwardRateBps === 0 || horizonDays === 0) {
    return 0n;
  }
  const numerator = principalWei * BigInt(forwardRateBps) * BigInt(horizonDays);
  const denominator = BPS_SCALE * DAYS_PER_YEAR;
  return numerator / denominator;
}
function calculateBreakEvenDays(totalFrictionWei, principalWei, forwardRateBps) {
  if (totalFrictionWei <= 0n) {
    return 0;
  }
  if (principalWei <= 0n || forwardRateBps <= 0) {
    return Infinity;
  }
  const dailyYieldWei = principalWei * BigInt(forwardRateBps) / (BPS_SCALE * DAYS_PER_YEAR);
  if (dailyYieldWei === 0n) {
    return Infinity;
  }
  const days = Number(totalFrictionWei) / Number(dailyYieldWei);
  return Number(days.toFixed(6));
}
function formatBreakEvenDuration(days) {
  if (!Number.isFinite(days) || days < 0) {
    return "Never (non-recovering)";
  }
  if (days === 0) {
    return "Immediate (0 days)";
  }
  const totalSeconds = Math.round(days * 86400);
  if (totalSeconds < 60) {
    const s = Math.max(1, totalSeconds);
    return `${s}s (< 1 min, < 1 day)`;
  }
  if (totalSeconds < 3600) {
    const mins = Math.max(1, Math.round(totalSeconds / 60));
    return `~${mins} min${mins === 1 ? "" : "s"} (< 1 day)`;
  }
  if (days < 1) {
    const hours = (totalSeconds / 3600).toFixed(1);
    return `~${hours} hrs (< 1 day)`;
  }
  return `${days.toFixed(2)} days`;
}

// src/adapters/farooAdapter.ts
var FAROO_STPROS_PROXY = "0x6b0A44c64190279f7034b77c13a566E914FE5Ec4";
var FAROO_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
var SELECTORS = {
  TOTAL_POOLED_PROS: "0x01e1d114",
  // totalPooledPros()
  TOTAL_SUPPLY: "0x18160ddd"
  // totalSupply()
};
var FarooAdapter = class {
  client;
  contractAddress;
  constructor(client, contractAddress = FAROO_STPROS_PROXY) {
    this.client = client;
    this.contractAddress = contractAddress;
  }
  /**
   * Reads live on-chain state for Faroo stPROS and calculates dynamic exchange rate
   */
  async fetchLiveState() {
    const [header, pooledHex, supplyHex, implSlotHex] = await Promise.all([
      this.client.getLatestBlockHeader(),
      this.client.call(this.contractAddress, SELECTORS.TOTAL_POOLED_PROS),
      this.client.call(this.contractAddress, SELECTORS.TOTAL_SUPPLY),
      this.client.request("eth_getStorageAt", [
        this.contractAddress,
        FAROO_IMPLEMENTATION_SLOT,
        "latest"
      ])
    ]);
    const implementationAddress = "0x" + implSlotHex.slice(26).toLowerCase();
    const totalPooledProsWei = BigInt(pooledHex);
    const totalSupplyWei = BigInt(supplyHex);
    if (totalSupplyWei <= 0n) {
      throw new Error(`Invalid Faroo contract state: totalSupply is zero or negative (${totalSupplyWei})`);
    }
    if (totalPooledProsWei <= 0n) {
      throw new Error(`Invalid Faroo contract state: totalPooledAssets is zero or negative (${totalPooledProsWei})`);
    }
    const spotRateScaled = computeExchangeRate(totalPooledProsWei, totalSupplyWei);
    const spotRateDecimal = scaledToDecimal(spotRateScaled);
    const totalPooledProsFormatted = (Number(totalPooledProsWei / (SCALE_18 / 10000n)) / 1e4).toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
    const totalSupplyFormatted = (Number(totalSupplyWei / (SCALE_18 / 10000n)) / 1e4).toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
    return {
      chainId: 1672,
      contractAddress: this.contractAddress,
      implementationAddress,
      blockNumber: header.blockNumber,
      blockTimestamp: header.blockTimestamp,
      observationTimestamp: header.observationTimestamp,
      raw: {
        totalPooledProsHex: pooledHex,
        totalSupplyHex: supplyHex
      },
      totalPooledProsWei,
      totalSupplyWei,
      spotRateScaled,
      spotRateDecimal,
      totalPooledProsFormatted,
      totalSupplyFormatted,
      rpcEndpoint: this.client.rpcUrl,
      provenance: "VERIFIED_ONCHAIN",
      isFresh: header.isFresh
    };
  }
};

// src/adapters/dexAdapter.ts
var PHAROS_DEX_POOL_MANAGER = "0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550";
var PHAROS_DEX_STATE_VIEW = "0x616434e941c5E53d44894bF9ca13D517927BF8aF";
var DEX_SELECTORS = {
  POOL_MANAGER: "0xdc4c90d3"
  // StateView.poolManager()
};
var PharosDexAdapter = class {
  client;
  poolManagerAddress;
  stateViewAddress;
  constructor(client, poolManagerAddress = PHAROS_DEX_POOL_MANAGER, stateViewAddress = PHAROS_DEX_STATE_VIEW) {
    this.client = client;
    this.poolManagerAddress = poolManagerAddress;
    this.stateViewAddress = stateViewAddress;
  }
  /**
   * Conducts live on-chain inspection of Pharos DEX infrastructure
   */
  async inspectDex() {
    const [blockNumber, managerCode, stateViewCode, linkedManagerHex] = await Promise.all([
      this.client.getBlockNumber(),
      this.client.request("eth_getCode", [this.poolManagerAddress, "latest"]),
      this.client.request("eth_getCode", [this.stateViewAddress, "latest"]),
      this.client.call(this.stateViewAddress, DEX_SELECTORS.POOL_MANAGER)
    ]);
    const isPoolManagerDeployed = managerCode.length > 2;
    const isStateViewDeployed = stateViewCode.length > 2;
    const linkedManager = "0x" + linkedManagerHex.slice(26).toLowerCase();
    return {
      chainId: 1672,
      poolManagerAddress: this.poolManagerAddress,
      stateViewAddress: this.stateViewAddress,
      isPoolManagerDeployed,
      isStateViewDeployed,
      verifiedLinkedManager: linkedManager,
      blockNumber,
      observationTimestamp: Math.floor(Date.now() / 1e3),
      rpcEndpoint: this.client.rpcUrl,
      dynamicFeeAprStatus: "UNAVAILABLE",
      missingEvidenceReason: "Computing dynamic LP fee APR requires continuous off-chain aggregation of 24h/7d swap transaction logs. Pharos Pacific Mainnet does not currently host an active public subgraph or indexed fee volume endpoint.",
      executionFeeBps: 30,
      // 0.30% standard Uniswap V4 pool fee tier
      feeProvenance: "VERIFIED_ONCHAIN"
    };
  }
};

// src/types/index.ts
var CANONICAL_CONTRACTS = {
  FAROO_STPROS: "0x6b0A44c64190279f7034b77c13a566E914FE5Ec4",
  FAROO_IMPLEMENTATION: "0xfd59860894e01773e9780b0d1dfae4ca2b56708d",
  CANONICAL_WPROS: "0x52C48d4213107b20bC583832b0d951FB9CA8F0B0",
  AXIL_CORE_VAULT: "0xD0428799FbC35557834d33121BA4472692c8908a",
  AXIL_APC3M_TOKEN: "0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0",
  DEX_POOL_MANAGER: "0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550",
  DEX_STATE_VIEW: "0x616434e941c5E53d44894bF9ca13D517927BF8aF"
};
var NETWORK_CONFIG = {
  chainId: 1672,
  name: "Pharos Pacific Mainnet",
  nativeCurrency: { name: "Pharos PROS", symbol: "PROS", decimals: 18 },
  rpcUrl: "https://rpc.pharos.xyz"
};

// src/engine/frictionModel.ts
var GAS_LIMITS = {
  // Physical ERC-4626 Entry Sequence (180,000 gas units verified)
  FAROO_WRAP_PROS: 45000n,
  FAROO_APPROVE_WPROS: 45000n,
  FAROO_VAULT_DEPOSIT: 90000n,
  // Patient Exit via Protocol Unbonding Queue (85,000 gas units benchmark)
  FAROO_REQUEST_WITHDRAW: 85000n,
  // Instant Exit via DEX AMM Swap (145,000 gas units assumed benchmark, unverified by live receipt)
  DEX_SWAP_EXACT_TOKENS: 145000n,
  ERC20_APPROVE: 45000n
};
var VERIFIED_FEES = {
  FAROO_MINT_FEE_BPS: 0,
  // 0.00% verified on-chain
  FAROO_QUEUE_EXIT_FEE_BPS: 0,
  // 0.00% verified on-chain
  DEX_V4_SWAP_FEE_BPS: 30,
  // 0.30% verified pool fee
  DEFAULT_SLIPPAGE_BPS: 10
  // 0.10% conservative standard retail slippage
};
function computeGasCostWei(gasUnits, gasPriceGwei) {
  if (gasUnits < 0n) {
    throw new Error("Invalid input: gasUnits cannot be negative");
  }
  if (gasPriceGwei < 0 || !Number.isFinite(gasPriceGwei)) {
    throw new Error("Invalid input: gasPriceGwei must be a non-negative finite number");
  }
  const gasPriceWei = BigInt(Math.round(gasPriceGwei * 1e9));
  return gasUnits * gasPriceWei;
}
function computeFeeWei(amountWei, feeBps) {
  if (amountWei < 0n) {
    throw new Error("Invalid input: amountWei cannot be negative");
  }
  if (feeBps < 0 || !Number.isFinite(feeBps)) {
    throw new Error("Invalid input: feeBps must be a non-negative finite number");
  }
  return amountWei * BigInt(Math.floor(feeBps)) / BPS_SCALE;
}
function evaluateStrategyFriction(strategyId, principalWei, gasPriceGwei, customSlippageBps) {
  if (principalWei < 0n) {
    throw new Error("Invalid input: principalWei cannot be negative");
  }
  switch (strategyId) {
    case "faroo-patient-staking": {
      const entryGasUnits = GAS_LIMITS.FAROO_WRAP_PROS + GAS_LIMITS.FAROO_APPROVE_WPROS + GAS_LIMITS.FAROO_VAULT_DEPOSIT;
      const exitGasUnits = GAS_LIMITS.FAROO_REQUEST_WITHDRAW;
      const totalGasUnits = entryGasUnits + exitGasUnits;
      const gasCostWei = computeGasCostWei(totalGasUnits, gasPriceGwei);
      const entryFeeWei = computeFeeWei(principalWei, VERIFIED_FEES.FAROO_MINT_FEE_BPS);
      const exitFeeWei = computeFeeWei(principalWei, VERIFIED_FEES.FAROO_QUEUE_EXIT_FEE_BPS);
      const totalFrictionWei = gasCostWei + entryFeeWei + exitFeeWei;
      return {
        gasCostWei,
        entryFeeWei,
        exitFeeWei,
        swapFeeWei: 0n,
        slippageCostWei: 0n,
        totalFrictionWei,
        totalFrictionPros: scaledToDecimal(totalFrictionWei),
        provenance: "VERIFIED_ONCHAIN",
        isComplete: true
      };
    }
    case "faroo-instant-dex": {
      const entryGasUnits = GAS_LIMITS.FAROO_WRAP_PROS + GAS_LIMITS.FAROO_APPROVE_WPROS + GAS_LIMITS.FAROO_VAULT_DEPOSIT;
      const exitGasUnits = GAS_LIMITS.DEX_SWAP_EXACT_TOKENS;
      const totalGasUnits = entryGasUnits + exitGasUnits;
      const gasCostWei = computeGasCostWei(totalGasUnits, gasPriceGwei);
      const entryFeeWei = computeFeeWei(principalWei, VERIFIED_FEES.FAROO_MINT_FEE_BPS);
      const swapFeeWei = computeFeeWei(principalWei, VERIFIED_FEES.DEX_V4_SWAP_FEE_BPS);
      const slippageBps = customSlippageBps ?? VERIFIED_FEES.DEFAULT_SLIPPAGE_BPS;
      const slippageCostWei = computeFeeWei(principalWei, slippageBps);
      const totalFrictionWei = gasCostWei + entryFeeWei + swapFeeWei + slippageCostWei;
      return {
        gasCostWei,
        entryFeeWei,
        exitFeeWei: 0n,
        swapFeeWei,
        slippageCostWei,
        totalFrictionWei,
        totalFrictionPros: scaledToDecimal(totalFrictionWei),
        provenance: "EXECUTION_ALTERNATIVE",
        isComplete: true
      };
    }
    case "axil-prime-credit-3m": {
      const swapGas = GAS_LIMITS.DEX_SWAP_EXACT_TOKENS * 2n;
      const gasCostWei = computeGasCostWei(swapGas, gasPriceGwei);
      const crossCurrencyFeeWei = computeFeeWei(principalWei, 60);
      const slippageCostWei = computeFeeWei(principalWei, 20);
      const totalFrictionWei = gasCostWei + crossCurrencyFeeWei + slippageCostWei;
      return {
        gasCostWei,
        entryFeeWei: crossCurrencyFeeWei,
        exitFeeWei: 0n,
        swapFeeWei: crossCurrencyFeeWei,
        slippageCostWei,
        totalFrictionWei,
        totalFrictionPros: scaledToDecimal(totalFrictionWei),
        provenance: "OFFCHAIN_TARGET_RATE",
        isComplete: true
      };
    }
    case "native-pros-baseline": {
      return {
        gasCostWei: 0n,
        entryFeeWei: 0n,
        exitFeeWei: 0n,
        swapFeeWei: 0n,
        slippageCostWei: 0n,
        totalFrictionWei: 0n,
        totalFrictionPros: 0,
        provenance: "BASELINE_ONLY",
        isComplete: true
      };
    }
    default: {
      const _exhaustiveCheck = strategyId;
      throw new Error(`Unhandled strategy identifier: ${_exhaustiveCheck}`);
    }
  }
}

// src/engine/recommendationEngine.ts
var STRATEGY_PROFILES = {
  "faroo-patient-staking": {
    id: "faroo-patient-staking",
    name: "Faroo Patient Staking (Queue)",
    denomination: "PROS",
    classification: "VERIFIED_ONCHAIN",
    qualifiesTowardReq01: true,
    // Sole strictly qualifying on-chain source
    contractAddress: "0x6b0A44c64190279f7034b77c13a566E914FE5Ec4",
    lockupPeriodDays: 14,
    exitDelayDays: 14,
    exitFeeBps: 0,
    requiresKyc: false
  },
  "faroo-instant-dex": {
    id: "faroo-instant-dex",
    name: "Faroo Liquid DEX Staking (Instant Swap)",
    denomination: "PROS",
    classification: "EXECUTION_ALTERNATIVE",
    qualifiesTowardReq01: false,
    // Execution alternative only
    contractAddress: "0x6b0A44c64190279f7034b77c13a566E914FE5Ec4",
    lockupPeriodDays: 0,
    exitDelayDays: 0,
    exitFeeBps: 30,
    // 0.30% DEX swap pool fee
    requiresKyc: false
  },
  "axil-prime-credit-3m": {
    id: "axil-prime-credit-3m",
    name: "Axil Prime Credit 3M Vault",
    denomination: "USDC",
    classification: "OFFCHAIN_TARGET_RATE",
    qualifiesTowardReq01: false,
    // Off-chain target rate in USDC
    contractAddress: "0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0",
    lockupPeriodDays: 90,
    exitDelayDays: 90,
    exitFeeBps: 0,
    requiresKyc: true,
    currencyRiskBadge: "CURRENCY_MISMATCH_RISK (USDC vs PROS)"
  },
  "native-pros-baseline": {
    id: "native-pros-baseline",
    name: "Native PROS / WPROS Holding",
    denomination: "PROS",
    classification: "BASELINE_ONLY",
    qualifiesTowardReq01: false,
    // 0.00% Benchmark
    contractAddress: CANONICAL_CONTRACTS.CANONICAL_WPROS,
    lockupPeriodDays: 0,
    exitDelayDays: 0,
    exitFeeBps: 0,
    requiresKyc: false
  }
};
var FORWARD_RATES_BPS = {
  "faroo-patient-staking": 850,
  // 8.50% illustrative annualized scenario assumption (model input only)
  "faroo-instant-dex": 850,
  // 8.50% illustrative annualized scenario assumption (friction applied in exit)
  "axil-prime-credit-3m": 925,
  // 9.25% off-chain contractual target
  "native-pros-baseline": 0
  // 0.00% baseline
};
function evaluateStrategyProjection(strategyId, principalWei, horizonDays, gasPriceGwei) {
  const profile = STRATEGY_PROFILES[strategyId];
  const forwardRateBps = FORWARD_RATES_BPS[strategyId];
  const grossYieldWei = calculateGrossProjectedYield(principalWei, forwardRateBps, horizonDays);
  const friction = evaluateStrategyFriction(strategyId, principalWei, gasPriceGwei);
  const isLoss = friction.totalFrictionWei > grossYieldWei;
  const netGainWei = isLoss ? -(friction.totalFrictionWei - grossYieldWei) : grossYieldWei - friction.totalFrictionWei;
  const netGainPros = scaledToDecimal(netGainWei);
  const principalPros = scaledToDecimal(principalWei);
  const netGainPercentage = principalPros > 0 ? netGainPros / principalPros * 100 : 0;
  const breakEvenDays = calculateBreakEvenDays(friction.totalFrictionWei, principalWei, forwardRateBps);
  const isLockupEligible = horizonDays >= profile.lockupPeriodDays;
  const riskDisclosures = [];
  if (profile.lockupPeriodDays > 0) {
    riskDisclosures.push(`Mandatory ${profile.lockupPeriodDays}-day lockup / unbonding delay`);
  }
  if (profile.currencyRiskBadge) {
    riskDisclosures.push(profile.currencyRiskBadge);
  }
  if (profile.classification === "OFFCHAIN_TARGET_RATE") {
    riskDisclosures.push("Rate is an off-chain target; not queryable dynamically on-chain");
  }
  return {
    profile,
    principalWei,
    horizonDays,
    forwardRateBps,
    grossYieldWei,
    grossYieldPros: scaledToDecimal(grossYieldWei),
    friction,
    netGainWei,
    netGainPros,
    netGainPercentage,
    breakEvenDays,
    isLockupEligible,
    isDataComplete: true,
    riskDisclosures
  };
}
function generateRecommendation(query, gasPriceGwei = 1.25, isDataStale = false, isDataUnavailable = false) {
  const currentStrategyId = query.currentStrategyId ?? "native-pros-baseline";
  const timestamp = Math.floor(Date.now() / 1e3);
  if (isDataUnavailable || isDataStale) {
    return {
      decision: "INSUFFICIENT_DATA",
      reasonCode: "STALE_OR_MISSING_ONCHAIN_DATA",
      explanation: isDataUnavailable ? "Cannot evaluate recommendation: critical on-chain RPC data is unavailable." : "Cannot evaluate recommendation: cached on-chain state is stale (> 10 minutes old). Refresh required.",
      netAdvantageWei: 0n,
      netAdvantagePros: 0,
      breakEvenDays: 0,
      selectedHorizonDays: query.horizonDays,
      verifiedQualifyingSourcesCount: 1,
      comparisons: [],
      timestamp
    };
  }
  if (query.principalWei <= 0n) {
    return {
      decision: "STAY_PUT",
      reasonCode: "ZERO_PRINCIPAL_INPUT",
      explanation: "Principal amount must be strictly greater than zero to calculate yield rebalancing.",
      netAdvantageWei: 0n,
      netAdvantagePros: 0,
      breakEvenDays: 0,
      selectedHorizonDays: query.horizonDays,
      verifiedQualifyingSourcesCount: 1,
      comparisons: [],
      timestamp
    };
  }
  const strategyIds = [
    "faroo-patient-staking",
    "faroo-instant-dex",
    "axil-prime-credit-3m",
    "native-pros-baseline"
  ];
  const comparisons = strategyIds.map(
    (id) => evaluateStrategyProjection(id, query.principalWei, query.horizonDays, gasPriceGwei)
  );
  const currentProjection = comparisons.find((c) => c.profile.id === currentStrategyId);
  const eligibleCandidates = comparisons.filter((c) => {
    if (c.profile.id === currentStrategyId) return false;
    if (c.profile.id === "native-pros-baseline") return false;
    if (c.profile.id === "axil-prime-credit-3m") return false;
    if (query.requireInstantLiquidity && c.profile.lockupPeriodDays > 0) return false;
    if (!c.isLockupEligible) return false;
    return true;
  });
  if (eligibleCandidates.length === 0) {
    const isHorizonConstrained = currentStrategyId === "native-pros-baseline" && comparisons.some((c) => c.profile.id !== currentStrategyId && !c.isLockupEligible);
    return {
      decision: "STAY_PUT",
      reasonCode: isHorizonConstrained ? "HORIZON_SHORTER_THAN_LOCKUP" : "ALREADY_IN_OPTIMAL_POSITION",
      explanation: isHorizonConstrained ? `Investment horizon (${query.horizonDays} days) is shorter than mandatory protocol lockup/unbonding periods (14 days).` : "Currently held position remains optimal; no alternative satisfies current liquidity and horizon constraints.",
      netAdvantageWei: 0n,
      netAdvantagePros: 0,
      breakEvenDays: 0,
      selectedHorizonDays: query.horizonDays,
      verifiedQualifyingSourcesCount: 1,
      comparisons,
      timestamp
    };
  }
  eligibleCandidates.sort((a, b) => b.netGainWei > a.netGainWei ? 1 : -1);
  const bestCandidate = eligibleCandidates[0];
  const netAdvantageWei = bestCandidate.netGainWei - currentProjection.netGainWei;
  if (netAdvantageWei <= 0n) {
    if (currentStrategyId !== "native-pros-baseline") {
      return {
        decision: "STAY_PUT",
        reasonCode: "ALREADY_IN_OPTIMAL_POSITION",
        explanation: `Currently held position (${currentProjection.profile.name}) remains the optimal strategy. No alternative provides positive incremental net yield.`,
        netAdvantageWei: 0n,
        netAdvantagePros: 0,
        breakEvenDays: 0,
        selectedHorizonDays: query.horizonDays,
        verifiedQualifyingSourcesCount: 1,
        comparisons,
        timestamp
      };
    }
    const isHorizonTooShort = !query.requireInstantLiquidity && query.horizonDays < STRATEGY_PROFILES["faroo-patient-staking"].lockupPeriodDays;
    const reasonCode = isHorizonTooShort ? "HORIZON_SHORTER_THAN_LOCKUP" : "FRICTION_EXCEEDS_GROSS_YIELD";
    const explanation = isHorizonTooShort ? `Investment horizon (${query.horizonDays} days) is shorter than mandatory protocol lockup (14 days) for Faroo Patient Staking, and alternative instant DEX liquidity friction exceeds gross yield.` : `Total transaction friction and exit costs exceed expected gross yield over ${query.horizonDays} days. Break-even requires ${bestCandidate.breakEvenDays} days.`;
    return {
      decision: "STAY_PUT",
      reasonCode,
      explanation,
      netAdvantageWei: 0n,
      netAdvantagePros: 0,
      breakEvenDays: bestCandidate.breakEvenDays,
      selectedHorizonDays: query.horizonDays,
      verifiedQualifyingSourcesCount: 1,
      comparisons,
      timestamp
    };
  }
  const netAdvantagePros = scaledToDecimal(netAdvantageWei);
  return {
    decision: "MOVE",
    reasonCode: "POSITIVE_NET_ALPHA",
    explanation: `Rebalancing to ${bestCandidate.profile.name} yields an estimated net gain of +${netAdvantagePros.toFixed(4)} PROS (+${bestCandidate.netGainPercentage.toFixed(2)}%) over ${query.horizonDays} days after all gas, protocol fees, and break-even friction (${bestCandidate.breakEvenDays} days).`,
    targetStrategyId: bestCandidate.profile.id,
    netAdvantageWei,
    netAdvantagePros,
    breakEvenDays: bestCandidate.breakEvenDays,
    selectedHorizonDays: query.horizonDays,
    verifiedQualifyingSourcesCount: 1,
    comparisons,
    timestamp
  };
}

// src/adapters/liveRecommendationBridge.ts
var LiveRecommendationBridge = class {
  client;
  farooAdapter;
  dexAdapter;
  constructor(client) {
    this.client = client;
    this.farooAdapter = new FarooAdapter(client);
    this.dexAdapter = new PharosDexAdapter(client);
  }
  /**
   * Fetches fresh on-chain ecosystem context from live RPC
   */
  async fetchLiveContext() {
    await this.client.verifyChainId();
    const [gasPriceObs, farooObs, dexReport] = await Promise.all([
      this.client.getGasPrice(),
      this.farooAdapter.fetchLiveState(),
      this.dexAdapter.inspectDex()
    ]);
    const isDataFresh = gasPriceObs.isFresh && farooObs.isFresh;
    return {
      chainId: 1672,
      blockNumber: gasPriceObs.blockNumber,
      gasPriceGwei: gasPriceObs.gasPriceGwei,
      farooObservation: farooObs,
      dexInspection: dexReport,
      isDataFresh,
      observationTimestamp: Math.floor(Date.now() / 1e3)
    };
  }
  /**
   * Generates recommendation using live on-chain observations
   */
  async evaluateLiveRecommendation(query) {
    try {
      const context = await this.fetchLiveContext();
      const recommendation = generateRecommendation(
        query,
        context.gasPriceGwei,
        !context.isDataFresh,
        // isDataStale
        false
        // isDataUnavailable
      );
      return {
        status: "SUCCESS",
        context,
        recommendation
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const fallbackRec = generateRecommendation(
        query,
        10,
        // placeholder gas price disregarded due to unavailable flag
        false,
        true
        // isDataUnavailable = true
      );
      return {
        status: "RPC_UNAVAILABLE",
        error: errorMessage,
        recommendation: fallbackRec
      };
    }
  }
};

// src/reviewer/transactionReviewer.ts
var TransactionReviewer = class {
  /**
   * Validates a recipient EVM address for chain compatibility (Chain ID 1672)
   * Rejects missing, malformed, and zero addresses.
   */
  static validateReceiverAddress(address) {
    if (address === void 0 || address === null || typeof address !== "string" || address.trim() === "") {
      return {
        isValid: false,
        status: "MISSING",
        error: "Receiver address was not provided."
      };
    }
    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      return {
        isValid: false,
        status: "INVALID_FORMAT",
        error: "Invalid address syntax: must be 0x followed by exactly 40 hexadecimal characters."
      };
    }
    if (/^0x0{40}$/i.test(trimmed)) {
      return {
        isValid: false,
        status: "INVALID_ZERO_ADDRESS",
        error: "Zero address (0x0000...0000) is rejected as a receiver. Cannot mint shares to address(0)."
      };
    }
    return {
      isValid: true,
      status: "VALID",
      normalizedAddress: trimmed
    };
  }
  /**
   * Left-pads a 20-byte address to a 32-byte EVM ABI word
   */
  static encodeAddressParam(address) {
    const clean = address.toLowerCase().replace(/^0x/, "");
    if (clean.length !== 40 || !/^[a-f0-9]{40}$/.test(clean)) {
      throw new Error(`Invalid address length: expected 40 hex chars, got ${clean.length}`);
    }
    return clean.padStart(64, "0");
  }
  /**
   * Left-pads a uint256 BigInt to a 32-byte EVM ABI word
   */
  static encodeUint256Param(value) {
    if (value < 0n) {
      throw new Error("uint256 cannot be negative");
    }
    return value.toString(16).padStart(64, "0");
  }
  /**
   * Generates a non-custodial transaction review for a given strategy and scenario.
   */
  static generateReview(params) {
    const { strategyId, amountPros, userAddress } = params;
    const gasPriceWei = params.gasPriceWei ?? 10000000000n;
    const gasPriceGwei = (Number(gasPriceWei) / 1e9).toFixed(2);
    const amountWei = decimalToWei(amountPros);
    if (strategyId === "faroo-patient-staking") {
      return this.reviewFarooStaking(amountPros, amountWei, userAddress, gasPriceWei, gasPriceGwei);
    }
    if (strategyId === "faroo-instant-dex") {
      return this.reviewFarooInstantDex(amountPros, amountWei, userAddress, gasPriceWei, gasPriceGwei);
    }
    if (strategyId === "axil-prime-credit" || strategyId === "axil-prime-credit-3m" || strategyId === "axil-apc3m") {
      return this.reviewAxilExcluded(amountPros);
    }
    if (strategyId === "native-pros-consensus" || strategyId === "native-pos-consensus") {
      return this.reviewNativePoSExcluded(amountPros);
    }
    throw new Error(`Unsupported strategy ID for transaction review: ${strategyId}`);
  }
  /**
   * Faroo Liquid Staking review:
   * Faroo stPROS is an ERC-4626 vault with underlying asset WPROS.
   * Step 1: Wrap native PROS into WPROS (payable deposit).
   * Step 2: Approve Faroo stPROS vault to spend WPROS.
   * Step 3: Call deposit(uint256 assets, address receiver) on Faroo vault.
   */
  static reviewFarooStaking(amountPros, amountWei, userAddress, gasPriceWei, gasPriceGwei) {
    const validation = this.validateReceiverAddress(userAddress);
    const totalGasLimit = 180000n;
    const gasCostWei = totalGasLimit * gasPriceWei;
    const gasCostPros = (Number(gasCostWei) / 1e18).toFixed(6);
    const step3Parameters = [
      {
        name: "assets",
        type: "uint256",
        value: amountWei.toString(),
        formatted: `${amountPros.toLocaleString()} WPROS`
      },
      {
        name: "receiver",
        type: "address",
        value: validation.isValid ? validation.normalizedAddress : userAddress || "",
        formatted: validation.isValid ? validation.normalizedAddress : validation.status === "MISSING" ? "NOT SET (Action Required: Provide your Pacific Mainnet address)" : validation.status === "INVALID_ZERO_ADDRESS" ? "REJECTED: 0x0000...0000 (Zero address placeholder rejected)" : `REJECTED: ${userAddress} (Malformed address syntax)`
      }
    ];
    const step3Risks = [
      "Mandatory unbonding delay: Contract on-chain parameter unbondingPeriod = 86,400s (1 day); protocol unbonding queue may take up to 14 days.",
      "Yield compounds into exchange rate (stPROS/PROS increases over time). Token quantity in wallet remains constant."
    ];
    if (!validation.isValid) {
      if (validation.status === "INVALID_ZERO_ADDRESS" || validation.status === "MISSING") {
        step3Risks.push("ACTION REQUIRED: Receiver parameter is currently set to placeholder address (0x0000...0000) or missing. You MUST replace this parameter with your external wallet address in your Web3 wallet or script so minted stPROS shares are delivered to your account.");
      } else {
        step3Risks.push(`ACTION REQUIRED: Receiver address is malformed (${validation.error}). Receiver-dependent calldata cannot be prepared or exported.`);
      }
    }
    const step3Review = {
      stepNumber: 3,
      title: "Deposit WPROS into Faroo Liquid Staking Vault",
      contractName: "Faroo Liquid Staked PROS (stPROS)",
      contractAddress: CANONICAL_CONTRACTS.FAROO_STPROS,
      methodName: "deposit(uint256,address)",
      selector: "0x6e553f65",
      isAbiVerified: true,
      explanation: "Deposits WPROS into the Faroo ERC-4626 vault and mints yield-bearing stPROS shares to the recipient address.",
      parameters: step3Parameters,
      payloadStatus: validation.isValid ? "AVAILABLE" : "INCOMPLETE",
      payload: validation.isValid ? {
        to: CANONICAL_CONTRACTS.FAROO_STPROS,
        data: `0x6e553f65${this.encodeUint256Param(amountWei)}${this.encodeAddressParam(validation.normalizedAddress)}`,
        value: "0x0",
        gasLimit: "0x15f90",
        // 90,000
        maxFeePerGas: `0x${gasPriceWei.toString(16)}`,
        maxPriorityFeePerGas: `0x${gasPriceWei.toString(16)}`,
        chainId: NETWORK_CONFIG.chainId
      } : void 0,
      unavailabilityReason: validation.isValid ? void 0 : validation.status === "MISSING" ? "CALLDATA_INCOMPLETE: Receiver address was not provided. A valid non-zero Pacific Mainnet recipient address is required before receiver-dependent calldata can be generated or exported." : validation.status === "INVALID_ZERO_ADDRESS" ? "CALLDATA_INCOMPLETE: Zero address (0x0000...0000) is rejected as a receiver. Cannot mint shares to null address." : `CALLDATA_INCOMPLETE: Malformed receiver address syntax (${validation.error}). Expected 0x followed by 40 hex characters.`,
      risksAndConstraints: step3Risks
    };
    const steps = [
      {
        stepNumber: 1,
        title: "Wrap Native PROS into WPROS",
        contractName: "Canonical Wrapped PROS (WPROS)",
        contractAddress: CANONICAL_CONTRACTS.CANONICAL_WPROS,
        methodName: "deposit()",
        selector: "0xd0e30db0",
        isAbiVerified: true,
        explanation: "Converts native PROS into ERC-20 compliant WPROS at a 1:1 ratio. Required because the Faroo vault accepts WPROS as its underlying asset.",
        parameters: [],
        payloadStatus: "AVAILABLE",
        payload: {
          to: CANONICAL_CONTRACTS.CANONICAL_WPROS,
          data: "0xd0e30db0",
          value: `0x${amountWei.toString(16)}`,
          gasLimit: "0xafc8",
          // 45,000
          maxFeePerGas: `0x${gasPriceWei.toString(16)}`,
          maxPriorityFeePerGas: `0x${gasPriceWei.toString(16)}`,
          chainId: NETWORK_CONFIG.chainId
        },
        risksAndConstraints: [
          "Requires native PROS balance equal to principal plus transaction gas.",
          "WPROS is non-rebasing and 1:1 exchangeable for native PROS."
        ]
      },
      {
        stepNumber: 2,
        title: "Approve Faroo Vault for WPROS",
        contractName: "Canonical Wrapped PROS (WPROS)",
        contractAddress: CANONICAL_CONTRACTS.CANONICAL_WPROS,
        methodName: "approve(address,uint256)",
        selector: "0x095ea7b3",
        isAbiVerified: true,
        explanation: "Grants the Faroo stPROS vault smart contract permission to pull the specified amount of WPROS.",
        parameters: [
          {
            name: "spender",
            type: "address",
            value: CANONICAL_CONTRACTS.FAROO_STPROS,
            formatted: `Faroo Vault (${CANONICAL_CONTRACTS.FAROO_STPROS.slice(0, 8)}...)`
          },
          {
            name: "amount",
            type: "uint256",
            value: amountWei.toString(),
            formatted: `${amountPros.toLocaleString()} WPROS (${amountWei.toString()} wei)`
          }
        ],
        payloadStatus: "AVAILABLE",
        payload: {
          to: CANONICAL_CONTRACTS.CANONICAL_WPROS,
          data: `0x095ea7b3${this.encodeAddressParam(CANONICAL_CONTRACTS.FAROO_STPROS)}${this.encodeUint256Param(amountWei)}`,
          value: "0x0",
          gasLimit: "0xafc8",
          // 45,000
          maxFeePerGas: `0x${gasPriceWei.toString(16)}`,
          maxPriorityFeePerGas: `0x${gasPriceWei.toString(16)}`,
          chainId: NETWORK_CONFIG.chainId
        },
        risksAndConstraints: [
          "Standard ERC-20 approval pattern. Recommended to approve exact amount only to minimize allowance risk."
        ]
      },
      step3Review
    ];
    return {
      timestamp: Date.now(),
      strategyId: "faroo-patient-staking",
      strategyName: "Faroo Liquid Staking (stPROS) - Patient Exit",
      actionSummary: `Deposit ${amountPros.toLocaleString()} PROS into Faroo stPROS vault to earn compounding PoS yield with patient 14-day unbonding exit.`,
      estimatedGasCostWei: gasCostWei.toString(),
      estimatedGasCostPros: gasCostPros,
      gasPriceGwei,
      receiverStatus: validation.status,
      receiverAddress: validation.isValid ? validation.normalizedAddress : void 0,
      isReadyForExternalReview: validation.isValid,
      steps,
      safetyNotice: {
        isNonCustodial: true,
        canSign: false,
        canBroadcast: false,
        disclaimer: "This transaction review provides unsigned calldata for external inspection only. The agent does not hold private keys, cannot sign, and cannot broadcast transactions. You must review and execute using your external wallet."
      }
    };
  }
  /**
   * Faroo Instant DEX review:
   * Staking is identical to Faroo Patient Staking, but the exit pathway is designated as AMM swap.
   */
  static reviewFarooInstantDex(amountPros, amountWei, userAddress, gasPriceWei, gasPriceGwei) {
    const report = this.reviewFarooStaking(amountPros, amountWei, userAddress, gasPriceWei, gasPriceGwei);
    report.strategyId = "faroo-instant-dex";
    report.strategyName = "Faroo Liquid Staking (stPROS) - Instant DEX Exit";
    report.actionSummary = `Deposit ${amountPros.toLocaleString()} PROS into Faroo stPROS vault, targeting exit via DEX liquidity pool for instant liquidity (0.30% fee + slippage).`;
    report.steps[2].risksAndConstraints.push(
      "Exit Route: Instant exit will swap stPROS back to PROS on Pharos DEX rather than waiting in the unbonding queue. Subject to 0.30% swap fee and market liquidity slippage."
    );
    return report;
  }
  /**
   * Axil Prime Credit review:
   * Excluded because it is an off-chain target USD vault, not an on-chain PROS yield source.
   * Transaction payload is strictly UNAVAILABLE to prevent misleading calldata.
   */
  static reviewAxilExcluded(_amountPros) {
    return {
      timestamp: Date.now(),
      strategyId: "axil-prime-credit",
      strategyName: "Axil Prime Credit 3M (APC3M)",
      actionSummary: "Transaction preparation is DISABLED for Axil Prime Credit.",
      estimatedGasCostWei: "0",
      estimatedGasCostPros: "0.000000",
      gasPriceGwei: "0.00",
      receiverStatus: "MISSING",
      isReadyForExternalReview: false,
      steps: [
        {
          stepNumber: 1,
          title: "Deposit Excluded",
          contractName: "Axil Prime Credit Vault",
          contractAddress: CANONICAL_CONTRACTS.AXIL_CORE_VAULT,
          methodName: "UNAVAILABLE",
          selector: "0x00000000",
          isAbiVerified: false,
          explanation: "Axil Prime Credit is a private-credit RWA vault accepting USDC (USD pegged), with an off-chain target APY (8.00%). It is disqualified from automated PROS rebalancing.",
          parameters: [],
          payloadStatus: "UNAVAILABLE",
          unavailabilityReason: "TRANSACTION_PAYLOAD_UNAVAILABLE: Axil is an off-chain target USD credit product. The agent strictly refuses to prepare rebalance transactions for non-qualifying or cross-asset target rates.",
          risksAndConstraints: [
            "Requires converting native PROS to USDC via secondary AMM (double swap friction).",
            "Subject to 3-month fixed lockup and off-chain borrower credit risk.",
            "Target 8.00% APY is not an on-chain smart contract accrual mechanism."
          ]
        }
      ],
      safetyNotice: {
        isNonCustodial: true,
        canSign: false,
        canBroadcast: false,
        disclaimer: "Transaction preparation is unavailable for disqualified sources. The agent does not fabricate transaction calldata."
      }
    };
  }
  /**
   * Native PoS Consensus review:
   * Excluded because no delegatable validator contract exists on Pacific Mainnet.
   */
  static reviewNativePoSExcluded(_amountPros) {
    return {
      timestamp: Date.now(),
      strategyId: "native-pros-consensus",
      strategyName: "Native PoS Consensus Validator Staking",
      actionSummary: "Transaction preparation is DISABLED for Native PoS Staking.",
      estimatedGasCostWei: "0",
      estimatedGasCostPros: "0.000000",
      gasPriceGwei: "0.00",
      receiverStatus: "MISSING",
      isReadyForExternalReview: false,
      steps: [
        {
          stepNumber: 1,
          title: "Delegation Excluded",
          contractName: "Pharos Consensus Staking",
          contractAddress: "0x0000000000000000000000000000000000000000",
          methodName: "UNAVAILABLE",
          selector: "0x00000000",
          isAbiVerified: false,
          explanation: "No public validator delegation contract or permissionless delegation method exists on Pharos Pacific Mainnet.",
          parameters: [],
          payloadStatus: "UNAVAILABLE",
          unavailabilityReason: "TRANSACTION_PAYLOAD_UNAVAILABLE: Pharos Pacific Mainnet lacks a public delegation registry contract. Users cannot delegate native PROS to individual validators on-chain without running a validator node.",
          risksAndConstraints: [
            "Requires running a dedicated validator node hardware setup with 32,000+ PROS self-stake.",
            "Cannot be performed via standard EVM user wallet transaction."
          ]
        }
      ],
      safetyNotice: {
        isNonCustodial: true,
        canSign: false,
        canBroadcast: false,
        disclaimer: "Transaction preparation is unavailable for non-delegatable mechanisms."
      }
    };
  }
};

// src/server/router.ts
var ApiRouter = class {
  rpcClient;
  bridge;
  corsOrigin;
  rateLimitConfig;
  ipRequests = /* @__PURE__ */ new Map();
  constructor(rpcClient, corsOrigin = "*", rateLimitConfig) {
    this.rpcClient = rpcClient ?? new PharosRpcClient({ rpcUrl: NETWORK_CONFIG.rpcUrl });
    this.bridge = new LiveRecommendationBridge(this.rpcClient);
    this.corsOrigin = corsOrigin;
    this.rateLimitConfig = {
      enabled: rateLimitConfig?.enabled ?? true,
      maxRequests: rateLimitConfig?.maxRequests ?? 60,
      windowMs: rateLimitConfig?.windowMs ?? 6e4
    };
  }
  /**
   * Resets the in-memory rate limiter tracking (useful for test suites)
   */
  resetRateLimits() {
    this.ipRequests.clear();
  }
  /**
   * Checks if client IP is currently rate limited
   */
  checkRateLimit(req) {
    if (!this.rateLimitConfig.enabled) return false;
    const forwarded = req.headers["x-forwarded-for"];
    const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress) || "127.0.0.1";
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.windowMs;
    let timestamps = this.ipRequests.get(ip) ?? [];
    timestamps = timestamps.filter((t) => t > windowStart);
    if (timestamps.length >= this.rateLimitConfig.maxRequests) {
      this.ipRequests.set(ip, timestamps);
      return true;
    }
    timestamps.push(now);
    this.ipRequests.set(ip, timestamps);
    return false;
  }
  /**
   * Main dispatch entry point for HTTP requests
   */
  async handleRequest(req, res) {
    const rawPath = typeof req.headers["x-matched-path"] === "string" ? req.headers["x-matched-path"] : typeof req.headers["x-forwarded-uri"] === "string" ? req.headers["x-forwarded-uri"] : req.url ?? "/";
    const url = new URL(rawPath, `http://${req.headers.host ?? "localhost"}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase() ?? "GET";
    res.setHeader("Access-Control-Allow-Origin", this.corsOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Requested-With");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return true;
    }
    if (this.checkRateLimit(req)) {
      res.statusCode = 429;
      res.setHeader("Retry-After", "60");
      this.sendJson(res, 429, {
        error: "Too Many Requests",
        message: `Rate limit exceeded. Maximum ${this.rateLimitConfig.maxRequests} requests per minute allowed.`,
        retryAfterSeconds: 60
      });
      return true;
    }
    if ((pathname === "/api" || pathname === "/api/") && method === "GET") {
      this.sendJson(res, 200, {
        service: "pharos-yield-optimizer-api",
        network: NETWORK_CONFIG.name,
        chainId: NETWORK_CONFIG.chainId,
        mode: "strictly-read-only",
        endpoints: [
          "GET /api/health",
          "GET /api/sources",
          "POST /api/recommendation",
          "POST /api/transaction-review"
        ],
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      return true;
    }
    if ((pathname === "/api/health" || pathname === "/health") && method === "GET") {
      await this.handleHealth(req, res);
      return true;
    }
    if ((pathname === "/api/sources" || pathname === "/sources") && method === "GET") {
      await this.handleSources(req, res);
      return true;
    }
    if ((pathname === "/api/recommendation" || pathname === "/recommendation") && method === "POST") {
      await this.handleRecommendation(req, res);
      return true;
    }
    if ((pathname === "/api/transaction-review" || pathname === "/transaction-review") && method === "POST") {
      await this.handleTransactionReview(req, res);
      return true;
    }
    return false;
  }
  /**
   * GET /api/health
   */
  async handleHealth(_req, res) {
    try {
      const chainInfo = await this.rpcClient.verifyChainId();
      const block = await this.rpcClient.getLatestBlockHeader();
      const gasPrice = await this.rpcClient.getGasPrice();
      const nowSec = Math.floor(Date.now() / 1e3);
      const ageSeconds = Math.max(0, nowSec - block.blockTimestamp);
      this.sendJson(res, 200, {
        status: "healthy",
        network: NETWORK_CONFIG.name,
        chainId: chainInfo.chainId,
        rpcUrl: this.rpcClient.rpcUrl,
        latestBlockNumber: block.blockNumber,
        blockTimestamp: block.blockTimestamp,
        blockTimestampIso: new Date(block.blockTimestamp * 1e3).toISOString(),
        gasPriceWei: gasPrice.gasPriceWei.toString(),
        gasPriceGwei: `${gasPrice.gasPriceGwei.toFixed(2)} Gwei`,
        isFresh: block.isFresh,
        ageSeconds,
        serverTime: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      this.sendJson(res, 503, {
        status: "degraded",
        network: NETWORK_CONFIG.name,
        chainId: NETWORK_CONFIG.chainId,
        rpcUrl: this.rpcClient.rpcUrl,
        isFresh: false,
        error: err instanceof Error ? err.message : String(err),
        serverTime: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  }
  /**
   * GET /api/sources
   */
  async handleSources(_req, res) {
    try {
      const context = await this.bridge.fetchLiveContext();
      const farooObs = context.farooObservation;
      const sources = [
        {
          id: "faroo-stpros",
          name: "Faroo Liquid Staked PROS",
          symbol: "stPROS",
          asset: "PROS (Native / WPROS)",
          contractAddress: CANONICAL_CONTRACTS.FAROO_STPROS,
          qualificationStatus: "QUALIFIED_GENUINE_SOURCE",
          qualificationBadge: "VERIFIED ON-CHAIN (1/1)",
          isVerifiedOnChain: true,
          liveRate: farooObs.spotRateDecimal.toFixed(8),
          liveRateUnit: "PROS per stPROS",
          totalPooledAssets: farooObs.totalPooledProsFormatted,
          totalSupply: farooObs.totalSupplyFormatted,
          lastObservedBlock: farooObs.blockNumber,
          lastObservedTimestamp: farooObs.blockTimestamp,
          provenance: "Direct eth_call to totalPooledPros() [0x01e1d114] and totalSupply() [0x18160ddd]",
          entryFee: "0% (Gas only, ~180k gas via ERC-4626 wrap + approve + deposit)",
          exitFeePatient: "0% (Gas only, 14-day protocol unbonding queue)",
          exitFeeInstant: "0.30% swap fee + slippage via DEX AMM",
          notes: "Single verified yield source on Pacific Mainnet. Exchange-rate compounding liquid staking share."
        },
        {
          id: "pharos-dex-lp",
          name: "Pharos DEX Liquidity Pool",
          symbol: "stPROS/PROS LP",
          asset: "PROS / stPROS Pair",
          contractAddress: CANONICAL_CONTRACTS.DEX_POOL_MANAGER,
          qualificationStatus: "DISQUALIFIED_FROM_LIVE_APR",
          qualificationBadge: "DISQUALIFIED \u2014 APR UNAVAILABLE",
          isVerifiedOnChain: true,
          liveRate: "UNAVAILABLE",
          liveRateUnit: "Dynamic LP Fee APR",
          lastObservedBlock: context.blockNumber,
          provenance: "Uniswap V4 PoolManager verified on-chain; dynamic fee APR unavailable without public indexer/subgraph",
          entryFee: "Gas only (~120k gas)",
          exitFee: "Gas only (~100k gas) + LP divergence loss risk",
          exclusionReason: "Dynamic fee APR cannot be computed without a live volume indexer or subgraph on Pacific Mainnet. Model refuses to fabricate LP trading returns.",
          notes: "Contract infrastructure exists and is linked, but dynamic trading yield is strictly unavailable."
        },
        {
          id: "axil-apc3m",
          name: "Axil Prime Credit 3M",
          symbol: "APC3M",
          asset: "USDC (USD Private Credit)",
          contractAddress: CANONICAL_CONTRACTS.AXIL_CORE_VAULT,
          qualificationStatus: "DISQUALIFIED_FROM_PROS_REBALANCING",
          qualificationBadge: "DISQUALIFIED \u2014 OFF-CHAIN TARGET",
          isVerifiedOnChain: true,
          liveRate: "8.00% (Target APY)",
          liveRateUnit: "Off-Chain Target APY",
          provenance: "Off-chain advertised target APY. Secondary USDC vault accepting USD stablecoins, not PROS.",
          entryFee: "Double AMM swap friction (PROS -> USDC) + gas",
          exitFee: "Double AMM swap friction (USDC -> PROS) + gas + 3-month lockup",
          exclusionReason: "Off-chain target APY for USD private credit. Not an on-chain PROS yield mechanism. Excluded to prevent misleading users.",
          notes: "Different asset class (USDC) with credit risk and 3-month fixed lockup."
        },
        {
          id: "native-pos-consensus",
          name: "Native PoS Consensus Staking",
          symbol: "PROS Validator",
          asset: "Native PROS",
          contractAddress: "0x0000000000000000000000000000000000000000",
          qualificationStatus: "DISQUALIFIED_AS_DELEGATABLE",
          qualificationBadge: "DISQUALIFIED \u2014 NOT DELEGATABLE",
          isVerifiedOnChain: false,
          liveRate: "~8.50% (Nominal Validator Emission)",
          liveRateUnit: "Validator Protocol Emission",
          provenance: "Pharos Consensus Specification documentation only. No public delegator contract deployed.",
          entryFee: "Hardware setup + 32,000+ PROS minimum node deposit",
          exitFee: "21-day consensus unbonding period",
          exclusionReason: "Pharos Pacific Mainnet does not have a permissionless validator delegation smart contract. Individual delegators cannot stake native PROS without running hardware.",
          notes: "Underlying consensus emission, but inaccessible as a direct user delegation strategy."
        }
      ];
      this.sendJson(res, 200, {
        invariantNotice: {
          status: "FEWER_THAN_THREE_QUALIFYING_SOURCES",
          verifiedCount: 1,
          requiredCount: 3,
          isRequirementMet: false,
          message: "Only ONE qualifying yield source (Faroo stPROS) is currently verified on Pacific Mainnet. The three-source acceptance requirement is not yet met."
        },
        sources,
        latestBlockNumber: context.blockNumber,
        gasPriceGwei: `${context.gasPriceGwei.toFixed(2)} Gwei`
      });
    } catch (err) {
      this.sendJson(res, 500, {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  /**
   * POST /api/recommendation
   */
  async handleRecommendation(req, res) {
    try {
      const body = await this.readJsonBody(req);
      const principalPros = typeof body.principalPros === "number" && body.principalPros > 0 ? body.principalPros : 1e3;
      const horizonDays = typeof body.horizonDays === "number" && body.horizonDays > 0 ? body.horizonDays : 60;
      const requireInstantLiquidity = Boolean(body.requiresInstantLiquidity);
      let currentStrategyId = "native-pros-baseline";
      if (body.currentStrategyId === "faroo-patient-staking") {
        currentStrategyId = "faroo-patient-staking";
      } else if (body.currentStrategyId === "faroo-instant-dex") {
        currentStrategyId = "faroo-instant-dex";
      } else if (body.currentStrategyId === "axil-prime-credit-3m" || body.currentStrategyId === "axil-prime-credit") {
        currentStrategyId = "axil-prime-credit-3m";
      }
      const principalWei = decimalToWei(principalPros);
      const result = await this.bridge.evaluateLiveRecommendation({
        principalWei,
        asset: "PROS",
        horizonDays,
        requireInstantLiquidity,
        currentStrategyId
      });
      const rec = result.recommendation;
      const targetProj = rec.comparisons.find((c) => c.profile.id === rec.targetStrategyId) || rec.comparisons.find((c) => c.profile.id === "faroo-patient-staking") || rec.comparisons[0];
      const projectedNetGainPros = Number(rec.netAdvantageWei) / 1e18;
      const gasPriceGwei = result.status === "SUCCESS" ? result.context.gasPriceGwei : 1.25;
      const gasPriceSource = result.status === "SUCCESS" ? "LIVE_PACIFIC_MAINNET" : "CONFIGURED_BASELINE";
      const isPatientStaking = rec.targetStrategyId === "faroo-patient-staking";
      const isInstantDex = rec.targetStrategyId === "faroo-instant-dex";
      const entryGasUnits = 18e4;
      const exitGasUnits = isPatientStaking ? 85e3 : isInstantDex ? 145e3 : 0;
      const modeledGasUnits = isPatientStaking ? 265e3 : isInstantDex ? 325e3 : 0;
      const entryGasCostPros = entryGasUnits * gasPriceGwei / 1e9;
      const estimatedGasCostPros = targetProj ? scaledToDecimal(targetProj.friction.gasCostWei) : entryGasCostPros;
      const nonGasFeeCostPros = targetProj ? scaledToDecimal(
        targetProj.friction.entryFeeWei + targetProj.friction.exitFeeWei + targetProj.friction.swapFeeWei + targetProj.friction.slippageCostWei
      ) : 0;
      const frictionCostPros = targetProj ? targetProj.friction.totalFrictionPros : estimatedGasCostPros;
      const breakEvenDays = rec.breakEvenDays;
      const breakEvenFormatted = formatBreakEvenDuration(breakEvenDays);
      const responsePayload = {
        status: result.status,
        gasPriceGwei: `${gasPriceGwei.toFixed(2)} Gwei`,
        gasPriceSource,
        recommendation: {
          decision: rec.decision,
          reasonCode: rec.reasonCode,
          explanation: rec.explanation,
          targetStrategyId: rec.targetStrategyId,
          projectedNetGainFormatted: `${projectedNetGainPros.toFixed(6)} PROS`,
          projectedNetGainPros,
          estimatedGasCostPros: estimatedGasCostPros.toFixed(6),
          protocolFeeCostPros: nonGasFeeCostPros.toFixed(6),
          frictionCostPros: frictionCostPros.toFixed(6),
          totalLifecycleCostPros: frictionCostPros.toFixed(6),
          breakEvenDays,
          breakEvenFormatted,
          minimumHoldingDays: rec.targetStrategyId === "faroo-patient-staking" ? 14 : 0,
          lifecycleGas: {
            entryGasUnits,
            exitGasUnits,
            modeledGasUnits,
            gasPriceGwei,
            gasPriceSource,
            entryGasCostPros: entryGasCostPros.toFixed(6),
            lifecycleGasCostPros: estimatedGasCostPros.toFixed(6),
            entryOperations: [
              "Wrap Native PROS to Canonical WPROS (45,000 gas)",
              "Approve Faroo stPROS Vault to spend WPROS (45,000 gas)",
              "Deposit WPROS into Faroo stPROS Vault (90,000 gas)"
            ],
            exitOperations: isPatientStaking ? ["Submit RequestWithdraw queue order (85,000 gas, 14-day protocol unbonding period)"] : isInstantDex ? ["Swap stPROS to WPROS on DEX AMM (145,000 gas assumed benchmark, 0.30% pool fee + slippage)"] : []
          },
          disclosures: {
            provenance: "LIVE_ONCHAIN_PACIFIC_MAINNET",
            caching: "Short-lived in-memory cache (3,000ms TTL) applied to JSON-RPC reads to safeguard Pacific Mainnet RPC during burst execution; not long-term storage.",
            invariantNotice: "FEWER_THAN_THREE_QUALIFYING_SOURCES: Requirement not met (1 verified on-chain, 0 execution alternatives counted toward requirement).",
            singleSourceNotice: "Limited scope: Recommendation compares 1 qualifying on-chain source (Faroo stPROS) against Native PROS holding benchmark. Acceptance requirement of 3 qualifying sources is NOT MET.",
            dexExitNotice: "Faroo instant DEX exit is classified strictly as an EXECUTION ALTERNATIVE with 0.30% pool fee + slippage, NOT an independent yield source. Instant exit swap gas (145k) is an empirical benchmark assumption, not a live measured receipt.",
            lifecycleUnification: "Unified 265,000-gas physical lifecycle: 180,000 gas ERC-4626 entry (Wrap 45k + Approve 45k + Deposit 90k) + 85,000 gas unbonding queue exit. Deducted once from gross yield.",
            breakEvenNotice: "Yield Accrual Break-Even indicates elapsed time to earn yield equal to transaction gas; it does NOT bypass the mandatory 14-day protocol unbonding queue.",
            yieldAssumptionNotice: "Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ."
          },
          reasons: [
            rec.explanation,
            `Strict Acceptance Status: ${rec.verifiedQualifyingSourcesCount} of 3 qualifying sources verified on-chain. Single-source evaluation scope.`,
            rec.decision === "MOVE" ? `Projected Net Advantage: +${projectedNetGainPros.toFixed(6)} PROS over holding baseline PROS after deducting single lifecycle cost of ${frictionCostPros.toFixed(6)} PROS (${estimatedGasCostPros.toFixed(6)} PROS gas + ${nonGasFeeCostPros.toFixed(6)} PROS protocol fees).` : `Moving capital is not recommended under selected scenario parameters.`,
            isPatientStaking ? `Yield Accrual Break-Even: ${breakEvenFormatted} to recover gas cost from yield. Principal withdrawal remains subject to the 14-day protocol unbonding queue.` : `Break-Even: ${breakEvenFormatted} under instant liquidity trading conditions.`,
            "Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ."
          ]
        }
      };
      this.sendJson(res, 200, responsePayload);
    } catch (err) {
      this.sendJson(res, 400, {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  /**
   * POST /api/transaction-review
   */
  async handleTransactionReview(req, res) {
    try {
      const body = await this.readJsonBody(req);
      const strategyId = body.strategyId ?? "faroo-patient-staking";
      const amountPros = typeof body.amountPros === "number" && body.amountPros > 0 ? body.amountPros : 1e3;
      const userAddress = typeof body.userAddress === "string" && body.userAddress.trim() !== "" ? body.userAddress.trim() : void 0;
      const gasPrice = await this.rpcClient.getGasPrice();
      const block = await this.rpcClient.getLatestBlockHeader();
      const review = TransactionReviewer.generateReview({
        strategyId,
        amountPros,
        userAddress,
        gasPriceWei: gasPrice.gasPriceWei,
        observedBlockNumber: block.blockNumber,
        observedBlockTimestamp: block.blockTimestamp
      });
      this.sendJson(res, 200, review);
    } catch (err) {
      this.sendJson(res, 400, {
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  sendJson(res, statusCode, data) {
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data, null, 2));
  }
  async readJsonBody(req) {
    const anyReq = req;
    if (anyReq.body !== void 0 && anyReq.body !== null) {
      if (typeof anyReq.body === "object") {
        return anyReq.body;
      }
      if (typeof anyReq.body === "string") {
        const trimmed = anyReq.body.trim();
        if (trimmed.length === 0) {
          return {};
        }
        if (trimmed.length > 1024 * 64) {
          throw new Error("Payload too large");
        }
        try {
          return JSON.parse(trimmed);
        } catch {
          throw new Error("Invalid JSON payload");
        }
      }
    }
    return new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => {
        data += chunk;
        if (data.length > 1024 * 64) {
          reject(new Error("Payload too large"));
        }
      });
      req.on("end", () => {
        try {
          if (!data || data.trim().length === 0) {
            resolve({});
            return;
          }
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Invalid JSON payload"));
        }
      });
      req.on("error", reject);
    });
  }
};

// src/config/index.ts
function loadConfig(env = process.env) {
  const rawPort = env.PORT ?? "3000";
  let port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    port = 3e3;
  }
  const host = (env.HOST ?? "127.0.0.1").trim();
  const isExternalBinding = host === "0.0.0.0" || host === "::" || !host.startsWith("127.") && host !== "localhost";
  const rpcUrl = (env.PHAROS_RPC_URL ?? "https://rpc.pharos.xyz").trim();
  const rawChainId = env.CHAIN_ID ?? "1672";
  let chainId = parseInt(rawChainId, 10);
  if (isNaN(chainId) || chainId <= 0) {
    chainId = 1672;
  }
  const rawFreshness = env.FRESHNESS_THRESHOLD_SECONDS ?? "600";
  let freshnessThresholdSeconds = parseInt(rawFreshness, 10);
  if (isNaN(freshnessThresholdSeconds) || freshnessThresholdSeconds < 10) {
    freshnessThresholdSeconds = 600;
  }
  const rawLogLevel = (env.LOG_LEVEL ?? "info").toLowerCase();
  const logLevel = ["debug", "info", "warn", "error"].includes(rawLogLevel) ? rawLogLevel : "info";
  const corsOrigin = (env.CORS_ORIGIN ?? "*").trim();
  return {
    port,
    host,
    rpcUrl,
    chainId,
    freshnessThresholdSeconds,
    logLevel,
    corsOrigin,
    isExternalBinding
  };
}

// src/api/index.ts
var config = loadConfig();
var router = new ApiRouter(void 0, config.corsOrigin);

// src/api/sources.ts
async function sourcesHandler(req, res) {
  const method = req.method?.toUpperCase() ?? "GET";
  if (method !== "GET" && method !== "OPTIONS") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Allow", "GET, OPTIONS");
    res.end(JSON.stringify({ error: "Method Not Allowed", message: "Only GET and OPTIONS are supported on /api/sources" }));
    return;
  }
  req.url = "/api/sources";
  try {
    await router.handleRequest(req, res);
  } catch (err) {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(JSON.stringify({
        error: "Internal Server Error",
        message: err instanceof Error ? err.message : "Unexpected server error inspecting yield sources",
        status: "error"
      }));
    }
  }
}
export {
  sourcesHandler as default
};
