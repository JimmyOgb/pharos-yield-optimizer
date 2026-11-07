/**
 * Pharos Yield Optimizer Client Application
 * Communicates with the local Node.js API server to provide real-time,
 * deterministic DeFi yield optimization on Pharos Pacific Mainnet (Chain ID 1672).
 * STRICT BOUNDARIES: Zero private key access, non-custodial transaction preview only.
 */

// State
const state = {
  health: null,
  sources: [],
  invariantNotice: null,
  currentRecommendation: null,
  receiverAddress: '',
  scenario: {
    principalPros: 1000,
    horizonDays: 60,
    requiresInstantLiquidity: false,
    currentStrategyId: 'canonical-wpros-baseline',
  },
  isEvaluating: false,
};

// DOM Elements
const rpcStatusVal = document.getElementById('rpcStatusVal');
const latestBlockVal = document.getElementById('latestBlockVal');
const blockTimeVal = document.getElementById('blockTimeVal');
const gasPriceVal = document.getElementById('gasPriceVal');
const freshnessVal = document.getElementById('freshnessVal');
const lastRefreshVal = document.getElementById('lastRefreshVal');
const networkDot = document.getElementById('networkDot');
const refreshBtn = document.getElementById('refreshBtn');

const decisionBadgeContainer = document.getElementById('decisionBadgeContainer');
const netAlphaVal = document.getElementById('netAlphaVal');
const netAlphaSubtext = document.getElementById('netAlphaSubtext');
const gasCostEstVal = document.getElementById('gasCostEstVal');
const frictionCostVal = document.getElementById('frictionCostVal');
const breakEvenVal = document.getElementById('breakEvenVal');
const lockupPeriodVal = document.getElementById('lockupPeriodVal');
const reasonsList = document.getElementById('reasonsList');
const openReviewerBtn = document.getElementById('openReviewerBtn');

const principalInput = document.getElementById('principalInput');
const horizonInput = document.getElementById('horizonInput');
const horizonValDisplay = document.getElementById('horizonValDisplay');
const currentStrategySelect = document.getElementById('currentStrategySelect');
const liquidityRadios = document.querySelectorAll('input[name="liquidityPref"]');
const quickAmountBtns = document.querySelectorAll('.btn-chip');

const sourcesList = document.getElementById('sourcesList');
const reviewerModal = document.getElementById('reviewerModal');
const reviewerModalBody = document.getElementById('reviewerModalBody');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalDismissBtn = document.getElementById('modalDismissBtn');

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await refreshAll();
  // Poll network health every 15 seconds
  setInterval(refreshHealth, 15000);
});

function setupEventListeners() {
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    await refreshAll();
    refreshBtn.disabled = false;
  });

  // Principal input
  principalInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      state.scenario.principalPros = val;
      updateQuickAmountActive(val);
      debounceEvaluate();
    }
  });

  // Quick Amount chips
  quickAmountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const amt = parseFloat(btn.dataset.amount);
      principalInput.value = amt;
      state.scenario.principalPros = amt;
      updateQuickAmountActive(amt);
      debounceEvaluate();
    });
  });

  // Horizon slider
  horizonInput.addEventListener('input', (e) => {
    const days = parseInt(e.target.value, 10);
    state.scenario.horizonDays = days;
    horizonValDisplay.textContent = `${days} Days`;
    debounceEvaluate();
  });

  // Liquidity preference radio buttons
  liquidityRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.scenario.requiresInstantLiquidity = (e.target.value === 'instant');
      debounceEvaluate();
    });
  });

  // Current strategy dropdown
  currentStrategySelect.addEventListener('change', (e) => {
    state.scenario.currentStrategyId = e.target.value;
    debounceEvaluate();
  });

  // Open reviewer modal
  openReviewerBtn.addEventListener('click', openTransactionReviewer);

  // Close reviewer modal
  closeModalBtn.addEventListener('click', closeTransactionReviewer);
  modalDismissBtn.addEventListener('click', closeTransactionReviewer);
  reviewerModal.addEventListener('click', (e) => {
    if (e.target === reviewerModal) closeTransactionReviewer();
  });
}

function updateQuickAmountActive(amount) {
  quickAmountBtns.forEach(btn => {
    if (parseFloat(btn.dataset.amount) === amount) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

let debounceTimer = null;
function debounceEvaluate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    evaluateScenario();
  }, 300);
}

