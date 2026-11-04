# GATE 5.1 — HTTP SERVER & API SECURITY AUDIT REPORT
## Endpoint Resilience, Input Validation, Path Traversal & DOM Safety

**Project:** Pharos Yield Optimizer  
**Task Slug:** `yield-optimizer`  
**Network:** Pharos Pacific Mainnet (`Chain ID: 1672`, Currency: `PROS`)  
**Workspace:** `C:\Users\NO GO NO\PharosBuild\skills\pharos-yield-optimizer`  
**Target Files:** `src/server/index.ts`, `src/server/router.ts`, `src/ui/app.js`  
**Audit Date:** November 3, 2026  
**Auditor:** Antigravity AI  

---

## 1. Executive Summary & Verdict

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      API & SERVER AUDIT: PASS WITH WARNINGS                   ║
║  • Static Path Traversal: IMPOSSIBLE (Exact-match routing, zero dynamic paths)║
║  • Request Size Capping: 64 KB limit enforced (Anti-DoS)                      ║
║  • Input Sanitization: Comprehensive regex & fallback guards                  ║
║  • State-Change Risk: ZERO (All POST endpoints are read-only computations)     ║
║  • ⚠️ Warning 1: Server listens on default host; should bind to 127.0.0.1      ║
║  • ⚠️ Warning 2: Wildcard CORS ('*'); recommend domain lock for production     ║
║  • ⚠️ Warning 3: Missing Content-Security-Policy (CSP) HTTP headers           ║
║  • ⚠️ Warning 4: Inline onclick attribute in app.js calldata copy button      ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. Server Architecture & Network Exposure

### A. Bind Address & Network Interface
- **Code Reference:** `src/server/index.ts:77-78`:
  ```ts
  const server = createServer();
  server.listen(PORT, () => { ... });
  ```
- **Audit Finding:**
  Node.js `server.listen(PORT)` without an explicit host string binds to `0.0.0.0` (all IPv4 interfaces) or `::` (all IPv6 interfaces).
- **Risk Level:** **Low (Development Server)** / **Medium (Production Deployment)**.
  Binding to all network interfaces may expose the local development server to other machines on the same local area network (LAN).
- **Hardening Recommendation:**
  Explicitly specify the loopback interface:
  ```ts
  const HOST = process.env.HOST || '127.0.0.1';
  server.listen(PORT, HOST, () => { ... });
  ```

### B. Cross-Origin Resource Sharing (CORS) Policy
- **Code Reference:** `src/server/router.ts:33-35`:
  ```ts
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  ```
- **Audit Finding:**
  The server sets wildcard CORS (`*`).
- **Risk Level:** **Low** for read-only non-custodial endpoints (no private user data or session cookies are handled).
- **Hardening Recommendation:**
  In production, restrict `Access-Control-Allow-Origin` to the specific deployed frontend domain.

### C. Content-Security-Policy (CSP)
- **Audit Finding:**
  The HTTP server does not currently emit a `Content-Security-Policy` header.
- **Risk Level:** **Low**.
- **Hardening Recommendation:**
  Add a strict CSP header:
  ```ts
  res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://rpc.pharos.xyz;");
  ```

---

## 3. Request Handling & Denial-of-Service (DoS) Protection

### A. Request Body Size Limit
- **Code Reference:** `src/server/router.ts:319-323`:
  ```ts
  let data = '';
  req.on('data', chunk => {
    data += chunk;
    if (data.length > 1024 * 64) {
      reject(new Error('Payload too large'));
    }
  });
  ```
- **Audit Finding:**
  Incoming request bodies are strictly capped at 64 KB (65,536 bytes). Requests exceeding this threshold immediately abort and emit a `Payload too large` error.
- **Status:** **PASS**. Prevents memory exhaustion attacks via oversized JSON payloads.

### B. Safe JSON Parsing
- **Code Reference:** `src/server/router.ts:325-335`:
  ```ts
  try {
    if (!data || data.trim().length === 0) {
      resolve({} as T);
      return;
    }
    resolve(JSON.parse(data) as T);
  } catch (e) {
    reject(new Error('Invalid JSON payload'));
  }
  ```
