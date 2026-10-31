import { getAlbum, getTrack, playlists } from "@/lib/catalog";
import type { Album, Playlist } from "@/lib/types";

export interface DailyMix {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  playlistId: string;
  trackIds: string[];
  accent: string;
  covers: string[];
}

function coversForTracks(trackIds: string[]): string[] {
  const covers: string[] = [];
  for (const id of trackIds) {
    const track = getTrack(id);
    if (track && !covers.includes(track.artwork)) covers.push(track.artwork);
    if (covers.length === 4) break;
  }
  return covers;
}

function mixFromPlaylist(playlist: Playlist, title: string, subtitle: string): DailyMix {
  return {
    id: `mix-${playlist.id}`,
    title,
    subtitle,
    description: playlist.description,
    playlistId: playlist.id,
    trackIds: playlist.trackIds,
    accent: playlist.accent,
    covers: coversForTracks(playlist.trackIds),
  };
}

const source = [
  ["violet-hours", "Daily Mix 01", "After-hours soul & ambient"],
  ["nocturne-drive", "Daily Mix 02", "Electronic, late and low"],
  ["quiet-luxury", "Daily Mix 03", "Modern soul, unhurried"],
  ["soft-focus", "Daily Mix 04", "Ambient for deep focus"],
  ["new-light", "Daily Mix 05", "New alternative finds"],
  ["the-deep-end", "Daily Mix 06", "Immersive, wide and slow"],
] as const;

export const dailyMixes: DailyMix[] = source
  .map(([playlistId, title, subtitle]) => {
    const playlist = playlists.find((item) => item.id === playlistId);
    return playlist ? mixFromPlaylist(playlist, title, subtitle) : null;
  })
  .filter((mix): mix is DailyMix => Boolean(mix));

export function getAlbumMosaic(trackIds: string[]): Album[] {
  const albums: Album[] = [];
  const seen = new Set<string>();
  for (const id of trackIds) {
    const track = getTrack(id);
    if (!track) continue;
    const album = getAlbum(track.albumId);
    if (!album || seen.has(album.id)) continue;
    seen.add(album.id);
    albums.push(album);
    if (albums.length === 4) break;
  }
  return albums;
}
