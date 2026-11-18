import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";

export const metadata = {
  title: "Privacy Policy · Sangeet",
  description:
    "How Sangeet collects, uses, stores, and protects your Google account and YouTube Music data.",
};

export default function PrivacyPolicyPage() {
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
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Privacy Policy
              </h1>
              <p className="text-xs text-muted-foreground">
                Effective date: November 18, 2026 · sangeet.shasant.xyz
              </p>
            </div>
          </div>

          <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                1. Overview
              </h2>
              <p>
                Sangeet (<strong className="text-foreground">https://sangeet.shasant.xyz</strong>) is
                an ad-free music streaming application across Web, Windows, and Android. This Privacy
                Policy explains what information Sangeet accesses when you sign in or connect your
                YouTube account, how that information is used, and how you can control or delete it.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                2. Information We Collect and Access
              </h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong className="text-foreground">Google Account Profile:</strong> When you sign
                  in with Google, Sangeet receives your basic OpenID profile information (name, email
                  address, and profile picture) to identify your session and display your account.
                </li>
                <li>
                  <strong className="text-foreground">YouTube Read-Only Data (Optional):</strong>{" "}
                  When you grant the <code className="text-foreground">youtube.readonly</code>{" "}
                  permission, Sangeet accesses your liked music videos, YouTube playlists, and
                  channel metadata via the YouTube Data API v3 solely to display your library and
                  generate personalized music recommendations inside Sangeet.
                </li>
                <li>
                  <strong className="text-foreground">Library &amp; Playback Preferences:</strong>{" "}
                  Liked tracks, playlists, theme preferences, and playback history may be stored
                  locally on your device and, if account sync is enabled, securely associated with
                  your signed-in account.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                3. How We Use Your Data
              </h2>
              <p>Sangeet uses your Google and YouTube data strictly to:</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Authenticate your Sangeet session across Web, Desktop, and Android.</li>
                <li>Display your YouTube Music likes, playlists, and personalized song suggestions.</li>
                <li>Sync your Sangeet library, liked tracks, and appearance settings.</li>
              </ul>
              <p>
                Sangeet does <strong className="text-foreground">not</strong> sell your personal data,
                serve targeted advertisements, or share your Google/YouTube data with third-party
                data brokers or AI training pipelines.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                4. Google API Services User Data Policy
              </h2>
              <p>
                Sangeet&apos;s use and transfer to any other app of information received from Google
                APIs adheres to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. Sangeet only requests read-only YouTube
                access (<code className="text-foreground">youtube.readonly</code>) and never
                modifies, deletes, or posts content on your YouTube account.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                5. Data Storage, Security &amp; Retention
              </h2>
              <p>
                Session cookies are signed and marked <code className="text-foreground">HttpOnly</code>{" "}
                and <code className="text-foreground">Secure</code>. OAuth refresh tokens are
                encrypted at rest using AES-256-GCM. Data is retained only while your account
                connection remains active or until you sign out or revoke access.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                6. Revoking Access &amp; Deleting Data
              </h2>
              <p>
                You can sign out at any time from Sangeet Settings, disconnect your YouTube account,
                or revoke Sangeet&apos;s access directly from your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  Google Account Permissions
                </a>{" "}
                page.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-display text-base font-semibold text-foreground">
                7. Contact
              </h2>
              <p>
                For privacy questions or data deletion requests, contact the developer at{" "}
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
