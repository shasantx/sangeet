"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export const EQ_FREQUENCIES = [60, 230, 910, 3600, 14000] as const;
export const EQ_LABELS = ["60Hz", "230Hz", "910Hz", "3.6kHz", "14kHz"] as const;

export const EQ_PRESETS: Record<string, [number, number, number, number, number]> = {
  Flat: [0, 0, 0, 0, 0],
  "Bass Boost": [6, 4, 0, 1, 2],
  Vocal: [-2, 1, 5, 4, 1],
  Acoustic: [3, 2, 1, 3, 4],
  Electronic: [5, 3, -1, 3, 5],
  "Late Night": [-3, 1, 2, -1, -3]
};

interface EQState {
  enabled: boolean;
  preset: string;
  gains: [number, number, number, number, number];
  setEnabled: (enabled: boolean) => void;
  applyPreset: (name: string) => void;
  setBandGain: (index: number, db: number) => void;
}

export const useEQStore = create<EQState>()(
  persist(
    (set) => ({
      enabled: true,
      preset: "Flat",
      gains: [0, 0, 0, 0, 0],

      setEnabled: (enabled) => set({ enabled }),

      applyPreset: (name) => {
        const presetGains = EQ_PRESETS[name];
        if (!presetGains) return;
        set({ preset: name, gains: [...presetGains] as [number, number, number, number, number] });
      },

      setBandGain: (index, db) =>
        set((s) => {
          const next = [...s.gains] as [number, number, number, number, number];
          next[index] = Math.max(-12, Math.min(12, db));
          return { gains: next, preset: "Custom" };
        })
    }),
    {
      name: "sangeet-v2-eq"
    }
  )
);
