import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";

export const metadata = {
  title: "Terms of Service · Sangeet",
  description:
    "Terms of Service for using Sangeet across Web, Windows, and Android.",
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground transition hover:bg-elevated"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sangeet
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <SangeetMark size={24} />
            <span>Sangeet Music</span>
          </div>
        </div>

        <article className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-10">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Terms of Service
              </h1>
              <p className="text-xs text-muted-foreground">
                Effective date: November 18, 2026 · sangeet.shasant.xyz
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using Sangeet (<strong className="text-foreground">https://sangeet.shasant.xyz</strong>)
                on Web, Windows, or Android, you agree to these Terms of Service and our{" "}
                <Link href="/privacy" className="text-primary underline underline-offset-4">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                2. Description of Service
              </h2>
              <p>
                Sangeet is a personal, ad-free music player and discovery client that lets you
                organize playlists, play local audio files, and stream or discover music via
                supported third-party services including YouTube and Audius.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                3. Google &amp; YouTube Integration
              </h2>
              <p>
                If you choose to sign in with Google or connect your YouTube account, Sangeet
                requests read-only access (<code className="text-foreground">youtube.readonly</code>)
                solely to show your liked music, playlists, and personalized recommendations. Use of
                YouTube content is also subject to the{" "}
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  YouTube Terms of Service
                </a>
                .
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                4. Acceptable Use
              </h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Use Sangeet for personal, non-commercial listening only.</li>
                <li>Do not attempt to abuse, overload, or bypass security controls on our APIs.</li>
                <li>Respect the copyrights and terms of third-party content providers.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                5. Availability &amp; Disclaimer
              </h2>
              <p>
                Sangeet is provided &ldquo;as is&rdquo; without warranties of uninterrupted
                availability. Features that depend on third-party APIs (such as YouTube or Audius)
                may change or become unavailable based on upstream service limits.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                6. Contact
              </h2>
              <p>
                Questions about these Terms can be directed to the developer via{" "}
                <a
                  href="https://shasant.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  https://shasant.xyz
                </a>
                .
              </p>
            </section>
          </div>
        </article>
      </div>
    </main>
  );
}
