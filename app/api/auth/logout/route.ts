import { NextRequest, NextResponse } from "next/server";
import { appUrl, secureCookies } from "@/lib/google-auth";
import { enforceRateLimit, verifySameOrigin } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "auth:logout", 30, 60_000);
  if (rateLimited) return rateLimited;

  if (!verifySameOrigin(request)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
  }

  const response = NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  let secure = true;
  try {
    secure = secureCookies(appUrl(request.url));
  } catch {
    // Keep secure cookies enabled if deployment configuration is invalid.
  }
  response.cookies.set("aura_session", "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
