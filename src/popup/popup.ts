/**
 * Dropship Buster - Popup Controller (TypeScript)
 */

import { ScanResult, ProductInfo, DropshipSignal } from '../types';

document.addEventListener('DOMContentLoaded', async () => {
  const stateLoading = document.getElementById('state-loading') as HTMLElement | null;
  const stateResult = document.getElementById('state-result') as HTMLElement | null;
  const stateEmpty = document.getElementById('state-empty') as HTMLElement | null;

  // Query active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    showEmptyState();
    return;
  }

  // Fetch scan data from background cache
  chrome.runtime.sendMessage({ type: 'GET_SCAN_DATA', tabId: tab.id }, async (response: { data?: ScanResult }) => {
    let data: ScanResult | null = response ? response.data || null : null;

    // If cache is empty, try requesting active scan from tab
    if (!data && tab.id) {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return (window as any).DropshipDetectorInstance ? (window as any).DropshipDetectorInstance.scan() : null;
          }
        });
        if (results && results[0] && results[0].result) {
          data = results[0].result as ScanResult;
        }
      } catch {
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
  const manualInput = document.getElementById('manual-query-input') as HTMLInputElement | null;
  const btnManual = document.getElementById('btn-manual-search') as HTMLButtonElement | null;
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

    manualInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') btnManual.click();
    });
  }

  // Wire up Mock Test Store link
  const linkTest = document.getElementById('link-open-test') as HTMLAnchorElement | null;
  if (linkTest) {
    linkTest.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault();
      const testUrl = chrome.runtime.getURL('test-store/index.html');
      chrome.tabs.create({ url: testUrl });
    });
  }

  function showEmptyState(): void {
    if (stateLoading) stateLoading.style.display = 'none';
    if (stateResult) stateResult.style.display = 'none';
    if (stateEmpty) stateEmpty.style.display = 'flex';
  }

  function renderResult(data: ScanResult): void {
    if (stateLoading) stateLoading.style.display = 'none';
    if (stateEmpty) stateEmpty.style.display = 'none';
    if (stateResult) stateResult.style.display = 'block';

    const score = data.riskScore || 0;
    const scoreNumEl = document.getElementById('risk-score-num');
    const gaugeFillEl = document.getElementById('gauge-fill');
    const badgeEl = document.getElementById('risk-badge');
    const summaryEl = document.getElementById('risk-summary');

    // Update gauge arc: total stroke-dasharray is 126
    if (scoreNumEl) scoreNumEl.textContent = String(score);
    const offset = 126 - (126 * (score / 100));
    if (gaugeFillEl) (gaugeFillEl as HTMLElement).style.strokeDashoffset = String(offset);

    // Color code gauge and badge
    if (score >= 70) {
      if (gaugeFillEl) gaugeFillEl.setAttribute('stroke', '#EF4444');
      if (badgeEl) {
        badgeEl.className = 'risk-badge badge-high';
        badgeEl.textContent = 'HIGH DROPSHIP RISK';
      }
      if (summaryEl) summaryEl.textContent = 'Strong dropshipping fingerprints detected (heavy markup likely).';
    } else if (score >= 40) {
      if (gaugeFillEl) gaugeFillEl.setAttribute('stroke', '#F59E0B');
      if (badgeEl) {
        badgeEl.className = 'risk-badge badge-med';
        badgeEl.textContent = 'MODERATE SUSPICION';
      }
      if (summaryEl) summaryEl.textContent = 'Some dropship or high-pressure conversion apps detected.';
    } else {
      if (gaugeFillEl) gaugeFillEl.setAttribute('stroke', '#10B981');
      if (badgeEl) {
        badgeEl.className = 'risk-badge badge-low';
        badgeEl.textContent = 'LOW RISK STORE';
      }
      if (summaryEl) summaryEl.textContent = 'Few or no dropshipping footprints identified.';
    }

    // Product info
    const p: Partial<ProductInfo> = data.product || {};
    const thumbEl = document.getElementById('product-thumb') as HTMLImageElement | null;
    const titleEl = document.getElementById('product-title');
    const priceStoreEl = document.getElementById('price-store');
    const priceFactoryEl = document.getElementById('price-factory');
    const savingsEl = document.getElementById('savings-banner');

    if (thumbEl) {
      if (p.image) {
        thumbEl.src = p.image;
        thumbEl.style.display = 'block';
      } else {
        thumbEl.style.display = 'none';
      }
    }

    if (titleEl) titleEl.textContent = p.title || 'Product Analysis';

    if (priceStoreEl && priceFactoryEl && savingsEl) {
      if (p.price) {
        priceStoreEl.textContent = `${p.currency || '€'}${p.price.toFixed(2)}`;
        priceFactoryEl.textContent = `~${p.currency || '€'}${p.estSupplierMin || (p.price * 0.2).toFixed(2)}`;
        savingsEl.textContent = `💰 Potential ~${p.potentialSavings || 75}% savings directly from supplier`;
      } else {
        priceStoreEl.textContent = 'N/A';
        priceFactoryEl.textContent = 'Check Links';
        savingsEl.textContent = '💡 Use links below to compare real manufacturer pricing';
      }
    }

    // Action buttons
    const btnLens = document.getElementById('btn-lens') as HTMLAnchorElement | null;
    const btnAli = document.getElementById('btn-aliexpress') as HTMLAnchorElement | null;
    const btnTemu = document.getElementById('btn-temu') as HTMLAnchorElement | null;
    const btnAmazon = document.getElementById('btn-amazon') as HTMLAnchorElement | null;

    if (btnLens) {
      if (p.lensUrl) {
        btnLens.href = p.lensUrl;
        btnLens.style.display = 'flex';
      } else {
        btnLens.style.display = 'none';
      }
    }

    if (btnAli) btnAli.href = p.aliExpressUrl || '#';
    if (btnTemu) btnTemu.href = p.temuUrl || '#';
    if (btnAmazon) btnAmazon.href = p.amazonUrl || '#';

    // Signals list
    const signalsList = document.getElementById('signals-list');
    const signalsCount = document.getElementById('signals-count');
    if (signalsList) signalsList.innerHTML = '';

    const signals = data.signals || [];
    if (signalsCount) signalsCount.textContent = String(signals.length);

    if (signalsList) {
      if (signals.length === 0) {
        signalsList.innerHTML = '<li class="no-signals">No dropship apps or scarcity scripts found.</li>';
      } else {
        signals.forEach((s: DropshipSignal) => {
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
    }

    // Community Report Handler in Popup
    const btnToggleReport = document.getElementById('btn-toggle-report-popup') as HTMLButtonElement | null;
    const reportForm = document.getElementById('popup-report-form') as HTMLElement | null;
    const btnSubmitReport = document.getElementById('btn-submit-report-popup') as HTMLButtonElement | null;
    const inputSupplier = document.getElementById('report-supplier-url') as HTMLInputElement | null;
    const inputNotes = document.getElementById('report-notes') as HTMLTextAreaElement | null;
    const successMsg = document.getElementById('popup-report-success') as HTMLElement | null;

    if (btnToggleReport && reportForm) {
      btnToggleReport.addEventListener('click', () => {
        reportForm.style.display = reportForm.style.display === 'none' ? 'block' : 'none';
      });
    }

    if (btnSubmitReport && inputNotes && inputSupplier && tab.url && successMsg && btnToggleReport && reportForm) {
      btnSubmitReport.addEventListener('click', () => {
        const notes = inputNotes.value.trim();
        const supplierUrl = inputSupplier.value.trim();

        btnSubmitReport.disabled = true;
        btnSubmitReport.textContent = 'Saving report...';

        chrome.runtime.sendMessage({
          type: 'SUBMIT_DROPSHIP_REPORT',
          report: {
            url: tab.url,
            domain: new URL(tab.url!).hostname,
            title: p.title || tab.title || '',
            supplierUrl: supplierUrl,
            notes: notes || 'Reported via Dropship Buster popup.',
            storePrice: p.price ? `${p.currency || '€'}${p.price.toFixed(2)}` : 'N/A'
          }
        }, (res?: { success?: boolean }) => {
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

  function escapeHtml(str?: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
