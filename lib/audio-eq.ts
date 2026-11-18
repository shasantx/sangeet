import { getAudioElement } from "@/lib/audio-engine";
import { clamp } from "@/lib/utils";

export type EqPresetId =
  | "flat"
  | "bass-boost"
  | "vocal"
  | "late-night"
  | "electronic"
  | "slowed-reverb"
  | "nightcore"
  | "studio-wide";

export interface AudioEffectsState {
  presetId: EqPresetId;
  bassBoostDb: number;
  trebleBoostDb: number;
  reverbMix: number;
  stereoWidth: number;
  bandGains?: readonly [number, number, number, number, number];
}

export interface EqBand {
  frequency: number;
  label: string;
  type: BiquadFilterType;
  q?: number;
}

export interface EqPreset {
  id: EqPresetId;
  label: string;
  description: string;
  gains: readonly [number, number, number, number, number];
  reverbMix: number;
  stereoWidth: number;
  recommendedSpeed?: number;
}

export const EQ_BANDS: readonly EqBand[] = [
  { frequency: 60, label: "60Hz", type: "lowshelf" },
  { frequency: 230, label: "230Hz", type: "peaking", q: 1.0 },
  { frequency: 910, label: "910Hz", type: "peaking", q: 1.0 },
  { frequency: 3600, label: "3.6kHz", type: "peaking", q: 1.0 },
  { frequency: 14000, label: "14kHz", type: "highshelf" },
] as const;

export const EQ_PRESETS: readonly EqPreset[] = [
  {
    id: "flat",
    label: "Flat",
    description: "Natural, uncolored audio",
    gains: [0, 0, 0, 0, 0],
    reverbMix: 0,
    stereoWidth: 0,
    recommendedSpeed: 1,
  },
  {
    id: "bass-boost",
    label: "Bass Boost",
    description: "Deep, punchy low end",
    gains: [6, 3.5, 0, 0.5, 1],
    reverbMix: 0,
    stereoWidth: 0.1,
  },
  {
    id: "vocal",
    label: "Vocal",
    description: "Crisp, forward vocals",
    gains: [-2, -1, 3.5, 4.5, 1.5],
    reverbMix: 0.08,
    stereoWidth: 0,
  },
  {
    id: "late-night",
    label: "Late Night",
    description: "Warm & gentle dynamics",
    gains: [2.5, 1.5, 0, -1.5, -2.5],
    reverbMix: 0.15,
    stereoWidth: 0.15,
  },
  {
    id: "electronic",
    label: "Electronic",
    description: "Tight bass & sparkling highs",
    gains: [5, 2, -1, 2.5, 4.5],
    reverbMix: 0.05,
    stereoWidth: 0.25,
  },
  {
    id: "slowed-reverb",
    label: "Slowed + Reverb",
    description: "Dreamy 0.85x pace & lush hall",
    gains: [3.5, 2, -0.5, -1, -2],
    reverbMix: 0.55,
    stereoWidth: 0.4,
    recommendedSpeed: 0.85,
  },
  {
    id: "nightcore",
    label: "Nightcore",
    description: "Energetic 1.25x pace & crisp highs",
    gains: [2, 0.5, 1, 3, 4],
    reverbMix: 0.05,
    stereoWidth: 0.2,
    recommendedSpeed: 1.25,
  },
  {
    id: "studio-wide",
    label: "Studio 3D",
    description: "Wide stereo stage & clarity",
    gains: [2, 1, 1.5, 2.5, 2.5],
    reverbMix: 0.22,
    stereoWidth: 0.65,
  },
] as const;

const STORAGE_KEY = "sangeet-audio-effects-v1";

const DEFAULT_STATE: AudioEffectsState = {
  presetId: "flat",
  bassBoostDb: 0,
  trebleBoostDb: 0,
  reverbMix: 0,
  stereoWidth: 0,
};

let effectsState: AudioEffectsState = { ...DEFAULT_STATE };
let stateHydrated = false;
const subscribers = new Set<(state: AudioEffectsState) => void>();

let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let attachedAudio: HTMLAudioElement | null = null;
let filterNodes: BiquadFilterNode[] = [];
let dryGainNode: GainNode | null = null;
let wetGainNode: GainNode | null = null;
let rightDelayNode: DelayNode | null = null;

function isValidPresetId(value: unknown): value is EqPresetId {
  return EQ_PRESETS.some((preset) => preset.id === value);
}

