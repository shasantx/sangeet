#!/usr/bin/env python3
"""Generate AURA's music catalogue from YouTube Music.

The app ships a build-time snapshot so every page can be statically rendered
and stay fast. Live search still goes through the local ytmusicapi service.

What this does:
  1. Looks up a curated set of artists on YouTube Music.
  2. Pulls their albums and tracks (real titles, durations, artwork, video IDs).
  3. Filters out videos that YouTube will not allow to be embedded.
  4. Writes data/ytmusic-catalog.json in AURA's native shape.

Run:  .venv-ytm\\Scripts\\python.exe scripts\\build-ytmusic-catalog.py
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ytmusicapi import YTMusic

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "ytmusic-catalog.json"
EMBED_CACHE = ROOT / "data" / "embed-cache.json"

MAX_TRACKS_PER_ALBUM = 10
MAX_ALBUMS_PER_ARTIST = 2

# name, genres, mood, extra album titles to prefer (optional)
SEEDS: list[dict] = [
    {"name": "Brian Eno", "genres": ["ambient", "electronic"], "mood": "Slow light"},
    {"name": "Boards of Canada", "genres": ["ambient", "electronic"], "mood": "Tape haze"},
    {"name": "Nils Frahm", "genres": ["ambient", "cinematic"], "mood": "Felt piano"},
    {"name": "Daft Punk", "genres": ["electronic", "alternative"], "mood": "Chrome and neon"},
    {"name": "ODESZA", "genres": ["electronic", "cinematic"], "mood": "Wide open skies"},
    {"name": "Bonobo", "genres": ["electronic", "downtempo"], "mood": "After hours"},
    {"name": "Fred again..", "genres": ["electronic", "indie"], "mood": "Voice notes at 3am"},
    {"name": "Radiohead", "genres": ["alternative", "electronic"], "mood": "Beautiful dread"},
    {"name": "Tame Impala", "genres": ["alternative", "indie"], "mood": "Psychedelic shimmer"},
    {"name": "Gorillaz", "genres": ["alternative", "electronic"], "mood": "Satellite pop"},
    {"name": "The Weeknd", "genres": ["soul", "electronic"], "mood": "Neon and restless"},
    {"name": "Frank Ocean", "genres": ["soul", "indie"], "mood": "Salt and summer"},
    {"name": "Sade", "genres": ["soul", "jazz"], "mood": "Velvet evening"},
    {"name": "Cleo Sol", "genres": ["soul", "jazz"], "mood": "Warm and certain"},
    {"name": "Miles Davis", "genres": ["jazz", "cinematic"], "mood": "Blue and after midnight"},
    {"name": "Kamasi Washington", "genres": ["jazz", "soul"], "mood": "Saxophone sunrise"},
    {"name": "Nujabes", "genres": ["jazz", "downtempo"], "mood": "Dusty loops"},
    {"name": "Bon Iver", "genres": ["indie", "ambient"], "mood": "Cabin winter"},
    {"name": "Phoebe Bridgers", "genres": ["indie", "alternative"], "mood": "Quiet devastation"},
    {"name": "Beach House", "genres": ["indie", "ambient"], "mood": "Velvet dusk"},
    {"name": "Hans Zimmer", "genres": ["cinematic", "electronic"], "mood": "Widescreen tension"},
    {"name": "Olafur Arnalds", "genres": ["cinematic", "ambient"], "mood": "Frozen strings"},
    {"name": "Max Richter", "genres": ["cinematic", "ambient"], "mood": "Slow recomposure"},
    {"name": "Massive Attack", "genres": ["downtempo", "electronic"], "mood": "Rain on glass"},
    {"name": "Portishead", "genres": ["downtempo", "alternative"], "mood": "Smoke and tremolo"},
    {"name": "Air", "genres": ["downtempo", "electronic"], "mood": "Retro futurism"},
]

GENRES = [
    ("ambient", "Ambient", "Slow, spacious music for thinking and not thinking.", "#6E8B8F"),
    ("electronic", "Electronic", "Synthesised worlds, built beat by beat.", "#8B7BD8"),
    ("alternative", "Alternative", "Guitars that refuse the obvious.", "#C4705F"),
    ("soul", "Soul & R&B", "Close voices, deep pockets, honest songs.", "#C98F5E"),
    ("jazz", "Jazz", "Improvisation with a long memory.", "#5F8FC4"),
    ("indie", "Indie", "Bedrooms, basements and big feelings.", "#8FA36B"),
    ("cinematic", "Cinematic", "Music that makes the room feel enormous.", "#A07A9B"),
    ("downtempo", "Downtempo", "Low lights, low BPM, high atmosphere.", "#6E7C9B"),
]

PLAYLIST_BLUEPRINTS = [
    ("late-night-drive", "Late Night Drive", "Neon, wet asphalt and no particular destination.", ["electronic", "soul"], "#7C6BD8"),
    ("deep-focus", "Deep Focus", "Long, patient pieces that leave your attention alone.", ["ambient", "cinematic"], "#5E8B8A"),
    ("sunday-slow", "Sunday Slow", "Nothing urgent. Nowhere to be.", ["soul", "jazz"], "#C08A5A"),
    ("after-hours", "After Hours", "For the last hour of the party and the first of the morning.", ["downtempo", "electronic"], "#6C7699"),
    ("quiet-rage", "Quiet Rage", "Guitars turned up, voices kept low.", ["alternative", "indie"], "#B4624F"),
    ("golden-hour", "Golden Hour", "Warm records for the walk home.", ["indie", "soul"], "#C79A5C"),
    ("night-trains", "Night Trains", "Motion without motion.", ["downtempo", "ambient"], "#66799B"),
    ("big-sky", "Big Sky", "Widescreen music for small moments.", ["cinematic", "ambient"], "#97728F"),
    ("sax-and-silk", "Sax & Silk", "Modern jazz with a soft edge.", ["jazz", "soul"], "#5C86B8"),
    ("tape-loop", "Tape Loop", "Dust, hiss and a beat that keeps its balance.", ["downtempo", "jazz"], "#8A7A5E"),
    ("first-light", "First Light", "Music for the beginning of something.", ["ambient", "indie"], "#7E9B84"),
    ("slow-burn", "Slow Burn", "It builds. Then it builds again.", ["alternative", "cinematic"], "#A2645C"),
]


def slugify(value: str) -> str:
    value = value.lower().strip()
    value = re.sub(r"[\u0300-\u036f]", "", value)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "unknown"


def stable_int(value: str, low: int, high: int) -> int:
    digest = int(hashlib.sha1(value.encode("utf-8")).hexdigest()[:8], 16)
    return low + digest % max(1, high - low)


def pick_thumb(thumbnails: list | None, min_width: int = 400) -> str:
    if not thumbnails:
        return ""
    ranked = sorted(thumbnails, key=lambda t: t.get("width") or 0)
    chosen = None
    for thumb in ranked:
        if (thumb.get("width") or 0) >= min_width:
            chosen = thumb
            break
    chosen = chosen or ranked[-1]
    return (chosen.get("url") or "").split("=")[0] + "=w640-h640-l90-rj" if "googleusercontent" in (chosen.get("url") or "") else (chosen.get("url") or "")


def album_art(thumbnails: list | None) -> str:
    if not thumbnails:
        return ""
    ranked = sorted(thumbnails, key=lambda t: t.get("width") or 0)
    return (ranked[-1].get("url") or "").split("?")[0]


EMBED: dict[str, bool] = {}


def load_cache() -> None:
    if EMBED_CACHE.exists():
        try:
            EMBED.update(json.loads(EMBED_CACHE.read_text(encoding="utf-8")))
        except Exception:  # noqa: BLE001
            pass


def save_cache() -> None:
    EMBED_CACHE.parent.mkdir(parents=True, exist_ok=True)
    EMBED_CACHE.write_text(json.dumps(EMBED, indent=0), encoding="utf-8")


def check_embed(video_id: str) -> bool:
    if video_id in EMBED:
        return EMBED[video_id]
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            ok = response.status == 200
    except urllib.error.HTTPError as exc:
        # 401/403/404 mean the owner disabled embedding or the video is gone.
        ok = exc.code not in (401, 403, 404)
    except Exception:  # noqa: BLE001 - transient network failure: keep the track
        ok = True
    EMBED[video_id] = ok
    return ok


def verify_tracks(video_ids: list[str]) -> None:
    pending = [vid for vid in video_ids if vid not in EMBED]
    if not pending:
        return
    print(f"[catalog] checking embeddability for {len(pending)} tracks…", flush=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(check_embed, pending))
    save_cache()


def find_artist(client: YTMusic, name: str) -> dict | None:
    try:
        results = client.search(name, filter="artists", limit=6)
    except Exception as exc:  # noqa: BLE001
        print(f"  ! search failed for {name}: {exc}", flush=True)
        return None
    target = slugify(name)
    for item in results:
        label = item.get("artist") or item.get("title") or ""
        if slugify(label) == target:
            return item
    for item in results:
        label = item.get("artist") or item.get("title") or ""
        if target in slugify(label):
            return item
    return results[0] if results else None


def main() -> int:
    client = YTMusic()
    load_cache()

    artists: list[dict] = []
    albums: list[dict] = []
    tracks: list[dict] = []
    seen_tracks: set[str] = set()
    seen_albums: set[str] = set()

    for seed in SEEDS:
        name = seed["name"]
        print(f"[catalog] {name}", flush=True)
        match = find_artist(client, name)
        if not match:
            print("  ! not found", flush=True)
            continue

        browse_id = match.get("browseId")
        if not browse_id:
            continue

        try:
            detail = client.get_artist(browse_id)
        except Exception as exc:  # noqa: BLE001
            print(f"  ! artist fetch failed: {exc}", flush=True)
            continue

        artist_id = slugify(name)
        album_results = list((detail.get("albums") or {}).get("results") or [])
        singles = list((detail.get("singles") or {}).get("results") or [])
        candidates = [a for a in album_results if a.get("browseId")]

        # Prefer full albums, newest first, but keep a little variety.
        candidates.sort(key=lambda a: (0 if a.get("type") == "Album" else 1, -(int(a.get("year") or 0))))
        chosen = candidates[:MAX_ALBUMS_PER_ARTIST]
        if not chosen:
            chosen = [s for s in singles if s.get("browseId")][:1]

        artist_albums: list[dict] = []
        artist_track_ids: list[str] = []

        for album_stub in chosen:
            try:
                album_detail = client.get_album(album_stub["browseId"])
            except Exception as exc:  # noqa: BLE001
                print(f"  ! album fetch failed: {exc}", flush=True)
                continue

            album_key = album_detail.get("title", "") + "|" + name
            if album_key in seen_albums:
                continue
            seen_albums.add(album_key)

            artwork = album_art(album_detail.get("thumbnails")) or album_art(album_stub.get("thumbnails"))
            if not artwork:
                continue

            album_id = f"al-{slugify(album_detail.get('title', 'album'))}-{slugify(name)[:18]}"
            if album_id in {a["id"] for a in albums}:
                album_id = f"{album_id}-{stable_int(album_key, 100, 999)}"

            year = album_detail.get("year") or album_stub.get("year") or ""
            try:
                year_int = int(year)
            except (TypeError, ValueError):
                year_int = 0

            album_type = album_detail.get("type") or album_stub.get("type") or "Album"
            if album_type not in ("Album", "EP", "Single"):
                album_type = "Album"

            album_tracks: list[dict] = []
            for index, raw in enumerate(album_detail.get("tracks") or []):
                if len(album_tracks) >= MAX_TRACKS_PER_ALBUM:
                    break
                video_id = raw.get("videoId")
                if not video_id or not raw.get("isAvailable", True):
                    continue
                if video_id in seen_tracks:
                    continue
                title = (raw.get("title") or "").strip()
                if not title:
                    continue
                duration = raw.get("duration_seconds") or 0
                if not isinstance(duration, int) or duration <= 0:
                    continue
                track_id = f"yt-{video_id}"
                seen_tracks.add(video_id)
                album_tracks.append(
                    {
                        "id": track_id,
                        "title": title,
                        "artistId": artist_id,
                        "albumId": album_id,
                        "duration": duration,
                        "audioUrl": "",
                        "artwork": artwork,
                        "source": "youtube",
                        "youtubeId": video_id,
                        "genreIds": seed["genres"],
                        "mood": seed["mood"],
                        "plays": stable_int(video_id, 120_000, 84_000_000),
                        "trackNumber": len(album_tracks) + 1,
                        "explicit": bool(raw.get("isExplicit")),
                    }
                )

            if not album_tracks:
                continue

            album_tracks_ids = [t["id"] for t in album_tracks]
            tracks.extend(album_tracks)
            artist_track_ids.extend(album_tracks_ids)
            artist_albums.append(
                {
                    "id": album_id,
                    "title": album_detail.get("title") or album_stub.get("title") or "Untitled",
                    "artistId": artist_id,
                    "year": year_int,
                    "releaseDate": f"{year_int or 1970}-01-01",
                    "type": album_type,
                    "artwork": artwork,
                    "genreIds": seed["genres"],
                    "description": (album_detail.get("description") or "").strip()
                    or f"{album_detail.get('title', 'This record')} by {name}.",
                    "trackIds": album_tracks_ids,
                }
            )

        if not artist_albums:
            print("  ! no playable albums", flush=True)
            continue

        albums.extend(artist_albums)

        description = (detail.get("description") or "").strip()
        description = re.sub(r"\n*From Wikipedia.*$", "", description, flags=re.S).strip()
        short = description.split("\n")[0][:180] if description else f"Music by {name}."
        image = artist_albums[0]["artwork"]

        artists.append(
            {
                "id": artist_id,
                "name": name,
                "bio": description[:900] or f"{name} on YouTube Music.",
                "shortBio": short,
                "image": image,
                "location": "",
                "monthlyListeners": stable_int(name + "listeners", 600_000, 92_000_000),
                "followers": stable_int(name + "followers", 120_000, 41_000_000),
                "genreIds": seed["genres"],
                "relatedArtistIds": [],
                "verified": True,
            }
        )
        time.sleep(0.15)

    if not tracks:
        print("[catalog] no tracks generated", file=sys.stderr)
        return 1

    verify_tracks([t["youtubeId"] for t in tracks])

    # Drop anything YouTube will not embed, then repair album/artist references.
    blocked = {vid for vid, ok in EMBED.items() if not ok}
    before = len(tracks)
    tracks = [t for t in tracks if t["youtubeId"] not in blocked]
    print(f"[catalog] removed {before - len(tracks)} non-embeddable tracks", flush=True)

    kept = {t["id"] for t in tracks}
    albums = [a for a in albums if any(tid in kept for tid in a["trackIds"])]
    for album in albums:
        album["trackIds"] = [tid for tid in album["trackIds"] if tid in kept]
    album_by_id = {a["id"]: a for a in albums}
    tracks = [t for t in tracks if t["albumId"] in album_by_id]

    artist_ids = {a["id"] for a in artists}
    tracks = [t for t in tracks if t["artistId"] in artist_ids]
    albums = [a for a in albums if any(t["id"] in {tr["albumId"] for tr in tracks} for _ in (0,))]

    # Related artists: same genre, closest in the seed order.
    for artist in artists:
        related = [
            other["id"]
            for other in artists
            if other["id"] != artist["id"]
            and set(other["genreIds"]) & set(artist["genreIds"])
        ][:4]
        artist["relatedArtistIds"] = related

    # Genres with real track lists and representative artwork.
    genre_records = []
    for genre_id, genre_name, genre_desc, accent in GENRES:
        genre_tracks = [t for t in tracks if genre_id in t["genreIds"]]
        if not genre_tracks:
            continue
        genre_records.append(
            {
                "id": genre_id,
                "name": genre_name,
                "description": genre_desc,
                "image": genre_tracks[0]["artwork"],
                "accent": accent,
                "trackIds": [t["id"] for t in genre_tracks],
            }
        )

    # Curated playlists drawn from the snapshot.
    playlists = []
    for playlist_id, title, description, genre_ids, accent in PLAYLIST_BLUEPRINTS:
        pool = [t for t in tracks if set(t["genreIds"]) & set(genre_ids)]
        if len(pool) < 6:
            pool = tracks
        # Deterministic interleave so playlists do not all share a first track.
        offset = stable_int(playlist_id, 0, max(1, len(pool) - 1))
        rotated = pool[offset:] + pool[:offset]
        selected: list[dict] = []
        seen_artists: set[str] = set()
        for track in rotated:
            if track["artistId"] in seen_artists and len(selected) < 12:
                continue
            seen_artists.add(track["artistId"])
            selected.append(track)
            if len(selected) >= 16:
                break
        if not selected:
            continue
        playlists.append(
            {
                "id": playlist_id,
                "title": title,
                "description": description,
                "curator": "AURA",
                "artwork": selected[0]["artwork"],
                "trackIds": [t["id"] for t in selected],
                "genreIds": genre_ids,
                "accent": accent,
                "featured": len(playlists) < 4,
            }
        )

    # Feature a real recent album as the hero.
    hero_album = sorted(albums, key=lambda a: -(a["year"] or 0))[0]
    hero_tracks = hero_album["trackIds"][:3]

    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": "ytmusicapi",
        "artists": artists,
        "albums": albums,
        "tracks": tracks,
        "playlists": playlists,
        "genres": genre_records,
        "featuredHero": {
            "eyebrow": "AURA PREMIERE",
            "title": hero_album["title"],
            "artist": next(a["name"] for a in artists if a["id"] == hero_album["artistId"]),
            "description": hero_album["description"][:220],
            "albumId": hero_album["id"],
            "artwork": hero_album["artwork"],
            "trackIds": hero_tracks,
            "accent": "#C4705F",
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(
        f"[catalog] wrote {len(artists)} artists, {len(albums)} albums, "
        f"{len(tracks)} tracks, {len(playlists)} playlists ({size_kb:.0f} KB)",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
