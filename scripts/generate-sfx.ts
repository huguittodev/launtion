/**
 * scripts/generate-sfx.ts
 *
 * Deterministic DSP Audio Synthesizer for Vidiaura SaaS SFX Bank.
 * Generates 12 studio-grade, 16-bit 44.1kHz mono PCM RIFF WAV audio assets directly into public/sfx/.
 *
 * Compliance:
 * - AGENTS.md Rule 14 (Music & sound effects must have documented rights suitable for commercial exports).
 * - 100% Mathematically synthesized (CC0 1.0 Universal Public Domain Dedication).
 * - Zero external binary dependencies or third-party samples.
 * - Bit-level deterministic reproducibility across runs (Mulberry32 PRNG + RBJ Biquad filters).
 * - Safe peak volume bounded between -1.0 dBFS and -6.0 dBFS.
 *
 * Usage:
 *   npx tsx scripts/generate-sfx.ts           # Generate / overwrite 12 WAV files in public/sfx/
 *   npx tsx scripts/generate-sfx.ts --verify  # Verify existing files match exact SHA-256 hashes
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const SAMPLE_RATE = 44100;
const OUTPUT_DIR = path.resolve(process.cwd(), 'public/sfx');

/* ========================================================================= */
/* 1. DETERMINISTIC PRNG (Mulberry32)                                        */
/* ========================================================================= */

export class DeterministicPRNG {
  private s: number;
  constructor(seed = 1337) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextBipolar(): number {
    return this.next() * 2 - 1;
  }
}

/* ========================================================================= */
/* 2. BIQUAD IIR FILTER (Robert Bristow-Johnson Audio EQ Cookbook)           */
/* ========================================================================= */

export class BiquadFilter {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  static createLowpass(cutoff: number, q = 0.7071, sampleRate = SAMPLE_RATE): BiquadFilter {
    const filter = new BiquadFilter();
    filter.updateLowpass(cutoff, q, sampleRate);
    return filter;
  }

  static createHighpass(cutoff: number, q = 0.7071, sampleRate = SAMPLE_RATE): BiquadFilter {
    const filter = new BiquadFilter();
    filter.updateHighpass(cutoff, q, sampleRate);
    return filter;
  }

  static createBandpass(centerFreq: number, q = 1.0, sampleRate = SAMPLE_RATE): BiquadFilter {
    const filter = new BiquadFilter();
    filter.updateBandpass(centerFreq, q, sampleRate);
    return filter;
  }

  updateLowpass(cutoff: number, q: number, sampleRate = SAMPLE_RATE): void {
    const w0 = (2 * Math.PI * Math.max(20, Math.min(cutoff, sampleRate * 0.49))) / sampleRate;
    const cosw0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Math.max(0.01, q));
    const a0 = 1 + alpha;
    this.b0 = ((1 - cosw0) / 2) / a0;
    this.b1 = (1 - cosw0) / a0;
    this.b2 = ((1 - cosw0) / 2) / a0;
    this.a1 = (-2 * cosw0) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  updateHighpass(cutoff: number, q: number, sampleRate = SAMPLE_RATE): void {
    const w0 = (2 * Math.PI * Math.max(20, Math.min(cutoff, sampleRate * 0.49))) / sampleRate;
    const cosw0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Math.max(0.01, q));
    const a0 = 1 + alpha;
    this.b0 = ((1 + cosw0) / 2) / a0;
    this.b1 = (-(1 + cosw0)) / a0;
    this.b2 = ((1 + cosw0) / 2) / a0;
    this.a1 = (-2 * cosw0) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  updateBandpass(centerFreq: number, q: number, sampleRate = SAMPLE_RATE): void {
    const w0 = (2 * Math.PI * Math.max(20, Math.min(centerFreq, sampleRate * 0.49))) / sampleRate;
    const cosw0 = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Math.max(0.01, q));
    const a0 = 1 + alpha;
    this.b0 = alpha / a0;
    this.b1 = 0;
    this.b2 = -alpha / a0;
    this.a1 = (-2 * cosw0) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(sample: number): number {
    const out = this.b0 * sample + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = sample;
    this.y2 = this.y1;
    this.y1 = out;
    return out;
  }
}

/* ========================================================================= */
/* 3. RIFF 16-BIT MONO WAV ENCODER & NORMALIZER                              */
/* ========================================================================= */

