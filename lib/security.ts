import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Constant-time string comparison using SHA-256 digests so neither string
 * content nor string length can leak via timing side-channels.
 */
export function safeCompare(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;
  const hashA = createHash("sha256").update(a, "utf8").digest();
  const hashB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(hashA, hashB) && a.length === b.length;
}

/**
 * Extract client IP address from trusted platform headers.
 */
export function getClientIp(request: Request): string {
  const headers = request.headers;
  const ip =
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1";
  return ip.slice(0, 64);
}

interface RateBucket {
  start: number;
  count: number;
}

const MAX_RATE_KEYS = 10_000;
const rateWindows = new Map<string, RateBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Bounded in-memory rate limiter per IP and route bucket.
 */
export function checkRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs = 60_000,
): RateLimitResult {
  const now = Date.now();
  const key = `${bucket}:${getClientIp(request)}`;
  const existing = rateWindows.get(key);

  if (!existing || now - existing.start >= windowMs) {
    if (rateWindows.size >= MAX_RATE_KEYS) {
      // Evict expired windows first; if still full, evict oldest key
      for (const [k, v] of rateWindows) {
        if (now - v.start >= windowMs) rateWindows.delete(k);
        if (rateWindows.size < MAX_RATE_KEYS * 0.8) break;
      }
      if (rateWindows.size >= MAX_RATE_KEYS) {
        const oldestKey = rateWindows.keys().next().value;
        if (oldestKey) rateWindows.delete(oldestKey);
      }
    }
    rateWindows.set(key, { start: now, count: 1 });
    return {
      allowed: true,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.start + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.ceil((existing.start + windowMs - now) / 1000),
  };
}

/**
 * Returns a 429 NextResponse if the rate limit is exceeded, or null if allowed.
 */
export function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs = 60_000,
): NextResponse | null {
  const result = checkRateLimit(request, bucket, limit, windowMs);
  if (!result.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please slow down." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  return null;
}

/**
 * Strict CSRF / Same-Origin validation for state-changing requests (POST, PUT, PATCH, DELETE).
 * Checks both Origin and Sec-Fetch-Site headers.
 */
export function verifySameOrigin(request: Request): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return false;
  }

  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    return false;
  }

  try {
    const originUrl = new URL(originHeader);
    const requestOrigin = new URL(request.url).origin;
    const configuredOrigin = process.env.APP_URL?.trim()
      ? new URL(process.env.APP_URL.trim()).origin
      : null;

    return originUrl.origin === requestOrigin || (configuredOrigin !== null && originUrl.origin === configuredOrigin);
  } catch {
    return false;
  }
}

/**
 * Safely parse a JSON request body with a strict byte limit and prototype-pollution protection.
 */
export async function safeJsonParse<T = Record<string, unknown>>(
  request: Request,
  maxBytes = 65_536,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, error: "Unsupported Content-Type; expected application/json.", status: 415 };
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false, error: "Payload too large.", status: 413 };
  }

  try {
    const rawText = await request.text();
    if (Buffer.byteLength(rawText, "utf8") > maxBytes) {
      return { ok: false, error: "Payload too large.", status: 413 };
    }

    const parsed = JSON.parse(rawText, (key, value) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return undefined;
      }
      return value;
    }) as T;

    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "Invalid JSON object.", status: 400 };
    }

    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: "Malformed JSON body.", status: 400 };
  }
}

/**
 * Sanitize a relative return path to prevent open redirects and protocol-relative redirects.
 */
export function sanitizeReturnPath(value: string | null | undefined, fallback = "/home"): string {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return fallback;
  }
  try {
    const base = new URL("https://sangeet.local");
    const parsed = new URL(trimmed, base);
    if (parsed.origin !== base.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
