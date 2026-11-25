import { NextResponse } from "next/server";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  getClearedSessionCookieOptions,
  getOAuthStateCookieOptions
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
  res.cookies.set(SESSION_COOKIE, "", getClearedSessionCookieOptions());
  res.cookies.set(OAUTH_STATE_COOKIE, "", getOAuthStateCookieOptions(0));
  return res;
}
