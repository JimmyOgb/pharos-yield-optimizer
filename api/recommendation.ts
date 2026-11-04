/**
 * Vercel Serverless Function — POST /api/recommendation
 * Deterministic Yield Optimization Engine Endpoint
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { router } from './index.ts';

export default async function recommendationHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method?.toUpperCase() ?? 'POST';
  if (method !== 'POST' && method !== 'OPTIONS') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Allow', 'POST, OPTIONS');
    res.end(JSON.stringify({ error: 'Method Not Allowed', message: 'Only POST and OPTIONS are supported on /api/recommendation' }));
    return;
  }

  req.url = '/api/recommendation';
  await router.handleRequest(req, res);
}
