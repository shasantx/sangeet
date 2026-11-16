import { NextResponse } from "next/server";
import {
  extractYouTubeAudioStream,
  invalidateYouTubeStreamCache,
} from "@/lib/youtube-stream-extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    signal: AbortSignal.timeout(20_000),
  });
}

async function handleAudioRequest(request: Request, method: "GET" | "HEAD") {
  const params = new URL(request.url).searchParams;
  const videoId = (params.get("videoId") || params.get("id") || "").trim();
  if (!videoId || videoId.startsWith("-") || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: "invalid_videoId" }, { status: 400 });
  }

  let extracted = await extractYouTubeAudioStream(videoId);
  if (!extracted) {
    return NextResponse.json({ error: "stream_unavailable" }, { status: 404 });
  }

  const rangeHeader = request.headers.get("range");
  let upstream = await fetchUpstream(extracted.streamUrl, extracted.userAgent, rangeHeader, method);

  // If cached URL expired (403/410), re-extract once and retry.
  if (upstream.status === 403 || upstream.status === 410) {
    invalidateYouTubeStreamCache(videoId);
    extracted = await extractYouTubeAudioStream(videoId, { bypassCache: true });
    if (!extracted) {
      return NextResponse.json({ error: "stream_unavailable" }, { status: 404 });
    }
    upstream = await fetchUpstream(extracted.streamUrl, extracted.userAgent, rangeHeader, method);
  }

  if (!upstream.ok && upstream.status !== 206) {
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
