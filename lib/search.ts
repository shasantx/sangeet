import {
  albums,
  artists,
  genres,
  getAlbum,
  getArtist,
  playlists,
  tracks,
} from "./catalog";
import type { Album, Artist, Genre, Playlist, Track } from "./types";

export interface SearchResults {
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  genres: Genre[];
  total: number;
}

export interface SearchSuggestion {
  label: string;
  type: "artist" | "album" | "track" | "playlist" | "genre";
  detail: string;
  artwork: string;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function score(
  values: Array<{ value: string; weight: number }>,
  query: string,
): number {
  let best = 0;
  for (const entry of values) {
    const value = normalize(entry.value);
    if (!value.includes(query)) continue;
    let itemScore = entry.weight;
    if (value === query) itemScore += 120;
    else if (value.startsWith(query)) itemScore += 55;
    else if (value.split(/\s+/).some((word) => word.startsWith(query))) itemScore += 24;
    best = Math.max(best, itemScore);
  }
  return best;
}

export function searchCatalog(rawQuery: string): SearchResults {
  const query = normalize(rawQuery.trim());
  if (!query) {
    return { tracks: [], artists: [], albums: [], playlists: [], genres: [], total: 0 };
  }

  const scoredTracks = tracks
    .map((track) => {
      const artist = getArtist(track.artistId);
      const album = getAlbum(track.albumId);
      const genreNames = track.genreIds
        .map((id) => genres.find((genre) => genre.id === id)?.name ?? "")
        .join(" ");
      const trackScore = score(
        [
          { value: track.title, weight: 52 },
          { value: artist?.name ?? "", weight: 34 },
          { value: album?.title ?? "", weight: 25 },
          { value: track.mood, weight: 14 },
          { value: genreNames, weight: 12 },
        ],
        query,
      );
      return { track, trackScore };
    })
    .filter((entry) => entry.trackScore > 0)
    .sort((a, b) => b.trackScore - a.trackScore)
    .map((entry) => entry.track);

  const scoredArtists = artists
    .map((artist) => {
      const genreNames = artist.genreIds
        .map((id) => genres.find((genre) => genre.id === id)?.name ?? "")
        .join(" ");
      const artistScore = score(
        [
          { value: artist.name, weight: 60 },
          { value: artist.location, weight: 12 },
          { value: artist.shortBio, weight: 8 },
          { value: genreNames, weight: 14 },
        ],
        query,
      );
      return { artist, artistScore };
    })
    .filter((entry) => entry.artistScore > 0)
    .sort((a, b) => b.artistScore - a.artistScore)
    .map((entry) => entry.artist);

  const scoredAlbums = albums
    .map((album) => {
      const artist = getArtist(album.artistId);
      const genreNames = album.genreIds
        .map((id) => genres.find((genre) => genre.id === id)?.name ?? "")
        .join(" ");
      const albumScore = score(
        [
          { value: album.title, weight: 56 },
          { value: artist?.name ?? "", weight: 32 },
          { value: album.description, weight: 8 },
          { value: genreNames, weight: 12 },
        ],
        query,
      );
      return { album, albumScore };
    })
    .filter((entry) => entry.albumScore > 0)
    .sort((a, b) => b.albumScore - a.albumScore)
    .map((entry) => entry.album);

  const scoredPlaylists = playlists
    .map((playlist) => {
      const trackNames = playlist.trackIds
        .map((id) => tracks.find((track) => track.id === id)?.title ?? "")
        .join(" ");
      const playlistScore = score(
        [
          { value: playlist.title, weight: 48 },
          { value: playlist.description, weight: 20 },
          { value: playlist.curator, weight: 10 },
          { value: trackNames, weight: 6 },
        ],
        query,
      );
      return { playlist, playlistScore };
    })
    .filter((entry) => entry.playlistScore > 0)
    .sort((a, b) => b.playlistScore - a.playlistScore)
    .map((entry) => entry.playlist);

  const matchedGenres = genres.filter((genre) =>
    score(
      [
        { value: genre.name, weight: 50 },
        { value: genre.description, weight: 10 },
      ],
      query,
    ) > 0,
  );

  return {
    tracks: scoredTracks,
    artists: scoredArtists,
    albums: scoredAlbums,
    playlists: scoredPlaylists,
    genres: matchedGenres,
    total:
      scoredTracks.length +
      scoredArtists.length +
      scoredAlbums.length +
      scoredPlaylists.length +
      matchedGenres.length,
  };
}

export function getSearchSuggestions(rawQuery: string): SearchSuggestion[] {
  const results = searchCatalog(rawQuery);
  const suggestions: SearchSuggestion[] = [];

  results.artists.slice(0, 2).forEach((artist) =>
    suggestions.push({
      label: artist.name,
      type: "artist",
      detail: "Artist",
      artwork: artist.image,
    }),
  );
  results.albums.slice(0, 2).forEach((album) =>
    suggestions.push({
      label: album.title,
      type: "album",
      detail: `Album · ${getArtist(album.artistId)?.name ?? "Sangeet"}`,
      artwork: album.artwork,
    }),
  );
  results.tracks.slice(0, 2).forEach((track) =>
    suggestions.push({
      label: track.title,
      type: "track",
      detail: `Track · ${getArtist(track.artistId)?.name ?? "Sangeet"}`,
      artwork: track.artwork,
    }),
  );
  results.playlists.slice(0, 1).forEach((playlist) =>
    suggestions.push({
      label: playlist.title,
      type: "playlist",
      detail: "Playlist",
      artwork: playlist.artwork,
    }),
  );

  return suggestions.slice(0, 6);
}

export function getSuggestionHref(suggestion: SearchSuggestion): string | null {
  const results = searchCatalog(suggestion.label);
  if (suggestion.type === "artist") {
    const item = results.artists.find((artist) => artist.name === suggestion.label);
    return item ? `/artist/${item.id}` : null;
  }
  if (suggestion.type === "album") {
    const item = results.albums.find((album) => album.title === suggestion.label);
    return item ? `/album/${item.id}` : null;
  }
  if (suggestion.type === "playlist") {
    const item = results.playlists.find((playlist) => playlist.title === suggestion.label);
    return item ? `/playlist/${item.id}` : null;
  }
  if (suggestion.type === "genre") {
    const item = results.genres.find((genre) => genre.name === suggestion.label);
    return item ? `/genre/${item.id}` : null;
  }
  if (suggestion.type === "track") {
    const item = results.tracks.find((track) => track.title === suggestion.label);
    return item ? `/album/${item.albumId}` : null;
  }
  return null;
}
