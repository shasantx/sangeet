import { NextRequest, NextResponse } from "next/server";
import {
  appUrl,
  exchangeGoogleCode,
  oauthRedirectUri,
  safeReturnTo,
  secureCookies,
  signSession,
} from "@/lib/google-auth";
import { getManagedUser, isAdminStorageConfigured } from "@/lib/admin-users";
import { getSiteSettings } from "@/lib/admin-settings";
import { isAdminEmail } from "@/lib/admin-auth";
import { enforceRateLimit, safeCompare } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearOAuthCookies(response: NextResponse, secure: boolean) {
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/auth/google/callback", maxAge: 0 };
  for (const name of ["aura_google_state", "aura_google_nonce", "aura_google_verifier", "aura_google_return"]) {
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
    const identity = await exchangeGoogleCode(code, oauthRedirectUri(base), verifier, nonce);
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
    const sessionCookie = signSession({ ...identity, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 });
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
    clearOAuthCookies(response, secure);
    return response;
  } catch {
    return failureRedirect(base, returnTo, "verification", secure);
  }
}
