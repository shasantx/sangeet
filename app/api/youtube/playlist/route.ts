import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const serviceUrl = process.env.YTMUSIC_SERVICE_URL ?? (process.env.VERCEL ? "" : "http://127.0.0.1:8765");
const cache = new Map<string, { at: number; data: unknown }>();

function findPythonExe(): string {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  const localVenv = path.join(process.cwd(), ".venv-ytm", process.platform === "win32" ? "Scripts\\python.exe" : "bin/python");
  if (process.platform === "win32") {
    const knownCore = "C:\\Users\\shasa\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe";
    try {
      const fs = require("fs");
      if (fs.existsSync(localVenv)) return localVenv;
      if (fs.existsSync(knownCore)) return knownCore;
    } catch {}
    return "py";
  }
  return "python3";
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

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = (params.get("id") || params.get("playlistId") || "").trim();
  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const cleanId = id.replace(/^ytm-/, "");
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
        const data = await res.json();
        cache.set(cleanId, { at: Date.now(), data });
        return NextResponse.json(data);
      }
    } catch {}
  }

  // 2. Direct Python fallback
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
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;
    const { stdout } = await execFileAsync(pythonExe, ["-c", script, cleanId], { timeout: 12000 });
    const trimmed = stdout.trim();
    const jsonStart = trimmed.indexOf("{");
    const jsonStr = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;
    const parsed = JSON.parse(jsonStr || "{}");
    if (parsed.ok) {
      cache.set(cleanId, { at: Date.now(), data: parsed });
      return NextResponse.json(parsed);
    }
  } catch {}

  return NextResponse.json({ error: "playlist_unavailable" }, { status: 502 });
}
