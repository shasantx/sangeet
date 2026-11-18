import { NextResponse } from "next/server";
import {
  extractYouTubeAudioStream,
  invalidateYouTubeStreamCache,
} from "@/lib/youtube-stream-extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function extensionForContentType(contentType: string): string {
  const lower = contentType.toLowerCase();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  if (lower.includes("ogg") || lower.includes("opus")) return "ogg";
  if (lower.includes("aac")) return "aac";
  return "m4a";
}

function sanitizeDownloadFilename(
  rawFilename: string | null,
  videoId: string,
  contentType: string,
): string {
  const ext = extensionForContentType(contentType);
  const cleaned = (rawFilename ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[\\/:*?"<>|;]+/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim();

  if (!cleaned) {
    return `sangeet-${videoId}.${ext}`;
  }

  const hasAudioExt = /\.(m4a|mp3|webm|ogg|opus|aac|mp4|wav|flac)$/i.test(cleaned);
  return hasAudioExt ? cleaned.slice(0, 140) : `${cleaned.slice(0, 130)}.${ext}`;
}

async function fetchUpstream(
  streamUrl: string,
  userAgent: string,
  rangeHeader: string | null,
  method: "GET" | "HEAD",
): Promise<Response> {
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: "*/*",
  };
  if (rangeHeader) {
    headers.Range = rangeHeader;
  }
  return fetch(streamUrl, {
    method,
    headers,
    signal: AbortSignal.timeout(45_000),
  });
}

async function handleAudioRequest(request: Request, method: "GET" | "HEAD") {
  const params = new URL(request.url).searchParams;
  const videoId = (params.get("videoId") || params.get("id") || "").trim();
  if (!videoId || videoId.startsWith("-") || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "invalid_videoId" }, { status: 400 });
  }

  const downloadParam = (params.get("download") || "").trim().toLowerCase();
  const isDownload = downloadParam === "1" || downloadParam === "true";
  const requestedFilename = params.get("filename");

  let extracted = await extractYouTubeAudioStream(videoId);
  if (!extracted) {
    return NextResponse.json({ error: "stream_unavailable" }, { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  let upstream = await fetchUpstream(extracted.streamUrl, extracted.userAgent, rangeHeader, method);

  // If cached/primary URL returned 403/410, cycle through remaining InnerTube clients.
  if (upstream.status === 403 || upstream.status === 410) {
    invalidateYouTubeStreamCache(videoId);
    const triedUserAgents = [extracted.userAgent];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const fallback = await extractYouTubeAudioStream(videoId, {
        bypassCache: true,
        excludeUserAgents: triedUserAgents,
      });
      if (!fallback) break;
      triedUserAgents.push(fallback.userAgent);
      upstream = await fetchUpstream(fallback.streamUrl, fallback.userAgent, rangeHeader, method);
      extracted = fallback;
      if (upstream.ok || upstream.status === 206) {
        break;
      }
      if (upstream.status !== 403 && upstream.status !== 410) {
        break;
      }
      invalidateYouTubeStreamCache(videoId);
    }
  }

  if (!upstream.ok && upstream.status !== 206) {
    invalidateYouTubeStreamCache(videoId);
    return NextResponse.json(
      { error: "upstream_failed", status: upstream.status },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type") || extracted.mimeType || "audio/mp4";
  responseHeaders.set("Content-Type", contentType);
  responseHeaders.set("Accept-Ranges", "bytes");
  responseHeaders.set("Cache-Control", "no-store");

  if (isDownload) {
    const safeFilename = sanitizeDownloadFilename(requestedFilename, videoId, contentType);
    responseHeaders.set("Content-Disposition", `attachment; filename="${safeFilename}"`);
  }

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) responseHeaders.set("Content-Length", contentLength);

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) responseHeaders.set("Content-Range", contentRange);

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  try {
    return await handleAudioRequest(request, "GET");
  } catch {
    return NextResponse.json({ error: "audio_proxy_failed" }, { status: 502 });
  }
}

export async function HEAD(request: Request) {
  try {
    return await handleAudioRequest(request, "HEAD");
  } catch {
    return NextResponse.json({ error: "audio_proxy_failed" }, { status: 502 });
  }
}
