import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = verifySession(request.cookies.get("aura_session")?.value);
  if (!session) return NextResponse.json({ session: null }, { headers: { "cache-control": "no-store" } });
  return NextResponse.json(
    { session: { id: session.sub, email: session.email, name: session.name, picture: session.picture } },
    { headers: { "cache-control": "no-store" } },
  );
}