export function encodeMonoWav(samples: Float64Array, sampleRate = SAMPLE_RATE): Buffer {
  const numSamples = samples.length;
  const byteRate = sampleRate * 2;
  const blockAlign = 2;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0, 4, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 4, 'ascii');

  // fmt subchunk
  buffer.write('fmt ', 12, 4, 'ascii');
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample (16-bit)

  // data subchunk
  buffer.write('data', 36, 4, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  // PCM sample data
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1.0, Math.min(1.0, samples[i]));
    const intSample = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, intSample)), offset);
    offset += 2;
  }

  return buffer;
}

export function normalizeToPeak(samples: Float64Array, targetPeakDbfs: number): void {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  if (peak === 0) return;

  const targetLinear = Math.pow(10, targetPeakDbfs / 20);
  const scale = targetLinear / peak;
  for (let i = 0; i < samples.length; i++) {
    samples[i] *= scale;
  }
}

export function computeMetrics(samples: Float64Array) {
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
    sumSq += abs * abs;
  }
  const rms = Math.sqrt(sumSq / Math.max(1, samples.length));
  const peakDbfs = peak > 0 ? 20 * Math.log10(peak) : -100;
  const rmsDbfs = rms > 0 ? 20 * Math.log10(rms) : -100;
  return { peakDbfs, rmsDbfs };
}

/* ========================================================================= */
/* 4. EXACT DSP SYNTHESIZERS (12 SOUND ASSETS)                               */
/* ========================================================================= */

// 1. transition-whoosh-heavy.wav
export function synthTransitionWhooshHeavy(): Float64Array {
  const duration = 0.60;
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);
  const rng = new DeterministicPRNG(1001);
  const lpf = BiquadFilter.createLowpass(120, 1.8);

  let phaseSub = 0;
  let brown = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Integrated brown noise
    const white = rng.nextBipolar();
    brown = (brown + 0.05 * white) / 1.05;

    // Sweeping LPF cutoff: 80Hz -> 850Hz -> 60Hz
    const cutoff = 80 + 770 * Math.sin(Math.PI * progress);
    lpf.updateLowpass(cutoff, 1.8);
    const filteredNoise = lpf.process(brown);

    // Sub-bass sweep: 150Hz -> 45Hz
    const freqSub = 150 * Math.pow(45 / 150, progress);
    phaseSub += (2 * Math.PI * freqSub) / SAMPLE_RATE;
    const sub = Math.sin(phaseSub);

    // Master envelope
    const env = Math.sin(Math.PI * Math.pow(progress, 0.8));
    samples[i] = (filteredNoise * 0.65 + sub * 0.35) * env;
  }

  normalizeToPeak(samples, -2.0);
  return samples;
}

// 2. transition-whoosh-fast.wav
export function synthTransitionWhooshFast(): Float64Array {
  const duration = 0.25;
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);
  const rng = new DeterministicPRNG(2002);
  const bpf = BiquadFilter.createBandpass(600, 2.2);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Fast swept center frequency: 400Hz -> 3400Hz -> 300Hz
    const centerFreq = 400 + 3000 * Math.sin(Math.PI * progress);
    bpf.updateBandpass(centerFreq, 2.0);

    const noise = rng.nextBipolar();
    const filtered = bpf.process(noise);

    // Fast attack (35%), exponential release
    const attack = Math.min(1.0, progress / 0.35);
    const release = Math.exp(-Math.max(0, (progress - 0.35) * 6));
    const env = attack * release;

    samples[i] = filtered * env;
  }

  normalizeToPeak(samples, -2.5);
  return samples;
}

