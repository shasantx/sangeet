"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock3, FileCheck2, LoaderCircle, QrCode, Upload } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useAppStore } from "@/store/app-store";

type PaymentRequest = { id: string; status: "pending" | "approved" | "rejected"; review_note?: string; created_at: string };
type Payload = { settings: { amount_usd: number; qr_image_url: string; payment_instructions: string }; requests: PaymentRequest[]; user_plan?: string; error?: string };

export function PremiumPayment({ signedIn }: { signedIn: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [qrFailed, setQrFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/premium/payments", { cache: "no-store" });
    const payload = await response.json() as Payload;
    if (!response.ok) throw new Error(payload.error || "Premium payment details are unavailable.");
    setData(payload);
    if (payload.user_plan === "premium") {
      const session = useAuthStore.getState().session;
      if (session) useAuthStore.getState().setGoogleSession({ id: session.userId.replace(/^google:/, ""), email: session.email, name: session.displayName, picture: session.picture, plan: "premium", isAdmin: session.isAdmin });
      useAppStore.getState().setPlan("Premium");
    }
  }, []);
  useEffect(() => {
    let active = true;
    void load().catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load payment options."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]);

  const submit = async () => {
    if (!file) { setError("Choose a receipt image or PDF before submitting."); return; }
    setBusy(true); setError(""); setSaved(false);
    try {
      const form = new FormData(); form.set("proof", file); form.set("reference", reference);
      const response = await fetch("/api/premium/payments", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not submit proof.");
      setSaved(true); setFile(null); setReference(""); if (input.current) input.current.value = ""; await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit proof."); }
    finally { setBusy(false); }
  };

  const latest = data?.requests[0];
  const pending = data?.requests.find((request) => request.status === "pending");
  const qr = data?.settings.qr_image_url;
  const refreshStatus = async () => {
    setLoading(true); setError("");
    try { await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not refresh payment status."); }
    finally { setLoading(false); }
  };
  return <section className="rounded-[26px] border border-white/[.09] bg-[#151916] p-5 shadow-[0_24px_80px_-32px_rgba(0,0,0,.85)] sm:p-6" aria-labelledby="checkout-title">
    <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-primary">Secure checkout</p><h2 id="checkout-title" className="mt-2 font-display text-2xl font-semibold tracking-tight">Get Premium</h2><p className="mt-1 text-xs text-white/45">$3 · one-time payment</p></div><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.08] bg-white/[.035] text-primary"><QrCode className="h-5 w-5"/></span></div>
    {error && <div role="alert" className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[.06] p-3 text-xs leading-relaxed text-red-100">{error}</div>}
    {saved && <div role="status" className="mt-4 rounded-xl border border-primary/20 bg-primary/[.07] p-3 text-xs text-primary">Receipt received. Your request is now in the review queue.</div>}
    {pending ? <div className="mt-5 rounded-2xl border border-amber-200/15 bg-amber-100/[.045] p-4"><div className="flex items-center gap-2 text-sm font-medium text-amber-100"><Clock3 className="h-4 w-4"/>Awaiting payment review</div><p className="mt-2 text-xs leading-relaxed text-white/50">Submitted {new Date(pending.created_at).toLocaleString()}. We’ll update your access once it’s reviewed.</p><button type="button" onClick={() => void refreshStatus()} disabled={loading} className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-amber-100/15 px-3 text-[11px] text-amber-50/80 disabled:opacity-50">{loading ? <LoaderCircle className="h-3 w-3 animate-spin"/> : <Clock3 className="h-3 w-3"/>}Check review status</button></div> : latest?.status === "approved" ? <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/[.06] p-4"><p className="flex items-center gap-2 text-sm font-medium text-primary"><Check className="h-4 w-4"/>Premium active</p><p className="mt-1 text-xs text-white/50">Your payment has been approved.</p></div> : <>
      <div className="mt-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.13em] text-white/55"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">1</span>Scan to pay</div>
      <div className="mt-3 flex min-h-[230px] flex-col items-center justify-center rounded-2xl border border-white/[.07] bg-[#0c0e0d] p-5 text-center">{loading ? <LoaderCircle className="h-6 w-6 animate-spin text-primary"/> : qr && !qrFailed ? <img src={qr} alt="Scan this payment QR code to pay $3" className="max-h-48 max-w-full rounded-lg bg-white p-2" onError={() => setQrFailed(true)}/> : <><QrCode className="h-9 w-9 text-white/30"/><p className="mt-3 text-sm font-medium">{qrFailed ? "QR image unavailable" : "Payment QR is being set up"}</p><p className="mt-1 max-w-[270px] text-xs leading-relaxed text-white/40">{qrFailed ? "Please contact Sangeet support or try again later." : "The payment option will appear here once it is configured."}</p></>}</div>
      {data?.settings.payment_instructions && <div className="mt-3 rounded-xl border border-white/[.07] bg-white/[.025] p-3.5"><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-white/40">Payment instructions</p><p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-white/75">{data.settings.payment_instructions}</p></div>}
      <div className="mt-5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.13em] text-white/55"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[.1] text-[10px]">2</span>Send your receipt</div>
      {!signedIn ? <div className="mt-3 rounded-xl border border-white/[.08] bg-white/[.025] p-4"><p className="text-xs leading-relaxed text-white/65">Sign in to attach your receipt and track the review.</p><Link href="/welcome?next=%2Fpremium" className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110">Sign in to continue</Link></div> : <div className="mt-3 space-y-3">
        {latest?.status === "rejected" && <p className="rounded-xl border border-red-200/15 bg-red-200/[.04] p-3 text-xs text-red-100">The previous receipt was not approved.{latest.review_note ? ` ${latest.review_note}` : " You can submit another receipt."}</p>}
        <label className="block text-[11px] font-medium text-white/65">Transaction reference <span className="font-normal text-white/35">(optional)</span><input value={reference} onChange={(event) => setReference(event.target.value)} maxLength={120} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15" placeholder="Reference or transaction ID" /></label>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button type="button" onClick={() => input.current?.click()} disabled={!qr || qrFailed || loading} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-white/15 px-3 text-left transition hover:border-primary/45 disabled:cursor-not-allowed disabled:opacity-45"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[.05] text-primary"><Upload className="h-4 w-4"/></span><span className="min-w-0 flex-1 truncate text-xs font-medium">{file ? file.name : "Choose receipt or screenshot"}<span className="mt-0.5 block text-[10px] font-normal text-white/40">JPG, PNG, WebP or PDF · up to 5 MB</span></span></button>
        <button type="button" onClick={() => void submit()} disabled={busy || !file || !qr || qrFailed || loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <FileCheck2 className="h-4 w-4"/>}{busy ? "Submitting receipt…" : "Submit payment for review"}</button>
      </div>}
      <p className="mt-4 text-center text-[10px] leading-relaxed text-white/35">Your receipt is private and visible only to authorized Sangeet administrators. Premium is enabled after manual verification.</p>
    </>}
  </section>;
}
