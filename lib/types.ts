export type GenreId =
  | "ambient"
  | "electronic"
  | "alternative"
  | "soul"
  | "jazz"
  | "indie"
  | "cinematic"
  | "downtempo"
  | "pop"
  | "hiphop";

export interface Genre {
  id: GenreId;
  name: string;
  description: string;
  image: string;
  accent: string;
  trackIds: string[];
}

export interface Artist {
  id: string;
  name: string;
  bio: string;
  shortBio: string;
  image: string;
  location: string;
  genreIds: GenreId[];
  relatedArtistIds: string[];
}

export interface Album {
  id: string;
  title: string;
  artistId: string;
  year: number;
  releaseDate: string;
  type: "Album" | "EP" | "Single";
  artwork: string;
  genreIds: GenreId[];
  description: string;
  trackIds: string[];
  featured?: boolean;
}

export interface Track {
  id: string;
  title: string;
  artistId: string;
  albumId: string;
  duration: number;
  audioUrl: string;
  artwork: string;
  source?: "local" | "youtube";
  youtubeId?: string;
  genreIds: GenreId[];
  mood: string;
  trackNumber: number;
  explicit?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  curator: string;
  artwork: string;
  trackIds: string[];
  genreIds: GenreId[];
  accent: string;
  featured?: boolean;
}

export interface UserPlaylist {
  id: string;
  title: string;
  description: string;
  artwork?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DemoProfile {
  id: string;
  name: string;
  handle: string;
  initials: string;
  joined: string;
  plan: string;
  avatarColor: string;
}
