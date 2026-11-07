import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);
const streamCache = new Map<string, { at: number; data: { ok: boolean; streamUrl: string; duration?: number; title?: string } }>();

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

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const videoId = (params.get("videoId") || params.get("id") || "").trim();
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return NextResponse.json({ ok: false, error: "invalid_videoId" }, { status: 400 });
  }

  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.at < 3_600_000) {
    return NextResponse.json(cached.data);
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
            print(json.dumps({"ok": False, "error": "No stream url"}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;
    const { stdout } = await execFileAsync(pythonExe, ["-c", script, videoId], { timeout: 15000 });
    const trimmed = stdout.trim();
    const jsonStart = trimmed.indexOf("{");
    const jsonStr = jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed;
    const parsed = JSON.parse(jsonStr || "{}");
    if (parsed.ok && parsed.streamUrl) {
      streamCache.set(videoId, { at: Date.now(), data: parsed });
      return NextResponse.json(parsed);
    }
    return NextResponse.json(parsed, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to extract stream" },
      { status: 500 }
    );
  }
}
