"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Moon,
  ShieldCheck,
  Sun,
  User
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import { usePlatform } from "@/lib/platform";
import { cn } from "@/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-[18px] w-[18px] shrink-0", className)}
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.08.72-2.45 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.25v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.25a12 12 0 0 0 0 10.74l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.25 6.63l4 3.1c.95-2.85 3.61-4.97 6.75-4.97Z"
      />
    </svg>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const { isNative } = usePlatform();

  const enterAsGuest = useAuthStore((s) => s.enterAsGuest);
  const enterAsLocal = useAuthStore((s) => s.enterAsLocal);
  const googleConfigured = useAuthStore((s) => s.googleConfigured);
  const syncSession = useAuthStore((s) => s.syncSession);

  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  const [name, setName] = useState("");

  useEffect(() => {
    void syncSession();
  }, [syncSession]);

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enterAsLocal(name.trim() || "Music Listener");
    router.push("/home");
  };

  const handleGuest = () => {
    enterAsGuest();
    router.push("/home");
  };

  const isDark = theme === "dark";

  return (
    <div className="zentra-aurora-mesh relative flex min-h-[100dvh] w-full flex-col overflow-hidden text-encore-text">
      {/* Subtle static ambient atmospheric cobalt backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[120px]",
          isDark
            ? "bg-[radial-gradient(circle,rgba(37,99,235,0.2)_0%,rgba(126,171,255,0.06)_48%,transparent_72%)]"
            : "bg-[radial-gradient(circle,rgba(59,130,246,0.14)_0%,rgba(147,197,253,0.1)_48%,transparent_72%)]"
        )}
      />

      {/* Minimal Top Bar */}
      <header className="relative z-10 mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href={isNative ? "/home" : "/"}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium text-encore-subdued transition-colors duration-150 hover:bg-encore-hover hover:text-encore-text"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          <span>{isNative ? "Back to Home" : "Back to Sangeet"}</span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            isDark ? "Switch to light theme" : "Switch to dark theme"
          }
          className="flex h-10 w-10 items-center justify-center rounded-full bg-encore-base/70 text-encore-accent backdrop-blur-md transition-colors duration-150 hover:bg-encore-elevated-highlight"
        >
          {isDark ? (
            <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} />
          ) : (
            <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />
          )}
        </button>
      </header>

      {/* Centered Obsidian / Porcelain Sign-In Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-12 pt-4 sm:px-6">
        <div
          className={cn(
            "studio-enter w-full max-w-[428px] rounded-3xl bg-encore-base/85 p-7 backdrop-blur-2xl sm:p-9",
            isDark
              ? "shadow-[0_24px_70px_rgba(0,0,0,0.45)]"
              : "shadow-[0_24px_64px_rgba(15,23,42,0.12)]"
          )}
        >
          {/* Brand Mark + Heading */}
          <div className="flex flex-col items-center text-center">
            <span className="btn-cobalt flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-black tracking-tight text-white">
              S
            </span>
            <h1 className="mt-5 text-2xl font-semibold tracking-[-0.025em] text-encore-text sm:text-[28px]">
              Welcome to Sangeet
            </h1>
            <p className="mt-2 max-w-[300px] text-sm leading-6 text-encore-subdued">
              Stream ad-free audio, read synced lyrics, and keep your music
              offline
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl bg-encore-negative/12 px-4 py-3 text-xs leading-5 text-encore-negative">
              {error === "google_not_configured"
                ? "Google OAuth keys are not configured in this environment. Continue as a guest or create a local profile below."
                : "Sign-in could not be completed. Continue as a guest or create a local profile below."}
            </div>
          )}

          {/* Primary Actions */}
          <div className="mt-7 space-y-3">
            <button
              type="button"
              onClick={handleGuest}
              className="btn-cobalt flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white"
            >
              <span>Continue as guest</span>
              <ArrowRight className="h-4 w-4" strokeWidth={1.85} />
            </button>

            <a
              href="/api/auth/google"
              className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-encore-elevated px-5 text-sm font-medium text-encore-text transition-colors duration-150 hover:bg-encore-elevated-highlight active:scale-[0.985]"
            >
              <GoogleIcon />
              <span>
                Continue with Google
                {!googleConfigured ? " (keys required)" : ""}
              </span>
            </a>
          </div>

          {/* Subtle Tonal Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-encore-hairline" />
            <span className="text-xs font-medium text-encore-muted">
              or create a local profile
            </span>
            <div className="h-px flex-1 bg-encore-hairline" />
          </div>

          {/* Local Profile Form */}
          <form onSubmit={handleLocalSubmit} className="space-y-3.5">
            <label className="block">
              <span className="mb-2 block text-xs font-medium text-encore-subdued">
                Display name
              </span>
              <div className="flex h-12 items-center gap-2.5 rounded-2xl bg-encore-elevated px-4 transition-shadow duration-150 focus-within:ring-2 focus-within:ring-encore-accent/45">
                <User
                  className="h-4 w-4 shrink-0 text-encore-muted"
                  strokeWidth={1.7}
                />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="nickname"
                  className="w-full bg-transparent text-sm text-encore-text placeholder:text-encore-muted outline-none"
                />
              </div>
            </label>

            <button
              type="submit"
              className="flex h-11 w-full items-center justify-center rounded-full bg-encore-tinted px-5 text-sm font-semibold text-encore-accent transition-colors duration-150 hover:bg-encore-tinted-highlight active:scale-[0.985]"
            >
              Start listening
            </button>
          </form>

          {/* Local-first Privacy Note */}
          <p className="mt-7 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-encore-muted">
            <ShieldCheck
              className="h-3.5 w-3.5 shrink-0 text-encore-accent/80"
              strokeWidth={1.8}
            />
            <span>
              Local-first storage — your playlists, likes, and history stay on
              your device
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-encore-shell" />}>
      <AuthContent />
    </Suspense>
  );
}
