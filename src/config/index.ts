/**
 * Production Configuration Manager
 * Centralized, validated environment configuration with safe defaults.
 * Strictly read-only, non-custodial, zero credentials or secret keys.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  readonly port: number;
  readonly host: string;
  readonly rpcUrl: string;
  readonly chainId: number;
  readonly freshnessThresholdSeconds: number;
  readonly logLevel: LogLevel;
  readonly corsOrigin: string;
  readonly isExternalBinding: boolean;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Port
  const rawPort = env.PORT ?? '3000';
  let port = parseInt(rawPort, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    port = 3000;
  }

  // Host: Safe default loopback only
  const host = (env.HOST ?? '127.0.0.1').trim();
  const isExternalBinding = host === '0.0.0.0' || host === '::' || (!host.startsWith('127.') && host !== 'localhost');

  // Pharos RPC URL
  const rpcUrl = (env.PHAROS_RPC_URL ?? 'https://rpc.pharos.xyz').trim();

  // Chain ID
  const rawChainId = env.CHAIN_ID ?? '1672';
  let chainId = parseInt(rawChainId, 10);
  if (isNaN(chainId) || chainId <= 0) {
    chainId = 1672;
  }

  // Freshness threshold in seconds (default 10 minutes = 600s)
  const rawFreshness = env.FRESHNESS_THRESHOLD_SECONDS ?? '600';
  let freshnessThresholdSeconds = parseInt(rawFreshness, 10);
  if (isNaN(freshnessThresholdSeconds) || freshnessThresholdSeconds < 10) {
    freshnessThresholdSeconds = 600;
  }

  // Log level
  const rawLogLevel = (env.LOG_LEVEL ?? 'info').toLowerCase();
  const logLevel: LogLevel = (['debug', 'info', 'warn', 'error'].includes(rawLogLevel)
    ? rawLogLevel
    : 'info') as LogLevel;

  // CORS origin
  const corsOrigin = (env.CORS_ORIGIN ?? '*').trim();

  return {
    port,
    host,
    rpcUrl,
    chainId,
    freshnessThresholdSeconds,
    logLevel,
    corsOrigin,
    isExternalBinding,
  };
}

export class Logger {
  private readonly level: LogLevel;

  constructor(level: LogLevel = 'info') {
    this.level = level;
  }

  private shouldLog(targetLevel: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[targetLevel] >= LOG_LEVEL_PRIORITY[this.level];
  }

  public debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug('[DEBUG]', ...args);
    }
  }

  public info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  public warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  public error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }
}
