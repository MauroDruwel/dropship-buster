#!/usr/bin/env python3
"""
Dropship Buster - Central Telemetry & Ingestion Server
Receives HTML snapshots from thousands of extension users, stores them in the vault,
serves the synced GitHub blocklist, and runs backend LLM pattern mining.

Zero external dependencies required (Pure Python 3 standard library).
Run:
    python3 app.py
"""

import http.server
import socketserver
import json
import os
import re
import time
import urllib.request
import urllib.error
from datetime import datetime

PORT = int(os.environ.get("PORT", 8787))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VAULT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "vault")
DB_DIR = os.path.join(BASE_DIR, "db")
REPORTS_FILE = os.path.join(DB_DIR, "reports.json")
REGISTRY_FILE = os.path.join(DB_DIR, "verified_dropshippers.json")

os.makedirs(VAULT_DIR, exist_ok=True)
os.makedirs(DB_DIR, exist_ok=True)

class IngestionHandler(http.server.BaseHTTPRequestHandler):
    def _set_cors_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_cors_headers(204)

    def do_GET(self):
        # 1. Health check
        if self.path == "/" or self.path == "/api/health":
            self._set_cors_headers(200)
            vault_count = len([f for f in os.listdir(VAULT_DIR) if f.endswith('.json')])
            self.wfile.write(json.dumps({
                "status": "online",
                "service": "Dropship Buster Ingestion Server",
                "vault_snapshots_stored": vault_count,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }).encode('utf-8'))
            return

        # 2. Serve lightweight verified dropshippers list to extension
        if self.path.startswith("/api/dropshippers"):
            self._set_cors_headers(200)
            if os.path.exists(REGISTRY_FILE):
                with open(REGISTRY_FILE, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(json.dumps({"domains": [], "items": []}).encode('utf-8'))
            return

        # 3. Retrieve vault stats
        if self.path == "/api/admin/vault":
            self._set_cors_headers(200)
            snapshots = []
            for fname in os.listdir(VAULT_DIR):
                if fname.endswith('.json'):
                    fp = os.path.join(VAULT_DIR, fname)
                    with open(fp, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        snapshots.append({
                            "id": data.get("id"),
                            "url": data.get("url"),
                            "domain": data.get("domain"),
                            "timestamp": data.get("timestamp"),
                            "chinese_detected": data.get("chinese_metadata_detected", {}).get("chinese_characters", [])
                        })
            self.wfile.write(json.dumps({"total": len(snapshots), "snapshots": snapshots}).encode('utf-8'))
            return

        self._set_cors_headers(404)
        self.wfile.write(json.dumps({"error": "Not found"}).encode('utf-8'))

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body.decode('utf-8')) if body else {}
        except Exception:
            self._set_cors_headers(400)
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode('utf-8'))
            return

        # 1. Ingest Deep HTML Snapshot from Extension Client
        if self.path == "/api/snapshots":
            url = payload.get("url", "")
            domain = payload.get("domain", "")
            html_snippet = payload.get("html", "")
            
            # Extract Chinese text on server-side as well
            chinese_chars = re.findall(r'[\u4e00-\u9fa5]{2,}', html_snippet)
            image_hashes = re.findall(r'O1CN01[a-zA-Z0-9]{8,}', html_snippet)

            snap_id = f"snap_{int(time.time())}_{abs(hash(url)) % 10000}"
            snapshot_data = {
                "id": snap_id,
                "url": url,
                "domain": domain,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "pricing": payload.get("pricing", {}),
                "signals_detected_by_client": payload.get("signals", []),
                "chinese_metadata_detected": {
                    "chinese_characters": list(set(chinese_chars)),
                    "chinese_title": payload.get("chinese_title") or (chinese_chars[0] if chinese_chars else ""),
                    "image_hashes": list(set(image_hashes))
                },
                "html_snippet": html_snippet[:80000] # Cap size for safety
            }

            snap_file = os.path.join(VAULT_DIR, f"{snap_id}.json")
            with open(snap_file, 'w', encoding='utf-8') as f:
                json.dump(snapshot_data, f, indent=2)

            print(f"📥 [INGESTED SNAPSHOT] {domain} | Chinese tags: {len(chinese_chars)} | Hash: {snap_id}")

            self._set_cors_headers(201)
            self.wfile.write(json.dumps({
                "success": True,
                "snapshot_id": snap_id,
                "stored_in_vault": True
            }).encode('utf-8'))
            return

        # 2. Ingest Community Report
        if self.path == "/api/reports":
            report = payload.get("report", payload)
            report["id"] = f"rep_{int(time.time())}"
            report["timestamp"] = datetime.utcnow().isoformat() + "Z"

            reports_data = {"version": "1.0.0", "reports": []}
            if os.path.exists(REPORTS_FILE):
                try:
                    with open(REPORTS_FILE, 'r', encoding='utf-8') as f:
                        reports_data = json.load(f)
                except Exception:
                    pass

            reports_data.setdefault("reports", []).append(report)
            with open(REPORTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(reports_data, f, indent=2)

            print(f"🚩 [NEW REPORT LOGGED] {report.get('url')} | {report.get('notes')}")

            self._set_cors_headers(201)
            self.wfile.write(json.dumps({"success": True, "report_id": report["id"]}).encode('utf-8'))
            return

        # 3. Trigger Backend LLM Mining Job
        if self.path == "/api/admin/mine":
            from tools.llm_heuristic_miner import LlmHeuristicMiner
            miner = LlmHeuristicMiner(snapshots_dir=VAULT_DIR)
            analysis = miner.analyze_patterns()

            # Check if Gemini API key is configured to run live LLM synthesis
            gemini_key = os.environ.get("GEMINI_API_KEY")
            llm_result = None
            if gemini_key:
                prompt = miner.generate_llm_synthesis_prompt()
                llm_result = call_gemini_api(prompt, gemini_key)

            self._set_cors_headers(200)
            self.wfile.write(json.dumps({
                "success": True,
                "analysis": analysis,
                "llm_gemini_synthesis": llm_result
            }).encode('utf-8'))
            return

        self._set_cors_headers(404)
        self.wfile.write(json.dumps({"error": "Unknown endpoint"}).encode('utf-8'))

def call_gemini_api(prompt_text, api_key):
    """Calls Gemini API directly using Python standard library."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    body = {
        "contents": [{
            "parts": [{"text": prompt_text}]
        }]
    }
    req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'), headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            text = res_data['candidates'][0]['content']['parts'][0]['text']
            return text
    except Exception as e:
        return f"Gemini API request failed: {e}"

def run():
    with socketserver.TCPServer(("", PORT), IngestionHandler) as httpd:
        print("\n" + "=" * 70)
        print(f"🚀 DROPSHIP BUSTER — TELEMETRY & INGESTION BACKEND SERVER")
        print("=" * 70)
        print(f"📡 Server listening at: http://localhost:{PORT}")
        print(f"📁 HTML Snapshot Vault: {VAULT_DIR}")
        print(f"📥 POST /api/snapshots  -> Ingest deep HTML from extension users")
        print(f"🚩 POST /api/reports    -> Ingest crowdsourced community reports")
        print(f"🌐 GET  /api/dropshippers -> Serves synced GitHub/CDN blocklist")
        print(f"🤖 POST /api/admin/mine -> Runs server-side LLM pattern miner")
        print("=" * 70 + "\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    run()
