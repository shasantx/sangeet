"""Vercel Python Function adapter for the local search implementation."""

from __future__ import annotations

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs

from server import search


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - Vercel Python handler API
        expected_token = os.environ.get("YTMUSIC_SERVICE_TOKEN")
        if not expected_token:
            self._send(503, {"error": "service not configured"})
            return
        supplied_token = self.headers.get("Authorization", "").removeprefix("Bearer ")
        if not hmac.compare_digest(supplied_token, expected_token):
            self._send(401, {"error": "unauthorized"})
            return

        params = parse_qs(self.path.partition("?")[2])
        query = (params.get("q") or [""])[0].strip()
        if not query:
            self._send(200, {"results": []})
            return
        if len(query) > 120:
            self._send(400, {"results": [], "error": "query too long"})
            return
        try:
            limit = int((params.get("limit") or ["12"])[0])
        except ValueError:
            limit = 12
        limit = max(1, min(12, limit))

        try:
            self._send(200, {"results": search(query, limit), "query": query})
        except Exception:  # noqa: BLE001 - upstream details must not reach the caller
            self._send(502, {"results": [], "error": "search unavailable"})

    def log_message(self, fmt: str, *args: object) -> None:
        return