// 3. sound-riser.wav
export function synthSoundRiser(): Float64Array {
  const duration = 1.20;
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);
  const rng = new DeterministicPRNG(3003);
  const hpf = BiquadFilter.createHighpass(300, 1.2);

  let phase1 = 0;
  let phase2 = 0;
  let lfoPhase = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Dual-harmonic exponential frequency sweep: 110Hz -> 1320Hz and 220Hz -> 2640Hz
    const freq1 = 110 * Math.pow(1320 / 110, progress);
    phase1 += (2 * Math.PI * freq1) / SAMPLE_RATE;

    const freq2 = 220 * Math.pow(2640 / 220, progress);
    phase2 += (2 * Math.PI * freq2) / SAMPLE_RATE;

    // Tension LFO tremolo accelerates from 4Hz to 16Hz
    const lfoFreq = 4 + 12 * Math.pow(progress, 2);
    lfoPhase += (2 * Math.PI * lfoFreq) / SAMPLE_RATE;
    const tremolo = 1.0 - 0.25 * progress * (0.5 + 0.5 * Math.sin(lfoPhase));

    // Swept highpass noise: 300Hz -> 4200Hz
    const hpfCutoff = 300 * Math.pow(4200 / 300, progress);
    hpf.updateHighpass(hpfCutoff, 1.2);
    const noise = hpf.process(rng.nextBipolar()) * 0.4;

    const osc = (Math.sin(phase1) + 0.3 * Math.sin(phase2)) * tremolo;

    // Amplitude swell with clean terminal cut
    const cut = t > (duration - 0.04) ? (duration - t) / 0.04 : 1.0;
    const env = (0.05 + 0.95 * Math.pow(progress, 1.8)) * cut;

    samples[i] = (osc * 0.7 + noise * 0.3) * env;
  }

  normalizeToPeak(samples, -2.0);
  return samples;
}

// 4. sub-bass-drop.wav
export function synthSubBassDrop(): Float64Array {
  const duration = 0.85;
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);
  const rng = new DeterministicPRNG(4004);
  const bpf = BiquadFilter.createBandpass(1400, 3.0);

  let phase = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Exponential sub-bass drop: 120Hz -> 52Hz in 40ms, then slides to 42Hz
    let freq: number;
    if (t < 0.04) {
      freq = 120 - (120 - 52) * (t / 0.04);
    } else {
      freq = 52 - 10 * ((t - 0.04) / (duration - 0.04));
    }
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;

    const rawSine = Math.sin(phase);
    const sub = Math.tanh(1.35 * rawSine); // Warm harmonic saturation

    // Transient attack click
    let click = 0;
    if (t < 0.005) {
      const clickEnv = 1 - t / 0.005;
      click = bpf.process(rng.nextBipolar()) * clickEnv * 0.8;
    }

    const attack = Math.min(1.0, t / 0.003);
    const decay = Math.exp(-t / 0.28);
    const env = attack * decay;

    samples[i] = (sub * 0.85 + click * 0.15) * env;
  }

  normalizeToPeak(samples, -1.5);
  return samples;
}

// 5. click-switch.wav
export function synthClickSwitch(): Float64Array {
  const duration = 0.065;
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);
  const rng = new DeterministicPRNG(5005);

  const bpfPre = BiquadFilter.createBandpass(2200, 3.5);
  const bpfSnap1 = BiquadFilter.createBandpass(1650, 5.0);
  const bpfSnap2 = BiquadFilter.createBandpass(3800, 6.0);

  let phaseThud = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Pre-contact leaf bounce (0 to 4ms)
    let preContact = 0;
    if (t < 0.004) {
      const imp = rng.nextBipolar() * Math.exp(-t / 0.001);
      preContact = bpfPre.process(imp) * 0.35;
    }

    // Main mechanical latch snap at 8ms
    let mainSnap = 0;
    if (t >= 0.008) {
      const elapsed = t - 0.008;
      const imp = rng.nextBipolar() * Math.exp(-elapsed / 0.0015);
      const res1 = bpfSnap1.process(imp);
      const res2 = bpfSnap2.process(imp);
      mainSnap = (res1 * 0.6 + res2 * 0.4) * Math.exp(-elapsed / 0.012);
    }

    // Housing body thud
    phaseThud += (2 * Math.PI * 260) / SAMPLE_RATE;
    const thud = Math.sin(phaseThud) * Math.exp(-t / 0.015) * 0.25;

    samples[i] = preContact + mainSnap + thud;
  }

  normalizeToPeak(samples, -3.0);
  return samples;
}

// 6. click-soft.wav
export function synthClickSoft(): Float64Array {
  const duration = 0.035;
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);
  const lpf = BiquadFilter.createLowpass(2600, 1.0);

  let phase = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;

    // Ergonomic micro-chirp: 1400Hz -> 750Hz
    const freq = 1400 * Math.pow(750 / 1400, Math.min(1.0, progress * 2.5));
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;

    const sine = Math.sin(phase);

    const attack = Math.min(1.0, t / 0.002);
    const decay = Math.exp(-t / 0.007);
    const env = attack * decay;

    samples[i] = lpf.process(sine * env);
  }

  normalizeToPeak(samples, -4.0);
  return samples;
}