function sanitizeBandGains(
  value: unknown,
): readonly [number, number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 5) return undefined;
  if (!value.every((n) => typeof n === "number" && Number.isFinite(n))) return undefined;
  return [
    clamp(value[0], -10, 14),
    clamp(value[1], -10, 14),
    clamp(value[2], -10, 14),
    clamp(value[3], -10, 14),
    clamp(value[4], -10, 14),
  ];
}

function hydrateEffectsState(): void {
  if (stateHydrated || typeof window === "undefined") return;
  stateHydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<AudioEffectsState>;
    const presetId = isValidPresetId(parsed.presetId) ? parsed.presetId : "flat";
    const preset = getEqPreset(presetId);
    const bandGains = sanitizeBandGains(parsed.bandGains);
    effectsState = {
      presetId,
      bassBoostDb:
        typeof parsed.bassBoostDb === "number" && Number.isFinite(parsed.bassBoostDb)
          ? clamp(parsed.bassBoostDb, -8, 12)
          : preset.gains[0],
      trebleBoostDb:
        typeof parsed.trebleBoostDb === "number" && Number.isFinite(parsed.trebleBoostDb)
          ? clamp(parsed.trebleBoostDb, -8, 12)
          : preset.gains[4],
      reverbMix:
        typeof parsed.reverbMix === "number" && Number.isFinite(parsed.reverbMix)
          ? clamp(parsed.reverbMix, 0, 1)
          : preset.reverbMix,
      stereoWidth:
        typeof parsed.stereoWidth === "number" && Number.isFinite(parsed.stereoWidth)
          ? clamp(parsed.stereoWidth, 0, 1)
          : preset.stereoWidth,
      ...(bandGains ? { bandGains } : {}),
    };
  } catch {
    effectsState = { ...DEFAULT_STATE };
  }
}

function persistEffectsState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(effectsState));
  } catch {
    // Ignore storage quota / private mode failures.
  }
}

function notifySubscribers(): void {
  const snapshot = getAudioEffectsState();
  for (const cb of Array.from(subscribers)) {
    try {
      cb(snapshot);
    } catch {
      // Isolate listener errors.
    }
  }
}

export function getEqPreset(id: EqPresetId): EqPreset {
  return EQ_PRESETS.find((preset) => preset.id === id) ?? EQ_PRESETS[0];
}

export function getAudioEffectsState(): AudioEffectsState {
  hydrateEffectsState();
  return { ...effectsState };
}

export function getCurrentEqPreset(): EqPresetId {
  return getAudioEffectsState().presetId;
}

export function getEffectiveEqGains(
  state: AudioEffectsState = getAudioEffectsState(),
): readonly [number, number, number, number, number] {
  if (state.bandGains && state.bandGains.length === 5) {
    return [
      clamp(state.bandGains[0], -10, 14),
      clamp(state.bandGains[1], -10, 14),
      clamp(state.bandGains[2], -10, 14),
      clamp(state.bandGains[3], -10, 14),
      clamp(state.bandGains[4], -10, 14),
    ];
  }
  const preset = getEqPreset(state.presetId);
  const bassDelta = state.bassBoostDb - preset.gains[0];
  const trebleDelta = state.trebleBoostDb - preset.gains[4];
  return [
    clamp(state.bassBoostDb, -10, 14),
    clamp(preset.gains[1] + bassDelta * 0.5, -10, 14),
    preset.gains[2],
    clamp(preset.gains[3] + trebleDelta * 0.5, -10, 14),
    clamp(state.trebleBoostDb, -10, 14),
  ];
}

export function isPresetActive(): boolean {
  const state = getAudioEffectsState();
  return (
    state.presetId !== "flat" ||
    Math.abs(state.bassBoostDb) > 0.05 ||
    Math.abs(state.trebleBoostDb) > 0.05 ||
    state.reverbMix > 0.01 ||
    state.stereoWidth > 0.01 ||
    Boolean(state.bandGains?.some((gain) => Math.abs(gain) > 0.05))
  );
}

function isEffectsNeutral(state: AudioEffectsState): boolean {
  const gains = getEffectiveEqGains(state);
  return (
    gains.every((gain) => Math.abs(gain) <= 0.05) &&
    state.reverbMix <= 0.01 &&
    state.stereoWidth <= 0.01
  );
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext ??
    null
  );
}

/**
 * Only attach MediaElementAudioSourceNode for same-origin, blob:, or data: URLs.
 * Cross-origin audio URLs without CORS headers would be silenced by the Web Audio API.
 */
