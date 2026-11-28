"use client";

/**
 * Jam: listen together in real time.
 *
 * Transport: Supabase Realtime "broadcast" + "presence" on a channel named
 * after a 6-character code. No database tables, nothing stored server-side.
 *
 * Model (host-authoritative, like Spotify Jam):
 *  - The host's player is the source of truth. The host broadcasts `state`
 *    (track, queue, playing, position) on every change plus a heartbeat.
 *  - Guests apply host *changes*: a new track, play/pause flips, queue
 *    updates, and drift > 2 s while playing.
 *  - Guests' own actions are detected on their local player and forwarded to
 *    the host as `request`s. Adding songs is always allowed; play/pause/skip/
 *    seek only when the host enables "guests can control".
 */

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { Track } from "@/types/music";
import { usePlayerStore } from "@/store/player-store";

export type JamRole = "host" | "guest";

export interface JamMember {
  id: string;
  name: string;
  role: JamRole;
}

export interface JamStateMessage {
  seq: number;
  track: Track | null;
  trackShareable: boolean;
  queue: Track[];
  isPlaying: boolean;
  position: number;
  allowGuestControl: boolean;
  hostName: string;
}

type RequestAction = "add" | "playNext" | "play" | "pause" | "next" | "prev" | "seek" | "playTrack";

interface JamRequest {
  from: string;
  name: string;
  action: RequestAction;
  track?: Track;
  position?: number;
}

export interface JamCallbacks {
  onMembers: (members: JamMember[]) => void;
  onHostState: (state: JamStateMessage) => void;
  onEnded: (reason: string) => void;
  onNotice: (message: string) => void;
  onStatus: (status: "connecting" | "live" | "error", error?: string) => void;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const HEARTBEAT_MS = 4000;
const DRIFT_SECONDS = 2;
const LATENCY_SECONDS = 0.15;
const QUEUE_LIMIT = 25;
const HOST_WAIT_MS = 6000;

/**
 * Automated tests can inject a stand-in realtime client (same channel API) on
 * window before the app loads; real users never have this set.
 */
interface TestHookWindow {
  __DHUN_JAM_TEST_CLIENT__?: SupabaseClient;
  __dhunPlayer?: typeof usePlayerStore;
}
function testClient(): SupabaseClient | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as TestHookWindow;
  if (w.__DHUN_JAM_TEST_CLIENT__) w.__dhunPlayer = usePlayerStore;
  return w.__DHUN_JAM_TEST_CLIENT__;
}

export function isJamConfigured(): boolean {
  return (
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    Boolean(testClient())
  );
}

export function normaliseJamCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function makeJamCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

let clientPromise: Promise<SupabaseClient> | null = null;
function getClient(): Promise<SupabaseClient> {
  const injected = testClient();
  if (injected) return Promise.resolve(injected);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 10 } }
      })
    );
  }
  return clientPromise;
}

/** Strip device-only fields; local files can't be streamed by other people. */
function shareTrack(t: Track): Track | null {
  const remote = Boolean(t.streamUrl && !t.streamUrl.startsWith("blob:"));
  if ((t.localUrl || t.offlineId || t.source === "local") && !remote) return null;
  const copy: Track = { ...t };
  delete copy.localUrl;
  delete copy.offlineId;
  return copy;
}

function ids(list: Track[]): string {
  return list.map((t) => t.id).join(",");
}

export class JamSession {
  readonly code: string;
  readonly role: JamRole;
  readonly memberId: string;
  private name: string;
  private cb: JamCallbacks;
  private channel: RealtimeChannel | null = null;
  private client: SupabaseClient | null = null;
  private unsubPlayer: (() => void) | null = null;
  private heartbeat: number | null = null;
  private hostWait: number | null = null;
  private broadcastTimer: number | null = null;
  private closed = false;

  // host
  private seq = 0;
  allowGuestControl = false;

  // guest
  private applying = 0;
  private lastHost: JamStateMessage | null = null;
  private savedAutoplay: boolean | null = null;
  private sawHost = false;
  private lastGestureAt = 0;
  private onGesture = () => {
    this.lastGestureAt = Date.now();
  };

  constructor(code: string, role: JamRole, name: string, cb: JamCallbacks) {
    this.code = code;
    this.role = role;
    this.name = name;
    this.cb = cb;
    this.memberId = crypto.randomUUID();
  }

