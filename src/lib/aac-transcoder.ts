"use client";

/**
 * Source-first AAC playback.
 *
 * 1. Sniff the first bytes of a stream. If the source already serves AAC
 *    (MP4/M4A or ADTS) it is played untouched — no encoding at all.
 * 2. Otherwise (MP3) the stream is fetched in small HTTP Range chunks, each
 *    chunk is decoded + re-encoded to AAC on-device with WebCodecs, packed as
 *    fragmented MP4 and appended to a MediaSource while it plays. Playback
 *    starts after the first chunk, and only ~30 s ahead is ever fetched
 *    (data-saving, Spotify-style). Seeking outside the buffer restarts the
 *    pipeline at the matching byte offset.
 * 3. Devices without an AAC encoder / MediaSource fall back to the original.
 */

import { ArrayBufferTarget, Muxer, StreamTarget } from "mp4-muxer";

const AAC_CODEC = "mp4a.40.2";
const AAC_MIME = `audio/mp4; codecs="${AAC_CODEC}"`;
const AAC_BITRATE = 192_000;

/** First request is small so playback starts fast; later chunks are larger. */
const FIRST_CHUNK_BYTES = 96 * 1024;
const CHUNK_BYTES = 256 * 1024;
/** Stop fetching once this much audio is buffered ahead of the playhead. */
const BUFFER_AHEAD_SECONDS = 30;
/** Drop buffered audio further behind the playhead than this. */
const KEEP_BEHIND_SECONDS = 45;
const MAX_CODEC_QUEUE = 48;
const HEAD_CACHE_LIMIT = 4;

export type SourceContainer = "mp4" | "adts" | "mp3" | "other";

export type PreparedKind = "native-aac" | "transcoded-aac" | "original";

export interface PreparedAudioSource {
  /** Value to assign to `audio.src`. */
  src: string;
  kind: PreparedKind;
  /** Why the original was used, when kind === "original". */
  reason?: "unsupported" | "not-mp3" | "probe-failed";
  /** Call right after `audio.src = src`. */
  attach: (audio: HTMLAudioElement) => void;
  /** Stop fetching/encoding and release the MediaSource. Safe to call twice. */
  dispose: () => void;
}

/* -------------------------------------------------------------------------- */
/* MP3 frame parsing                                                          */
/* -------------------------------------------------------------------------- */

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000] // MPEG-2.5
};

export interface Mp3FrameHeader {
  length: number;
  sampleRate: number;
  channels: number;
  samples: number;
  bitrate: number;
}

/** Parses an MPEG Layer III frame header at `i`, or returns null. */
export function parseMp3FrameHeader(b: Uint8Array, i: number): Mp3FrameHeader | null {
  if (i < 0 || i + 4 > b.length) return null;
  if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const version = (b[i + 1] >> 3) & 3;
  const layer = (b[i + 1] >> 1) & 3;
  if (version === 1 || layer !== 1) return null;
  const bitrateIndex = (b[i + 2] >> 4) & 0xf;
  const sampleRateIndex = (b[i + 2] >> 2) & 3;
  if (bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) return null;
  const padding = (b[i + 2] >> 1) & 1;
  const channels = ((b[i + 3] >> 6) & 3) === 3 ? 1 : 2;
  const bitrate = (version === 3 ? BITRATES_V1_L3 : BITRATES_V2_L3)[bitrateIndex] * 1000;
  const sampleRate = SAMPLE_RATES[version][sampleRateIndex];
  const samples = version === 3 ? 1152 : 576;
  const length = Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
  if (length < 24) return null;
  return { length, sampleRate, channels, samples, bitrate };
}