// Data Fetching Helpers
/**
 * Safely fetches and parses JSON from an API endpoint with robust error handling.
 * Validates HTTP status and Content-Type before parsing JSON.
 * Distinguishes server/infrastructure errors from RPC errors.
 */
async function fetchJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (netErr) {
    throw new Error(`Network request failed: ${netErr.message || 'Unable to reach host'}`);
  }

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      try {
        const errData = await res.json();
        const msg = errData.message || errData.error || `Server error HTTP ${res.status}`;
        const error = new Error(msg);
        error.status = res.status;
        error.data = errData;
        throw error;
      } catch (parseErr) {
        if (parseErr.status) throw parseErr;
        throw new Error(`Server returned error HTTP ${res.status} (${res.statusText || 'Error'})`);
      }
    } else {
      // Non-JSON error (e.g. Vercel plain text or HTML error page)
      const text = await res.text().catch(() => '');
      const sanitized = text.length > 100 ? text.slice(0, 100) + '...' : text;
      const error = new Error(`Server error HTTP ${res.status}${sanitized ? ': ' + sanitized.trim() : ''}`);
      error.status = res.status;
      throw error;
    }
  }

  if (!isJson) {
    const text = await res.text().catch(() => '');
    const sanitized = text.length > 80 ? text.slice(0, 80) + '...' : text;
    throw new Error(`Unexpected server response (expected JSON, got "${contentType || 'unknown'}": ${sanitized.trim()})`);
  }

  try {
    return await res.json();
  } catch (jsonErr) {
    throw new Error(`Malformed JSON response from server: ${jsonErr.message}`);
  }
}

// Data Fetching
async function refreshAll() {
  await Promise.all([
    refreshHealth(),
    refreshSources(),
    evaluateScenario(),
  ]);
}

async function refreshHealth() {
  try {
    const data = await fetchJson('/api/health');
    state.health = data;

    if (data.status === 'healthy') {
      rpcStatusVal.textContent = 'Connected (HTTP 200)';
      rpcStatusVal.className = 'val text-success';
      networkDot.className = 'status-dot healthy';
      latestBlockVal.textContent = `#${data.latestBlockNumber.toLocaleString()}`;
      blockTimeVal.textContent = new Date(data.blockTimestamp * 1000).toLocaleTimeString();
      gasPriceVal.textContent = data.gasPriceGwei;
      freshnessVal.innerHTML = data.isFresh
        ? `<span class="badge badge-success">Fresh (${data.ageSeconds}s ago)</span>`
        : `<span class="badge badge-danger">Stale (${data.ageSeconds}s ago)</span>`;
      lastRefreshVal.textContent = new Date().toLocaleTimeString();
    } else {
      rpcStatusVal.textContent = 'RPC Unhealthy / Stale';
      rpcStatusVal.className = 'val text-warning';
      networkDot.className = 'status-dot degraded';
      freshnessVal.innerHTML = `<span class="badge badge-danger">Degraded</span>`;
    }
  } catch (err) {
    const isServerErr = err.status >= 500 || (err.message && err.message.includes('Server error HTTP'));
    if (isServerErr) {
      rpcStatusVal.textContent = `API Error (HTTP ${err.status || 500})`;
      rpcStatusVal.className = 'val text-danger';
      networkDot.className = 'status-dot degraded';
      freshnessVal.innerHTML = `<span class="badge badge-danger">API Unavailable</span>`;
    } else {
      rpcStatusVal.textContent = 'Connection Error';
      rpcStatusVal.className = 'val text-danger';
      networkDot.className = 'status-dot degraded';
      freshnessVal.innerHTML = `<span class="badge badge-danger">Offline</span>`;
    }
  }
}

async function refreshSources() {
  try {
    const data = await fetchJson('/api/sources');
    state.sources = data.sources || [];
    state.invariantNotice = data.invariantNotice || null;

    renderSources();
  } catch (err) {
    sourcesList.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
  }
}

