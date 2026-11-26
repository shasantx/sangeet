/**
 * On-device mood / time-of-day recommendation engine.
 *
 * Pure functions only (no imports, no storage, no network) so it can be unit
 * tested directly and reused by the Home shelf and the autoplay radio.
 *
 * Model:
 *  - Every play becomes a ListenEvent (when, how long, completed or skipped,
 *    and mood/genre tags inferred from the title, artist and where it was
 *    played from).
 *  - Events are weighted by recency (21-day half-life) and by how close their
 *    time-of-day slot is to "now" (same slot 1.0, neighbouring slot 0.35).
 *  - Completed plays push a tag/artist up, skips push it down.
 *  - New listeners start from sensible per-slot priors; as events accumulate
 *    the learned taste takes over (prior weight = K / (K + n)).
 */

export type TimeSlot = "morning" | "afternoon" | "evening" | "night" | "lateNight";
export type ListenOutcome = "complete" | "partial" | "skip";

export interface ListenTrackSnapshot {
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  thumbnail: string;
  duration: number;
  source?: string;
}

export interface ListenEvent {
  track: ListenTrackSnapshot;
  /** epoch ms when playback of this track started */
  ts: number;
  /** seconds actually listened (seeks excluded) */
  listened: number;
  outcome: ListenOutcome;
  tags: string[];
}

export interface MoodProfile {
  slot: TimeSlot;
  /** effective number of events that informed this slot (after decay) */
  evidence: number;
  /** tag -> score in [-1, 1] (priors blended with learned taste) */
  tags: Record<string, number>;
  /** normalised artist key -> score in [-1, 1] */
  artists: Record<string, number>;
  /** track id -> score in [-1, 1] */
  tracks: Record<string, number>;
  /** track ids skipped at least twice in the last 14 days */
  avoid: Set<string>;
}

interface RankableTrack {
  id: string;
  title: string;
  artist: string;
}

export const SLOT_ORDER: TimeSlot[] = ["morning", "afternoon", "evening", "night", "lateNight"];

export const SLOT_LABEL: Record<TimeSlot, string> = {
  morning: "this morning",
  afternoon: "this afternoon",
  evening: "this evening",
  night: "tonight",
  lateNight: "late night"
};

export const TAG_LABEL: Record<string, string> = {
  lofi: "Lo-fi",
  chill: "Chill",
  romantic: "Romantic",
  sad: "Sad",
  party: "Party",
  workout: "Workout",
  devotional: "Devotional",
  hiphop: "Hip-hop",
  rock: "Rock",
  pop: "Pop",
  hindi: "Hindi",
  nepali: "Nepali",
  punjabi: "Punjabi",
  electronic: "Electronic",
  indie: "Indie",
  rnb: "R&B"
};

const LANGUAGE_TAGS = new Set(["hindi", "nepali", "punjabi"]);

const TAG_PATTERNS: Array<[string, RegExp]> = [
  ["lofi", /\blo-?\s?fi\b|study beats|slowed|reverb/i],
  ["chill", /\bchill|relax|calm|acoustic|unplugged|\bsoft\b|sleep|ambient/i],
  ["romantic", /\blove\b|romantic|\bishq|pyaar|pyar\b|\bprem\b|\bmaya\b|\bdil\b|valentine/i],
  ["sad", /\bsad\b|broken|heartbreak|\bdard\b|alone|lonely|tears/i],
  ["party", /party|\bdance\b|remix|\bclub\b|\bdj\b|bhangra/i],
  ["workout", /workout|\bgym\b|energy|pump|motivation|running/i],
  ["devotional", /bhajan|aarti|mantra|devotional|worship|krishna|shiva|ganesh|buddha|hanuman/i],
  ["hiphop", /\brap\b|hip[\s-]?hop|\bdrill\b|\btrap\b/i],
  ["rock", /\brock\b|metal|\bband\b|guitar anthem/i],
  ["pop", /\bpop\b|top hits|chart/i],
  ["hindi", /hindi|bollywood|arijit|shreya ghoshal|atif aslam|jubin/i],
  ["nepali", /nepali|nepal|lok ?geet|sajjan raj|bipul chettri|sushant kc|narayan gopal|1974 ad|albatross/i],
  ["punjabi", /punjabi|diljit|aujla|sidhu|ap dhillon|shubh\b/i],
  ["electronic", /\bedm\b|electronic|\bhouse\b|techno|trance|dubstep/i],
  ["indie", /\bindie|alternative/i],
  ["rnb", /r&b|\brnb\b|\bsoul\b|the weeknd|\bsza\b/i]
];

