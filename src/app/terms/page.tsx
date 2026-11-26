import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-full bg-encore-base">
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16 text-sm leading-relaxed text-encore-subdued sm:p-6">
        <div>
          <Link href="/" className="text-xs font-semibold text-encore-accent hover:underline">
            ← Back to Dhun
          </Link>
          <h1 className="mt-3 text-3xl font-black text-encore-text">Terms of Use</h1>
          <p className="mt-1 text-xs text-encore-muted">MIT Licensed Open-Source Software</p>
        </div>

        <section className="space-y-2 rounded-2xl border border-encore-hairline bg-encore-elevated p-5">
          <h2 className="text-base font-bold text-encore-text">1. Open-Source License</h2>
          <p>
            Dhun is free, open-source software licensed under the MIT License
            and provided &ldquo;as is&rdquo;, without warranty of any kind.
          </p>
        </section>

        <section className="space-y-2 rounded-2xl border border-encore-hairline bg-encore-elevated p-5">
          <h2 className="text-base font-bold text-encore-text">2. Media Rights &amp; Downloads</h2>
          <p>
            YouTube tracks are played strictly via YouTube&apos;s official IFrame
            Player API and are not extracted or downloaded. Offline downloads in
            Dhun are restricted to user-supplied local audio files and
            open-licensed audio sources (such as Audius) that permit direct
            streaming/downloading.
          </p>
        </section>

        <section className="space-y-2 rounded-2xl border border-encore-hairline bg-encore-elevated p-5">
          <h2 className="text-base font-bold text-encore-text">3. Independence</h2>
          <p>
            Dhun is an independent community project and is not affiliated with
            or endorsed by any commercial streaming platform.
          </p>
        </section>
      </div>
    </div>
  );
}