/** Byte length of a leading ID3v2 tag (0 when absent). */
export function id3TagLength(b: Uint8Array): number {
  if (b.length >= 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    const size =
      ((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f);
    const footer = b[5] & 0x10 ? 10 : 0;
    return 10 + size + footer;
  }
  return 0;
}

/**
 * Finds the first frame start at or after `from` whose following frame header
 * is also valid (guards against false sync words inside audio data).
 * Returns -1 when no candidate exists, or `{ at, verified: false }` when the
 * candidate is too close to the end of the buffer to verify yet.
 */
function findFrameStart(b: Uint8Array, from: number): { at: number; verified: boolean } | null {
  for (let j = Math.max(0, from); j + 4 <= b.length; j++) {
    const h = parseMp3FrameHeader(b, j);
    if (!h) continue;
    const next = j + h.length;
    if (next + 4 > b.length) return { at: j, verified: false };
    const h2 = parseMp3FrameHeader(b, next);
    if (h2 && h2.sampleRate === h.sampleRate) return { at: j, verified: true };
  }
  return null;
}

/** Detects the container of audio bytes that start right after any ID3 tag. */
export function sniffContainer(b: Uint8Array): SourceContainer {
  if (
    b.length >= 8 &&
    b[4] === 0x66 &&
    b[5] === 0x74 &&
    b[6] === 0x79 &&
    b[7] === 0x70
  ) {
    return "mp4";
  }
  // ADTS AAC: 12-bit sync + layer bits 00
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return "adts";
  const found = findFrameStart(b.subarray(0, Math.min(b.length, 8192)), 0);
  if (found?.verified) return "mp3";
  return "other";
}

/** True for a Xing/Info/VBRI header frame (metadata, not audio). */
function isVbrHeaderFrame(frame: Uint8Array): boolean {
  const limit = Math.min(frame.length - 4, 48);
  for (let k = 4; k < limit; k++) {
    const a = frame[k], b = frame[k + 1], c = frame[k + 2], d = frame[k + 3];
    if (
      (a === 0x58 && b === 0x69 && c === 0x6e && d === 0x67) || // Xing
      (a === 0x49 && b === 0x6e && c === 0x66 && d === 0x6f) || // Info
      (a === 0x56 && b === 0x42 && c === 0x52 && d === 0x49) // VBRI
    ) {
      return true;
    }
  }
  return false;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/* -------------------------------------------------------------------------- */
/* Capability checks                                                          */
/* -------------------------------------------------------------------------- */

function hasWebCodecsAudio(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof AudioEncoder !== "undefined" &&
    typeof AudioDecoder !== "undefined" &&
    typeof EncodedAudioChunk !== "undefined"
  );
}

/** Streaming playback needs WebCodecs + MediaSource that accepts AAC-in-MP4. */
export function canStreamTranscode(): boolean {
  if (!hasWebCodecsAudio() || typeof MediaSource === "undefined") return false;
  try {
    return MediaSource.isTypeSupported(AAC_MIME);
  } catch {
    return false;
  }
}

const configSupportCache = new Map<string, Promise<boolean>>();

function codecConfigsSupported(sampleRate: number, channels: number): Promise<boolean> {
  const key = `${sampleRate}:${channels}`;
  let cached = configSupportCache.get(key);
  if (!cached) {
    cached = (async () => {
      try {
        const [dec, enc] = await Promise.all([
          AudioDecoder.isConfigSupported({ codec: "mp3", sampleRate, numberOfChannels: channels }),
          AudioEncoder.isConfigSupported({
            codec: AAC_CODEC,
            sampleRate,
            numberOfChannels: channels,
            bitrate: AAC_BITRATE
          })
        ]);
        return Boolean(dec.supported && enc.supported);
      } catch {
        return false;
      }
    })();
    configSupportCache.set(key, cached);
  }
  return cached;
}

/* -------------------------------------------------------------------------- */
/* Range fetching + head prefetch                                             */
/* -------------------------------------------------------------------------- */

interface RangeResult {
  bytes: Uint8Array;
  /** Total resource size from Content-Range, when known. */
  total: number | null;
  rangeSupported: boolean;
}

async function fetchRange(
  url: string,
  start: number,
  endInclusive: number,
  signal?: AbortSignal
): Promise<RangeResult> {
  const res = await fetch(url, {
    headers: { Range: `bytes=${start}-${endInclusive}` },
    cache: "no-store",
    signal
  });
  if (res.status === 416) return { bytes: new Uint8Array(0), total: null, rangeSupported: true };
  if (res.status !== 206) {
    // Server ignored Range: don't pull the whole file just to probe it.
    try {
      await res.body?.cancel();
    } catch {}
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { bytes: new Uint8Array(0), total: null, rangeSupported: false };
  }
  const match = res.headers.get("content-range")?.match(/\/(\d+)\s*$/);
  return {
    bytes: new Uint8Array(await res.arrayBuffer()),
    total: match ? Number(match[1]) : null,
    rangeSupported: true
  };
}

const headCache = new Map<string, Promise<RangeResult>>();

/** Warm the first chunk of an upcoming track so it starts instantly. */
export function prefetchStreamHead(url: string): void {
  if (!url || headCache.has(url) || !canStreamTranscode()) return;
  const p = fetchRange(url, 0, FIRST_CHUNK_BYTES - 1);
  p.catch(() => headCache.delete(url));
  headCache.set(url, p);
  while (headCache.size > HEAD_CACHE_LIMIT) {
    const oldest = headCache.keys().next().value;
    if (oldest === undefined) break;
    headCache.delete(oldest);
  }
}

function takeStreamHead(url: string): Promise<RangeResult> {
  const cached = headCache.get(url);
  if (cached) {
    headCache.delete(url);
    return cached;
  }
  return fetchRange(url, 0, FIRST_CHUNK_BYTES - 1);
}

/* -------------------------------------------------------------------------- */
/* MP3 -> AAC transcoder core (shared by streaming + downloads)               */
/* -------------------------------------------------------------------------- */

interface AudioInfo {
  sampleRate: number;
  channels: number;
}

class Mp3ToAacTranscoder {
  private decoder: AudioDecoder;
  private encoder: AudioEncoder;
  private leftover: Uint8Array = new Uint8Array(0);
  private frameIndex = 0;
  private checkedFirstFrame: boolean;
  private failed = false;
  closed = false;

  constructor(
    private info: AudioInfo,
    onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void,
    private onError: (err: unknown) => void,
    /** True at the very start of a file, where a Xing/Info frame may sit. */
    startsAtFileHead: boolean
  ) {
    this.checkedFirstFrame = !startsAtFileHead;
    this.encoder = new AudioEncoder({
      output: (chunk, meta) => {
        if (!this.closed) onChunk(chunk, meta);
      },
      error: (e) => this.fail(e)
    });
    this.encoder.configure({
      codec: AAC_CODEC,
      sampleRate: info.sampleRate,
      numberOfChannels: info.channels,
      bitrate: AAC_BITRATE
    });
    this.decoder = new AudioDecoder({
      output: (data) => {
        try {
          if (!this.closed && this.encoder.state === "configured") this.encoder.encode(data);
        } finally {
          data.close();
        }
      },
      error: (e) => this.fail(e)
    });
    this.decoder.configure({
      codec: "mp3",
      sampleRate: info.sampleRate,
      numberOfChannels: info.channels
    });
  }

  private fail(err: unknown) {
    if (this.failed || this.closed) return;
    this.failed = true;
    this.onError(err);
  }

  /** Feed raw MP3 bytes (any split). Applies codec back-pressure. */
  async feed(bytes: Uint8Array): Promise<void> {
    const buf = concatBytes(this.leftover, bytes);
    let i = 0;
    while (i + 4 <= buf.length && !this.closed) {
      let h = parseMp3FrameHeader(buf, i);
      if (!h) {
        const found = findFrameStart(buf, i + 1);
        if (!found) {
          i = Math.max(i, buf.length - 3);
          break;
        }
        i = found.at;
        if (!found.verified) break; // wait for more bytes to confirm sync
        h = parseMp3FrameHeader(buf, i);
        if (!h) break;
      }
      if (i + h.length > buf.length) break; // incomplete frame
      const frame = buf.subarray(i, i + h.length);
      i += h.length;

      if (!this.checkedFirstFrame) {
        this.checkedFirstFrame = true;
        if (isVbrHeaderFrame(frame)) continue;
      }
      if (h.sampleRate !== this.info.sampleRate) continue; // corrupt / foreign frame

      const timestamp = Math.round((this.frameIndex * h.samples * 1e6) / h.sampleRate);
      this.frameIndex++;
      this.decoder.decode(
        new EncodedAudioChunk({
          type: "key",
          timestamp,
          duration: Math.round((h.samples * 1e6) / h.sampleRate),
          data: frame
        })
      );
      if (
        this.decoder.decodeQueueSize > MAX_CODEC_QUEUE ||
        this.encoder.encodeQueueSize > MAX_CODEC_QUEUE
      ) {
        await this.drain();
      }
    }
    this.leftover = buf.slice(i);
  }

  private drain(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (
          this.closed ||
          (this.decoder.decodeQueueSize <= MAX_CODEC_QUEUE / 2 &&
            this.encoder.encodeQueueSize <= MAX_CODEC_QUEUE / 2)
        ) {
          resolve();
        } else {
          setTimeout(check, 4);
        }
      };
      check();
    });
  }

  /** Flush everything still inside the decoder and encoder. */
  async finish(): Promise<void> {
    if (this.closed) return;
    await this.decoder.flush();
    await this.encoder.flush();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    try {
      if (this.decoder.state !== "closed") this.decoder.close();
    } catch {}
    try {
      if (this.encoder.state !== "closed") this.encoder.close();
    } catch {}
  }
}

