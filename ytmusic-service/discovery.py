"""Metadata creator, album, and playlist discovery using ytmusicapi."""

from __future__ import annotations

from server import get_client, normalize


def _thumb(item: dict) -> str:
    thumbs = item.get("thumbnails") or []
    if thumbs:
        largest = max(thumbs, key=lambda value: value.get("width") or 0)
        if largest.get("url"):
            url = str(largest["url"])
            if url.startswith("//"):
                url = "https:" + url
            return url
    return ""


def search_catalog(query: str, kind: str, limit: int = 12) -> list[dict]:
    filters = {"artists": "artists", "albums": "albums", "playlists": "playlists"}
    if kind not in filters:
        raise ValueError("Unsupported catalog type")
    rows = get_client().search(query, filter=filters[kind], limit=limit)
    result = []
    seen = set()
    for item in rows:
        browse_id = item.get("browseId")
        if not browse_id or not isinstance(browse_id, str):
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
            "type": str(item.get("type") or item.get("category") or ("Artist" if kind == "artists" else "Album" if kind == "albums" else "Playlist")).strip()[:40],
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
        if not normalized.get("thumbnail") or "hqdefault.jpg" in normalized.get("thumbnail", ""):
            if fallback_thumb:
                normalized["thumbnail"] = fallback_thumb
        result.append(normalized)
        if len(result) >= 50:
            break
    return result


def get_creator(browse_id: str) -> dict:
    client = get_client()
    value = None
    target_id = browse_id.strip()

    # Try direct get_artist if target looks like a YouTube browse ID
    if target_id.startswith("UC") or target_id.startswith("FEmusic_"):
        try:
            value = client.get_artist(target_id)
        except Exception:
            value = None

    # If direct fetch failed or wasn't a standard browse ID, search for artist
    if not value or not value.get("name"):
        query = target_id.replace("-", " ").strip()
        try:
            found = client.search(query, filter="artists", limit=3)
            if found and found[0].get("browseId"):
                target_id = found[0]["browseId"]
                try:
                    value = client.get_artist(target_id)
                except Exception:
                    value = None
        except Exception:
            pass

    if value and value.get("name"):
        info = value.get("artist", {}) if isinstance(value.get("artist"), dict) else {}
        name = value.get("name") or info.get("name") or "Artist"
        songs = value.get("songs") or {}
        albums = value.get("albums") or {}
        singles = value.get("singles") or {}

        artist_thumb = _thumb(value) or _thumb(info)
        track_rows = songs.get("results") or []
        track_list = _tracks(track_rows, artist_thumb)

        album_rows = (albums.get("results") or []) + (singles.get("results") or [])
        albums_list = []
        for alb in album_rows:
            alb_id = alb.get("browseId")
            if alb_id:
                albums_list.append({
                    "browseId": alb_id,
                    "title": alb.get("title") or "Album",
                    "year": alb.get("year"),
                    "thumbnail": _thumb(alb),
                    "type": alb.get("type") or "Album",
                })

        # If artist had 0 tracks from get_artist, search their songs directly
        if not track_list:
            try:
                searched_songs = client.search(f"{name} songs", filter="songs", limit=20)
                track_list = _tracks(searched_songs, artist_thumb)
            except Exception:
                pass

        return {
            "browseId": target_id,
            "title": str(name)[:180],
            "description": str(value.get("description") or "").strip()[:1200],
            "subscribers": str(value.get("subscribers") or "").strip()[:60],
            "thumbnail": artist_thumb,
            "tracks": track_list,
            "albums": albums_list[:12],
        }

    # Ultimate fallback: search songs and albums by query
    query = browse_id.replace("-", " ").strip()
    try:
        searched_songs = client.search(f"{query}", filter="songs", limit=20)
        track_list = _tracks(searched_songs)
        first_thumb = track_list[0]["thumbnail"] if track_list else ""
        searched_albums = client.search(f"{query}", filter="albums", limit=8)
        albums_list = [
            {
                "browseId": a.get("browseId") or "",
                "title": a.get("title") or "Album",
                "year": a.get("year"),
                "thumbnail": _thumb(a),
                "type": "Album",
            }
            for a in searched_albums if a.get("browseId")
        ]
        return {
            "browseId": browse_id,
            "title": query.title()[:180],
            "description": f"Songs and albums by {query.title()}.",
            "subscribers": "",
            "thumbnail": first_thumb,
            "tracks": track_list,
            "albums": albums_list,
        }
    except Exception:
        return {
            "browseId": browse_id,
            "title": query.title()[:180],
            "description": "",
            "subscribers": "",
            "thumbnail": "",
            "tracks": [],
            "albums": [],
        }


