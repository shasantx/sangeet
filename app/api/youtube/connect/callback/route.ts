import { NextRequest, NextResponse } from "next/server";
import { appUrl, googleClientId, googleClientSecret, secureCookies, verifySession } from "@/lib/google-auth";
import { saveYouTubeTokens } from "@/lib/youtube-account";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const base = appUrl(request.url);
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("sangeet_yt_state")?.value;
  const verifier = request.cookies.get("sangeet_yt_verifier")?.value;
  const userId = request.cookies.get("sangeet_yt_user")?.value;
  const session = verifySession(request.cookies.get("aura_session")?.value);
  const response = NextResponse.redirect(new URL(`/my-youtube-library?youtube=${state && expected === state && session && userId === `google:${session.sub}` ? "connected" : "error"}`, base));
  const cookie = { httpOnly: true, secure: secureCookies(base), sameSite: "lax" as const, path: "/api/youtube/connect/callback", maxAge: 0 };
  for (const name of ["sangeet_yt_state", "sangeet_yt_verifier", "sangeet_yt_user"]) response.cookies.set(name, "", cookie);
  try {
    if (!state || state !== expected || !verifier || !userId || !session || userId !== `google:${session.sub}` || request.nextUrl.searchParams.has("error")) throw new Error("OAuth state mismatch");
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Missing code");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: googleClientId(), client_secret: googleClientSecret(), redirect_uri: new URL("/api/youtube/connect/callback", base).toString(), grant_type: "authorization_code", code_verifier: verifier }), cache: "no-store" });
    if (!tokenResponse.ok) throw new Error("OAuth exchange failed");
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!tokens.access_token || !tokens.refresh_token || !tokens.scope?.split(" ").includes("https://www.googleapis.com/auth/youtube.readonly")) throw new Error("Required read-only scope missing");
    await saveYouTubeTokens(userId, { access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000 }, ["https://www.googleapis.com/auth/youtube.readonly"]);
    return response;
  } catch {
    const failed = NextResponse.redirect(new URL("/my-youtube-library?youtube=error", base));
    for (const name of ["sangeet_yt_state", "sangeet_yt_verifier", "sangeet_yt_user"]) failed.cookies.set(name, "", cookie);
    return failed;
  }
}
