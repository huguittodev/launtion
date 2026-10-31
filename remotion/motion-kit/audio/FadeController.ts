/**
 * FadeController.ts
 * Deterministic mathematical fade curves and safe duration clamping.
 * Eliminates duplicate-key and non-monotonic range crashes in Remotion interpolation.
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

/**
 * Clamps requested fade durations proportionally so that fadeIn + fadeOut <= durationInFrames.
 * Invariant: clampedFadeIn + clampedFadeOut <= durationInFrames for any inputs.
 */
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

/**
 * Evaluates monotonic mathematical fade curve for progress p in [0.0, 1.0].
 */
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
      // Hermite polynomial 3p^2 - 2p^3 (zero derivatives at endpoints)
      return 3 * p * p - 2 * p * p * p;
    case 'exponential': {
      // Perceptual logarithmic fader curve: (e^(beta*p) - 1) / (e^beta - 1)
      const b = Math.max(0.1, beta);
      return (Math.exp(b * p) - 1) / (Math.exp(b) - 1);
    }
    default:
      return p;
  }
}

/**
 * Calculates the exact instantaneous fade gain for a given frame.
 */
export function calculateFadeGain(frame: number, config: FadeConfig): number {
  const D = Math.max(0, Math.floor(config.durationInFrames));
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
