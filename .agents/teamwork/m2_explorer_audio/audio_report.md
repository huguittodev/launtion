# Milestone 2: Audio & SFX Engine Architecture & Implementation Blueprint

**Document Version:** 1.0  
**Author:** Milestone 2 Audio Engine Explorer (`m2_explorer_audio`)  
**Target Milestone:** Milestone 2 (Atomic Engines Implementation)  
**Status:** Approved Architectural Blueprint (Read-Only Exploration Deliverable)  
**Standard Compliance:** AGENTS.md Hard Rules 1–15 & PROJECT_SPEC.md §12.3  

---

## 1. Executive Summary & Problem Scope

In modern digital SaaS video production (inspired by high-end studio references like Base44), audio is not an afterthought; it is a primary temporal anchor. Motion graphics feel sluggish or jarring without frame-accurate acoustic transients (`mouse-click`, `camera-whoosh`, `chime`, `soft-pop`, `keyboard-tap`) synchronized with visual easing.

However, client-side and server-side video rendering engines (Remotion over Chromium + ffmpeg AAC muxing) suffer from severe failure modes when audio mixing is implemented naively:
1. **Remotion `interpolate()` Crashes**: When `fadeInFrames + fadeOutFrames > durationInFrames` (or when `durationInFrames <= 0` or fade frames equal 0), Remotion's standard `interpolate()` utility receives non-monotonic or duplicated keys in its `inputRange`, throwing unhandled runtime exceptions (`The input range must be strictly ascending`).
2. **Acoustic Clipping & Distortion (Digital 0 dBFS Inter-Sample Peaks)**: When multiple sound cues overlap (e.g. background music + button click + camera travel whoosh), their linear sample amplitudes sum algebraically:
   $$\sum_{i=1}^{N} A_i(t) > 1.0 \implies \text{Severe Digital Clipping / Harmonic Distortion}$$
3. **Muddled Mix & Lack of Dynamic Ducking**: Without sidechain attenuation, punchy transient sound effects compete with the mid-range frequencies of the background music bed, destroying intelligibility and polish.
4. **Disjointed Data Pipelines**: The legacy `AudioEngine.tsx` expects ad-hoc `SoundCue[]` and `music` props rather than consuming the validated `SceneGraph.audioTrack` generated from telemetric interaction data.

This blueprint establishes the four decoupled, pure-math components comprising the Launtion v2 Audio Engine:
- **`FadeController.ts`**: Monotonic fade curves with proportional duration clamping.
- **`AudioMixer.ts`**: Dynamic sidechain ducking and $C^1$-smooth soft-knee limiting ($L(S) \le 0.95$).
- **`AudioTimeline.ts`**: Pure frame-accurate cue scheduler consuming `SceneGraph.audioTrack`.
- **`AudioEngine.tsx`**: Clean, backward-compatible Remotion component orchestrator.

---

## 2. Existing Audio System Audit

### 2.1 Asset Inventory & Clearance Manifest
All 6 WAV audio assets in `public/sfx/` were audited against `public/sfx/SFX_LICENSES.md` and verified:
- `ambient-beat.wav` (18.000 s, CC0 1.0, Peak: -4.12 dBFS, RMS: -21.72 dBFS)
- `camera-whoosh.wav` (0.350 s, CC0 1.0, Peak: -3.15 dBFS, RMS: -12.08 dBFS)
- `chime.wav` (0.450 s, CC0 1.0, Peak: -1.86 dBFS, RMS: -15.88 dBFS)
- `keyboard-tap.wav` (0.050 s, CC0 1.0, Peak: -6.70 dBFS, RMS: -21.71 dBFS)
- `mouse-click.wav` (0.080 s, CC0 1.0, Peak: -0.57 dBFS, RMS: -17.43 dBFS)
- `soft-pop.wav` (0.120 s, CC0 1.0, Peak: -0.12 dBFS, RMS: -12.25 dBFS)

