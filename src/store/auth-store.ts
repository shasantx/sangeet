"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SangeetUser {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  mode: "guest" | "local" | "google";
}

interface AuthState {
  user: SangeetUser | null;
  googleConfigured: boolean;
  enterAsGuest: () => void;
  enterAsLocal: (name: string) => void;
  setUser: (user: SangeetUser | null) => void;
  syncSession: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      googleConfigured: false,

      enterAsGuest: () =>
        set({
          user: {
            id: "guest",
            name: "Guest Listener",
            mode: "guest"
          }
        }),

      enterAsLocal: (name: string) =>
        set({
          user: {
            id: `local_${Date.now().toString(36)}`,
            name: name.trim() || "Music Lover",
            mode: "local"
          }
        }),

      setUser: (user) => set({ user }),

      syncSession: async () => {
        try {
          const res = await fetch("/api/auth/session", { cache: "no-store" });
          if (!res.ok) return;
          const data = await res.json();
          set({ googleConfigured: Boolean(data?.googleConfigured) });
          if (data?.user) {
            set({ user: data.user });
          }
        } catch {
          // Ignore network errors
        }
      },

      logout: async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Ignore logout API errors
        }
        set({ user: null });
      }
    }),
    {
      name: "sangeet-v2-auth",
      partialize: (s) => ({ user: s.user })
    }
  )
);
