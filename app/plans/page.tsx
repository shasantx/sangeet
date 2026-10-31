import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, Check } from "lucide-react";
import { PremiumPayment } from "@/components/plans/premium-payment";
import { verifySession } from "@/lib/google-auth";

const freeFeatures = ["Search and listen across the catalog", "On-device playlists, likes, and history", "Queue, shuffle, repeat, and player controls"];

export default async function PlansPage() {
  const cookieStore = await cookies();
  const signedIn = Boolean(verifySession(cookieStore.get("aura_session")?.value));
  return <main className="page-container max-w-[1080px] pt-10">
    <p className="eyebrow mb-3">Plans</p><h1 className="max-w-2xl text-4xl font-semibold tracking-[-.045em] sm:text-5xl">A clear plan for listening.</h1><p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">Choose the listening experience that fits you. Premium requests are reviewed by a Sangeet administrator.</p>
    <div className="mt-9 grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-white/[.07] bg-white/[.02] p-6 sm:p-8"><p className="eyebrow">Start here</p><h2 className="mt-3 font-display text-3xl font-semibold">Free</h2><p className="mt-2 text-sm text-muted-foreground">No payment details required.</p><ul className="mt-7 space-y-3">{freeFeatures.map((feature) => <li key={feature} className="flex gap-2.5 text-sm text-foreground/80"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{feature}</li>)}</ul><Link href="/explore" className="mt-8 inline-flex h-11 items-center gap-2 rounded-full border border-white/10 px-5 text-sm font-semibold transition hover:bg-white/[.05]">Explore music <ArrowRight className="h-4 w-4" /></Link></section>
      <PremiumPayment signedIn={signedIn} />
    </div>
    <p className="mt-5 text-xs text-muted-foreground">Premium access is activated only after an administrator verifies the submitted proof. Offline downloads remain limited to Sangeet-hosted tracks; imported personal audio stays on your device.</p>
  </main>;
}
