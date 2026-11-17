import {
  albums,
  artists,
  genres,
  getAlbum,
  getArtist,
  getGenre,
  getTrack,
  playlists,
  tracks,
} from "@/lib/catalog";
import { dailyMixes, type DailyMix } from "@/lib/mixes";
import type { Album, Artist, GenreId, Playlist, Track } from "@/lib/types";
import { hashString } from "@/lib/utils";

export interface PersonalizationInput {
  recentlyPlayed: string[];
  recentlyPlayedAt?: Record<string, number>;
  likedTrackIds: string[];
  followedArtistIds: string[];
  savedAlbumIds?: string[];
  preferredArtistIds: string[];
  recentSearches?: string[];
  displayName?: string | null;
}

export interface PersonalizedSpotlight {
  track: Track;
  artist: Artist;
  album: Album;
  eyebrow: string;
}

export interface PersonalizedFeed {
  isNewListener: boolean;
  tracks: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  dailyMixes: DailyMix[];
  quickPicks: Track[];
  spotlight: PersonalizedSpotlight | null;
  tasteSeedQuery: string;
  tasteSeedLabel: string;
  topGenreIds: GenreId[];
  topArtistIds: string[];
}

export function getDailySeedOffset(): number {
  const now = new Date();
  const dayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor(dayStart / 86_400_000);
}