/** Per-slot starter taste for brand-new listeners (0..1). */
export const SLOT_PRIORS: Record<TimeSlot, Record<string, number>> = {
  morning: { chill: 0.7, pop: 0.6, devotional: 0.5, indie: 0.5, romantic: 0.3 },
  afternoon: { pop: 0.8, hiphop: 0.6, punjabi: 0.5, hindi: 0.5, electronic: 0.4, workout: 0.4 },
  evening: { pop: 0.6, romantic: 0.6, hindi: 0.6, party: 0.6, punjabi: 0.5, rnb: 0.5 },
  night: { romantic: 0.7, chill: 0.7, rnb: 0.6, lofi: 0.6, sad: 0.5, indie: 0.5 },
  lateNight: { lofi: 0.9, chill: 0.8, sad: 0.6, rnb: 0.5, romantic: 0.4 }
};

/** Search phrases used to discover new songs for a tag. */
const TAG_QUERY: Record<string, string> = {
  lofi: "lofi chill beats",
  chill: "chill acoustic songs",
  romantic: "romantic songs",
  sad: "sad songs",
  party: "party dance hits",
  workout: "workout energy songs",
  devotional: "morning bhajan",
  hiphop: "hip hop hits",
  rock: "rock anthems",
  pop: "top pop hits",
  hindi: "hindi hits",
  nepali: "nepali songs",
  punjabi: "punjabi hits",
  electronic: "edm hits",
  indie: "indie songs",
  rnb: "r&b songs"
};

const HALF_LIFE_DAYS = 21;
const PRIOR_STRENGTH = 8;
const DAY_MS = 86_400_000;

export function slotForDate(date: Date): TimeSlot {
  const h = date.getHours();
  if (h >= 5 && h < 11) return "morning";
  if (h >= 11 && h < 16) return "afternoon";
  if (h >= 16 && h < 20) return "evening";
  if (h >= 20) return "night";
  return "lateNight";
}

function slotDistanceWeight(a: TimeSlot, b: TimeSlot): number {
  const i = SLOT_ORDER.indexOf(a);
  const j = SLOT_ORDER.indexOf(b);
  const d = Math.min(Math.abs(i - j), SLOT_ORDER.length - Math.abs(i - j));
  return d === 0 ? 1 : d === 1 ? 0.35 : 0;
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function artistKey(artist: string): string {
  return (artist || "")
    .split(/,|&| feat\.? | ft\.? | x /i)[0]
    .trim()
    .toLowerCase();
}

/** Infer mood/genre tags from free text (title, artist, search query...). */
export function inferTags(...texts: Array<string | undefined | null>): string[] {
  const text = texts.filter(Boolean).join(" ");
  if (!text) return [];
  const out: string[] = [];
  for (const [tag, re] of TAG_PATTERNS) {
    if (re.test(text)) out.push(tag);
  }
  return out;
}

/**
 * Classify a finished play. Returns null when the play carries no signal
 * (e.g. under 1.5 s, which is almost always a mis-tap or a failed load).
 */
export function classifyListen(listened: number, duration: number): ListenOutcome | null {
  if (!Number.isFinite(listened) || listened < 1.5) return null;
  const dur = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (dur > 0 && listened >= dur * 0.8) return "complete";
  if (dur === 0 && listened >= 120) return "complete";
  const skipLimit = dur > 0 ? Math.min(30, dur * 0.3) : 30;
  if (listened < skipLimit) return "skip";
  return "partial";
}

const OUTCOME_SIGNAL: Record<ListenOutcome, number> = {
  complete: 1,
  partial: 0.4,
  skip: -0.7
};

function normalise(map: Map<string, number>): Record<string, number> {
  let max = 0;
  for (const v of map.values()) max = Math.max(max, Math.abs(v));
  const out: Record<string, number> = {};
  if (max === 0) return out;
  for (const [k, v] of map) out[k] = v / max;
  return out;
}

export function buildMoodProfile(events: ListenEvent[], now: Date = new Date()): MoodProfile {
  const slot = slotForDate(now);
  const weekendNow = isWeekend(now);
  const nowMs = now.getTime();

  const tagAcc = new Map<string, number>();
  const artistAcc = new Map<string, number>();
  const trackAcc = new Map<string, number>();
  const skipCount = new Map<string, number>();
  let evidence = 0;

  for (const ev of events) {
    const at = new Date(ev.ts);
    const ageDays = Math.max(0, (nowMs - ev.ts) / DAY_MS);

    if (ev.outcome === "skip" && ageDays <= 14) {
      skipCount.set(ev.track.id, (skipCount.get(ev.track.id) ?? 0) + 1);
    }

    const slotW = slotDistanceWeight(slot, slotForDate(at));
    if (slotW === 0) continue;
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const dayW = isWeekend(at) === weekendNow ? 1.15 : 1;
    const w = slotW * decay * dayW;
    const signal = OUTCOME_SIGNAL[ev.outcome] * w;
    evidence += w;

    for (const tag of ev.tags) tagAcc.set(tag, (tagAcc.get(tag) ?? 0) + signal);
    const ak = artistKey(ev.track.artist);
    if (ak) artistAcc.set(ak, (artistAcc.get(ak) ?? 0) + signal);
    trackAcc.set(ev.track.id, (trackAcc.get(ev.track.id) ?? 0) + signal);
  }

  const learned = normalise(tagAcc);
  const priorWeight = PRIOR_STRENGTH / (PRIOR_STRENGTH + evidence);
  const tags: Record<string, number> = {};
  const allTags = new Set([...Object.keys(learned), ...Object.keys(SLOT_PRIORS[slot])]);
  for (const t of allTags) {
    const p = SLOT_PRIORS[slot][t] ?? 0;
    const l = learned[t] ?? 0;
    tags[t] = p * priorWeight + l * (1 - priorWeight);
  }

  const avoid = new Set<string>();
  for (const [id, n] of skipCount) if (n >= 2) avoid.add(id);

  return {
    slot,
    evidence,
    tags,
    artists: normalise(artistAcc),
    tracks: normalise(trackAcc),
    avoid
  };
}

export function topTags(profile: MoodProfile, limit = 3): string[] {
  return Object.entries(profile.tags)
    .filter(([, v]) => v > 0.05)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([t]) => t);
}

