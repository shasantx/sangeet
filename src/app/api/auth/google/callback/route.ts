import { NextRequest, NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  getOAuthStateCookieOptions,
  getSessionCookieOptions,
  isGoogleOAuthConfigured,
  sanitizeReturnTo,
  signSession,
  verifyOAuthState
} from "@/lib/auth-session";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function redirectWithClearedState(url: URL): NextResponse {
  const res = NextResponse.redirect(url, {
    headers: { "Cache-Control": "no-store" }
  });
  res.cookies.set(OAUTH_STATE_COOKIE, "", getOAuthStateCookieOptions(0));
  return res;
}

export async function GET(request: NextRequest) {
  const rl = checkRateLimit(request, {
    key: "auth:google:callback",
    limit: 20,
    windowMs: 60_000
  });
  if (!rl.allowed) return rateLimitResponse(rl);

  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const stateParam = request.nextUrl.searchParams.get("state");
  const cookieNonce = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (oauthError || !code || code.length > 2048 || !isGoogleOAuthConfigured()) {
    return redirectWithClearedState(
      new URL("/auth?error=oauth_failed", request.url)
    );
  }

  // Verify signed OAuth state and double-submit CSRF nonce cookie
  const verifiedState = verifyOAuthState(stateParam, cookieNonce);
  if (!verifiedState) {
    return redirectWithClearedState(
      new URL("/auth?error=invalid_state", request.url)
    );
  }

  const isAndroidApp = verifiedState.android;
  const safeReturnTo = sanitizeReturnTo(
    verifiedState.returnTo,
    isAndroidApp ? "/home?google=success" : "/home"
  );

  const origin = process.env.APP_URL || request.nextUrl.origin;
  const redirectUri = `${origin.replace(/\/$/, "")}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });

    if (!tokenRes.ok) {
      return redirectWithClearedState(
        new URL("/auth?error=token_exchange", request.url)
      );
    }

    const tokens = await tokenRes.json();
    if (typeof tokens?.access_token !== "string" || !tokens.access_token) {
      return redirectWithClearedState(
        new URL("/auth?error=token_exchange", request.url)
      );
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000)
      }
    );

    if (!profileRes.ok) {
      return redirectWithClearedState(
        new URL("/auth?error=profile_fetch", request.url)
      );
    }

    const profile = await profileRes.json();
    const profileId = String(profile?.id || profile?.email || "").trim();
    if (!profileId) {
      return redirectWithClearedState(
        new URL("/auth?error=profile_fetch", request.url)
      );
    }

    const avatarUrl =
      typeof profile?.picture === "string" &&
      profile.picture.startsWith("https://")
        ? profile.picture
        : undefined;

    const token = signSession({
      id: profileId.slice(0, 128),
      name: String(profile?.name || "Dhun Listener").slice(0, 120),
      email:
        typeof profile?.email === "string"
          ? profile.email.slice(0, 254)
          : undefined,
      avatar: avatarUrl,
      mode: "google",
      exp: Date.now() + 1000 * 60 * 60 * 24 * 14
    });

    const cookieOptions = getSessionCookieOptions();

    // Redirect back directly into the native Sangeet Android APK via custom scheme deep link
    if (isAndroidApp) {
      const deepLink = `sangeet://auth?session=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(safeReturnTo)}`;
      const escapedHref = deepLink
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const safeJsDeepLink = JSON.stringify(deepLink).replace(/</g, "\\u003c");
      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="0;url=${escapedHref}" />
  <title>Returning to Dhun</title>
  <style>
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0d0c0b; color:#f5f3f1; font-family:system-ui,-apple-system,sans-serif; padding:24px; text-align:center; }
    .card { max-width:340px; width:100%; background:#1a0f0f; border:1px solid rgba(245,196,81,0.12); border-radius:16px; padding:24px; }
    .btn { display:inline-block; margin-top:16px; padding:12px 24px; border-radius:999px; background:#e2363e; color:#ffffff; font-weight:600; font-size:14px; text-decoration:none; }
    p { margin:8px 0 0; color:#a8a29e; font-size:13px; }
  </style>
</head>
<body>
  <div class="card">
    <h1 style="margin:0;font-size:18px;font-weight:600;">Signed in to Dhun</h1>
    <p>Returning to the Dhun Android app...</p>
    <a class="btn" href="${escapedHref}">Open Dhun App</a>
  </div>
  <script>window.location.replace(${safeJsDeepLink});</script>
</body>
</html>`;

      const res = new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
      res.cookies.set(SESSION_COOKIE, token, cookieOptions);
      res.cookies.set(OAUTH_STATE_COOKIE, "", getOAuthStateCookieOptions(0));
      return res;
    }

    const res = NextResponse.redirect(new URL(safeReturnTo, request.url), {
      headers: { "Cache-Control": "no-store" }
    });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    res.cookies.set(OAUTH_STATE_COOKIE, "", getOAuthStateCookieOptions(0));
    return res;
  } catch {
    return redirectWithClearedState(
      new URL("/auth?error=oauth_exception", request.url)
    );
  }
}
