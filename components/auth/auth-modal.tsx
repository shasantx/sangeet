"use client";

import { Music } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { Dialog, DialogContent } from "@/components/ui/dialog";

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09a7 7 0 0 1 0-4.18V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.85z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

export function AuthModal() {
  const isOpen = useAuthStore((state) => state.authModalOpen);
  const activeTab = useAuthStore((state) => state.authModalTab);
  const closeAuthModal = useAuthStore((state) => state.closeAuthModal);

  const handleGoogleSignIn = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    window.location.assign(`/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAuthModal()}>
      <DialogContent className="overflow-hidden rounded-2xl border-white/[.08] bg-[#14130f] p-0 text-white shadow-2xl sm:max-w-[440px]">
        <div className="p-8 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-black">
            <Music className="h-5 w-5" />
          </div>
          <p className="eyebrow mb-2">Sangeet account</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            {activeTab === "signup" ? "Make music yours" : "Welcome back"}
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-white/55">
            Sign in securely with Google to connect your listener profile.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mt-7 inline-flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white text-sm font-semibold text-[#202124] transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#14130f]"
          >
            <GoogleMark /> Continue with Google
          </button>
          <div className="my-6 border-t border-white/[.08]" />
          <p className="text-xs leading-relaxed text-white/45">
            Passwords and password resets are managed by Google. Browse and play the available catalog without signing in.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
