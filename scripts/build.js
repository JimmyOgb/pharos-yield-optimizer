/**
 * Production Packaging & Build Pipeline
 * Compiles and bundles TypeScript sources into a standalone ESM distribution in dist/.
 * Zero runtime dependencies, reproducible, and verifiable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.resolve(ROOT_DIR, 'src');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');
const API_DIR = path.resolve(ROOT_DIR, 'api');
const API_SRC_DIR = path.resolve(SRC_DIR, 'api');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const UI_SRC_DIR = path.resolve(SRC_DIR, 'ui');
const UI_DIST_DIR = path.resolve(DIST_DIR, 'ui');
const API_DIST_DIR = path.resolve(DIST_DIR, 'api');

async function build() {
  const startTime = Date.now();
  console.log(`[BUILD] Starting Pharos Yield Optimizer production build...`);

  // 1. Clean and initialize dist/ and public/ directories
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(UI_DIST_DIR, { recursive: true });
  fs.mkdirSync(API_DIST_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  // 2. Bundle standalone server executable (dist/server.js)
  console.log(`[BUILD] Bundling server entry point (src/server/index.ts -> dist/server.js)...`);
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'server/index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: path.join(DIST_DIR, 'server.js'),
    sourcemap: true,
    packages: 'external',
    banner: {
      js: '// Pharos Yield Optimizer - Production Server Bundle\n// Chain ID: 1672 (Pharos Pacific Mainnet) | Mode: Strictly Read-Only\n',
    },
  });

  // 3. Bundle library export (dist/index.js)
  console.log(`[BUILD] Bundling library entry point (src/index.ts -> dist/index.js)...`);
  await esbuild.build({
    entryPoints: [path.join(SRC_DIR, 'index.ts')],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'esm',
    outfile: path.join(DIST_DIR, 'index.js'),
    sourcemap: true,
    packages: 'external',
    banner: {
      js: '// Pharos Yield Optimizer - Core Library Bundle\n// Chain ID: 1672 (Pharos Pacific Mainnet) | Mode: Strictly Read-Only\n',
    },
  });

  // 4. Bundle Vercel Serverless Function entry points (src/api/*.ts -> api/*.js and dist/api/*.js)
  console.log(`[BUILD] Bundling Vercel serverless adapters (src/api/*.ts -> api/*.js and dist/api/*.js)...`);
  fs.mkdirSync(API_DIR, { recursive: true });
  const apiEntryPoints = ['index.ts', 'health.ts', 'sources.ts', 'recommendation.ts', 'transaction-review.ts'];
  for (const entry of apiEntryPoints) {
    const entryName = entry.replace(/\.ts$/, '.js');
    const srcFile = path.join(API_SRC_DIR, entry);
    const outFileApi = path.join(API_DIR, entryName);
    const outFileDist = path.join(API_DIST_DIR, entryName);
    await esbuild.build({
      entryPoints: [srcFile],
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'esm',
      outfile: outFileApi,
      sourcemap: false,
      packages: 'external',
      banner: {
        js: `// Pharos Yield Optimizer - Vercel Serverless Function (${entry})\n// Chain ID: 1672 (Pharos Pacific Mainnet) | Mode: Strictly Read-Only\n`,
      },
    });
    fs.copyFileSync(outFileApi, outFileDist);
    if (fs.existsSync(outFileApi + '.map')) {
      fs.copyFileSync(outFileApi + '.map', outFileDist + '.map');
    }
    const stats = fs.statSync(outFileApi);
    console.log(`  - api/${entryName} & dist/api/${entryName} (${stats.size} bytes)`);
  }

  // 5. Synchronize static UI assets to dist/ui/ and public/
  console.log(`[BUILD] Synchronizing UI assets (src/ui/ -> dist/ui/ and public/)...`);
  const uiFiles = ['index.html', 'styles.css', 'app.js'];
  for (const file of uiFiles) {
    const srcFile = path.join(UI_SRC_DIR, file);
    const destFile = path.join(UI_DIST_DIR, file);
    const publicFile = path.join(PUBLIC_DIR, file);
    if (!fs.existsSync(srcFile)) {
      throw new Error(`Required UI asset missing: ${srcFile}`);
    }
    fs.copyFileSync(srcFile, destFile);
    fs.copyFileSync(srcFile, publicFile);
    const stats = fs.statSync(destFile);
    console.log(`  - dist/ui/${file} & public/${file} (${stats.size} bytes)`);
  }

  // 6. Generate Build Manifest
  const manifest = {
    name: 'pharos-yield-optimizer',
    version: '0.1.0',
    buildTimestamp: new Date().toISOString(),
    network: 'Pharos Pacific Mainnet',
    chainId: 1672,
    mode: 'strictly-read-only',
    deploymentTargets: {
      standaloneNode: 'dist/server.js',
      vercelServerless: 'api/index.ts (bundled to dist/api/index.js)',
      staticDelivery: 'public/ (Vercel Edge Network) and dist/ui/ (Standalone Node)',
    },
    artifacts: {
      server: {
        file: 'dist/server.js',
        sizeBytes: fs.statSync(path.join(DIST_DIR, 'server.js')).size,
      },
      library: {
        file: 'dist/index.js',
        sizeBytes: fs.statSync(path.join(DIST_DIR, 'index.js')).size,
      },
      serverlessAdapter: {
        file: 'dist/api/index.js',
        sizeBytes: fs.statSync(path.join(API_DIST_DIR, 'index.js')).size,
      },
      ui: uiFiles.map((f) => ({
        file: `dist/ui/${f}`,
        publicFile: `public/${f}`,
        sizeBytes: fs.statSync(path.join(UI_DIST_DIR, f)).size,
      })),
    },
  };

  fs.writeFileSync(
    path.join(DIST_DIR, 'build-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  const durationMs = Date.now() - startTime;
  console.log(`[BUILD] Production build completed in ${durationMs}ms.`);
  console.log(`[BUILD] Artifacts written to: ${DIST_DIR} and ${PUBLIC_DIR}`);
  console.log(`[BUILD] Production start command: node dist/server.js`);
}

build().catch((err) => {
  console.error('[BUILD ERROR]', err);
  process.exit(1);
});
