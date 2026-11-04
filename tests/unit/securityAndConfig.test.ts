/**
 * Security Hardening & Production Configuration Unit Tests
 * Verifies Gate 6 security invariants:
 * 1. Default loopback (127.0.0.1) binding & external binding detection.
 * 2. Strict Content Security Policy (CSP) and HTTP security headers.
 * 3. Sanitized error handling (zero stack trace leakage).
 * 4. Elimination of inline event handlers in frontend script and templates.
 * 5. Production configuration loading, parsing, and boundary validation.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, Logger } from '../../src/config/index.ts';
import { createServer, resolveUiDir } from '../../src/server/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UI_DIR = path.resolve(__dirname, '../../src/ui');

describe('Security Hardening & Production Configuration', () => {
  describe('Configuration Loader (loadConfig)', () => {
    it('provides safe defaults when no environment variables are set', () => {
      const config = loadConfig({});
      assert.equal(config.port, 3000);
      assert.equal(config.host, '127.0.0.1');
      assert.equal(config.rpcUrl, 'https://rpc.pharos.xyz');
      assert.equal(config.chainId, 1672);
      assert.equal(config.freshnessThresholdSeconds, 600);
      assert.equal(config.logLevel, 'info');
      assert.equal(config.corsOrigin, '*');
      assert.equal(config.isExternalBinding, false);
    });

    it('correctly parses custom valid configuration', () => {
      const config = loadConfig({
        PORT: '8080',
        HOST: '127.0.0.2',
        PHAROS_RPC_URL: 'https://archive-rpc.pharos.xyz',
        CHAIN_ID: '1672',
        FRESHNESS_THRESHOLD_SECONDS: '300',
        LOG_LEVEL: 'debug',
        CORS_ORIGIN: 'https://optimizer.pharos.xyz',
      });
      assert.equal(config.port, 8080);
      assert.equal(config.host, '127.0.0.2');
      assert.equal(config.rpcUrl, 'https://archive-rpc.pharos.xyz');
      assert.equal(config.chainId, 1672);
      assert.equal(config.freshnessThresholdSeconds, 300);
      assert.equal(config.logLevel, 'debug');
      assert.equal(config.corsOrigin, 'https://optimizer.pharos.xyz');
      assert.equal(config.isExternalBinding, false);
    });

    it('detects external host binding (0.0.0.0 or LAN IP)', () => {
      const allInterfaces = loadConfig({ HOST: '0.0.0.0' });
      assert.equal(allInterfaces.isExternalBinding, true);

      const ipv6All = loadConfig({ HOST: '::' });
      assert.equal(ipv6All.isExternalBinding, true);

      const lanIp = loadConfig({ HOST: '192.168.1.50' });
      assert.equal(lanIp.isExternalBinding, true);

      const localhost = loadConfig({ HOST: 'localhost' });
      assert.equal(localhost.isExternalBinding, false);
    });

    it('safely recovers from invalid numeric or enum inputs', () => {
      const invalid = loadConfig({
        PORT: 'not-a-number',
        CHAIN_ID: '-5',
        FRESHNESS_THRESHOLD_SECONDS: '1',
        LOG_LEVEL: 'unrecognized_level',
      });
      assert.equal(invalid.port, 3000);
      assert.equal(invalid.chainId, 1672);
      assert.equal(invalid.freshnessThresholdSeconds, 600);
      assert.equal(invalid.logLevel, 'info');
    });

    it('Logger functions without throwing at all levels', () => {
      const logger = new Logger('debug');
      // Should execute cleanly
      logger.debug('debug test');
      logger.info('info test');
      logger.warn('warn test');
      logger.error('error test');
      assert.ok(true);
    });
  });

  describe('HTTP Security Headers & CSP', () => {
    it('emits strict Content-Security-Policy and protective headers on HTML responses', async () => {
      const server = createServer();
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as { port: number }).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        assert.equal(res.status, 200);

        const csp = res.headers.get('content-security-policy');
        assert.ok(csp, 'CSP header must be present');
        assert.match(csp, /default-src 'self'/);
        assert.match(csp, /script-src 'self'/);
        assert.match(csp, /object-src 'none'/);
        assert.match(csp, /base-uri 'self'/);

        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(res.headers.get('x-frame-options'), 'DENY');
        assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('emits nosniff and does not leak stack traces on 404 responses', async () => {
      const server = createServer();
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const port = (server.address() as { port: number }).port;

      try {
        const res = await fetch(`http://127.0.0.1:${port}/non-existent-file-path`);
        assert.equal(res.status, 404);
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        const data = await res.json();
        assert.equal(data.error, 'Not Found');
        assert.equal(data.stack, undefined);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });

  describe('UI Security & Event Handler Verification', () => {
    it('verifies app.js contains zero inline onclick handlers or window.copyToClipboard leakage', () => {
      const appJsPath = path.join(UI_DIR, 'app.js');
      const appJsContent = fs.readFileSync(appJsPath, 'utf-8');

      // Check for inline onclick
      assert.equal(
        appJsContent.includes('onclick='),
        false,
        'app.js must not contain any inline onclick="..." attributes'
      );

      // Check for window.copyToClipboard
      assert.equal(
        appJsContent.includes('window.copyToClipboard'),
        false,
        'app.js must not expose window.copyToClipboard global function'
      );

      // Check for data-calldata attribute usage
      assert.ok(
        appJsContent.includes('data-calldata='),
        'app.js must use data-calldata attribute for safe copy handling'
      );
    });

    it('verifies index.html contains zero inline script blocks', () => {
      const htmlPath = path.join(UI_DIR, 'index.html');
      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

      // Strip <script src="..."></script> and verify no inline <script>...</script>
      const inlineScripts = htmlContent.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi);
      assert.equal(
        inlineScripts,
        null,
        'index.html must not contain any inline <script> blocks without src'
      );
    });

    it('resolveUiDir correctly finds UI assets', () => {
      const uiDir = resolveUiDir();
      assert.ok(fs.existsSync(uiDir));
      assert.ok(fs.existsSync(path.join(uiDir, 'index.html')));
    });
  });
});
