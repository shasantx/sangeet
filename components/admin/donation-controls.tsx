"use client";

import { useCallback, useEffect, useState } from "react";
import { HeartHandshake, LoaderCircle, QrCode, RefreshCw, Save } from "lucide-react";

interface Settings { enabled: boolean; qr_image_url: string; instructions: string }
const blank: Settings = { enabled: false, qr_image_url: "", instructions: "" };

export function DonationControls() {
  const [settings, setSettings] = useState<Settings>(blank);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/donations", { cache: "no-store" });
      const body = await response.json() as Settings & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load support settings.");
      setSettings({ enabled: body.enabled === true, qr_image_url: body.qr_image_url || "", instructions: body.instructions || "" });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load support settings."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/donations", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not save donation settings.");
      setMessage("Donation QR settings saved and recorded in the admin audit log.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save donation settings."); }
    finally { setBusy(false); }
  };

  return <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="rounded-2xl border border-white/[.07] bg-[#101411] p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><HeartHandshake className="h-5 w-5" /></span><div><h2 className="font-semibold">Project donations</h2><p className="mt-1 text-xs text-white/45">Optional support for the open-source project. No paid plan or purchase flow.</p></div></div>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-300/[.05] p-3 text-sm text-red-100">{error}</p>}
      {message && <p role="status" className="mt-5 rounded-xl border border-primary/20 bg-primary/[.06] p-3 text-sm text-primary">{message}</p>}
      <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/[.08] bg-black/20 px-3.5 py-3 text-sm"><span><span className="block font-medium">Show donation section</span><span className="mt-1 block text-[11px] text-white/40">Enables the optional QR on the public landing page.</span></span><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} className="h-5 w-5 shrink-0 accent-primary" /></label>
      <label className="mt-4 block text-xs font-medium text-white/65">Donation QR image URL (HTTPS)<input value={settings.qr_image_url} onChange={(event) => setSettings({ ...settings, qr_image_url: event.target.value })} maxLength={1000} inputMode="url" autoComplete="url" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-primary/50" placeholder="https://…/donation-qr.png" /></label>
      <label className="mt-4 block text-xs font-medium text-white/65">Short instructions<textarea value={settings.instructions} onChange={(event) => setSettings({ ...settings, instructions: event.target.value })} maxLength={1000} rows={3} className="mt-2 min-h-24 w-full rounded-xl border border-white/10 bg-black/20 p-3 text-sm outline-none focus:border-primary/50" placeholder="Payment handle, currency, or a brief thank-you note" /></label>
      {settings.qr_image_url && <img src={settings.qr_image_url} alt="Donation QR preview" loading="lazy" className="mt-4 max-h-48 rounded-xl bg-white p-2" />}
      <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={() => void save()} disabled={busy || loading} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save donations</button><button type="button" onClick={() => void load()} disabled={loading || busy} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-xs text-white/65"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />Refresh</button></div>
    </div>
    <aside className="rounded-2xl border border-primary/15 bg-primary/[.045] p-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><QrCode className="h-5 w-5" /></span><h3 className="mt-4 font-semibold">Public display</h3><p className="mt-2 text-xs leading-5 text-white/50">Only the enabled state, QR image URL, and instructions are public. Member records, credentials, and audit details stay behind the server-side admin session.</p><p className="mt-4 border-t border-white/[.08] pt-4 text-[11px] text-white/40">Updates create an immutable audit entry with the administrator identity and configuration change.</p></aside>
  </section>;
}
