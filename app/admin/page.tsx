import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { adminSession } from "@/lib/admin-auth";
import { AdminPanel } from "@/components/admin/admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = adminSession(cookieStore.get("aura_session")?.value);
  if (!session) {
    if (!cookieStore.has("aura_session")) redirect("/auth?returnTo=%2Fadmin");
    return <main className="mx-auto flex min-h-dvh max-w-2xl items-center px-5"><div className="w-full rounded-3xl border border-red-400/15 bg-[#111512] p-7 sm:p-10"><AlertTriangle className="h-7 w-7 text-red-300" /><p className="eyebrow mt-5">Restricted workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Admin access required</h1><p className="mt-3 text-sm leading-relaxed text-white/55">This account is not on the server-side administrator allowlist.</p><a href="/home" className="mt-6 inline-flex h-10 items-center rounded-full border border-white/10 px-4 text-sm text-white/75 transition hover:bg-white/[.05]">Return to Sangeet</a></div></main>;
  }

  return <AdminPanel email={session.email} />;
}
