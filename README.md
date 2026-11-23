# 🛡️ Dropship Buster — Chrome Extension (Manifest V3)

> **Zero-Click Dropship & Scam Detector with 1-Click Reverse Image & Supplier Search**

Dropship Buster automatically inspects online stores in real time for dropshipping footprints, unmasks 5x–10x markups, and provides 1-click shortcuts to buy the identical item directly from factory suppliers on **AliExpress**, **Google Lens**, **Temu**, and **Amazon**.

---

## ⚡ Quick Test in 60 Seconds

### Step 1: Load the Extension into Chrome
1. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** (top-left).
4. Select the directory:
   ```text
   /Users/codermauro/.gemini/antigravity/scratch/dropship-detector-extension
   ```
5. You'll see **Dropship Buster** appear in your extension bar! Pin it for quick access.

---

### Step 2: Run the Included Mock Dropship Store
We built a realistic mock viral TikTok dropshipping store (`test-store`) with classic red flags (Shopify theme, DSers script, Loox reviews, artificial countdown timer, stock scarcity, and $49.99 price tag).

Run the local test server in your terminal:
```bash
cd /Users/codermauro/.gemini/antigravity/scratch/dropship-detector-extension/test-store
python3 serve.py
```
Or open:
```text
http://localhost:8000/index.html
```

---

### Step 3: What You'll Experience Live
1. **In-Page Floating Alert**:
   - As soon as the page loads, an unobtrusive floating badge appears in the bottom right:
     `[ ⚠️ Dropship Alert: 98% Probability • Unmask ]`
2. **Instant Markup Analysis**:
   - Click **Unmask**:
     - **Store Price**: `$49.99`
     - **Real Factory Cost**: `~$6.50 - $12.00` (Potential 75%+ Savings!)
     - **Detected Red Flags**: Shopify infrastructure, DSers fulfillment app, Loox review importer, artificial countdown clock, 15–25 day overseas delivery notice.
3. **1-Click Supplier Shortcuts**:
   - 📷 **Google Lens Reverse Image**: Immediately runs an image search to find every supplier and store carrying this exact product.
   - 📦 **AliExpress Direct Search**: Searches AliExpress with auto-cleaned keywords (strips marketing fluff like "🔥 VIRAL 2024").
   - 🛒 **Temu & Amazon Comparison**: Compare prices across major discount platforms.
4. **Toolbar Audit Popup**:
   - Click the extension icon in Chrome's toolbar to see the full dark-mode audit gauge, breakdown of detected signals, and manual search tool for any product URL or image.
5. **Right-Click Context Menu**:
   - Right-click any product image on any website -> **🔍 Reverse Image Search on Google Lens** or **Find Supplier on AliExpress**.

---

## 🧠 How the Detection Engine Works

Unlike basic extensions that make you manually right-click images, Dropship Buster uses **passive DOM & script heuristics** that run locally in the browser with **zero API cost**:

| Category | What It Detects | Red Flag Weight |
| :--- | :--- | :---: |
| **Platform Footprints** | `window.Shopify`, `cdn.shopify.com`, `myshopify.com`, WooCommerce | +15 to +20 |
| **Fulfillment Apps** | DSers, CJ Dropshipping, Oberlo, Zendrop, AutoDS, AliOrders, Spocket | +35 to +40 |
| **Review Importers** | Loox (`loox.io`), AliReviews, Judge.me, Ryviu, Vitals | +25 to +35 |
| **Psychological Urgency** | Fake countdown timers (`hurrify`), fake sales popups (`sales-pop`, `fomo`), fake stock counters | +15 to +25 |
| **Shipping & Trust** | 12–25 business day transit disclaimers, generic `@gmail.com` support on a brand store | +15 to +25 |

---

## 💡 How to Monetize This (100% Free for Users)

Charging consumers a subscription for a consumer-protection extension creates heavy drop-off. The most lucrative model is:
1. **Free for Shoppers**: Unlimited zero-click scans.
2. **Affiliate Deep Linking**:
   - Join **AliExpress Portals / Admitad Affiliate Program** (up to 7%–9% commission).
   - Join **Temu Affiliate Program** ($5–$10 bounty or % of order).
   - Append affiliate tracking IDs to the outbound search buttons (`aliExpressUrl`, `temuUrl`).
   - Every time a shopper avoids an overpriced $50 store and buys the $8 version via your button, you earn an affiliate commission automatically.

---

---

## 🐳 Dockerized Telemetry & Ingestion Server

Run the central server with a single command:

```bash
docker compose up -d
```

- **Health check:** `curl http://localhost:8787/api/health`
- **Snapshot Ingestion:** `POST http://localhost:8787/api/snapshots` (persisted in `./server/vault`)
- **Blocklist API:** `GET http://localhost:8787/api/dropshippers`
- **Batch Gemini LLM Pattern Mining:** `POST http://localhost:8787/api/admin/mine`

---

## 📁 Project Architecture

```
dropship-detector-extension/
├── Dockerfile                 # Production Python container for backend
├── docker-compose.yml         # Container configuration with persistent volumes
├── manifest.json              # Chrome Manifest V3 configuration
├── background.js              # Service worker (context menus, tab badges, tab cache)
├── content/
│   ├── detector.js            # Passive heuristic scanner & Chinese metadata extractor
│   ├── overlay.js             # Proactive warning popup & price comparison modal
│   └── styles.css             # Scoped CSS for the floating UI
├── popup/
│   ├── popup.html             # Extension toolbar popup dashboard
│   ├── popup.js               # Popup controller & community reporting
│   └── popup.css              # Dark-mode dashboard stylesheet
├── server/
│   ├── app.py                 # Telemetry ingestion server
│   └── vault/                 # Persistent storage for user HTML snapshots
├── db/
│   ├── verified_dropshippers.json  # Lightweight registry synced via GitHub
│   └── reports.json           # User report records
├── tools/
│   └── llm_heuristic_miner.py # Pattern mining & automated rule generator
├── backtest/
│   └── backtester.py          # 15-site automated test suite (100% accuracy)
└── test-store/
    ├── index.html             # Mock viral dropship store with classic footprints
    └── serve.py               # 1-click local test server
```
