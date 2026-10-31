import Link from "next/link";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";

const freeFeatures = [
  "Browse the Sangeet sample catalog",
  "Search and listen across the catalog",
  "On-device playlists, likes, and history",
  "Queue, shuffle, repeat, and player controls",
];

export default function PlansPage() {
  const billingReady = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && process.env.STRIPE_PRICE_ID);

  return (
    <main className="page-container max-w-[1080px] pt-10">
      <p className="eyebrow mb-3">Plans</p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-[-.045em] sm:text-5xl">A clear plan for listening.</h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">The current Sangeet experience is free. Any future paid plan will require a configured billing provider and eligible licensed playback features.</p>

      <div className="mt-9 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-primary/25 bg-primary/[.045] p-6 sm:p-8">
          <p className="eyebrow text-primary">Available now</p>
          <h2 className="mt-3 font-display text-3xl font-semibold">Free</h2>
          <p className="mt-2 text-sm text-muted-foreground">No payment details required.</p>
          <ul className="mt-7 space-y-3">{freeFeatures.map((feature) => <li key={feature} className="flex gap-2.5 text-sm text-foreground/80"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul>
          <Link href="/explore" className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110">Explore music <ArrowRight className="h-4 w-4" /></Link>
        </section>

        <section className="rounded-2xl border border-white/[.07] bg-white/[.02] p-6 sm:p-8">
          <p className="eyebrow">Planned</p>
          <h2 className="mt-3 font-display text-3xl font-semibold">Premium</h2>
          <p className="mt-2 text-sm text-muted-foreground">Not available for purchase.</p>
          <div className="mt-7 flex items-start gap-3 rounded-xl border border-white/[.06] bg-black/10 p-4">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm leading-relaxed text-muted-foreground">{billingReady ? "Billing credentials are present, but subscription checkout and entitlement storage have not been activated." : "Billing is not configured. Sangeet will not collect payment or claim an upgrade succeeded."}</p>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Premium listening will require licensed catalog access and a configured billing provider.</p>
          <button type="button" disabled className="mt-8 h-11 cursor-not-allowed rounded-full border border-white/10 px-5 text-sm font-medium text-muted-foreground opacity-60">Premium unavailable</button>
        </section>
      </div>
    </main>
  );
}
