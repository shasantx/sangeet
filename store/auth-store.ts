"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "@/lib/storage";

export interface AuthSession {
  userId: string;
  email: string;
  displayName: string;
  avatarColor: string;
  initials: string;
  provider: "google" | "email";
  picture?: string;
  isAdmin?: boolean;
}

interface AuthState {
  session: AuthSession | null;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  authModalTab: "signin" | "signup";
  openAuthModal: (tab?: "signin" | "signup") => void;
  closeAuthModal: () => void;
  signOut: () => void;
  loginWithEmail: (email: string, name?: string, isAdmin?: boolean) => void;
  setGoogleSession: (user: { id: string; email: string; name: string; picture?: string; isAdmin?: boolean }) => void;
  updateProfile: (displayName: string) => void;
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      isAuthenticated: false,
      authModalOpen: false,
      authModalTab: "signin",

      openAuthModal: (tab = "signin") => {
        set({ authModalOpen: false, authModalTab: tab });
        if (typeof window !== "undefined") {
          const returnTo = window.location.pathname + window.location.search;
          if (!window.location.pathname.startsWith("/auth") && !window.location.pathname.startsWith("/login")) {
            window.location.assign(`/auth?tab=${tab}&returnTo=${encodeURIComponent(returnTo)}`);
          }
        }
      },

      closeAuthModal: () => set({ authModalOpen: false }),

      signOut: () => {
        set({ session: null, isAuthenticated: false, authModalOpen: false });
        if (typeof window !== "undefined") {
          fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        }
        try {
          // Reset player when user signs out
          const { usePlayerStore } = require("./player-store");
          usePlayerStore.getState().resetPlayer?.();
        } catch {
          // Ignore if player store not loaded yet
        }
      },

      loginWithEmail: (email: string, name?: string, isAdmin = false) => {
        const cleanEmail = email.trim().toLowerCase();
        const displayName = name?.trim() || cleanEmail.split("@")[0] || "Listener";
        set({
          session: {
            userId: `email:${cleanEmail}`,
            email: cleanEmail,
            displayName,
            avatarColor: "#1ED760",
            initials: initialsFor(displayName),
            provider: "email",
            isAdmin,
          },
          isAuthenticated: true,
          authModalOpen: false,
        });
      },

      setGoogleSession: ({ id, email, name, picture, isAdmin = false }) => {
        const displayName = name.trim() || email.split("@")[0] || "Listener";
        set({
          session: {
            userId: `google:${id}`,
            email,
            displayName,
            avatarColor: "#1ED760",
            initials: initialsFor(displayName),
            provider: "google",
            picture,
            isAdmin,
          },
          isAuthenticated: true,
          authModalOpen: false,
        });
      },

      updateProfile: (displayName) => {
        const trimmed = displayName.trim();
        const current = get().session;
        if (!current || trimmed.length < 2) return;
        set({ session: { ...current, displayName: trimmed, initials: initialsFor(trimmed) } });
      },
    }),
    {
      name: "sangeet-auth-v2",
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        session: state.session,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
