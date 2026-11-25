import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-full bg-encore-base">
      <div className="mx-auto max-w-3xl space-y-6 p-4 pb-16 text-sm leading-relaxed text-encore-subdued sm:p-6">
        <div>
          <Link href="/" className="text-xs font-semibold text-encore-accent hover:underline">
            ← Back to Sangeet
          </Link>
          <h1 className="mt-3 text-3xl font-black text-encore-text">Privacy Policy</h1>
          <p className="mt-1 text-xs text-encore-muted">Effective: 2026 • Sangeet Open-Source Project</p>
        </div>

        <section className="space-y-2 rounded-2xl border border-encore-hairline bg-encore-elevated p-5">
          <h2 className="text-base font-bold text-encore-text">1. Local-First Storage</h2>
          <p>
            Sangeet works in Guest and Local Profile modes without requiring an
            account. Your liked songs, custom playlists, listening statistics, EQ
            settings, and offline audio files are stored locally in your browser
            (localStorage and IndexedDB) and can be exported or cleared at any
            time in Settings.
          </p>
        </section>

        <section className="space-y-2 rounded-2xl border border-encore-hairline bg-encore-elevated p-5">
          <h2 className="text-base font-bold text-encore-text">2. Optional Google Sign-In</h2>
          <p>
            If you choose to sign in with Google on a deployment where OAuth is
            configured, Sangeet reads only your basic profile (name, email, avatar)
            to store an HTTP-only session cookie. No external database is used—your
            music library, suggestions cache, and offline audio stay strictly on
            your device.
          </p>
        </section>

        <section className="space-y-2 rounded-2xl border border-encore-hairline bg-encore-elevated p-5">
          <h2 className="text-base font-bold text-encore-text">3. Third-Party Media Services</h2>
          <p>
            Streaming playback uses YouTube&apos;s official IFrame Player API,
            synchronized lyrics are queried from LRCLIB, optional segment skipping
            uses SponsorBlock, and open-licensed audio downloads use the public
            Audius API. Those services are governed by their respective privacy
            policies.
          </p>
        </section>
      </div>
    </div>
  );
}
