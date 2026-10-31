/**
 * Generates AURA's original demo audio catalogue.
 * Every composition is synthesized locally, so all playback assets are
 * royalty-free and owned by this project. Run with: node scripts/generate-audio.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

const SR = 22050;
const TAU = Math.PI * 2;
const OUT_DIR = path.resolve("public/audio");
const WAV_DIR = path.resolve("scripts/tmp");
const TABLE_SIZE = 8192;
const SIN = new Float32Array(TABLE_SIZE);
for (let i = 0; i < TABLE_SIZE; i++) SIN[i] = Math.sin((i / TABLE_SIZE) * TAU);

const specs = [
  ["t01", "soul", 92, 57, [188, 0]],
  ["t02", "soul", 82, 60, [172, 1]],
  ["t03", "alternative", 88, 55, [201, 2]],
  ["t04", "ambient", 60, 50, [224, 3]],
  ["t05", "ambient", 56, 53, [198, 4]],
  ["t06", "ambient", 66, 48, [186, 5]],
  ["t07", "electronic", 112, 52, [232, 6]],
  ["t08", "electronic", 118, 57, [218, 7]],
  ["t09", "electronic", 104, 49, [205, 8]],
  ["t10", "downtempo", 98, 55, [216, 9]],
  ["t11", "downtempo", 88, 59, [194, 10]],
  ["t12", "electronic", 114, 54, [208, 11]],
  ["t13", "indie", 96, 60, [178, 12]],
  ["t14", "indie", 90, 57, [166, 13]],
  ["t15", "indie", 84, 62, [189, 14]],
  ["t16", "alternative", 106, 56, [212, 15]],
  ["t17", "electronic", 100, 51, [198, 16]],
  ["t18", "alternative", 96, 58, [204, 17]],
  ["t19", "jazz", 72, 55, [182, 18]],
  ["t20", "jazz", 78, 60, [194, 19]],
  ["t21", "jazz", 66, 53, [176, 20]],
  ["t22", "alternative", 116, 52, [221, 21]],
  ["t23", "alternative", 122, 57, [209, 22]],
  ["t24", "indie", 104, 59, [185, 23]],
  ["t25", "cinematic", 80, 50, [218, 24]],
  ["t26", "cinematic", 68, 55, [232, 25]],
  ["t27", "cinematic", 74, 53, [196, 26]],
  ["t28", "soul", 86, 56, [202, 27]],
  ["t29", "soul", 78, 51, [188, 28]],
  ["t30", "jazz", 92, 58, [214, 29]],
  ["t31", "indie", 98, 55, [176, 30]],
  ["t32", "indie", 88, 50, [191, 31]],
  ["t33", "indie", 72, 53, [205, 32]],
  ["t34", "soul", 76, 57, [198, 33]],
  ["t35", "soul", 82, 54, [186, 34]],
  ["t36", "soul", 70, 51, [178, 35]],
  ["t37", "ambient", 58, 48, [228, 36]],
  ["t38", "ambient", 52, 55, [240, 37]],
  ["t39", "alternative", 94, 60, [193, 38]],
  ["t40", "jazz", 63, 57, [209, 39]],
];

/** @type {Record<string, {bpm:number,key:number,seed:number,genre:string,duration:number}>} */
const manifest = {};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
const hz = (root, semitones) => midiToFreq(root + semitones);

function addTone(buf, startSec, duration, freq, amp, opts = {}) {
  const {
    attack = 0.01,
    release = 0.25,
    h2 = 0.16,
    h3 = 0.05,
    detune = 0,
    vibrato = 0,
    filter = 0,
  } = opts;
  const start = Math.max(0, Math.floor(startSec * SR));
  const len = Math.min(buf.length - start, Math.floor(duration * SR));
  if (len <= 0) return;
  const attackSamples = Math.max(1, Math.min(len * 0.45, attack * SR));
  const releaseSamples = Math.max(1, Math.min(len * 0.8, release * SR));
  const inc = (freq * (1 + detune)) * TABLE_SIZE / SR;
  const inc2 = inc * 2;
  const inc3 = inc * 3;
  let p1 = (freq * 37.17) % TABLE_SIZE;
  let p2 = (freq * 51.31) % TABLE_SIZE;
  let p3 = (freq * 23.71) % TABLE_SIZE;
  let prev = 0;
  const alpha = filter > 0 ? Math.min(0.99, filter) : 1;
  const vibInc = (5 + (freq % 3)) * TAU / SR;
  let vibPhase = 0;

  for (let i = 0; i < len; i++) {
    let env = 1;
    if (i < attackSamples) env = i / attackSamples;
    else if (i > len - releaseSamples) env = (len - i) / releaseSamples;
    env = Math.max(0, env);
    if (vibrato) {
      vibPhase += vibInc;
      p1 += inc * (1 + Math.sin(vibPhase) * vibrato);
      p2 += inc2 * (1 + Math.sin(vibPhase) * vibrato);
      p3 += inc3 * (1 + Math.sin(vibPhase) * vibrato);
    } else {
      p1 += inc;
      p2 += inc2;
      p3 += inc3;
    }
    let raw = SIN[p1 & (TABLE_SIZE - 1)] + SIN[p2 & (TABLE_SIZE - 1)] * h2 + SIN[p3 & (TABLE_SIZE - 1)] * h3;
    if (filter > 0) {
      prev += alpha * (raw - prev);
      raw = prev;
    }
    buf[start + i] += raw * amp * env;
  }
}

