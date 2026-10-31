import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  appUrl,
  googleAuthorizationEndpoint,
  googleClientId,
  isGoogleOAuthConfigured,
  oauthRedirectUri,
  safeReturnTo,
  secureCookies,
} from "@/lib/google-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let base: URL;
  try {
    base = appUrl(request.url);
  } catch {
    return NextResponse.redirect(new URL("/auth?google=error&reason=configuration", request.url));
  }
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"), base);
  if (!isGoogleOAuthConfigured() || !process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    const target = new URL(returnTo, base);
    target.searchParams.set("google", "error");
    target.searchParams.set("reason", "not_configured");
    return NextResponse.redirect(target);
  }

  try {
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorizationUrl = new URL(await googleAuthorizationEndpoint());
    authorizationUrl.search = new URLSearchParams({
      client_id: googleClientId(),
      redirect_uri: oauthRedirectUri(base),
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();

    const response = NextResponse.redirect(authorizationUrl);
    const common = { httpOnly: true, secure: secureCookies(base), sameSite: "lax" as const, path: "/api/auth/google/callback", maxAge: 600 };
    response.cookies.set("aura_google_state", state, common);
    response.cookies.set("aura_google_nonce", nonce, common);
    response.cookies.set("aura_google_verifier", verifier, common);
    response.cookies.set("aura_google_return", returnTo, common);
    return response;
  } catch {
    const target = new URL(returnTo, base);
    target.searchParams.set("google", "error");
    target.searchParams.set("reason", "provider_unavailable");
    return NextResponse.redirect(target);
  }
}
