import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface ExtractedAudioStream {
  streamUrl: string;
  mimeType: string;
  duration?: number;
  title?: string;
  userAgent: string;
}

interface CacheEntry {
  at: number;
  data: ExtractedAudioStream;
}

const STREAM_CACHE_TTL_MS = 45 * 60 * 1000;
const streamCache = new Map<string, CacheEntry>();

let cachedVisitorData: { value: string; at: number } | null = null;

const VISIONOS_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15";
const ANDROID_VR_UA =
  "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip";

export function isAllowedStreamUrl(candidate: unknown): candidate is string {
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

export function invalidateYouTubeStreamCache(videoId: string): void {
  streamCache.delete(videoId);
}

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

interface InnerTubeFormat {
  url?: string;
  mimeType?: string;
  bitrate?: number;
}

async function getVisitorData(): Promise<string> {
  if (process.env.YOUTUBE_VISITOR_DATA) {
    return process.env.YOUTUBE_VISITOR_DATA;
  }
  if (cachedVisitorData && Date.now() - cachedVisitorData.at < 30 * 60 * 1000) {
    return cachedVisitorData.value;
  }
  try {
    const sw = await fetch("https://www.youtube.com/sw.js_data", {
      headers: { "User-Agent": VISIONOS_UA },
      signal: AbortSignal.timeout(5_000),
    });
    if (sw.ok) {
      const text = await sw.text();
      const match = text.match(/"(Cg[A-Za-z0-9_\-=%+/]{10,})"/);
      if (match?.[1]) {
        cachedVisitorData = { value: match[1], at: Date.now() };
        return match[1];
      }
    }
  } catch {
    // Ignore visitorData fetch failures.
  }
  return "";
}

async function tryInnerTubeClient(
  videoId: string,
  userAgent: string,
  clientContext: Record<string, unknown>,
  visitorData: string,
): Promise<ExtractedAudioStream | null> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": userAgent,
  };
  if (visitorData) {
    headers["X-Goog-Visitor-Id"] = visitorData;
  }

  const response = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers,
    body: JSON.stringify({
      context: {
        client: {
          ...clientContext,
          hl: "en",
          gl: "US",
          ...(visitorData ? { visitorData } : {}),
        },
      },
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as {
    playabilityStatus?: { status?: string };
    videoDetails?: { lengthSeconds?: string; title?: string };
    streamingData?: { adaptiveFormats?: InnerTubeFormat[] };
  };

  if (payload.playabilityStatus?.status !== "OK") return null;

  const adaptive = payload.streamingData?.adaptiveFormats ?? [];
  const audioFormats = adaptive.filter(
    (fmt) => fmt.mimeType?.startsWith("audio/") && isAllowedStreamUrl(fmt.url),
  );

  const mp4Formats = audioFormats
    .filter((fmt) => fmt.mimeType?.includes("audio/mp4"))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

  const webmFormats = audioFormats
    .filter((fmt) => fmt.mimeType?.includes("audio/webm"))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

  const chosen = mp4Formats[0] ?? webmFormats[0];
  if (!chosen || !isAllowedStreamUrl(chosen.url)) return null;

  const rawDuration = Number(payload.videoDetails?.lengthSeconds);
  const duration =
    Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(86400, rawDuration) : undefined;

  return {
    streamUrl: chosen.url,
    mimeType: chosen.mimeType?.split(";")[0]?.trim() || "audio/mp4",
    duration,
    title:
      typeof payload.videoDetails?.title === "string"
        ? payload.videoDetails.title.slice(0, 180)
        : undefined,
    userAgent,
  };
}

async function extractViaInnerTube(videoId: string): Promise<ExtractedAudioStream | null> {
  const visitorData = await getVisitorData();

  const visionOs = await tryInnerTubeClient(
    videoId,
    VISIONOS_UA,
    {
      clientName: "VISIONOS",
      clientVersion: "1.02",
      deviceMake: "Apple",
      deviceModel: "RealityDevice17,1",
      osName: "visionOS",
      osVersion: "26.5.23O471",
    },
    visitorData,
  ).catch(() => null);
  if (visionOs) return visionOs;

  return tryInnerTubeClient(
    videoId,
    ANDROID_VR_UA,
    {
      clientName: "ANDROID_VR",
      clientVersion: "1.65.10",
      deviceMake: "Oculus",
      deviceModel: "Quest 3",
      androidSdkVersion: 32,
      osName: "Android",
      osVersion: "12L",
    },
    visitorData,
  ).catch(() => null);
}

async function extractViaYtDlp(videoId: string): Promise<ExtractedAudioStream | null> {
  if (process.env.VERCEL) return null;
  const pythonExe = findPythonExe();
  const script = `
import json, sys
try:
    import yt_dlp
    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio/best',
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
                "ext": info.get("ext"),
                "duration": info.get("duration"),
                "title": info.get("title")
            }))
        else:
            print(json.dumps({"ok": False}))
except Exception:
    print(json.dumps({"ok": False}))
`;
  try {
    const { stdout } = await execFileAsync(pythonExe, ["-c", script, videoId], { timeout: 15_000 });
    const trimmed = stdout.trim();
    const jsonStart = trimmed.indexOf("{");
    const parsed = JSON.parse(jsonStart >= 0 ? trimmed.slice(jsonStart) : trimmed) as {
      ok?: boolean;
      streamUrl?: unknown;
      ext?: string;
      duration?: unknown;
      title?: unknown;
    };
    if (!parsed.ok || !isAllowedStreamUrl(parsed.streamUrl)) return null;
    const mimeType = parsed.ext === "webm" ? "audio/webm" : "audio/mp4";
    return {
      streamUrl: parsed.streamUrl,
      mimeType,
      duration: Number.isFinite(parsed.duration)
        ? Math.max(0, Math.min(86400, Number(parsed.duration)))
        : undefined,
      title: typeof parsed.title === "string" ? parsed.title.slice(0, 180) : undefined,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };
  } catch {
    return null;
  }
}

export async function extractYouTubeAudioStream(
  videoId: string,
  options?: { bypassCache?: boolean },
): Promise<ExtractedAudioStream | null> {
  if (!options?.bypassCache) {
    const cached = streamCache.get(videoId);
    if (cached && Date.now() - cached.at < STREAM_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  let extracted = await extractViaInnerTube(videoId).catch(() => null);
  if (!extracted) {
    extracted = await extractViaYtDlp(videoId).catch(() => null);
  }
  if (!extracted) return null;

  streamCache.set(videoId, { at: Date.now(), data: extracted });
  if (streamCache.size > 300) {
    const oldest = streamCache.keys().next().value;
    if (oldest) streamCache.delete(oldest);
  }
  return extracted;
}
