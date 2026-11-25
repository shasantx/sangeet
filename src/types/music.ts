export type TrackSource = "youtube" | "audius" | "local" | "offline";

export interface Track {
  id: string; // YouTube videoId, Audius trackId, or local/offline ID
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  duration: number; // seconds
  durationText?: string;
  thumbnail: string;
  explicit?: boolean;
  plays?: string;
  source?: TrackSource;
  streamUrl?: string; // Direct legal audio stream URL (e.g. /api/audius/stream?id=...)
  localUrl?: string; // Ephemeral Blob URL (never persisted to localStorage)
  offlineId?: string; // Persistent IndexedDB record key
  downloadable?: boolean; // True for open-licensed Audius / direct legal audio
}

export interface ArtistSummary {
  id: string;
  name: string;
  thumbnail: string;
  subscribers?: string;
}

export interface AlbumSummary {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  year?: string;
  thumbnail: string;
  type?: "Album" | "Single" | "EP";
}

export interface PlaylistItem {
  id: string;
  name: string;
  description?: string;
  cover?: string;
  tracks: Track[];
  createdAt: number;
  isSystem?: boolean;
}

export interface HomeShelf {
  id: string;
  title: string;
  subtitle?: string;
  items: Track[];
}

export interface SearchResult {
  query: string;
  topResult: Track | null;
  tracks: Track[];
  artists: ArtistSummary[];
  albums: AlbumSummary[];
}

export interface LyricLine {
  time: number; // seconds
  text: string;
}

export interface LyricsResponse {
  synced: LyricLine[];
  plain: string | null;
  source: "lrclib" | "none";
}

export type RepeatMode = "off" | "all" | "one";
export type RightPanelTab = "now-playing" | "queue" | "lyrics" | null;
