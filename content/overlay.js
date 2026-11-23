/**
 * Dropship Buster - In-Page Floating Overlay UI
 * Renders an unobtrusive interactive widget on flagged product pages
 */

(function () {
  // Prevent duplicate execution
  if (window.__dropshipOverlayLoaded) return;
  window.__dropshipOverlayLoaded = true;

  function initOverlay() {
    const scan = window.__dropshipScanResult;
    if (!scan) return;

    // Only display automatically if it's a product page and has noticeable risk
    if (!scan.isProductPage || scan.riskScore < 30) {
      return;
    }

    // Check if dismissed in this session
    if (sessionStorage.getItem('db_overlay_dismissed') === 'true') {
      return;
    }

    createFloatingWidget(scan);
  }

  function createFloatingWidget(scan) {
    // Remove existing if any
    const existing = document.getElementById('dropship-buster-root');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'dropship-buster-root';

    const p = scan.product || {};
    const riskColor = scan.riskScore >= 70 ? '#EF4444' : scan.riskScore >= 50 ? '#F59E0B' : '#10B981';
    const riskBadgeClass = scan.riskScore >= 70 ? 'db-badge-red' : scan.riskScore >= 50 ? 'db-badge-amber' : 'db-badge-green';

    const shouldAutoPopup = scan.riskScore >= 50;
    const cardInitialDisplay = shouldAutoPopup ? 'flex' : 'none';
    const pillInitialDisplay = shouldAutoPopup ? 'none' : 'flex';

    root.innerHTML = `
      <div id="db-pill" class="db-pill ${scan.riskScore >= 70 ? 'db-pill-red' : 'db-pill-amber'}" style="display: ${pillInitialDisplay};">
        <div class="db-pill-icon">⚠️</div>
        <div class="db-pill-text">
          <span class="db-pill-bold">Dropship Alert:</span>
          <span>${scan.riskScore}% Probability</span>
        </div>
        <button id="db-pill-expand-btn" class="db-pill-btn" title="View Supplier & Compare">Unmask</button>
      </div>

      <div id="db-card" class="db-card ${shouldAutoPopup ? 'db-card-popup-alert' : ''}" style="display: ${cardInitialDisplay};">
        <div class="db-card-banner-alert">
          <span class="db-alert-icon">🚨</span>
          <span><strong>DON'T OVERPAY!</strong> Dropship markup detected.</span>
        </div>

        <div class="db-card-header">
          <div class="db-header-left">
            <span class="db-logo-icon">🛡️</span>
            <div>
              <div class="db-card-title">Dropship Buster</div>
              <div class="db-card-subtitle">Real Factory Price Finder</div>
            </div>
          </div>
          <div class="db-header-actions">
            <button id="db-btn-minimize" class="db-icon-btn" title="Minimize to corner">−</button>
            <button id="db-btn-close" class="db-icon-btn" title="Close for this session">×</button>
          </div>
        </div>

        <div class="db-card-body">
          <div class="db-risk-meter">
            <div class="db-risk-tag ${riskBadgeClass}">
              ${scan.riskScore}% RISK • ${scan.riskLevel}
            </div>
            <div class="db-meter-bar">
              <div class="db-meter-fill" style="width: ${scan.riskScore}%; background-color: ${riskColor};"></div>
            </div>
          </div>

          <!-- Product & Price Comparison Box -->
          <div class="db-comparison-box">
            <div class="db-price-row">
              <div class="db-price-col">
                <span class="db-price-label">Store Price</span>
                <span class="db-price-store">${p.price ? `${p.currency}${p.price.toFixed(2)}` : 'Listed Price'}</span>
              </div>
              <div class="db-arrow">➔</div>
              <div class="db-price-col">
                <span class="db-price-label">Real Factory Cost</span>
                <span class="db-price-factory">
                  ${p.estSupplierMin ? `~${p.currency}${p.estSupplierMin} - ${p.currency}${p.estSupplierMax}` : '~70% Cheaper'}
                </span>
              </div>
            </div>
            <div class="db-savings-tag">
              💡 Save up to ~${p.potentialSavings || 75}% buying direct from supplier
            </div>
          </div>

          ${p.chineseSupplierTitle ? `
            <div class="db-chinese-supplier-box">
              <span class="db-cn-icon">🇨🇳</span>
              <div class="db-cn-info">
                <div class="db-cn-label">Wholesale Factory Name Found in Code:</div>
                <div class="db-cn-title">${escapeHtml(p.chineseSupplierTitle)}</div>
              </div>
            </div>
          ` : ''}

          <!-- Primary Direct Action Buttons -->
          <div class="db-action-buttons">
            ${p.lensUrl ? `
              <a href="${p.lensUrl}" target="_blank" class="db-btn db-btn-lens">
                <span>📷</span> Reverse Search on Google Lens
              </a>
            ` : ''}

            <a href="${p.aliExpressUrl}" target="_blank" class="db-btn db-btn-ali">
              <span>📦</span> Find on AliExpress (~Factory Price)
            </a>

            <div class="db-secondary-grid">
              <a href="${p.temuUrl}" target="_blank" class="db-btn db-btn-secondary">
                Search Temu
              </a>
              <a href="${p.amazonUrl}" target="_blank" class="db-btn db-btn-secondary">
                Compare Amazon
              </a>
            </div>
          </div>

          <!-- Detected Red Flags List -->
          <div class="db-signals-section">
            <div class="db-signals-header">
              <span>Detected Red Flags (${scan.signals.length})</span>
            </div>
            <ul class="db-signals-list">
              ${scan.signals.map(s => `
                <li class="db-signal-item">
                  <span class="db-signal-dot">${s.category === 'Community' ? '🚨' : '⚠️'}</span>
                  <div>
                    <strong>${escapeHtml(s.name)}</strong>
                    <div class="db-signal-detail">${escapeHtml(s.details)}</div>
                  </div>
                </li>
              `).join('')}
            </ul>
          </div>

          <!-- Report Form (Collapsible) -->
          <div id="db-report-box" class="db-report-box" style="display: none;">
            <div class="db-report-title">🚩 Report to Community Database</div>
            <input type="text" id="db-input-supplier" class="db-input" placeholder="Original Supplier URL (AliExpress / Temu)...">
            <textarea id="db-input-notes" class="db-textarea" placeholder="Why is this a dropshipper? (e.g. marked up 4x, slow delivery)..."></textarea>
            <div class="db-report-buttons">
              <button id="db-btn-submit-report" class="db-btn db-btn-danger">Submit Report</button>
              <button id="db-btn-cancel-report" class="db-btn db-btn-secondary">Cancel</button>
            </div>
            <div id="db-report-msg" class="db-report-msg" style="display: none;"></div>
          </div>
        </div>

        <div class="db-card-footer">
          <button id="db-btn-toggle-report" class="db-footer-report-btn">🚩 Report Listing to Community DB</button>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    // Wire up events
    const pill = root.querySelector('#db-pill');
    const card = root.querySelector('#db-card');
    const expandBtn = root.querySelector('#db-pill-expand-btn');
    const minimizeBtn = root.querySelector('#db-btn-minimize');
    const closeBtn = root.querySelector('#db-btn-close');
    const toggleReportBtn = root.querySelector('#db-btn-toggle-report');
    const reportBox = root.querySelector('#db-report-box');
    const cancelReportBtn = root.querySelector('#db-btn-cancel-report');
    const submitReportBtn = root.querySelector('#db-btn-submit-report');
    const inputSupplier = root.querySelector('#db-input-supplier');
    const inputNotes = root.querySelector('#db-input-notes');
    const reportMsg = root.querySelector('#db-report-msg');

    if (toggleReportBtn) {
      toggleReportBtn.addEventListener('click', () => {
        reportBox.style.display = reportBox.style.display === 'none' ? 'block' : 'none';
        if (reportBox.style.display === 'block') {
          reportBox.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }

    if (cancelReportBtn) {
      cancelReportBtn.addEventListener('click', () => {
        reportBox.style.display = 'none';
      });
    }

    if (submitReportBtn) {
      submitReportBtn.addEventListener('click', () => {
        const notes = inputNotes.value.trim();
        const supplierUrl = inputSupplier.value.trim();

        if (!notes && !supplierUrl) {
          alert('Please enter a note or supplier link for this report.');
          return;
        }

        submitReportBtn.disabled = true;
        submitReportBtn.textContent = 'Saving...';

        chrome.runtime.sendMessage({
          type: 'SUBMIT_DROPSHIP_REPORT',
          report: {
            url: window.location.href,
            domain: window.location.hostname,
            title: p.title || document.title,
            supplierUrl: supplierUrl,
            notes: notes,
            storePrice: p.price ? `${p.currency}${p.price}` : 'Unknown'
          }
        }, (res) => {
          if (res && res.success) {
            reportMsg.textContent = '✅ Saved! Listing added to community database.';
            reportMsg.style.display = 'block';
            setTimeout(() => {
              reportBox.style.display = 'none';
              submitReportBtn.disabled = false;
              submitReportBtn.textContent = 'Submit Report';
              toggleReportBtn.textContent = '✅ Reported to Community DB';
              toggleReportBtn.disabled = true;
            }, 1500);
          }
        });
      });
    }

    function expand() {
      pill.style.display = 'none';
      card.style.display = 'flex';
    }

    function minimize() {
      card.style.display = 'none';
      pill.style.display = 'flex';
    }

    function dismiss() {
      root.remove();
      sessionStorage.setItem('db_overlay_dismissed', 'true');
    }

    expandBtn.addEventListener('click', expand);
    pill.addEventListener('click', (e) => {
      if (e.target !== closeBtn) expand();
    });

    minimizeBtn.addEventListener('click', minimize);
    closeBtn.addEventListener('click', dismiss);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOverlay);
  } else {
    setTimeout(initOverlay, 600); // small delay to allow lazy-loaded scripts to run
  }
})();