// Keystroke helper
function synthMechanicalKeystroke(
  seed: number,
  fundamentalFreq: number,
  harmonicFreq: number,
  thudFreq: number,
  duration: number,
  decayRate: number
): Float64Array {
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);
  const rng = new DeterministicPRNG(seed);

  const hpfNoise = BiquadFilter.createHighpass(2400, 1.0);
  const bpfRes1 = BiquadFilter.createBandpass(fundamentalFreq, 4.5);
  const bpfRes2 = BiquadFilter.createBandpass(harmonicFreq, 5.0);

  let phaseThud = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    const rawNoise = rng.nextBipolar();
    const click = hpfNoise.process(rawNoise) * Math.exp(-t / 0.002) * 0.6;
    const res1 = bpfRes1.process(rawNoise) * Math.exp(-t / decayRate);
    const res2 = bpfRes2.process(rawNoise) * Math.exp(-t / (decayRate * 0.7)) * 0.4;

    phaseThud += (2 * Math.PI * thudFreq) / SAMPLE_RATE;
    const thud = Math.sin(phaseThud) * Math.exp(-t / 0.016) * 0.35;

    samples[i] = click + res1 + res2 + thud;
  }

  normalizeToPeak(samples, -3.5);
  return samples;
}

// 7. mechanical-tap-1.wav
export function synthMechanicalTap1(): Float64Array {
  return synthMechanicalKeystroke(101, 420, 1850, 180, 0.050, 0.012);
}

// 8. mechanical-tap-2.wav
export function synthMechanicalTap2(): Float64Array {
  return synthMechanicalKeystroke(202, 380, 1620, 165, 0.050, 0.013);
}

// 9. mechanical-tap-3.wav
export function synthMechanicalTap3(): Float64Array {
  return synthMechanicalKeystroke(303, 330, 1380, 140, 0.055, 0.015);
}

// 10. mechanical-tap-4.wav
export function synthMechanicalTap4(): Float64Array {
  return synthMechanicalKeystroke(404, 460, 2150, 200, 0.048, 0.011);
}

// 11. pop-clean.wav
export function synthPopClean(): Float64Array {
  const duration = 0.090;
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);

  let phase = 0;
  let phaseHarmonic = 0;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;

    // Helmholtz resonator chirp
    const chirp = 340 + 740 * (t / 0.016) * Math.exp(-t / 0.016);
    phase += (2 * Math.PI * chirp) / SAMPLE_RATE;
    phaseHarmonic += (2 * Math.PI * chirp * 2.15) / SAMPLE_RATE;

    const fundamental = Math.sin(phase);
    const harmonic = Math.sin(phaseHarmonic) * 0.18;

    const attack = Math.min(1.0, t / 0.003);
    const decay = Math.exp(-t / 0.022);
    const env = attack * decay;

    samples[i] = (fundamental + harmonic) * env;
  }

  normalizeToPeak(samples, -2.5);
  return samples;
}

// 12. success-chime.wav
export function synthSuccessChime(): Float64Array {
  const duration = 0.700;
  const numSamples = Math.round(duration * SAMPLE_RATE);
  const samples = new Float64Array(numSamples);

  const notes = [
    { start: 0.000, freq: 1046.50, gain: 0.8 },
    { start: 0.055, freq: 1318.51, gain: 0.85 },
    { start: 0.110, freq: 1567.98, gain: 0.9 },
    { start: 0.170, freq: 2093.00, gain: 1.0 },
  ];

  const phases = notes.map(() => ({ p0: 0, p1: 0, p2: 0 }));

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let sum = 0;

    for (let n = 0; n < notes.length; n++) {
      const note = notes[n];
      if (t < note.start) continue;

      const elapsed = t - note.start;
      const ph = phases[n];

      ph.p0 += (2 * Math.PI * note.freq) / SAMPLE_RATE;
      ph.p1 += (2 * Math.PI * note.freq * 2.756) / SAMPLE_RATE;
      ph.p2 += (2 * Math.PI * note.freq * 5.404) / SAMPLE_RATE;

      const f0 = Math.sin(ph.p0) * Math.exp(-elapsed / 0.22);
      const f1 = Math.sin(ph.p1) * Math.exp(-elapsed / 0.12) * 0.22;
      const f2 = Math.sin(ph.p2) * Math.exp(-elapsed / 0.05) * 0.08;

      const attack = Math.min(1.0, elapsed / 0.002);
      sum += (f0 + f1 + f2) * attack * note.gain;
    }

    samples[i] = sum;
  }

  // Shimmer feedback tail
  const delaySamples1 = Math.floor(0.028 * SAMPLE_RATE);
  const delaySamples2 = Math.floor(0.043 * SAMPLE_RATE);
  const wet = new Float64Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    let w = samples[i];
    if (i >= delaySamples1) {
      w += wet[i - delaySamples1] * 0.18;
    }
    if (i >= delaySamples2) {
      w += wet[i - delaySamples2] * 0.12;
    }
    wet[i] = w;
  }

  normalizeToPeak(wet, -2.0);
  return wet;
}