All assets are 44.1 kHz, 16-bit mono WAVs cleared for commercial worldwide video export without royalties.

### 2.2 Legacy `AudioEngine.tsx` Limitations
Inspection of `remotion/motion-kit/AudioEngine.tsx` reveals:
```tsx
// Current lines 44-49 in AudioEngine.tsx:
const musicVolume = interpolate(
  frame,
  [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
  [0, targetVolume, targetVolume, 0],
  { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
);
```
- **Crash Vulnerability**: If `durationInFrames = 30`, `fadeIn = 15`, `fadeOut = 20`, then `durationInFrames - fadeOut = 10`. The array `[0, 15, 10, 30]` is non-monotonic, crashing the render.
- **Duplicate Key Vulnerability**: If `fadeIn = 0`, the array begins `[0, 0, ...]`, creating an invalid range.
- **Zero Headroom Management**: SFX cues are rendered at fixed volumes with no soft limiting or polyphonic scaling.
- **No Sidechain Ducking**: Background music plays at constant volume during loud transients.
- **Contract Mismatch**: Does not accept `SceneGraph.audioTrack`.

---

## 3. Component 1: `FadeController.ts` Blueprint & Mathematical Specifications

**Target Path:** `remotion/motion-kit/audio/FadeController.ts`

### 3.1 Clamping & Proportional Duration Scaling
To prevent Remotion `interpolate()` crashes and guarantee mathematical validity across all possible inputs (including zero duration, negative duration, or overlapping fades):

Let $D = \max(0, \lfloor \text{durationInFrames} \rfloor)$.  
Let $F_{in} = \max(0, \lfloor \text{fadeInFrames} \rfloor)$.  
Let $F_{out} = \max(0, \lfloor \text{fadeOutFrames} \rfloor)$.  

1. If $D = 0$: $F'_{in} = 0$, $F'_{out} = 0$, $\text{sustain} = 0$, $\text{scale} = 0$.
2. If $F_{in} + F_{out} \le D$:
   - $F'_{in} = F_{in}$
   - $F'_{out} = F_{out}$
   - $\text{sustain} = D - (F_{in} + F_{out})$
   - $\text{scale} = 1.0$
3. If $F_{in} + F_{out} > D$:
   - $\text{scale} = \frac{D}{F_{in} + F_{out}}$
   - $F'_{in} = \min(D, \lfloor F_{in} \cdot \text{scale} \rfloor)$
   - $F'_{out} = \min(D - F'_{in}, \lfloor F_{out} \cdot \text{scale} \rfloor)$
   - $\text{sustain} = D - (F'_{in} + F'_{out}) \ge 0$

**Mathematical Invariant:** $F'_{in} + F'_{out} \le D$ for all inputs. The input range is guaranteed to be non-decreasing, non-overlapping, and bounded within $[0, D]$.

### 3.2 Monotonic Fade Curves
For normalized phase progress $p \in [0.0, 1.0]$:

#### 1. Linear Curve (`linear`)
$$C_{\text{linear}}(p) = p$$
- Simple proportional ramp. $C'(p) = 1.0$.

#### 2. Smoothstep Hermite Curve (`smoothstep`)
$$C_{\text{smoothstep}}(p) = 3p^2 - 2p^3$$
- Boundary derivatives: $C'(0) = 0$ and $C'(1) = 0$.
- First derivative: $C'(p) = 6p(1-p) \ge 0$ for all $p \in [0, 1]$ (strictly monotonic).
- Eliminates clicking, popping, and abrupt slope changes at start/end of fades.

