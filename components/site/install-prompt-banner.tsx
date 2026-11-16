"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { isAndroidNativeApp } from "@/lib/android-bridge";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sangeet-install-banner-dismissed";
const APK_URL = "/api/download/android";

export function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAndroidNativeApp()) return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Ignore storage errors.
    }

    const ua = window.navigator.userAgent;
    const iosDevice = /iPad|iPhone|iPod/.test(ua);
    const androidDevice = /Android/i.test(ua);
    setIsIos(iosDevice);

    if (iosDevice || androidDevice) {
      setVisible(true);
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Ignore storage errors.
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#121513] px-4 py-3 text-xs">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1ed760]/15 text-[#1ed760]">
          <Smartphone className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white">Listen in the background on mobile</p>
          <p className="text-muted-foreground truncate">
            {isIos
              ? "Tap Share → Add to Home Screen for lock-screen controls and background audio."
              : "Install Sangeet to your home screen or get the Android APK for background playback."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1ed760] px-3.5 text-[11px] font-bold text-black transition hover:bg-[#1db954]"
          >
            <Download className="h-3.5 w-3.5" />
            Add to Home Screen
          </button>
        )}
        {!isIos && !deferredPrompt && (
          <a
            href={APK_URL}
            download="sangeet-android.apk"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#1ed760] px-3.5 text-[11px] font-bold text-black transition hover:bg-[#1db954]"
          >
            <Download className="h-3.5 w-3.5" />
            Android APK
          </a>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install banner"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
