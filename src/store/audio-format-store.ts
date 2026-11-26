"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuthStore } from "@/store/auth-store";

/**
 * Preferred playback / download audio format.
 * - "aac": use the source's native AAC stream when it has one, otherwise
 *          transcode to AAC on-device while streaming.
 * - "original": play whatever the source serves, untouched.
 */
export type AudioFormat = "aac" | "original";

export const DEFAULT_AUDIO_FORMAT: AudioFormat = "aac";

const GUEST_KEY = "guest";

interface AudioFormatState {
  /** Saved format per profile id (Google, local profile, or guest). */
  byUser: Record<string, AudioFormat>;
  setFormatForUser: (userKey: string, format: AudioFormat) => void;
}

export const useAudioFormatStore = create<AudioFormatState>()(
  persist(
    (set) => ({
      byUser: {},
      setFormatForUser: (userKey, format) =>
        set((s) => ({ byUser: { ...s.byUser, [userKey]: format } }))
    }),
    { name: "sangeet-v2-audio-format" }
  )
);

function currentUserKey(userId: string | undefined | null): string {
  return userId && userId.trim() ? userId : GUEST_KEY;
}

/** Non-hook read for use inside effects, stores and callbacks. */
export function getPreferredAudioFormat(): AudioFormat {
  const key = currentUserKey(useAuthStore.getState().user?.id);
  return useAudioFormatStore.getState().byUser[key] ?? DEFAULT_AUDIO_FORMAT;
}

/** Non-hook write for the signed-in (or guest) profile. */
export function setPreferredAudioFormat(format: AudioFormat): void {
  const key = currentUserKey(useAuthStore.getState().user?.id);
  useAudioFormatStore.getState().setFormatForUser(key, format);
}

/** Reactive hook: the current profile's format plus a setter. */
export function useAudioFormat(): [AudioFormat, (format: AudioFormat) => void] {
  const userId = useAuthStore((s) => s.user?.id);
  const key = currentUserKey(userId);
  const format = useAudioFormatStore(
    (s) => s.byUser[key] ?? DEFAULT_AUDIO_FORMAT
  );
  const setFormatForUser = useAudioFormatStore((s) => s.setFormatForUser);
  return [format, (next) => setFormatForUser(key, next)];
}
