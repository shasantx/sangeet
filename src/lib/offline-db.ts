/**
 * Persistent IndexedDB audio storage for Sangeet Offline Downloads & Local Audio files.
 * Stores real Blob bytes so files survive page reloads without relying on ephemeral Blob URLs.
 */

export const OFFLINE_DB_NAME = "sangeet-offline-v1";
const STORE_NAME = "audio_items";
const DB_VERSION = 1;

export interface OfflineAudioRecord {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  durationText?: string;
  thumbnail: string;
  mimeType: string;
  sizeBytes: number;
  kind: "local" | "download";
  sourceLabel: string;
  addedAt: number;
  blob: Blob;
}

export type OfflineAudioMeta = Omit<OfflineAudioRecord, "blob">;

const activeObjectUrls = new Map<string, string>();

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }
    const req = indexedDB.open(OFFLINE_DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("addedAt", "addedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Failed to open offline storage."));
  });
}

export async function saveOfflineAudio(
  record: OfflineAudioRecord
): Promise<OfflineAudioMeta> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      const { blob: _ignored, ...meta } = record;
      void _ignored;
      resolve(meta);
    };
    tx.onerror = () => {
      db.close();
      const err = tx.error;
      if (err?.name === "QuotaExceededError") {
        reject(
          new Error(
            "Browser storage quota exceeded. Remove some offline tracks to free space."
          )
        );
      } else {
        reject(err ?? new Error("Failed to store audio offline."));
      }
    };
  });
}

export async function listOfflineAudioMeta(): Promise<OfflineAudioMeta[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      const rows = (req.result as OfflineAudioRecord[]) ?? [];
      const metas: OfflineAudioMeta[] = rows
        .map(({ blob: _ignored, ...meta }) => {
          void _ignored;
          return meta;
        })
        .sort((a, b) => b.addedAt - a.addedAt);
      resolve(metas);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("Failed to read offline library."));
    };
  });
}

export async function getOfflineAudioRecord(
  id: string
): Promise<OfflineAudioRecord | null> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as OfflineAudioRecord | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error ?? new Error("Failed to read offline track."));
    };
  });
}

export async function getOfflineObjectUrl(id: string): Promise<string | null> {
  const existing = activeObjectUrls.get(id);
  if (existing) return existing;
  const record = await getOfflineAudioRecord(id);
  if (!record?.blob) return null;
  const url = URL.createObjectURL(record.blob);
  activeObjectUrls.set(id, url);
  return url;
}

export function revokeOfflineObjectUrl(id: string): void {
  const existing = activeObjectUrls.get(id);
  if (existing) {
    URL.revokeObjectURL(existing);
    activeObjectUrls.delete(id);
  }
}

export function revokeAllOfflineObjectUrls(): void {
  for (const url of activeObjectUrls.values()) {
    URL.revokeObjectURL(url);
  }
  activeObjectUrls.clear();
}

export async function deleteOfflineAudio(id: string): Promise<void> {
  revokeOfflineObjectUrl(id);
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to delete offline track."));
    };
  });
}

export async function clearAllOfflineAudio(): Promise<void> {
  revokeAllOfflineObjectUrls();
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Failed to clear offline storage."));
    };
  });
}

export async function getStorageUsage(): Promise<{
  usedBytes: number;
  quotaBytes: number;
}> {
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return {
        usedBytes: est.usage ?? 0,
        quotaBytes: est.quota ?? 0
      };
    } catch {
      // Fall through
    }
  }
  return { usedBytes: 0, quotaBytes: 0 };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}
