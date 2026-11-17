import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

async function handleAudiusStream(request: Request, method: "GET" | "HEAD") {
  const id = (new URL(request.url).searchParams.get("id") ?? "").trim();
  if (!ID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "invalid_id" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const upstreamHeaders: Record<string, string> = {
    Accept: "audio/*,*/*;q=0.8",
  };
  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    upstreamHeaders.Range = rangeHeader;
  }

  const upstreamUrl = `https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream`;
  const upstream = await fetch(upstreamUrl, {
    method,
    headers: upstreamHeaders,
    redirect: "follow",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  if (upstream.status === 404) {
    return NextResponse.json(
      { error: "track_not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: "upstream_failed", status: upstream.status },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const responseHeaders = new Headers();
  responseHeaders.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
  responseHeaders.set("Accept-Ranges", upstream.headers.get("accept-ranges") || "bytes");
  responseHeaders.set("Cache-Control", "no-store");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) {
    responseHeaders.set("Content-Length", contentLength);
  }

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) {
    responseHeaders.set("Content-Range", contentRange);
  }

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request) {
  try {
    return await handleAudiusStream(request, "GET");
  } catch {
    return NextResponse.json(
      { error: "audius_stream_failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function HEAD(request: Request) {
  try {
    return await handleAudiusStream(request, "HEAD");
  } catch {
    return NextResponse.json(
      { error: "audius_stream_failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
