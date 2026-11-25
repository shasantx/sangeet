import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const RANGE_PATTERN = /^bytes=\d*-\d*(,\s*\d*-\d*)*$/i;
const MAX_REDIRECTS = 3;

function sanitizeFilename(raw: string): string {
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*;]+/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  return cleaned || "sangeet-track";
}

function isSafePublicHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (
      !host ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.startsWith("[::1]") ||
      host.startsWith("[fc") ||
      host.startsWith("[fd") ||
      host.startsWith("[fe80:") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchWithSafeRedirects(
  initialUrl: string,
  method: "GET" | "HEAD",
  headers: Record<string, string>,
  signal: AbortSignal
): Promise<Response> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(currentUrl, {
      method,
      headers,
      redirect: "manual",
      cache: "no-store",
      signal
    });

    if (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location")
    ) {
      const nextUrl = new URL(
        response.headers.get("location")!,
        currentUrl
      ).toString();
      if (!isSafePublicHttpsUrl(nextUrl)) {
        throw new Error("Blocked unsafe redirect target");
      }
      currentUrl = nextUrl;
      continue;
    }

    return response;
  }
  throw new Error("Too many redirects");
}

async function proxyAudius(request: NextRequest, method: "GET" | "HEAD") {
  const rl = checkRateLimit(request, {
    key: "audius:stream",
    limit: 120,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const id = (request.nextUrl.searchParams.get("id") ?? "").trim();
  const wantsDownload = request.nextUrl.searchParams.get("download") === "1";
  const rawName = request.nextUrl.searchParams.get("name") ?? "";

  if (!ID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "invalid_id" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const upstreamHeaders: Record<string, string> = {
    Accept: "audio/*,*/*;q=0.8",
    "User-Agent": "Sangeet/2.3.0"
  };
  const range = request.headers.get("range")?.trim();
  if (range && range.length <= 64 && RANGE_PATTERN.test(range)) {
    upstreamHeaders.Range = range;
  }

  // Use a connect-only timeout and clear it once headers arrive so large audio files never abort mid-download.
  const controller = new AbortController();
  const connectTimeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const upstream = await fetchWithSafeRedirects(
      `https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream?app_name=Sangeet`,
      method,
      upstreamHeaders,
      controller.signal
    );

    clearTimeout(connectTimeout);

    if (upstream.status === 404) {
      return NextResponse.json(
        { error: "track_not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: "upstream_failed" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const headers = new Headers();
    const passThrough = ["content-length", "content-range", "accept-ranges"];
    for (const key of passThrough) {
      const val = upstream.headers.get(key);
      if (val) headers.set(key, val);
    }

    // Only allow safe audio or binary MIME types to prevent content-sniffing XSS
    const rawContentType = (upstream.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (
      rawContentType.startsWith("audio/") ||
      rawContentType === "application/octet-stream"
    ) {
      headers.set("content-type", rawContentType);
    } else {
      headers.set("content-type", "audio/mpeg");
    }

    if (wantsDownload) {
      const safe = sanitizeFilename(rawName);
      headers.set("Content-Disposition", `attachment; filename="${safe}.mp3"`);
    }
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "no-store");

    return new NextResponse(method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers
    });
  } catch {
    clearTimeout(connectTimeout);
    return NextResponse.json(
      { error: "stream_timeout" },
      { status: 504, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(request: NextRequest) {
  return proxyAudius(request, "GET");
}

export async function HEAD(request: NextRequest) {
  return proxyAudius(request, "HEAD");
}
