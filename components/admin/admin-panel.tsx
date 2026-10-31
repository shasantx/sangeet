"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Crown, LoaderCircle, Search, ShieldAlert, Users } from "lucide-react";
import type { AdminAuditEntry, ManagedUser, UserPlan, UserStatus } from "@/lib/admin-users";

interface AdminPayload {
  users: (ManagedUser & { is_admin?: boolean })[];
  total: number;
  page: number;
  stats: { total: number; premium: number; suspended: number };
  actions: AdminAuditEntry[];
}

export function AdminPanel() {
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

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
    const timer = window.setTimeout(() => void load(controller.signal), 220);
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

  const statCards = payload ? [
    { icon: Users, label: "Total accounts", value: payload.stats.total },
    { icon: Crown, label: "Premium access", value: payload.stats.premium },
    { icon: ShieldAlert, label: "Suspended", value: payload.stats.suspended },
  ] : [];

  if (error.includes("not configured") || error.includes("migration")) {
    return <section className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-200/[.04] p-5 sm:p-7">
      <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div><h2 className="font-semibold text-white">Admin database setup</h2><p className="mt-2 text-sm leading-relaxed text-white/65">User accounts and premium status need Supabase storage. Follow these checks to connect the database and unlock management.</p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-white/65"><li>Run <code className="text-white">supabase/migrations/20261031000000_admin_user_management.sql</code> in your Supabase SQL Editor.</li><li>Add <code className="text-white">SUPABASE_URL</code> and <code className="text-white">SUPABASE_SERVICE_ROLE_KEY</code> to Vercel Environment Variables. Keep the service key server-only.</li><li>Redeploy. Users will appear as they sign in; refreshing your account registers the first admin row.</li></ol>
        <p className="mt-4 text-xs text-white/40">Premium here is a manual access flag. No billing provider or paid subscription is connected.</p>
      </div></div>
      {error && <p role="alert" className="mt-4 text-sm text-amber-100">{error}</p>}
    </section>;
  }

  return <div className="mt-7 space-y-6">
    {error && <div role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[.05] p-3 text-sm text-red-100">{error}</div>}
    {payload && <section className="grid gap-3 sm:grid-cols-3" aria-label="User account statistics">
      {statCards.map(({ icon: Icon, label, value }) => <div key={label} className="rounded-2xl border border-white/[.06] bg-white/[.025] p-5"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4 text-primary" /><span className="text-xs">{label}</span></div><p className="mt-3 font-display text-3xl font-semibold">{value}</p></div>)}
    </section>}

    <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-white/[.02]">
      <div className="flex flex-col gap-3 border-b border-white/[.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h2 className="font-semibold">Users</h2><p className="mt-1 text-xs text-muted-foreground">Grant manual premium access or suspend an account.</p></div>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 sm:w-[300px]"><Search className="h-4 w-4 text-white/40" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search name or email" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35" /></label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[740px] text-left text-sm"><thead className="bg-white/[.025] text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3">Account</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Plan</th><th className="px-5 py-3 text-right">Manage</th></tr></thead>
          <tbody className="divide-y divide-white/[.055]">{payload?.users.map((user) => <tr key={user.id} className="hover:bg-white/[.02]">
            <td className="px-5 py-3.5"><div className="flex items-center gap-3">{user.picture ? <img src={user.picture} alt="" className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{user.display_name.slice(0, 1).toUpperCase()}</span>}<span className="min-w-0"><span className="block max-w-[230px] truncate font-medium">{user.display_name}</span><span className="block max-w-[230px] truncate text-xs text-muted-foreground">{user.email}{user.is_admin && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">ADMIN</span>}</span></span></div></td>
            <td className="px-4 py-3.5 text-xs text-muted-foreground">{new Date(user.created_at).toLocaleDateString()}</td>
            <td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.status === "active" ? "bg-primary/10 text-primary" : "bg-red-300/10 text-red-200"}`}>{user.status}</span></td>
            <td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${user.plan === "premium" ? "bg-amber-200/10 text-amber-100" : "bg-white/[.06] text-white/60"}`}>{user.plan}</span></td>
            <td className="px-5 py-3.5"><div className="flex justify-end gap-2">{busyId === user.id ? <LoaderCircle className="h-5 w-5 animate-spin text-primary" /> : user.is_admin ? <span className="self-center text-[10px] text-muted-foreground">Protected</span> : <><select aria-label={`Plan for ${user.email}`} value={user.plan} onChange={(event) => void changeUser(user, { plan: event.target.value as UserPlan })} className="h-8 rounded-lg border border-white/10 bg-[#17171d] px-2 text-xs"><option value="free">Free</option><option value="premium">Premium</option></select><button type="button" onClick={() => void changeUser(user, { status: user.status === "active" ? "suspended" : "active" })} className={`h-8 rounded-lg border px-2.5 text-xs ${user.status === "active" ? "border-red-300/15 text-red-200 hover:bg-red-300/10" : "border-primary/20 text-primary hover:bg-primary/10"}`}>{user.status === "active" ? "Suspend" : "Restore"}</button></>}</div></td>
          </tr>)}</tbody>
        </table>
        {!loading && !payload?.users.length && <p className="p-8 text-center text-sm text-muted-foreground">No matching user accounts.</p>}
        {loading && <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Loading accounts</div>}
      </div>
      {payload && <div className="flex items-center justify-between border-t border-white/[.06] px-4 py-3 text-xs text-muted-foreground"><span>{payload.total} accounts</span><div className="flex gap-2"><button type="button" disabled={!page || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-35">Previous</button><button type="button" disabled={(page + 1) * 25 >= payload.total || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-white/10 px-3 py-1.5 disabled:opacity-35">Next</button></div></div>}
    </section>

    <section className="rounded-2xl border border-white/[.06] bg-white/[.02] p-5 sm:p-6"><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /><h2 className="font-semibold">Recent admin activity</h2></div><div className="mt-4 divide-y divide-white/[.05]">{payload?.actions.map((action) => <div key={action.id} className="flex flex-col justify-between gap-1 py-3 text-xs sm:flex-row sm:items-center"><span className="text-white/75"><strong>{action.actor_email}</strong> changed {action.target_user_id.replace(/^google:/, "")}: {Object.entries(action.details).map(([key, value]) => `${key} → ${value}`).join(", ")}</span><time className="shrink-0 text-white/35">{new Date(action.created_at).toLocaleString()}</time></div>)}{payload && !payload.actions.length && <p className="py-4 text-xs text-muted-foreground">No admin changes yet.</p>}</div></section>
    <p className="text-[11px] text-muted-foreground/65">Account records are protected by Supabase RLS and server-only service credentials. Suspended accounts are signed out at their next session check.</p>
  </div>;
}
