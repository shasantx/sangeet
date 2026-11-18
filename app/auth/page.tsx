"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  Mail,
  User,
} from "lucide-react";
import { SangeetMark } from "@/components/brand/sangeet-mark";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "@/store/ui-store";

function sanitizeClientReturnTo(value: string | null | undefined, fallback = "/home"): string {
  if (!value || typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return fallback;
  }
  try {
    const base = new URL("https://sangeet.local");
    const parsed = new URL(trimmed, base);
    if (parsed.origin !== base.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function getPasswordStrength(password: string): {
  label: "Weak" | "Good" | "Strong";
  level: 1 | 2 | 3;
  barColor: string;
  textColor: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (password.length < 6 || score <= 1) {
    return {
      label: "Weak",
      level: 1,
      barColor: "bg-rose-400",
      textColor: "text-rose-300",
    };
  }
  if (score <= 3) {
    return {
      label: "Good",
      level: 2,
      barColor: "bg-amber-400",
      textColor: "text-amber-300",
    };
  }
  return {
    label: "Strong",
    level: 3,
    barColor: "bg-primary",
    textColor: "text-primary",
  };
}

function GoogleMark() {
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

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleState = searchParams?.get("google");
  const reason = searchParams?.get("reason");
  const initialTab = searchParams?.get("tab") === "signup" ? "signup" : "signin";
  const returnTo = useMemo(
    () => sanitizeClientReturnTo(searchParams?.get("returnTo"), "/home"),
    [searchParams],
  );

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const session = useAuthStore((state) => state.session);
  const loginWithEmail = useAuthStore((state) => state.loginWithEmail);
  const isAdminReturn =
    returnTo === "/admin" || returnTo.startsWith("/admin/") || returnTo.startsWith("/admin?");

  const [mode, setMode] = useState<"signin" | "signup">(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (isAdminReturn && !session?.isAdmin) {
      return;
    }
    router.replace(returnTo);
  }, [isAuthenticated, isAdminReturn, returnTo, router, session?.isAdmin]);

  const handleGoogleSignIn = () => {
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleFormLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 254) {
      toast.error("Valid email required", "Please enter a valid email address.");
      return;
    }
    if (mode === "signup" && (!name.trim() || name.trim().length > 80)) {
      toast.error("Name required", "Please enter your name (up to 80 characters).");
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          name: mode === "signup" ? name.trim().slice(0, 80) : undefined,
          requireAdmin: isAdminReturn,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        session?: { isAdmin?: boolean };
      };
      if (!res.ok) {
        setIsSubmitting(false);
        toast.error("Sign in failed", data.error || "Unable to sign in.");
        return;
      }
      const isAdmin = Boolean(data.session?.isAdmin);
      loginWithEmail(cleanEmail, mode === "signup" ? name.trim().slice(0, 80) : undefined, isAdmin);
      toast.success(
        mode === "signup" ? "Welcome to Sangeet!" : "Welcome back!",
        isAdmin ? "Admin access unlocked." : "Streaming access unlocked. Enjoy your music.",
      );
      router.replace(returnTo);
    } catch {
      setIsSubmitting(false);
      toast.error(
        "Sign in failed",
        "Could not reach the server. Please check your connection and try again.",
      );
    }
  };

  const playRequiredNotice = reason === "play_required";

  const errorMessage = useMemo(() => {
    if (googleState !== "error") return null;
    if (reason === "not_configured") {
      return "Google sign-in is unavailable. Use email and password instead.";
    }
    if (reason === "access_denied" || reason === "cancelled") {
      return "Google sign-in was cancelled.";
    }
    if (reason === "suspended") {
      return "This account has been suspended by an administrator.";
    }
    return "Could not connect to Google. Try again or use email and password.";
  }, [googleState, reason]);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  return (
    <div className="w-full min-w-0">
      <Link href="/" className="mb-6 inline-flex min-h-[48px] items-center gap-2.5 text-sm font-semibold text-foreground">
        <SangeetMark size={30} />
        <span>Sangeet</span>
      </Link>
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {mode === "signup" ? "Create account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
          {mode === "signup"
            ? "Sign up to unlock ad-free streaming, personalized mixes, and synced lyrics."
            : "Sign in to your account."}
        </p>
      </div>

      {/* Liquid Glass Segmented Switcher */}
      <div className="mt-5 grid min-w-0 grid-cols-2 gap-1 rounded-xl border border-border bg-elevated p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`min-h-[48px] truncate rounded-xl px-2 text-xs font-semibold transition sm:text-sm ${
            mode === "signin"
              ? "bg-primary text-primary-foreground shadow-[0_6px_20px_hsl(var(--primary)/0.28)]"
              : "text-muted-foreground hover:bg-elevated hover:text-foreground"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`min-h-[48px] truncate rounded-xl px-2 text-xs font-semibold transition sm:text-sm ${
            mode === "signup"
              ? "bg-primary text-primary-foreground shadow-[0_6px_20px_hsl(var(--primary)/0.28)]"
              : "text-muted-foreground hover:bg-elevated hover:text-foreground"
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Play Required Alert Banner */}
      {playRequiredNotice && (
        <div className="mt-4 flex min-w-0 items-start gap-2.5 rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-xs text-foreground backdrop-blur-md">
          <Headphones className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Sign in to continue listening.</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 flex min-w-0 items-start gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-200 backdrop-blur-md">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="min-w-0 flex-1">{errorMessage}</p>
        </div>
      )}

      {/* Email / Password Form */}
      <form onSubmit={handleFormLogin} className="mt-4 min-w-0 space-y-4">
        {mode === "signup" && (
          <div>
            <label className="block text-xs font-semibold text-foreground/85" htmlFor="auth-name">
              Your Name
            </label>
            <div className="relative mt-1.5">
              <User
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                id="auth-name"
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="h-12 min-h-[48px] w-full rounded-2xl border border-border bg-elevated/65 pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition focus:border-primary focus:bg-elevated focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-foreground/85" htmlFor="auth-email">
            Email
          </label>
          <div className="relative mt-1.5">
            <Mail
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="auth-email"
              type="email"
              value={email}
              maxLength={254}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="h-12 min-h-[48px] w-full rounded-2xl border border-border bg-elevated/65 pl-11 pr-4 text-base text-foreground placeholder:text-muted-foreground/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition focus:border-primary focus:bg-elevated focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-foreground/85" htmlFor="auth-password">
            Password
          </label>
          <div className="relative mt-1.5">
            <Lock
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="auth-password"
              type={showPassword ? "text" : "password"}
              value={password}
              maxLength={128}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="h-12 min-h-[48px] w-full rounded-2xl border border-border bg-elevated/65 pl-11 pr-12 text-base text-foreground placeholder:text-muted-foreground/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition focus:border-primary focus:bg-elevated focus:outline-none focus:ring-1 focus:ring-primary sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0.5 top-1/2 flex h-12 min-h-[48px] w-12 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-white/[0.08] hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {mode === "signup" && password.length > 0 && (
            <div className="mt-2.5 space-y-1.5" aria-live="polite">
              <div className="grid grid-cols-3 gap-1.5">
                {[1, 2, 3].map((step) => (
                  <span
                    key={step}
                    className={`h-1.5 rounded-full transition-colors ${
                      passwordStrength.level >= step
                        ? passwordStrength.barColor
                        : "bg-white/[0.1]"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Password strength</span>
                <span className={`font-semibold ${passwordStrength.textColor}`}>
                  {passwordStrength.label}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Primary Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="min-h-[48px] w-full rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_12px_32px_hsl(var(--primary)/0.28)] transition hover:scale-[1.01] hover:brightness-110 active:scale-[0.99] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isSubmitting
            ? "Signing in..."
            : mode === "signup"
              ? "Create account"
              : "Sign In"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Google Sign-In Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="group flex min-h-[48px] w-full items-center justify-center gap-3 rounded-2xl border border-white/25 bg-white px-4 py-2.5 text-sm font-semibold text-[#1f2024] shadow-md transition hover:scale-[1.01] hover:bg-[#f2f4f2] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <GoogleMark />
        <span>Continue with Google</span>
      </button>

      {/* Guest / Platform Footer */}
    </div>
  );
}

export default function AuthPage() {
  return (
    <main className="relative isolate flex min-h-dvh w-full max-w-full min-w-0 items-start justify-center bg-background px-4 py-6 text-foreground sm:items-center sm:p-8">
      {/* Layered Studio Ambient Glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_75%_55%_at_18%_0%,hsl(var(--primary)/0.16),transparent_62%),radial-gradient(ellipse_60%_50%_at_88%_100%,rgba(99,102,241,0.14),transparent_62%),radial-gradient(ellipse_55%_40%_at_50%_50%,rgba(255,255,255,0.025),transparent_70%)]"
      />

      {/* Main Liquid Glass Split Card */}
      <div className="relative z-10 my-auto w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-card sm:p-8">
        <Suspense
          fallback={
            <div className="flex w-full flex-col justify-center py-12 text-center text-sm text-muted-foreground">
              Loading sign in...
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </div>
    </main>
  );
}