/* -------------------------------------------------------------------------- */
/* Streaming session: chunked fetch -> transcode -> fMP4 -> MediaSource       */
/* -------------------------------------------------------------------------- */

/**
 * Re-chunks the muxer's byte stream into whole top-level MP4 boxes and drops
 * the trailing `mfra` index box, which MediaSource does not need.
 */
class Mp4BoxForwarder {
  private pending: Uint8Array = new Uint8Array(0);
  private expectedPos = 0;

  constructor(private emit: (box: Uint8Array<ArrayBuffer>) => void) {}

  /** Returns false if the muxer wrote out of order (should never happen). */
  push(data: Uint8Array, position: number): boolean {
    if (position !== this.expectedPos) return false;
    this.expectedPos = position + data.byteLength;
    let buf = concatBytes(this.pending, data);
    let i = 0;
    const out: Uint8Array[] = [];
    while (i + 8 <= buf.length) {
      const view = new DataView(buf.buffer, buf.byteOffset + i);
      let size = view.getUint32(0);
      if (size === 1) {
        if (i + 16 > buf.length) break;
        size = Number(view.getBigUint64(8));
      }
      if (size < 8) return false;
      if (i + size > buf.length) break;
      const type = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
      if (type !== "mfra") out.push(buf.subarray(i, i + size));
      i += size;
    }
    this.pending = buf.slice(i);
    buf = new Uint8Array(0);
    if (out.length === 1) this.emit(out[0].slice());
    else if (out.length > 1) {
      const total = out.reduce((n, b) => n + b.length, 0);
      const joined = new Uint8Array(total);
      let p = 0;
      for (const b of out) {
        joined.set(b, p);
        p += b.length;
      }
      this.emit(joined);
    }
    return true;
  }
}

