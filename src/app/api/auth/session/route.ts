import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  isGoogleOAuthConfigured,
  verifySession
} from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySession(token);
  return NextResponse.json(
    {
      googleConfigured: isGoogleOAuthConfigured(),
      user: session
        ? {
            id: session.id,
            name: session.name,
            email: session.email,
            avatar: session.avatar,
            mode: session.mode
          }
        : null
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