- **Audit Finding:**
  All parsing is enclosed within `try/catch`. Malformed JSON returns HTTP `400 Bad Request` with an explicit `{ error: 'Invalid JSON payload' }`.
- **Status:** **PASS**.

---

## 4. Input Validation & Numeric Sanitization

### A. Scenario Input Validation (`POST /api/recommendation`)
- **Code Reference:** `src/server/router.ts:208-223`:
  - `principalPros`: Strictly validated as `typeof body.principalPros === 'number' && body.principalPros > 0 ? body.principalPros : 1000`.
  - `horizonDays`: Strictly validated as `typeof body.horizonDays === 'number' && body.horizonDays > 0 ? body.horizonDays : 60`.
  - `currentStrategyId`: Safely mapped through an explicit whitelist. Any unmapped or invalid string safely defaults to `'native-pros-baseline'`.
- **Status:** **PASS**.

### B. Transaction Review Input Validation (`POST /api/transaction-review`)
- **Code Reference:** `src/server/router.ts:271-278`:
  - `userAddress`: Validated against EVM address regular expression: `/^0x[a-fA-F0-9]{40}$/`. If invalid or absent, safely defaults to the zero address `0x0000000000000000000000000000000000000000`.
  - `amountPros`: Validated as positive number with default fallback.
  - `strategyId`: Evaluated against strict strategy switch. Unsupported IDs throw an error caught by the 400 handler.
- **Status:** **PASS**.

---

## 5. Path Traversal & Static Asset Security

- **Code Reference:** `src/server/index.ts:30-48`:
  ```ts
  if (pathname === '/' || pathname === '/index.html') {
    serveFile(res, path.join(UI_DIR, 'index.html'), 'text/html; charset=utf-8');
    return;
  }
  if (pathname === '/styles.css') {
    serveFile(res, path.join(UI_DIR, 'styles.css'), 'text/css; charset=utf-8');
    return;
  }
  if (pathname === '/app.js') {
    serveFile(res, path.join(UI_DIR, 'app.js'), 'application/javascript; charset=utf-8');
    return;
  }
  // 404 Not Found
  res.statusCode = 404;
  ```
- **Audit Finding:**
  The server implements **exact-string matching** for static files. The incoming URL pathname is **never** passed into `path.join()` or `fs.readFileSync()`.
- **Status:** **PASS (IMMUNE TO PATH TRAVERSAL)**. Classic directory traversal payloads (e.g. `GET /../../etc/passwd` or `GET /..\..\windows\win.ini`) match none of the exact branches and immediately return `404 Not Found`.

---

## 6. DOM Security & Injection Analysis

- **HTML Escaping Implementation:**
  `src/ui/app.js:387-396` implements an `escapeHtml` utility:
  ```js
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  ```
- **Audit Finding on Dynamic Rendering:**
  In `renderSources`, `renderRecommendation`, and `renderReviewerModal`, all dynamic strings interpolated into `innerHTML` pass through `escapeHtml(...)`.
- **Warning / Hardening Finding:**
  In `src/ui/app.js:361`:
  ```html
  <button class="copy-btn" onclick="copyToClipboard('${step.payload.data}', this)">Copy Calldata</button>
  ```
  While `step.payload.data` is currently generated strictly by `TransactionReviewer` as an alphanumeric hex string (`0x[0-9a-f]+`), using inline `onclick` string interpolation inside HTML attributes is a suboptimal pattern.
- **Recommendation:**
  In a future gate, replace inline `onclick` with a `data-calldata` attribute and an event listener on the modal container (`document.addEventListener('click', ...)`).

---

## 7. Side-Effect Neutrality

- **Audit Question:** Can POST requests trigger unexpected side effects, disk mutations, or blockchain state changes?
- **Audit Finding:**
  - `POST /api/recommendation` only calls `bridge.evaluateLiveRecommendation()`, performing purely read-only RPC queries and mathematical projections in memory.
  - `POST /api/transaction-review` only calls `TransactionReviewer.generateReview()`, generating an in-memory JSON report.
  - Zero files are written to disk, zero contracts are deployed, and zero state-mutating RPC calls are triggered.
- **Status:** **PASS**.
