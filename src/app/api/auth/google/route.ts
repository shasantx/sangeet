import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  createOAuthState,
  getOAuthStateCookieOptions,
  isGoogleOAuthConfigured,
  sanitizeReturnTo
} from "@/lib/auth-session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "auth:google",
    limit: 20,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(
      new URL("/auth?error=google_not_configured", request.url),
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const origin = process.env.APP_URL || request.nextUrl.origin;
  const redirectUri = `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
  const isAndroidApp =
    request.nextUrl.searchParams.get("app") === "android" ||
    /SangeetAndroid/i.test(request.headers.get("user-agent") ?? "");

  const returnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("returnTo"),
    isAndroidApp ? "/home?google=success" : "/home"
  );

  // Bind CSRF nonce in signed state token and HttpOnly cookie (encodes android vs web target)
  const { state, nonce } = createOAuthState({
    android: isAndroidApp,
    returnTo
  });

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state
  });

  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    { headers: { "Cache-Control": "no-store" } }
  );
  res.cookies.set(OAUTH_STATE_COOKIE, nonce, getOAuthStateCookieOptions());
  return res;
}
