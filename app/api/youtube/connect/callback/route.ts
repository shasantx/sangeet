import { NextRequest, NextResponse } from "next/server";
import { appUrl, googleClientId, googleClientSecret, secureCookies, verifySession } from "@/lib/google-auth";
import { getManagedUser } from "@/lib/admin-users";
import { saveYouTubeTokens } from "@/lib/youtube-account";
import { enforceRateLimit, safeCompare } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "youtube:connect:callback", 20, 60_000);
  if (rateLimited) return rateLimited;

  let base: URL;
  try {
    base = appUrl(request.url);
  } catch {
    return NextResponse.redirect(new URL("/my-youtube-library?youtube=error", request.url));
  }
  const state = request.nextUrl.searchParams.get("state");
  const expected = request.cookies.get("sangeet_yt_state")?.value;
  const verifier = request.cookies.get("sangeet_yt_verifier")?.value;
  const userId = request.cookies.get("sangeet_yt_user")?.value;
  const session = verifySession(request.cookies.get("aura_session")?.value);
  const validContext = Boolean(
    safeCompare(state, expected) &&
      session &&
      safeCompare(userId, `google:${session.sub}`),
  );
  const response = NextResponse.redirect(new URL(`/my-youtube-library?youtube=${validContext ? "connected" : "error"}`, base));
  response.headers.set("cache-control", "no-store");
  const cookie = {
    httpOnly: true,
    secure: secureCookies(base),
    sameSite: "lax" as const,
    path: "/api/youtube/connect/callback",
    maxAge: 0,
  };
  for (const name of ["sangeet_yt_state", "sangeet_yt_verifier", "sangeet_yt_user"]) response.cookies.set(name, "", cookie);
  try {
    if (!validContext || !verifier || !userId || !session || request.nextUrl.searchParams.has("error")) {
      throw new Error("OAuth state mismatch");
    }
    const profile = await getManagedUser(userId);
    if (profile?.status !== "active") throw new Error("Account not active");
    const code = request.nextUrl.searchParams.get("code");
    if (!code || code.length > 512) throw new Error("Missing code");
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: googleClientId(),
        client_secret: googleClientSecret(),
        redirect_uri: new URL("/api/youtube/connect/callback", base).toString(),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) throw new Error("OAuth exchange failed");
    const tokens = (await tokenResponse.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (
      !tokens.access_token ||
      !tokens.refresh_token ||
      !tokens.scope?.split(" ").includes("https://www.googleapis.com/auth/youtube.readonly")
    ) {
      throw new Error("Required read-only scope missing");
    }
    await saveYouTubeTokens(
      userId,
      {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in ?? 3600) * 1000,
      },
      ["https://www.googleapis.com/auth/youtube.readonly"],
    );
    return response;
  } catch {
    const failed = NextResponse.redirect(new URL("/my-youtube-library?youtube=error", base));
    failed.headers.set("cache-control", "no-store");
    for (const name of ["sangeet_yt_state", "sangeet_yt_verifier", "sangeet_yt_user"]) failed.cookies.set(name, "", cookie);
    return failed;
  }
}
