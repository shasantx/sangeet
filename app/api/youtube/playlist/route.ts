import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const serviceUrl = process.env.YTMUSIC_SERVICE_URL ?? (process.env.VERCEL ? "" : "http://127.0.0.1:8765");
const cache = new Map<string, { at: number; data: unknown }>();

function findPythonExe(): string {
  const localVenv = path.join(
    process.cwd(),
    ".venv-ytm",
    process.platform === "win32" ? "Scripts\\python.exe" : "bin/python",
  );
  if (fs.existsSync(localVenv)) return localVenv;
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }
  return process.platform === "win32" ? "py" : "python3";
}

function safeThumb(url: unknown) {
  if (typeof url !== "string") return "";
  try {
    const parsed = new URL(url);
    const valid =
      parsed.hostname.endsWith(".googleusercontent.com") ||
      parsed.hostname.endsWith(".ggpht.com") ||
      parsed.hostname.endsWith(".ytimg.com") ||
      parsed.hostname.endsWith(".youtube.com");
    return parsed.protocol === "https:" && valid ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function sanitizePlaylistPayload(raw: unknown, fallbackId: string) {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;
  const pl = (root.playlist && typeof root.playlist === "object" ? root.playlist : root) as Record<string, unknown>;
  const rawTracks = Array.isArray(pl.tracks) ? pl.tracks : [];
  const tracks = rawTracks
    .flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const t = item as Record<string, unknown>;
      if (typeof t.videoId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(t.videoId)) return [];
      return [
        {
          videoId: t.videoId,
          title: typeof t.title === "string" ? t.title.slice(0, 180) : "Untitled",
          artist: typeof t.artist === "string" ? t.artist.slice(0, 140) : "YouTube Music",
          durationSeconds: Number.isFinite(t.durationSeconds) ? Math.max(0, Math.min(86400, Number(t.durationSeconds))) : 0,
          thumbnail: safeThumb(t.thumbnail) || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
        },
      ];
    })
    .slice(0, 100);

  return {
    ok: true,
    playlist: {
      id: fallbackId,
      title: typeof pl.title === "string" ? pl.title.slice(0, 180) : "Playlist",
      description: typeof pl.description === "string" ? pl.description.slice(0, 1200) : "",
      author: typeof pl.author === "string" ? pl.author.slice(0, 140) : "YouTube Music",
      thumbnail: safeThumb(pl.thumbnail),
      trackCount: tracks.length,
      tracks,
    },
  };
}

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "youtube:playlist", 30, 60_000);
  if (rateLimited) return rateLimited;

  const params = new URL(request.url).searchParams;
  const id = (params.get("id") || params.get("playlistId") || "").trim();
  const cleanId = id.replace(/^ytm-/, "");

  // Strict validation: must be alphanumeric/underscore/dash, 2..100 chars, and not start with '-'
  if (!cleanId || cleanId.startsWith("-") || !/^[A-Za-z0-9_-]{2,100}$/.test(cleanId)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const cached = cache.get(cleanId);
  if (cached && Date.now() - cached.at < 600_000) {
    return NextResponse.json(cached.data);
  }

  // 1. Try service URL
  if (serviceUrl) {
    try {
      const res = await fetch(`${serviceUrl.replace(/\/$/, "")}/api/playlist?id=${encodeURIComponent(cleanId)}`, {
        headers: process.env.YTMUSIC_SERVICE_TOKEN ? { authorization: `Bearer ${process.env.YTMUSIC_SERVICE_TOKEN}` } : undefined,
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const rawData = await res.json();
        const sanitized = sanitizePlaylistPayload(rawData, cleanId);
        if (sanitized) {
          cache.set(cleanId, { at: Date.now(), data: sanitized });
          if (cache.size > 250) cache.delete(cache.keys().next().value!);
          return NextResponse.json(sanitized);
        }
      }
    } catch {}
  }

  // 2. Direct Python fallback (local dev only)
  if (!process.env.VERCEL) {
    try {
      const pythonExe = findPythonExe();
      const script = `
import json, sys
from ytmusicapi import YTMusic

def get_thumb(item):
    thumbs = item.get("thumbnails") or []
    if thumbs:
        largest = max(thumbs, key=lambda t: t.get("width") or 0)
        return largest.get("url") or ""
    return ""

try:
    yt = YTMusic()
    clean_id = sys.argv[1].replace("VL", "")
    try:
        data = yt.get_playlist(clean_id, limit=100)
    except Exception:
        data = yt.get_playlist("VL" + clean_id, limit=100)
        
    author = data.get("author") or {}
    author_name = author.get("name") if isinstance(author, dict) else str(author or "YouTube Music")
    tracks = []
    cover = get_thumb(data)
    for t in data.get("tracks") or []:
        vid = t.get("videoId")
        if not vid:
            continue
        art = ", ".join([a.get("name") for a in (t.get("artists") or []) if a.get("name")]) or author_name
        thumb = get_thumb(t) or cover or f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
        tracks.append({
            "videoId": vid,
            "title": t.get("title") or "Untitled",
            "artist": art,
            "durationSeconds": t.get("duration_seconds") or 0,
            "thumbnail": thumb
        })
    result = {
        "ok": True,
        "playlist": {
            "id": sys.argv[1],
            "title": data.get("title") or "Playlist",
            "description": data.get("description") or "",
            "author": author_name,
            "thumbnail": cover,
            "trackCount": len(tracks),
            "tracks": tracks
        }
    }
    print(json.dumps(result))
except Exception:
    print(json.dumps({"ok": False, "error": "playlist_unavailable"}))
`;
      const { stdout } = await execFileAsync(pythonExe, ["-c", script, cleanId], { timeout: 12000 });
      const trimmed = stdout.trim();
      const jsonStart = trimmed.indexOf("{");
      const jsonStr = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;
      const parsed = JSON.parse(jsonStr || "{}") as { ok?: boolean };
      if (parsed.ok) {
        const sanitized = sanitizePlaylistPayload(parsed, cleanId);
        if (sanitized) {
          cache.set(cleanId, { at: Date.now(), data: sanitized });
          if (cache.size > 250) cache.delete(cache.keys().next().value!);
          return NextResponse.json(sanitized);
        }
      }
    } catch {}
  }

  return NextResponse.json({ error: "playlist_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
}
