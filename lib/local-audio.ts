import type { LocalScannedTrack } from "@/lib/android-bridge";
import type { Album, Artist, DesktopMusicScanResult, DesktopScannedTrack, Track } from "@/lib/types";
import { registerLocalAudioTrack } from "@/lib/dynamic-tracks";

const DB_NAME = "sangeet-local-audio";
const STORE = "files";
const artistId = "device-library";
const albumId = "device-audio";
const LOCAL_ARTWORK = "/art/albums/blue-hour-cinema.svg";
const MAX_LOCAL_FILE_BYTES = 250 * 1024 * 1024;
const AUDIO_EXTENSION_RE = /\.(mp3|m4a|aac|wav|flac|ogg|opus|wma|aiff|alac|caf|webm|3gp|mp4)$/i;

interface StoredLocalAudioRow {
  id: string;
  blob: Blob;
  name: string;
  duration?: number;
}

const objectUrlCache = new Map<string, string>();

function isSupportedAudioFile(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_LOCAL_FILE_BYTES) return false;
  return (
    file.type.startsWith("audio/") ||
    file.type === "application/ogg" ||
    file.type === "video/ogg" ||
    AUDIO_EXTENSION_RE.test(file.name)
  );
}

function getOrCreateObjectUrl(id: string, blob: Blob): string {
  const cached = objectUrlCache.get(id);
  if (cached) return cached;
  const created = URL.createObjectURL(blob);
  objectUrlCache.set(id, created);
  return created;
}

function probeAudioDuration(url: string): Promise<number> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return Promise.resolve(0);
  }
  return new Promise((resolve) => {
    const probe = new Audio();
    probe.preload = "metadata";
    let settled = false;

    const cleanup = (value: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      probe.removeEventListener("loadedmetadata", onLoaded);
      probe.removeEventListener("error", onError);
      try {
        probe.removeAttribute("src");
        probe.load();
      } catch {
        // Ignore cleanup errors.
      }
      resolve(value);
    };

    const onLoaded = () => {
      const dur = probe.duration;
      cleanup(Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 0);
    };
    const onError = () => cleanup(0);

    const timer = window.setTimeout(() => cleanup(0), 2000);
    probe.addEventListener("loadedmetadata", onLoaded);
    probe.addEventListener("error", onError);
    probe.src = url;
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeAudio(id: string, blob: Blob, name: string, duration = 0) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id, blob, name, duration } satisfies StoredLocalAudioRow);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function metadata(name: string, id: string, url: string, duration = 0): Track {
  return {
    id,
    title: name.replace(/\.[^.]+$/, "").slice(0, 120),
    artistId,
    albumId,
    duration,
    audioUrl: url,
    artwork: LOCAL_ARTWORK,
    genreIds: [],
    mood: "Your device",
    trackNumber: 1,
    source: "local",
  };
}

function register(track: Track): Track {
  const artist: Artist = {
    id: artistId,
    name: "On this device",
    bio: "Audio imported from your personal library.",
    shortBio: "Your local audio files.",
    image: track.artwork,
    location: "Device",
    genreIds: [],
    relatedArtistIds: [],
  };
  const album: Album = {
    id: albumId,
    title: "Local audio",
    artistId,
    year: new Date().getFullYear(),
    releaseDate: new Date().toISOString().slice(0, 10),
    type: "Album",
    artwork: track.artwork,
    genreIds: [],
    description: "Audio stored on this device.",
    trackIds: [track.id],
  };
  return registerLocalAudioTrack(track, artist, album);
}

export async function importLocalAudio(
  files: File[],
): Promise<{ added: Track[]; skipped: number }> {
  const added: Track[] = [];
  let skipped = 0;

  for (const file of files) {
    if (!isSupportedAudioFile(file)) {
      skipped += 1;
      continue;
    }
    try {
      const id = `local-${crypto.randomUUID()}`;
      const url = getOrCreateObjectUrl(id, file);
      const duration = await probeAudioDuration(url);
      await writeAudio(id, file, file.name, duration);
      const track = metadata(file.name, id, url, duration);
      register(track);
      added.push(track);
    } catch {
      skipped += 1;
    }
  }

  return { added, skipped };
}