function addKick(buf, startSec, amp = 0.32) {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(0.34 * SR);
  let phase = 0;
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / SR;
    const f = 105 * Math.exp(-t * 22) + 42;
    phase += f * TAU / SR;
    const env = Math.exp(-t * 11) * Math.min(1, i / 50);
    buf[start + i] += Math.sin(phase) * env * amp;
  }
}

function addNoiseHit(buf, startSec, duration, amp, kind = "hat", rng) {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(duration * SR);
  let last = 0;
  for (let i = 0; i < len && start + i < buf.length; i++) {
    const t = i / SR;
    const noise = rng() * 2 - 1;
    if (kind === "hat") {
      const hp = noise - last * 0.82;
      last = noise;
      buf[start + i] += hp * Math.exp(-t * 38) * amp;
    } else if (kind === "snare") {
      const tone = Math.sin(t * TAU * 175) * 0.34;
      buf[start + i] += (noise * 0.7 + tone) * Math.exp(-t * 19) * amp;
    } else {
      buf[start + i] += noise * Math.exp(-t * 6) * amp;
    }
  }
}

function addChord(buf, startSec, duration, root, quality, amp, opts = {}) {
  const intervals = {
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    maj9: [0, 4, 7, 11, 14],
    min9: [0, 3, 7, 10, 14],
    sus2: [0, 2, 7, 12],
    sus4: [0, 5, 7, 12],
    "7": [0, 4, 7, 10],
    add9: [0, 4, 7, 14],
    min: [0, 3, 7, 10],
  };
  const notes = intervals[quality] ?? intervals.min7;
  notes.forEach((interval, i) => {
    addTone(buf, startSec, duration, hz(root, interval), amp * (i === 0 ? 1 : 0.72), {
      attack: opts.attack ?? 0.6,
      release: opts.release ?? 1.4,
      h2: opts.h2 ?? 0.12,
      h3: 0.025,
      filter: opts.filter ?? 0.07,
      detune: i % 2 === 0 ? 0.0015 : -0.0012,
    });
    if (opts.octave) {
      addTone(buf, startSec, duration, hz(root + 12, interval), amp * 0.22, {
        attack: opts.attack ?? 0.8,
        release: opts.release ?? 1.6,
        h2: 0.08,
        filter: 0.05,
      });
    }
  });
}

const progressions = [
  [[0, "min9"], [8, "maj7"], [3, "maj9"], [10, "sus2"]],
  [[0, "maj9"], [9, "min7"], [5, "maj7"], [7, "sus4"]],
  [[0, "min7"], [5, "maj9"], [10, "maj7"], [3, "sus2"]],
  [[0, "sus2"], [5, "maj7"], [7, "add9"], [3, "maj7"]],
];

