"use client";

import { create } from "zustand";

export type ToastTone = "default" | "success" | "error" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
}

export type OfflineDownloadStatus = "downloading" | "done" | "error";

export interface OfflineDownloadItem {
  trackId: string;
  title: string;
  artistName: string;
  progress: number;
  status: OfflineDownloadStatus;
  error?: string;
}

interface UIState {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;

  queuePanelOpen: boolean;
  setQueuePanelOpen: (open: boolean) => void;
  toggleQueuePanel: () => void;

  nowPlayingOpen: boolean;
  openNowPlaying: () => void;
  closeNowPlaying: () => void;
  toggleNowPlaying: () => void;

  addToPlaylistTrackId: string | null;
  openAddToPlaylist: (trackId: string) => void;
  closeAddToPlaylist: () => void;

  createPlaylistOpen: boolean;
  createPlaylistSeedTrackId: string | null;
  openCreatePlaylist: (seedTrackId?: string) => void;
  closeCreatePlaylist: () => void;

  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id" | "duration"> & { duration?: number }) => void;
  dismissToast: (id: string) => void;

  offlineDownloads: Record<string, OfflineDownloadItem>;
  startOfflineDownload: (trackId: string, title: string, artistName: string) => void;
  updateOfflineDownload: (trackId: string, progress: number) => void;
  finishOfflineDownload: (trackId: string) => void;
  failOfflineDownload: (trackId: string, error?: string) => void;
  dismissOfflineDownload: (trackId: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),

  queuePanelOpen: false,
  setQueuePanelOpen: (open) => set({ queuePanelOpen: open }),
  toggleQueuePanel: () => set((state) => ({ queuePanelOpen: !state.queuePanelOpen })),

  nowPlayingOpen: false,
  openNowPlaying: () => set({ nowPlayingOpen: true }),
  closeNowPlaying: () => set({ nowPlayingOpen: false }),
  toggleNowPlaying: () => set((state) => ({ nowPlayingOpen: !state.nowPlayingOpen })),

  addToPlaylistTrackId: null,
  openAddToPlaylist: (trackId) => set({ addToPlaylistTrackId: trackId }),
  closeAddToPlaylist: () => set({ addToPlaylistTrackId: null }),

  createPlaylistOpen: false,
  createPlaylistSeedTrackId: null,
  openCreatePlaylist: (seedTrackId) =>
    set({ createPlaylistOpen: true, createPlaylistSeedTrackId: seedTrackId ?? null }),
  closeCreatePlaylist: () => set({ createPlaylistOpen: false, createPlaylistSeedTrackId: null }),

  toasts: [],
  addToast: (toast) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: Toast = {
      id,
      tone: toast.tone ?? "default",
      title: toast.title,
      description: toast.description,
      duration: toast.duration ?? 3600,
    };
    set((state) => ({ toasts: [...state.toasts.slice(-2), next] }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
      }, next.duration);
    }
  },
  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  offlineDownloads: {},
  startOfflineDownload: (trackId, title, artistName) =>
    set((state) => ({
      offlineDownloads: {
        ...state.offlineDownloads,
        [trackId]: {
          trackId,
          title,
          artistName,
          progress: 0,
          status: "downloading",
        },
      },
    })),
  updateOfflineDownload: (trackId, progress) =>
    set((state) => {
      const existing = state.offlineDownloads[trackId];
      if (!existing) return state;
      const clamped = Math.max(0, Math.min(100, Math.round(progress)));
      if (existing.progress === clamped && existing.status === "downloading") {
        return state;
      }
      return {
        offlineDownloads: {
          ...state.offlineDownloads,
          [trackId]: {
            ...existing,
            progress: clamped,
            status: "downloading",
            error: undefined,
          },
        },
      };
    }),
  finishOfflineDownload: (trackId) =>
    set((state) => {
      const existing = state.offlineDownloads[trackId];
      if (!existing) return state;
      return {
        offlineDownloads: {
          ...state.offlineDownloads,
          [trackId]: {
            ...existing,
            progress: 100,
            status: "done",
            error: undefined,
          },
        },
      };
    }),
  failOfflineDownload: (trackId, error) =>
    set((state) => {
      const existing = state.offlineDownloads[trackId];
      if (!existing) return state;
      return {
        offlineDownloads: {
          ...state.offlineDownloads,
          [trackId]: {
            ...existing,
            status: "error",
            error: error || "Could not download this track.",
          },
        },
      };
    }),
  dismissOfflineDownload: (trackId) =>
    set((state) => {
      if (!(trackId in state.offlineDownloads)) return state;
      const next = { ...state.offlineDownloads };
      delete next[trackId];
      return { offlineDownloads: next };
    }),
}));

export const toast = {
  show: (title: string, description?: string, tone: ToastTone = "default") =>
    useUIStore.getState().addToast({ title, description, tone }),
  success: (title: string, description?: string) =>
    useUIStore.getState().addToast({ title, description, tone: "success" }),
  error: (title: string, description?: string) =>
    useUIStore.getState().addToast({ title, description, tone: "error" }),
  info: (title: string, description?: string) =>
    useUIStore.getState().addToast({ title, description, tone: "info" }),
};
