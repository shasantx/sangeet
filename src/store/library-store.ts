"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AlbumSummary,
  ArtistSummary,
  PlaylistItem,
  Track
} from "@/types/music";

interface LibraryState {
  likedTracks: Track[];
  playlists: PlaylistItem[];
  recentlyPlayed: Track[];
  savedArtists: ArtistSummary[];
  savedAlbums: AlbumSummary[];
  playCounts: Record<string, number>;
  trackCatalog: Record<string, Track>;
  listeningSeconds: number;
  recentSearches: string[];

  toggleLike: (track: Track) => boolean;
  isLiked: (trackId: string) => boolean;
  recordPlay: (track: Track) => void;
  addListeningSeconds: (seconds: number) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  createPlaylist: (name: string, description?: string) => PlaylistItem;
  renamePlaylist: (id: string, name: string, description?: string) => void;
  importPlaylist: (
    name: string,
    tracks: Track[],
    description?: string,
    cover?: string
  ) => PlaylistItem;
  deletePlaylist: (id: string) => void;
  addTrackToPlaylist: (playlistId: string, track: Track) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylistTrack: (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  toggleSaveArtist: (artist: ArtistSummary) => void;
  toggleSaveAlbum: (album: AlbumSummary) => void;
  importLibraryJson: (payload: {
    likedTracks?: Track[];
    playlists?: PlaylistItem[];
  }) => { addedLikes: number; addedPlaylists: number };
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      likedTracks: [],
      playlists: [
        {
          id: "discover-mix",
          name: "My Sangeet Mix",
          description:
            "Your personal playlist — add any song to start building it.",
          tracks: [],
          createdAt: 0
        }
      ],
      recentlyPlayed: [],
      savedArtists: [],
      savedAlbums: [],
      playCounts: {},
      trackCatalog: {},
      listeningSeconds: 0,
      recentSearches: [],

      toggleLike: (track) => {
        const exists = get().likedTracks.some((t) => t.id === track.id);
        set((s) => ({
          likedTracks: exists
            ? s.likedTracks.filter((t) => t.id !== track.id)
            : [track, ...s.likedTracks]
        }));
        return !exists;
      },

      isLiked: (trackId) => get().likedTracks.some((t) => t.id === trackId),

      recordPlay: (track) =>
        set((s) => ({
          recentlyPlayed: [
            track,
            ...s.recentlyPlayed.filter((t) => t.id !== track.id)
          ].slice(0, 40),
          playCounts: {
            ...s.playCounts,
            [track.id]: (s.playCounts[track.id] || 0) + 1
          },
          trackCatalog: {
            ...s.trackCatalog,
            [track.id]: track
          }
        })),

      addListeningSeconds: (seconds) =>
        set((s) => ({ listeningSeconds: s.listeningSeconds + seconds })),

      addRecentSearch: (query) => {
        const q = query.trim();
        if (!q) return;
        set((s) => ({
          recentSearches: [
            q,
            ...s.recentSearches.filter(
              (item) => item.toLowerCase() !== q.toLowerCase()
            )
          ].slice(0, 8)
        }));
      },

      clearRecentSearches: () => set({ recentSearches: [] }),

      createPlaylist: (name, description = "") => {
        const playlist: PlaylistItem = {
          id: `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: name.trim() || `My Playlist #${get().playlists.length + 1}`,
          description,
          tracks: [],
          createdAt: Date.now()
        };
        set((s) => ({ playlists: [playlist, ...s.playlists] }));
        return playlist;
      },

      renamePlaylist: (id, name, description) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id
              ? {
                  ...p,
                  name: name.trim() || p.name,
                  description:
                    description !== undefined ? description : p.description
                }
              : p
          )
        })),

      importPlaylist: (name, tracks, description = "", cover) => {
        const playlist: PlaylistItem = {
          id: `pl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: name.trim() || "Imported Playlist",
          description,
          cover: cover || tracks[0]?.thumbnail,
          tracks,
          createdAt: Date.now()
        };
        set((s) => ({ playlists: [playlist, ...s.playlists] }));
        return playlist;
      },

      deletePlaylist: (id) =>
        set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),

      addTrackToPlaylist: (playlistId, track) =>
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            if (p.tracks.some((t) => t.id === track.id)) return p;
            return {
              ...p,
              cover: p.cover || track.thumbnail,
              tracks: [...p.tracks, track]
            };
          })
        })),

      removeTrackFromPlaylist: (playlistId, trackId) =>
        set((s) => ({
          playlists: s.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) }
              : p
          )
        })),

      reorderPlaylistTrack: (playlistId, fromIndex, toIndex) =>
        set((s) => ({
          playlists: s.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            if (
              fromIndex === toIndex ||
              fromIndex < 0 ||
              toIndex < 0 ||
              fromIndex >= p.tracks.length ||
              toIndex >= p.tracks.length
            ) {
              return p;
            }
            const next = [...p.tracks];
            const [moved] = next.splice(fromIndex, 1);
            next.splice(toIndex, 0, moved);
            return { ...p, tracks: next };
          })
        })),

      toggleSaveArtist: (artist) =>
        set((s) => {
          const exists = s.savedArtists.some((a) => a.id === artist.id);
          return {
            savedArtists: exists
              ? s.savedArtists.filter((a) => a.id !== artist.id)
              : [artist, ...s.savedArtists]
          };
        }),

      toggleSaveAlbum: (album) =>
        set((s) => {
          const exists = s.savedAlbums.some((a) => a.id === album.id);
          return {
            savedAlbums: exists
              ? s.savedAlbums.filter((a) => a.id !== album.id)
              : [album, ...s.savedAlbums]
          };
        }),

      importLibraryJson: (payload) => {
        let addedLikes = 0;
        let addedPlaylists = 0;
        set((s) => {
          const existingLikeIds = new Set(s.likedTracks.map((t) => t.id));
          const newLikes = (payload.likedTracks ?? []).filter(
            (t) => t?.id && !existingLikeIds.has(t.id)
          );
          addedLikes = newLikes.length;

          const existingPlIds = new Set(s.playlists.map((p) => p.id));
          const newPlaylists = (payload.playlists ?? []).filter(
            (p) => p?.id && !existingPlIds.has(p.id)
          );
          addedPlaylists = newPlaylists.length;

          return {
            likedTracks: [...newLikes, ...s.likedTracks],
            playlists: [...newPlaylists, ...s.playlists]
          };
        });
        return { addedLikes, addedPlaylists };
      }
    }),
    {
      name: "sangeet-v2-library"
    }
  )
);
