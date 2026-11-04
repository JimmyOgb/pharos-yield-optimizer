/**
 * HTTP Server Entry Point
 * Serves the Pharos Yield Optimizer Dashboard and REST API.
 * Pure Node.js standard library with zero runtime dependencies.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiRouter } from './router.ts';
import { loadConfig, type AppConfig } from '../config/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolves UI directory across development (src/) and production (dist/) structures.
 */
export function resolveUiDir(): string {
  const candidates = [
    path.resolve(__dirname, '../ui'),
    path.resolve(__dirname, './ui'),
    path.resolve(process.cwd(), 'dist/ui'),
    path.resolve(process.cwd(), 'src/ui'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return path.resolve(__dirname, '../ui');
}

export function createServer(router?: ApiRouter, config?: AppConfig): http.Server {
  const appConfig = config ?? loadConfig();
  const apiRouter = router ?? new ApiRouter(undefined, appConfig.corsOrigin);
  const uiDir = resolveUiDir();

  const server = http.createServer(async (req, res) => {
    try {
      // First, attempt to handle API routes
      const handled = await apiRouter.handleRequest(req, res);
      if (handled) return;

      // Handle static file serving for UI
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const pathname = url.pathname;

      if (pathname === '/' || pathname === '/index.html') {
        serveFile(res, path.join(uiDir, 'index.html'), 'text/html; charset=utf-8');
        return;
      }

      if (pathname === '/styles.css') {
        serveFile(res, path.join(uiDir, 'styles.css'), 'text/css; charset=utf-8');
        return;
      }

      if (pathname === '/app.js') {
        serveFile(res, path.join(uiDir, 'app.js'), 'application/javascript; charset=utf-8');
        return;
      }

      // 404 Not Found
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify({ error: 'Not Found', path: pathname }));
    } catch {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  });

  return server;
}

function serveFile(res: http.ServerResponse, filePath: string, contentType: string): void {
  if (!fs.existsSync(filePath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end('File not found');
    return;
  }

  const content = fs.readFileSync(filePath);
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://rpc.pharos.xyz; img-src 'self' data:; object-src 'none'; base-uri 'self';"
  );
  res.end(content);
}

/**
 * Starts the HTTP server on configured port and host binding.
 */
export function startServer(customConfig?: Partial<AppConfig>): Promise<{
  server: http.Server;
  config: AppConfig;
  url: string;
}> {
  return new Promise((resolve, reject) => {
    const config = { ...loadConfig(), ...customConfig };
    const server = createServer(undefined, config);

    server.on('error', reject);
    server.listen(config.port, config.host, () => {
      const url = `http://${config.host}:${config.port}`;
      console.log(`========================================================`);
      console.log(`Pharos Yield Optimizer Dashboard Server Started`);
      console.log(`URL: ${url}`);
      console.log(`Network: Pharos Pacific Mainnet (Chain ID ${config.chainId})`);
      console.log(`Mode: Strictly Read-Only & Non-Custodial`);
      if (config.isExternalBinding) {
        console.warn(`[SECURITY WARNING] Bound to external interface: ${config.host}`);
        console.warn(`Ensure network firewall and reverse proxy are active.`);
      } else {
        console.log(`Binding: Local Loopback Only (${config.host})`);
      }
      console.log(`========================================================`);
      resolve({ server, config, url });
    });
  });
}

// Auto-start if run directly
if (process.argv[1] === __filename) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