function isCorsSafeForWebAudio(audio: HTMLAudioElement): boolean {
  if (typeof window === "undefined") return false;
  const src = audio.currentSrc || audio.src || "";
  if (!src || src === window.location.href) return false;
  if (src.startsWith("blob:") || src.startsWith("data:")) return true;
  if (audio.crossOrigin === "anonymous" || audio.crossOrigin === "use-credentials") {
    return true;
  }
  try {
    const parsed = new URL(src, window.location.href);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function canUseWebAudioFx(): boolean {
  const audio = getAudioElement();
  if (!audio || audio.error) return false;
  return isCorsSafeForWebAudio(audio);
}

export function resumeAudioEffectsContext(): void {
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
}

function createStereoImpulseResponse(
  ctx: AudioContext,
  durationSeconds = 2.1,
  decay = 2.6,
): AudioBuffer {
  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const channelData = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const progress = i / length;
      const envelope = Math.pow(1 - progress, decay);
      // Soft initial transient ramp in first 12ms to avoid metallic slapback
      const attack = i < sampleRate * 0.012 ? i / (sampleRate * 0.012) : 1;
      channelData[i] = (Math.random() * 2 - 1) * envelope * attack;
    }
  }

  return impulse;
}

function ensureAudioGraph(audio: HTMLAudioElement): boolean {
  try {
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }

    if (!isCorsSafeForWebAudio(audio)) {
      return false;
    }

    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) return false;

    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }

    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }

    // Only create MediaElementAudioSourceNode once per <audio> element.
    if (!sourceNode || attachedAudio !== audio) {
      sourceNode = audioCtx.createMediaElementSource(audio);
      filterNodes = EQ_BANDS.map((band) => {
        const filter = audioCtx!.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.frequency;
        if (band.q !== undefined) {
          filter.Q.value = band.q;
        }
        filter.gain.value = 0;
        return filter;
      });

      let eqTail: AudioNode = sourceNode;
      for (const filter of filterNodes) {
        eqTail.connect(filter);
        eqTail = filter;
      }

      // Dry/wet reverb stage
      dryGainNode = audioCtx.createGain();
      wetGainNode = audioCtx.createGain();
      dryGainNode.gain.value = 1;
      wetGainNode.gain.value = 0;

      const convolver = audioCtx.createConvolver();
      convolver.buffer = createStereoImpulseResponse(audioCtx);

      const wetDamping = audioCtx.createBiquadFilter();
      wetDamping.type = "lowpass";
      wetDamping.frequency.value = 6200;

      const reverbMixBus = audioCtx.createGain();
      // Ensure mono sources up-mix to stereo before ChannelSplitter(2) so the right channel isn't silent.
      reverbMixBus.channelCount = 2;
      reverbMixBus.channelCountMode = "explicit";
      reverbMixBus.channelInterpretation = "speakers";
      eqTail.connect(dryGainNode);
      dryGainNode.connect(reverbMixBus);

      eqTail.connect(convolver);
      convolver.connect(wetDamping);
      wetDamping.connect(wetGainNode);
      wetGainNode.connect(reverbMixBus);

      // Stereo Haas widening stage (subtle delay on right channel up to 12ms)
      const splitter = audioCtx.createChannelSplitter(2);
      const merger = audioCtx.createChannelMerger(2);
      rightDelayNode = audioCtx.createDelay(0.05);
      rightDelayNode.delayTime.value = 0;

      reverbMixBus.connect(splitter);
      splitter.connect(merger, 0, 0);
      splitter.connect(rightDelayNode, 1);
      rightDelayNode.connect(merger, 0, 1);

      // Gentle output limiter to prevent clipping when boosting bass or reverb
      const compressor = audioCtx.createDynamicsCompressor();
      compressor.threshold.value = -6;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      merger.connect(compressor);
      compressor.connect(audioCtx.destination);
      attachedAudio = audio;
    }

    return true;
  } catch {
    return false;
  }
}

function setAudioParamSmooth(param: AudioParam, value: number, now: number): void {
  try {
    param.setTargetAtTime(value, now, 0.02);
  } catch {
    param.value = value;
  }
}

