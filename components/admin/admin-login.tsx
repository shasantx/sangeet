"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/store/ui-store";

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

export function AdminLogin({ currentEmail }: { currentEmail?: string }) {
  const router = useRouter();
  const loginWithEmail = useAuthStore((state) => state.loginWithEmail);

  const [email, setEmail] = useState(currentEmail ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    currentEmail ? `${currentEmail} does not have admin access.` : "",
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Enter your admin email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          requireAdmin: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Access denied.");
        setSubmitting(false);
        return;
      }
      loginWithEmail(cleanEmail, undefined, true);
      toast.success("Admin Console unlocked");
      router.refresh();
    } catch {
      setError("Could not sign in. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[#090c0a] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111512] p-6 shadow-2xl sm:p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SangeetMark size={28} />
            <span className="font-display text-base font-bold text-white">Sangeet Admin</span>
          </div>
          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[.06] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>
        </div>

        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">Admin Sign In</h1>
        <p className="mt-1 text-xs text-white/50">Only admin emails can access this console.</p>

        {error && (
          <p className="mt-4 rounded-xl border border-red-400/25 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-medium text-white/75">
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="mt-1.5 h-11 w-full rounded-2xl border border-white/15 bg-white/[.04] px-4 text-sm text-white placeholder:text-white/30 focus:border-[#1ed760] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-medium text-white/75">
              Password
            </label>
            <div className="relative mt-1.5">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="h-11 w-full rounded-2xl border border-white/15 bg-white/[.04] px-4 pr-10 text-sm text-white placeholder:text-white/30 focus:border-[#1ed760] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/45 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-2xl bg-[#1ed760] text-sm font-bold text-black transition hover:bg-[#1db954] disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="relative my-5 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative bg-[#111512] px-3 text-[11px] text-white/40">Or</span>
        </div>

        <a
          href="/api/auth/google?returnTo=%2Fadmin"
          className="flex h-11 w-full items-center justify-center gap-2.5 rounded-2xl bg-white px-4 text-sm font-semibold text-[#111512] transition hover:bg-white/90"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </a>
      </div>
    </div>
  );
}
