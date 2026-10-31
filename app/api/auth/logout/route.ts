import { NextRequest, NextResponse } from "next/server";
import { appUrl, secureCookies } from "@/lib/google-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
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
