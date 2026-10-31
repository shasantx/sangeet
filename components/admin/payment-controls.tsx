"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, LoaderCircle, QrCode, RefreshCw, Save, ShieldX } from "lucide-react";

interface Payment { id: string; user_id: string; created_at: string; amount_usd: number; status: string; payment_reference: string; proof_url: string; user_profiles: { email: string; display_name: string } }
interface Settings { amount_usd: number; qr_image_url: string; payment_instructions: string; donation_enabled: boolean; donation_qr_image_url: string; donation_instructions: string }

export function PaymentControls() {
  const [settings, setSettings] = useState<Settings>({ amount_usd: 3, qr_image_url: "", payment_instructions: "", donation_enabled: false, donation_qr_image_url: "", donation_instructions: "" });
  const [requests, setRequests] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/premium/payments", { cache: "no-store" });
      const body = await response.json() as { settings?: Settings; requests?: Payment[]; error?: string };
      if (!response.ok || !body.settings || !body.requests) throw new Error(body.error || "Could not load payments.");
      setSettings(body.settings); setRequests(body.requests);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load payment queue."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const post = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/premium/payments", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json() as { error?: string };
    if (!response.ok) throw new Error(result.error || "Could not save changes.");
  };
  const save = async () => {
    setBusy("settings"); setError(""); setMessage("");
    try { await post({ action: "settings", qr_image_url: settings.qr_image_url, payment_instructions: settings.payment_instructions, donation_enabled: settings.donation_enabled, donation_qr_image_url: settings.donation_qr_image_url, donation_instructions: settings.donation_instructions }); setMessage("Payment and support options saved."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save settings."); }
    finally { setBusy(""); }
  };
  const review = async (payment: Payment, status: "approved" | "rejected", note = "") => {
    setBusy(payment.id); setError("");
    try { await post({ id: payment.id, status, note }); setReviewNotes((current) => { const next = { ...current }; delete next[payment.id]; return next; }); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not review payment."); }
    finally { setBusy(""); }
  };
  return <div className="space-y-5">
    {error && <div role="alert" className="rounded-xl border border-red-300/20 bg-red-300/[.05] p-3 text-sm text-red-100">{error}<p className="mt-1 text-xs opacity-70">Confirm the manual payments migration is applied to the connected Supabase project.</p></div>}
    {message && <div role="status" className="rounded-xl border border-primary/20 bg-primary/[.06] p-3 text-sm text-primary">{message}</div>}
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="rounded-2xl border border-white/[.07] bg-[#101411] p-5 sm:p-6"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><QrCode className="h-5 w-5"/></span><div><h2 className="font-semibold">Premium payment setup</h2><p className="mt-1 text-xs text-white/45">Set your payment QR and clear steps users should follow.</p></div></div>
        <label className="mt-5 block text-xs font-medium text-white/65">QR image URL (HTTPS)<input value={settings.qr_image_url} onChange={(e) => setSettings({ ...settings, qr_image_url: e.target.value })} maxLength={1000} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-primary/50" placeholder="https://…/payment-qr.png"/></label>
        <label className="mt-4 block text-xs font-medium text-white/65">Payment instructions<textarea value={settings.payment_instructions} onChange={(e) => setSettings({ ...settings, payment_instructions: e.target.value })} maxLength={1000} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-primary/50" placeholder="Recipient, currency, and any payment notes"/></label>
        {settings.qr_image_url && <img src={settings.qr_image_url} alt="Configured payment QR preview" className="mt-4 max-h-48 rounded-xl bg-white p-2"/>}
        <div className="mt-6 border-t border-white/[.07] pt-5"><div className="flex items-center justify-between gap-4"><div><h3 className="text-sm font-semibold">Open source donations</h3><p className="mt-1 text-[11px] text-white/40">Shown on the public landing page, separate from Premium.</p></div><button type="button" role="switch" aria-checked={settings.donation_enabled} onClick={() => setSettings({ ...settings, donation_enabled: !settings.donation_enabled })} className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings.donation_enabled ? "bg-primary" : "bg-white/20"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${settings.donation_enabled ? "left-[22px]" : "left-0.5"}`} /></button></div>
          <label className="mt-4 block text-xs font-medium text-white/65">Donation QR image URL (HTTPS)<input value={settings.donation_qr_image_url} onChange={(e) => setSettings({ ...settings, donation_qr_image_url: e.target.value })} maxLength={1000} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-primary/50" placeholder="https://…/donation-qr.png"/></label>
          <label className="mt-4 block text-xs font-medium text-white/65">Donation payment options and instructions<textarea value={settings.donation_instructions} onChange={(e) => setSettings({ ...settings, donation_instructions: e.target.value })} maxLength={1000} className="mt-2 min-h-20 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-primary/50" placeholder="Payment methods, currency, and a thank-you note"/></label>
          {settings.donation_qr_image_url && <img src={settings.donation_qr_image_url} alt="Donation QR preview" className="mt-4 max-h-40 rounded-xl bg-white p-2"/>}
        </div>
        <button type="button" onClick={() => void save()} disabled={busy === "settings"} className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50">{busy === "settings" ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}Save payment & donation setup</button>
      </div>
      <div className="rounded-2xl border border-primary/15 bg-primary/[.045] p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Review queue</p><p className="mt-3 font-display text-4xl font-semibold">{requests.filter((r) => r.status === "pending").length}</p><p className="mt-1 text-xs text-white/45">Awaiting manual verification</p><button type="button" onClick={() => void load()} disabled={loading} className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs text-white/65"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}/>Refresh queue</button><p className="mt-4 text-[10px] leading-relaxed text-white/40">Approving a valid request grants Premium and records an audit event. Rejection never changes the user’s plan.</p></div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-white/[.07] bg-[#101411]"><div className="flex items-center justify-between border-b border-white/[.07] px-5 py-4"><div><h2 className="font-semibold">Payment requests</h2><p className="mt-1 text-xs text-white/40">Private receipt storage · $3 per access request</p></div><Clock3 className="h-4 w-4 text-primary"/></div>
      {loading ? <div className="flex items-center gap-2 p-8 text-sm text-white/45"><LoaderCircle className="h-4 w-4 animate-spin text-primary"/>Loading payment requests</div> : !requests.length ? <p className="p-8 text-center text-sm text-white/40">No payment requests yet.</p> : <div className="divide-y divide-white/[.05]">{requests.map((payment) => <article key={payment.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-center sm:p-5"><div className="flex min-w-0 gap-4">{payment.proof_url && <a href={payment.proof_url} target="_blank" rel="noreferrer" className="shrink-0"><img src={payment.proof_url} alt="Uploaded payment proof" className="h-20 w-20 rounded-xl border border-white/10 bg-white/5 object-cover"/></a>}<div className="min-w-0"><p className="truncate text-sm font-medium">{payment.user_profiles?.display_name || "Listener"} <span className="font-normal text-white/45">· {payment.user_profiles?.email}</span></p><p className="mt-1 text-xs text-white/45">${payment.amount_usd} · {new Date(payment.created_at).toLocaleString()}</p>{payment.payment_reference && <p className="mt-1 truncate text-xs text-white/40">Reference: {payment.payment_reference}</p>}<span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[9px] font-semibold uppercase ${payment.status === "pending" ? "bg-amber-100/10 text-amber-100" : payment.status === "approved" ? "bg-primary/10 text-primary" : "bg-red-200/10 text-red-200"}`}>{payment.status}</span></div></div>
        {payment.status === "pending" ? <div className="space-y-2">{busy === payment.id ? <div className="flex items-center gap-2 text-xs text-white/45"><LoaderCircle className="h-4 w-4 animate-spin text-primary"/>Saving review…</div> : <><label className="sr-only" htmlFor={`payment-note-${payment.id}`}>Optional note to the listener</label><input id={`payment-note-${payment.id}`} value={reviewNotes[payment.id] ?? ""} maxLength={500} onChange={(event) => setReviewNotes((current) => ({ ...current, [payment.id]: event.target.value }))} className="h-9 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-xs outline-none focus:border-primary/40" placeholder="Optional note for listener"/><div className="flex gap-2"><button type="button" onClick={() => void review(payment,"approved",reviewNotes[payment.id])} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"><Check className="h-3.5 w-3.5"/>Approve</button><button type="button" onClick={() => void review(payment,"rejected",reviewNotes[payment.id])} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-200/15 px-3 text-xs text-red-100"><ShieldX className="h-3.5 w-3.5"/>Reject</button></div></>}</div> : <span className="text-xs text-white/40">Reviewed</span>}</article>)}</div>}
    </section>
  </div>;
}
