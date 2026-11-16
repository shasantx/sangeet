import { getAudioElement } from "@/lib/audio-engine";

export type EqPresetId =
  | "flat"
  | "bass-boost"
  | "vocal"
  | "late-night"
  | "electronic";

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
  },
  {
    id: "bass-boost",
    label: "Bass Boost",
    description: "Deep, punchy low end",
    gains: [5.5, 3, 0, 0.5, 1],
  },
  {
    id: "vocal",
    label: "Vocal",
    description: "Crisp, forward vocals",
    gains: [-2, -1, 3.5, 4, 1.5],
  },
  {
    id: "late-night",
    label: "Late Night",
    description: "Warm & gentle dynamics",
    gains: [2.5, 1.5, 0, -1.5, -2.5],
  },
  {
    id: "electronic",
    label: "Electronic",
    description: "Tight bass & sparkling highs",
    gains: [4.5, 2, -1, 2.5, 4],
  },
] as const;

let audioCtx: AudioContext | null = null;
let sourceNode: MediaElementAudioSourceNode | null = null;
let attachedAudio: HTMLAudioElement | null = null;
let filterNodes: BiquadFilterNode[] = [];
let activePresetId: EqPresetId = "flat";

export function getEqPreset(id: EqPresetId): EqPreset {
  return EQ_PRESETS.find((preset) => preset.id === id) ?? EQ_PRESETS[0];
}

export function getCurrentEqPreset(): EqPresetId {
  return activePresetId;
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

function ensureAudioGraph(audio: HTMLAudioElement): boolean {
  try {
    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) return false;

    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }

    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }

    // Only create MediaElementAudioSourceNode once per <audio> element
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

      let previous: AudioNode = sourceNode;
      for (const filter of filterNodes) {
        previous.connect(filter);
        previous = filter;
      }
      previous.connect(audioCtx.destination);
      attachedAudio = audio;
    }

    return true;
  } catch {
    return false;
  }
}

export function applyEqPreset(presetId: EqPresetId): {
  ok: boolean;
  preset: EqPreset;
} {
  const preset = getEqPreset(presetId);
  activePresetId = preset.id;

  // Never attach MediaElementAudioSourceNode for Flat unless already attached,
  // preserving native cross-origin & background playback behavior.
  if (preset.id === "flat" && (!sourceNode || !audioCtx)) {
    return { ok: true, preset };
  }

  const audio = getAudioElement();
  if (!audio) {
    return { ok: false, preset };
  }

  if (!ensureAudioGraph(audio) || !audioCtx) {
    return { ok: false, preset };
  }

  try {
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }

    const now = audioCtx.currentTime;
    filterNodes.forEach((filter, index) => {
      const targetGain = preset.gains[index] ?? 0;
      try {
        filter.gain.setTargetAtTime(targetGain, now, 0.02);
      } catch {
        filter.gain.value = targetGain;
      }
    });

    return { ok: true, preset };
  } catch {
    return { ok: false, preset };
  }
}
