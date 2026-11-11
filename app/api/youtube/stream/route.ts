import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const streamCache = new Map<string, { at: number; data: { ok: boolean; streamUrl: string; duration?: number; title?: string } }>();

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

function isAllowedStreamUrl(candidate: unknown): candidate is string {
  if (typeof candidate !== "string") return false;
  try {
    const parsed = new URL(candidate);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      (parsed.hostname.endsWith(".googlevideo.com") || parsed.hostname.endsWith(".youtube.com"))
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const rateLimited = enforceRateLimit(request, "youtube:stream", 20, 60_000);
  if (rateLimited) return rateLimited;

  const params = new URL(request.url).searchParams;
  const videoId = (params.get("videoId") || params.get("id") || "").trim();
  if (!videoId || videoId.startsWith("-") || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ ok: false, error: "invalid_videoId" }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.at < 3_600_000) {
    return NextResponse.json(cached.data);
  }

  if (process.env.VERCEL) {
    return NextResponse.json({ ok: false, error: "stream_unavailable" }, { status: 404, headers: { "cache-control": "no-store" } });
  }

  try {
    const pythonExe = findPythonExe();
    const script = `
import json, sys
try:
    import yt_dlp
    ydl_opts = {
        'format': 'bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info("https://www.youtube.com/watch?v=" + sys.argv[1], download=False)
        stream_url = info.get("url")
        if stream_url:
            print(json.dumps({
                "ok": True,
                "streamUrl": stream_url,
                "duration": info.get("duration"),
                "title": info.get("title")
            }))
        else:
            print(json.dumps({"ok": False, "error": "stream_unavailable"}))
except Exception:
    print(json.dumps({"ok": False, "error": "stream_unavailable"}))
`;
    const { stdout } = await execFileAsync(pythonExe, ["-c", script, videoId], { timeout: 15000 });
    const trimmed = stdout.trim();
    const jsonStart = trimmed.indexOf("{");
    const jsonStr = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;
    const parsed = JSON.parse(jsonStr || "{}") as {
      ok?: boolean;
      streamUrl?: unknown;
      duration?: unknown;
      title?: unknown;
    };
    if (parsed.ok && isAllowedStreamUrl(parsed.streamUrl)) {
      const safePayload = {
        ok: true,
        streamUrl: parsed.streamUrl,
        duration: Number.isFinite(parsed.duration) ? Math.max(0, Math.min(86400, Number(parsed.duration))) : undefined,
        title: typeof parsed.title === "string" ? parsed.title.slice(0, 180) : undefined,
      };
      streamCache.set(videoId, { at: Date.now(), data: safePayload });
      if (streamCache.size > 300) {
        const oldest = streamCache.keys().next().value;
        if (oldest) streamCache.delete(oldest);
      }
      return NextResponse.json(safePayload, { headers: { "cache-control": "private, max-age=300" } });
    }
    return NextResponse.json({ ok: false, error: "stream_unavailable" }, { status: 404, headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ok: false, error: "stream_extraction_failed" },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