function applyEffectsToGraph(): boolean {
  const state = getAudioEffectsState();

  // Preserve native unmodified playback when neutral unless graph is already attached.
  if (isEffectsNeutral(state) && (!sourceNode || !audioCtx)) {
    return true;
  }

  const audio = getAudioElement();
  if (!audio) return false;
  if (!ensureAudioGraph(audio) || !audioCtx) return false;

  try {
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    const gains = getEffectiveEqGains(state);
    filterNodes.forEach((filter, index) => {
      setAudioParamSmooth(filter.gain, gains[index] ?? 0, now);
    });

    const wet = clamp(state.reverbMix, 0, 1);
    if (dryGainNode) {
      setAudioParamSmooth(dryGainNode.gain, 1 - wet * 0.35, now);
    }
    if (wetGainNode) {
      setAudioParamSmooth(wetGainNode.gain, wet * 0.85, now);
    }

    if (rightDelayNode) {
      const delaySec = clamp(state.stereoWidth, 0, 1) * 0.012;
      setAudioParamSmooth(rightDelayNode.delayTime, delaySec, now);
    }

    return true;
  } catch {
    return false;
  }
}

export function ensureAudioEffectsSynced(): boolean {
  hydrateEffectsState();
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return applyEffectsToGraph();
}

export function setAudioEffectsState(patch: Partial<AudioEffectsState>): AudioEffectsState {
  hydrateEffectsState();
  const nextPresetId = isValidPresetId(patch.presetId)
    ? patch.presetId
    : effectsState.presetId;

  const patchedBandGains = sanitizeBandGains(patch.bandGains);
  let nextBandGains = patchedBandGains ?? effectsState.bandGains;

  const hasBassPatch =
    typeof patch.bassBoostDb === "number" && Number.isFinite(patch.bassBoostDb);
  const hasTreblePatch =
    typeof patch.trebleBoostDb === "number" && Number.isFinite(patch.trebleBoostDb);

  const nextBassBoostDb = patchedBandGains
    ? clamp(patchedBandGains[0], -8, 12)
    : hasBassPatch
      ? clamp(patch.bassBoostDb!, -8, 12)
      : effectsState.bassBoostDb;

  const nextTrebleBoostDb = patchedBandGains
    ? clamp(patchedBandGains[4], -8, 12)
    : hasTreblePatch
      ? clamp(patch.trebleBoostDb!, -8, 12)
      : effectsState.trebleBoostDb;

  // Keep custom bandGains in sync when Bass/Treble sliders are dragged directly.
  if (!patchedBandGains && nextBandGains && (hasBassPatch || hasTreblePatch)) {
    const bassDelta = nextBassBoostDb - nextBandGains[0];
    const trebleDelta = nextTrebleBoostDb - nextBandGains[4];
    nextBandGains = [
      nextBassBoostDb,
      hasBassPatch ? clamp(nextBandGains[1] + bassDelta * 0.5, -10, 14) : nextBandGains[1],
      nextBandGains[2],
      hasTreblePatch ? clamp(nextBandGains[3] + trebleDelta * 0.5, -10, 14) : nextBandGains[3],
      nextTrebleBoostDb,
    ];
  }

  effectsState = {
    presetId: nextPresetId,
    bassBoostDb: nextBassBoostDb,
    trebleBoostDb: nextTrebleBoostDb,
    reverbMix:
      typeof patch.reverbMix === "number" && Number.isFinite(patch.reverbMix)
        ? clamp(patch.reverbMix, 0, 1)
        : effectsState.reverbMix,
    stereoWidth:
      typeof patch.stereoWidth === "number" && Number.isFinite(patch.stereoWidth)
        ? clamp(patch.stereoWidth, 0, 1)
        : effectsState.stereoWidth,
    ...(nextBandGains ? { bandGains: nextBandGains } : {}),
  };

  persistEffectsState();
  applyEffectsToGraph();
  notifySubscribers();
  return getAudioEffectsState();
}

export function applyEqPreset(presetId: EqPresetId): {
  ok: boolean;
  preset: EqPreset;
  recommendedSpeed?: number;
} {
  hydrateEffectsState();
  const preset = getEqPreset(presetId);

  effectsState = {
    presetId: preset.id,
    bassBoostDb: preset.gains[0],
    trebleBoostDb: preset.gains[4],
    reverbMix: preset.reverbMix,
    stereoWidth: preset.stereoWidth,
  };

  persistEffectsState();
  const ok = applyEffectsToGraph();
  notifySubscribers();
  return {
    ok,
    preset,
    recommendedSpeed: preset.recommendedSpeed,
  };
}

export function subscribeAudioEffects(cb: (state: AudioEffectsState) => void): () => void {
  hydrateEffectsState();
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