  async connect(): Promise<void> {
    this.cb.onStatus("connecting");
    try {
      this.client = await getClient();
    } catch {
      this.cb.onStatus("error", "Couldn't load the Jam connection.");
      return;
    }
    if (this.closed) return;

    const channel = this.client.channel(`dhun-jam-${this.code}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: this.memberId } }
    });
    this.channel = channel;

    channel.on("presence", { event: "sync" }, () => this.handlePresence());
    channel.on("broadcast", { event: "state" }, ({ payload }) => this.handleState(payload as JamStateMessage));
    channel.on("broadcast", { event: "request" }, ({ payload }) => this.handleRequest(payload as JamRequest));
    channel.on("broadcast", { event: "hello" }, () => this.role === "host" && this.broadcastState());
    channel.on("broadcast", { event: "end" }, () => this.role === "guest" && this.end("The host ended the Jam."));

    channel.subscribe(async (status) => {
      if (this.closed) return;
      if (status === "SUBSCRIBED") {
        await channel.track({ name: this.name, role: this.role });
        this.cb.onStatus("live");
        if (this.role === "host") this.startHost();
        else this.startGuest();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        this.cb.onStatus("error", "Lost connection to the Jam. Check your internet and try again.");
      }
    });
  }

  setAllowGuestControl(allow: boolean) {
    this.allowGuestControl = allow;
    this.broadcastState();
  }

  /** Leave (guest) or end for everyone (host). */
  async leave(): Promise<void> {
    if (this.closed) return;
    if (this.role === "host") await this.send("end", {});
    this.teardown();
  }

  // ---------------------------------------------------------------- shared

  private send(event: string, payload: object) {
    return this.channel?.send({ type: "broadcast", event, payload }).catch(() => {});
  }

  private handlePresence() {
    if (!this.channel) return;
    const state = this.channel.presenceState<{ name: string; role: JamRole }>();
    const members: JamMember[] = [];
    for (const [id, metas] of Object.entries(state)) {
      const meta = metas[0];
      if (meta) members.push({ id, name: meta.name, role: meta.role });
    }
    members.sort((a, b) => (a.role === "host" ? -1 : b.role === "host" ? 1 : a.name.localeCompare(b.name)));
    this.cb.onMembers(members);

    if (this.role === "guest") {
      const hostHere = members.some((m) => m.role === "host");
      if (hostHere) this.sawHost = true;
      else if (this.sawHost) this.end("The host left, so the Jam ended.");
    }
  }

  private teardown() {
    this.closed = true;
    this.unsubPlayer?.();
    this.unsubPlayer = null;
    window.removeEventListener("pointerdown", this.onGesture, true);
    window.removeEventListener("keydown", this.onGesture, true);
    if (this.heartbeat) window.clearInterval(this.heartbeat);
    if (this.hostWait) window.clearTimeout(this.hostWait);
    if (this.broadcastTimer) window.clearTimeout(this.broadcastTimer);
    if (this.savedAutoplay !== null) {
      usePlayerStore.getState().setAutoplayRadio(this.savedAutoplay);
      this.savedAutoplay = null;
    }
    const ch = this.channel;
    this.channel = null;
    if (ch && this.client) void this.client.removeChannel(ch);
  }

  private end(reason: string) {
    if (this.closed) return;
    this.teardown();
    this.cb.onEnded(reason);
  }

  // ------------------------------------------------------------------ host

  private startHost() {
    this.broadcastState();
    this.heartbeat = window.setInterval(() => this.broadcastState(), HEARTBEAT_MS);
    this.unsubPlayer = usePlayerStore.subscribe((s, p) => {
      if (
        s.currentTrack?.id !== p.currentTrack?.id ||
        s.trackLoadNonce !== p.trackLoadNonce ||
        s.isPlaying !== p.isPlaying ||
        s.seekNonce !== p.seekNonce ||
        s.queue !== p.queue
      ) {
        this.scheduleBroadcast();
      }
    });
  }

  private scheduleBroadcast() {
    if (this.broadcastTimer) window.clearTimeout(this.broadcastTimer);
    this.broadcastTimer = window.setTimeout(() => this.broadcastState(), 150);
  }

  private broadcastState() {
    if (this.role !== "host" || this.closed) return;
    const s = usePlayerStore.getState();
    const shared = s.currentTrack ? shareTrack(s.currentTrack) : null;
    const msg: JamStateMessage = {
      seq: ++this.seq,
      track: shared,
      trackShareable: !s.currentTrack || Boolean(shared),
      queue: s.queue
        .map(shareTrack)
        .filter((t): t is Track => t !== null)
        .slice(0, QUEUE_LIMIT),
      isPlaying: s.isPlaying,
      position: s.currentTime,
      allowGuestControl: this.allowGuestControl,
      hostName: this.name
    };
    void this.send("state", msg);
  }

  private handleRequest(req: JamRequest) {
    if (this.role !== "host" || !req?.action) return;
    const player = usePlayerStore.getState();
    const who = req.name || "A guest";
    if ((req.action === "add" || req.action === "playNext") && req.track) {
      const track = shareTrack(req.track);
      if (!track) return;
      if (req.action === "playNext") player.playNext(track);
      else player.addToQueue(track);
      this.cb.onNotice(`${who} added “${track.title}”`);
      return;
    }
    if (!this.allowGuestControl) return;
    switch (req.action) {
      case "play":
        player.setIsPlaying(true);
        break;
      case "pause":
        player.setIsPlaying(false);
        break;
      case "next":
        void player.nextTrack();
        break;
      case "prev":
        player.prevTrack();
        break;
      case "seek":
        if (typeof req.position === "number") player.requestSeek(req.position);
        break;
      case "playTrack":
        if (req.track) {
          const t = shareTrack(req.track);
          if (t) player.playTrack(t);
        }
        break;
    }
  }

  // ----------------------------------------------------------------- guest

  private startGuest() {
    const player = usePlayerStore.getState();
    // The host decides what plays next; local radio would fight the host's queue.
    this.savedAutoplay = player.autoplayRadio;
    player.setAutoplayRadio(false);
    void this.send("hello", { from: this.memberId });
    this.hostWait = window.setTimeout(() => {
      if (!this.sawHost && !this.lastHost) this.end("No Jam found with that code.");
    }, HOST_WAIT_MS);
    this.unsubPlayer = usePlayerStore.subscribe((s, p) => this.onGuestLocalChange(s, p));
    window.addEventListener("pointerdown", this.onGesture, true);
    window.addEventListener("keydown", this.onGesture, true);
  }

  /**
   * Store subscribers run synchronously inside set(), so a synchronous flag is
   * enough to tell "the host changed this" apart from "the guest did".
   * Later async player changes (buffering, autoplay blocks) are filtered by the
   * user-gesture check in onGuestLocalChange instead.
   */
  private withApplying(fn: () => void) {
    this.applying++;
    try {
      fn();
    } finally {
      this.applying--;
    }
  }

  private handleState(msg: JamStateMessage) {
    if (this.role !== "guest" || !msg) return;
    const prev = this.lastHost;
    if (prev && msg.seq <= prev.seq && msg.hostName === prev.hostName) return;
    this.lastHost = msg;
    this.sawHost = true;
    this.cb.onHostState(msg);

    const player = usePlayerStore.getState();
    this.withApplying(() => {
      if (!msg.track) {
        if (!msg.trackShareable && (!prev || prev.trackShareable)) {
          this.cb.onNotice("The host is playing a song from their device that can't be shared.");
        }
        if (player.isPlaying) player.setIsPlaying(false);
        return;
      }

      if (player.currentTrack?.id !== msg.track.id) {
        player.playTrack(msg.track, [msg.track, ...msg.queue]);
        if (msg.position > 1) player.requestSeek(msg.position + LATENCY_SECONDS);
        if (!msg.isPlaying) usePlayerStore.getState().setIsPlaying(false);
        return;
      }

      if (ids(player.queue) !== ids(msg.queue)) {
        usePlayerStore.setState({ queue: msg.queue });
      }

      // Follow the host's play/pause *changes* (a guest may pause just for themselves).
      if (!prev || prev.isPlaying !== msg.isPlaying || prev.track?.id !== msg.track.id) {
        if (player.isPlaying !== msg.isPlaying) player.setIsPlaying(msg.isPlaying);
      }

      const local = usePlayerStore.getState();
      if (msg.isPlaying && local.isPlaying && !local.isBuffering) {
        const expected = msg.position + LATENCY_SECONDS;
        if (Math.abs(local.currentTime - expected) > DRIFT_SECONDS) player.requestSeek(expected);
      }
    });
  }

  private request(action: RequestAction, extra: Partial<JamRequest> = {}) {
    void this.send("request", { from: this.memberId, name: this.name, action, ...extra });
  }

  private onGuestLocalChange(
    s: ReturnType<typeof usePlayerStore.getState>,
    p: ReturnType<typeof usePlayerStore.getState>
  ) {
    if (this.applying > 0 || this.closed) return;
    // Only forward changes the guest made themselves (tap / key / media button within 1.5 s),
    // never ones the player made on its own (buffering, autoplay blocks, errors).
    if (Date.now() - this.lastGestureAt > 1500) return;
    const host = this.lastHost;
    const canControl = Boolean(host?.allowGuestControl);

    // Songs the guest queued locally -> ask the host to add them for everyone.
    if (s.queue !== p.queue && s.currentTrack?.id === p.currentTrack?.id) {
      const known = new Set([...(host?.queue ?? []).map((t) => t.id), ...p.queue.map((t) => t.id)]);
      s.queue.forEach((t, i) => {
        if (!known.has(t.id)) this.request(i === 0 ? "playNext" : "add", { track: t });
      });
      return;
    }

    if (s.currentTrack?.id !== p.currentTrack?.id || s.trackLoadNonce !== p.trackLoadNonce) {
      const naturalEnd = p.duration > 0 && p.currentTime >= p.duration - 3;
      if (naturalEnd || !s.currentTrack) return; // wait for the host's next track
      if (canControl) {
        this.request("playTrack", { track: s.currentTrack });
      } else {
        this.cb.onNotice("Only the host can change the song. Your pick was added to the queue.");
        this.request("add", { track: s.currentTrack });
        window.setTimeout(() => this.resync(), 0);
      }
      return;
    }

    if (s.isPlaying !== p.isPlaying && canControl && !s.isBuffering && !p.isBuffering) {
      this.request(s.isPlaying ? "play" : "pause");
      return;
    }

    if (s.seekNonce !== p.seekNonce && canControl && s.seekTarget !== null) {
      this.request("seek", { position: s.seekTarget });
    }
  }

  /** Re-sync to the host now (e.g. the guest pressed "Sync"). */
  resync() {
    const host = this.lastHost;
    if (!host) return;
    this.lastHost = null;
    this.handleState(host);
  }
}
