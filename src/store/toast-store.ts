"use client";

import { create } from "zustand";

export interface ToastItem {
  id: string;
  message: string;
  tone?: "default" | "success" | "error";
}

interface ToastState {
  toasts: ToastItem[];
  showToast: (message: string, tone?: ToastItem["tone"]) => void;
  dismissToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  showToast: (message, tone = "default") => {
    const id = `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone }] }));
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 2800);
    }
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}));
