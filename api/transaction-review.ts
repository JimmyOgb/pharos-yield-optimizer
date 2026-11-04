/**
 * Vercel Serverless Function — POST /api/transaction-review
 * Non-Custodial Unsigned Calldata & Safety Review Endpoint
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { router } from './index.ts';

export default async function transactionReviewHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method?.toUpperCase() ?? 'POST';
  if (method !== 'POST' && method !== 'OPTIONS') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Allow', 'POST, OPTIONS');
    res.end(JSON.stringify({ error: 'Method Not Allowed', message: 'Only POST and OPTIONS are supported on /api/transaction-review' }));
    return;
  }

  req.url = '/api/transaction-review';
  await router.handleRequest(req, res);
}
