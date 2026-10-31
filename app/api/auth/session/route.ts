import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/google-auth";
import { getManagedUser, isAdminStorageConfigured, registerGoogleUser } from "@/lib/admin-users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = verifySession(request.cookies.get("aura_session")?.value);
  if (!session) return NextResponse.json({ session: null }, { headers: { "cache-control": "no-store" } });
  let plan: "free" | "premium" = "free";
  try {
    let profile = await getManagedUser(`google:${session.sub}`);
    if (!profile) {
      await registerGoogleUser({ id: session.sub, email: session.email, name: session.name, picture: session.picture });
      profile = await getManagedUser(`google:${session.sub}`);
    }
    if (profile?.status === "suspended") {
      const response = NextResponse.json({ session: null, error: "Account suspended." }, { status: 403, headers: { "cache-control": "no-store" } });
      response.cookies.delete("aura_session");
      return response;
    }
    if (profile?.plan === "premium") plan = "premium";
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
  return NextResponse.json(
    { session: { id: session.sub, email: session.email, name: session.name, picture: session.picture, plan } },
    { headers: { "cache-control": "no-store" } },
  );
}
