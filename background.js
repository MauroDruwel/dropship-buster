/**
 * Dropship Buster - Background Service Worker
 * Manages context menus, badge alerts, and tab communication
 */

const tabScanCache = new Map();

// Setup Context Menus on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "search-google-lens",
    title: "🔍 Reverse Image Search on Google Lens",
    contexts: ["image"]
  });

  chrome.contextMenus.create({
    id: "search-aliexpress-img",
    title: "📦 Find Supplier on AliExpress",
    contexts: ["image"]
  });

  chrome.contextMenus.create({
    id: "search-aliexpress-text",
    title: "🔍 Find '%s' on AliExpress",
    contexts: ["selection"]
  });
});

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "search-google-lens" && info.srcUrl) {
    const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(info.srcUrl)}`;
    chrome.tabs.create({ url: lensUrl });
  } else if (info.menuItemId === "search-aliexpress-img" && info.srcUrl) {
    // Lens is the fastest way to get exact AliExpress/supplier matches for an image
    const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(info.srcUrl)}`;
    chrome.tabs.create({ url: lensUrl });
  } else if (info.menuItemId === "search-aliexpress-text" && info.selectionText) {
    const cleanQuery = cleanSearchQuery(info.selectionText);
    const aliUrl = `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(cleanQuery)}`;
    chrome.tabs.create({ url: aliUrl });
  }
});

// Handle messages from content script & popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : message.tabId;

  if (message.type === "DROPSHIP_SCAN_RESULT") {
    const data = message.data;
    if (tabId) {
      tabScanCache.set(tabId, data);
      updateTabBadge(tabId, data);
    }
    sendResponse({ received: true });
    return true;
  }

  if (message.type === "GET_SCAN_DATA") {
    const data = tabScanCache.get(message.tabId) || null;
    sendResponse({ data });
    return true;
  }

  if (message.type === "OPEN_SEARCH_TAB") {
    if (message.url) {
      chrome.tabs.create({ url: message.url });
    }
    sendResponse({ ok: true });
    return true;
  }

  // Handle Community Report Submission
  if (message.type === "SUBMIT_DROPSHIP_REPORT") {
    const newReport = message.report;
    newReport.timestamp = new Date().toISOString();
    newReport.id = "rep_" + Date.now();

    // Asynchronously forward to central ingestion server if online (non-blocking)
    fetch("http://localhost:8787/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: newReport })
    }).catch(() => {});

    chrome.storage.local.get(["user_reports"], (res) => {
      const reports = res.user_reports || [];
      reports.push(newReport);
      chrome.storage.local.set({ user_reports: reports }, () => {
        // Broadcast to sender and re-scan tab if available
        if (tabId && tabScanCache.has(tabId)) {
          const scan = tabScanCache.get(tabId);
          scan.riskScore = 95;
          scan.signals.unshift({
            category: "Community",
            name: "Community Confirmed Dropshipper",
            weight: 75,
            details: newReport.notes || "Reported as dropshipped item by you."
          });
          updateTabBadge(tabId, scan);
        }
        sendResponse({ success: true, report: newReport, total: reports.length });
      });
    });
    return true;
  }

  // Upload HTML Snapshot to Central Vault
  if (message.type === "UPLOAD_HTML_SNAPSHOT") {
    fetch("http://localhost:8787/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message.payload)
    }).then(r => r.json()).then(data => {
      sendResponse({ success: true, data });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  // Retrieve All Community Reports
  if (message.type === "GET_COMMUNITY_REPORTS") {
    chrome.storage.local.get(["user_reports"], (res) => {
      const userReports = res.user_reports || [];
      sendResponse({ reports: userReports });
    });
    return true;
  }
});

// Clean up cache when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScanCache.delete(tabId);
});

// Update extension icon badge based on risk score
function updateTabBadge(tabId, data) {
  if (!data || !data.isProductPage) {
    chrome.action.setBadgeText({ tabId, text: "" });
    return;
  }

  const score = data.riskScore || 0;
  if (score >= 60) {
    chrome.action.setBadgeText({ tabId, text: `${score}%` });
    chrome.action.setBadgeBackgroundColor({ tabId, color: score >= 80 ? "#EF4444" : "#F59E0B" });
  } else if (score >= 35) {
    chrome.action.setBadgeText({ tabId, text: "MED" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#F59E0B" });
  } else {
    chrome.action.setBadgeText({ tabId, text: "OK" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#10B981" });
  }
}

// Helper to strip fluff words from product titles
function cleanSearchQuery(text) {
  if (!text) return "";
  return text
    .replace(/[^\w\s-]/gi, "")
    .replace(/\b(hot|new|2024|2025|2026|portable|sale|deal|off|free|shipping|upgrade|trending|viral)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}
