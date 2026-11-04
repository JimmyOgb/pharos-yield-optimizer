/**
 * Vercel Serverless Function — GET /api/sources
 * Verified Yield Source Inspection & Acceptance Invariant Endpoint
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { router } from './index.ts';

export default async function sourcesHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method?.toUpperCase() ?? 'GET';
  if (method !== 'GET' && method !== 'OPTIONS') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Allow', 'GET, OPTIONS');
    res.end(JSON.stringify({ error: 'Method Not Allowed', message: 'Only GET and OPTIONS are supported on /api/sources' }));
    return;
  }

  req.url = '/api/sources';
  await router.handleRequest(req, res);
}