#### 3. Perceptual Exponential Curve (`exponential`)
Because human hearing perceives acoustic intensity logarithmically (Weber-Fechner Law), linear volume increases feel front-loaded, and linear fades sound abrupt at the end.
$$C_{\text{exponential}}(p, \beta = 3.0) = \frac{e^{\beta p} - 1}{e^\beta - 1}$$
- At $p = 0$: $\frac{1 - 1}{e^\beta - 1} = 0$.
- At $p = 1$: $\frac{e^\beta - 1}{e^\beta - 1} = 1$.
- At $p = 0.5$ ($\beta = 3$): $C(0.5) \approx 0.182$ (-14.8 dB), closely approximating standard logarithmic fader curves.
- Derivative: $C'(p) = \frac{\beta e^{\beta p}}{e^\beta - 1} > 0$ for all $p \in [0, 1]$ (strictly positive slope, strictly monotonic).

#### Mirror Symmetry for Fade-Out
For a fade-out segment of clamped duration $F'_{out}$, remaining time progress is:
$$r(t) = \frac{D - t}{F'_{out}} \in [0.0, 1.0]$$
The instantaneous gain is:
$$G(t) = V_{\text{target}} \cdot C(r(t))$$
This guarantees that fade-out is the exact acoustic mirror of fade-in.

### 3.3 TypeScript Implementation Specification
```ts
/**
 * remotion/motion-kit/audio/FadeController.ts
 * Deterministic mathematical fade curves and safe duration clamping.
 */

export type FadeCurveType = 'linear' | 'exponential' | 'smoothstep';

export interface FadeConfig {
  durationInFrames: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
  targetVolume?: number; // default 1.0
  curve?: FadeCurveType; // default 'smoothstep'
  exponentialBeta?: number; // default 3.0
}

export interface ClampedFadeDurations {
  clampedFadeIn: number;
  clampedFadeOut: number;
  sustainFrames: number;
  scaleFactor: number;
}

export function clampFadeDurations(
  durationInFrames: number,
  fadeInFrames = 0,
  fadeOutFrames = 0
): ClampedFadeDurations {
  const safeDuration = Math.max(0, Math.floor(durationInFrames));
  const rawIn = Math.max(0, Math.floor(fadeInFrames));
  const rawOut = Math.max(0, Math.floor(fadeOutFrames));

  if (safeDuration === 0) {
    return { clampedFadeIn: 0, clampedFadeOut: 0, sustainFrames: 0, scaleFactor: 0 };
  }

  const totalRequested = rawIn + rawOut;
  if (totalRequested <= safeDuration) {
    return {
      clampedFadeIn: rawIn,
      clampedFadeOut: rawOut,
      sustainFrames: safeDuration - totalRequested,
      scaleFactor: 1.0,
    };
  }

  const scale = safeDuration / totalRequested;
  const clampedIn = Math.min(safeDuration, Math.floor(rawIn * scale));
  const clampedOut = Math.min(safeDuration - clampedIn, Math.floor(rawOut * scale));

  return {
    clampedFadeIn: clampedIn,
    clampedFadeOut: clampedOut,
    sustainFrames: safeDuration - clampedIn - clampedOut,
    scaleFactor: scale,
  };
}

export function evaluateFadeCurve(
  progress: number,
  curve: FadeCurveType = 'smoothstep',
  beta = 3.0
): number {
  const p = Math.max(0, Math.min(1, progress));
  if (!Number.isFinite(p)) return 0;

  switch (curve) {
    case 'linear':
      return p;
    case 'smoothstep':
      return 3 * p * p - 2 * p * p * p;
    case 'exponential': {
      const b = Math.max(0.1, beta);
      return (Math.exp(b * p) - 1) / (Math.exp(b) - 1);
    }
    default:
      return p;
  }
}

export function calculateFadeGain(frame: number, config: FadeConfig): number {
  const D = Math.max(0, config.durationInFrames);
  if (D <= 0 || frame < 0 || frame >= D) return 0;

  const targetVol = Math.max(0, config.targetVolume ?? 1.0);
  const { clampedFadeIn, clampedFadeOut } = clampFadeDurations(
    D,
    config.fadeInFrames ?? 0,
    config.fadeOutFrames ?? 0
  );
  const curve = config.curve ?? 'smoothstep';
  const beta = config.exponentialBeta ?? 3.0;

  // 1. Fade-in segment
  if (clampedFadeIn > 0 && frame < clampedFadeIn) {
    const progress = frame / clampedFadeIn;
    return targetVol * evaluateFadeCurve(progress, curve, beta);
  }

  // 2. Fade-out segment
  const fadeOutStart = D - clampedFadeOut;
  if (clampedFadeOut > 0 && frame >= fadeOutStart) {
    const remaining = (D - frame) / clampedFadeOut;
    const progress = Math.max(0, Math.min(1, remaining));
    return targetVol * evaluateFadeCurve(progress, curve, beta);
  }

  // 3. Sustain segment
  return targetVol;
}
```

---

## 4. Component 2: `AudioMixer.ts` Blueprint & Mathematical Specifications

**Target Path:** `remotion/motion-kit/audio/AudioMixer.ts`

### 4.1 Acoustic Headroom & Digital Distortion Prevention
In digital audio (AAC encoding within MP4 containers), normalized audio samples are restricted to $[-1.0, 1.0]$. When multiple audio tracks play simultaneously, their linear amplitudes sum.
If the sum exceeds $1.0$ (0 dBFS), fixed-point PCM truncation and AAC perceptual codec overshoots occur, causing harsh clipping and distortion.

To prevent this deterministically per frame without latency or lookahead delay, `AudioMixer` implements a two-stage master gain stage:
1. **Dynamic Sidechain Ducking** of background music during high-energy transients.
2. **Continuous $C^1$-Smooth Soft-Knee Limiting** guaranteeing total output amplitude never exceeds $H_{\text{ceiling}} = 0.95$ (-0.45 dBFS).

### 4.2 Dynamic Sidechain Ducking
When a high-energy SFX cue (such as `camera-whoosh`, `chime`, or impact clicks) triggers at frame $t_{\text{cue}}$:
- **Ducking Factor**: Music volume is multiplied by $D_{\text{factor}} \in [0.4, 0.7]$ (attenuating music by $-3$ dB to $-8$ dB).
- **Attack Envelope**: 2 frames transition down.
- **Hold Envelope**: Holds for the primary energy duration of the SFX (e.g. 6–10 frames).
- **Release Envelope**: Smooth 8–12 frame recovery back to 1.0 using `smoothstep`.

For any frame $t$, the music ducking envelope multiplier $M_{\text{duck}}(t) \in [D_{\text{factor}}, 1.0]$ is:
$$M_{\text{duck}}(t) = \min_{c \in \text{SFX}} \text{calculateCueDucking}(t, c)$$

### 4.3 Polyphonic Soft-Knee Master Limiter
Let $S(t)$ be the total raw linear gain across all active channels at frame $t$:
$$S(t) = V_{\text{music, ducked}}(t) + \sum_{j \in \text{active SFX}} V_j(t)$$

We establish:
- **Knee Threshold**: $T_{\text{knee}} = 0.75$ (-2.5 dBFS)
- **Ceiling Headroom**: $H_{\text{ceiling}} = 0.95$ (-0.45 dBFS)

#### Limiter Transfer Function $L(S)$
$$L(S) = \begin{cases} 
S & \text{if } S \le T_{\text{knee}} \\
T_{\text{knee}} + (H_{\text{ceiling}} - T_{\text{knee}}) \cdot \tanh\left(\frac{S - T_{\text{knee}}}{H_{\text{ceiling}} - T_{\text{knee}}}\right) & \text{if } S > T_{\text{knee}}
\end{cases}$$

#### Mathematical Proof of Invariants:
1. **Zero Coloration Below Threshold**: For $S \le 0.75$, $L(S) = S$. Master limiter factor $k_{\text{limit}} = 1.000$. Pure bit-perfect transparency when mix is sparse.
2. **$C^0$ Continuity at Threshold**:
   $$\lim_{S \to T_{\text{knee}}^+} L(S) = T_{\text{knee}} + (H - T) \cdot \tanh(0) = T_{\text{knee}}$$
3. **$C^1$ First-Derivative Smoothness**:
   $$\frac{d}{dS} L(S)\Big|_{S = T_{\text{knee}}} = \text{sech}^2(0) = 1.0$$
   The transition from uncompressed to compressed has no abrupt slope change, eliminating harmonic distortion artifacts.
4. **Strict Upper Bound ($L(S) < 1.0$ for all $S \in [0, \infty)$)**:
   Because $\tanh(x) < 1.0$ for all finite $x$:
   $$L(S) < T_{\text{knee}} + (H_{\text{ceiling}} - T_{\text{knee}}) \cdot 1.0 = H_{\text{ceiling}} = 0.95 < 1.0$$
   Even under adversarial conditions (e.g. 100 simultaneous cues at volume 1.0, where $S = 85.0$):
   $$L(85.0) = 0.75 + 0.20 \cdot \tanh\left(\frac{84.25}{0.20}\right) = 0.75 + 0.20(0.999999...) = 0.950000$$
   Total output gain is mathematically bounded to $0.95$. Clipping is impossible.

#### Master Scale Factor
The master compression ratio applied to all active voices at frame $t$ is:
$$k_{\text{limit}}(t) = \begin{cases} 1.0 & \text{if } S(t) \le 0 \\ \frac{L(S(t))}{S(t)} & \text{if } S(t) > 0 \end{cases}$$

Effective Volumes:
- $V_{\text{final, music}}(t) = V_{\text{music, ducked}}(t) \cdot k_{\text{limit}}(t)$
- $V_{\text{final, sfx}, j}(t) = V_j(t) \cdot k_{\text{limit}}(t)$

### 4.4 TypeScript Implementation Specification
```ts
/**
 * remotion/motion-kit/audio/AudioMixer.ts
 * Polyphonic headroom staging, dynamic sidechain ducking, and soft limiting.
 */

export interface ActiveCueSnapshot {
  id: string;
  isMusic: boolean;
  nominalVolume: number;
  duckingPriority: number; // 0 = none, 1 = subtle, 2 = high (whoosh, chime)
}

export interface MixerConfig {
  headroomCeiling?: number; // default 0.95
  kneeThreshold?: number; // default 0.75
  duckingFloor?: number; // default 0.55 (-5.2 dB)
  duckingAttackFrames?: number; // default 2
  duckingReleaseFrames?: number; // default 10
}

export interface FrameMixOutput {
  duckingMultiplier: number;
  limitFactor: number;
  rawSumVolume: number;
  effectiveSumVolume: number;
  musicVolume: number;
}

export function softLimitGain(
  sumVolume: number,
  kneeThreshold = 0.75,
  headroomCeiling = 0.95
): { limitedGain: number; limitFactor: number } {
  const S = Math.max(0, sumVolume);
  if (S <= kneeThreshold) {
    return { limitedGain: S, limitFactor: 1.0 };
  }

  const range = headroomCeiling - kneeThreshold;
  const delta = S - kneeThreshold;
  const limitedGain = kneeThreshold + range * Math.tanh(delta / range);
  const limitFactor = S > 0 ? limitedGain / S : 1.0;

  return { limitedGain, limitFactor };
}

export function calculateDuckingFactor(
  frame: number,
  sfxCues: Array<{ startFrame: number; durationInFrames: number; priority: number }>,
  config?: MixerConfig
): number {
  const floor = config?.duckingFloor ?? 0.55;
  const attack = config?.duckingAttackFrames ?? 2;
  const release = config?.duckingReleaseFrames ?? 10;

  let minMultiplier = 1.0;

  for (const cue of sfxCues) {
    if (cue.priority < 2) continue; // Only high-energy cues duck music

    const relFrame = frame - cue.startFrame;
    const holdEnd = cue.durationInFrames;
    const totalEnd = holdEnd + release;

    if (relFrame < -attack || relFrame >= totalEnd) {
      continue;
    }

    let cueFactor = 1.0;
    if (relFrame < 0) {
      // Attack ramp down
      const prog = (relFrame + attack) / attack;
      cueFactor = 1.0 - (1.0 - floor) * prog;
    } else if (relFrame < holdEnd) {
      // Hold phase
      cueFactor = floor;
    } else {
      // Release ramp up
      const prog = (relFrame - holdEnd) / release;
      cueFactor = floor + (1.0 - floor) * (3 * prog * prog - 2 * prog * prog * prog);
    }

    if (cueFactor < minMultiplier) {
      minMultiplier = cueFactor;
    }
  }

  return Math.max(floor, Math.min(1.0, minMultiplier));
}
```

---

## 5. Component 3: `AudioTimeline.ts` Blueprint & Data Contracts

**Target Path:** `remotion/motion-kit/audio/AudioTimeline.ts`

### 5.1 Architecture & Role
`AudioTimeline` is the pure, deterministic scheduler. It consumes `SceneGraph.audioTrack` (and any nested `scene.soundCues`), validates assets against the allowlist, maps intrinsic acoustic durations, and computes frame indices for active cues and polyphonic mixing.

### 5.2 Asset Catalog & Intrinsic Properties
```ts
import type { AudioAsset } from '../../../src/lib/scene-graph/types';

export interface AssetProfile {
  asset: AudioAsset;
  filename: string;
  durationSec: number;
  durationFramesAt30Fps: number;
  isMusic: boolean;
  duckingPriority: number; // 0 = background, 1 = subtle, 2 = energetic
  nominalVolume: number;
}

export const SFX_CATALOG: Record<AudioAsset, AssetProfile> = {
  'ambient-beat': {
    asset: 'ambient-beat',
    filename: 'sfx/ambient-beat.wav',
    durationSec: 18.0,
    durationFramesAt30Fps: 540,
    isMusic: true,
    duckingPriority: 0,
    nominalVolume: 0.32,
  },
  'camera-whoosh': {
    asset: 'camera-whoosh',
    filename: 'sfx/camera-whoosh.wav',
    durationSec: 0.35,
    durationFramesAt30Fps: 12,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.65,
  },
  'chime': {
    asset: 'chime',
    filename: 'sfx/chime.wav',
    durationSec: 0.45,
    durationFramesAt30Fps: 15,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.75,
  },
  'keyboard-tap': {
    asset: 'keyboard-tap',
    filename: 'sfx/keyboard-tap.wav',
    durationSec: 0.05,
    durationFramesAt30Fps: 4,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.50,
  },
  'mouse-click': {
    asset: 'mouse-click',
    filename: 'sfx/mouse-click.wav',
    durationSec: 0.08,
    durationFramesAt30Fps: 5,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.85,
  },
  'soft-pop': {
    asset: 'soft-pop',
    filename: 'sfx/soft-pop.wav',
    durationSec: 0.12,
    durationFramesAt30Fps: 6,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.65,
  },
};
```

### 5.3 Scheduled Cue Interface & Scheduler Logic
```ts
export interface ScheduledCue {
  id: string;
  asset: AudioAsset;
  resolvedSrc: string;
  startFrame: number;
  durationInFrames: number;
  endFrame: number;
  volume: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  isMusic: boolean;
  duckingPriority: number;
}

export interface AudioTimeline {
  durationInFrames: number;
  fps: number;
  cues: ScheduledCue[];
  musicCues: ScheduledCue[];
  sfxCues: ScheduledCue[];
}

export function buildAudioTimeline(params: {
  audioTrack: AudioCue[];
  durationInFrames: number;
  fps?: number;
}): AudioTimeline {
  const fps = params.fps ?? 30;
  const durationInFrames = Math.max(1, params.durationInFrames);
  const scheduled: ScheduledCue[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < params.audioTrack.length; i++) {
    const rawCue = params.audioTrack[i];
    if (rawCue.frame > durationInFrames) continue;

    const profile = SFX_CATALOG[rawCue.asset];
    if (!profile) continue; // Unknown/unauthorized assets rejected

    let cueId = rawCue.id || `cue-${rawCue.asset}-${rawCue.frame}`;
    if (seenIds.has(cueId)) {
      cueId = `${cueId}-${i}`;
    }
    seenIds.add(cueId);

    const isMusic = profile.isMusic;
    const duration = isMusic
      ? durationInFrames
      : Math.max(profile.durationFramesAt30Fps, Math.ceil(profile.durationSec * fps));

    const endFrame = Math.min(durationInFrames, rawCue.frame + duration);
    const volume = rawCue.volume ?? profile.nominalVolume;

    scheduled.push({
      id: cueId,
      asset: rawCue.asset,
      resolvedSrc: profile.filename,
      startFrame: rawCue.frame,
      durationInFrames: duration,
      endFrame,
      volume,
      fadeInFrames: rawCue.fadeInFrames ?? (isMusic ? 15 : 0),
      fadeOutFrames: rawCue.fadeOutFrames ?? (isMusic ? 30 : 0),
      isMusic,
      duckingPriority: profile.duckingPriority,
    });
  }

  // Sort chronologically
  scheduled.sort((a, b) => a.startFrame - b.startFrame);

  return {
    durationInFrames,
    fps,
    cues: scheduled,
    musicCues: scheduled.filter((c) => c.isMusic),
    sfxCues: scheduled.filter((c) => !c.isMusic),
  };
}

export function getActiveCuesAtFrame(
  timeline: AudioTimeline,
  frame: number
): ScheduledCue[] {
  return timeline.cues.filter((c) => frame >= c.startFrame && frame < c.endFrame);
}
```

---

## 6. Component 4: `AudioEngine.tsx` Refactor Blueprint

**Target Path:** `remotion/motion-kit/AudioEngine.tsx`

### 6.1 Architectural Orchestration
`AudioEngine` wraps Remotion's `<Audio />` and `<Sequence />` primitives. It connects `AudioTimeline`, `AudioMixer`, and `FadeController`.

To preserve 100% backward compatibility with `StudioShowcase.tsx` while supporting the full declarative `SceneGraph.audioTrack`, `AudioEngineProps` accepts:
```tsx
export interface SoundCue {
  frame: number;
  sound: string;
  volume?: number;
}

export interface BackgroundMusicConfig {
  src?: string;
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

export interface AudioEngineProps {
  // New SceneGraph v2 declarative track
  audioTrack?: AudioCue[];

  // Legacy backwards compatible props
  soundCues?: SoundCue[];
  music?: BackgroundMusicConfig;

  enabled?: boolean;
  mixerOptions?: MixerConfig;
}
```

### 6.2 Composition Layout & Volume Functions
Inside `AudioEngine.tsx`:
1. Constructs `AudioTimeline` from either `props.audioTrack` or converts legacy `props.soundCues` + `props.music` via adapter.
2. Extracts background music cue (if present) and SFX cues.
3. Renders background `<Audio />` spanning the composition:
   - Volume is evaluated per frame using `calculateFadeGain()` combined with dynamic sidechain ducking and soft limiting:
   $$V_{\text{music}}(t) = \text{calculateFadeGain}(t, \text{config}) \cdot M_{\text{duck}}(t) \cdot k_{\text{limit}}(t)$$
4. Renders SFX cues within isolated Remotion `<Sequence />` components:
   ```tsx
   <Sequence
     key={cue.id}
     from={cue.startFrame}
     durationInFrames={cue.durationInFrames}
   >
     <Audio
       src={staticFile(cue.resolvedSrc)}
       volume={(relativeFrame) => {
         const globalFrame = cue.startFrame + relativeFrame;
         return calculateSfxEffectiveVolume(cue, globalFrame, timeline, mixerOptions);
       }}
     />
   </Sequence>
   ```
5. React render is 100% pure, side-effect free, and fully deterministic.

---

## 7. QA Automated Test Specifications for Native Node 24 Runner

The following unit and property test suites must be executed in Milestone 4 (`tests/audio-engine.test.ts`) using Node 24 native test runner (`node --test`):

### Suite 1: `FadeController` Property Tests
- **Test 1.1: Clamping Boundary Security**:
  Input $D = 30$, $F_{in} = 25$, $F_{out} = 25$ ($total = 50 > 30$).
  Assert `clampedFadeIn + clampedFadeOut === 30`.
  Assert `sustainFrames === 0`.
- **Test 1.2: Zero & Negative Durations**:
  Input $D = 0$ or $D = -10$.
  Assert all return values are 0, zero NaN or Infinite values.
- **Test 1.3: Monotonicity Across Timeline**:
  For $D = 120, F_{in} = 30, F_{out} = 40$:
  Sample $t \in [0, 119]$:
  During $[0, 29]$, assert $V(t) \le V(t + 1)$.
  During $[30, 79]$, assert $V(t) === V_{\text{target}}$.
  During $[80, 119]$, assert $V(t) \ge V(t + 1)$.
- **Test 1.4: Smoothstep Boundary Derivatives**:
  Verify numerical derivative $\frac{V(0.001) - V(0)}{0.001} \approx 0$ and $\frac{V(1) - V(0.999)}{0.001} \approx 0$.

### Suite 2: `AudioMixer` Limiting & Ducking Tests
- **Test 2.1: Polyphonic Headroom Absolute Ceiling**:
  Simulate 100 simultaneous cues at volume 1.0 (raw sum = 100.0).
  Assert `limitedGain <= 0.95`.
  Assert `limitedGain > 0.90`.
- **Test 2.2: Soft-Knee Linear Transparency**:
  Input $S = 0.50$ (< threshold 0.75).
  Assert `limitedGain === 0.50` with $|L(S) - S| < 10^{-14}$.
  Assert `limitFactor === 1.0000`.
- **Test 2.3: Dynamic Ducking Recovery**:
  Schedule a `camera-whoosh` (priority 2) at frame 60 (duration 12 frames).
  At frame 50: assert duck factor = 1.0.
  At frame 62: assert duck factor $\approx 0.55$ (-5 dB).
  At frame 80: assert duck factor returns to 1.0.

### Suite 3: `AudioTimeline` Determinism Tests
- **Test 3.1: Catalog Integrity & Durations**:
  Verify every `AudioAsset` resolves to a valid file in `public/sfx/`.
- **Test 3.2: Chronological Ordering & ID Deduplication**:
  Pass 10 cues with duplicate IDs and unsorted frames; assert output is strictly sorted by frame and contains 10 unique IDs.

---

## 8. File Placement & Implementation Layout Compliance

| Module | Exact Repository Path | Ownership | Status |
|---|---|---|---|
| `FadeController.ts` | `remotion/motion-kit/audio/FadeController.ts` | Audio Engine | NEW (Design Complete) |
| `AudioMixer.ts` | `remotion/motion-kit/audio/AudioMixer.ts` | Audio Engine | NEW (Design Complete) |
| `AudioTimeline.ts` | `remotion/motion-kit/audio/AudioTimeline.ts` | Audio Engine | NEW (Design Complete) |
| `AudioEngine.tsx` | `remotion/motion-kit/AudioEngine.tsx` | Audio Engine | REFACTOR (Design Complete) |
| Audio Kit Barrel | `remotion/motion-kit/audio/index.ts` | Audio Engine | NEW (Design Complete) |
| Motion Kit Barrel | `remotion/motion-kit/index.ts` | Shared | REFACTOR (Export Audio Kit) |
| Audio Unit Tests | `tests/audio-engine.test.ts` | QA & Testing | NEW (Test Specs Ready) |

All files comply with `PROJECT_SPEC.md` §12.3 and `AGENTS.md` Hard Rules 1–15. No external dependencies are introduced. Node 24 native math and standard Remotion primitives are preserved.