interface StreamInfo extends AudioInfo {
  audioStart: number;
  total: number | null;
  duration: number;
}

function bufferedAheadOf(ranges: TimeRanges, t: number): number {
  for (let i = 0; i < ranges.length; i++) {
    if (ranges.start(i) <= t + 0.25 && ranges.end(i) >= t) return ranges.end(i) - t;
  }
  return 0;
}

function waitForIdle(sb: SourceBuffer): Promise<void> {
  if (!sb.updating) return Promise.resolve();
  return new Promise((resolve) =>
    sb.addEventListener("updateend", () => resolve(), { once: true })
  );
}

class AacStreamSession {
  private ms = new MediaSource();
  readonly src = URL.createObjectURL(this.ms);
  private audio: HTMLAudioElement | null = null;
  private sb: SourceBuffer | null = null;
  private queue: Uint8Array<ArrayBuffer>[] = [];
  private generation = 0;
  private restartToken = 0;
  private transcoder: Mp3ToAacTranscoder | null = null;
  private fetchAbort: AbortController | null = null;
  private endPending = false;
  private lastEvictAt = 0;
  private disposed = false;

  constructor(
    private url: string,
    private info: StreamInfo,
    private initial: { offset: number; bytes: Uint8Array },
    private onFatal?: (atTime: number) => void
  ) {}

