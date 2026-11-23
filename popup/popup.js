"use strict";
(() => {
  // src/popup/popup.ts
  document.addEventListener("DOMContentLoaded", async () => {
    const stateLoading = document.getElementById("state-loading");
    const stateResult = document.getElementById("state-result");
    const stateEmpty = document.getElementById("state-empty");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showEmptyState();
      return;
    }
    chrome.runtime.sendMessage({ type: "GET_SCAN_DATA", tabId: tab.id }, async (response) => {
      let data = response ? response.data || null : null;
      if (!data && tab.id) {
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
        } catch {
        }
      }
      if (data && (data.isProductPage || data.signals && data.signals.length > 0)) {
        renderResult(data);
      } else {
        showEmptyState();
      }
    });
    const manualInput = document.getElementById("manual-query-input");
    const btnManual = document.getElementById("btn-manual-search");
    if (btnManual && manualInput) {
      btnManual.addEventListener("click", () => {
        const val = manualInput.value.trim();
        if (!val) return;
        if (val.startsWith("http://") || val.startsWith("https://")) {
          const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(val)}`;
          chrome.tabs.create({ url: lensUrl });
        } else {
          const aliUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(val)}`;
          chrome.tabs.create({ url: aliUrl });
        }
      });
      manualInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") btnManual.click();
      });
    }
    const linkTest = document.getElementById("link-open-test");
    if (linkTest) {
      linkTest.addEventListener("click", (e) => {
        e.preventDefault();
        const testUrl = chrome.runtime.getURL("test-store/index.html");
        chrome.tabs.create({ url: testUrl });
      });
    }
    function showEmptyState() {
      if (stateLoading) stateLoading.style.display = "none";
      if (stateResult) stateResult.style.display = "none";
      if (stateEmpty) stateEmpty.style.display = "flex";
    }
    function renderResult(data) {
      if (stateLoading) stateLoading.style.display = "none";
      if (stateEmpty) stateEmpty.style.display = "none";
      if (stateResult) stateResult.style.display = "block";
      const score = data.riskScore || 0;
      const scoreNumEl = document.getElementById("risk-score-num");
      const gaugeFillEl = document.getElementById("gauge-fill");
      const badgeEl = document.getElementById("risk-badge");
      const summaryEl = document.getElementById("risk-summary");
      if (scoreNumEl) scoreNumEl.textContent = String(score);
      const offset = 126 - 126 * (score / 100);
      if (gaugeFillEl) gaugeFillEl.style.strokeDashoffset = String(offset);
      if (score >= 70) {
        if (gaugeFillEl) gaugeFillEl.setAttribute("stroke", "#EF4444");
        if (badgeEl) {
          badgeEl.className = "risk-badge badge-high";
          badgeEl.textContent = "HIGH DROPSHIP RISK";
        }
        if (summaryEl) summaryEl.textContent = "Strong dropshipping fingerprints detected (heavy markup likely).";
      } else if (score >= 40) {
        if (gaugeFillEl) gaugeFillEl.setAttribute("stroke", "#F59E0B");
        if (badgeEl) {
          badgeEl.className = "risk-badge badge-med";
          badgeEl.textContent = "MODERATE SUSPICION";
        }
        if (summaryEl) summaryEl.textContent = "Some dropship or high-pressure conversion apps detected.";
      } else {
        if (gaugeFillEl) gaugeFillEl.setAttribute("stroke", "#10B981");
        if (badgeEl) {
          badgeEl.className = "risk-badge badge-low";
          badgeEl.textContent = "LOW RISK STORE";
        }
        if (summaryEl) summaryEl.textContent = "Few or no dropshipping footprints identified.";
      }
      const p = data.product || {};
      const thumbEl = document.getElementById("product-thumb");
      const titleEl = document.getElementById("product-title");
      const priceStoreEl = document.getElementById("price-store");
      const priceFactoryEl = document.getElementById("price-factory");
      const savingsEl = document.getElementById("savings-banner");
      if (thumbEl) {
        if (p.image) {
          thumbEl.src = p.image;
          thumbEl.style.display = "block";
        } else {
          thumbEl.style.display = "none";
        }
      }
      if (titleEl) titleEl.textContent = p.title || "Product Analysis";
      if (priceStoreEl && priceFactoryEl && savingsEl) {
        if (p.price) {
          priceStoreEl.textContent = `${p.currency || "\u20AC"}${p.price.toFixed(2)}`;
          priceFactoryEl.textContent = `~${p.currency || "\u20AC"}${p.estSupplierMin || (p.price * 0.2).toFixed(2)}`;
          savingsEl.textContent = `\u{1F4B0} Potential ~${p.potentialSavings || 75}% savings directly from supplier`;
        } else {
          priceStoreEl.textContent = "N/A";
          priceFactoryEl.textContent = "Check Links";
          savingsEl.textContent = "\u{1F4A1} Use links below to compare real manufacturer pricing";
        }
      }
      const btnLens = document.getElementById("btn-lens");
      const btnAli = document.getElementById("btn-aliexpress");
      const btnTemu = document.getElementById("btn-temu");
      const btnAmazon = document.getElementById("btn-amazon");
      if (btnLens) {
        if (p.lensUrl) {
          btnLens.href = p.lensUrl;
          btnLens.style.display = "flex";
        } else {
          btnLens.style.display = "none";
        }
      }
      if (btnAli) btnAli.href = p.aliExpressUrl || "#";
      if (btnTemu) btnTemu.href = p.temuUrl || "#";
      if (btnAmazon) btnAmazon.href = p.amazonUrl || "#";
      const signalsList = document.getElementById("signals-list");
      const signalsCount = document.getElementById("signals-count");
      if (signalsList) signalsList.innerHTML = "";
      const signals = data.signals || [];
      if (signalsCount) signalsCount.textContent = String(signals.length);
      if (signalsList) {
        if (signals.length === 0) {
          signalsList.innerHTML = '<li class="no-signals">No dropship apps or scarcity scripts found.</li>';
        } else {
          signals.forEach((s) => {
            const li = document.createElement("li");
            li.className = "signal-item";
            li.innerHTML = `
            <div class="signal-icon">\u26A0\uFE0F</div>
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
      const btnToggleReport = document.getElementById("btn-toggle-report-popup");
      const reportForm = document.getElementById("popup-report-form");
      const btnSubmitReport = document.getElementById("btn-submit-report-popup");
      const inputSupplier = document.getElementById("report-supplier-url");
      const inputNotes = document.getElementById("report-notes");
      const successMsg = document.getElementById("popup-report-success");
      if (btnToggleReport && reportForm) {
        btnToggleReport.addEventListener("click", () => {
          reportForm.style.display = reportForm.style.display === "none" ? "block" : "none";
        });
      }
      if (btnSubmitReport && inputNotes && inputSupplier && tab.url && successMsg && btnToggleReport && reportForm) {
        btnSubmitReport.addEventListener("click", () => {
          const notes = inputNotes.value.trim();
          const supplierUrl = inputSupplier.value.trim();
          btnSubmitReport.disabled = true;
          btnSubmitReport.textContent = "Saving report...";
          chrome.runtime.sendMessage({
            type: "SUBMIT_DROPSHIP_REPORT",
            report: {
              url: tab.url,
              domain: new URL(tab.url).hostname,
              title: p.title || tab.title || "",
              supplierUrl,
              notes: notes || "Reported via Dropship Buster popup.",
              storePrice: p.price ? `${p.currency || "\u20AC"}${p.price.toFixed(2)}` : "N/A"
            }
          }, (res) => {
            if (res && res.success) {
              successMsg.style.display = "block";
              setTimeout(() => {
                reportForm.style.display = "none";
                btnToggleReport.textContent = "\u2705 Reported to Database";
                btnToggleReport.disabled = true;
              }, 1200);
            }
          });
        });
      }
    }
    function escapeHtml(str) {
      if (!str) return "";
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
  });
})();
