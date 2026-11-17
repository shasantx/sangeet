"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getTrack } from "@/lib/catalog";
import { safeStorage } from "@/lib/storage";
import { HISTORY_RETENTION_LIMIT } from "@/lib/plan-limits";
import type { UserPlaylist } from "@/lib/types";

interface LibraryState {
  likedTrackIds: string[];
  savedAlbumIds: string[];
  followedArtistIds: string[];
  playlists: UserPlaylist[];
  recentlyPlayed: string[];
  recentlyPlayedAt: Record<string, number>;

  toggleLike: (trackId: string) => boolean;
  isLiked: (trackId: string) => boolean;
  toggleSaveAlbum: (albumId: string) => boolean;
  isAlbumSaved: (albumId: string) => boolean;
  toggleFollowArtist: (artistId: string) => boolean;
  isArtistFollowed: (artistId: string) => boolean;
  addRecentlyPlayed: (trackId: string) => void;
  clearHistory: () => void;
  createPlaylist: (title: string, description?: string) => string;
  renamePlaylist: (id: string, title: string, description?: string) => void;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, trackId: string) => boolean;
  addTracksToPlaylist: (playlistId: string, trackIds: string[]) => number;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  resetLibrary: () => void;
}

const seedState = {
  likedTrackIds: [] as string[],
  savedAlbumIds: [] as string[],
  followedArtistIds: [] as string[],
  playlists: [] as UserPlaylist[],
  recentlyPlayed: [] as string[],
  recentlyPlayedAt: {} as Record<string, number>,
};

