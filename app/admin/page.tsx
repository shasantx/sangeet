import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { adminSession } from "@/lib/admin-auth";
import { AdminPanel } from "@/components/admin/admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = adminSession(cookieStore.get("aura_session")?.value);
  if (!session) {
    if (!cookieStore.has("aura_session")) redirect("/auth?returnTo=%2Fadmin");
    return <main className="page-container max-w-3xl pt-12"><div className="rounded-2xl border border-red-400/15 bg-red-400/[.04] p-7 sm:p-9"><AlertTriangle className="h-6 w-6 text-red-300" /><h1 className="mt-4 text-2xl font-semibold">Admin access required</h1><p className="mt-2 text-sm text-muted-foreground">This account is not on the server-side administrator allowlist.</p></div></main>;
  }

  return <main className="page-container max-w-[1280px] pt-8 sm:pt-10">
    <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span><div><p className="eyebrow">Restricted workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Admin console</h1></div></div>
    <p className="mt-3 text-sm text-muted-foreground">Signed in as {session.email}. Actions are checked on the server and recorded in the audit log.</p>
    <AdminPanel />
  </main>;
}
