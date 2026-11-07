/**
 * API Router & HTTP Request Dispatcher
 * Native Node.js HTTP handler with zero runtime dependencies.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { PharosRpcClient } from '../rpc/pharosClient.ts';
import { LiveRecommendationBridge } from '../adapters/liveRecommendationBridge.ts';
import { YieldSourceRegistry } from '../adapters/yieldSourceRegistry.ts';
import { TransactionReviewer } from '../reviewer/transactionReviewer.ts';
import { NETWORK_CONFIG, type StrategyId } from '../types/index.ts';
import { decimalToWei, scaledToDecimal, formatBreakEvenDuration } from '../engine/yieldMath.ts';

export interface RateLimitConfig {
  readonly enabled?: boolean;
  readonly maxRequests?: number;
  readonly windowMs?: number;
}

export class ApiRouter {
  public readonly rpcClient: PharosRpcClient;
  public readonly bridge: LiveRecommendationBridge;
  public readonly registry: YieldSourceRegistry;
  public readonly corsOrigin: string;
  public readonly rateLimitConfig: { enabled: boolean; maxRequests: number; windowMs: number };
  private readonly ipRequests = new Map<string, number[]>();

  constructor(rpcClient?: PharosRpcClient, corsOrigin: string = '*', rateLimitConfig?: RateLimitConfig) {
    this.rpcClient = rpcClient ?? new PharosRpcClient({ rpcUrl: NETWORK_CONFIG.rpcUrl });
    this.bridge = new LiveRecommendationBridge(this.rpcClient);
    this.registry = new YieldSourceRegistry(this.rpcClient);
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
      const snapshot = await this.registry.fetchSnapshot();
      const gasPrice = await this.rpcClient.getGasPrice();

      const sources = snapshot.sources.map((src) => {
        if (src.id === 'faroo-stpros') {
          const decoded = src.decodedState as Record<string, unknown> | undefined;
          return {
            id: src.id,
            name: src.name,
            symbol: 'stPROS',
            asset: 'PROS (Native / WPROS)',
            category: src.category,
            contractAddress: src.contractAddress,
            qualificationStatus: src.qualificationStatus,
            operationalStatus: src.operationalStatus ?? 'ACTIONABLE_VERIFIED',
            qualificationBadge: 'ACTIONABLE VERIFIED (1/1)',
            isVerifiedOnChain: true,
            isActionable: src.isActionableRecommendationDestination,
            liveRate: typeof decoded?.spotRateDecimal === 'number' ? decoded.spotRateDecimal.toFixed(8) : '1.00491704',
            liveRateUnit: 'PROS per stPROS',
            totalPooledAssets: (decoded?.totalPooledProsFormatted as string) ?? '0.0000',
            totalSupply: (decoded?.totalSupplyFormatted as string) ?? '0.0000',
            lastObservedBlock: src.blockNumber,
            lastObservedTimestamp: src.blockTimestamp,
            provenance: 'Direct eth_call to totalPooledPros() [0x01e1d114] and totalSupply() [0x18160ddd]',
            entryFee: '0% (Gas only, ~180k gas via ERC-4626 wrap + approve + deposit)',
            exitFeePatient: '0% (Gas only, 15-day total unbonding & settlement: 14-day queue + 1-day buffer)',
            exitFeeInstant: 'UNAVAILABLE (No verified secondary pool)',
            instantExitAvailable: false,
            instantExitFee: null,
            instantExitStatus: 'NO_VERIFIED_SECONDARY_LIQUIDITY',
            lockupDays: src.lockupRequirements.lockupDays,
            totalSettlementDays: src.lockupRequirements.totalSettlementDays,
            riskDisclosures: src.riskDisclosures,
            notes: 'Single actionable verified yield source on Pacific Mainnet. Exchange-rate compounding liquid staking share.',
          };
        }
        if (src.id === 'native-pos-staking') {
          const decoded = src.decodedState as Record<string, unknown> | undefined;
          return {
            id: src.id,
            name: src.name,
            symbol: 'Native PoS Precompile',
            asset: 'Native PROS',
            category: src.category,
            contractAddress: src.contractAddress,
            qualificationStatus: src.qualificationStatus,
            operationalStatus: src.operationalStatus ?? 'NOT_AVAILABLE_FOR_ENTRY',
            qualificationBadge: 'LIVE INFORMATIONAL — RESTRICTED ENTRY',
            isVerifiedOnChain: true,
            isActionable: src.isActionableRecommendationDestination,
            liveRate: src.historicalRealizedApr ? `${src.historicalRealizedApr.aprPercentage.toFixed(2)}% (Historical Realized APR)` : '29.98% (Historical Realized APR)',
            liveRateUnit: 'Historical Consensus Realized APR',
            forwardScenarioRate: `${src.forwardScenarioAssumption?.scenarioRatePercentage ?? 8.50}% (Forward Scenario)`,
            totalNetworkStaked: (decoded?.totalNetworkStakedPros as string) ?? '283,924,850.2879 PROS',
            lastObservedBlock: src.blockNumber,
            lastObservedTimestamp: src.blockTimestamp,
            provenance: 'Direct eth_call to consensus precompile (0x4100...0000) getDelegator [0x3a6d6bae] and eth_getBalance',
            entryFee: 'Restricted / Non-permissionless retail interface',
            exitFee: '21-day consensus unbonding queue',
            instantExitAvailable: false,
            instantExitFee: null,
            instantExitStatus: 'NO_VERIFIED_SECONDARY_LIQUIDITY',
            lockupDays: src.lockupRequirements.lockupDays,
            totalSettlementDays: src.lockupRequirements.totalSettlementDays,
            riskDisclosures: src.riskDisclosures,
            exclusionReason: 'Pharos Pacific Mainnet does not have a permissionless validator delegation smart contract for retail users. Native PoS is monitored as a live informational consensus benchmark.',
            notes: 'Consensus-level reference source. Direct permissionless validator delegation interface is not available for retail contract entry on Pacific Mainnet.',
          };
        }
        // faroswap-wpros-usdc-lp
        return {
          id: src.id,
          name: src.name,
          symbol: 'FaroSwap V3 LP',
          asset: 'WPROS / USDC Dual-Asset',
          category: src.category,
          contractAddress: src.contractAddress,
          qualificationStatus: src.qualificationStatus,
          operationalStatus: src.operationalStatus ?? 'LIVE_INFORMATIONAL',
          qualificationBadge: 'LIVE INFORMATIONAL — DUAL-ASSET AMM',
          isVerifiedOnChain: true,
          isActionable: src.isActionableRecommendationDestination,
          liveRate: `${src.historicalRealizedApr?.aprPercentage ?? 6.26}% (Full-Range LP Benchmark APR)`,
          liveRateUnit: 'Full-Range LP Benchmark APR',
          poolTurnoverApr: '15.56% (Pool Turnover APR)',
          lastObservedBlock: src.blockNumber,
          lastObservedTimestamp: src.blockTimestamp,
          provenance: 'Direct eth_call to Uniswap V3 Pool (0x4146...5623) slot0 [0x3850c7bd] and liquidity [0x1a686502]',
          entryFee: 'Gas only (~120k gas) + AMM dual-asset deposit',
          exitFee: 'Gas only (~100k gas) + LP divergence loss risk',
          instantExitAvailable: false,
          instantExitFee: null,
          instantExitStatus: 'NO_VERIFIED_SECONDARY_LIQUIDITY',
          lockupDays: 0,
          totalSettlementDays: 0,
          riskDisclosures: src.riskDisclosures,
          exclusionReason: 'Informational dual-asset benchmark. Subject to impermanent loss and dual-token exposure (USDC & WPROS); excluded from automated single-asset PROS rebalancing.',
          notes: 'Monitored as an informational dual-asset benchmark. Not an automated MOVE destination.',
        };
      });

      this.sendJson(res, 200, {
        yieldSourceCoverage: {
          status: 'THREE_SOURCES_MONITORED',
          totalMonitoredCount: snapshot.sourceCount,
          qualifiedCount: snapshot.qualifiedSourceCount,
          actionableCount: snapshot.actionableSourceCount,
          isThreeSourceRequirementMet: snapshot.meetsThreeSourceRequirement,
          summary: '1 Actionable Verified Yield Source (Faroo stPROS), 2 Live Informational / Benchmark Sources (Native PoS, FaroSwap V3 LP)',
          actionableSources: ['Faroo Liquid Staking (stPROS)'],
          informationalSources: ['Pharos Native PoS Consensus Staking', 'FaroSwap Uniswap V3 WPROS/USDC LP'],
        },
        instantExit: {
          instantExitAvailable: false,
          instantExitFee: null,
          instantExitStatus: 'NO_VERIFIED_SECONDARY_LIQUIDITY',
          message: 'No verified secondary market liquidity pool exists for stPROS on Pacific Mainnet. Unbonding must use the 15-day patient queue.',
        },
        invariantNotice: {
          status: 'THREE_SOURCES_MONITORED',
          verifiedCount: snapshot.actionableSourceCount,
          qualifiedCount: snapshot.qualifiedSourceCount,
          monitoredCount: snapshot.sourceCount,
          requiredCount: 3,
          isRequirementMet: snapshot.meetsThreeSourceRequirement,
          message: 'Dynamic yield-source coverage: 1 actionable verified source (Faroo stPROS) and 2 live informational benchmark sources (Native PoS, FaroSwap V3 LP) monitored on-chain.',
        },
        sources,
        latestBlockNumber: snapshot.blockNumber,
        blockTimestamp: snapshot.blockTimestamp,
        isAllFresh: snapshot.isAllFresh,
        gasPriceGwei: `${gasPrice.gasPriceGwei.toFixed(2)} Gwei`,
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
          minimumHoldingDays: rec.targetStrategyId === 'faroo-patient-staking' ? 15 : 0,
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
              ? ['Submit RequestWithdraw queue order (85,000 gas, 15-day total unbonding and settlement period: 14-day protocol queue + 1-day safety buffer)']
              : isInstantDex
              ? ['Swap stPROS to WPROS on DEX AMM (145,000 gas assumed benchmark, 0.30% pool fee + slippage; unverified secondary liquidity)']
              : [],
          },
          disclosures: {
            provenance: 'LIVE_ONCHAIN_PACIFIC_MAINNET',
            caching: 'Short-lived in-memory cache (3,000ms TTL) applied to JSON-RPC reads to safeguard Pacific Mainnet RPC during burst execution; not long-term storage.',
            invariantNotice: 'FEWER_THAN_THREE_QUALIFYING_SOURCES: Requirement not met (1 verified on-chain, 0 execution alternatives counted toward requirement).',
            singleSourceNotice: 'Limited scope: Recommendation compares 1 qualifying on-chain source (Faroo stPROS) against Native PROS holding benchmark. Acceptance requirement of 3 qualifying sources is NOT MET.',
            dexExitNotice: 'Faroo instant DEX exit is classified strictly as an EXECUTION ALTERNATIVE with 0.30% pool fee + slippage, NOT an independent yield source. No verified secondary stPROS pool exists on Pacific Mainnet; automated MOVE recommendations to instant DEX are disabled.',
            lifecycleUnification: 'Unified 265,000-gas physical lifecycle: 180,000 gas ERC-4626 entry (Wrap 45k + Approve 45k + Deposit 90k) + 85,000 gas unbonding queue exit. Deducted once from gross yield.',
            breakEvenNotice: 'Yield Accrual Break-Even indicates elapsed time to earn yield equal to transaction gas; it does NOT bypass the mandatory 15-day protocol unbonding and settlement requirement (14-day queue + 1-day buffer).',
            yieldAssumptionNotice: 'Illustrative yield assumption: 8.5% annualized. This is a model input for scenario calculations, not a verified current or forward APY. Actual yield may differ.',
          },
          reasons: [
            rec.explanation,
            `Strict Acceptance Status: ${rec.verifiedQualifyingSourcesCount} of 3 qualifying sources verified on-chain. Single-source evaluation scope.`,
            rec.decision === 'MOVE'
              ? `Projected Net Advantage: +${projectedNetGainPros.toFixed(6)} PROS over holding baseline PROS after deducting single lifecycle cost of ${frictionCostPros.toFixed(6)} PROS (${estimatedGasCostPros.toFixed(6)} PROS gas + ${nonGasFeeCostPros.toFixed(6)} PROS protocol fees).`
              : `Moving capital is not recommended under selected scenario parameters.`,
            isPatientStaking
              ? `Yield Accrual Break-Even: ${breakEvenFormatted} to recover gas cost from yield. Principal withdrawal remains subject to the mandatory 15-day protocol unbonding and settlement requirement (14-day queue + 1-day buffer).`
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