function uniqueValidTracks(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && Boolean(getTrack(id)))));
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      ...seedState,

      toggleLike: (trackId) => {
        if (!getTrack(trackId)) return false;
        const liked = get().likedTrackIds.includes(trackId);
        set((state) => ({
          likedTrackIds: liked
            ? state.likedTrackIds.filter((id) => id !== trackId)
            : [trackId, ...state.likedTrackIds],
        }));
        return !liked;
      },
      isLiked: (trackId) => get().likedTrackIds.includes(trackId),

      toggleSaveAlbum: (albumId) => {
        const saved = get().savedAlbumIds.includes(albumId);
        set((state) => ({
          savedAlbumIds: saved
            ? state.savedAlbumIds.filter((id) => id !== albumId)
            : [albumId, ...state.savedAlbumIds],
        }));
        return !saved;
      },
      isAlbumSaved: (albumId) => get().savedAlbumIds.includes(albumId),

      toggleFollowArtist: (artistId) => {
        const following = get().followedArtistIds.includes(artistId);
        set((state) => ({
          followedArtistIds: following
            ? state.followedArtistIds.filter((id) => id !== artistId)
            : [artistId, ...state.followedArtistIds],
        }));
        return !following;
      },
      isArtistFollowed: (artistId) => get().followedArtistIds.includes(artistId),

      addRecentlyPlayed: (trackId) => {
        if (!getTrack(trackId)) return;
        set((state) => {
          const recentlyPlayed = [trackId, ...state.recentlyPlayed.filter((id) => id !== trackId)].slice(0, HISTORY_RETENTION_LIMIT);
          const recentlyPlayedAt = { ...state.recentlyPlayedAt, [trackId]: Date.now() };
          for (const id of Object.keys(recentlyPlayedAt)) if (!recentlyPlayed.includes(id)) delete recentlyPlayedAt[id];
          return { recentlyPlayed, recentlyPlayedAt };
        });
      },
      clearHistory: () => set({ recentlyPlayed: [], recentlyPlayedAt: {} }),

      createPlaylist: (title, description = "") => {
        const id = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const index = get().playlists.length % 6;
        const playlist: UserPlaylist = {
          id,
          title: title.trim().slice(0, 80) || "Untitled playlist",
          description: description.trim().slice(0, 240),
          artwork: `/art/playlists/user-0${index + 1}.svg`,
          trackIds: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ playlists: [playlist, ...state.playlists] }));
        return id;
      },
      renamePlaylist: (id, title, description) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === id
              ? {
                  ...playlist,
                  title: title.trim().slice(0, 80) || playlist.title,
                  description:
                    typeof description === "string"
                      ? description.trim().slice(0, 240)
                      : playlist.description,
                  updatedAt: Date.now(),
                }
              : playlist,
          ),
        })),
      deletePlaylist: (id) =>
        set((state) => ({ playlists: state.playlists.filter((playlist) => playlist.id !== id) })),
      addTrackToPlaylist: (playlistId, trackId) => {
        if (!getTrack(trackId)) return false;
        const playlist = get().playlists.find((item) => item.id === playlistId);
        if (!playlist || playlist.trackIds.includes(trackId)) return false;
        set((state) => ({
          playlists: state.playlists.map((item) =>
            item.id === playlistId
              ? {
                  ...item,
                  trackIds: [...item.trackIds, trackId],
                  updatedAt: Date.now(),
                }
              : item,
          ),
        }));
        return true;
      },
      addTracksToPlaylist: (playlistId, trackIds) => {
        const valid = uniqueValidTracks(trackIds);
        const playlist = get().playlists.find((item) => item.id === playlistId);
        if (!playlist) return 0;
        const additions = valid.filter((id) => !playlist.trackIds.includes(id));
        if (additions.length === 0) return 0;
        set((state) => ({
          playlists: state.playlists.map((item) =>
            item.id === playlistId
              ? {
                  ...item,
                  trackIds: [...item.trackIds, ...additions],
                  updatedAt: Date.now(),
                }
              : item,
          ),
        }));
        return additions.length;
      },
      removeTrackFromPlaylist: (playlistId, trackId) =>
        set((state) => ({
          playlists: state.playlists.map((playlist) =>
            playlist.id === playlistId
              ? {
                  ...playlist,
                  trackIds: playlist.trackIds.filter((id) => id !== trackId),
                  updatedAt: Date.now(),
                }
              : playlist,
          ),
        })),
      resetLibrary: () => set({ ...seedState }),
    }),
    {
      name: "aura-library-v1",
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      version: 3,
      migrate: (persisted) => ({ ...seedState, ...(persisted as Partial<LibraryState>), recentlyPlayedAt: {} }),
      partialize: (state) => ({
        likedTrackIds: state.likedTrackIds,
        savedAlbumIds: state.savedAlbumIds,
        followedArtistIds: state.followedArtistIds,
        playlists: state.playlists,
        recentlyPlayed: state.recentlyPlayed,
        recentlyPlayedAt: state.recentlyPlayedAt,
      }),
      merge: (persisted, current) => {
        const source = (persisted ?? {}) as Partial<LibraryState>;
        const playlists = Array.isArray(source.playlists)
          ? source.playlists
              .filter(
                (playlist): playlist is UserPlaylist =>
                  Boolean(playlist) &&
                  typeof playlist.id === "string" &&
                  typeof playlist.title === "string" &&
                  Array.isArray(playlist.trackIds),
              )
              .map((playlist) => ({
                ...playlist,
                trackIds: uniqueValidTracks(playlist.trackIds),
                description: typeof playlist.description === "string" ? playlist.description : "",
                artwork:
                  typeof playlist.artwork === "string" &&
                  playlist.artwork.startsWith("/art/playlists/")
                    ? playlist.artwork
                    : "/art/playlists/user-01.svg",
                createdAt: typeof playlist.createdAt === "number" ? playlist.createdAt : Date.now(),
                updatedAt: typeof playlist.updatedAt === "number" ? playlist.updatedAt : Date.now(),
              }))
          : current.playlists;
        return {
          ...current,
          ...source,
          likedTrackIds: uniqueValidTracks(source.likedTrackIds ?? current.likedTrackIds),
          savedAlbumIds: Array.isArray(source.savedAlbumIds)
            ? source.savedAlbumIds.filter((id): id is string => typeof id === "string")
            : current.savedAlbumIds,
          followedArtistIds: Array.isArray(source.followedArtistIds)
            ? source.followedArtistIds.filter((id): id is string => typeof id === "string")
            : current.followedArtistIds,
          playlists,
          recentlyPlayed: uniqueValidTracks(source.recentlyPlayed ?? current.recentlyPlayed).slice(0, HISTORY_RETENTION_LIMIT),
          recentlyPlayedAt:
            source.recentlyPlayedAt && typeof source.recentlyPlayedAt === "object"
              ? Object.fromEntries(Object.entries(source.recentlyPlayedAt).filter(([id, at]) => typeof at === "number" && Number.isFinite(at) && Boolean(getTrack(id))).slice(0, HISTORY_RETENTION_LIMIT))
              : current.recentlyPlayedAt,
        };
      },
    },
  ),
);
