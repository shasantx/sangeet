import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { appUrl, googleAuthorizationEndpoint, googleClientId, secureCookies, verifySession } from "@/lib/google-auth";
import { getManagedUser } from "@/lib/admin-users";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const identity = verifySession(request.cookies.get("aura_session")?.value);
    if (!identity) return NextResponse.redirect(new URL("/auth", request.url));
    const profile = await getManagedUser(`google:${identity.sub}`);
    if (profile?.status !== "active") return NextResponse.redirect(new URL("/settings?youtube=unavailable", request.url));
    const base = appUrl(request.url);
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const url = new URL(await googleAuthorizationEndpoint());
    url.search = new URLSearchParams({ client_id: googleClientId(), redirect_uri: new URL("/api/youtube/connect/callback", base).toString(), response_type: "code", scope: "https://www.googleapis.com/auth/youtube.readonly", state, code_challenge: challenge, code_challenge_method: "S256", access_type: "offline", prompt: "consent select_account" }).toString();
    const response = NextResponse.redirect(url);
    const cookie = { httpOnly: true, secure: secureCookies(base), sameSite: "lax" as const, path: "/api/youtube/connect/callback", maxAge: 600 };
    response.cookies.set("sangeet_yt_state", state, cookie);
    response.cookies.set("sangeet_yt_verifier", verifier, cookie);
    response.cookies.set("sangeet_yt_user", `google:${identity.sub}`, cookie);
    return response;
  } catch {
    return NextResponse.redirect(new URL("/settings?youtube=unavailable", request.url));
  }
}
