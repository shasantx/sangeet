/**
 * Lightweight, zero-dependency ID3v2 metadata & cover art extractor for local audio files.
 * Reads only the header/tag slice so multi-megabyte FLAC/MP3 files stay instant.
 */

export interface ExtractedAudioMeta {
  title?: string;
  artist?: string;
  album?: string;
  coverDataUrl?: string;
}

function readSynchsafeInt(view: DataView, offset: number): number {
  return (
    ((view.getUint8(offset) & 0x7f) << 21) |
    ((view.getUint8(offset + 1) & 0x7f) << 14) |
    ((view.getUint8(offset + 2) & 0x7f) << 7) |
    (view.getUint8(offset + 3) & 0x7f)
  );
}

function decodeTextFrame(bytes: Uint8Array): string {
  if (bytes.length < 2) return "";
  const encoding = bytes[0];
  const payload = bytes.subarray(1);
  try {
    if (encoding === 0) {
      return new TextDecoder("iso-8859-1").decode(payload).replace(/\0+$/g, "").trim();
    }
    if (encoding === 1) {
      // UTF-16 with BOM
      const hasBeBom = payload.length >= 2 && payload[0] === 0xfe && payload[1] === 0xff;
      const decoder = new TextDecoder(hasBeBom ? "utf-16be" : "utf-16le");
      const start =
        payload.length >= 2 &&
        ((payload[0] === 0xff && payload[1] === 0xfe) ||
          (payload[0] === 0xfe && payload[1] === 0xff))
          ? 2
          : 0;
      return decoder.decode(payload.subarray(start)).replace(/\0+$/g, "").trim();
    }
    if (encoding === 2) {
      return new TextDecoder("utf-16be").decode(payload).replace(/\0+$/g, "").trim();
    }
    return new TextDecoder("utf-8").decode(payload).replace(/\0+$/g, "").trim();
  } catch {
    return new TextDecoder("utf-8", { fatal: false })
      .decode(payload)
      .replace(/\0+$/g, "")
      .trim();
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function decodeApicFrame(bytes: Uint8Array): string | undefined {
  if (bytes.length < 16) return undefined;
  const encoding = bytes[0];
  let idx = 1;

  // MIME type (null-terminated ISO-8859-1)
  let mimeEnd = idx;
  while (mimeEnd < bytes.length && bytes[mimeEnd] !== 0) mimeEnd++;
  const mime =
    new TextDecoder("iso-8859-1").decode(bytes.subarray(idx, mimeEnd)).trim() ||
    "image/jpeg";
  idx = mimeEnd + 1;

  // Picture type (1 byte)
  if (idx >= bytes.length) return undefined;
  idx += 1;

  // Description (null-terminated according to encoding)
  if (encoding === 1 || encoding === 2) {
    while (idx + 1 < bytes.length && !(bytes[idx] === 0 && bytes[idx + 1] === 0)) {
      idx += 2;
    }
    idx += 2;
  } else {
    while (idx < bytes.length && bytes[idx] !== 0) idx++;
    idx += 1;
  }

  if (idx >= bytes.length) return undefined;
  const imgBytes = bytes.subarray(idx);
  // Skip absurdly large embedded images (> 1.5MB) to keep IndexedDB metadata fast
  if (imgBytes.length < 32 || imgBytes.length > 1_500_000) return undefined;

  const safeMime = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(mime)
    ? mime === "image/jpg"
      ? "image/jpeg"
      : mime
    : "image/jpeg";

  return `data:${safeMime};base64,${bytesToBase64(imgBytes)}`;
}

/**
 * Parse filename fallback like "Artist - Track Title.mp3" when ID3 tags are absent.
 */
export function parseFilenameMeta(filename: string): {
  title: string;
  artist?: string;
} {
  const clean = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const dashSplit = clean.split(/\s+[-–—]\s+/);
  if (dashSplit.length >= 2 && dashSplit[0].length <= 45) {
    return {
      artist: dashSplit[0].trim(),
      title: dashSplit.slice(1).join(" - ").trim()
    };
  }
  return { title: clean || "Untitled Audio" };
}

export async function extractAudioMetadata(
  file: Blob
): Promise<ExtractedAudioMeta> {
  const result: ExtractedAudioMeta = {};
  try {
    // Read initial header (10 bytes)
    const headerBuf = await file.slice(0, 10).arrayBuffer();
    if (headerBuf.byteLength < 10) return result;
    const headerView = new DataView(headerBuf);

    // Check for ID3v2 signature ("ID3")
    if (
      headerView.getUint8(0) !== 0x49 ||
      headerView.getUint8(1) !== 0x44 ||
      headerView.getUint8(2) !== 0x33
    ) {
      return result;
    }

    const majorVersion = headerView.getUint8(3);
    if (majorVersion < 3 || majorVersion > 4) return result;

    const flags = headerView.getUint8(5);
    const tagSize = Math.min(readSynchsafeInt(headerView, 6), 2_000_000);
    if (tagSize <= 10) return result;

    const tagBuf = await file.slice(10, 10 + tagSize).arrayBuffer();
    const view = new DataView(tagBuf);
    const bytes = new Uint8Array(tagBuf);

    let offset = 0;
    // Skip extended header if present
    if ((flags & 0x40) !== 0 && offset + 4 <= bytes.length) {
      const extSize =
        majorVersion === 4
          ? readSynchsafeInt(view, offset)
          : view.getUint32(offset, false);
      offset += majorVersion === 4 ? extSize : extSize + 4;
    }

    while (offset + 10 <= bytes.length) {
      const frameId = String.fromCharCode(
        bytes[offset],
        bytes[offset + 1],
        bytes[offset + 2],
        bytes[offset + 3]
      );
      if (!/^[A-Z0-9]{4}$/.test(frameId)) break;

      const frameSize =
        majorVersion === 4
          ? readSynchsafeInt(view, offset + 4)
          : view.getUint32(offset + 4, false);
      if (frameSize <= 0 || offset + 10 + frameSize > bytes.length) break;

      const frameData = bytes.subarray(offset + 10, offset + 10 + frameSize);
      if (frameId === "TIT2" && !result.title) {
        result.title = decodeTextFrame(frameData);
      } else if ((frameId === "TPE1" || frameId === "TPE2") && !result.artist) {
        result.artist = decodeTextFrame(frameData);
      } else if (frameId === "TALB" && !result.album) {
        result.album = decodeTextFrame(frameData);
      } else if (frameId === "APIC" && !result.coverDataUrl) {
        result.coverDataUrl = decodeApicFrame(frameData);
      }

      offset += 10 + frameSize;
    }
  } catch {
    // Fallback gracefully to filename metadata
  }
  return result;
}
