import { NextRequest, NextResponse } from "next/server";
import {
  appUrl,
  exchangeGoogleCodeWithTokens,
  oauthRedirectUri,
  safeReturnTo,
  sealYouTubeCookie,
  secureCookies,
  signSession,
} from "@/lib/google-auth";
import { isYouTubeTokenStorageConfigured, saveYouTubeTokens } from "@/lib/youtube-account";
import { getManagedUser, isAdminStorageConfigured } from "@/lib/admin-users";
import { getSiteSettings } from "@/lib/admin-settings";
import { isAdminEmail } from "@/lib/admin-auth";
import { enforceRateLimit, safeCompare } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJsonForInlineScript(value: string): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function androidHandoffHtml(deepLink: string, intentLink: string): string {
  const escapedDeepLink = escapeHtml(deepLink);
  const escapedIntentLink = escapeHtml(intentLink);
  const jsDeepLink = safeJsonForInlineScript(deepLink);
  const jsIntentLink = safeJsonForInlineScript(intentLink);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#080908">
  <title>Signed in to Sangeet</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(circle at top, #132217 0%, #080908 60%);
      color: #f4f7f5;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .card {
      width: 100%;
      max-width: 380px;
      background: rgba(18, 22, 19, 0.94);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 28px 24px;
      text-align: center;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
    }
    .badge {
      width: 52px;
      height: 52px;
      margin: 0 auto 16px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.16);
      border: 1px solid rgba(34, 197, 94, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #4ade80;
      font-size: 24px;
      font-weight: 700;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    p {
      margin: 0 0 22px;
      font-size: 14px;
      line-height: 1.5;
      color: #a3b1a7;
    }
    .primary {
      display: block;
      width: 100%;
      padding: 14px 18px;
      border-radius: 12px;
      background: #22c55e;
      color: #05130a;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      margin-bottom: 12px;
    }
    .secondary {
      display: inline-block;
      font-size: 13px;
      color: #93a398;
      text-decoration: underline;
      padding: 6px 8px;
    }
  </style>
</head>
<body>
  <main class="card">
    <div class="badge" aria-hidden="true">&#10003;</div>
    <h1>Signed in to Sangeet</h1>
    <p>Returning you to the Sangeet app. If it does not open automatically, tap the button below.</p>
    <a class="primary" href="${escapedDeepLink}">Open Sangeet App</a>
    <a class="secondary" href="${escapedIntentLink}">Try alternate app link</a>
  </main>
  <script>
    (function () {
      var deepLink = ${jsDeepLink};
      var intentLink = ${jsIntentLink};
      try {
        window.location.replace(deepLink);
      } catch (e) {}
      setTimeout(function () {
        if (!document.hidden) {
          try {
            window.location.replace(intentLink);
          } catch (e) {}
        }
      }, 450);
    })();
  </script>
</body>
</html>`;
}

function clearOAuthCookies(response: NextResponse, secure: boolean) {
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth/google/callback", maxAge: 0 };
  for (const name of ["aura_google_state", "aura_google_nonce", "aura_google_verifier", "aura_google_return", "aura_google_app"]) {
    response.cookies.set(name, "", options);
  }
}

function failureRedirect(base: URL, returnTo: string, reason: string, secure: boolean) {
  const target = new URL(returnTo, base);
  target.searchParams.set("google", "error");
  target.searchParams.set("reason", reason);
  const response = NextResponse.redirect(target);
  response.headers.set("cache-control", "no-store");
  clearOAuthCookies(response, secure);
  return response;
}

export async function GET(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "auth:google:callback", 20, 60_000);
  if (rateLimited) return rateLimited;

  let base: URL;
  try {
    base = appUrl(request.url);
  } catch {
    return NextResponse.redirect(new URL("/auth?google=error&reason=configuration", request.url));
  }
  const secure = secureCookies(base);
  const returnTo = safeReturnTo(request.cookies.get("aura_google_return")?.value ?? null, base);
  const appTarget = request.cookies.get("aura_google_app")?.value;
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("aura_google_state")?.value;
  if (!safeCompare(state, expectedState)) return failureRedirect(base, returnTo, "state", secure);

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return failureRedirect(base, returnTo, "cancelled", secure);
  const code = request.nextUrl.searchParams.get("code");
  const nonce = request.cookies.get("aura_google_nonce")?.value;
  const verifier = request.cookies.get("aura_google_verifier")?.value;
  if (!code || !nonce || !verifier || code.length > 512) return failureRedirect(base, returnTo, "response", secure);

  try {
    const tokenResult = await exchangeGoogleCodeWithTokens(code, oauthRedirectUri(base), verifier, nonce);
    const { identity, accessToken, refreshToken, expiresIn, scopes } = tokenResult;
    const hasYouTubeScope = scopes.includes("https://www.googleapis.com/auth/youtube.readonly");
    if (isAdminStorageConfigured()) {
      let signupEnabled = true;
      try {
        const settings = await getSiteSettings();
        signupEnabled = settings.signup_enabled;
      } catch (error) {
        const missingSettingsMigration = error instanceof Error && (error.message.includes("404") || error.message.includes("migration"));
        if (!missingSettingsMigration) return failureRedirect(base, returnTo, "provider_unavailable", secure);
      }
      try {
        const existing = await getManagedUser(`google:${identity.sub}`);
        if (existing?.status === "suspended") {
          return failureRedirect(base, returnTo, "suspended", secure);
        }
        if (!signupEnabled && !existing && !isAdminEmail(identity.email)) {
          return failureRedirect(base, returnTo, "signups_closed", secure);
        }
      } catch {
        if (!signupEnabled) {
          return failureRedirect(base, returnTo, "provider_unavailable", secure);
        }
      }
    }
    if (hasYouTubeScope && accessToken && refreshToken && isYouTubeTokenStorageConfigured()) {
      try {
        await saveYouTubeTokens(
          `google:${identity.sub}`,
          {
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: Date.now() + expiresIn * 1000,
          },
          ["https://www.googleapis.com/auth/youtube.readonly"],
        );
      } catch {
        // Non-blocking: cookie fallback still enables YouTube feed for this session.
      }
    }
    const ytCookie =
      hasYouTubeScope && accessToken
        ? sealYouTubeCookie({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: Date.now() + expiresIn * 1000,
          })
        : null;
    const sessionCookie = signSession({ ...identity, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 });
    if (appTarget === "android") {
      const query = `session=${encodeURIComponent(sessionCookie)}&returnTo=${encodeURIComponent(returnTo)}${
        ytCookie ? `&yt=${encodeURIComponent(ytCookie)}` : ""
      }`;
      const deepLink = `sangeet://auth?${query}`;
      const intentLink = `intent://auth?${query}#Intent;scheme=sangeet;package=xyz.shasant.sangeet;end`;
      const response = new NextResponse(androidHandoffHtml(deepLink, intentLink), {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
      if (ytCookie) {
        response.cookies.set("sangeet_yt_oauth", ytCookie, {
          httpOnly: true,
          secure,
          sameSite: "lax",
          path: "/",
          maxAge: 7 * 24 * 60 * 60,
        });
      }
      clearOAuthCookies(response, secure);
      return response;
    }
    const target = new URL(returnTo, base);
    target.searchParams.set("google", "success");
    const response = NextResponse.redirect(target);
    response.headers.set("cache-control", "no-store");
    response.cookies.set("aura_session", sessionCookie, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    if (ytCookie) {
      response.cookies.set("sangeet_yt_oauth", ytCookie, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }
    clearOAuthCookies(response, secure);
    return response;
  } catch {
    return failureRedirect(base, returnTo, "verification", secure);
  }
}