function renderSources() {
  if (!state.sources || state.sources.length === 0) {
    sourcesList.innerHTML = `<div class="loading-placeholder">No sources retrieved.</div>`;
    return;
  }

  sourcesList.innerHTML = state.sources.map(src => {
    const isQualified = src.qualificationStatus === 'QUALIFIED_GENUINE_SOURCE';
    const cardClass = isQualified ? 'source-card qualified' : 'source-card disqualified';
    const badgeClass = isQualified ? 'badge badge-success' : 'badge badge-warning';

    let exclusionHtml = '';
    if (src.exclusionReason) {
      exclusionHtml = `
        <div class="source-exclusion-box">
          <strong>Disqualification Audit:</strong> ${escapeHtml(src.exclusionReason)}
        </div>
      `;
    }

    return `
      <div class="${cardClass}">
        <div class="source-header">
          <div class="source-title-group">
            <h3>${escapeHtml(src.name)} <span class="font-mono text-muted">(${escapeHtml(src.symbol)})</span></h3>
            <span class="source-meta">${escapeHtml(src.asset)} • ${escapeHtml(src.contractAddress.slice(0, 10))}...${escapeHtml(src.contractAddress.slice(-8))}</span>
          </div>
          <span class="${badgeClass}">${escapeHtml(src.qualificationBadge)}</span>
        </div>

        <div class="source-grid">
          <div class="source-metric">
            <span class="source-metric-label">${src.liveRateUnit && src.liveRateUnit.includes('per') ? 'On-Chain Spot Rate' : 'Advertised / Target APY'}</span>
            <span class="source-metric-val font-mono">${escapeHtml(src.liveRate)} <small class="text-dim">${escapeHtml(src.liveRateUnit)}</small></span>
          </div>
          <div class="source-metric">
            <span class="source-metric-label">Entry Friction</span>
            <span class="source-metric-val">${escapeHtml(src.entryFee)}</span>
          </div>
        </div>

        ${exclusionHtml}

        <div class="source-provenance">
          <strong>Evidence Provenance:</strong> ${escapeHtml(src.provenance)}
        </div>
      </div>
    `;
  }).join('');
}

async function evaluateScenario() {
  if (state.isEvaluating) return;
  state.isEvaluating = true;

  try {
    decisionBadgeContainer.innerHTML = `<span class="decision-badge badge-loading">COMPUTING...</span>`;

    const data = await fetchJson('/api/recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.scenario),
    });

    state.currentRecommendation = data;
    renderRecommendation(data);
  } catch (err) {
    decisionBadgeContainer.innerHTML = `<span class="decision-badge badge-insufficient">ERROR</span>`;
    netAlphaVal.textContent = '— PROS';
    netAlphaSubtext.textContent = 'Engine evaluation temporarily unavailable';
    reasonsList.innerHTML = `<li>${escapeHtml(err.message)}</li>`;
    openReviewerBtn.disabled = true;
  } finally {
    state.isEvaluating = false;
  }
}

function renderRecommendation(data) {
  if (!data || !data.recommendation) return;

  const rec = data.recommendation;
  const decision = rec.decision;

  // Render Decision Badge
  if (decision === 'MOVE') {
    decisionBadgeContainer.innerHTML = `<span class="decision-badge badge-move">ACTION: MOVE</span>`;
    netAlphaVal.className = 'hero-value font-mono text-success';
    netAlphaVal.textContent = `+${rec.projectedNetGainFormatted}`;
    netAlphaSubtext.textContent = `Target Strategy: ${formatStrategyName(rec.targetStrategyId)} over ${state.scenario.horizonDays} days`;
    openReviewerBtn.disabled = false;
  } else if (decision === 'STAY_PUT') {
    decisionBadgeContainer.innerHTML = `<span class="decision-badge badge-stay">VERDICT: STAY PUT</span>`;
    netAlphaVal.className = 'hero-value font-mono text-warning';
    netAlphaVal.textContent = `0.000000 PROS`;
    netAlphaSubtext.textContent = 'Rebalancing is uneconomical or constrained by lockup/friction';
    openReviewerBtn.disabled = true;
  } else {
    // INSUFFICIENT_DATA
    decisionBadgeContainer.innerHTML = `<span class="decision-badge badge-insufficient">INSUFFICIENT DATA</span>`;
    netAlphaVal.className = 'hero-value font-mono text-danger';
    netAlphaVal.textContent = '— PROS';
    netAlphaSubtext.textContent = 'Data freshness or RPC availability safeguards triggered';
    openReviewerBtn.disabled = true;
  }

  // Render Stats
  gasCostEstVal.textContent = `${rec.estimatedGasCostPros} PROS`;
  if (rec.protocolFeeCostPros !== undefined) {
    const feeNum = Number(rec.protocolFeeCostPros);
    frictionCostVal.textContent = feeNum === 0 ? '0.000000 PROS (0%)' : `${rec.protocolFeeCostPros} PROS`;
  } else if (rec.targetStrategyId === 'faroo-patient-staking') {
    frictionCostVal.textContent = '0.000000 PROS (0%)';
  } else {
    frictionCostVal.textContent = `${rec.frictionCostPros} PROS`;
  }
  breakEvenVal.textContent = rec.breakEvenFormatted
    || (rec.breakEvenDays === 0
      ? 'Immediate (0 days)'
      : !isFinite(rec.breakEvenDays)
        ? 'Never (Infinite)'
        : rec.breakEvenDays < 1
          ? `${Math.max(1, Math.round(rec.breakEvenDays * 1440))} mins (< 1 day)`
          : `${rec.breakEvenDays.toFixed(2)} Days`);

  lockupPeriodVal.textContent = rec.minimumHoldingDays > 0
    ? `${rec.minimumHoldingDays} Days Mandatory`
    : 'None (Liquid)';

  // Render Reasons
  if (rec.reasons && rec.reasons.length > 0) {
    reasonsList.innerHTML = rec.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('');
  } else {
    reasonsList.innerHTML = `<li>No additional details provided.</li>`;
  }
}