/* ========================================================================= */
/* 5. GENERATOR REGISTRY & CLI ORCHESTRATOR                                  */
/* ========================================================================= */

export interface SfxSpec {
  filename: string;
  category: string;
  description: string;
  generator: () => Float64Array;
  targetPeakDbfs: number;
  expectedSha256: string;
}

export const SFX_REGISTRY: SfxSpec[] = [
  {
    filename: 'transition-whoosh-heavy.wav',
    category: 'Transition',
    description: 'Deep cinematic transition whoosh for scene changes',
    generator: synthTransitionWhooshHeavy,
    targetPeakDbfs: -2.0,
    expectedSha256: '949125b736e9f6fe454b3025e0ec51decf1416cb37f584602990e46709f4ddce',
  },
  {
    filename: 'transition-whoosh-fast.wav',
    category: 'Transition',
    description: 'Crisp, snappy whip whoosh for quick cuts and wipes',
    generator: synthTransitionWhooshFast,
    targetPeakDbfs: -2.5,
    expectedSha256: '020e5af222ed168c36e6bf8297776e0b4727ac0c96bed3b24d8e9c9af8c6392c',
  },
  {
    filename: 'sound-riser.wav',
    category: 'Stager',
    description: 'Exponential tension riser sweep building anticipation',
    generator: synthSoundRiser,
    targetPeakDbfs: -2.0,
    expectedSha256: '093f2d282e5cee7c69b04711383b7175c780e7315d8aba81c2d0d36ff630cc74',
  },
  {
    filename: 'sub-bass-drop.wav',
    category: 'Impact',
    description: 'Heavy 50Hz sub-bass impact boom on hero moments',
    generator: synthSubBassDrop,
    targetPeakDbfs: -1.5,
    expectedSha256: 'a203a95c5a6ea9cc0f1ba8b834757f0ae06b0ef6f76eb60950e2c02434f19237',
  },
  {
    filename: 'click-switch.wav',
    category: 'Interaction',
    description: 'Tactile mechanical toggle switch / state flip',
    generator: synthClickSwitch,
    targetPeakDbfs: -3.0,
    expectedSha256: 'd230a9c78370a1d48980bf80df57e1adb5752195a695325d48fe860e8deb976a',
  },
  {
    filename: 'click-soft.wav',
    category: 'Interaction',
    description: 'Ergonomic micro-click for subtle UI hover and taps',
    generator: synthClickSoft,
    targetPeakDbfs: -4.0,
    expectedSha256: 'f97b30616ff984d6bbd360d7273cbd262a6622b7c86816ec1ecd13b8c515266f',
  },
  {
    filename: 'mechanical-tap-1.wav',
    category: 'Keystroke',
    description: 'Tactile mechanical keystroke variant 1',
    generator: synthMechanicalTap1,
    targetPeakDbfs: -3.5,
    expectedSha256: '86a5d875c5db3dcbbfdcbb4e574d65f3b0df0a7eafd3df17c06eb82115b27d48',
  },
  {
    filename: 'mechanical-tap-2.wav',
    category: 'Keystroke',
    description: 'Tactile mechanical keystroke variant 2',
    generator: synthMechanicalTap2,
    targetPeakDbfs: -3.5,
    expectedSha256: 'fc8678bb3d511d1f275088608edb26969709e71ed3fb390d1c96d6fd6b213fb4',
  },
  {
    filename: 'mechanical-tap-3.wav',
    category: 'Keystroke',
    description: 'Tactile mechanical keystroke variant 3 (spacebar/return)',
    generator: synthMechanicalTap3,
    targetPeakDbfs: -3.5,
    expectedSha256: '650511a9882014e0729ff489fce571277592d345deaa8a1a718f0083f209f1f4',
  },
  {
    filename: 'mechanical-tap-4.wav',
    category: 'Keystroke',
    description: 'Tactile mechanical keystroke variant 4 (crisp high pitch)',
    generator: synthMechanicalTap4,
    targetPeakDbfs: -3.5,
    expectedSha256: '5d52bb1edc32213d96a0fb41ba5389778530829a13010a9158caac404d7da944',
  },
  {
    filename: 'pop-clean.wav',
    category: 'Feedback',
    description: 'Clean acoustic bubble pop for badges and toasts',
    generator: synthPopClean,
    targetPeakDbfs: -2.5,
    expectedSha256: '3a6148631e8414cb2246957a7ebb4d9b1c9ab3fdab2c1ba0e4c5e563d8b272b9',
  },
  {
    filename: 'success-chime.wav',
    category: 'Success',
    description: 'Major triad bell arpeggio celebration chime',
    generator: synthSuccessChime,
    targetPeakDbfs: -2.0,
    expectedSha256: '33f4008623467255991fca0194bc66c6bbca9e8e04585fce302825e14b62eaf5',
  },
];

