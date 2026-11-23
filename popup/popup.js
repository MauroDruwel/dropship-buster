/**
 * Dropship Buster - Popup Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const stateLoading = document.getElementById('state-loading');
  const stateResult = document.getElementById('state-result');
  const stateEmpty = document.getElementById('state-empty');

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showEmptyState();
    return;
  }

  // Fetch scan data from background cache
  chrome.runtime.sendMessage({ type: 'GET_SCAN_DATA', tabId: tab.id }, async (response) => {
    let data = response ? response.data : null;

    // If cache is empty, try requesting active scan from tab
    if (!data) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return window.DropshipDetectorInstance ? window.DropshipDetectorInstance.scan() : null;
          }
        });
        if (results && results[0] && results[0].result) {
          data = results[0].result;
        }
      } catch (err) {
        // Restricted tabs (like chrome:// or webstore)
      }
    }

    if (data && (data.isProductPage || (data.signals && data.signals.length > 0))) {
      renderResult(data);
    } else {
      showEmptyState();
    }
  });

  // Wire up manual search
  const manualInput = document.getElementById('manual-query-input');
  const btnManual = document.getElementById('btn-manual-search');
  if (btnManual && manualInput) {
    btnManual.addEventListener('click', () => {
      const val = manualInput.value.trim();
      if (!val) return;

      if (val.startsWith('http://') || val.startsWith('https://')) {
        const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(val)}`;
        chrome.tabs.create({ url: lensUrl });
      } else {
        const aliUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(val)}`;
        chrome.tabs.create({ url: aliUrl });
      }
    });

    manualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') btnManual.click();
    });
  }

  // Wire up Mock Test Store link
  const linkTest = document.getElementById('link-open-test');
  if (linkTest) {
    linkTest.addEventListener('click', (e) => {
      e.preventDefault();
      const testUrl = chrome.runtime.getURL('test-store/index.html');
      chrome.tabs.create({ url: testUrl });
    });
  }

  function showEmptyState() {
    stateLoading.style.display = 'none';
    stateResult.style.display = 'none';
    stateEmpty.style.display = 'flex';
  }

  function renderResult(data) {
    stateLoading.style.display = 'none';
    stateEmpty.style.display = 'none';
    stateResult.style.display = 'block';

    const score = data.riskScore || 0;
    const scoreNumEl = document.getElementById('risk-score-num');
    const gaugeFillEl = document.getElementById('gauge-fill');
    const badgeEl = document.getElementById('risk-badge');
    const summaryEl = document.getElementById('risk-summary');

    // Update gauge arc: total stroke-dasharray is 126
    scoreNumEl.textContent = score;
    const offset = 126 - (126 * (score / 100));
    gaugeFillEl.style.strokeDashoffset = offset;

    // Color code gauge and badge
    if (score >= 70) {
      gaugeFillEl.setAttribute('stroke', '#EF4444');
      badgeEl.className = 'risk-badge badge-high';
      badgeEl.textContent = 'HIGH DROPSHIP RISK';
      summaryEl.textContent = 'Strong dropshipping fingerprints detected (heavy markup likely).';
    } else if (score >= 40) {
      gaugeFillEl.setAttribute('stroke', '#F59E0B');
      badgeEl.className = 'risk-badge badge-med';
      badgeEl.textContent = 'MODERATE SUSPICION';
      summaryEl.textContent = 'Some dropship or high-pressure conversion apps detected.';
    } else {
      gaugeFillEl.setAttribute('stroke', '#10B981');
      badgeEl.className = 'risk-badge badge-low';
      badgeEl.textContent = 'LOW RISK STORE';
      summaryEl.textContent = 'Few or no dropshipping footprints identified.';
    }

    // Product info
    const p = data.product || {};
    const thumbEl = document.getElementById('product-thumb');
    const titleEl = document.getElementById('product-title');
    const priceStoreEl = document.getElementById('price-store');
    const priceFactoryEl = document.getElementById('price-factory');
    const savingsEl = document.getElementById('savings-banner');

    if (p.image) {
      thumbEl.src = p.image;
      thumbEl.style.display = 'block';
    } else {
      thumbEl.style.display = 'none';
    }

    titleEl.textContent = p.title || 'Product Analysis';

    if (p.price) {
      priceStoreEl.textContent = `${p.currency}${p.price.toFixed(2)}`;
      priceFactoryEl.textContent = `~${p.currency}${p.estSupplierMin || (p.price * 0.2).toFixed(2)}`;
      savingsEl.textContent = `💰 Potential ~${p.potentialSavings || 75}% savings directly from supplier`;
    } else {
      priceStoreEl.textContent = 'N/A';
      priceFactoryEl.textContent = 'Check Links';
      savingsEl.textContent = '💡 Use links below to compare real manufacturer pricing';
    }

    // Action buttons
    const btnLens = document.getElementById('btn-lens');
    const btnAli = document.getElementById('btn-aliexpress');
    const btnTemu = document.getElementById('btn-temu');
    const btnAmazon = document.getElementById('btn-amazon');

    if (p.lensUrl) {
      btnLens.href = p.lensUrl;
      btnLens.style.display = 'flex';
    } else {
      btnLens.style.display = 'none';
    }

    btnAli.href = p.aliExpressUrl || '#';
    btnTemu.href = p.temuUrl || '#';
    btnAmazon.href = p.amazonUrl || '#';

    // Signals list
    const signalsList = document.getElementById('signals-list');
    const signalsCount = document.getElementById('signals-count');
    signalsList.innerHTML = '';

    const signals = data.signals || [];
    signalsCount.textContent = signals.length;

    if (signals.length === 0) {
      signalsList.innerHTML = '<li class="no-signals">No dropship apps or scarcity scripts found.</li>';
    } else {
      signals.forEach(s => {
        const li = document.createElement('li');
        li.className = 'signal-item';
        li.innerHTML = `
          <div class="signal-icon">⚠️</div>
          <div class="signal-info">
            <span class="signal-name">${escapeHtml(s.name)}</span>
            <span class="signal-desc">${escapeHtml(s.details)}</span>
          </div>
          <span class="signal-weight">+${s.weight}</span>
        `;
        signalsList.appendChild(li);
      });
    }

    // Community Report Handler in Popup
    const btnToggleReport = document.getElementById('btn-toggle-report-popup');
    const reportForm = document.getElementById('popup-report-form');
    const btnSubmitReport = document.getElementById('btn-submit-report-popup');
    const inputSupplier = document.getElementById('report-supplier-url');
    const inputNotes = document.getElementById('report-notes');
    const successMsg = document.getElementById('popup-report-success');

    if (btnToggleReport && reportForm) {
      btnToggleReport.addEventListener('click', () => {
        reportForm.style.display = reportForm.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (btnSubmitReport) {
      btnSubmitReport.addEventListener('click', () => {
        const notes = inputNotes.value.trim();
        const supplierUrl = inputSupplier.value.trim();

        btnSubmitReport.disabled = true;
        btnSubmitReport.textContent = 'Saving report...';

        chrome.runtime.sendMessage({
          type: 'SUBMIT_DROPSHIP_REPORT',
          report: {
            url: tab.url,
            domain: new URL(tab.url).hostname,
            title: p.title || tab.title,
            supplierUrl: supplierUrl,
            notes: notes || 'Reported via Dropship Buster popup.',
            storePrice: p.price ? `${p.currency}${p.price.toFixed(2)}` : 'N/A'
          }
        }, (res) => {
          if (res && res.success) {
            successMsg.style.display = 'block';
            setTimeout(() => {
              reportForm.style.display = 'none';
              btnToggleReport.textContent = '✅ Reported to Database';
              btnToggleReport.disabled = true;
            }, 1200);
          }
        });
      });
    }
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
});