  attach(audio: HTMLAudioElement) {
    this.audio = audio;
    audio.addEventListener("seeking", this.onSeeking);
    this.ms.addEventListener("sourceopen", this.onSourceOpen, { once: true });
  }

  private onSourceOpen = () => {
    if (this.disposed) return;
    try {
      const sb = this.ms.addSourceBuffer(AAC_MIME);
      sb.addEventListener("updateend", this.pump);
      this.sb = sb;
      if (this.info.duration > 0) this.ms.duration = this.info.duration;
      this.startPipeline(this.info.audioStart, this.initial);
    } catch {
      this.fatal();
    }
  };

  private startPipeline(offset: number, initial?: { offset: number; bytes: Uint8Array }) {
    const gen = ++this.generation;
    this.endPending = false;
    const fetchAbort = new AbortController();
    this.fetchAbort = fetchAbort;

    const forwarder = new Mp4BoxForwarder((box) => {
      if (gen !== this.generation) return;
      this.queue.push(box);
      this.pump();
    });
    const muxer = new Muxer({
      target: new StreamTarget({
        onData: (data, position) => {
          if (gen !== this.generation) return;
          if (!forwarder.push(data, position)) this.fatal();
        }
      }),
      audio: { codec: "aac", numberOfChannels: this.info.channels, sampleRate: this.info.sampleRate },
      fastStart: "fragmented",
      minFragmentDuration: 1,
      firstTimestampBehavior: "offset"
    });

    const transcoder = new Mp3ToAacTranscoder(
      this.info,
      (chunk, meta) => {
        if (gen === this.generation) muxer.addAudioChunk(chunk, meta);
      },
      () => {
        if (gen === this.generation) this.fatal();
      },
      offset === this.info.audioStart
    );
    this.transcoder = transcoder;

    const alive = () => gen === this.generation && !this.disposed;

    void (async () => {
      try {
        let next = offset;
        let firstRequest = true;
        if (initial) {
          await transcoder.feed(initial.bytes);
          next = initial.offset + initial.bytes.length;
          firstRequest = false;
        }
        while (alive()) {
          const total = this.info.total;
          if (total !== null && next >= total) break;
          await this.waitForRoom(alive);
          if (!alive()) return;
          const size = firstRequest ? FIRST_CHUNK_BYTES : CHUNK_BYTES;
          firstRequest = false;
          const end = (total !== null ? Math.min(total, next + size) : next + size) - 1;
          const r = await fetchRange(this.url, next, end, fetchAbort.signal);
          if (!alive()) return;
          if (!r.rangeSupported) throw new Error("range_unsupported");
          if (r.total !== null) this.info.total = r.total;
          if (r.bytes.length === 0) break;
          await transcoder.feed(r.bytes);
          next += r.bytes.length;
        }
        if (!alive()) return;
        await transcoder.finish();
        if (!alive()) return;
        muxer.finalize();
        this.endPending = true;
        this.pump();
      } catch {
        if (alive()) this.fatal();
      }
    })();
  }

