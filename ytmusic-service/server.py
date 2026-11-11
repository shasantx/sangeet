#!/usr/bin/env python3
"""Local YouTube Music search service for Sangeet.

Uses the unofficial `ytmusicapi` client to search YouTube-wide and returns
metadata (video IDs, titles, artists, durations, thumbnails).
"""

from __future__ import annotations

import hmac
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
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{2,100}$")
SAFE_VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

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
            url = str(largest["url"])
            if url.startswith("//"):
                url = "https:" + url
            return url
    return f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"


def normalize(item: dict) -> dict | None:
    video_id = item.get("videoId")
    if not video_id or not isinstance(video_id, str) or not SAFE_VIDEO_ID_RE.match(video_id):
        return None
    artists_raw = item.get("artists") or []
    artists = []
    if isinstance(artists_raw, list):
        for entry in artists_raw:
            if isinstance(entry, dict):
                name = entry.get("name")
                if name:
                    artists.append(name)
            elif isinstance(entry, str) and entry:
                artists.append(entry)
    elif isinstance(artists_raw, str) and artists_raw:
        artists.append(artists_raw)

    artist = ", ".join(artists) if artists else (item.get("author") or "YouTube")
    if isinstance(artist, dict):
        artist = artist.get("name") or "YouTube"

    raw_album = item.get("album")
    if isinstance(raw_album, dict):
        album = raw_album.get("name") or ""
    elif isinstance(raw_album, str):
        album = raw_album
    else:
        album = ""

    return {
        "videoId": video_id,
        "title": str(item.get("title") or "Untitled")[:180],
        "artist": str(artist)[:140],
        "album": str(album)[:160],
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
    raw = []
    try:
        songs = client.search(query, filter="songs", limit=max(limit, 8))
        if songs:
            raw.extend(songs)
    except Exception:
        pass

    try:
        videos = client.search(query, filter="videos", limit=max(limit, 8))
        if videos:
            raw.extend(videos)
    except Exception:
        pass

    if not raw:
        try:
            raw = client.search(query, limit=max(limit * 2, 12))
        except Exception:
            raw = []

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
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - stdlib handler API
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send(200, {"ok": True})
            return
        allowed_paths = ("/search", "/api/search", "/api/catalog", "/api/details", "/api/playlist", "/api/lyrics")
        if parsed.path not in allowed_paths:
            self._send(404, {"error": "not found"})
            return

        expected_token = os.environ.get("YTMUSIC_SERVICE_TOKEN")
        if expected_token and not hmac.compare_digest(
            self.headers.get("Authorization", "").removeprefix("Bearer "),
            expected_token,
        ):
            self._send(401, {"error": "unauthorized"})
            return

        params = parse_qs(parsed.query)

        # /api/playlist
        if parsed.path == "/api/playlist":
            playlist_id = (params.get("id") or params.get("playlistId") or [""])[0].strip()
            if not playlist_id or not SAFE_ID_RE.match(playlist_id):
                self._send(400, {"error": "invalid playlist id"})
                return
            try:
                from discovery import get_playlist
                playlist = get_playlist(playlist_id)
                self._send(200, {"ok": True, "playlist": playlist})
            except Exception:
                self._send(502, {"error": "upstream playlist unavailable"})
            return

        # /api/lyrics
        if parsed.path == "/api/lyrics":
            video_id = (params.get("videoId") or [""])[0].strip()
            if not video_id or not SAFE_VIDEO_ID_RE.match(video_id):
                self._send(400, {"error": "invalid videoId"})
                return
            try:
                client = get_client()
                wp = client.get_watch_playlist(videoId=video_id)
                lyrics_id = wp.get("lyrics")
                if lyrics_id:
                    data = client.get_lyrics(lyrics_id)
                    self._send(200, {
                        "ok": True,
                        "lyrics": str(data.get("lyrics") or "")[:20000],
                        "source": str(data.get("source") or "")[:80],
                        "hasTimestamps": bool(data.get("hasTimestamps", False)),
                    })
                else:
                    self._send(200, {"ok": True, "lyrics": "", "source": "", "hasTimestamps": False})
            except Exception:
                self._send(502, {"error": "upstream lyrics unavailable", "lyrics": ""})
            return

        # /api/details
        if parsed.path == "/api/details":
            browse_id = (params.get("browseId") or [""])[0].strip()
            kind = (params.get("kind") or [""])[0].strip()
            if kind not in ("artist", "album", "playlist") or not SAFE_ID_RE.match(browse_id):
                self._send(400, {"error": "invalid details request"})
                return
            try:
                from discovery import get_album, get_creator, get_playlist
                if kind == "artist":
                    details = get_creator(browse_id)
                elif kind == "album":
                    details = get_album(browse_id)
                else:
                    details = get_playlist(browse_id)
                self._send(200, {"details": details, "type": kind})
            except Exception:
                self._send(502, {"error": "upstream details unavailable"})
            return

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

        if parsed.path == "/api/catalog":
            kind = (params.get("kind") or [""])[0]
            if kind not in ("artists", "albums", "playlists"):
                self._send(400, {"results": [], "error": "invalid catalog type"})
                return
            try:
                from discovery import search_catalog
                self._send(200, {"results": search_catalog(query, kind, limit), "query": query, "type": kind})
            except Exception:
                self._send(502, {"results": [], "error": "upstream catalog unavailable"})
            return

        try:
            results = search(query, limit)
        except Exception:
            self._send(502, {"results": [], "error": "upstream search unavailable"})
            return
        self._send(200, {"results": results, "query": query})

    def log_message(self, fmt: str, *args: object) -> None:
        return


def main() -> None:
    print(f"[ytmusic] starting on http://{BIND}:{PORT}", flush=True)
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
