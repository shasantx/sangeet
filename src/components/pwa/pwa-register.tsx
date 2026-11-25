"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker silently without displaying any
 * intrusive "Install App" banner or popup prompt.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