function makeTrack(id, genre, bpm, root, durationSec, seed) {
  const rng = mulberry32(seed * 104729 + 19);
  const total = Math.floor(durationSec * SR);
  const buf = new Float32Array(total);
  const secPerBeat = 60 / bpm;
  const barLen = secPerBeat * 4;
  const prog = progressions[seed % progressions.length];
  const isAmbient = genre === "ambient" || genre === "cinematic";
  const isJazz = genre === "jazz";
  const isElectronic = genre === "electronic" || genre === "downtempo";
  const swing = isJazz ? 0.08 : 0;

  // Chord pad, one chord per bar.
  const barCount = Math.ceil(durationSec / barLen) + 1;
  for (let bar = 0; bar < barCount; bar++) {
    const [offset, quality] = prog[bar % prog.length];
    const chordRoot = root + offset;
    const start = bar * barLen;
    const velocity = isAmbient ? 0.115 : genre === "soul" ? 0.09 : 0.075;
    addChord(buf, start - 0.2, barLen + 1.5, chordRoot, isAmbient ? "sus2" : quality, velocity, {
      attack: isAmbient ? 1.8 : 0.55,
      release: isAmbient ? 2.6 : 1.3,
      filter: isAmbient ? 0.035 : 0.075,
      octave: genre === "cinematic" || isAmbient,
    });
    if (genre === "cinematic" || isAmbient) {
      addTone(buf, start, barLen + 2, hz(chordRoot + 12, 7), 0.025, {
        attack: 2.4,
        release: 2.8,
        h2: 0.08,
        vibrato: 0.002,
      });
    }
  }

  // Bass.
  if (!isAmbient) {
    for (let bar = 0; bar < barCount; bar++) {
      const [offset] = prog[bar % prog.length];
      const base = root + offset - 12;
      const start = bar * barLen;
      if (isElectronic) {
        for (let beat = 0; beat < 4; beat += 2) {
          addTone(buf, start + beat * secPerBeat, secPerBeat * 0.8, hz(base, 0), 0.17, {
            attack: 0.005,
            release: 0.18,
            h2: 0.25,
            h3: 0.06,
            filter: 0.2,
          });
        }
      } else {
        addTone(buf, start, barLen * 0.56, hz(base, 0), 0.15, {
          attack: 0.02,
          release: 0.5,
          h2: 0.18,
          filter: 0.12,
        });
        addTone(buf, start + barLen * 0.62, barLen * 0.3, hz(base, 7), 0.105, {
          attack: 0.02,
          release: 0.4,
          h2: 0.13,
          filter: 0.12,
        });
      }
    }
  }

  // Drums.
  if (!isAmbient && !isJazz) {
    for (let bar = 0; bar < barCount; bar++) {
      const start = bar * barLen;
      for (let beat = 0; beat < 4; beat++) {
        if (isElectronic || (beat % 2 === 0 && genre !== "indie")) {
          if (!(bar < 2 && seed % 3 === 0)) addKick(buf, start + beat * secPerBeat, 0.28);
        }
        if (beat === 1 || beat === 3) addNoiseHit(buf, start + beat * secPerBeat, 0.2, 0.16, "snare", rng);
        for (let eighth = 0; eighth < 2; eighth++) {
          const swingOffset = eighth === 1 ? swing * secPerBeat : 0;
          addNoiseHit(
            buf,
            start + (beat + eighth * 0.5) * secPerBeat + swingOffset,
            0.055,
            eighth === 0 ? 0.055 : 0.032,
            "hat",
            rng,
          );
        }
      }
    }
  } else if (isJazz) {
    for (let bar = 0; bar < barCount; bar++) {
      const start = bar * barLen;
      for (let beat = 0; beat < 4; beat++) {
        addNoiseHit(buf, start + beat * secPerBeat + (beat % 2) * swing * secPerBeat, 0.13, 0.026, "brush", rng);
        if (beat === 1 || beat === 3) addNoiseHit(buf, start + beat * secPerBeat, 0.09, 0.028, "snare", rng);
      }
    }
  } else {
    // Ambient heartbeat pulse.
    for (let bar = 0; bar < barCount; bar += 2) {
      addKick(buf, bar * barLen, 0.09);
      addKick(buf, bar * barLen + secPerBeat * 2.75, 0.05);
    }
  }

  // Arpeggio / pluck.
  const scale = [0, 2, 3, 5, 7, 8, 10];
  for (let bar = 0; bar < barCount; bar++) {
    const [offset] = prog[bar % prog.length];
    const chordRoot = root + offset;
    const start = bar * barLen;
    if (isAmbient) {
      if (bar % 2 === 0) {
        const note = chordRoot + 12 + scale[Math.floor(rng() * scale.length)];
        addTone(buf, start + rng() * 1.5, barLen * 0.85, hz(note, 0), 0.035, {
          attack: 1.3,
          release: 1.8,
          h2: 0.07,
          vibrato: 0.003,
        });
      }
      continue;
    }
    const steps = isJazz ? 4 : 8;
    for (let step = 0; step < steps; step++) {
      if (isJazz && rng() > 0.48) continue;
      if (!isJazz && rng() > 0.72) continue;
      const degree = scale[Math.floor(rng() * scale.length)];
      const octave = rng() > 0.68 ? 24 : 12;
      const note = chordRoot + degree + octave;
      const startAt = start + (step / steps) * barLen + (isJazz ? (step % 2) * swing * secPerBeat : 0);
      const amp = 0.028 + rng() * 0.018;
      addTone(buf, startAt, isJazz ? 1.1 : 0.55, hz(note, 0), amp, {
        attack: 0.008,
        release: isJazz ? 0.9 : 0.42,
        h2: 0.22,
        h3: 0.08,
        filter: 0.28,
      });
      if (bar % 2 === 1 && step === 2) {
        addTone(buf, startAt + 0.32, 0.4, hz(note, 0), amp * 0.28, { attack: 0.01, release: 0.4, h2: 0.1 });
      }
    }
  }

  // Sparse melody.
  const melodySteps = Math.floor(durationSec / (barLen * 2));
  for (let i = 0; i < melodySteps; i++) {
    if (rng() > 0.62) continue;
    const bar = i * 2 + (rng() > 0.5 ? 1 : 0);
    const [offset] = prog[bar % prog.length];
    const degree = scale[Math.floor(rng() * scale.length)];
    const note = root + offset + 24 + degree;
    const start = bar * barLen + (rng() > 0.5 ? secPerBeat * 2 : secPerBeat);
    addTone(buf, start, 1.4 + rng() * 1.8, hz(note, 0), 0.033, {
      attack: 0.06,
      release: 1.2,
      h2: 0.14,
      h3: 0.04,
      vibrato: 0.0028,
      filter: 0.22,
    });
    addTone(buf, start + 0.42, 1.1, hz(note, 0), 0.008, { attack: 0.02, release: 0.9, h2: 0.1 });
  }

  // Warm air / texture.
  const texture = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const n = rng() * 2 - 1;
    if (i % 2 === 0) texture[i] = n;
    else texture[i] = -n * 0.6;
  }
  let smooth = 0;
  for (let i = 0; i < total; i++) {
    smooth += 0.003 * (texture[i] - smooth);
    buf[i] += smooth * (isAmbient ? 0.05 : 0.016);
  }

  // Simple tape-like delay/space.
  const delay = Math.floor(SR * (0.28 + (seed % 3) * 0.07));
  for (let i = delay; i < total; i++) {
    buf[i] += buf[i - delay] * (isAmbient ? 0.13 : 0.07);
  }

  // Gentle lowpass + intro/outro fades + normalize.
  let lp = 0;
  let peak = 0;
  const fadeIn = Math.min(3.2 * SR, total);
  const fadeOut = Math.min(6 * SR, total);
  for (let i = 0; i < total; i++) {
    lp += 0.62 * (buf[i] - lp);
    let sample = lp;
    if (i < fadeIn) sample *= i / fadeIn;
    if (i > total - fadeOut) sample *= (total - i) / fadeOut;
    buf[i] = sample;
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
  }
  const gain = peak > 0 ? 0.88 / peak : 1;
  for (let i = 0; i < total; i++) {
    const sample = Math.max(-1, Math.min(1, buf[i] * gain));
    const int = Math.round(sample * 32767);
    const off = i * 2;
    wavData[off] = int & 0xff;
    wavData[off + 1] = (int >> 8) & 0xff;
  }

  return total;
}

