import type { Album, Artist, GenreId, Track } from "./types";

/**
 * A small runtime registry for YouTube videos discovered through the local
 * ytmusicapi service. These tracks are not part of the static catalogue, so
 * they are registered on demand and persisted so that a reload keeps the
 * currently playing video and queue resolvable.
 *
 * Only metadata is stored. Playback always happens through the official
 * YouTube IFrame Player.
 */

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds?: number;
  thumbnail?: string;
  year?: number;
  views?: string;
  videoType?: string;
}

export interface AudiusSearchResult {
  id: string;
  title: string;
  artist: string;
  album?: string;
  durationSeconds?: number;
  artwork?: string;
  genre?: string;
  audioUrl?: string;
  permalink?: string;
}

interface RegistrySnapshot {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
}

const STORAGE_KEY = "aura-youtube-discovery-v1";
const MAX_SAVED = 80;

const trackRegistry = new Map<string, Track>();
const artistRegistry = new Map<string, Artist>();
const albumRegistry = new Map<string, Album>();
let hydrated = false;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<RegistrySnapshot>;
    parsed.artists?.forEach((artist) => artist?.id && artistRegistry.set(artist.id, artist));
    parsed.albums?.forEach((album) => album?.id && albumRegistry.set(album.id, album));
    parsed.tracks?.forEach((track) => track?.id && trackRegistry.set(track.id, track));
  } catch {
    // A corrupt cache should never break playback.
  }
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    const snapshot: RegistrySnapshot = {
      tracks: Array.from(trackRegistry.values()).slice(-MAX_SAVED),
      artists: Array.from(artistRegistry.values()).slice(-MAX_SAVED),
      albums: Array.from(albumRegistry.values()).slice(-MAX_SAVED),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Quota or private mode: keep the in-memory registry only.
  }
}

export function getDynamicTrack(id: string): Track | undefined {
  hydrate();
  return trackRegistry.get(id);
}

export function getDynamicArtist(id: string): Artist | undefined {
  hydrate();
  return artistRegistry.get(id);
}

export function getDynamicAlbum(id: string): Album | undefined {
  hydrate();
  return albumRegistry.get(id);
}

export function getDynamicTracks(ids: string[]): Track[] {
  hydrate();
  return ids
    .map((id) => trackRegistry.get(id))
    .filter((track): track is Track => Boolean(track));
}

/**
 * Convert a ytmusicapi result into a first-class Sangeet track. Subsequent calls
 * for the same video are idempotent and return the cached entry.
 */
export function registerYouTubeSearchResult(result: YouTubeSearchResult): Track {
  hydrate();

  const trackId = `yt-${result.videoId}`;
  const existing = trackRegistry.get(trackId);
  if (existing) return existing;

  const artistName = result.artist.trim() || "YouTube";
  const artistId = `yt-artist-${slugify(artistName) || "unknown"}`;
  const albumTitle = result.album?.trim() || `${result.title} · Single`;
  const albumId = `yt-album-${result.videoId}`;
  const artwork = result.thumbnail || `https://i.ytimg.com/vi/${result.videoId}/hqdefault.jpg`;
  const duration = result.durationSeconds && result.durationSeconds > 0 ? result.durationSeconds : 0;

  if (!artistRegistry.has(artistId)) {
    artistRegistry.set(artistId, {
      id: artistId,
      name: artistName,
      bio: `${artistName} on YouTube.`,
      shortBio: `YouTube videos by ${artistName}.`,
      image: artwork,
      location: "YouTube",
      genreIds: [],
      relatedArtistIds: [],
    });
  }

  if (!albumRegistry.has(albumId)) {
    albumRegistry.set(albumId, {
      id: albumId,
      title: albumTitle,
      artistId,
      year: result.year ?? new Date().getFullYear(),
      releaseDate: `${result.year ?? new Date().getFullYear()}-01-01`,
      type: "Single",
      artwork,
      genreIds: [],
      description: `Discovered through YouTube search inside Sangeet.`,
      trackIds: [trackId],
    });
  }

  const track: Track = {
    id: trackId,
    title: result.title,
    artistId,
    albumId,
    duration,
    audioUrl: "",
    artwork,
    genreIds: [] as GenreId[],
    mood: "Music",
    trackNumber: 1,
    source: "youtube",
    youtubeId: result.videoId,
  };

  trackRegistry.set(trackId, track);
  persist();
  return track;
}

export function registerYouTubeSearchResults(results: YouTubeSearchResult[]): Track[] {
  return results.map(registerYouTubeSearchResult);
}

export function registerAudiusSearchResult(result: AudiusSearchResult): Track {
  hydrate();
  const id = result.id.trim();
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Invalid open music track");
  const trackId = `aud-${id}`;
  const existing = trackRegistry.get(trackId);
  if (existing) return existing;
  const artistName = result.artist.trim() || "Independent artist";
  const artistId = `aud-artist-${slugify(artistName) || "unknown"}`;
  const albumName = result.album?.trim() || `${result.title} · Single`;
  const albumId = `aud-album-${id}`;
  const artwork = result.artwork || "/art/album/blue-hour-cinema.svg";
  if (!artistRegistry.has(artistId)) artistRegistry.set(artistId, { id: artistId, name: artistName, bio: `${artistName} on the open music catalog.`, shortBio: `Independent music by ${artistName}.`, image: artwork, location: "Open music catalog", genreIds: [], relatedArtistIds: [] });
  if (!albumRegistry.has(albumId)) albumRegistry.set(albumId, { id: albumId, title: albumName, artistId, year: new Date().getFullYear(), releaseDate: `${new Date().getFullYear()}-01-01`, type: "Single", artwork, genreIds: [], description: result.genre || "Independent release", trackIds: [trackId] });
  const track: Track = { id: trackId, title: result.title, artistId, albumId, duration: result.durationSeconds ?? 0, audioUrl: result.audioUrl || `https://api.audius.co/v1/tracks/${encodeURIComponent(id)}/stream`, artwork, genreIds: [], mood: result.genre || "Music", trackNumber: 1, source: "audius" };
  trackRegistry.set(trackId, track);
  persist();
  return track;
}

export function restoreAudiusTrack(result: AudiusSearchResult): Track | undefined {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(result.id) || !result.title?.trim()) return undefined;
  return registerAudiusSearchResult(result);
}

/** Rehydrate a previously discovered YouTube track from its safe metadata snapshot. */
export function restoreYouTubeTrack(result: YouTubeSearchResult): Track | undefined {
  if (!/^[\w-]{11}$/.test(result.videoId) || !result.title?.trim()) return undefined;
  return registerYouTubeSearchResult(result);
}

export function registerLocalAudioTrack(track: Track, artist: Artist, album: Album): Track {
  hydrate();
  artistRegistry.set(artist.id, artist);
  albumRegistry.set(album.id, album);
  trackRegistry.set(track.id, track);
  persist();
  return track;
}

export function removeDynamicLocalTrack(id: string): void {
  hydrate();
  if (!id.startsWith("local-")) return;
  trackRegistry.delete(id);
  persist();
}
