#!/usr/bin/env python3
"""Local YouTube Music search service for Sangeet.

Uses the unofficial `ytmusicapi` client to search YouTube-wide and returns
metadata only (video IDs, titles, artists, durations, thumbnails). Playback
still happens through the official YouTube IFrame Player in the browser — this
service never downloads or streams audio.

Run:  py ytmusic-service/server.py
Port: 8765 (override with YTMUSIC_PORT)
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from ytmusicapi import YTMusic

PORT = int(os.environ.get("YTMUSIC_PORT", "8765"))
BIND = os.environ.get("YTMUSIC_BIND", "127.0.0.1")
CACHE_TTL_SECONDS = 300

_ytmusic: YTMusic | None = None
_cache: dict[tuple[str, int], tuple[float, list[dict]]] = {}
_lock = threading.Lock()


def get_client() -> YTMusic:
    global _ytmusic
    if _ytmusic is None:
        _ytmusic = YTMusic()
    return _ytmusic


def parse_duration(value: object) -> int:
    if isinstance(value, (int, float)) and value > 0:
        return int(value)
    if isinstance(value, str):
        match = re.fullmatch(r"(?:(\d+):)?(\d{1,2}):(\d{2})", value.strip())
        if match:
            hours, minutes, seconds = match.groups()
            return int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds)
    return 0


def thumb_for(item: dict, video_id: str) -> str:
    thumbnails = item.get("thumbnails") or []
    if thumbnails:
        largest = max(thumbnails, key=lambda thumb: (thumb.get("width") or 0))
        if largest.get("url"):
            return str(largest["url"]).split("?")[0]
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


def normalize(item: dict) -> dict | None:
    video_id = item.get("videoId")
    if not video_id:
        return None
    if item.get("videoType") == "MUSIC_VIDEO_TYPE_ATV":
        # Art tracks are frequently not embeddable. Prefer real videos.
        return None
    artists = [artist.get("name") for artist in (item.get("artists") or []) if artist.get("name")]
    artist = ", ".join(artists) if artists else (item.get("author") or "YouTube")
    album = (item.get("album") or {}).get("name") or ""
    return {
        "videoId": video_id,
        "title": item.get("title") or "Untitled",
        "artist": artist,
        "album": album,
        "durationSeconds": parse_duration(
            item.get("duration_seconds") or item.get("duration")
        ),
        "thumbnail": thumb_for(item, video_id),
        "year": item.get("year"),
        "views": item.get("views"),
        "videoType": item.get("videoType"),
    }


def search(query: str, limit: int) -> list[dict]:
    key = (query.strip().lower(), limit)
    now = time.time()
    with _lock:
        cached = _cache.get(key)
        if cached and now - cached[0] < CACHE_TTL_SECONDS:
            return cached[1]

    client = get_client()
    raw = client.search(query, filter="videos", limit=max(limit * 2, 12))
    # Prefer official music videos, which are the most likely to allow embeds.
    raw = sorted(
        raw,
        key=lambda item: 0 if item.get("videoType") == "MUSIC_VIDEO_TYPE_OMV" else 1,
    )
    results: list[dict] = []
    seen: set[str] = set()
    for item in raw:
        normalized = normalize(item)
        if not normalized:
            continue
        if normalized["videoId"] in seen:
            continue
        seen.add(normalized["videoId"])
        results.append(normalized)
        if len(results) >= limit:
            break

    with _lock:
        _cache[key] = (now, results)
        if len(_cache) > 200:
            oldest = sorted(_cache.items(), key=lambda entry: entry[1][0])[:50]
            for stale_key, _ in oldest:
                _cache.pop(stale_key, None)
    return results


class Handler(BaseHTTPRequestHandler):
    server_version = "Sangeet-YTMusic/1.0"

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send(200, {"ok": True})
            return
        if parsed.path != "/search":
            self._send(404, {"error": "not found"})
            return

        params = parse_qs(parsed.query)
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
        limit = max(1, min(25, limit))

        try:
            results = search(query, limit)
        except Exception:  # noqa: BLE001 - keep upstream details out of client responses
            self._send(502, {"results": [], "error": "upstream search unavailable"})
            return
        self._send(200, {"results": results, "query": query})

    def log_message(self, fmt: str, *args: object) -> None:
        # Search strings and client IP addresses are not written to logs.
        return


def main() -> None:
    print(f"[ytmusic] starting on http://{BIND}:{PORT}", flush=True)
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