export async function runSfxGeneration(options: { verifyOnly?: boolean; outDir?: string } = {}) {
  const targetDir = options.outDir ?? OUTPUT_DIR;
  const isVerify = options.verifyOnly ?? process.argv.includes('--verify');

  if (!isVerify && !fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`[SFX Synthesis] Mode: ${isVerify ? 'VERIFY' : 'GENERATE'} | Target: ${targetDir}`);
  console.log('='.repeat(80));

  let failureCount = 0;

  for (const item of SFX_REGISTRY) {
    const samples = item.generator();
    const metrics = computeMetrics(samples);
    const wavBuffer = encodeMonoWav(samples, SAMPLE_RATE);
    const generatedSha256 = crypto.createHash('sha256').update(wavBuffer).digest('hex');
    const filePath = path.join(targetDir, item.filename);

    if (isVerify) {
      if (!fs.existsSync(filePath)) {
        console.error(`❌ MISSING: ${item.filename} not found at ${filePath}`);
        failureCount++;
        continue;
      }
      const existingBuf = fs.readFileSync(filePath);
      const existingSha256 = crypto.createHash('sha256').update(existingBuf).digest('hex');
      if (existingSha256 !== item.expectedSha256) {
        console.error(`❌ MISMATCH: ${item.filename} SHA-256 does not match!`);
        console.error(`   Expected: ${item.expectedSha256}`);
        console.error(`   Actual:   ${existingSha256}`);
        failureCount++;
      } else {
        console.log(`✅ VERIFIED: ${item.filename} (SHA-256 match, peak: ${metrics.peakDbfs.toFixed(2)} dBFS)`);
      }
    } else {
      fs.writeFileSync(filePath, wavBuffer);
      console.log(
        `✅ GENERATED: ${item.filename.padEnd(28)} | ${(samples.length / SAMPLE_RATE).toFixed(3)}s | Peak: ${metrics.peakDbfs.toFixed(2)} dBFS | RMS: ${metrics.rmsDbfs.toFixed(2)} dBFS | SHA: ${generatedSha256.substring(0, 16)}...`
      );
    }
  }

  console.log('='.repeat(80));
  if (isVerify) {
    if (failureCount > 0) {
      console.error(`[SFX Synthesis] Verification FAILED with ${failureCount} errors.`);
      process.exit(1);
    } else {
      console.log('[SFX Synthesis] All 12 SFX verified 100% bit-perfect and CC0 compliant!');
    }
  } else {
    console.log('[SFX Synthesis] Successfully synthesized all 12 WAV assets into public/sfx/!');
  }
}

const isDirectRun =
  (typeof require !== 'undefined' && require.main === module) ||
  (Boolean(process.argv[1]) &&
    (process.argv[1].endsWith('generate-sfx.ts') || process.argv[1].endsWith('generate-sfx')));

if (isDirectRun) {
  runSfxGeneration().catch((err) => {
    console.error('[SFX Synthesis Fatal Error]:', err);
    process.exit(1);
  });
}