def get_album(browse_id: str) -> dict:
    client = get_client()
    value = None
    target_id = browse_id.strip()

    if target_id.startswith("MPRE") or target_id.startswith("OLAK"):
        try:
            value = client.get_album(target_id)
        except Exception:
            value = None

    if not value or not value.get("title"):
        query = target_id.replace("-", " ").strip()
        try:
            found = client.search(query, filter="albums", limit=3)
            if found and found[0].get("browseId"):
                target_id = found[0]["browseId"]
                value = client.get_album(target_id)
        except Exception:
            pass

    if value:
        artist_list = value.get("artists") or []
        artist = ", ".join(item.get("name", "") for item in artist_list if isinstance(item, dict) and item.get("name"))
        cover = _thumb(value)
        return {
            "browseId": target_id,
            "title": str(value.get("title") or "Album")[:180],
            "artist": artist[:140],
            "year": value.get("year"),
            "thumbnail": cover,
            "tracks": _tracks(value.get("tracks") or [], cover),
        }

    return {
        "browseId": browse_id,
        "title": "Album",
        "artist": "",
        "year": None,
        "thumbnail": "",
        "tracks": [],
    }


def get_playlist(playlist_id: str) -> dict:
    client = get_client()
    clean_id = playlist_id.replace("VL", "") if playlist_id.startswith("VL") else playlist_id
    value = None
    try:
        value = client.get_playlist(clean_id, limit=100)
    except Exception:
        try:
            value = client.get_playlist("VL" + clean_id, limit=100)
        except Exception:
            value = None

    # If direct fetch failed, search for playlist
    if not value or not value.get("title"):
        query = clean_id.replace("-", " ").strip()
        try:
            found = client.search(query, filter="playlists", limit=3)
            if found and found[0].get("browseId"):
                pid = found[0]["browseId"].replace("VL", "")
                try:
                    value = client.get_playlist(pid, limit=100)
                except Exception:
                    pass
        except Exception:
            pass

    if value:
        author = value.get("author", {})
        author_name = author.get("name") if isinstance(author, dict) else str(author or "YouTube Music")
        cover = _thumb(value)
        return {
            "id": playlist_id,
            "title": str(value.get("title") or "Playlist")[:180],
            "description": str(value.get("description") or "").strip()[:1200],
            "author": author_name[:140],
            "thumbnail": cover,
            "trackCount": value.get("trackCount") or len(value.get("tracks") or []),
            "tracks": _tracks(value.get("tracks") or [], cover),
        }

    # Fallback: search tracks for this playlist query
    query = playlist_id.replace("-", " ").strip()
    try:
        searched = client.search(query, filter="songs", limit=25)
        tracks = _tracks(searched)
        cover = tracks[0]["thumbnail"] if tracks else ""
        return {
            "id": playlist_id,
            "title": query.title()[:180],
            "description": f"Curated playlist for {query}.",
            "author": "Sangeet Discovery",
            "thumbnail": cover,
            "trackCount": len(tracks),
            "tracks": tracks,
        }
    except Exception:
        return {
            "id": playlist_id,
            "title": "Playlist",
            "description": "",
            "author": "Sangeet",
            "thumbnail": "",
            "trackCount": 0,
            "tracks": [],
        }
