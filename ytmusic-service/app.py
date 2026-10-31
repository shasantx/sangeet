"""ASGI entrypoint for the private Vercel music-search service."""

from __future__ import annotations

import asyncio
import hmac
import json
import os
from urllib.parse import parse_qs

from server import search


async def app(scope: dict, receive, send) -> None:
    if scope.get("type") != "http":
        return

    method = scope.get("method", "GET")
    path = scope.get("path", "/")
    status = 200
    payload: dict

    if path == "/health" and method == "GET":
        payload = {"ok": True}
    elif path not in ("/search", "/api/search"):
        status, payload = 404, {"error": "not found"}
    elif method != "GET":
        status, payload = 405, {"error": "method not allowed"}
    else:
        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        expected_token = os.environ.get("YTMUSIC_SERVICE_TOKEN")
        supplied_token = headers.get(b"authorization", b"").decode("latin-1").removeprefix("Bearer ")
        if expected_token and not hmac.compare_digest(supplied_token, expected_token):
            status, payload = 401, {"error": "unauthorized"}
        else:
            params = parse_qs(scope.get("query_string", b"").decode("utf-8", "replace"))
            query = (params.get("q") or [""])[0].strip()
            if not query:
                payload = {"results": []}
            elif len(query) > 120:
                status, payload = 400, {"results": [], "error": "query too long"}
            else:
                try:
                    limit = int((params.get("limit") or ["12"])[0])
                except ValueError:
                    limit = 12
                limit = max(1, min(12, limit))
                try:
                    payload = {"results": await asyncio.to_thread(search, query, limit), "query": query}
                except Exception:  # noqa: BLE001 - upstream details must not reach callers
                    status, payload = 502, {"results": [], "error": "search unavailable"}

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [
            (b"content-type", b"application/json; charset=utf-8"),
            (b"cache-control", b"no-store"),
            (b"content-length", str(len(body)).encode("ascii")),
        ],
    })
    await send({"type": "http.response.body", "body": body})
