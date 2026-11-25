import { NextRequest, NextResponse } from "next/server";

interface BucketEntry {
  timestamps: number[];
  lastSeen: number;
}

export interface RateLimitOptions {
  /** Namespace key for this route/endpoint (e.g. "music:search"). */
  key: string;
  /** Max requests allowed per IP within windowMs. */
  limit: number;
  /** Sliding window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const MAX_STORE_ENTRIES = 5_000;
const store = new Map<string, BucketEntry>();

export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && first.length <= 64) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && realIp.length <= 64) {
    return realIp;
  }

  return "unknown";
}

function pruneStore(now: number, maxAgeMs: number): void {
  if (store.size < MAX_STORE_ENTRIES) return;

  for (const [k, entry] of store.entries()) {
    if (now - entry.lastSeen > maxAgeMs) {
      store.delete(k);
    }
  }

  // Hard cap: evict oldest entries if still at capacity
  if (store.size >= MAX_STORE_ENTRIES) {
    const overflow = store.size - Math.floor(MAX_STORE_ENTRIES * 0.8);
    let removed = 0;
    for (const k of store.keys()) {
      store.delete(k);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const ip = getClientIp(request);
  const bucketKey = `${options.key}:${ip}`;

  pruneStore(now, Math.max(options.windowMs, 60_000));

  const existing = store.get(bucketKey);
  const timestamps = existing
    ? existing.timestamps.filter((ts) => ts > windowStart)
    : [];

  if (timestamps.length >= options.limit) {
    const oldest = timestamps[0] ?? now;
    const resetAt = oldest + options.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

    // Refresh insertion order for LRU behavior
    store.delete(bucketKey);
    store.set(bucketKey, { timestamps, lastSeen: now });

    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds
    };
  }

  timestamps.push(now);
  store.delete(bucketKey);
  store.set(bucketKey, { timestamps, lastSeen: now });

  const oldest = timestamps[0] ?? now;
  return {
    allowed: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - timestamps.length),
    resetAt: oldest + options.windowMs,
    retryAfterSeconds: 0
  };
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: "rate_limited",
      message: "Too many requests. Please slow down and try again shortly."
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        "Cache-Control": "no-store"
      }
    }
  );
}
