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

interface UIState {
  queuePanelOpen: boolean;
  setQueuePanelOpen: (open: boolean) => void;
  toggleQueuePanel: () => void;

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
}

export const useUIStore = create<UIState>((set) => ({
  queuePanelOpen: false,
  setQueuePanelOpen: (open) => set({ queuePanelOpen: open }),
  toggleQueuePanel: () => set((state) => ({ queuePanelOpen: !state.queuePanelOpen })),

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
