#!/usr/bin/env python3
"""MEOW SYSTEM local server.

Serves the single-file app and stores the cat archive in data.json.
Run: python3 server.py [port]
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DATA_FILE = Path(os.environ.get("MEOW_DATA", ROOT / "data.json"))
BACKUP_FILE = DATA_FILE.with_suffix(DATA_FILE.suffix + ".bak")
MAX_BODY = 20 * 1024 * 1024


class MeowHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self._json({"ok": True, "server": "meow-system"})
            return
        if parsed.path == "/api/data":
            self._read_data()
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/api/data":
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            self._json({"ok": False, "error": "数据过大或为空"}, HTTPStatus.BAD_REQUEST)
            return

        try:
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json({"ok": False, "error": "JSON 格式不正确"}, HTTPStatus.BAD_REQUEST)
            return

        data = payload.get("data") if isinstance(payload, dict) and "data" in payload else payload
        if not isinstance(data, dict) or not isinstance(data.get("cats"), list):
            self._json({"ok": False, "error": "数据缺少 cats 数组"}, HTTPStatus.BAD_REQUEST)
            return

        data = dict(data)
        data["updatedAt"] = int(data.get("updatedAt") or datetime.now().timestamp() * 1000)
        data.setdefault("version", 1)

        try:
            self._write_data(data)
        except OSError as exc:
            self._json({"ok": False, "error": f"无法写入 data.json: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return

        self._json({"ok": True, "savedAt": data["updatedAt"], "file": str(DATA_FILE)})

    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Allow", "GET, POST, OPTIONS")
        self.end_headers()

    def _read_data(self):
        if not DATA_FILE.exists():
            self._json({"ok": True, "data": None})
            return
        try:
            raw = DATA_FILE.read_text("utf-8")
            data = json.loads(raw)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            self._json({"ok": False, "error": f"data.json 无法读取: {exc}"}, HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        self._json({"ok": True, "data": data})

    def _write_data(self, data):
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"

        if DATA_FILE.exists():
            try:
                BACKUP_FILE.write_text(DATA_FILE.read_text("utf-8"), "utf-8")
            except OSError:
                pass

        fd, temp_name = tempfile.mkstemp(
            prefix=".data-",
            suffix=".json.tmp",
            dir=str(DATA_FILE.parent),
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                handle.write(text)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, DATA_FILE)
        finally:
            if os.path.exists(temp_name):
                try:
                    os.unlink(temp_name)
                except OSError:
                    pass

    def _json(self, payload, status=HTTPStatus.OK):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        sys.stderr.write(
            "%s - - [%s] %s\n"
            % (self.client_address[0], self.log_date_time_string(), fmt % args)
        )


class MeowServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    port = 8080
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    else:
        try:
            port = int(os.environ.get("PORT", "8080"))
        except ValueError:
            pass

    server = MeowServer(("0.0.0.0", port), MeowHandler)
    print("")
    print("MEOW SYSTEM local server")
    print(f"  app:  http://127.0.0.1:{port}/meow-system.html")
    print(f"  data: {DATA_FILE}")
    print("  stop: Control+C")
    print("")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        print("\nMEOW SYSTEM server stopped.")


if __name__ == "__main__":
    main()