export function topArtists(profile: MoodProfile, limit = 2): string[] {
  return Object.entries(profile.artists)
    .filter(([, v]) => v > 0.25)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([a]) => a);
}

/** Score one track for "right now". Higher is better; very negative = avoid. */
export function scoreTrack(track: RankableTrack, profile: MoodProfile): number {
  if (profile.avoid.has(track.id)) return -10;
  const tags = inferTags(track.title, track.artist);
  let tagScore = 0;
  for (const t of tags) tagScore += profile.tags[t] ?? 0;
  if (tags.length > 1) tagScore /= Math.sqrt(tags.length);
  const artist = profile.artists[artistKey(track.artist)] ?? 0;
  const own = profile.tracks[track.id] ?? 0;
  return artist * 1.0 + tagScore * 0.8 + own * 0.6;
}

/**
 * Re-rank candidates (e.g. a radio list) for the current mood. Keeps the
 * source order as a gentle tie-breaker and drops tracks the user keeps skipping.
 */
export function rankTracks<T extends RankableTrack>(tracks: T[], profile: MoodProfile): T[] {
  return tracks
    .map((t, i) => ({ t, s: scoreTrack(t, profile) - i * 0.02 }))
    .filter((x) => x.s > -5)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

/** Up to 3 search phrases that should surface new songs for this mood. */
export function discoveryQueries(profile: MoodProfile): string[] {
  const ranked = topTags(profile, 6);
  const language = ranked.find((t) => LANGUAGE_TAGS.has(t));
  const moods = ranked.filter((t) => !LANGUAGE_TAGS.has(t)).slice(0, 2);
  const queries: string[] = [];
  for (const m of moods) {
    const base = TAG_QUERY[m] ?? `${m} songs`;
    queries.push(language ? `${language} ${base}` : base);
  }
  const artist = topArtists(profile, 1)[0];
  if (artist) queries.push(`${artist} songs`);
  if (queries.length === 0 && language) queries.push(TAG_QUERY[language]);
  return Array.from(new Set(queries)).slice(0, 3);
}

/** Tracks the user fully played in this slot recently (most loved first). */
export function familiarForSlot(events: ListenEvent[], profile: MoodProfile, limit = 4): ListenTrackSnapshot[] {
  const seen = new Set<string>();
  const out: ListenTrackSnapshot[] = [];
  const candidates = events
    .filter((e) => e.outcome === "complete" && slotForDate(new Date(e.ts)) === profile.slot)
    .sort((a, b) => (profile.tracks[b.track.id] ?? 0) - (profile.tracks[a.track.id] ?? 0));
  for (const e of candidates) {
    if (seen.has(e.track.id) || profile.avoid.has(e.track.id)) continue;
    seen.add(e.track.id);
    out.push(e.track);
    if (out.length >= limit) break;
  }
  return out;
}

/** Short human explanation, e.g. "Romantic · Hindi · Arijit Singh". */
export function describeProfile(profile: MoodProfile): string {
  const parts = topTags(profile, 2).map((t) => TAG_LABEL[t] ?? t);
  const artist = topArtists(profile, 1)[0];
  if (artist) parts.push(artist.replace(/\b\w/g, (c) => c.toUpperCase()));
  return parts.join(" · ");
}
