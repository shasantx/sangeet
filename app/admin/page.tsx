import { cookies } from "next/headers";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, Lock, ShieldAlert, ShieldCheck } from "lucide-react";
import { adminSession } from "@/lib/admin-auth";
import { isGoogleOAuthConfigured, verifySession } from "@/lib/google-auth";
import { isAdminStorageConfigured } from "@/lib/admin-users";
import { AdminPanel } from "@/components/admin/admin-panel";
import { SangeetMark } from "@/components/brand/sangeet-mark";

export const dynamic = "force-dynamic";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a7 7 0 0 1 0-4.18V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.85z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const rawCookie = cookieStore.get("aura_session")?.value;
  const userSession = verifySession(rawCookie);
  const admin = adminSession(rawCookie);

  if (admin) {
    return <AdminPanel email={admin.email} />;
  }

  const oauthConfigured = isGoogleOAuthConfigured();
  const adminEmailsConfigured = Boolean(process.env.ADMIN_EMAILS?.trim());
  const storageConfigured = isAdminStorageConfigured();

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[#090c0a] px-4 py-10 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_65%_50%_at_50%_0%,rgba(49,215,107,0.12),transparent_70%)]"
      />

      <div className="relative w-full max-w-xl rounded-[32px] border border-white/10 bg-[#111512]/95 p-6 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <SangeetMark size={30} />
            <div>
              <span className="font-display text-base font-bold tracking-tight text-white">Sangeet</span>
              <span className="ml-2 rounded-full border border-[#31d76b]/30 bg-[#31d76b]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#8ff2ae]">
                Admin Console
              </span>
            </div>
          </div>
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[.07] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to app
          </Link>
        </div>

        {!userSession ? (
          <>
            <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#31d76b]/25 bg-[#31d76b]/10 text-[#8ff2ae]">
              <Lock className="h-6 w-6" />
            </div>
            <p className="eyebrow mt-5">Administrator Sign-In</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Sign in to Sangeet Admin
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-white/60">
              The Admin Console requires a server-verified Google OAuth session whose email is listed in{" "}
              <code className="rounded bg-white/[.06] px-1.5 py-0.5 text-xs text-white/85">ADMIN_EMAILS</code>.
              Client-only guest or email sessions cannot unlock admin controls.
            </p>

            <a
              href="/api/auth/google?returnTo=%2Fadmin"
              className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 text-sm font-semibold text-[#111512] shadow-lg transition hover:bg-white/90"
            >
              <GoogleIcon />
              <span>Continue with Google (Admin)</span>
            </a>
          </>
        ) : (
          <>
            <div className="mt-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-400/10 text-amber-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="eyebrow mt-5 text-amber-300/90">Restricted Workspace</p>
            <h1 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Admin allowlist required
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-white/60">
              You are currently signed in with Google as{" "}
              <span className="font-semibold text-white">{userSession.email}</span>, which is not listed in{" "}
              <code className="rounded bg-white/[.06] px-1.5 py-0.5 text-xs text-white/85">ADMIN_EMAILS</code>.
            </p>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-white/65">
              {adminEmailsConfigured ? (
                <p>
                  To grant this account administrator access, add{" "}
                  <code className="rounded bg-white/[.08] px-1.5 py-0.5 text-white">{userSession.email}</code> to your{" "}
                  <code className="rounded bg-white/[.08] px-1.5 py-0.5 text-white">ADMIN_EMAILS</code> environment
                  variable in Vercel (comma-separated) and redeploy, or sign in with your allowlisted Google account.
                </p>
              ) : (
                <p className="text-amber-200/90">
                  <strong className="font-semibold text-amber-200">ADMIN_EMAILS is not configured yet.</strong> Set{" "}
                  <code className="rounded bg-white/[.08] px-1.5 py-0.5 text-white">
                    ADMIN_EMAILS={userSession.email}
                  </code>{" "}
                  in your environment variables and redeploy to unlock this console.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <a
                href="/api/auth/google?returnTo=%2Fadmin"
                className="flex h-11 flex-1 items-center justify-center gap-2.5 rounded-2xl bg-white px-4 text-xs font-semibold text-[#111512] transition hover:bg-white/90 sm:text-sm"
              >
                <GoogleIcon />
                <span>Switch Google Account</span>
              </a>
              <Link
                href="/home"
                className="flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[.03] px-5 text-xs font-medium text-white/75 transition hover:bg-white/[.07] hover:text-white sm:text-sm"
              >
                Return to Sangeet
              </Link>
            </div>
          </>
        )}

        <div className="mt-7 border-t border-white/10 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Server Environment Readiness
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2 text-xs">
              {oauthConfigured ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#31d76b]" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              )}
              <span className="truncate text-white/75">Google OAuth</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2 text-xs">
              {adminEmailsConfigured ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#31d76b]" />
              ) : (
                <KeyRound className="h-4 w-4 shrink-0 text-amber-300" />
              )}
              <span className="truncate text-white/75">ADMIN_EMAILS</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2 text-xs">
              {storageConfigured ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#31d76b]" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
              )}
              <span className="truncate text-white/75">Supabase Service</span>
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
            <ShieldCheck className="h-3.5 w-3.5 text-[#31d76b]" />
            <span>Protected by HMAC-SHA256 server session cookies & strict origin verification.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
