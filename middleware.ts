import { NextRequest, NextResponse } from "next/server";

const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]);
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BLOCKED_PATH_PATTERN = /^\/(\.env|\.git|\.svn|\.hg|wp-admin|wp-login|wp-content|phpmyadmin|pma|actuator|cgi-bin|vendor\/phpunit|boaform|HNAP1)/i;

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: data: https://*.audius.co https://api.audius.co https://*.googlevideo.com https://*.youtube.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com",
  "connect-src 'self' https://*.audius.co https://api.audius.co https://lrclib.net https://*.youtube.com https://*.googlevideo.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
].join("; ");

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CSP_DIRECTIVES);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set(
    "Permissions-Policy",
    "accelerometer=(), autoplay=(self), camera=(), cross-origin-isolated=(), display-capture=(), encrypted-media=(self), fullscreen=(self), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(self), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), browsing-topics=()",
  );
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

function isSameOriginMutation(request: NextRequest): boolean {
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const requestOrigin = request.nextUrl.origin;
    const configuredOrigin = process.env.APP_URL?.trim()
      ? new URL(process.env.APP_URL.trim()).origin
      : null;

    return originUrl.origin === requestOrigin || (configuredOrigin !== null && originUrl.origin === configuredOrigin);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Block non-standard HTTP verbs
  if (!ALLOWED_METHODS.has(request.method)) {
    return applySecurityHeaders(
      NextResponse.json({ error: "method_not_allowed" }, { status: 405 }),
    );
  }

  // 2. Block path traversal, null bytes, and common scanner probes
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return applySecurityHeaders(
      NextResponse.json({ error: "bad_request" }, { status: 400 }),
    );
  }

  if (
    decodedPath.includes("..") ||
    decodedPath.includes("\0") ||
    decodedPath.includes("\\") ||
    BLOCKED_PATH_PATTERN.test(decodedPath)
  ) {
    return applySecurityHeaders(new NextResponse(null, { status: 404 }));
  }

  // 3. Enforce CSRF / Same-Origin check on all state-changing API endpoints
  if (pathname.startsWith("/api/") && MUTATION_METHODS.has(request.method)) {
    if (!isSameOriginMutation(request)) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "forbidden", message: "Cross-origin state-changing requests are not permitted." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        ),
      );
    }
  }

  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|art/|audio/).*)",
  ],
};
