"use client";

import { create } from "zustand";

export interface AuthSession {
  userId: string;
  email: string;
  displayName: string;
  avatarColor: string;
  initials: string;
  provider: "google";
  picture?: string;
  plan?: "free" | "premium";
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
  setGoogleSession: (user: { id: string; email: string; name: string; picture?: string; plan?: "free" | "premium"; isAdmin?: boolean }) => void;
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

/** Authentication state is memory-only. The server-owned, HTTP-only Google session cookie is authoritative. */
export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  isAuthenticated: false,
  authModalOpen: false,
  authModalTab: "signin",

  openAuthModal: (tab = "signin") => set({ authModalOpen: true, authModalTab: tab }),
  closeAuthModal: () => set({ authModalOpen: false }),
  signOut: () => set({ session: null, isAuthenticated: false }),

  setGoogleSession: ({ id, email, name, picture, plan = "free", isAdmin = false }) => {
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
        plan,
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
}));
