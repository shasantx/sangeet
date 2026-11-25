"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RightPanelTab } from "@/types/music";

export type AppTheme = "dark" | "light";

interface UIState {
  theme: AppTheme;
  leftCollapsed: boolean;
  leftWidth: number;
  rightTab: RightPanelTab;
  downloadAppModalOpen: boolean;
  downloadAppReason: string | null;

  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  toggleLeftSidebar: () => void;
  setLeftWidth: (width: number) => void;
  setRightTab: (tab: RightPanelTab) => void;
  toggleRightTab: (tab: Exclude<RightPanelTab, null>) => void;
  openDownloadAppModal: (reason?: string) => void;
  closeDownloadAppModal: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      leftCollapsed: false,
      leftWidth: 280,
      rightTab: null,
      downloadAppModalOpen: false,
      downloadAppReason: null,

      setTheme: (theme) => set({ theme }),

      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

      toggleLeftSidebar: () =>
        set((s) => ({ leftCollapsed: !s.leftCollapsed })),

      setLeftWidth: (width) =>
        set({ leftWidth: Math.max(220, Math.min(420, width)) }),

      setRightTab: (rightTab) => set({ rightTab }),

      toggleRightTab: (tab) =>
        set((s) => ({ rightTab: s.rightTab === tab ? null : tab })),

      openDownloadAppModal: (reason) =>
        set({
          downloadAppModalOpen: true,
          downloadAppReason: reason ?? null
        }),

      closeDownloadAppModal: () =>
        set({ downloadAppModalOpen: false, downloadAppReason: null })
    }),
    {
      name: "sangeet-v2-ui",
      partialize: (s) => ({
        theme: s.theme,
        leftCollapsed: s.leftCollapsed,
        leftWidth: s.leftWidth,
        rightTab: s.rightTab
      })
    }
  )
);
