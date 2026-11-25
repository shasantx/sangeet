"use client";

import { create } from "zustand";

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  bannerDismissed: boolean;
  setDeferredPrompt: (e: BeforeInstallPromptEvent | null) => void;
  setInstalled: (v: boolean) => void;
  dismissBanner: () => void;
  triggerInstall: () => Promise<boolean>;
}

export const usePWAStore = create<PWAState>((set, get) => ({
  deferredPrompt: null,
  installed: false,
  bannerDismissed: false,

  setDeferredPrompt: (deferredPrompt) => set({ deferredPrompt }),
  setInstalled: (installed) => set({ installed }),
  dismissBanner: () => set({ bannerDismissed: true }),

  triggerInstall: async () => {
    const promptEvent = get().deferredPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") {
      set({ deferredPrompt: null, installed: true });
      return true;
    }
    return false;
  }
}));
