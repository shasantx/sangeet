"use client";

import { create } from "zustand";

export interface PublicSiteConfig {
  announcement_enabled: boolean;
  announcement_text: string;
  signup_enabled: boolean;
  live_search_enabled: boolean;
  featured_album_id: string | null;
  featured_playlist_ids: string[];
}

const defaults: PublicSiteConfig = {
  announcement_enabled: false,
  announcement_text: "",
  signup_enabled: true,
  live_search_enabled: true,
  featured_album_id: null,
  featured_playlist_ids: ["violet-hours", "quiet-luxury", "nocturne-drive"],
};

interface SiteConfigState {
  config: PublicSiteConfig;
  setConfig: (config: Partial<PublicSiteConfig>) => void;
}

export const useSiteConfigStore = create<SiteConfigState>((set) => ({
  config: defaults,
  setConfig: (config) => set((state) => ({ config: { ...state.config, ...config } })),
}));
