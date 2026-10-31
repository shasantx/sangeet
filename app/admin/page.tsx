import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import { albums, artists, tracks } from "@/lib/catalog";
import { verifySession } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("aura_session")?.value);
  if (!session) redirect("/auth?returnTo=%2Fadmin");

  const allowedEmails = new Set([
    "private.shasant@gmail.com",
    ...(process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
  ]);
  const isAdmin = allowedEmails.has(session.email.toLowerCase());
  if (!isAdmin) {
    return (
      <main className="page-container max-w-3xl pt-12">
        <div className="rounded-2xl border border-red-400/15 bg-red-400/[.04] p-7 sm:p-9">
          <AlertTriangle className="h-6 w-6 text-red-300" />
          <h1 className="mt-4 text-2xl font-semibold">Admin access required</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">This Google account is not listed in the server-side <code>ADMIN_EMAILS</code> allowlist. Access is never granted by a browser setting.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft className="h-4 w-4" /> Return to Sangeet</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-container max-w-[1120px] pt-10">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span><div><p className="eyebrow">Restricted workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Sangeet administration</h1></div></div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">Signed in as {session.email}. Your access comes from the server’s <code>ADMIN_EMAILS</code> setting.</p>
      <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Bundled catalog inventory">
        {[{ label: "Sample tracks", value: tracks.length }, { label: "Albums", value: albums.length }, { label: "Artists", value: artists.length }].map((item) => <div key={item.label} className="rounded-xl border border-white/[.06] bg-white/[.02] p-5"><p className="eyebrow">Bundled catalog</p><p className="mt-3 font-display text-3xl font-semibold">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.label}</p></div>)}
      </section>
      <section className="mt-6 rounded-2xl border border-white/[.06] bg-white/[.02] p-6 sm:p-8">
        <h2 className="font-display text-xl font-medium">Management services are not connected</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">User search, account status, moderation, editable catalog records, billing, and audit logs require a persistent application database. This deployment currently serves a bundled sample catalog and browser-local listener libraries, so Sangeet does not show fabricated user or subscription metrics or expose pretend management controls.</p>
        <p className="mt-4 text-xs text-muted-foreground">Access is checked on the server against verified Google email addresses. Add any additional administrators with the comma-separated <code>ADMIN_EMAILS</code> server setting.</p>
      </section>
    </main>
  );
}
