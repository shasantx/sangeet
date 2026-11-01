"use client";

import { useEffect } from "react";
import { getDynamicAlbum, getDynamicArtist, getDynamicTracks, restoreYouTubeTrack } from "@/lib/dynamic-tracks";
import { getTrack } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth-store";
import { useLibraryStore } from "@/store/library-store";

const OWNER_KEY = "sangeet-library-owner-v1";
type CloudLibrary = {
  likedTrackIds: string[];
  savedAlbumIds: string[];
  followedArtistIds: string[];
  recentlyPlayed: string[];
  recentlyPlayedAt: Record<string, number>;
  playlists: { id: string; title: string; description: string; artwork?: string; trackIds: string[]; createdAt: number; updatedAt: number }[];
  tracks: { videoId: string; title: string; artist: string; album?: string; durationSeconds?: number; thumbnail?: string; year?: number }[];
};

function unique<T>(...groups: T[][]): T[] {
  return [...new Set(groups.flat())];
}

function snapshot(ids: string[]): CloudLibrary {
  const state = useLibraryStore.getState();
  return {
    likedTrackIds: state.likedTrackIds,
    savedAlbumIds: state.savedAlbumIds,
    followedArtistIds: state.followedArtistIds,
    recentlyPlayed: state.recentlyPlayed,
    recentlyPlayedAt: state.recentlyPlayedAt,
    playlists: state.playlists,
    tracks: getDynamicTracks(ids).filter((track) => track.source === "youtube" && track.youtubeId).map((track) => ({ videoId: track.youtubeId!, title: track.title, artist: getDynamicArtist(track.artistId)?.name ?? "YouTube", album: getDynamicAlbum(track.albumId)?.title, durationSeconds: track.duration, thumbnail: track.artwork })),
  };
}

export function CloudLibrarySync() {
  const userId = useAuthStore((state) => state.session?.userId);

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let hydrated = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      if (!useLibraryStore.persist.hasHydrated()) {
        await useLibraryStore.persist.rehydrate();
      }
      if (disposed) return;
      hydrated = true;
      try {
        const response = await fetch("/api/library/sync", { cache: "no-store" });
        if (!response.ok) throw new Error("Library sync unavailable");
        const payload = await response.json() as { library: CloudLibrary | null };
        if (disposed) return;

        const localOwner = window.localStorage.getItem(OWNER_KEY);
        const canMergeLocal = !localOwner || localOwner === userId;
        const local = useLibraryStore.getState();
        const remote = payload.library;
        for (const track of remote?.tracks ?? []) restoreYouTubeTrack(track);
        const valid = (ids: string[]) => unique(ids).filter((id) => Boolean(getTrack(id)));
        const timestamps = { ...(canMergeLocal ? local.recentlyPlayedAt : {}), ...(remote?.recentlyPlayedAt ?? {}) };
        if (canMergeLocal && remote?.recentlyPlayedAt) for (const [id, playedAt] of Object.entries(local.recentlyPlayedAt)) timestamps[id] = Math.max(playedAt, timestamps[id] ?? 0);
        const playlists = new Map<string, CloudLibrary["playlists"][number]>();
        if (remote?.playlists) remote.playlists.forEach((p) => playlists.set(p.id, p));
        if (canMergeLocal) local.playlists.forEach((p) => playlists.set(p.id, { ...p, trackIds: valid(p.trackIds) }));
        const recentlyPlayed = valid([...(canMergeLocal ? local.recentlyPlayed : []), ...(remote?.recentlyPlayed ?? [])])
          .sort((a, b) => (timestamps[b] ?? 0) - (timestamps[a] ?? 0))
          .slice(0, 200);
        useLibraryStore.setState({
          likedTrackIds: valid([...(canMergeLocal ? local.likedTrackIds : []), ...(remote?.likedTrackIds ?? [])]),
          savedAlbumIds: unique(canMergeLocal ? local.savedAlbumIds : [], remote?.savedAlbumIds ?? []),
          followedArtistIds: unique(canMergeLocal ? local.followedArtistIds : [], remote?.followedArtistIds ?? []),
          recentlyPlayed,
          recentlyPlayedAt: Object.fromEntries(recentlyPlayed.flatMap((id) => timestamps[id] ? [[id, timestamps[id]]] : [])),
          playlists: [...playlists.values()].slice(0, 100),
        });
        window.localStorage.setItem(OWNER_KEY, userId);

        const sync = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            const state = useLibraryStore.getState();
            const ids = [...state.likedTrackIds, ...state.recentlyPlayed, ...state.playlists.flatMap((p) => p.trackIds)];
            void fetch("/api/library/sync", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ library: snapshot(ids) }) });
          }, 900);
        };
        unsubscribe = useLibraryStore.subscribe(sync);
        sync();
      } catch {
        // Keep the local library usable while the server or migration is unavailable.
      }
    };
    void start();
    return () => {
      disposed = true;
      if (hydrated && timer) clearTimeout(timer);
      unsubscribe?.();
    };
  }, [userId]);

  return null;
}
