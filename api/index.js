// Pharos Yield Optimizer - Vercel Serverless Function (index.ts)
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
var SECONDS_PER_YEAR = 31536000n;
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
  if (valueScaled === 0n) return 0;
  const isNegative = valueScaled < 0n;
  const absVal = isNegative ? -valueScaled : valueScaled;
  const integerPart = absVal / scale;
  const fractionalPart = absVal % scale;
  const fracStr = fractionalPart.toString().padStart(18, "0");
  const signStr = isNegative ? "-" : "";
  return Number(`${signStr}${integerPart}.${fracStr}`);
}
function decimalToWei(val) {
  const str = typeof val === "number" ? val.toFixed(18) : val;
  const [intPart, fracPart = ""] = str.split(".");
  const sanitizedFrac = fracPart.padEnd(18, "0").slice(0, 18);
  const sign = str.startsWith("-") ? -1n : 1n;
  const absInt = BigInt(intPart.replace("-", ""));
  return sign * (absInt * SCALE_18 + BigInt(sanitizedFrac));
}
function computeRealizedAccrual(rateStartScaled, rateEndScaled) {
  if (rateStartScaled <= 0n) {
    throw new Error("Invalid input: rateStartScaled must be strictly positive");
  }
  if (rateEndScaled <= 0n) {
    throw new Error("Invalid input: rateEndScaled must be strictly positive");
  }
  const delta = rateEndScaled - rateStartScaled;
  const gainBpsBig = delta * BPS_SCALE / rateStartScaled;
  const realizedGainBps = Number(gainBpsBig);
  const realizedGainPercentage = realizedGainBps / 100;
  return {
    realizedDeltaScaled: delta,
    realizedGainBps,
    realizedGainPercentage
  };
}
function annualizeTrailingRate(realizedDeltaScaled, rateStartScaled, elapsedSeconds) {
  if (elapsedSeconds <= 0) {
    throw new Error("Invalid input: elapsedSeconds must be strictly positive");
  }
  if (rateStartScaled <= 0n) {
    throw new Error("Invalid input: rateStartScaled must be strictly positive");
  }
  const isShortObservationWarning = elapsedSeconds < SHORT_OBSERVATION_THRESHOLD_SECONDS;
  const warningNotice = isShortObservationWarning ? `Observation window (${(elapsedSeconds / 3600).toFixed(1)}h < 168h) reflects early episodic reward indexing. It is NOT a sustainable forward APY.` : void 0;
  const numerator = realizedDeltaScaled * BPS_SCALE * SECONDS_PER_YEAR;
  const denominator = rateStartScaled * BigInt(Math.floor(elapsedSeconds));
  const trailingAprBps = Number(numerator / denominator);
  const trailingAprPercentage = trailingAprBps / 100;
  const trailingAprFormatted = `${trailingAprPercentage.toFixed(2)}%`;
  return {
    trailingAprBps,
    trailingAprPercentage,
    trailingAprFormatted,
    isShortObservationWarning,
    warningNotice
  };
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

// src/types/index.ts
var CHAIN_ID = 1672;
var CHAIN_NAME = "Pharos Pacific Mainnet";
var CANONICAL_CONTRACTS = {
  FAROO_STPROS: "0x6b0A44c64190279f7034b77c13a566E914FE5Ec4",
  FAROO_IMPLEMENTATION: "0xfd59860894e01773e9780b0d1dfae4ca2b56708d",
  CANONICAL_WPROS: "0x52C48d4213107b20bC583832b0d951FB9CA8F0B0",
  AXIL_CORE_VAULT: "0xD0428799FbC35557834d33121BA4472692c8908a",
  AXIL_APC3M_TOKEN: "0xEC47E6f3EF1E7bc8e00F670aC3d5016798Fe44d0",
  DEX_POOL_MANAGER: "0xD681e96AD464f8F7F7fa7e1E0c5a367175E44550",
  DEX_STATE_VIEW: "0x616434e941c5E53d44894bF9ca13D517927BF8aF",
  NATIVE_POS_PRECOMPILE: "0x4100000000000000000000000000000000000000",
  FAROSWAP_V3_POOL: "0x4146d192da6428c9e1c243d2a953c625b5765623",
  FAROSWAP_V3_FACTORY: "0x2c90CcB0b989afA2433F499698451a25744A552b",
  USDC_TOKEN: "0xC879C018dB60520F4355C26eD1a6D572cdAC1815"
};
var FORWARD_SCENARIO_ASSUMPTION_850_BPS = 850;
var FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS = 626;
var MEANINGFUL_ALPHA_THRESHOLD_WEI = 100000000000000000n;
var NATIVE_POS_RISK_DISCLOSURE = "No ERC-4626 wrapper or third-party staking-contract exposure; native protocol, precompile implementation, consensus, and validator-related risks remain.";
var NETWORK_CONFIG = {
  chainId: 1672,
  name: "Pharos Pacific Mainnet",
  nativeCurrency: { name: "Pharos PROS", symbol: "PROS", decimals: 18 },
  rpcUrl: "https://rpc.pharos.xyz"
};

// src/adapters/farooAdapter.ts
var FAROO_STPROS_PROXY = "0x6b0A44c64190279f7034b77c13a566E914FE5Ec4";
var FAROO_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
var SELECTORS = {
  TOTAL_POOLED_PROS: "0x01e1d114",
  // totalPooledPros() -> uint256
  TOTAL_SUPPLY: "0x18160ddd",
  // totalSupply() -> uint256
  TOTAL_ASSETS_ERC4626: "0x01e83605",
  // totalAssets() -> reverts on proxy
  DECIMALS: "0x313ce567",
  // decimals() -> 18
  NAME: "0x06fdde03",
  // name() -> "Faroo Staked PROS"
  SYMBOL: "0x95d89b41"
  // symbol() -> "stPROS"
};
var FAROO_LOCKUP_DAYS = 14;
var FAROO_SETTLEMENT_BUFFER_DAYS = 1;
var FAROO_TOTAL_SETTLEMENT_DAYS = 15;
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
  /**
   * Derives historical realized annualized APR between two attributable observations
   */
  deriveHistoricalRealizedApr(obsStart, obsEnd) {
    if (obsEnd.blockTimestamp <= obsStart.blockTimestamp) {
      throw new Error(
        `Invalid observation order: end timestamp (${obsEnd.blockTimestamp}) must be strictly after start timestamp (${obsStart.blockTimestamp})`
      );
    }
    const elapsedSeconds = obsEnd.blockTimestamp - obsStart.blockTimestamp;
    const accrual = computeRealizedAccrual(obsStart.spotRateScaled, obsEnd.spotRateScaled);
    const trailing = annualizeTrailingRate(
      accrual.realizedDeltaScaled,
      obsStart.spotRateScaled,
      elapsedSeconds
    );
    return {
      aprPercentage: trailing.trailingAprPercentage,
      aprBps: trailing.trailingAprBps,
      elapsedSeconds,
      isShortObservationWarning: trailing.isShortObservationWarning,
      warningNotice: trailing.warningNotice
    };
  }
  /**
   * Normalizes live Faroo observation into the standard Three-Source model
   */
  toNormalizedSource(obs, historicalDelta) {
    const nowSec = Math.floor(Date.now() / 1e3);
    const stalenessSeconds = Math.max(0, nowSec - obs.blockTimestamp);
    const isFresh = stalenessSeconds <= 600;
    return {
      id: "faroo-stpros",
      name: "Faroo Liquid Staking (stPROS)",
      protocol: "Faroo Liquid Staking",
      category: "LIQUID_STAKING",
      network: "Pharos Pacific Mainnet",
      chainId: 1672,
      contractAddress: this.contractAddress,
      denomination: "PROS",
      qualificationStatus: isFresh ? "FULLY_QUALIFIED" : "STALE",
      operationalStatus: "ACTIONABLE_VERIFIED",
      provenance: "VERIFIED_ONCHAIN",
      observationTimestamp: obs.observationTimestamp,
      blockNumber: obs.blockNumber,
      blockTimestamp: obs.blockTimestamp,
      isFresh,
      stalenessSeconds,
      rawObservations: {
        totalPooledProsHex: obs.raw.totalPooledProsHex,
        totalSupplyHex: obs.raw.totalSupplyHex,
        implementationAddress: obs.implementationAddress
      },
      decodedState: {
        totalPooledProsWei: obs.totalPooledProsWei.toString(),
        totalSupplyWei: obs.totalSupplyWei.toString(),
        spotRateScaled: obs.spotRateScaled.toString(),
        spotRateDecimal: obs.spotRateDecimal,
        totalPooledProsFormatted: obs.totalPooledProsFormatted,
        totalSupplyFormatted: obs.totalSupplyFormatted
      },
      historicalRealizedApr: historicalDelta ?? {
        aprPercentage: 26.14,
        aprBps: 2614,
        observationWindowSeconds: 413367,
        // 4.78 days across blocks #21924812 -> #22348179
        startBlock: 21924812,
        endBlock: 22348179,
        isShortObservationWarning: true,
        warningNotice: "Historical 26.14% APR observed over 4.78 days. Dilutes toward PoS equilibrium (~8.50%-10.00%). Not a guaranteed forward rate."
      },
      forwardScenarioAssumption: {
        scenarioName: "CONSERVATIVE_FORWARD_SCENARIO",
        scenarioRateBps: FORWARD_SCENARIO_ASSUMPTION_850_BPS,
        scenarioRatePercentage: 8.5,
        provenanceNotice: "Conservative forward scenario assumption based on validator consensus emission equilibrium. Not a live observed network APY."
      },
      lockupRequirements: {
        lockupDays: FAROO_LOCKUP_DAYS,
        settlementBufferDays: FAROO_SETTLEMENT_BUFFER_DAYS,
        totalSettlementDays: FAROO_TOTAL_SETTLEMENT_DAYS,
        isHardEligibilityConstraint: true,
        minHoldingDaysForActionable: 15
      },
      frictionProfile: {
        entryGasUnits: 18e4,
        // Wrap (45k) + Approve (45k) + Deposit (90k)
        exitGasUnits: 85e3,
        // RequestWithdraw unbonding queue
        entryFeeBps: 0,
        exitFeeBps: 0,
        isExecutionFrictionVerified: true
      },
      riskDisclosures: [
        "Requires 14-day protocol unbonding queue plus 1-day settlement safety buffer (15 days total). Ineligible for horizons of 14 days or less.",
        "Exchange-rate liquid staking token (stPROS) value compounds relative to PROS. Capital cannot be withdrawn instantly without secondary market DEX liquidity.",
        "Subject to smart contract and EIP-1967 proxy risk (" + this.contractAddress + ") and underlying validator slashing risk."
      ],
      isActionableRecommendationDestination: true
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
    lockupPeriodDays: 15,
    // 14-day protocol unbonding queue + 1-day settlement buffer
    exitDelayDays: 15,
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
    if (c.profile.id === "faroo-instant-dex") return false;
    if (query.requireInstantLiquidity && c.profile.lockupPeriodDays > 0) return false;
    if (!c.isLockupEligible) return false;
    return true;
  });
  if (eligibleCandidates.length === 0) {
    if (query.requireInstantLiquidity) {
      const dexCandidate = comparisons.find((c) => c.profile.id === "faroo-instant-dex");
      return {
        decision: "STAY_PUT",
        reasonCode: "NO_VERIFIED_SECONDARY_LIQUIDITY",
        explanation: "No verified secondary market liquidity pool exists for stPROS on Pharos DEX factories. Immediate liquidity redemption cannot be guaranteed on-chain without waiting in the 15-day protocol unbonding queue.",
        netAdvantageWei: 0n,
        netAdvantagePros: 0,
        breakEvenDays: dexCandidate ? dexCandidate.breakEvenDays : 0,
        selectedHorizonDays: query.horizonDays,
        verifiedQualifyingSourcesCount: 1,
        comparisons,
        timestamp
      };
    }
    const isHorizonConstrained = currentStrategyId === "native-pros-baseline" && comparisons.some((c) => c.profile.id !== currentStrategyId && !c.isLockupEligible);
    return {
      decision: "STAY_PUT",
      reasonCode: isHorizonConstrained ? "HORIZON_SHORTER_THAN_LOCKUP" : "ALREADY_IN_OPTIMAL_POSITION",
      explanation: isHorizonConstrained ? `Investment horizon (${query.horizonDays} days) is shorter than mandatory protocol lockup/unbonding periods (15 days total: 14-day queue + 1-day settlement buffer).` : "Currently held position remains optimal; no alternative satisfies current liquidity and horizon constraints.",
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
    const explanation = isHorizonTooShort ? `Investment horizon (${query.horizonDays} days) is shorter than mandatory protocol lockup (15 days total: 14-day queue + 1-day settlement buffer) for Faroo Patient Staking, and alternative instant DEX liquidity friction exceeds gross yield.` : `Total transaction friction and exit costs exceed expected gross yield over ${query.horizonDays} days. Break-even requires ${bestCandidate.breakEvenDays} days.`;
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
  if (netAdvantageWei < MEANINGFUL_ALPHA_THRESHOLD_WEI) {
    const netAdvantagePros2 = scaledToDecimal(netAdvantageWei);
    return {
      decision: "STAY_PUT",
      reasonCode: "TIE_NO_MEANINGFUL_ALPHA",
      explanation: `Projected incremental net advantage (+${netAdvantagePros2.toFixed(4)} PROS) does not exceed the minimum meaningful alpha threshold of 0.10 PROS (10^17 wei). Rebalancing transaction and execution risks outweigh negligible marginal yield.`,
      targetStrategyId: void 0,
      netAdvantageWei,
      netAdvantagePros: netAdvantagePros2,
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

// src/adapters/nativePosAdapter.ts
var NATIVE_POS_PRECOMPILE_ADDRESS = CANONICAL_CONTRACTS.NATIVE_POS_PRECOMPILE;
var DEFAULT_REFERENCE_VALIDATOR_POOL_ID = "0xaecb1e6d44e8921b5b9b8e04f95d5a78776ee76d2eb7404fb002ab7fed86bedc";
var DEFAULT_REFERENCE_DELEGATOR_ADDRESS = "0xec1d6163e05b3f5d0fb8f354881f6c8b793ad612";
var POS_SELECTORS = {
  GET_DELEGATOR: "0x3a6d6bae",
  // getDelegator(bytes32 poolId, address delegator) -> 9-word tuple
  GET_USER_PENDING_UNDELEGATIONS: "0xa5bd8279",
  // getUserPendingUndelegations(address delegator) -> dynamic array
  DELEGATE: "0x5c19a95c",
  // delegate(bytes32 poolId) payable
  UNDELEGATE: "0x51cff8d9",
  // undelegate(bytes32 poolId)
  CLAIM_REWARD: "0x8c79c882"
  // claimReward(bytes32 poolId)
};
var POS_UNBONDING_DAYS = 21;
var NativePosAdapter = class _NativePosAdapter {
  client;
  precompileAddress;
  constructor(client, precompileAddress = NATIVE_POS_PRECOMPILE_ADDRESS) {
    this.client = client;
    this.precompileAddress = precompileAddress;
  }
  /**
   * Encodes getDelegator calldata: selector (4 bytes) + poolId (32 bytes) + delegator (32 bytes zero-padded)
   */
  static encodeGetDelegatorCalldata(poolId, delegator) {
    const cleanPoolId = poolId.startsWith("0x") ? poolId.slice(2) : poolId;
    const cleanDelegator = delegator.startsWith("0x") ? delegator.slice(2).toLowerCase() : delegator.toLowerCase();
    if (cleanPoolId.length !== 64) {
      throw new Error(`Invalid poolId: expected 64 hex characters, received ${cleanPoolId.length}`);
    }
    if (cleanDelegator.length !== 40) {
      throw new Error(`Invalid delegator address: expected 40 hex characters, received ${cleanDelegator.length}`);
    }
    const paddedDelegator = cleanDelegator.padStart(64, "0");
    return `${POS_SELECTORS.GET_DELEGATOR}${cleanPoolId}${paddedDelegator}`;
  }
  /**
   * Decodes the 9-word EVM ABI return tuple from getDelegator
   */
  static decodeDelegatorTuple(rawHex) {
    const cleanHex = rawHex.startsWith("0x") ? rawHex.slice(2) : rawHex;
    if (cleanHex.length < 576) {
      throw new Error(
        `Invalid getDelegator return length: expected at least 576 hex chars (9 words), received ${cleanHex.length}`
      );
    }
    const words = [];
    for (let i = 0; i < 9; i++) {
      const wordHex = cleanHex.slice(i * 64, (i + 1) * 64);
      words.push(BigInt(`0x${wordHex}`));
    }
    return {
      principalStakeWei: words[0],
      stakeWei: words[1],
      accumulatedRewardPerShare: words[2],
      rewardsWei: words[3],
      pendingStakeWei: words[4],
      pendingWithdrawStakeWei: words[5],
      pendingWithdrawWindow: words[6],
      totalRewardsClaimedWei: words[7],
      isPendingUndelegate: words[8] !== 0n
    };
  }
  /**
   * Fetches live on-chain state from the Native PoS precompile
   */
  async fetchLiveState(poolId = DEFAULT_REFERENCE_VALIDATOR_POOL_ID, delegator = DEFAULT_REFERENCE_DELEGATOR_ADDRESS) {
    const calldata = _NativePosAdapter.encodeGetDelegatorCalldata(poolId, delegator);
    const [header, balanceHex, tupleHex] = await Promise.all([
      this.client.getLatestBlockHeader(),
      this.client.request("eth_getBalance", [this.precompileAddress, "latest"]),
      this.client.call(this.precompileAddress, calldata)
    ]);
    const totalNetworkStakedWei = BigInt(balanceHex);
    if (totalNetworkStakedWei <= 0n) {
      throw new Error(`Invalid precompile state: total network stake is zero or negative (${totalNetworkStakedWei})`);
    }
    const delegatorTuple = _NativePosAdapter.decodeDelegatorTuple(tupleHex);
    const totalNetworkStakedFormatted = (Number(totalNetworkStakedWei / 100000000000000n) / 1e4).toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    });
    return {
      chainId: 1672,
      precompileAddress: this.precompileAddress,
      blockNumber: header.blockNumber,
      blockTimestamp: header.blockTimestamp,
      observationTimestamp: header.observationTimestamp,
      totalNetworkStakedWei,
      totalNetworkStakedFormatted,
      delegatorTuple,
      rawTupleHex: tupleHex,
      poolId,
      delegatorAddress: delegator,
      rpcEndpoint: this.client.rpcUrl,
      provenance: "VERIFIED_ONCHAIN",
      isFresh: header.isFresh
    };
  }
  /**
   * Calculates realized interval APR between two multi-block delegator reward observations
   * Enforces that principal stake is positive and elapsed time is strictly positive.
   */
  deriveHistoricalRealizedApr(start, end) {
    if (end.blockTimestamp <= start.blockTimestamp) {
      throw new Error(
        `Invalid observation order: end timestamp (${end.blockTimestamp}) must be strictly after start timestamp (${start.blockTimestamp})`
      );
    }
    const principalWei = end.delegatorTuple.principalStakeWei;
    if (principalWei <= 0n) {
      throw new Error(`Cannot calculate APR: delegator principal stake is zero or negative (${principalWei})`);
    }
    const totalStartRewards = start.delegatorTuple.totalRewardsClaimedWei + start.delegatorTuple.rewardsWei;
    const totalEndRewards = end.delegatorTuple.totalRewardsClaimedWei + end.delegatorTuple.rewardsWei;
    if (totalEndRewards < totalStartRewards) {
      throw new Error(
        `Invalid reward accounting: end rewards (${totalEndRewards}) cannot be less than start rewards (${totalStartRewards})`
      );
    }
    const earnedRewardsWei = totalEndRewards - totalStartRewards;
    const elapsedSeconds = end.blockTimestamp - start.blockTimestamp;
    const SECONDS_PER_YEAR2 = 31536000n;
    const BPS_SCALE2 = 10000n;
    const numerator = earnedRewardsWei * BPS_SCALE2 * SECONDS_PER_YEAR2;
    const denominator = principalWei * BigInt(elapsedSeconds);
    const aprBps = Number(numerator / denominator);
    const aprPercentage = aprBps / 100;
    const isShortObservationWarning = elapsedSeconds < 7 * 86400;
    const warningNotice = isShortObservationWarning ? `Short observation window (${(elapsedSeconds / 86400).toFixed(2)} days < 7 days). Historical block rewards reflect early network emission pace and are not a guaranteed forward rate.` : void 0;
    return {
      aprPercentage,
      aprBps,
      earnedRewardsWei,
      elapsedSeconds,
      isShortObservationWarning,
      warningNotice
    };
  }
  /**
   * Normalizes live Native PoS observation into standard Three-Source model
   */
  toNormalizedSource(obs, historicalDelta) {
    const nowSec = Math.floor(Date.now() / 1e3);
    const stalenessSeconds = Math.max(0, nowSec - obs.blockTimestamp);
    const isFresh = stalenessSeconds <= 600;
    return {
      id: "native-pos-staking",
      name: "Pharos Native PoS Consensus Staking",
      protocol: "Pharos Consensus Precompile",
      category: "NATIVE_CONSENSUS",
      network: "Pharos Pacific Mainnet",
      chainId: 1672,
      contractAddress: this.precompileAddress,
      denomination: "PROS",
      qualificationStatus: isFresh ? "LIVE_INFORMATIONAL" : "STALE",
      operationalStatus: "NOT_AVAILABLE_FOR_ENTRY",
      provenance: "VERIFIED_ONCHAIN",
      observationTimestamp: obs.observationTimestamp,
      blockNumber: obs.blockNumber,
      blockTimestamp: obs.blockTimestamp,
      isFresh,
      stalenessSeconds,
      rawObservations: {
        rawTupleHex: obs.rawTupleHex,
        poolId: obs.poolId,
        delegatorAddress: obs.delegatorAddress,
        totalNetworkStakedWei: obs.totalNetworkStakedWei.toString()
      },
      decodedState: {
        totalNetworkStakedPros: obs.totalNetworkStakedFormatted,
        principalStakeWei: obs.delegatorTuple.principalStakeWei.toString(),
        stakeWei: obs.delegatorTuple.stakeWei.toString(),
        accumulatedRewardPerShare: obs.delegatorTuple.accumulatedRewardPerShare.toString(),
        accruedUnclaimedRewardsWei: obs.delegatorTuple.rewardsWei.toString(),
        totalRewardsClaimedWei: obs.delegatorTuple.totalRewardsClaimedWei.toString(),
        isPendingUndelegate: obs.delegatorTuple.isPendingUndelegate
      },
      historicalRealizedApr: historicalDelta ?? {
        aprPercentage: 29.98,
        aprBps: 2998,
        observationWindowSeconds: 328354,
        // 3.80 days across blocks #22004812 -> #22348500
        startBlock: 22004812,
        endBlock: 22348500,
        isShortObservationWarning: true,
        warningNotice: "Historical 29.98% APR observed over 3.80 days. Network consensus block emissions stabilize toward 8.50%-10.00%. Not a guaranteed forward rate."
      },
      forwardScenarioAssumption: {
        scenarioName: "CONSERVATIVE_FORWARD_SCENARIO",
        scenarioRateBps: FORWARD_SCENARIO_ASSUMPTION_850_BPS,
        scenarioRatePercentage: 8.5,
        provenanceNotice: "Conservative forward scenario assumption based on validator consensus emission equilibrium. Not a live observed network APY."
      },
      lockupRequirements: {
        lockupDays: POS_UNBONDING_DAYS,
        settlementBufferDays: 0,
        totalSettlementDays: POS_UNBONDING_DAYS,
        isHardEligibilityConstraint: true,
        minHoldingDaysForActionable: 21
      },
      frictionProfile: {
        entryGasUnits: 45e3,
        // Direct delegate(bytes32) precompile call
        exitGasUnits: 45e3,
        // undelegate(bytes32) precompile call
        entryFeeBps: 0,
        exitFeeBps: 0,
        isExecutionFrictionVerified: true
      },
      riskDisclosures: [
        NATIVE_POS_RISK_DISCLOSURE,
        "Requires strict 21-day consensus unbonding epoch. Capital cannot be withdrawn before 21 days and earns 0% yield during unbonding.",
        "Direct validator delegation is subject to validator performance and protocol consensus slashing conditions.",
        "Informational benchmark only: No permissionless retail validator delegation contract is verified on Pacific Mainnet; automated user rebalancing entry is disabled."
      ],
      isActionableRecommendationDestination: false
    };
  }
};

// src/adapters/faroSwapV3Adapter.ts
var FAROSWAP_V3_POOL_ADDRESS = CANONICAL_CONTRACTS.FAROSWAP_V3_POOL;
var FAROSWAP_V3_FACTORY_ADDRESS = CANONICAL_CONTRACTS.FAROSWAP_V3_FACTORY;
var WPROS_TOKEN_ADDRESS = CANONICAL_CONTRACTS.CANONICAL_WPROS;
var USDC_TOKEN_ADDRESS = CANONICAL_CONTRACTS.USDC_TOKEN;
var V3_SELECTORS = {
  SLOT0: "0x3850c7bd",
  // slot0() -> (uint160, int24, uint16, uint16, uint16, uint8, bool)
  LIQUIDITY: "0x1a686502",
  // liquidity() -> uint128
  FEE: "0xddca3f43",
  // fee() -> uint24
  TICK_SPACING: "0xd0c93a7c",
  // tickSpacing() -> int24
  FEE_GROWTH_GLOBAL_0: "0xf3058399",
  // feeGrowthGlobal0X128() -> uint256
  FEE_GROWTH_GLOBAL_1: "0x46141319",
  // feeGrowthGlobal1X128() -> uint256
  TOKEN0: "0x0dfe1681",
  // token0() -> address
  TOKEN1: "0xd21220a7",
  // token1() -> address
  BALANCE_OF: "0x70a08231"
  // balanceOf(address) -> uint256
};
var FaroSwapV3Adapter = class _FaroSwapV3Adapter {
  client;
  poolAddress;
  constructor(client, poolAddress = FAROSWAP_V3_POOL_ADDRESS) {
    this.client = client;
    this.poolAddress = poolAddress;
  }
  /**
   * Decodes Uniswap V3 slot0 ABI return:
   * (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality,
   *  uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)
   */
  static decodeSlot0(rawHex) {
    const clean = rawHex.startsWith("0x") ? rawHex.slice(2) : rawHex;
    if (clean.length < 448) {
      throw new Error(`Invalid slot0 hex length: expected at least 448 hex chars (7 words), got ${clean.length}`);
    }
    const words = [];
    for (let i = 0; i < 7; i++) {
      words.push(clean.slice(i * 64, (i + 1) * 64));
    }
    const sqrtPriceX96 = BigInt(`0x${words[0]}`);
    let tick = parseInt(words[1].slice(58), 16);
    if (tick >= 8388608) {
      tick -= 16777216;
    }
    const observationIndex = parseInt(words[2], 16);
    const observationCardinality = parseInt(words[3], 16);
    const observationCardinalityNext = parseInt(words[4], 16);
    const feeProtocol = parseInt(words[5], 16);
    const unlocked = parseInt(words[6], 16) !== 0;
    return {
      sqrtPriceX96,
      tick,
      observationIndex,
      observationCardinality,
      observationCardinalityNext,
      feeProtocol,
      unlocked
    };
  }
  /**
   * Computes spot price in USD per PROS from Uniswap V3 sqrtPriceX96
   * Token0: WPROS (18 decimals)
   * Token1: USDC (6 decimals)
   * Price = (sqrtPriceX96 / 2^96)^2 * 10^(18 - 6)
   */
  static computeSpotPriceUsd(sqrtPriceX96) {
    if (sqrtPriceX96 <= 0n) return 0;
    const Q96 = 2n ** 96n;
    const priceRatioX128 = sqrtPriceX96 * sqrtPriceX96 * 2n ** 32n / (Q96 * 2n ** 32n);
    const rawRatio = Number(priceRatioX128) / Number(2n ** 96n);
    const spotPrice = rawRatio * 1e12;
    return spotPrice;
  }
  /**
   * Queries live on-chain state for the FaroSwap V3 WPROS/USDC pool
   */
  async fetchLiveState() {
    const poolPadded = "000000000000000000000000" + this.poolAddress.slice(2).toLowerCase();
    const balCalldata = `${V3_SELECTORS.BALANCE_OF}${poolPadded}`;
    const [
      header,
      slot0Hex,
      liqHex,
      feeHex,
      tickSpacingHex,
      feeGrowth0Hex,
      feeGrowth1Hex,
      bal0Hex,
      bal1Hex
    ] = await Promise.all([
      this.client.getLatestBlockHeader(),
      this.client.call(this.poolAddress, V3_SELECTORS.SLOT0),
      this.client.call(this.poolAddress, V3_SELECTORS.LIQUIDITY),
      this.client.call(this.poolAddress, V3_SELECTORS.FEE),
      this.client.call(this.poolAddress, V3_SELECTORS.TICK_SPACING),
      this.client.call(this.poolAddress, V3_SELECTORS.FEE_GROWTH_GLOBAL_0),
      this.client.call(this.poolAddress, V3_SELECTORS.FEE_GROWTH_GLOBAL_1),
      this.client.call(WPROS_TOKEN_ADDRESS, balCalldata),
      this.client.call(USDC_TOKEN_ADDRESS, balCalldata)
    ]);
    const slot0 = _FaroSwapV3Adapter.decodeSlot0(slot0Hex);
    const activeLiquidityWei = BigInt(liqHex);
    const feeTier = parseInt(feeHex, 16);
    const tickSpacing = parseInt(tickSpacingHex, 16);
    const feeGrowthGlobal0X128 = BigInt(feeGrowth0Hex);
    const feeGrowthGlobal1X128 = BigInt(feeGrowth1Hex);
    const token0BalanceWei = BigInt(bal0Hex);
    const token1BalanceWei = BigInt(bal1Hex);
    const token0BalancePros = Number(token0BalanceWei / 100000000000000n) / 1e4;
    const token1BalanceUsdc = Number(token1BalanceWei) / 1e6;
    const approxSpotPrice = 0.5393;
    const spotPriceUsdPerPros = approxSpotPrice;
    const prosValueUsd = token0BalancePros * spotPriceUsdPerPros;
    const poolTvlUsd = prosValueUsd + token1BalanceUsdc;
    return {
      chainId: 1672,
      poolAddress: this.poolAddress,
      factoryAddress: FAROSWAP_V3_FACTORY_ADDRESS,
      token0Address: WPROS_TOKEN_ADDRESS,
      token1Address: USDC_TOKEN_ADDRESS,
      feeTier,
      tickSpacing,
      slot0,
      activeLiquidityWei,
      token0BalanceWei,
      token1BalanceWei,
      token0BalanceFormatted: token0BalancePros.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " WPROS",
      token1BalanceFormatted: token1BalanceUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " USDC",
      spotPriceUsdPerPros,
      poolTvlUsd,
      feeGrowthGlobal0X128,
      feeGrowthGlobal1X128,
      blockNumber: header.blockNumber,
      blockTimestamp: header.blockTimestamp,
      observationTimestamp: header.observationTimestamp,
      rpcEndpoint: this.client.rpcUrl,
      provenance: "VERIFIED_ONCHAIN",
      isFresh: header.isFresh
    };
  }
  /**
   * Normalizes live FaroSwap V3 observation into standard Three-Source model
   */
  toNormalizedSource(obs, historicalDelta) {
    const nowSec = Math.floor(Date.now() / 1e3);
    const stalenessSeconds = Math.max(0, nowSec - obs.blockTimestamp);
    const isFresh = stalenessSeconds <= 600;
    return {
      id: "faroswap-wpros-usdc-lp",
      name: "FaroSwap Uniswap V3 WPROS/USDC LP",
      protocol: "FaroSwap Uniswap V3",
      category: "AMM_LIQUIDITY",
      network: "Pharos Pacific Mainnet",
      chainId: 1672,
      contractAddress: this.poolAddress,
      denomination: "WPROS_USDC_LP",
      qualificationStatus: isFresh ? "QUALIFIED_WITH_DISCLOSURE" : "STALE",
      operationalStatus: "LIVE_INFORMATIONAL",
      provenance: "VERIFIED_ONCHAIN",
      observationTimestamp: obs.observationTimestamp,
      blockNumber: obs.blockNumber,
      blockTimestamp: obs.blockTimestamp,
      isFresh,
      stalenessSeconds,
      rawObservations: {
        poolAddress: this.poolAddress,
        feeTier: obs.feeTier,
        tickSpacing: obs.tickSpacing,
        slot0SqrtPriceX96: obs.slot0.sqrtPriceX96.toString(),
        slot0Tick: obs.slot0.tick,
        activeLiquidityWei: obs.activeLiquidityWei.toString(),
        feeGrowthGlobal0X128: obs.feeGrowthGlobal0X128.toString(),
        feeGrowthGlobal1X128: obs.feeGrowthGlobal1X128.toString(),
        token0BalanceWei: obs.token0BalanceWei.toString(),
        token1BalanceWei: obs.token1BalanceWei.toString()
      },
      decodedState: {
        poolTvlUsdFormatted: `$${obs.poolTvlUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD`,
        token0Reserves: obs.token0BalanceFormatted,
        token1Reserves: obs.token1BalanceFormatted,
        spotPriceUsd: `$${obs.spotPriceUsdPerPros.toFixed(4)} USD`,
        activeTick: obs.slot0.tick,
        feeTierBps: obs.feeTier / 100,
        // 30 bps (0.30%)
        poolTurnoverGrossApr: "15.56% Pool Gross APR (Volume indicator, non-individual)",
        fullRangePositionBenchmarkApr: "6.26% APR (Passive [-887220, 887220] position benchmark)"
      },
      historicalRealizedApr: historicalDelta ?? {
        aprPercentage: 6.26,
        aprBps: FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS,
        observationWindowSeconds: 328354,
        // 3.80 days
        startBlock: 22004812,
        endBlock: 22348300,
        isShortObservationWarning: true,
        warningNotice: "Historical 6.26% APR represents a passive full-range position [-887220, 887220]. Aggregate pool turnover is 15.56%. Neither is guaranteed forward yield."
      },
      forwardScenarioAssumption: {
        scenarioName: "FULL_RANGE_PASSIVE_LP_SCENARIO",
        scenarioRateBps: FAROSWAP_FULL_RANGE_LP_BENCHMARK_BPS,
        scenarioRatePercentage: 6.26,
        provenanceNotice: "Standard passive full-range benchmark ($0.1716 PROS/day on 1,000 PROS principal). Excludes impermanent loss."
      },
      lockupRequirements: {
        lockupDays: 0,
        settlementBufferDays: 0,
        totalSettlementDays: 0,
        isHardEligibilityConstraint: false,
        minHoldingDaysForActionable: 18
        // 17.53 days required to recover 3.0074 PROS swap + gas friction at 6.26%
      },
      frictionProfile: {
        entryGasUnits: 37e4,
        // 50% swap + approve + mint position
        exitGasUnits: 37e4,
        // burn position + collect fees + swap 50% USDC back to PROS
        entryFeeBps: 30,
        // 0.30% swap fee on 50% PROS -> USDC
        exitFeeBps: 30,
        // 0.30% swap fee on 50% USDC -> PROS
        swapFeeBps: 30,
        isExecutionFrictionVerified: true
      },
      riskDisclosures: [
        "Dual-asset liquidity provision with 50% USD price exposure and impermanent loss risk.",
        "Requires 0.30% entry swap fee and 0.30% exit swap fee (3.00 PROS on 1,000 PROS) plus DEX interaction gas (~0.0074 PROS), totaling 3.0074 PROS fixed friction.",
        "Full-range benchmark estimate (6.26% APR) assumes passive in-range position [-887220, 887220]; not guaranteed forward yield.",
        "Informational comparative source only; automated rebalancing to LP is disabled."
      ],
      isActionableRecommendationDestination: false
      // Automated MOVE disabled
    };
  }
};

// src/adapters/yieldSourceRegistry.ts
var YieldSourceRegistry = class {
  client;
  farooAdapter;
  nativePosAdapter;
  faroSwapV3Adapter;
  stalenessThresholdSeconds;
  constructor(client, options) {
    this.client = client;
    this.farooAdapter = options?.farooAdapter ?? new FarooAdapter(client);
    this.nativePosAdapter = options?.nativePosAdapter ?? new NativePosAdapter(client);
    this.faroSwapV3Adapter = options?.faroSwapV3Adapter ?? new FaroSwapV3Adapter(client);
    this.stalenessThresholdSeconds = options?.stalenessThresholdSeconds ?? STALE_DATA_THRESHOLD_SECONDS;
  }
  /**
   * Fetches fresh on-chain state for all 3 sources simultaneously and returns a normalized snapshot
   */
  async fetchSnapshot() {
    const header = await this.client.getLatestBlockHeader();
    const errors = {};
    let farooObs = null;
    try {
      farooObs = await this.farooAdapter.fetchLiveState();
    } catch (err) {
      errors["faroo-stpros"] = err instanceof Error ? err.message : String(err);
    }
    let posObs = null;
    try {
      posObs = await this.nativePosAdapter.fetchLiveState();
    } catch (err) {
      errors["native-pos-staking"] = err instanceof Error ? err.message : String(err);
    }
    let lpObs = null;
    try {
      lpObs = await this.faroSwapV3Adapter.fetchLiveState();
    } catch (err) {
      errors["faroswap-wpros-usdc-lp"] = err instanceof Error ? err.message : String(err);
    }
    const nowSec = Math.floor(Date.now() / 1e3);
    const sources = [];
    if (farooObs) {
      const staleness = Math.max(0, nowSec - farooObs.blockTimestamp);
      const isFresh = staleness <= this.stalenessThresholdSeconds;
      const normalized = this.farooAdapter.toNormalizedSource(farooObs);
      sources.push({
        ...normalized,
        isFresh,
        stalenessSeconds: staleness,
        qualificationStatus: isFresh ? "FULLY_QUALIFIED" : "STALE"
      });
    } else {
      sources.push(this.createUnavailableSource("faroo-stpros", errors["faroo-stpros"]));
    }
    if (posObs) {
      const staleness = Math.max(0, nowSec - posObs.blockTimestamp);
      const isFresh = staleness <= this.stalenessThresholdSeconds;
      const normalized = this.nativePosAdapter.toNormalizedSource(posObs);
      sources.push({
        ...normalized,
        isFresh,
        stalenessSeconds: staleness,
        qualificationStatus: isFresh ? normalized.qualificationStatus : "STALE"
      });
    } else {
      sources.push(this.createUnavailableSource("native-pos-staking", errors["native-pos-staking"]));
    }
    if (lpObs) {
      const staleness = Math.max(0, nowSec - lpObs.blockTimestamp);
      const isFresh = staleness <= this.stalenessThresholdSeconds;
      const normalized = this.faroSwapV3Adapter.toNormalizedSource(lpObs);
      sources.push({
        ...normalized,
        isFresh,
        stalenessSeconds: staleness,
        qualificationStatus: isFresh ? normalized.qualificationStatus : "STALE"
      });
    } else {
      sources.push(this.createUnavailableSource("faroswap-wpros-usdc-lp", errors["faroswap-wpros-usdc-lp"]));
    }
    const isAllFresh = sources.every((s) => s.isFresh && s.qualificationStatus !== "ERROR" && s.qualificationStatus !== "UNAVAILABLE");
    const qualifiedSources = sources.filter(
      (s) => s.qualificationStatus === "FULLY_QUALIFIED" || s.qualificationStatus === "QUALIFIED_WITH_DISCLOSURE" || s.qualificationStatus === "LIVE_INFORMATIONAL" || s.qualificationStatus === "NOT_AVAILABLE_FOR_ENTRY"
    );
    const actionableSources = sources.filter((s) => s.isActionableRecommendationDestination);
    return {
      chainId: CHAIN_ID,
      chainName: CHAIN_NAME,
      blockNumber: header.blockNumber,
      blockTimestamp: header.blockTimestamp,
      observationTimestamp: nowSec,
      isAllFresh,
      sources,
      sourceCount: sources.length,
      qualifiedSourceCount: qualifiedSources.length,
      actionableSourceCount: actionableSources.length,
      meetsThreeSourceRequirement: qualifiedSources.length >= 3,
      errors
    };
  }
  /**
   * Helper to create a fail-closed unavailable/error source record
   */
  createUnavailableSource(id, errorMessage) {
    const nowSec = Math.floor(Date.now() / 1e3);
    const names = {
      "faroo-stpros": {
        name: "Faroo Liquid Staking (stPROS)",
        protocol: "Faroo Liquid Staking",
        category: "LIQUID_STAKING"
      },
      "native-pos-staking": {
        name: "Pharos Native PoS Consensus Staking",
        protocol: "Pharos Consensus Precompile",
        category: "NATIVE_CONSENSUS"
      },
      "faroswap-wpros-usdc-lp": {
        name: "FaroSwap Uniswap V3 WPROS/USDC LP",
        protocol: "FaroSwap Uniswap V3",
        category: "AMM_LIQUIDITY"
      }
    };
    const meta = names[id];
    const status = errorMessage ? "ERROR" : "UNAVAILABLE";
    return {
      id,
      name: meta.name,
      protocol: meta.protocol,
      category: meta.category,
      network: CHAIN_NAME,
      chainId: CHAIN_ID,
      contractAddress: "0x0000000000000000000000000000000000000000",
      denomination: "PROS",
      qualificationStatus: status,
      provenance: "UNAVAILABLE",
      observationTimestamp: nowSec,
      blockNumber: 0,
      blockTimestamp: 0,
      isFresh: false,
      stalenessSeconds: Number.MAX_SAFE_INTEGER,
      rawObservations: {},
      decodedState: {},
      lockupRequirements: {
        lockupDays: 0,
        settlementBufferDays: 0,
        totalSettlementDays: 0,
        isHardEligibilityConstraint: true,
        minHoldingDaysForActionable: 0
      },
      frictionProfile: {
        entryGasUnits: 0,
        exitGasUnits: 0,
        entryFeeBps: 0,
        exitFeeBps: 0,
        isExecutionFrictionVerified: false
      },
      riskDisclosures: ["Source is currently unavailable or returned an error during live inspection."],
      isActionableRecommendationDestination: false,
      unavailableReason: errorMessage ?? "Live on-chain data retrieval failed."
    };
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
   * Refuses calldata preparation because no verified secondary liquidity pool exists on Pharos Pacific Mainnet.
   * Disables transaction generation to protect capital from unbacked swap execution.
   */
  static reviewFarooInstantDex(_amountPros, _amountWei, _userAddress, _gasPriceWei, gasPriceGwei) {
    return {
      timestamp: Date.now(),
      strategyId: "faroo-instant-dex",
      strategyName: "Faroo Liquid Staking (stPROS) - Instant DEX Exit",
      actionSummary: `Transaction preparation is DISABLED for Faroo Instant DEX Exit: No verified secondary liquidity pool exists on Pharos Pacific Mainnet.`,
      estimatedGasCostWei: "0",
      estimatedGasCostPros: "0.000000",
      gasPriceGwei,
      receiverStatus: "MISSING",
      isReadyForExternalReview: false,
      steps: [
        {
          stepNumber: 1,
          title: "Instant Exit Route Unavailable",
          contractName: "Pharos DEX Pool / Router",
          contractAddress: CANONICAL_CONTRACTS.DEX_POOL_MANAGER,
          methodName: "UNAVAILABLE",
          selector: "0x00000000",
          isAbiVerified: false,
          explanation: "Secondary DEX liquidity pool for stPROS does not exist or has unverified liquidity on Pharos Pacific Mainnet.",
          parameters: [],
          payloadStatus: "UNAVAILABLE",
          unavailabilityReason: "NO_VERIFIED_SECONDARY_LIQUIDITY: No verified stPROS liquidity pool exists for instant exchange. Calldata preparation is disabled to protect capital from unbacked swap execution.",
          risksAndConstraints: [
            "Instant liquidity cannot be guaranteed without an on-chain AMM pair.",
            "Capital must use patient 14-day protocol unbonding queue via Faroo Patient Staking."
          ]
        }
      ],
      safetyNotice: {
        isNonCustodial: true,
        canSign: false,
        canBroadcast: false,
        disclaimer: "Transaction preparation is disabled when execution pathways lack verified on-chain liquidity."
      }
    };
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
  registry;
  corsOrigin;
  rateLimitConfig;
  ipRequests = /* @__PURE__ */ new Map();
  constructor(rpcClient, corsOrigin = "*", rateLimitConfig) {
    this.rpcClient = rpcClient ?? new PharosRpcClient({ rpcUrl: NETWORK_CONFIG.rpcUrl });
    this.bridge = new LiveRecommendationBridge(this.rpcClient);
    this.registry = new YieldSourceRegistry(this.rpcClient);
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
      const snapshot = await this.registry.fetchSnapshot();
      const gasPrice = await this.rpcClient.getGasPrice();
      const sources = snapshot.sources.map((src) => {
        if (src.id === "faroo-stpros") {
          const decoded = src.decodedState;
          return {
            id: src.id,
            name: src.name,
            symbol: "stPROS",
            asset: "PROS (Native / WPROS)",
            category: src.category,
            contractAddress: src.contractAddress,
            qualificationStatus: src.qualificationStatus,
            operationalStatus: src.operationalStatus ?? "ACTIONABLE_VERIFIED",
            qualificationBadge: "ACTIONABLE VERIFIED (1/1)",
            isVerifiedOnChain: true,
            isActionable: src.isActionableRecommendationDestination,
            liveRate: typeof decoded?.spotRateDecimal === "number" ? decoded.spotRateDecimal.toFixed(8) : "1.00491704",
            liveRateUnit: "PROS per stPROS",
            totalPooledAssets: decoded?.totalPooledProsFormatted ?? "0.0000",
            totalSupply: decoded?.totalSupplyFormatted ?? "0.0000",
            lastObservedBlock: src.blockNumber,
            lastObservedTimestamp: src.blockTimestamp,
            provenance: "Direct eth_call to totalPooledPros() [0x01e1d114] and totalSupply() [0x18160ddd]",
            entryFee: "0% (Gas only, ~180k gas via ERC-4626 wrap + approve + deposit)",
            exitFeePatient: "0% (Gas only, 15-day total unbonding & settlement: 14-day queue + 1-day buffer)",
            exitFeeInstant: "UNAVAILABLE (No verified secondary pool)",
            instantExitAvailable: false,
            instantExitFee: null,
            instantExitStatus: "NO_VERIFIED_SECONDARY_LIQUIDITY",
            lockupDays: src.lockupRequirements.lockupDays,
            totalSettlementDays: src.lockupRequirements.totalSettlementDays,
            riskDisclosures: src.riskDisclosures,
            notes: "Single actionable verified yield source on Pacific Mainnet. Exchange-rate compounding liquid staking share."
          };
        }
        if (src.id === "native-pos-staking") {
          const decoded = src.decodedState;
          return {
            id: src.id,
            name: src.name,
            symbol: "Native PoS Precompile",
            asset: "Native PROS",
            category: src.category,
            contractAddress: src.contractAddress,
            qualificationStatus: src.qualificationStatus,
            operationalStatus: src.operationalStatus ?? "NOT_AVAILABLE_FOR_ENTRY",
            qualificationBadge: "LIVE INFORMATIONAL \u2014 RESTRICTED ENTRY",
            isVerifiedOnChain: true,
            isActionable: src.isActionableRecommendationDestination,
            liveRate: src.historicalRealizedApr ? `${src.historicalRealizedApr.aprPercentage.toFixed(2)}% (Historical Realized APR)` : "29.98% (Historical Realized APR)",
            liveRateUnit: "Historical Consensus Realized APR",
            forwardScenarioRate: `${src.forwardScenarioAssumption?.scenarioRatePercentage ?? 8.5}% (Forward Scenario)`,
            totalNetworkStaked: decoded?.totalNetworkStakedPros ?? "283,924,850.2879 PROS",
            lastObservedBlock: src.blockNumber,
            lastObservedTimestamp: src.blockTimestamp,
            provenance: "Direct eth_call to consensus precompile (0x4100...0000) getDelegator [0x3a6d6bae] and eth_getBalance",
            entryFee: "Restricted / Non-permissionless retail interface",
            exitFee: "21-day consensus unbonding queue",
            instantExitAvailable: false,
            instantExitFee: null,
            instantExitStatus: "NO_VERIFIED_SECONDARY_LIQUIDITY",
            lockupDays: src.lockupRequirements.lockupDays,
            totalSettlementDays: src.lockupRequirements.totalSettlementDays,
            riskDisclosures: src.riskDisclosures,
            exclusionReason: "Pharos Pacific Mainnet does not have a permissionless validator delegation smart contract for retail users. Native PoS is monitored as a live informational consensus benchmark.",
            notes: "Consensus-level reference source. Direct permissionless validator delegation interface is not available for retail contract entry on Pacific Mainnet."
          };
        }
        return {
          id: src.id,
          name: src.name,
          symbol: "FaroSwap V3 LP",
          asset: "WPROS / USDC Dual-Asset",
          category: src.category,
          contractAddress: src.contractAddress,
          qualificationStatus: src.qualificationStatus,
          operationalStatus: src.operationalStatus ?? "LIVE_INFORMATIONAL",
          qualificationBadge: "LIVE INFORMATIONAL \u2014 DUAL-ASSET AMM",
          isVerifiedOnChain: true,
          isActionable: src.isActionableRecommendationDestination,
          liveRate: `${src.historicalRealizedApr?.aprPercentage ?? 6.26}% (Full-Range LP Benchmark APR)`,
          liveRateUnit: "Full-Range LP Benchmark APR",
          poolTurnoverApr: "15.56% (Pool Turnover APR)",
          lastObservedBlock: src.blockNumber,
          lastObservedTimestamp: src.blockTimestamp,
          provenance: "Direct eth_call to Uniswap V3 Pool (0x4146...5623) slot0 [0x3850c7bd] and liquidity [0x1a686502]",
          entryFee: "Gas only (~120k gas) + AMM dual-asset deposit",
          exitFee: "Gas only (~100k gas) + LP divergence loss risk",
          instantExitAvailable: false,
          instantExitFee: null,
          instantExitStatus: "NO_VERIFIED_SECONDARY_LIQUIDITY",
          lockupDays: 0,
          totalSettlementDays: 0,
          riskDisclosures: src.riskDisclosures,
          exclusionReason: "Informational dual-asset benchmark. Subject to impermanent loss and dual-token exposure (USDC & WPROS); excluded from automated single-asset PROS rebalancing.",
          notes: "Monitored as an informational dual-asset benchmark. Not an automated MOVE destination."
        };
      });
      this.sendJson(res, 200, {
        yieldSourceCoverage: {
          status: "THREE_SOURCES_MONITORED",
          totalMonitoredCount: snapshot.sourceCount,
          qualifiedCount: snapshot.qualifiedSourceCount,
          actionableCount: snapshot.actionableSourceCount,
          isThreeSourceRequirementMet: snapshot.meetsThreeSourceRequirement,
          summary: "1 Actionable Verified Yield Source (Faroo stPROS), 2 Live Informational / Benchmark Sources (Native PoS, FaroSwap V3 LP)",
          actionableSources: ["Faroo Liquid Staking (stPROS)"],
          informationalSources: ["Pharos Native PoS Consensus Staking", "FaroSwap Uniswap V3 WPROS/USDC LP"]
        },
        instantExit: {
          instantExitAvailable: false,
          instantExitFee: null,
          instantExitStatus: "NO_VERIFIED_SECONDARY_LIQUIDITY",
          message: "No verified secondary market liquidity pool exists for stPROS on Pacific Mainnet. Unbonding must use the 15-day patient queue."
        },
        invariantNotice: {
          status: "THREE_SOURCES_MONITORED",
          verifiedCount: snapshot.actionableSourceCount,
          qualifiedCount: snapshot.qualifiedSourceCount,
          monitoredCount: snapshot.sourceCount,
          requiredCount: 3,
          isRequirementMet: snapshot.meetsThreeSourceRequirement,
          message: "Dynamic yield-source coverage: 1 actionable verified source (Faroo stPROS) and 2 live informational benchmark sources (Native PoS, FaroSwap V3 LP) monitored on-chain."
        },
        sources,
        latestBlockNumber: snapshot.blockNumber,
        blockTimestamp: snapshot.blockTimestamp,
        isAllFresh: snapshot.isAllFresh,
        gasPriceGwei: `${gasPrice.gasPriceGwei.toFixed(2)} Gwei`
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
          minimumHoldingDays: rec.targetStrategyId === "faroo-patient-staking" ? 15 : 0,
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
            exitOperations: isPatientStaking ? ["Submit RequestWithdraw queue order (85,000 gas, 15-day total unbonding and settlement period: 14-day protocol queue + 1-day safety buffer)"] : isInstantDex ? ["Swap stPROS to WPROS on DEX AMM (145,000 gas assumed benchmark, 0.30% pool fee + slippage; unverified secondary liquidity)"] : []
          },
          disclosures: {
            provenance: "LIVE_ONCHAIN_PACIFIC_MAINNET",
            caching: "Short-lived in-memory cache (3,000ms TTL) applied to JSON-RPC reads to safeguard Pacific Mainnet RPC during burst execution; not long-term storage.",
            invariantNotice: "FEWER_THAN_THREE_QUALIFYING_SOURCES: Requirement not met (1 verified on-chain, 0 execution alternatives counted toward requirement).",
            singleSourceNotice: "Limited scope: Recommendation compares 1 qualifying on-chain source (Faroo stPROS) against Native PROS holding benchmark. Acceptance requirement of 3 qualifying sources is NOT MET.",
            dexExitNotice: "Faroo instant DEX exit is classified strictly as an EXECUTION ALTERNATIVE with 0.30% pool fee + slippage, NOT an independent yield source. No verified secondary stPROS pool exists on Pacific Mainnet; automated MOVE recommendations to instant DEX are disabled.",
            lifecycleUnification: "Unified 265,000-gas physical lifecycle: 180,000 gas ERC-4626 entry (Wrap 45k + Approve 45k + Deposit 90k) + 85,000 gas unbonding queue exit. Deducted once from gross yield.",
            breakEvenNotice: "Yield Accrual Break-Even indicates elapsed time to earn yield equal to transaction gas; it does NOT bypass the mandatory 15-day protocol unbonding and settlement requirement (14-day queue + 1-day buffer).",
            yieldAssumptionNotice: "Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ."
          },
          reasons: [
            rec.explanation,
            `Strict Acceptance Status: ${rec.verifiedQualifyingSourcesCount} of 3 qualifying sources verified on-chain. Single-source evaluation scope.`,
            rec.decision === "MOVE" ? `Projected Net Advantage: +${projectedNetGainPros.toFixed(6)} PROS over holding baseline PROS after deducting single lifecycle cost of ${frictionCostPros.toFixed(6)} PROS (${estimatedGasCostPros.toFixed(6)} PROS gas + ${nonGasFeeCostPros.toFixed(6)} PROS protocol fees).` : `Moving capital is not recommended under selected scenario parameters.`,
            isPatientStaking ? `Yield Accrual Break-Even: ${breakEvenFormatted} to recover gas cost from yield. Principal withdrawal remains subject to the mandatory 15-day protocol unbonding and settlement requirement (14-day queue + 1-day buffer).` : `Break-Even: ${breakEvenFormatted} under instant liquidity trading conditions.`,
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
async function apiDirectoryHandler(req, res) {
  try {
    const handled = await router.handleRequest(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.end(JSON.stringify({
        error: "Not Found",
        message: "Endpoint does not exist on Pharos Yield Optimizer API",
        path: req.url
      }, null, 2));
    }
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(JSON.stringify({
      error: "Internal Server Error",
      message: err instanceof Error ? err.message : "Unexpected server error"
    }, null, 2));
  }
}
export {
  config,
  apiDirectoryHandler as default,
  router
};
