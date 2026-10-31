"use client";

import { useEffect, useState } from "react";
import { ExternalLink, HeartHandshake, QrCode } from "lucide-react";

interface DonationSettings {
  donation_enabled?: boolean;
  donation_qr_image_url?: string;
  donation_instructions?: string;
}

export function DonationSection() {
  const [settings, setSettings] = useState<DonationSettings | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/premium/payments", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ settings?: DonationSettings }> : null)
      .then((body) => { if (active) setSettings(body?.settings ?? {}); })
      .catch(() => { if (active) setSettings({}); });
    return () => { active = false; };
  }, []);

  const enabled = settings?.donation_enabled === true;
  return <section aria-labelledby="support-project-title" className="px-5 pb-16 sm:px-8 sm:pb-24">
    <div className="relative mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[28px] border border-white/[.08] bg-[#101410] p-6 sm:rounded-[34px] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_50%,rgba(30,215,96,.12),transparent_42%)]" />
      <div className="relative max-w-2xl">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><HeartHandshake className="h-5 w-5" /></span>
        <p className="eyebrow mt-5 text-primary">Open source, made with care</p>
        <h2 id="support-project-title" className="mt-2 font-display text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Like this project? Support its next note.</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-white/50">Sangeet is an independent project. If it has made your listening day better, you can support its development or explore the code on GitHub.</p>
        <a href="https://github.com/shasantx/sangeet" target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold transition hover:border-primary/50 hover:text-primary">View the open source project <ExternalLink className="h-4 w-4" /></a>
      </div>
      <div className="relative flex min-w-0 flex-col gap-3 rounded-2xl border border-white/[.08] bg-black/20 p-4 sm:min-w-[300px] sm:p-5">
        {enabled ? <>
          <div className="flex items-center gap-2 text-sm font-semibold"><QrCode className="h-4 w-4 text-primary" />Support Sangeet</div>
          {settings?.donation_qr_image_url ? <img src={settings.donation_qr_image_url} alt="Scan to support the Sangeet project" loading="lazy" className="mx-auto max-h-48 max-w-full rounded-xl bg-white p-2" /> : null}
          <p className="whitespace-pre-line text-xs leading-5 text-white/60">{settings?.donation_instructions || "Use the payment option you prefer to support the project."}</p>
        </> : <>
          <div className="flex items-center gap-2 text-sm font-semibold"><HeartHandshake className="h-4 w-4 text-primary" />Donations are optional</div>
          <p className="text-xs leading-5 text-white/45">Payment options will appear here when configured. You can still support the project by exploring or sharing the source.</p>
        </>}
      </div>
    </div>
  </section>;
}
