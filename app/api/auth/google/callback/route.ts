import { NextRequest, NextResponse } from "next/server";
import {
  appUrl,
  exchangeGoogleCode,
  oauthRedirectUri,
  safeReturnTo,
  secureCookies,
  signSession,
} from "@/lib/google-auth";

export const runtime = "nodejs";

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
  clearOAuthCookies(response, secure);
  return response;
}

export async function GET(request: NextRequest) {
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
  if (!state || !expectedState || state !== expectedState) return failureRedirect(base, returnTo, "state", secure);

  const providerError = request.nextUrl.searchParams.get("error");
  if (providerError) return failureRedirect(base, returnTo, "cancelled", secure);
  const code = request.nextUrl.searchParams.get("code");
  const nonce = request.cookies.get("aura_google_nonce")?.value;
  const verifier = request.cookies.get("aura_google_verifier")?.value;
  if (!code || !nonce || !verifier) return failureRedirect(base, returnTo, "response", secure);

  try {
    const identity = await exchangeGoogleCode(code, oauthRedirectUri(base), verifier, nonce);
    const sessionCookie = signSession({ ...identity, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 });
    const target = new URL(returnTo, base);
    target.searchParams.set("google", "success");
    const response = NextResponse.redirect(target);
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
