import { cookies } from "next/headers";
import { adminSession } from "@/lib/admin-auth";
import { verifySession } from "@/lib/google-auth";
import { AdminPanel } from "@/components/admin/admin-panel";
import { AdminLogin } from "@/components/admin/admin-login";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get("aura_session")?.value;
  const admin = adminSession(rawCookie);

  if (admin) {
    return <AdminPanel email={admin.email} />;
  }

  const userSession = verifySession(rawCookie);
  return <AdminLogin currentEmail={userSession?.email} />;
}
