"use client";

import { useEffect } from "react";
import type { Track } from "@/types/music";
import { usePlayerStore } from "@/store/player-store";
import { classifyListen } from "@/lib/mood-engine";
import { captureContextTags, recordListen } from "@/store/listening-store";

interface ActivePlay {
  track: Track;
  startedAt: number;
  listened: number;
  lastTime: number;
  failed: boolean;
  contextTags: string[];
}

/** A forward step larger than this is a seek, not listening. */
const MAX_NATURAL_STEP_SECONDS = 2.5;

/**
 * Invisible component: watches the player and turns every play into an
 * on-device ListenEvent (complete / partial / skip) for the mood engine.
 */
export function ListeningTracker() {
  useEffect(() => {
    let active: ActivePlay | null = null;

    const finalize = () => {
      const play = active;
      active = null;
      if (!play || play.failed) return;
      const outcome = classifyListen(play.listened, play.track.duration);
      if (!outcome) return;
      try {
        recordListen(play.track, play.startedAt, play.listened, outcome, play.contextTags);
      } catch {}
    };

    const start = (track: Track | null) => {
      active = track
        ? {
            track,
            startedAt: Date.now(),
            listened: 0,
            lastTime: 0,
            failed: false,
            contextTags: captureContextTags()
          }
        : null;
    };

    start(usePlayerStore.getState().currentTrack);

    const unsubscribe = usePlayerStore.subscribe((state, prev) => {
      const sameTrack =
        state.currentTrack?.id === active?.track.id &&
        state.trackLoadNonce === prev.trackLoadNonce;

      if (!sameTrack) {
        // Replaying the same id (repeat-one) keeps accumulating instead of splitting.
        if (state.currentTrack && active && state.currentTrack.id === active.track.id) {
          active.lastTime = 0;
          return;
        }
        finalize();
        start(state.currentTrack);
        return;
      }

      if (!active) return;
      if (state.playbackError) active.failed = true;

      const t = state.currentTime;
      const step = t - active.lastTime;
      if (state.isPlaying && step > 0 && step <= MAX_NATURAL_STEP_SECONDS) {
        active.listened += step;
      }
      active.lastTime = t;
    });

    const onHide = () => finalize();
    window.addEventListener("pagehide", onHide);

    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", onHide);
      finalize();
    };
  }, []);

  return null;
}