function writeWav(file, samples) {
  const dataSize = samples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < dataSize; i++) buffer[44 + i] = wavData[i];
  fs.writeFileSync(file, buffer);
}

let wavData;

function encode(id, wavFile, mp3File) {
  const result = spawnSync(
    ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "s16le",
      "-ar",
      String(SR),
      "-ac",
      "1",
      "-i",
      wavFile,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-ac",
      "1",
      mp3File,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${id}`);
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(WAV_DIR, { recursive: true });

console.log(`Generating ${specs.length} original AURA recordings...`);
for (const [id, genre, bpm, key, [duration, seed]] of specs) {
  const started = Date.now();
  const samples = duration * SR;
  wavData = new Uint8Array(samples * 2);
  makeTrack(id, genre, bpm, key, duration, seed);
  const wavFile = path.join(WAV_DIR, `${id}.wav`);
  const mp3File = path.join(OUT_DIR, `${id}.mp3`);
  writeWav(wavFile, samples);
  encode(id, wavFile, mp3File);
  fs.unlinkSync(wavFile);
  manifest[id] = { duration, file: `/audio/${id}.mp3`, genre, bpm, key };
  console.log(`  ${id} · ${genre} · ${duration}s · ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

const manifestPath = path.resolve("lib/audio-manifest.ts");
const lines = [
  "// Generated by scripts/generate-audio.mjs — do not edit manually.",
  "export interface AudioManifestEntry {",
  "  duration: number;",
  "  file: string;",
  "}",
  "",
  "export const audioManifest: Record<string, AudioManifestEntry> = {",
  ...Object.entries(manifest).map(
    ([id, entry]) => `  ${id}: { duration: ${entry.duration}, file: "${entry.file}" },`,
  ),
  "};",
  "",
];
fs.writeFileSync(manifestPath, lines.join("\n"));
try {
  fs.rmdirSync(WAV_DIR);
} catch {
  // Directory may not be empty; leave it for .gitignore.
}
console.log("Audio catalogue complete.");