  /** Data-saving throttle: wait while enough audio is already buffered. */
  private waitForRoom(alive: () => boolean): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        const a = this.audio;
        const ahead = a ? bufferedAheadOf(a.buffered, a.currentTime) : 0;
        if (!alive() || (ahead < BUFFER_AHEAD_SECONDS && this.queue.length < 8)) resolve();
        else setTimeout(check, 300);
      };
      check();
    });
  }

  private pump = () => {
    const sb = this.sb;
    if (!sb || this.disposed || sb.updating) return;

    // Release audio far behind the playhead to keep memory flat.
    const a = this.audio;
    const now = Date.now();
    if (a && now - this.lastEvictAt > 10_000 && sb.buffered.length > 0) {
      const cutoff = a.currentTime - KEEP_BEHIND_SECONDS;
      if (cutoff > 1 && sb.buffered.start(0) < cutoff - 5) {
        this.lastEvictAt = now;
        try {
          sb.remove(0, cutoff);
          return; // updateend re-enters pump
        } catch {}
      }
    }

    const data = this.queue.shift();
    if (data) {
      try {
        sb.appendBuffer(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "QuotaExceededError" && a) {
          this.queue.unshift(data);
          try {
            sb.remove(0, Math.max(0.1, a.currentTime - 5));
          } catch {
            this.fatal();
          }
        } else {
          this.fatal();
        }
      }
      return;
    }

    if (this.endPending && this.ms.readyState === "open") {
      this.endPending = false;
      try {
        this.ms.endOfStream();
      } catch {}
    }
  };

  private onSeeking = () => {
    const a = this.audio;
    if (!a || !this.sb || this.disposed) return;
    const t = a.currentTime;
    if (bufferedAheadOf(a.buffered, t) > 0) return;
    // Just past the buffered edge while the pipeline is still producing: let it catch up.
    const ranges = a.buffered;
    if (ranges.length > 0) {
      const lastEnd = ranges.end(ranges.length - 1);
      if (t >= lastEnd && t - lastEnd < 3 && !this.endPending) return;
    }
    void this.restartAt(t);
  };

  private async restartAt(t: number) {
    const sb = this.sb;
    const total = this.info.total;
    if (!sb || this.disposed) return;
    if (total === null || this.info.duration <= 0) return; // can't map time -> bytes

    // Invalidate the running pipeline immediately so it stops appending.
    this.generation++;
    this.fetchAbort?.abort();
    this.transcoder?.close();
    this.queue = [];
    this.endPending = false;
    const token = ++this.restartToken;
    const stale = () => token !== this.restartToken || this.disposed;

    try {
      await waitForIdle(sb);
      if (stale()) return;
      sb.remove(0, Infinity);
      await waitForIdle(sb);
      if (stale()) return;
      if (this.ms.readyState === "open") sb.abort();
      sb.timestampOffset = t;
    } catch {
      this.fatal();
      return;
    }

    const frac = Math.min(Math.max(t / this.info.duration, 0), 0.999);
    const span = total - this.info.audioStart;
    const offset = this.info.audioStart + Math.floor(frac * span);
    this.startPipeline(offset);
  }

  private fatal() {
    if (this.disposed) return;
    const t = this.audio?.currentTime ?? 0;
    this.dispose();
    this.onFatal?.(t);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.fetchAbort?.abort();
    this.transcoder?.close();
    this.queue = [];
    this.audio?.removeEventListener("seeking", this.onSeeking);
    this.ms.removeEventListener("sourceopen", this.onSourceOpen);
    this.sb?.removeEventListener("updateend", this.pump);
    try {
      if (this.ms.readyState === "open") this.ms.endOfStream();
    } catch {}
    URL.revokeObjectURL(this.src);
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

function originalSource(
  url: string,
  kind: PreparedKind,
  reason?: PreparedAudioSource["reason"]
): PreparedAudioSource {
  return { src: url, kind, reason, attach: () => {}, dispose: () => {} };
}

/**
 * Resolves how to play `url` in AAC mode. Native AAC sources are returned
 * as-is; MP3 sources get a streaming transcode session; anything else (or an
 * unsupported device) returns the original URL.
 */
export async function prepareAacSource(
  url: string,
  opts: { durationHint?: number; onFatal?: (atTime: number) => void } = {}
): Promise<PreparedAudioSource> {
  if (!canStreamTranscode()) return originalSource(url, "original", "unsupported");

  let head: RangeResult;
  try {
    head = await takeStreamHead(url);
  } catch {
    return originalSource(url, "original", "probe-failed");
  }
  if (!head.rangeSupported || head.bytes.length < 16) {
    return originalSource(url, "original", "probe-failed");
  }

  if (sniffContainer(head.bytes) === "mp4") return originalSource(url, "native-aac");

  const audioStart = id3TagLength(head.bytes);
  let probe = head.bytes.subarray(Math.min(audioStart, head.bytes.length));
  if (probe.length < 4096) {
    // Large ID3 tag (embedded artwork): fetch the bytes right after it.
    try {
      const more = await fetchRange(url, audioStart, audioStart + FIRST_CHUNK_BYTES - 1);
      if (!more.rangeSupported) return originalSource(url, "original", "probe-failed");
      probe = more.bytes;
      if (more.total !== null) head.total = more.total;
    } catch {
      return originalSource(url, "original", "probe-failed");
    }
  }

  const container = sniffContainer(probe);
  if (container === "mp4" || container === "adts") return originalSource(url, "native-aac");
  if (container !== "mp3") return originalSource(url, "original", "not-mp3");

  const firstAt = findFrameStart(probe, 0);
  const first = firstAt ? parseMp3FrameHeader(probe, firstAt.at) : null;
  if (!first) return originalSource(url, "original", "not-mp3");
  if (!(await codecConfigsSupported(first.sampleRate, first.channels))) {
    return originalSource(url, "original", "unsupported");
  }

  const total = head.total;
  const estimatedDuration =
    total !== null && first.bitrate > 0 ? ((total - audioStart) * 8) / first.bitrate : 0;
  const duration =
    opts.durationHint && opts.durationHint > 0 ? opts.durationHint : estimatedDuration;

  const session = new AacStreamSession(
    url,
    {
      sampleRate: first.sampleRate,
      channels: first.channels,
      audioStart,
      total,
      duration
    },
    { offset: audioStart, bytes: probe },
    opts.onFatal
  );

  return {
    src: session.src,
    kind: "transcoded-aac",
    attach: (audio) => session.attach(audio),
    dispose: () => session.dispose()
  };
}

export interface AacFileResult {
  blob: Blob;
  mimeType: string;
  extension: "m4a" | "aac" | "mp3";
  /** True when the audio was re-encoded; false when the source was already AAC or conversion was unavailable. */
  converted: boolean;
}

/**
 * Converts a complete downloaded file to AAC (.m4a) for offline storage.
 * Already-AAC files are returned untouched; unsupported devices keep the MP3.
 */
export async function convertBlobToAac(
  blob: Blob,
  onProgress?: (fraction: number) => void
): Promise<AacFileResult> {
  const all = new Uint8Array(await blob.arrayBuffer());
  if (sniffContainer(all) === "mp4") {
    return { blob, mimeType: "audio/mp4", extension: "m4a", converted: false };
  }
  const audioStart = id3TagLength(all);
  const body = all.subarray(Math.min(audioStart, all.length));
  const container = sniffContainer(body);
  if (container === "mp4") return { blob, mimeType: "audio/mp4", extension: "m4a", converted: false };
  if (container === "adts") return { blob, mimeType: "audio/aac", extension: "aac", converted: false };

  const keepOriginal: AacFileResult = {
    blob,
    mimeType: blob.type || "audio/mpeg",
    extension: "mp3",
    converted: false
  };
  if (container !== "mp3" || !hasWebCodecsAudio()) return keepOriginal;

  const firstAt = findFrameStart(body, 0);
  const first = firstAt ? parseMp3FrameHeader(body, firstAt.at) : null;
  if (!first || !(await codecConfigsSupported(first.sampleRate, first.channels))) {
    return keepOriginal;
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    audio: { codec: "aac", numberOfChannels: first.channels, sampleRate: first.sampleRate },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset"
  });

  let failure: unknown = null;
  const transcoder = new Mp3ToAacTranscoder(
    { sampleRate: first.sampleRate, channels: first.channels },
    (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    (err) => {
      failure = err ?? new Error("AAC conversion failed");
    },
    true
  );

  try {
    for (let pos = 0; pos < body.length; pos += CHUNK_BYTES) {
      if (failure) break;
      await transcoder.feed(body.subarray(pos, Math.min(body.length, pos + CHUNK_BYTES)));
      onProgress?.(Math.min(1, (pos + CHUNK_BYTES) / body.length));
    }
    if (!failure) await transcoder.finish();
  } catch (err) {
    failure = err;
  } finally {
    transcoder.close();
  }
  if (failure) return keepOriginal;

  muxer.finalize();
  return {
    blob: new Blob([target.buffer], { type: "audio/mp4" }),
    mimeType: "audio/mp4",
    extension: "m4a",
    converted: true
  };
}
