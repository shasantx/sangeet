"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { demoProfile } from "@/lib/catalog";
import { safeStorage } from "@/lib/storage";
import { getInitials } from "@/lib/utils";
import type { DemoProfile } from "@/lib/types";

export type ThemePreference = "dark" | "midnight" | "dusk";
export type AccentPreference = "green" | "red" | "yellow" | "blue" | "violet";
export type AudioQuality = "auto" | "high" | "lossless";

export interface PreferenceState {
  autoplay: boolean;
  crossfade: boolean;
  crossfadeDuration: number;
  audioQuality: AudioQuality;
  shortcuts: boolean;
}

interface AppState extends PreferenceState {
  profile: DemoProfile;
  hasOnboarded: boolean;
  theme: ThemePreference;
  accent: AccentPreference;
  sidebarCollapsed: boolean;
  rightPanelOpen: boolean;
  recentSearches: string[];
  preferredArtistIds: string[];

  setProfile: (name: string, handle?: string) => void;
  enterDemo: (name?: string) => void;
  signOut: () => void;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: AccentPreference) => void;
  toggleSidebar: () => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setAutoplay: (value: boolean) => void;
  setCrossfade: (value: boolean) => void;
  setCrossfadeDuration: (value: number) => void;
  setAudioQuality: (quality: AudioQuality) => void;
  setShortcuts: (value: boolean) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setPreferredArtists: (artistIds: string[]) => void;
}

const seedSearches: string[] = [];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      profile: demoProfile,
      hasOnboarded: true,
      theme: "dark",
      accent: "green",
      sidebarCollapsed: false,
      rightPanelOpen: true,
      recentSearches: seedSearches,
      preferredArtistIds: [],
      autoplay: true,
      crossfade: false,
      crossfadeDuration: 4,
      audioQuality: "high",
      shortcuts: true,

      setProfile: (name, handle) => {
        const trimmed = name.trim().slice(0, 40);
        if (!trimmed) return;
        set((state) => ({
          profile: {
            ...state.profile,
            name: trimmed,
            handle: handle?.trim()
              ? `@${handle.trim().replace(/^@/, "").slice(0, 24)}`
              : `@${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20)}`,
            initials: getInitials(trimmed),
          },
        }));
      },
      enterDemo: (name) => {
        set((state) => ({
          hasOnboarded: true,
          profile: name?.trim()
            ? {
                ...state.profile,
                name: name.trim().slice(0, 40),
                handle: `@${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20)}`,
                initials: getInitials(name.trim()),
              }
            : state.profile,
        }));
      },
      signOut: () => set({ hasOnboarded: false }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
      toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
      setAutoplay: (value) => set({ autoplay: value }),
      setCrossfade: (value) => set({ crossfade: value }),
      setCrossfadeDuration: (value) => set({ crossfadeDuration: Math.min(12, Math.max(1, value)) }),
      setAudioQuality: (quality) => set({ audioQuality: quality }),
      setShortcuts: (value) => set({ shortcuts: value }),
      addRecentSearch: (query) => {
        const trimmed = query.trim();
        if (trimmed.length < 2) return;
        set((state) => ({
          recentSearches: [
            trimmed,
            ...state.recentSearches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
          ].slice(0, 8),
        }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
      setPreferredArtists: (artistIds) => set({ preferredArtistIds: Array.from(new Set(artistIds)).slice(0, 5) }),
    }),
    {
      name: "aura-app-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      version: 2,
      migrate: () => ({ recentSearches: [] }),
      partialize: (state) => ({
        profile: state.profile,
        hasOnboarded: state.hasOnboarded,
        theme: state.theme,
        accent: state.accent,
        sidebarCollapsed: state.sidebarCollapsed,
        rightPanelOpen: state.rightPanelOpen,
        recentSearches: state.recentSearches,
        preferredArtistIds: state.preferredArtistIds,
        autoplay: state.autoplay,
        crossfade: state.crossfade,
        crossfadeDuration: state.crossfadeDuration,
        audioQuality: state.audioQuality,
        shortcuts: state.shortcuts,
      }),
      merge: (persisted, current) => {
        const source = (persisted ?? {}) as Partial<AppState>;
        const savedProfile =
          source.profile && typeof source.profile.name === "string"
            ? source.profile
            : current.profile;
        const profile = savedProfile.id === "demo-alex" ? current.profile : savedProfile;
        return {
          ...current,
          ...source,
          profile: {
            ...current.profile,
            ...profile,
            initials: profile.initials || getInitials(profile.name),
          },
          recentSearches: Array.isArray(source.recentSearches)
            ? source.recentSearches.filter((item): item is string => typeof item === "string").slice(0, 8)
            : current.recentSearches,
          preferredArtistIds: Array.isArray(source.preferredArtistIds)
            ? Array.from(new Set(source.preferredArtistIds.filter((id): id is string => typeof id === "string"))).slice(0, 5)
            : current.preferredArtistIds,
          theme: ["dark", "midnight", "dusk"].includes(source.theme as string)
            ? (source.theme as ThemePreference)
            : "dark",
          accent: ["green", "red", "yellow", "blue", "violet"].includes(source.accent as string)
            ? (source.accent as AccentPreference)
            : "green",
        };
      },
    },
  ),
);