// Transaction Reviewer Modal
async function openTransactionReviewer(customAddress) {
  if (!state.currentRecommendation || state.currentRecommendation.recommendation.decision !== 'MOVE') {
    return;
  }

  if (typeof customAddress === 'string') {
    state.receiverAddress = customAddress.trim();
  }

  reviewerModal.style.display = 'flex';
  reviewerModalBody.innerHTML = `<div class="loading-placeholder">Preparing unsigned transaction calldata...</div>`;

  try {
    const targetStrategyId = state.currentRecommendation.recommendation.targetStrategyId;
    const reqBody = {
      strategyId: targetStrategyId,
      amountPros: state.scenario.principalPros,
    };
    if (state.receiverAddress) {
      reqBody.userAddress = state.receiverAddress;
    }

    const report = await fetchJson('/api/transaction-review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });

    renderReviewerModal(report);
  } catch (err) {
    reviewerModalBody.innerHTML = `<div class="error-msg">Failed to prepare review: ${escapeHtml(err.message)}</div>`;
  }
}

function renderReviewerModal(report) {
  if (!report || !report.steps) {
    reviewerModalBody.innerHTML = `<div class="error-msg">Malformed review response.</div>`;
    return;
  }

  let reviewStatusBanner = '';
  if (report.isReadyForExternalReview) {
    reviewStatusBanner = `
      <div style="background: var(--color-success-bg, rgba(16,185,129,0.12)); border: 1px solid var(--color-success, #10b981); border-radius: var(--radius-sm, 6px); padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 12.5px; color: var(--color-success, #10b981); font-weight: 600;">✓ Ready for External Review — All execution steps verified with valid receiver</span>
        <span class="badge badge-success" style="font-size: 10px;">READY TO EXPORT</span>
      </div>
    `;
  } else {
    reviewStatusBanner = `
      <div style="background: var(--color-warning-bg, rgba(245,158,11,0.12)); border: 1px solid var(--color-warning, #f59e0b); border-radius: var(--radius-sm, 6px); padding: 10px 14px; margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 12.5px; color: var(--color-warning, #f59e0b); font-weight: 600;">⚠️ Incomplete Calldata — Receiver wallet address required for Step 3</span>
        <span class="badge badge-warning" style="font-size: 10px;">RECEIVER REQUIRED</span>
      </div>
    `;
  }

  let feedbackText = '';
  let feedbackColor = 'var(--text-muted)';
  if (report.receiverStatus === 'VALID') {
    feedbackText = `✓ Valid Pacific Mainnet address (${escapeHtml(report.receiverAddress || '')}). Calldata is ready for external inspection.`;
    feedbackColor = 'var(--color-success)';
  } else if (report.receiverStatus === 'INVALID_ZERO_ADDRESS') {
    feedbackText = '✗ Rejected: Zero address (0x0000...0000) cannot receive minted stPROS shares. Enter a valid account address.';
    feedbackColor = 'var(--color-danger)';
  } else if (report.receiverStatus === 'INVALID_FORMAT') {
    feedbackText = '✗ Rejected: Malformed address syntax. Expected 0x followed by exactly 40 hex characters.';
    feedbackColor = 'var(--color-danger)';
  } else {
    feedbackText = 'Provide your external Pacific Mainnet address to generate ready-to-use Step 3 calldata for external review.';
    feedbackColor = 'var(--text-muted)';
  }

  const receiverInputHtml = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px; margin: 12px 0;">
      <label for="modalReceiverInput" style="display:block; font-size:12px; font-weight:600; margin-bottom:4px; color:var(--text-main);">
        Recipient Account (Pacific Mainnet address to receive stPROS):
      </label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="modalReceiverInput" placeholder="0x... (Enter 40-character hex wallet address)" value="${escapeHtml(state.receiverAddress || '')}" style="flex:1; padding:6px 10px; font-family:var(--font-mono); font-size:12px; background:var(--bg-input); border:1px solid var(--border-strong); border-radius:var(--radius-sm); color:var(--text-main);" />
        <button id="applyReceiverBtn" type="button" class="btn btn-secondary" style="font-size:12px; padding:6px 14px; cursor:pointer;">Update Calldata</button>
      </div>
      <div id="receiverFeedbackMsg" style="font-size:11px; margin-top:5px; color:${feedbackColor};">${feedbackText}</div>
    </div>
  `;

  const stepsHtml = report.steps.map(step => {
    let payloadHtml = '';
    if (step.payloadStatus === 'AVAILABLE' && step.payload) {
      payloadHtml = `
        <div class="calldata-box">
          <button class="copy-btn" data-calldata="${escapeHtml(step.payload.data)}" type="button">Copy Calldata</button>
          <div><strong>To:</strong> ${escapeHtml(step.payload.to)}</div>
          <div><strong>Value:</strong> ${escapeHtml(step.payload.value)} wei (${parseInt(step.payload.value, 16) / 1e18} PROS)</div>
          <div><strong>Gas Limit:</strong> ${escapeHtml(step.payload.gasLimit)}</div>
          <div><strong>Chain ID:</strong> ${escapeHtml(step.payload.chainId.toString())}</div>
          <div style="margin-top:6px;"><strong>Calldata (Raw Hex):</strong></div>
          <div style="font-size:11px; margin-top:2px;">${escapeHtml(step.payload.data)}</div>
        </div>
      `;
    } else if (step.payloadStatus === 'INCOMPLETE') {
      payloadHtml = `
        <div class="source-exclusion-box" style="margin: 12px 0; border-left: 3px solid var(--color-warning);">
          <strong>Calldata Incomplete:</strong> ${escapeHtml(step.unavailabilityReason || 'Receiver address required.')}
          <div style="margin-top: 4px; font-size: 11.5px; color: var(--text-muted);">
            Receiver-dependent calldata cannot be copied or exported until a valid Pacific Mainnet recipient address is provided above.
          </div>
        </div>
      `;
    } else {
      payloadHtml = `
        <div class="source-exclusion-box" style="margin: 12px 0;">
          <strong>Calldata Unavailable:</strong> ${escapeHtml(step.unavailabilityReason || 'Contract ABI not verified.')}
        </div>
      `;
    }

    let paramsHtml = '';
    if (step.parameters && step.parameters.length > 0) {
      paramsHtml = `
        <table class="step-params-table">
          <thead>
            <tr><th>Parameter</th><th>Type</th><th>Value</th></tr>
          </thead>
          <tbody>
            ${step.parameters.map(p => {
              const isReceiver = p.name === 'receiver';
              let badgeHtml = '';
              let valClass = 'font-mono';
              if (isReceiver) {
                if (report.receiverStatus === 'VALID') {
                  badgeHtml = '<span class="badge badge-success" style="margin-left:6px; font-size:10px;">Verified Receiver (1672)</span>';
                  valClass = 'font-mono text-success';
                } else if (report.receiverStatus === 'INVALID_ZERO_ADDRESS') {
                  badgeHtml = '<span class="badge badge-danger" style="margin-left:6px; font-size:10px;">Rejected: Zero Address</span>';
                  valClass = 'font-mono text-danger';
                } else if (report.receiverStatus === 'INVALID_FORMAT') {
                  badgeHtml = '<span class="badge badge-danger" style="margin-left:6px; font-size:10px;">Rejected: Malformed Address</span>';
                  valClass = 'font-mono text-danger';
                } else {
                  badgeHtml = '<span class="badge badge-warning" style="margin-left:6px; font-size:10px;">Receiver Required</span>';
                  valClass = 'font-mono text-warning';
                }
              }
              return `
              <tr>
                <td><code>${escapeHtml(p.name)}</code></td>
                <td><code>${escapeHtml(p.type)}</code></td>
                <td>
                  <span class="${valClass}">${escapeHtml(p.formatted)}</span>
                  ${badgeHtml}
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    let risksHtml = '';
    if (step.risksAndConstraints && step.risksAndConstraints.length > 0) {
      risksHtml = `
        <ul class="step-risks">
          ${step.risksAndConstraints.map(risk => `<li>${escapeHtml(risk)}</li>`).join('')}
        </ul>
      `;
    }

    let stepBadge = '';
    if (step.payloadStatus === 'AVAILABLE') {
      stepBadge = '<span class="badge badge-success">READY FOR REVIEW</span>';
    } else if (step.payloadStatus === 'INCOMPLETE') {
      stepBadge = '<span class="badge badge-warning">CALLDATA INCOMPLETE</span>';
    } else {
      stepBadge = '<span class="badge badge-danger">ABI UNVERIFIED</span>';
    }

    return `
      <div class="reviewer-step">
        <div class="reviewer-step-header">
          <div class="step-title">
            <span class="step-num-badge">${step.stepNumber}</span>
            ${escapeHtml(step.title)}
          </div>
          ${stepBadge}
        </div>

        <div class="step-contract-info">
          <strong>Target Contract:</strong> ${escapeHtml(step.contractName)} (<code>${escapeHtml(step.contractAddress)}</code>)<br>
          <strong>Method:</strong> <code>${escapeHtml(step.methodName)}</code> [selector: <code>${escapeHtml(step.selector)}</code>]
        </div>

        <p style="font-size: 12.5px; color: #cbd5e1; margin-bottom: 8px;">
          ${escapeHtml(step.explanation)}
        </p>

        ${paramsHtml}
        ${payloadHtml}
        ${risksHtml}
      </div>
    `;
  }).join('');

  reviewerModalBody.innerHTML = `
    ${reviewStatusBanner}
    <div style="margin-bottom: 16px;">
      <h3 style="font-size: 15px; margin-bottom: 4px;">${escapeHtml(report.strategyName)}</h3>
      <p style="font-size: 13px; color: var(--text-muted);">${escapeHtml(report.actionSummary)}</p>
      <div style="font-size: 12px; color: var(--accent-secondary); margin-top: 6px;">
        Estimated Total Gas: <strong>${escapeHtml(report.estimatedGasCostPros)} PROS</strong> (${escapeHtml(report.gasPriceGwei)} Gwei gas price)
      </div>
      ${receiverInputHtml}
    </div>
    ${stepsHtml}
  `;

  // Attach listener for applying receiver address
  const applyBtn = document.getElementById('applyReceiverBtn');
  const receiverInput = document.getElementById('modalReceiverInput');
  if (applyBtn && receiverInput) {
    applyBtn.addEventListener('click', () => {
      openTransactionReviewer(receiverInput.value);
    });
    receiverInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        openTransactionReviewer(receiverInput.value);
      }
    });
  }
}

function closeTransactionReviewer() {
  reviewerModal.style.display = 'none';
}

// Copy-to-clipboard event listener via safe event delegation
reviewerModalBody.addEventListener('click', (event) => {
  const target = event.target;
  if (!target || !target.classList.contains('copy-btn')) return;

  const calldata = target.getAttribute('data-calldata');
  if (!calldata) return;

  const handleSuccess = () => {
    const originalText = target.textContent;
    target.textContent = 'Copied!';
    setTimeout(() => {
      target.textContent = originalText;
    }, 1500);
  };

  const handleFailure = () => {
    target.textContent = 'Failed';
    setTimeout(() => {
      target.textContent = 'Copy Calldata';
    }, 1500);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(calldata).then(handleSuccess).catch(() => {
      fallbackCopy(calldata, handleSuccess, handleFailure);
    });
  } else {
    fallbackCopy(calldata, handleSuccess, handleFailure);
  }
});

function fallbackCopy(text, onSuccess, onFailure) {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) {
      onSuccess();
      return;
    }
  } catch (e) {
    // ignore
  }
  onFailure();
}

function formatStrategyName(strategyId) {
  const map = {
    'faroo-patient-staking': 'Faroo Liquid Staking (14d Patient Queue Exit)',
    'faroo-instant-dex': 'Faroo Liquid Staking (Instant DEX Exit)',
    'canonical-wpros-baseline': 'Canonical WPROS Benchmark (0.00%)',
    'pharos-dex-lp': 'Pharos DEX LP',
    'axil-prime-credit': 'Axil Prime Credit (USDC)',
  };
  return map[strategyId] || strategyId;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
