/**
 * AudioMixer.ts
 * Master gain staging, dynamic sidechain ducking, and C^1-smooth soft-knee limiter.
 * Guarantees polyphonic master volume never exceeds 0.95 (-0.45 dBFS), preventing digital clipping.
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

/**
 * C^1-smooth soft-knee limiter.
 * Mathematical Invariants:
 * 1. For S <= kneeThreshold: L(S) = S, limitFactor = 1.0 (bit-perfect uncompressed transparency)
 * 2. C^1 continuity: d/dS L(S) at kneeThreshold is 1.0 (zero slope discontinuity)
 * 3. Asymptotically bounded: L(S) < headroomCeiling for all S in [0, infinity)
 */
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

/**
 * Calculates dynamic sidechain ducking factor for background music during SFX transients.
 */
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
      // Release ramp up with smoothstep
      const prog = (relFrame - holdEnd) / release;
      cueFactor = floor + (1.0 - floor) * (3 * prog * prog - 2 * prog * prog * prog);
    }

    if (cueFactor < minMultiplier) {
      minMultiplier = cueFactor;
    }
  }

  return Math.max(floor, Math.min(1.0, minMultiplier));
}
