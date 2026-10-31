"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, Crown, LayoutDashboard, LoaderCircle, Search, Settings2, ShieldAlert, ShieldCheck, Users } from "lucide-react";
import type { AdminAuditEntry, ManagedUser, UserPlan, UserStatus } from "@/lib/admin-users";
import { SiteControls } from "@/components/admin/site-controls";
import { SangeetMark } from "@/components/brand/sangeet-mark";

type AdminTab = "overview" | "users" | "site" | "activity";

interface AdminPayload {
  users: (ManagedUser & { is_admin?: boolean })[];
  total: number;
  page: number;
  stats: { total: number; premium: number; suspended: number };
  actions: AdminAuditEntry[];
}

const navigation: { id: AdminTab; label: string; hint: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", hint: "Health and activity", icon: LayoutDashboard },
  { id: "users", label: "Users", hint: "Accounts and access", icon: Users },
  { id: "site", label: "Site controls", hint: "Content and switches", icon: Settings2 },
  { id: "activity", label: "Audit trail", hint: "Admin changes", icon: Activity },
];

function actionDescription(action: AdminAuditEntry) {
  const target = action.target_user_id === "site" ? "site settings" : action.target_user_id.replace(/^google:/, "");
  const details = Object.entries(action.details).map(([key, value]) => `${key} → ${Array.isArray(value) ? `${value.length} selected` : String(value)}`).join(", ");
  return `${action.actor_email} ${action.action === "site.settings.updated" ? "updated" : "changed"} ${target}${details ? ` · ${details}` : ""}`;
}