export async function restoreLocalAudio(): Promise<Track[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const rows = await new Promise<StoredLocalAudioRow[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result as StoredLocalAudioRow[]);
    request.onerror = () => reject(request.error);
  });
  db.close();

  return rows.map(({ id, blob, name, duration }) => {
    const url = getOrCreateObjectUrl(id, blob);
    const track = metadata(name, id, url, typeof duration === "number" ? duration : 0);
    return register(track);
  });
}

export async function removeLocalAudio(id: string): Promise<void> {
  const cachedUrl = objectUrlCache.get(id);
  if (cachedUrl) {
    try {
      URL.revokeObjectURL(cachedUrl);
    } catch {
      // Ignore revoke failures.
    }
    objectUrlCache.delete(id);
  }
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function slugifyMeta(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface ScannedDeviceTrackInput {
  id: string | number;
  title: string;
  artist: string;
  album: string;
  duration: number;
  uri: string;
}

function registerScannedDeviceTracks(
  items: ScannedDeviceTrackInput[],
  prefix: "local-android" | "local-desktop",
  defaultArtist: string,
  defaultAlbum: string,
): Track[] {
  const artwork = LOCAL_ARTWORK;
  const year = new Date().getFullYear();
  const releaseDate = new Date().toISOString().slice(0, 10);
  const albumTrackIds = new Map<string, string[]>();

  return items.map((item, index) => {
    const trackId = `${prefix}-${item.id}`;
    const artistName = item.artist?.trim() || defaultArtist;
    const albumName = item.album?.trim() || defaultAlbum;
    const resolvedArtistId = `local-artist-${slugifyMeta(artistName) || "unknown"}`;
    const resolvedAlbumId = `local-album-${slugifyMeta(albumName) || "unknown"}`;

    const existingIds = albumTrackIds.get(resolvedAlbumId) ?? [];
    if (!existingIds.includes(trackId)) existingIds.push(trackId);
    albumTrackIds.set(resolvedAlbumId, existingIds);

    const track: Track = {
      id: trackId,
      title: (item.title?.trim() || "Untitled audio").slice(0, 140),
      artistId: resolvedArtistId,
      albumId: resolvedAlbumId,
      duration: Number.isFinite(item.duration) && item.duration > 0 ? item.duration : 0,
      audioUrl: item.uri,
      artwork,
      genreIds: [],
      mood: "On this device",
      trackNumber: index + 1,
      source: "local",
    };

    const artist: Artist = {
      id: resolvedArtistId,
      name: artistName,
      bio: `${artistName} from your device library.`,
      shortBio: "Local audio on this device.",
      image: artwork,
      location: "Device",
      genreIds: [],
      relatedArtistIds: [],
    };

    const album: Album = {
      id: resolvedAlbumId,
      title: albumName,
      artistId: resolvedArtistId,
      year,
      releaseDate,
      type: "Album",
      artwork,
      genreIds: [],
      description: "Audio files stored on this device.",
      trackIds: [...existingIds],
    };

    return registerLocalAudioTrack(track, artist, album);
  });
}

/**
 * Register Android MediaStore audio tracks (`content://` URIs) in the dynamic
 * track registry while preserving each track's artist and album metadata.
 */
export function registerScannedAndroidTracks(items: LocalScannedTrack[]): Track[] {
  return registerScannedDeviceTracks(items, "local-android", "Unknown artist", "Device audio");
}

/**
 * Register Windows/Desktop native audio files (`sangeet-local://` URIs) in the dynamic
 * track registry so local PC songs play inside the full Sangeet player UI.
 */
export function registerScannedDesktopTracks(items: DesktopScannedTrack[]): Track[] {
  return registerScannedDeviceTracks(items, "local-desktop", "On this PC", "Local music");
}

export async function scanDesktopAudioLibrary(): Promise<{
  folders: string[];
  tracks: Track[];
}> {
  if (typeof window === "undefined" || !window.sangeetDesktop?.scanMusicLibrary) {
    return { folders: [], tracks: [] };
  }
  const res: DesktopMusicScanResult = await window.sangeetDesktop.scanMusicLibrary();
  return {
    folders: Array.isArray(res?.folders) ? res.folders : [],
    tracks: registerScannedDesktopTracks(Array.isArray(res?.tracks) ? res.tracks : []),
  };
}
