/**
 * API Router & HTTP Request Dispatcher
 * Native Node.js HTTP handler with zero runtime dependencies.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { PharosRpcClient } from '../rpc/pharosClient.ts';
import { LiveRecommendationBridge } from '../adapters/liveRecommendationBridge.ts';
import { TransactionReviewer } from '../reviewer/transactionReviewer.ts';
import { CANONICAL_CONTRACTS, NETWORK_CONFIG, type StrategyId } from '../types/index.ts';
import { decimalToWei, scaledToDecimal, formatBreakEvenDuration } from '../engine/yieldMath.ts';

export interface RateLimitConfig {
  readonly enabled?: boolean;
  readonly maxRequests?: number;
  readonly windowMs?: number;
}

export class ApiRouter {
  public readonly rpcClient: PharosRpcClient;
  public readonly bridge: LiveRecommendationBridge;
  public readonly corsOrigin: string;
  public readonly rateLimitConfig: { enabled: boolean; maxRequests: number; windowMs: number };
  private readonly ipRequests = new Map<string, number[]>();

  constructor(rpcClient?: PharosRpcClient, corsOrigin: string = '*', rateLimitConfig?: RateLimitConfig) {
    this.rpcClient = rpcClient ?? new PharosRpcClient({ rpcUrl: NETWORK_CONFIG.rpcUrl });
    this.bridge = new LiveRecommendationBridge(this.rpcClient);
    this.corsOrigin = corsOrigin;
    this.rateLimitConfig = {
      enabled: rateLimitConfig?.enabled ?? true,
      maxRequests: rateLimitConfig?.maxRequests ?? 60,
      windowMs: rateLimitConfig?.windowMs ?? 60_000,
    };
  }

  /**
   * Resets the in-memory rate limiter tracking (useful for test suites)
   */
  public resetRateLimits(): void {
    this.ipRequests.clear();
  }

  /**
   * Checks if client IP is currently rate limited
   */
  private checkRateLimit(req: IncomingMessage): boolean {
    if (!this.rateLimitConfig.enabled) return false;

    const forwarded = req.headers['x-forwarded-for'];
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress) || '127.0.0.1';
    const now = Date.now();
    const windowStart = now - this.rateLimitConfig.windowMs;

    let timestamps = this.ipRequests.get(ip) ?? [];
    timestamps = timestamps.filter(t => t > windowStart);

    if (timestamps.length >= this.rateLimitConfig.maxRequests) {
      this.ipRequests.set(ip, timestamps);
      return true; // Rate limited
    }

    timestamps.push(now);
    this.ipRequests.set(ip, timestamps);
    return false;
  }

  /**
   * Main dispatch entry point for HTTP requests
   */
  public async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const rawPath = typeof req.headers['x-matched-path'] === 'string'
      ? req.headers['x-matched-path']
      : (typeof req.headers['x-forwarded-uri'] === 'string' ? req.headers['x-forwarded-uri'] : (req.url ?? '/'));
    const url = new URL(rawPath, `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase() ?? 'GET';

    // CORS & Security headers
    res.setHeader('Access-Control-Allow-Origin', this.corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return true;
    }

    // Rate protection check
    if (this.checkRateLimit(req)) {
      res.statusCode = 429;
      res.setHeader('Retry-After', '60');
      this.sendJson(res, 429, {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${this.rateLimitConfig.maxRequests} requests per minute allowed.`,
        retryAfterSeconds: 60,
      });
      return true;
    }

    // Serverless API root status
    if ((pathname === '/api' || pathname === '/api/') && method === 'GET') {
      this.sendJson(res, 200, {
        service: 'pharos-yield-optimizer-api',
        network: NETWORK_CONFIG.name,
        chainId: NETWORK_CONFIG.chainId,
        mode: 'strictly-read-only',
        endpoints: [
          'GET /api/health',
          'GET /api/sources',
          'POST /api/recommendation',
          'POST /api/transaction-review',
        ],
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    if ((pathname === '/api/health' || pathname === '/health') && method === 'GET') {
      await this.handleHealth(req, res);
      return true;
    }

    if ((pathname === '/api/sources' || pathname === '/sources') && method === 'GET') {
      await this.handleSources(req, res);
      return true;
    }

    if ((pathname === '/api/recommendation' || pathname === '/recommendation') && method === 'POST') {
      await this.handleRecommendation(req, res);
      return true;
    }

    if ((pathname === '/api/transaction-review' || pathname === '/transaction-review') && method === 'POST') {
      await this.handleTransactionReview(req, res);
      return true;
    }

    return false;
  }

  /**
   * GET /api/health
   */
  private async handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const chainInfo = await this.rpcClient.verifyChainId();
      const block = await this.rpcClient.getLatestBlockHeader();
      const gasPrice = await this.rpcClient.getGasPrice();
      const nowSec = Math.floor(Date.now() / 1000);
      const ageSeconds = Math.max(0, nowSec - block.blockTimestamp);

      this.sendJson(res, 200, {
        status: 'healthy',
        network: NETWORK_CONFIG.name,
        chainId: chainInfo.chainId,
        rpcUrl: this.rpcClient.rpcUrl,
        latestBlockNumber: block.blockNumber,
        blockTimestamp: block.blockTimestamp,
        blockTimestampIso: new Date(block.blockTimestamp * 1000).toISOString(),
        gasPriceWei: gasPrice.gasPriceWei.toString(),
        gasPriceGwei: `${gasPrice.gasPriceGwei.toFixed(2)} Gwei`,
        isFresh: block.isFresh,
        ageSeconds,
        serverTime: new Date().toISOString(),
      });
    } catch (err) {
      this.sendJson(res, 503, {
        status: 'degraded',
        network: NETWORK_CONFIG.name,
        chainId: NETWORK_CONFIG.chainId,
        rpcUrl: this.rpcClient.rpcUrl,
        isFresh: false,
        error: err instanceof Error ? err.message : String(err),
        serverTime: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/sources
   */
  private async handleSources(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const context = await this.bridge.fetchLiveContext();
      const farooObs = context.farooObservation;

      const sources = [
        {
          id: 'faroo-stpros',
          name: 'Faroo Liquid Staked PROS',
          symbol: 'stPROS',
          asset: 'PROS (Native / WPROS)',
          contractAddress: CANONICAL_CONTRACTS.FAROO_STPROS,
          qualificationStatus: 'QUALIFIED_GENUINE_SOURCE',
          qualificationBadge: 'VERIFIED ON-CHAIN (1/1)',
          isVerifiedOnChain: true,
          liveRate: farooObs.spotRateDecimal.toFixed(8),
          liveRateUnit: 'PROS per stPROS',
          totalPooledAssets: farooObs.totalPooledProsFormatted,
          totalSupply: farooObs.totalSupplyFormatted,
          lastObservedBlock: farooObs.blockNumber,
          lastObservedTimestamp: farooObs.blockTimestamp,
          provenance: 'Direct eth_call to totalPooledPros() [0x01e1d114] and totalSupply() [0x18160ddd]',
          entryFee: '0% (Gas only, ~180k gas via ERC-4626 wrap + approve + deposit)',
          exitFeePatient: '0% (Gas only, 14-day protocol unbonding queue)',
          exitFeeInstant: '0.30% swap fee + slippage via DEX AMM',
          notes: 'Single verified yield source on Pacific Mainnet. Exchange-rate compounding liquid staking share.',
        },
        {
          id: 'pharos-dex-lp',
          name: 'Pharos DEX Liquidity Pool',
          symbol: 'stPROS/PROS LP',
          asset: 'PROS / stPROS Pair',
          contractAddress: CANONICAL_CONTRACTS.DEX_POOL_MANAGER,
          qualificationStatus: 'DISQUALIFIED_FROM_LIVE_APR',
          qualificationBadge: 'DISQUALIFIED — APR UNAVAILABLE',
          isVerifiedOnChain: true,
          liveRate: 'UNAVAILABLE',
          liveRateUnit: 'Dynamic LP Fee APR',
          lastObservedBlock: context.blockNumber,
          provenance: 'Uniswap V4 PoolManager verified on-chain; dynamic fee APR unavailable without public indexer/subgraph',
          entryFee: 'Gas only (~120k gas)',
          exitFee: 'Gas only (~100k gas) + LP divergence loss risk',
          exclusionReason: 'Dynamic fee APR cannot be computed without a live volume indexer or subgraph on Pacific Mainnet. Model refuses to fabricate LP trading returns.',
          notes: 'Contract infrastructure exists and is linked, but dynamic trading yield is strictly unavailable.',
        },
        {
          id: 'axil-apc3m',
          name: 'Axil Prime Credit 3M',
          symbol: 'APC3M',
          asset: 'USDC (USD Private Credit)',
          contractAddress: CANONICAL_CONTRACTS.AXIL_CORE_VAULT,
          qualificationStatus: 'DISQUALIFIED_FROM_PROS_REBALANCING',
          qualificationBadge: 'DISQUALIFIED — OFF-CHAIN TARGET',
          isVerifiedOnChain: true,
          liveRate: '8.00% (Target APY)',
          liveRateUnit: 'Off-Chain Target APY',
          provenance: 'Off-chain advertised target APY. Secondary USDC vault accepting USD stablecoins, not PROS.',
          entryFee: 'Double AMM swap friction (PROS -> USDC) + gas',
          exitFee: 'Double AMM swap friction (USDC -> PROS) + gas + 3-month lockup',
          exclusionReason: 'Off-chain target APY for USD private credit. Not an on-chain PROS yield mechanism. Excluded to prevent misleading users.',
          notes: 'Different asset class (USDC) with credit risk and 3-month fixed lockup.',
        },
        {
          id: 'native-pos-consensus',
          name: 'Native PoS Consensus Staking',
          symbol: 'PROS Validator',
          asset: 'Native PROS',
          contractAddress: '0x0000000000000000000000000000000000000000',
          qualificationStatus: 'DISQUALIFIED_AS_DELEGATABLE',
          qualificationBadge: 'DISQUALIFIED — NOT DELEGATABLE',
          isVerifiedOnChain: false,
          liveRate: '~8.50% (Nominal Validator Emission)',
          liveRateUnit: 'Validator Protocol Emission',
          provenance: 'Pharos Consensus Specification documentation only. No public delegator contract deployed.',
          entryFee: 'Hardware setup + 32,000+ PROS minimum node deposit',
          exitFee: '21-day consensus unbonding period',
          exclusionReason: 'Pharos Pacific Mainnet does not have a permissionless validator delegation smart contract. Individual delegators cannot stake native PROS without running hardware.',
          notes: 'Underlying consensus emission, but inaccessible as a direct user delegation strategy.',
        },
      ];

      this.sendJson(res, 200, {
        invariantNotice: {
          status: 'FEWER_THAN_THREE_QUALIFYING_SOURCES',
          verifiedCount: 1,
          requiredCount: 3,
          isRequirementMet: false,
          message: 'Only ONE qualifying yield source (Faroo stPROS) is currently verified on Pacific Mainnet. The three-source acceptance requirement is not yet met.',
        },
        sources,
        latestBlockNumber: context.blockNumber,
        gasPriceGwei: `${context.gasPriceGwei.toFixed(2)} Gwei`,
      });
    } catch (err) {
      this.sendJson(res, 500, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * POST /api/recommendation
   */
  private async handleRecommendation(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.readJsonBody<{
        principalPros?: number;
        horizonDays?: number;
        requiresInstantLiquidity?: boolean;
        currentStrategyId?: string;
      }>(req);

      const principalPros = typeof body.principalPros === 'number' && body.principalPros > 0 ? body.principalPros : 1000;
      const horizonDays = typeof body.horizonDays === 'number' && body.horizonDays > 0 ? body.horizonDays : 60;
      const requireInstantLiquidity = Boolean(body.requiresInstantLiquidity);

      // Map strategy string to StrategyId safely
      let currentStrategyId: StrategyId = 'native-pros-baseline';
      if (body.currentStrategyId === 'faroo-patient-staking') {
        currentStrategyId = 'faroo-patient-staking';
      } else if (body.currentStrategyId === 'faroo-instant-dex') {
        currentStrategyId = 'faroo-instant-dex';
      } else if (body.currentStrategyId === 'axil-prime-credit-3m' || body.currentStrategyId === 'axil-prime-credit') {
        currentStrategyId = 'axil-prime-credit-3m';
      }

      const principalWei = decimalToWei(principalPros);

      const result = await this.bridge.evaluateLiveRecommendation({
        principalWei,
        asset: 'PROS',
        horizonDays,
        requireInstantLiquidity,
        currentStrategyId,
      });

      // Format recommendation output for frontend consumption
      const rec = result.recommendation;
      const targetProj = rec.comparisons.find(c => c.profile.id === rec.targetStrategyId)
        || rec.comparisons.find(c => c.profile.id === 'faroo-patient-staking')
        || rec.comparisons[0];

      const projectedNetGainPros = Number(rec.netAdvantageWei) / 1e18;
      
      // Dynamic complete lifecycle gas accounting
      const gasPriceGwei = result.status === 'SUCCESS' ? result.context.gasPriceGwei : 1.25;
      const gasPriceSource = result.status === 'SUCCESS' ? 'LIVE_PACIFIC_MAINNET' : 'CONFIGURED_BASELINE';

      // Distinguish entry-only gas (Wrap 45k + Approve 45k + Deposit 90k = 180,000 gas units)
      // from exit gas (Queue 85,000 gas or DEX Swap 145,000 gas assumed)
      const isPatientStaking = rec.targetStrategyId === 'faroo-patient-staking';
      const isInstantDex = rec.targetStrategyId === 'faroo-instant-dex';
      const entryGasUnits = 180_000;
      const exitGasUnits = isPatientStaking ? 85_000 : (isInstantDex ? 145_000 : 0);
      const modeledGasUnits = isPatientStaking ? 265_000 : (isInstantDex ? 325_000 : 0);
      const entryGasCostPros = (entryGasUnits * gasPriceGwei) / 1e9;

      // Extract accurate friction evaluated by the engine (no hardcoded gas numbers)
      const estimatedGasCostPros = targetProj ? scaledToDecimal(targetProj.friction.gasCostWei) : entryGasCostPros;
      const nonGasFeeCostPros = targetProj
        ? scaledToDecimal(
            targetProj.friction.entryFeeWei +
            targetProj.friction.exitFeeWei +
            targetProj.friction.swapFeeWei +
            targetProj.friction.slippageCostWei
          )
        : 0;
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
          minimumHoldingDays: rec.targetStrategyId === 'faroo-patient-staking' ? 14 : 0,
          lifecycleGas: {
            entryGasUnits,
            exitGasUnits,
            modeledGasUnits,
            gasPriceGwei,
            gasPriceSource,
            entryGasCostPros: entryGasCostPros.toFixed(6),
            lifecycleGasCostPros: estimatedGasCostPros.toFixed(6),
            entryOperations: [
              'Wrap Native PROS to Canonical WPROS (45,000 gas)',
              'Approve Faroo stPROS Vault to spend WPROS (45,000 gas)',
              'Deposit WPROS into Faroo stPROS Vault (90,000 gas)',
            ],
            exitOperations: isPatientStaking
              ? ['Submit RequestWithdraw queue order (85,000 gas, 14-day protocol unbonding period)']
              : isInstantDex
              ? ['Swap stPROS to WPROS on DEX AMM (145,000 gas assumed benchmark, 0.30% pool fee + slippage)']
              : [],
          },
          disclosures: {
            provenance: 'LIVE_ONCHAIN_PACIFIC_MAINNET',
            caching: 'Short-lived in-memory cache (3,000ms TTL) applied to JSON-RPC reads to safeguard Pacific Mainnet RPC during burst execution; not long-term storage.',
            invariantNotice: 'FEWER_THAN_THREE_QUALIFYING_SOURCES: Requirement not met (1 verified on-chain, 0 execution alternatives counted toward requirement).',
            singleSourceNotice: 'Limited scope: Recommendation compares 1 qualifying on-chain source (Faroo stPROS) against Native PROS holding benchmark. Acceptance requirement of 3 qualifying sources is NOT MET.',
            dexExitNotice: 'Faroo instant DEX exit is classified strictly as an EXECUTION ALTERNATIVE with 0.30% pool fee + slippage, NOT an independent yield source. Instant exit swap gas (145k) is an empirical benchmark assumption, not a live measured receipt.',
            lifecycleUnification: 'Unified 265,000-gas physical lifecycle: 180,000 gas ERC-4626 entry (Wrap 45k + Approve 45k + Deposit 90k) + 85,000 gas unbonding queue exit. Deducted once from gross yield.',
            breakEvenNotice: 'Yield Accrual Break-Even indicates elapsed time to earn yield equal to transaction gas; it does NOT bypass the mandatory 14-day protocol unbonding queue.',
            yieldAssumptionNotice: 'Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ.',
          },
          reasons: [
            rec.explanation,
            `Strict Acceptance Status: ${rec.verifiedQualifyingSourcesCount} of 3 qualifying sources verified on-chain. Single-source evaluation scope.`,
            rec.decision === 'MOVE'
              ? `Projected Net Advantage: +${projectedNetGainPros.toFixed(6)} PROS over holding baseline PROS after deducting single lifecycle cost of ${frictionCostPros.toFixed(6)} PROS (${estimatedGasCostPros.toFixed(6)} PROS gas + ${nonGasFeeCostPros.toFixed(6)} PROS protocol fees).`
              : `Moving capital is not recommended under selected scenario parameters.`,
            isPatientStaking
              ? `Yield Accrual Break-Even: ${breakEvenFormatted} to recover gas cost from yield. Principal withdrawal remains subject to the 14-day protocol unbonding queue.`
              : `Break-Even: ${breakEvenFormatted} under instant liquidity trading conditions.`,
            'Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ.',
          ],
        },
      };

      this.sendJson(res, 200, responsePayload);
    } catch (err) {
      this.sendJson(res, 400, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * POST /api/transaction-review
   */
  private async handleTransactionReview(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.readJsonBody<{
        strategyId?: string;
        amountPros?: number;
        userAddress?: string;
      }>(req);

      const strategyId = body.strategyId ?? 'faroo-patient-staking';
      const amountPros = typeof body.amountPros === 'number' && body.amountPros > 0 ? body.amountPros : 1000;
      const userAddress = typeof body.userAddress === 'string' && body.userAddress.trim() !== ''
        ? body.userAddress.trim()
        : undefined;

      const gasPrice = await this.rpcClient.getGasPrice();
      const block = await this.rpcClient.getLatestBlockHeader();

      const review = TransactionReviewer.generateReview({
        strategyId,
        amountPros,
        userAddress,
        gasPriceWei: gasPrice.gasPriceWei,
        observedBlockNumber: block.blockNumber,
        observedBlockTimestamp: block.blockTimestamp,
      });

      this.sendJson(res, 200, review);
    } catch (err) {
      this.sendJson(res, 400, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data, null, 2));
  }

  private async readJsonBody<T>(req: IncomingMessage): Promise<T> {
    // If the runtime (e.g. Vercel Serverless) has already parsed the request body:
    const anyReq = req as unknown as { body?: unknown };
    if (anyReq.body !== undefined && anyReq.body !== null) {
      if (typeof anyReq.body === 'object') {
        return anyReq.body as T;
      }
      if (typeof anyReq.body === 'string') {
        const trimmed = anyReq.body.trim();
        if (trimmed.length === 0) {
          return {} as T;
        }
        if (trimmed.length > 1024 * 64) {
          throw new Error('Payload too large');
        }
        try {
          return JSON.parse(trimmed) as T;
        } catch {
          throw new Error('Invalid JSON payload');
        }
      }
    }

    // Standard Node.js streaming request body reader
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
        if (data.length > 1024 * 64) {
          reject(new Error('Payload too large'));
        }
      });
      req.on('end', () => {
        try {
          if (!data || data.trim().length === 0) {
            resolve({} as T);
            return;
          }
          resolve(JSON.parse(data) as T);
        } catch (e) {
          reject(new Error('Invalid JSON payload'));
        }
      });
      req.on('error', reject);
    });
  }
}