export function AdminPanel({ email }: { email: string }) {
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<AdminTab>("overview");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: query, page: String(page) });
      const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store", signal });
      const result = await response.json() as AdminPayload & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not load admin data.");
      setPayload(result);
      setError("");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Could not load admin data.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, revision]);

  const changeUser = async (user: ManagedUser, change: { plan?: UserPlan; status?: UserStatus }) => {
    if (change.status === "suspended" && !window.confirm(`Suspend ${user.email}? They will be signed out the next time their session is checked.`)) return;
    setBusyId(user.id);
    setError("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, ...change }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update this account.");
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this account.");
    } finally {
      setBusyId(null);
    }
  };

  const currentTitle = navigation.find((item) => item.id === tab)?.label ?? "Overview";
  const setupRequired = error.includes("not configured") || error.toLowerCase().includes("migration");
  const statCards = payload ? [
    { icon: Users, label: "Total accounts", value: payload.stats.total, detail: "Registered listeners" },
    { icon: Crown, label: "Premium access", value: payload.stats.premium, detail: "Manual entitlement" },
    { icon: ShieldAlert, label: "Suspended", value: payload.stats.suspended, detail: "Restricted accounts" },
  ] : [];

  const navButton = (item: typeof navigation[number], mobile = false) => {
    const Icon = item.icon;
    const active = tab === item.id;
    return <button key={item.id} type="button" aria-current={active ? "page" : undefined} aria-pressed={active} onClick={() => setTab(item.id)} className={mobile
      ? `flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-medium transition ${active ? "bg-primary text-primary-foreground" : "border border-white/[.08] text-white/55 hover:bg-white/[.04] hover:text-white"}`
      : `group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-primary/[.1] text-white ring-1 ring-inset ring-primary/20" : "text-white/55 hover:bg-white/[.04] hover:text-white"}`}>
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : "text-white/40 group-hover:text-white/70"}`} />
      {mobile ? item.label : <span className="min-w-0"><span className="block text-[13px] font-medium">{item.label}</span><span className="mt-0.5 block text-[10px] text-white/35">{item.hint}</span></span>}
    </button>;
  };

  return <div className="min-h-dvh bg-[#090c0a] text-white selection:bg-primary/25">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] flex-col border-r border-white/[.07] bg-[#0c100d] px-4 py-5 lg:flex">
      <Link href="/home" aria-label="Back to Sangeet" className="flex items-center gap-3 rounded-xl px-2 py-1.5">
        <SangeetMark size={42} />
        <span className="min-w-0"><span className="block font-display text-[15px] font-semibold tracking-tight">Sangeet</span><span className="mt-0.5 block text-[10px] text-white/40">Control room</span></span>
      </Link>
      <div className="mt-9 px-3"><p className="text-[9px] font-semibold uppercase tracking-[.2em] text-primary/75">Administration</p><p className="mt-1 text-xs text-white/35">Manage your platform</p></div>
      <nav aria-label="Admin navigation" className="mt-4 space-y-1">{navigation.map((item) => navButton(item))}</nav>
      <div className="mt-auto space-y-3">
        <div className="rounded-2xl border border-white/[.07] bg-white/[.025] p-3.5"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="h-3.5 w-3.5" /></span><span className="text-[11px] font-medium">Restricted access</span></div><p className="mt-2 truncate text-[10px] text-white/40" title={email}>{email}</p></div>
        <Link href="/home" className="flex h-10 items-center justify-between rounded-xl border border-white/[.08] px-3 text-xs text-white/60 transition hover:bg-white/[.04] hover:text-white">Return to listening <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
    </aside>

    <div className="min-h-dvh lg:pl-[268px]">
      <header className="sticky top-0 z-30 border-b border-white/[.07] bg-[#090c0a]/90 backdrop-blur-xl">
        <div className="flex min-h-[68px] items-center justify-between gap-3 px-4 sm:px-7 lg:px-10">
          <div className="flex items-center gap-3 lg:hidden"><SangeetMark size={36} /><span><span className="block text-sm font-semibold">Sangeet Admin</span><span className="block text-[10px] text-white/35">Restricted workspace</span></span></div>
          <div className="hidden lg:block"><p className="text-[9px] font-semibold uppercase tracking-[.2em] text-primary/75">Sangeet · Admin</p><p className="mt-0.5 text-xs text-white/35">{currentTitle}</p></div>
          <Link href="/home" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/[.1] px-3 text-[11px] font-medium text-white/65 transition hover:bg-white/[.05] hover:text-white lg:ml-auto"><span className="hidden sm:inline">Open music app</span><span className="sm:hidden">App</span><ArrowUpRight className="h-3.5 w-3.5" /></Link>
        </div>
        <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">{navigation.map((item) => navButton(item, true))}</nav>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 pb-12 pt-7 sm:px-7 sm:pt-9 lg:px-10 lg:pt-10">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.2em] text-primary/75">{tab === "overview" ? "Platform overview" : "Platform management"}</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-[-.045em] sm:text-[38px]">{currentTitle}</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-white/45">{tab === "overview" ? "A clear view of account access, site controls, and recent admin actions." : tab === "users" ? "Review listener accounts and manage access from one place." : tab === "site" ? "Publish site updates, control entry points, and curate the listening home." : "A traceable record of changes made in the admin workspace."}</p></div>
          <div className="flex items-center gap-2 self-start rounded-full border border-white/[.08] bg-white/[.025] px-3 py-2 text-[10px] text-white/45 sm:self-auto"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Server-verified administrator</div>
        </div>

        {error && <div role="alert" className={`mb-5 rounded-2xl border p-4 text-sm ${setupRequired ? "border-amber-200/20 bg-amber-200/[.04] text-amber-100" : "border-red-300/20 bg-red-300/[.05] text-red-100"}`}>
          <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><p>{error}</p>{setupRequired && <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-xs text-white/55"><li>Run the contents of the required Supabase migration in SQL Editor.</li><li>Confirm <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code> are set for Vercel Production.</li><li>Redeploy, then sign in again.</li></ol>}</div></div>
        </div>}

        {setupRequired ? <section className="rounded-3xl border border-white/[.07] bg-[#101411] p-6 sm:p-8"><h2 className="text-lg font-semibold">Connect platform storage</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">User access, settings and audit events are stored in Supabase. Apply the admin migrations listed in <code className="text-white/75">ADMIN_SETUP.md</code> to enable the control room.</p></section> : <>
          {tab === "overview" && <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="User account metrics">
              {statCards.map(({ icon: Icon, label, value, detail }) => <article key={label} className="rounded-2xl border border-white/[.07] bg-[#101411] p-5 sm:p-6"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/[.09] text-primary"><Icon className="h-4 w-4" /></span><span className="text-[9px] font-semibold uppercase tracking-[.15em] text-white/30">Live data</span></div><p className="mt-5 font-display text-3xl font-semibold tabular-nums">{value.toLocaleString()}</p><p className="mt-1 text-sm font-medium text-white/75">{label}</p><p className="mt-1 text-[11px] text-white/35">{detail}</p></article>)}
              {!payload && <div className="col-span-full flex items-center gap-2 rounded-2xl border border-white/[.07] bg-[#101411] p-6 text-sm text-white/45"><LoaderCircle className="h-4 w-4 animate-spin text-primary" />Loading platform overview</div>}
            </section>
            <section className="grid gap-3 xl:grid-cols-2">
              <button type="button" onClick={() => setTab("users")} className="group rounded-2xl border border-white/[.07] bg-[#101411] p-5 text-left transition hover:border-primary/20 hover:bg-[#121813] sm:p-6"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.04] text-primary"><Users className="h-4 w-4" /></span><ArrowUpRight className="h-4 w-4 text-white/30 transition group-hover:text-primary" /></div><h2 className="mt-4 font-semibold">People and access</h2><p className="mt-1 text-xs leading-relaxed text-white/40">Search listeners, assign manual Premium access, and suspend or restore accounts.</p></button>
              <button type="button" onClick={() => setTab("site")} className="group rounded-2xl border border-white/[.07] bg-[#101411] p-5 text-left transition hover:border-primary/20 hover:bg-[#121813] sm:p-6"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[.04] text-primary"><Settings2 className="h-4 w-4" /></span><ArrowUpRight className="h-4 w-4 text-white/30 transition group-hover:text-primary" /></div><h2 className="mt-4 font-semibold">Site and content</h2><p className="mt-1 text-xs leading-relaxed text-white/40">Manage announcements, entry and search switches, and featured home content.</p></button>
            </section>
            <ActivityFeed actions={payload?.actions ?? []} loading={loading} compact />
          </div>}

          {tab === "users" && <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#101411]">
            <div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4"><div><h2 className="font-semibold">Listener accounts</h2><p className="mt-1 text-xs text-white/40">Manual plan and account status controls.</p></div><label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 sm:w-[320px]"><Search className="h-4 w-4 text-white/40" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search name or email" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/30" /></label></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-white/35"><tr><th className="px-5 py-3">Account</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Plan</th><th className="px-5 py-3 text-right">Manage</th></tr></thead><tbody className="divide-y divide-white/[.055]">{payload?.users.map((user) => <tr key={user.id} className="transition hover:bg-white/[.02]"><td className="px-5 py-3.5"><div className="flex items-center gap-3">{user.picture ? <img src={user.picture} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{user.display_name.slice(0, 1).toUpperCase()}</span>}<span className="min-w-0"><span className="block max-w-[230px] truncate font-medium">{user.display_name}</span><span className="block max-w-[230px] truncate text-xs text-white/40">{user.email}{user.is_admin && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">ADMIN</span>}</span></span></div></td><td className="px-4 py-3.5 text-xs text-white/40">{new Date(user.created_at).toLocaleDateString()}</td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.status === "active" ? "bg-primary/10 text-primary" : "bg-red-300/10 text-red-200"}`}>{user.status}</span></td><td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.plan === "premium" ? "bg-amber-200/10 text-amber-100" : "bg-white/[.06] text-white/60"}`}>{user.plan}</span></td><td className="px-5 py-3.5"><div className="flex justify-end gap-2">{busyId === user.id ? <LoaderCircle className="h-5 w-5 animate-spin text-primary" /> : user.is_admin ? <span className="self-center text-[10px] text-white/35">Protected</span> : <><select aria-label={`Plan for ${user.email}`} value={user.plan} onChange={(event) => void changeUser(user, { plan: event.target.value as UserPlan })} className="h-8 rounded-lg border border-white/10 bg-[#17171d] px-2 text-xs"><option value="free">Free</option><option value="premium">Premium</option></select><button type="button" onClick={() => void changeUser(user, { status: user.status === "active" ? "suspended" : "active" })} className={`h-8 rounded-lg border px-2.5 text-xs ${user.status === "active" ? "border-red-300/15 text-red-200 hover:bg-red-300/10" : "border-primary/20 text-primary hover:bg-primary/10"}`}>{user.status === "active" ? "Suspend" : "Restore"}</button></>}</div></td></tr>)}</tbody></table>
              {!loading && !payload?.users.length && <p className="p-8 text-center text-sm text-white/40">No matching user accounts.</p>}{loading && <div className="flex items-center justify-center gap-2 p-8 text-sm text-white/40"><LoaderCircle className="h-4 w-4 animate-spin text-primary" />Loading accounts</div>}
            </div>
            {payload && <div className="flex items-center justify-between border-t border-white/[.06] px-4 py-3 text-xs text-white/40"><span>{payload.total.toLocaleString()} accounts</span><div className="flex gap-2"><button type="button" disabled={!page || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:bg-white/[.04] disabled:opacity-35">Previous</button><button type="button" disabled={(page + 1) * 25 >= payload.total || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 px-3 py-1.5 transition hover:bg-white/[.04] disabled:opacity-35">Next</button></div></div>}
          </section>}

          {tab === "site" && <SiteControls />}
          {tab === "activity" && <ActivityFeed actions={payload?.actions ?? []} loading={loading} />}
        </>}
        <p className="mt-8 border-t border-white/[.06] pt-4 text-[10px] text-white/30">Changes are server-authorized and recorded in the admin audit log. User data is accessed through the server-only Supabase key.</p>
      </main>
    </div>
  </div>;
}

function ActivityFeed({ actions, loading, compact = false }: { actions: AdminAuditEntry[]; loading: boolean; compact?: boolean }) {
  return <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#101411]">
    <div className="flex items-center justify-between border-b border-white/[.06] px-5 py-4"><div><h2 className="font-semibold">{compact ? "Recent admin activity" : "Audit trail"}</h2><p className="mt-1 text-[11px] text-white/35">Latest recorded account and site changes</p></div><Activity className="h-4 w-4 text-primary" /></div>
    <div className="divide-y divide-white/[.05] px-5">{actions.map((action) => <article key={action.id} className="flex flex-col justify-between gap-2 py-4 sm:flex-row sm:items-center"><p className="text-xs leading-relaxed text-white/70">{actionDescription(action)}</p><time className="shrink-0 text-[10px] text-white/35">{new Date(action.created_at).toLocaleString()}</time></article>)}{loading && !actions.length && <div className="flex items-center gap-2 py-5 text-xs text-white/40"><LoaderCircle className="h-4 w-4 animate-spin text-primary" />Loading audit events</div>}{!loading && !actions.length && <p className="py-5 text-xs text-white/40">No admin changes have been recorded yet.</p>}</div>
  </section>;
}
