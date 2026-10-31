"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getTrack } from "@/lib/catalog";
import { safeStorage } from "@/lib/storage";
import type { UserPlaylist } from "@/lib/types";

const seededPlaylists: UserPlaylist[] = [
  {
    id: "user-late-night",
    title: "Late Night, Softly",
    description: "A private collection for the hours when the city gets quiet.",
    artwork: "/art/playlists/user-01.svg",
    trackIds: ["t01", "t04", "t28", "t19", "t10", "t35"],
    createdAt: 1767225600000,
    updatedAt: 1767225600000,
  },
  {
    id: "user-winter-walk",
    title: "Winter Walk",
    description: "Cold air, warm headphones.",
    artwork: "/art/playlists/user-02.svg",
    trackIds: ["t05", "t31", "t25", "t15", "t33", "t06"],
    createdAt: 1764547200000,
    updatedAt: 1764547200000,
  },
];

interface LibraryState {
  likedTrackIds: string[];
  savedAlbumIds: string[];
  followedArtistIds: string[];
  playlists: UserPlaylist[];
  recentlyPlayed: string[];

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
  likedTrackIds: ["t01", "t07", "t16", "t28", "t04", "t25", "t34", "t10"],
  savedAlbumIds: ["soft-static", "bloom-in-reverse", "halcyon-hours", "vela"],
  followedArtistIds: ["mira-vale", "kairos", "elio-north", "vera-sol"],
  playlists: seededPlaylists,
  recentlyPlayed: ["t01", "t07", "t28", "t04", "t16", "t25", "t34", "t10"],
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
        set((state) => ({
          recentlyPlayed: [trackId, ...state.recentlyPlayed.filter((id) => id !== trackId)].slice(0, 30),
        }));
      },
      clearHistory: () => set({ recentlyPlayed: [] }),

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
      version: 1,
      partialize: (state) => ({
        likedTrackIds: state.likedTrackIds,
        savedAlbumIds: state.savedAlbumIds,
        followedArtistIds: state.followedArtistIds,
        playlists: state.playlists,
        recentlyPlayed: state.recentlyPlayed,
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
          recentlyPlayed: uniqueValidTracks(source.recentlyPlayed ?? current.recentlyPlayed).slice(0, 30),
        };
      },
    },
  ),
);
