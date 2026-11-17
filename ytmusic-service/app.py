"""ASGI entrypoint for the private Vercel music-search service."""

from __future__ import annotations

import asyncio
import hmac
import json
import os
import re
from urllib.parse import parse_qs

from server import get_client, search
from discovery import get_album, get_creator, get_playlist, search_catalog

SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{2,100}$")
SAFE_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")


async def app(scope: dict, receive, send) -> None:
    if scope.get("type") != "http":
        return

    method = scope.get("method", "GET")
    path = scope.get("path", "/")
    status = 200
    payload: dict

    if path == "/health" and method == "GET":
        payload = {"ok": True}
    elif path not in ("/search", "/api/search", "/api/catalog", "/api/details", "/api/playlist", "/api/lyrics"):
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
            if path == "/api/playlist":
                playlist_id = (params.get("id") or params.get("playlistId") or [""])[0].strip()
                if not playlist_id or not SAFE_ID_RE.match(playlist_id):
                    status, payload = 400, {"error": "invalid playlist id"}
                else:
                    try:
                        playlist = await asyncio.to_thread(get_playlist, playlist_id)
                        payload = {"ok": True, "playlist": playlist}
                    except Exception:
                        status, payload = 502, {"error": "upstream playlist unavailable"}
            elif path == "/api/lyrics":
                video_id = (params.get("videoId") or [""])[0].strip()
                if not video_id or not SAFE_VIDEO_ID_RE.match(video_id):
                    status, payload = 400, {"error": "invalid videoId"}
                else:
                    try:
                        def _fetch_lyrics(vid: str) -> dict:
                            client = get_client()
                            wp = client.get_watch_playlist(videoId=vid)
                            lyrics_id = wp.get("lyrics")
                            if lyrics_id:
                                data = client.get_lyrics(lyrics_id)
                                return {
                                    "ok": True,
                                    "lyrics": str(data.get("lyrics") or "")[:20000],
                                    "source": str(data.get("source") or "")[:80],
                                    "hasTimestamps": bool(data.get("hasTimestamps", False)),
                                }
                            return {"ok": True, "lyrics": "", "source": "", "hasTimestamps": False}

                        payload = await asyncio.to_thread(_fetch_lyrics, video_id)
                    except Exception:
                        status, payload = 502, {"error": "upstream lyrics unavailable", "lyrics": ""}
            elif path == "/api/details":
                browse_id = (params.get("browseId") or [""])[0].strip()
                kind = (params.get("kind") or [""])[0].strip()
                if kind not in ("artist", "album", "playlist") or not SAFE_ID_RE.match(browse_id):
                    status, payload = 400, {"error": "invalid details request"}
                else:
                    try:
                        if kind == "artist":
                            details = await asyncio.to_thread(get_creator, browse_id)
                        elif kind == "album":
                            details = await asyncio.to_thread(get_album, browse_id)
                        else:
                            details = await asyncio.to_thread(get_playlist, browse_id)
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
            (b"x-content-type-options", b"nosniff"),
            (b"x-frame-options", b"DENY"),
            (b"content-length", str(len(body)).encode("ascii")),
        ],
    })
    await send({"type": "http.response.body", "body": body})
