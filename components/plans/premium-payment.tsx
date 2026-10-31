"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Crown, LoaderCircle, QrCode, Upload } from "lucide-react";

type PaymentRequest = { id: string; status: "pending" | "approved" | "rejected"; review_note?: string; created_at: string };
type Payload = { settings: { amount_usd: number; qr_image_url: string; payment_instructions: string }; requests: PaymentRequest[]; error?: string };

export function PremiumPayment({ signedIn }: { signedIn: boolean }) {
  const [data, setData] = useState<Payload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = async () => {
    const response = await fetch("/api/premium/payments", { cache: "no-store" });
    const payload = await response.json() as Payload;
    if (!response.ok) throw new Error(payload.error || "Premium payment details are unavailable.");
    setData(payload);
  };
  useEffect(() => { void load().catch((e) => setError(e instanceof Error ? e.message : "Could not load payment options.")); }, []);
  const submit = async () => {
    if (!file) { setError("Choose a payment receipt or screenshot first."); return; }
    setBusy(true); setError(""); setSaved(false);
    try {
      const form = new FormData(); form.set("proof", file); form.set("reference", reference);
      const response = await fetch("/api/premium/payments", { method: "POST", body: form });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not submit proof.");
      setSaved(true); setFile(null); setReference(""); if (input.current) input.current.value = ""; await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit proof."); }
    finally { setBusy(false); }
  };
  const pending = data?.requests.find((item) => item.status === "pending");
  return <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[.09] via-white/[.025] to-transparent p-6 sm:p-8">
    <div className="flex items-start justify-between gap-4"><div><span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary"><Crown className="h-3.5 w-3.5" /> Sangeet Premium</span><h2 className="mt-4 font-display text-3xl font-semibold">More of the music you love.</h2><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Premium access is $3. Pay using the configured QR code, then send your receipt for a manual review.</p></div><div className="shrink-0 text-right"><span className="font-display text-4xl font-bold">$3</span><p className="text-[10px] text-muted-foreground">one-time access request</p></div></div>
    {error && <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-300/[.05] p-3 text-sm text-red-100">{error}</p>}
    {saved && <p role="status" className="mt-5 rounded-xl border border-primary/20 bg-primary/[.06] p-3 text-sm text-primary">Payment submitted. You’ll see the review status here.</p>}
    {pending ? <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200/15 bg-amber-100/[.04] p-4"><Clock3 className="mt-0.5 h-4 w-4 text-amber-200"/><div><p className="text-sm font-medium text-amber-100">Payment awaiting review</p><p className="mt-1 text-xs text-white/50">Submitted {new Date(pending.created_at).toLocaleString()}.</p></div></div> : <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(210px,.8fr)_1.2fr]">
      <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/20 p-5 text-center">{data?.settings.qr_image_url ? <img src={data.settings.qr_image_url} alt="Payment QR code" className="max-h-56 w-auto rounded-xl bg-white p-2" /> : <><QrCode className="h-10 w-10 text-primary/70"/><p className="mt-3 text-sm font-medium">Payment QR not set up</p><p className="mt-1 max-w-xs text-xs text-muted-foreground">The administrator needs to add the payment QR in the Admin · Payments page.</p></>}</div>
      <div className="space-y-4">{data?.settings.payment_instructions && <p className="whitespace-pre-wrap rounded-xl border border-white/[.07] bg-black/15 p-4 text-sm leading-relaxed text-white/70">{data.settings.payment_instructions}</p>}
        {!signedIn ? <div className="rounded-xl border border-white/[.08] p-4"><p className="text-sm">Sign in before submitting proof.</p><Link href="/welcome?next=%2Fplans" className="mt-3 inline-flex h-10 items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground">Sign in to continue</Link></div> : <>
          <label className="block text-xs font-medium text-white/65">Payment reference (optional)<input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm outline-none focus:border-primary/50" placeholder="Transaction ID" /></label>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => input.current?.click()} className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-dashed border-white/15 px-4 text-left text-sm hover:border-primary/40"><Upload className="h-4 w-4 text-primary"/><span className="truncate">{file ? file.name : "Upload receipt or payment screenshot"}<span className="block text-[10px] text-white/40">JPG, PNG, WebP or PDF · up to 5 MB</span></span></button>
          <button type="button" onClick={() => void submit()} disabled={busy || !data?.settings.qr_image_url} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-45">{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}{busy ? "Submitting…" : "Submit for review"}</button>
        </>}
      </div>
    </div>}
    {data?.requests.filter((request) => request.status !== "pending").map((request) => <div key={request.id} className="mt-4 rounded-xl border border-white/[.07] p-4 text-sm"><span className="capitalize">Request {request.status}</span>{request.review_note && <p className="mt-1 text-xs text-muted-foreground">{request.review_note}</p>}</div>)}
  </section>;
}
