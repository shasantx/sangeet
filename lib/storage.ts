import type { StateStorage } from "zustand/middleware";

/**
 * A defensive localStorage adapter. If storage is unavailable, disabled, or
 * corrupted, Sangeet falls back to in-memory state instead of crashing.
 */
export const safeStorage: StateStorage = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    try {
      const value = window.localStorage.getItem(name);
      if (!value) return null;
      JSON.parse(value);
      return value;
    } catch {
      try {
        window.localStorage.removeItem(name);
      } catch {
        // Storage itself is unavailable; ignore.
      }
      return null;
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Quota exceeded or storage disabled. State remains usable in memory.
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Ignore storage errors.
    }
  },
};
