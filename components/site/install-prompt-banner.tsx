"use client";

import { useEffect, useState } from "react";
import { Download, Laptop, Smartphone, X } from "lucide-react";
import { isNativeOfflineSupported } from "@/lib/offline-audio";

const DISMISS_KEY = "sangeet-native-app-banner-dismissed";
const APK_URL = "/api/download/android";
const EXE_URL = "/api/download/windows";

export function InstallPromptBanner() {
  const [visible, setVisible] = useState(false);
  const [device, setDevice] = useState<"android" | "desktop">("desktop");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isNativeOfflineSupported()) return;

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // Ignore storage errors.
    }

    const ua = window.navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) return;

    setDevice(/Android/i.test(ua) ? "android" : "desktop");
    setVisible(true);
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

  const isAndroid = device === "android";

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-card px-3.5 py-3 text-xs sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {isAndroid ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            {isAndroid ? "Get the Sangeet Android APK" : "Get the Sangeet Windows App (.exe)"}
          </p>
          <p className="line-clamp-2 text-muted-foreground sm:truncate">
            {isAndroid
              ? "Standalone Android app with background audio, device music scanner, and offline song downloads."
              : "Standalone desktop application with media keys, local PC music folders, and offline playback."}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={isAndroid ? APK_URL : EXE_URL}
          download={isAndroid ? "sangeet-android.apk" : "Sangeet.exe"}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3.5 text-[11px] font-bold text-primary-foreground transition hover:brightness-110"
        >
          <Download className="h-3.5 w-3.5" />
          {isAndroid ? "Download APK" : "Download .exe"}
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss app download banner"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-elevated hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
