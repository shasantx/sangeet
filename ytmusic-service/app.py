"""ASGI entrypoint for the private Vercel music-search service."""

from __future__ import annotations

import asyncio
import hmac
import json
import os
from urllib.parse import parse_qs

from server import search
from discovery import get_album, get_creator, search_catalog


async def app(scope: dict, receive, send) -> None:
    if scope.get("type") != "http":
        return

    method = scope.get("method", "GET")
    path = scope.get("path", "/")
    status = 200
    payload: dict

    if path == "/health" and method == "GET":
        payload = {"ok": True}
    elif path not in ("/search", "/api/search", "/api/catalog", "/api/details"):
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
            if path == "/api/details":
                browse_id = (params.get("browseId") or [""])[0]
                kind = (params.get("kind") or [""])[0]
                if kind not in ("artist", "album") or not browse_id or not browse_id.replace("_", "").replace("-", "").isalnum() or len(browse_id) > 100:
                    status, payload = 400, {"error": "invalid details request"}
                else:
                    try:
                        details = await asyncio.to_thread(get_creator, browse_id) if kind == "artist" else await asyncio.to_thread(get_album, browse_id)
                        payload = {"details": details, "type": kind}
                    except Exception:  # noqa: BLE001
                        status, payload = 502, {"error": "upstream details unavailable"}
            else:
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
                        if path == "/api/catalog":
                            kind = (params.get("kind") or [""])[0]
                            if kind not in ("artists", "albums", "playlists"):
                                status, payload = 400, {"results": [], "error": "invalid catalog type"}
                            else:
                                rows = await asyncio.to_thread(search_catalog, query, kind, min(limit, 8))
                                payload = {"results": rows, "query": query, "type": kind}
                        else:
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
