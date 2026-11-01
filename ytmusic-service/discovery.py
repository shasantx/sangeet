"""Metadata-only creator and album discovery using ytmusicapi."""

from __future__ import annotations

from server import get_client, normalize, thumb_for


def _thumb(item: dict) -> str:
    thumbs = item.get("thumbnails") or []
    if thumbs:
        largest = max(thumbs, key=lambda value: value.get("width") or 0)
        if largest.get("url"):
            return str(largest["url"])
    return ""


def search_catalog(query: str, kind: str, limit: int = 8) -> list[dict]:
    filters = {"artists": "artists", "albums": "albums", "playlists": "playlists"}
    if kind not in filters:
        raise ValueError("Unsupported catalog type")
    rows = get_client().search(query, filter=filters[kind], limit=limit)
    result = []
    seen = set()
    for item in rows:
        browse_id = item.get("browseId")
        if not browse_id or not isinstance(browse_id, str) or not browse_id.replace("_", "").replace("-", "").isalnum():
            continue
        title = item.get("artist") if kind == "artists" else item.get("title")
        if not isinstance(title, str) or not title.strip() or browse_id in seen:
            continue
        seen.add(browse_id)
        artists = item.get("artists") or []
        artist = item.get("artist") or (artists[0].get("name") if artists and isinstance(artists[0], dict) else "")
        result.append({
            "browseId": browse_id,
            "title": title.strip()[:180],
            "artist": str(artist or "").strip()[:140],
            "year": item.get("year"),
            "type": str(item.get("type") or "").strip()[:40],
            "subscribers": str(item.get("subscribers") or "").strip()[:60],
            "thumbnail": _thumb(item),
        })
        if len(result) >= limit:
            break
    return result


def _tracks(rows: list[dict], fallback_thumb: str = "") -> list[dict]:
    result = []
    seen = set()
    for row in rows:
        normalized = normalize(row)
        if not normalized:
            continue
        video_id = normalized["videoId"]
        if video_id in seen:
            continue
        seen.add(video_id)
        if not normalized.get("thumbnail") or "i.ytimg.com/vi/" in normalized["thumbnail"] and normalized["thumbnail"].endswith("hqdefault.jpg"):
            normalized["thumbnail"] = fallback_thumb or normalized["thumbnail"]
        result.append(normalized)
        if len(result) >= 30:
            break
    return result


def get_creator(browse_id: str) -> dict:
    value = get_client().get_artist(browse_id)
    info = value.get("artist", {}) if isinstance(value.get("artist"), dict) else {}
    name = value.get("name") or info.get("name") or "Artist"
    songs = value.get("songs") or {}
    return {
        "browseId": browse_id,
        "title": str(name)[:180],
        "description": str(value.get("description") or "").strip()[:1200],
        "subscribers": str(value.get("subscribers") or "").strip()[:60],
        "thumbnail": _thumb(value) or _thumb(info),
        "tracks": _tracks(songs.get("results") or []),
    }


def get_album(browse_id: str) -> dict:
    value = get_client().get_album(browse_id)
    artist_list = value.get("artists") or []
    artist = ", ".join(item.get("name", "") for item in artist_list if isinstance(item, dict) and item.get("name"))
    cover = _thumb(value)
    return {
        "browseId": browse_id,
        "title": str(value.get("title") or "Album")[:180],
        "artist": artist[:140],
        "year": value.get("year"),
        "thumbnail": cover,
        "tracks": _tracks(value.get("tracks") or [], cover),
    }
