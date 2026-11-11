import { NextRequest, NextResponse } from "next/server";
import { appUrl, secureCookies, verifySession } from "@/lib/google-auth";
import { getManagedUser, isAdminStorageConfigured, registerGoogleUser } from "@/lib/admin-users";
import { isAdminEmail } from "@/lib/admin-auth";
import { enforceRateLimit } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimited = enforceRateLimit(request, "auth:session", 120, 60_000);
  if (rateLimited) return rateLimited;

  const session = verifySession(request.cookies.get("aura_session")?.value);
  if (!session) return NextResponse.json({ session: null }, { headers: { "cache-control": "no-store" } });
  const isEmailSession = session.sub.startsWith("email:");
  if (!isEmailSession) {
    try {
      let profile = await getManagedUser(`google:${session.sub}`);
      if (!profile) {
        await registerGoogleUser({ id: session.sub, email: session.email, name: session.name, picture: session.picture });
        profile = await getManagedUser(`google:${session.sub}`);
      }
      if (profile?.status === "suspended") {
        const response = NextResponse.json(
          { session: null, error: "Account suspended." },
          { status: 403, headers: { "cache-control": "no-store" } },
        );
        let secure = true;
        try {
          secure = secureCookies(appUrl(request.url));
        } catch {}
        response.cookies.set("aura_session", "", {
          httpOnly: true,
          secure,
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
        return response;
      }
    } catch {
      // Without the user store the app can still run in local/demo mode. In
      // production, don't treat a storage outage as proof an account is active.
      if (isAdminStorageConfigured()) {
        return NextResponse.json(
          { error: "Account status is temporarily unavailable." },
          { status: 503, headers: { "cache-control": "no-store" } },
        );
      }
    }
  }
  return NextResponse.json(
    {
      session: {
        id: session.sub,
        email: session.email,
        name: session.name,
        picture: session.picture,
        isAdmin: isAdminEmail(session.email),
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
