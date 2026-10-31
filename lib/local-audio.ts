import type { Album, Artist, Track } from "@/lib/types";
import { registerLocalAudioTrack } from "@/lib/dynamic-tracks";

const DB_NAME = "sangeet-local-audio";
const STORE = "files";
const artistId = "device-library";
const albumId = "device-audio";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeAudio(id: string, blob: Blob, name: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id, blob, name });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function metadata(name: string, id: string, url: string): Track {
  return {
    id, title: name.replace(/\.[^.]+$/, "").slice(0, 120), artistId, albumId,
    duration: 0, audioUrl: url, artwork: "/art/album/blue-hour-cinema.svg",
    genreIds: [], mood: "Your device", trackNumber: 1, source: "local",
  };
}

function register(track: Track): Track {
  const artist: Artist = { id: artistId, name: "On this device", bio: "Audio imported from your personal library.", shortBio: "Your local audio files.", image: track.artwork, location: "Device", genreIds: [], relatedArtistIds: [] };
  const album: Album = { id: albumId, title: "Local audio", artistId, year: new Date().getFullYear(), releaseDate: new Date().toISOString().slice(0, 10), type: "Album", artwork: track.artwork, genreIds: [], description: "Audio stored on this device.", trackIds: [track.id] };
  return registerLocalAudioTrack(track, artist, album);
}

export async function importLocalAudio(files: File[]): Promise<Track[]> {
  const added: Track[] = [];
  for (const file of files) {
    if (!file.type.startsWith("audio/") || file.size > 100 * 1024 * 1024) continue;
    const id = `local-${crypto.randomUUID()}`;
    await writeAudio(id, file, file.name);
    const track = metadata(file.name, id, URL.createObjectURL(file));
    register(track);
    added.push(track);
  }
  return added;
}

export async function restoreLocalAudio(): Promise<Track[]> {
  if (typeof indexedDB === "undefined") return [];
  const db = await openDb();
  const rows = await new Promise<{ id: string; blob: Blob; name: string }[]>((resolve, reject) => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return rows.map(({ id, blob, name }) => {
    const track = metadata(name, id, URL.createObjectURL(blob));
    return register(track);
  });
}

export async function removeLocalAudio(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