function getRotationBucket(): number {
  return Math.floor(Date.now() / 3_600_000);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function rotationJitter(seedKey: string, id: string, scale = 0.9): number {
  return ((hashString(`${seedKey}:${id}`) % 1000) / 1000) * scale;
}

function addMapWeight<K>(map: Map<K, number>, key: K, amount: number): void {
  if (!key || !Number.isFinite(amount) || amount <= 0) return;
  map.set(key, (map.get(key) ?? 0) + amount);
}

const isRealTrack = (track: Track): boolean =>
  Boolean(
    track.youtubeId ||
      track.source === "youtube" ||
      track.source === "audius" ||
      track.artwork.startsWith("https://"),
  );

const isRealArtist = (artist: Artist): boolean =>
  artist.image.startsWith("https://") ||
  tracks.some((t) => t.artistId === artist.id && isRealTrack(t));

const isRealAlbum = (album: Album): boolean =>
  album.artwork.startsWith("https://") ||
  album.trackIds.some((id) => {
    const t = getTrack(id);
    return t ? isRealTrack(t) : false;
  });

export function buildPersonalizedFeed({
  recentlyPlayed,
  recentlyPlayedAt = {},
  likedTrackIds,
  followedArtistIds,
  savedAlbumIds = [],
  preferredArtistIds,
  recentSearches = [],
  displayName,
}: PersonalizationInput): PersonalizedFeed {
  const isNewListener =
    recentlyPlayed.length === 0 &&
    likedTrackIds.length === 0 &&
    followedArtistIds.length === 0 &&
    preferredArtistIds.length === 0;

  const now = Date.now();
  const directArtistWeights = new Map<string, number>();
  const relatedArtistWeights = new Map<string, number>();
  const genreWeights = new Map<GenreId, number>();
  const albumWeights = new Map<string, number>();
  const likedSet = new Set(likedTrackIds);
  const recentSet = new Set(recentlyPlayed);
  const followedSet = new Set(followedArtistIds);
  const preferredSet = new Set(preferredArtistIds);

  // 1. Recently played (recency-weighted)
  recentlyPlayed.forEach((trackId, index) => {
    const track = getTrack(trackId);
    if (!track) return;

    const playedAt = recentlyPlayedAt[trackId];
    const recencyWeight =
      typeof playedAt === "number" && Number.isFinite(playedAt)
        ? Math.max(0.35, 2.4 / (1 + Math.max(0, (now - playedAt) / 3_600_000) / 24))
        : Math.max(0.4, 2.2 - index * 0.08);

    addMapWeight(directArtistWeights, track.artistId, recencyWeight);
    addMapWeight(albumWeights, track.albumId, recencyWeight * 0.65);
    track.genreIds.forEach((genreId) => addMapWeight(genreWeights, genreId, recencyWeight * 0.8));

    const artist = getArtist(track.artistId);
    artist?.genreIds.forEach((genreId) => addMapWeight(genreWeights, genreId, recencyWeight * 0.35));
  });

  // 2. Liked tracks (3x weight)
  likedTrackIds.forEach((trackId) => {
    const track = getTrack(trackId);
    if (!track) return;
    addMapWeight(directArtistWeights, track.artistId, 3);
    addMapWeight(albumWeights, track.albumId, 1.8);
    track.genreIds.forEach((genreId) => addMapWeight(genreWeights, genreId, 3));

    const artist = getArtist(track.artistId);
    artist?.genreIds.forEach((genreId) => addMapWeight(genreWeights, genreId, 1.2));
  });

  // 3. Followed artists (4x weight)
  followedArtistIds.forEach((artistId) => {
    addMapWeight(directArtistWeights, artistId, 4);
    const artist = getArtist(artistId);
    artist?.genreIds.forEach((genreId) => addMapWeight(genreWeights, genreId, 2.2));
  });

  // 4. Preferred onboarding artists (3x weight)
  preferredArtistIds.forEach((artistId) => {
    addMapWeight(directArtistWeights, artistId, 3);
    const artist = getArtist(artistId);
    artist?.genreIds.forEach((genreId) => addMapWeight(genreWeights, genreId, 1.8));
  });

  // 5. Saved albums
  savedAlbumIds.forEach((albumId) => {
    addMapWeight(albumWeights, albumId, 2.6);
    const album = getAlbum(albumId);
    if (!album) return;
    addMapWeight(directArtistWeights, album.artistId, 2.2);
    album.genreIds.forEach((genreId) => addMapWeight(genreWeights, genreId, 1.5));
  });

  // 6. Recent searches
  recentSearches.forEach((rawTerm, index) => {
    const term = normalizeText(rawTerm);
    if (term.length < 2) return;
    const searchWeight = Math.max(0.6, 1.8 - index * 0.2);

    genres.forEach((genre) => {
      if (term.includes(normalizeText(genre.name)) || term.includes(genre.id)) {
        addMapWeight(genreWeights, genre.id, searchWeight * 1.4);
      }
    });

    artists.forEach((artist) => {
      const nameMatch = normalizeText(artist.name);
      const aliasMatch = artist.aliases?.some((alias) => {
        const normAlias = normalizeText(alias);
        return normAlias.length >= 2 && (term.includes(normAlias) || normAlias.includes(term));
      });
      if (nameMatch.includes(term) || term.includes(nameMatch) || aliasMatch) {
        addMapWeight(directArtistWeights, artist.id, searchWeight * 1.6);
        artist.genreIds.forEach((genreId) => addMapWeight(genreWeights, genreId, searchWeight * 0.7));
      }
    });
  });

  // 7. Boost relatedArtistIds of artists the user listens to
  for (const [artistId, weight] of directArtistWeights.entries()) {
    const artist = getArtist(artistId);
    if (!artist) continue;
    for (const relatedId of artist.relatedArtistIds) {
      addMapWeight(relatedArtistWeights, relatedId, weight * 0.45);
    }
  }

  const topArtistEntries = Array.from(directArtistWeights.entries()).sort((a, b) => b[1] - a[1]);
  const topGenreEntries = Array.from(genreWeights.entries()).sort((a, b) => b[1] - a[1]);
  const topArtistIds = topArtistEntries.map(([id]) => id);
  const topGenreIds = topGenreEntries.map(([id]) => id);

  const seedParts = [
    getDailySeedOffset(),
    getRotationBucket(),
    displayName ?? "guest",
    topArtistIds[0] ?? "none",
    topGenreIds[0] ?? "none",
  ];
  const rotationSeed = seedParts.join(":");

  // Rank tracks
  const rankedTracks = [...tracks]
    .map((track) => {
      const artistAffinity =
        (directArtistWeights.get(track.artistId) ?? 0) * 1.5 +
        (relatedArtistWeights.get(track.artistId) ?? 0) * 0.9;
      const genreAffinity = track.genreIds.reduce(
        (sum, genreId) => sum + (genreWeights.get(genreId) ?? 0),
        0,
      );
      const albumAffinity = albumWeights.get(track.albumId) ?? 0;
      const engagementBoost = (likedSet.has(track.id) ? 2.8 : 0) + (recentSet.has(track.id) ? 1.4 : 0);
      const qualityBoost = isRealTrack(track) ? 12 : 0;
      const jitter = rotationJitter(rotationSeed, track.id, isNewListener ? 1.4 : 1.05);
      return {
        track,
        score: artistAffinity + genreAffinity + albumAffinity + engagementBoost + qualityBoost + jitter,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.track);

  // Rank artists (boosting relatedArtistIds of listened/followed/preferred artists)
  const rankedArtists = [...artists]
    .map((artist) => {
      const direct = directArtistWeights.get(artist.id) ?? 0;
      const related = relatedArtistWeights.get(artist.id) ?? 0;
      const genreAffinity = artist.genreIds.reduce(
        (sum, genreId) => sum + (genreWeights.get(genreId) ?? 0) * 0.85,
        0,
      );
      const explicitBoost = (followedSet.has(artist.id) ? 2.5 : 0) + (preferredSet.has(artist.id) ? 2.0 : 0);
      const imageBoost = isRealArtist(artist) ? 10 : 0;
      const jitter = rotationJitter(rotationSeed, artist.id, isNewListener ? 1.45 : 1.0);
      return {
        artist,
        score: direct * 1.7 + related * 1.65 + genreAffinity + explicitBoost + imageBoost + jitter,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.artist);

  // Rank albums
  const rankedAlbums = [...albums]
    .map((album) => {
      const albumDirect = albumWeights.get(album.id) ?? 0;
      const artistAffinity =
        (directArtistWeights.get(album.artistId) ?? 0) * 1.4 +
        (relatedArtistWeights.get(album.artistId) ?? 0) * 0.9;
      const genreAffinity = album.genreIds.reduce(
        (sum, genreId) => sum + (genreWeights.get(genreId) ?? 0) * 0.9,
        0,
      );
      const editorialBoost =
        (album.featured ? 0.9 : 0) +
        (isRealAlbum(album) ? 10 : 0) +
        (album.year >= 2025 ? 0.25 : 0);
      const jitter = rotationJitter(rotationSeed, album.id, isNewListener ? 1.35 : 0.95);
      return {
        album,
        score: albumDirect * 1.6 + artistAffinity + genreAffinity + editorialBoost + jitter,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.album);

  // Rank playlists
  const rankedPlaylists = [...playlists]
    .map((playlist) => {
      const genreAffinity = playlist.genreIds.reduce(
        (sum, genreId) => sum + (genreWeights.get(genreId) ?? 0) * 1.1,
        0,
      );
      const trackOverlap = playlist.trackIds.reduce((sum, id) => {
        const track = getTrack(id);
        if (!track) return sum;
        const hit =
          (likedSet.has(id) ? 1.5 : 0) +
          (recentSet.has(id) ? 0.9 : 0) +
          (directArtistWeights.get(track.artistId) ?? 0) * 0.35;
        return sum + hit;
      }, 0);
      const editorialBoost =
        (playlist.featured ? 1.0 : 0) + (playlist.artwork.startsWith("https://") ? 0.5 : 0);
      const jitter = rotationJitter(rotationSeed, playlist.id, isNewListener ? 1.35 : 0.9);
      return {
        playlist,
        score: genreAffinity + Math.min(8, trackOverlap) + editorialBoost + jitter,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.playlist);

  // Rank Daily Mixes
  const rankedDailyMixes = [...dailyMixes]
    .map((mix) => {
      const sourcePlaylist = playlists.find((p) => p.id === mix.playlistId);
      const genreAffinity = (sourcePlaylist?.genreIds ?? []).reduce(
        (sum, genreId) => sum + (genreWeights.get(genreId) ?? 0) * 1.15,
        0,
      );
      const trackOverlap = mix.trackIds.reduce((sum, id) => {
        const track = getTrack(id);
        if (!track) return sum;
        return (
          sum +
          (likedSet.has(id) ? 1.6 : 0) +
          (recentSet.has(id) ? 1.0 : 0) +
          (directArtistWeights.get(track.artistId) ?? 0) * 0.35
        );
      }, 0);
      const jitter = rotationJitter(rotationSeed, mix.id, 1.0);
      return {
        mix,
        score: genreAffinity + Math.min(8, trackOverlap) + jitter,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.mix);

  // Quick Picks: top 7 personalized tracks (mix of recent + liked + taste-matched)
  const quickPickList: Track[] = [];
  const quickPickSeen = new Set<string>();
  const pushQuickPick = (track: Track | undefined) => {
    if (!track || quickPickSeen.has(track.id) || quickPickList.length >= 7) return;
    quickPickSeen.add(track.id);
    quickPickList.push(track);
  };

  for (const id of recentlyPlayed.slice(0, 3)) {
    pushQuickPick(getTrack(id));
    if (quickPickList.length >= 2) break;
  }
  for (const id of likedTrackIds.slice(0, 4)) {
    pushQuickPick(getTrack(id));
    if (quickPickList.length >= 4) break;
  }
  for (const track of rankedTracks) {
    pushQuickPick(track);
    if (quickPickList.length >= 7) break;
  }

  // Spotlight release (always prefer real playable albums/tracks over demo MP3s)
  let spotlight: PersonalizedSpotlight | null = null;
  const spotlightAlbum =
    rankedAlbums.find((album) => album.trackIds.length > 0 && isRealAlbum(album)) ??
    rankedAlbums.find((album) => album.trackIds.length > 0);

  if (spotlightAlbum) {
    const spotlightTrack = getTrack(spotlightAlbum.trackIds[0]) ?? rankedTracks[0];
    const spotlightArtist = getArtist(spotlightAlbum.artistId) ?? getArtist(spotlightTrack?.artistId ?? "");
    if (spotlightTrack && spotlightArtist) {
      const hasPersonalAffinity =
        (directArtistWeights.get(spotlightArtist.id) ?? 0) > 0 ||
        (albumWeights.get(spotlightAlbum.id) ?? 0) > 0;
      const eyebrow = isNewListener
        ? spotlightAlbum.year >= 2025
          ? "New release from"
          : "Trending pick"
        : hasPersonalAffinity
          ? "Picked from your rotation"
          : spotlightAlbum.year >= 2025
            ? "New release from"
            : "Picked for you";

      spotlight = {
        track: spotlightTrack,
        artist: spotlightArtist,
        album: spotlightAlbum,
        eyebrow,
      };
    }
  }

  // Taste seed query & label
  const primaryArtistId = preferredArtistIds[0] ?? followedArtistIds[0] ?? topArtistIds[0];
  const primaryArtist = primaryArtistId ? getArtist(primaryArtistId) : undefined;
  const topGenre = topGenreIds[0] ? getGenre(topGenreIds[0]) : undefined;
  const latestSearch = recentSearches.find((term) => term.trim().length >= 2)?.trim();

  let tasteSeedQuery = "Trending Hindi and Nepali songs";
  let tasteSeedLabel = "Trending on Sangeet";

  if (primaryArtist) {
    tasteSeedQuery = `${primaryArtist.name} songs`;
    tasteSeedLabel = `Because you listen to ${primaryArtist.name}`;
  } else if (latestSearch) {
    tasteSeedQuery = latestSearch;
    tasteSeedLabel = "Inspired by your search";
  } else if (topGenre) {
    tasteSeedQuery = `${topGenre.name} songs`;
    tasteSeedLabel = `Because you enjoy ${topGenre.name}`;
  }

  return {
    isNewListener,
    tracks: rankedTracks,
    artists: rankedArtists,
    albums: rankedAlbums,
    playlists: rankedPlaylists,
    dailyMixes: rankedDailyMixes,
    quickPicks: quickPickList,
    spotlight,
    tasteSeedQuery,
    tasteSeedLabel,
    topGenreIds,
    topArtistIds,
  };
}
