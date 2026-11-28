/**
 * Web Audio effects chain for songs played through the page's own <audio>
 * element (Audius, offline, local files; on every platform).
 *
 *   source -> headroom -> 5-band EQ -> spatial -> output
 *
 * The EQ curves, headroom rule and spatial algorithm deliberately mirror the
 * Android native processor (DhunAudioEffects.java) so a preset sounds the same
 * in the browser, the Windows app and the Android app.
 */

export type SpatialMode = "off" | "natural" | "immersive";

export const EQ_BANDS_HZ = [60, 230, 910, 3600, 14000] as const;

const REFLECTIONS_MS = [7.1, 11.3, 17.9, 23.7, 31.3];
const REFLECTION_GAINS = [0.2, 0.16, 0.12, 0.09, 0.06];

export interface EffectsChain {
  update: (eqEnabled: boolean, gainsDb: readonly number[], spatial: SpatialMode) => void;
}

/** Same rule as Android: half the biggest single boost, or the whole average boost. */
export function headroomDb(eqEnabled: boolean, gainsDb: readonly number[]): number {
  if (!eqEnabled) return 0;
  let max = 0;
  let sum = 0;
  for (const g of gainsDb) {
    max = Math.max(max, g);
    sum += g;
  }
  return Math.max(max * 0.5, Math.max(0, sum / gainsDb.length));
}

export function spatialParams(mode: SpatialMode) {
  if (mode === "natural") return { width: 1.3, crossfeed: 0.18, reflections: 0 };
  if (mode === "immersive") return { width: 1.55, crossfeed: 0.22, reflections: 1 };
  return { width: 1, crossfeed: 0, reflections: 0 };
}

export function createEffectsChain(ctx: AudioContext, source: AudioNode): EffectsChain {
  // Up-mix mono files to both ears before splitting (a splitter alone would leave mono left-only).
  const input = ctx.createGain();
  input.channelCount = 2;
  input.channelCountMode = "explicit";
  input.channelInterpretation = "speakers";
  source.connect(input);

  const filters = EQ_BANDS_HZ.map((freq, i) => {
    const f = ctx.createBiquadFilter();
    f.type = i === 0 ? "lowshelf" : i === EQ_BANDS_HZ.length - 1 ? "highshelf" : "peaking";
    f.frequency.value = freq;
    f.Q.value = 1.1;
    f.gain.value = 0;
    return f;
  });
  input.connect(filters[0]);
  for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
  const eqOut = filters[filters.length - 1];

  // ---- spatial: widening matrix + crossfeed + early reflections ----
  const split = ctx.createChannelSplitter(2);
  const merge = ctx.createChannelMerger(2);
  eqOut.connect(split);

  const sumL = ctx.createGain();
  const sumR = ctx.createGain();
  sumL.connect(merge, 0, 0);
  sumR.connect(merge, 0, 1);

  const gain = (v = 0) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };

  // L' = a*L + b*R ; R' = b*L + a*R
  const lToL = gain(1);
  const rToL = gain(0);
  const lToR = gain(0);
  const rToR = gain(1);
  split.connect(lToL, 0);
  split.connect(rToL, 1);
  split.connect(lToR, 0);
  split.connect(rToR, 1);
  lToL.connect(sumL);
  rToL.connect(sumL);
  lToR.connect(sumR);
  rToR.connect(sumR);

  // Crossfeed: each ear hears the other speaker ~0.27 ms later and duller.
  const crossPath = (fromChannel: 0 | 1, to: GainNode) => {
    const d = ctx.createDelay(0.01);
    d.delayTime.value = 0.00027;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    lp.Q.value = 0.5;
    const g = gain(0);
    split.connect(d, fromChannel);
    d.connect(lp);
    lp.connect(g);
    g.connect(to);
    return g;
  };
  const cfToL = crossPath(1, sumL);
  const cfToR = crossPath(0, sumR);

  // Early reflections, alternating sides, softened like the Android version.
  const reflLpL = ctx.createBiquadFilter();
  const reflLpR = ctx.createBiquadFilter();
  for (const lp of [reflLpL, reflLpR]) {
    lp.type = "lowpass";
    lp.frequency.value = 4500;
    lp.Q.value = 0.5;
  }
  reflLpL.connect(sumL);
  reflLpR.connect(sumR);
  const reflGains: GainNode[] = [];
  REFLECTIONS_MS.forEach((ms, k) => {
    for (const fromChannel of [0, 1] as const) {
      const d = ctx.createDelay(0.1);
      d.delayTime.value = ms / 1000;
      const g = gain(0);
      split.connect(d, fromChannel);
      d.connect(g);
      // even taps cross sides, odd taps stay on their side
      const toLeft = k % 2 === 0 ? fromChannel === 1 : fromChannel === 0;
      g.connect(toLeft ? reflLpL : reflLpR);
      reflGains.push(g);
    }
  });

  const output = gain(1);
  merge.connect(output);
  output.connect(ctx.destination);

  const set = (param: AudioParam, value: number) => {
    // Short ramp so changes don't click.
    param.setTargetAtTime(value, ctx.currentTime, 0.02);
  };

  return {
    update(eqEnabled, gainsDb, spatial) {
      const headroom = headroomDb(eqEnabled, gainsDb);
      set(input.gain, Math.pow(10, -headroom / 20));
      filters.forEach((f, i) => set(f.gain, eqEnabled ? (gainsDb[i] ?? 0) : 0));

      const p = spatialParams(spatial);
      const a = (1 + p.width) / 2;
      const b = (1 - p.width) / 2;
      set(lToL.gain, a);
      set(rToR.gain, a);
      set(rToL.gain, b);
      set(lToR.gain, b);
      set(cfToL.gain, p.crossfeed);
      set(cfToR.gain, p.crossfeed);
      reflGains.forEach((g, i) => set(g.gain, p.reflections ? REFLECTION_GAINS[Math.floor(i / 2)] : 0));
      const reflSum = p.reflections ? REFLECTION_GAINS.reduce((s, v) => s + v, 0) : 0;
      set(output.gain, spatial === "off" ? 1 : 1 / (1 + p.crossfeed + reflSum * 0.5));
    }
  };
}
