/**
 * Vercel Serverless Function — GET /api
 * Service Directory & Status Endpoint
 * 
 * Target: Pharos Pacific Mainnet (Chain ID 1672)
 * Pure TypeScript, zero runtime dependencies, strictly read-only and non-custodial.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { ApiRouter } from '../server/router.ts';
import { loadConfig } from '../config/index.ts';

// Warm container singleton initialization across invocations
const config = loadConfig();
const router = new ApiRouter(undefined, config.corsOrigin);

/**
 * Handler for /api service directory
 */
export default async function apiDirectoryHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const handled = await router.handleRequest(req, res);
    if (!handled) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify({
        error: 'Not Found',
        message: 'Endpoint does not exist on Pharos Yield Optimizer API',
        path: req.url,
      }, null, 2));
    }
  } catch (err) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: err instanceof Error ? err.message : 'Unexpected server error',
    }, null, 2));
  }
}

export { router, config };
