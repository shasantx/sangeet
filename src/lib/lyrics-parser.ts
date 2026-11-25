import type { LyricLine } from "@/types/music";

/**
 * Parse LRC formatted timestamps (supports multiple timestamps per line, e.g. [00:12.34][01:02.00] Chorus).
 */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const tagRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  for (const raw of lrc.split(/\r?\n/)) {
    const matches = Array.from(raw.matchAll(tagRegex));
    if (matches.length === 0) continue;
    const text = raw.replace(tagRegex, "").trim();
    if (!text) continue;

    for (const match of matches) {
      const mins = Number.parseInt(match[1], 10);
      const secs = Number.parseInt(match[2], 10);
      const msStr = match[3] ?? "0";
      const ms =
        msStr.length === 1
          ? Number.parseInt(msStr, 10) * 100
          : msStr.length === 2
            ? Number.parseInt(msStr, 10) * 10
            : Number.parseInt(msStr, 10);
      const time = mins * 60 + secs + ms / 1000;
      if (Number.isFinite(time) && time >= 0) {
        lines.push({ time, text });
      }
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

/**
 * Binary-search active lyric index for a given playback time (with small 0.15s lookahead for human feel).
 */
export function getActiveLyricIndex(
  lines: LyricLine[],
  currentTime: number,
  leadSeconds = 0.15
): number {
  if (!lines.length || !Number.isFinite(currentTime)) return -1;
  const target = currentTime + leadSeconds;
  if (target < lines[0].time) return -1;

  let lo = 0;
  let hi = lines.length - 1;
  let best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (lines[mid].time <= target) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
