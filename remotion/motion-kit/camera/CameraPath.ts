/**
 * CameraPath.ts
 * Deterministic multi-keyframe camera trajectory interpolation with easing.
 * Separates timeline kinematics from matrix transforms.
 */

import type { CameraKeyframe } from '../../../src/lib/scene-graph/types';

export interface CameraState {
  x: number; // normalized [0.0, 1.0]
  y: number; // normalized [0.0, 1.0]
  zoom: number; // 0.8 to 3.5
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
}

export type SupportedEasing =
  | 'linear'
  | 'ease-in-out'
  | 'spring'
  | 'cubic'
  | 'smooth';

/**
 * Pure mathematical evaluation of easing curves without external dependencies.
 */
export function evaluateEasing(
  t: number,
  type: SupportedEasing = 'ease-in-out'
): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (type) {
    case 'linear':
      return clamped;
    case 'cubic':
      // Out-cubic: 1 - (1 - t)^3
      return 1 - Math.pow(1 - clamped, 3);
    case 'spring': {
      // Damped harmonic overshoot mimicking natural spring physics
      const c4 = (2 * Math.PI) / 3;
      return clamped === 0
        ? 0
        : clamped === 1
        ? 1
        : Math.pow(2, -10 * clamped) * Math.sin((clamped * 10 - 0.75) * c4) + 1;
    }
    case 'smooth':
    case 'ease-in-out':
    default:
      // Smoothstep cubic ease-in-out
      return clamped < 0.5
        ? 4 * clamped * clamped * clamped
        : 1 - Math.pow(-2 * clamped + 2, 3) / 2;
  }
}

/**
 * Evaluates camera state deterministically for a given frame along a multi-keyframe track.
 */
export function evaluateCameraPath(
  track: CameraKeyframe[],
  frame: number
): CameraState {
  if (!track || track.length === 0) {
    return { x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0, rotateY: 0, rotateZ: 0 };
  }

  // Deterministic chronological ordering
  const sorted = [...track].sort((a, b) => a.frame - b.frame);

  if (frame <= sorted[0].frame) {
    const first = sorted[0];
    return {
      x: first.x,
      y: first.y,
      zoom: first.zoom,
      rotateX: first.rotateX ?? 0,
      rotateY: first.rotateY ?? 0,
      rotateZ: first.rotateZ ?? 0,
    };
  }

  const last = sorted[sorted.length - 1];
  if (frame >= last.frame) {
    return {
      x: last.x,
      y: last.y,
      zoom: last.zoom,
      rotateX: last.rotateX ?? 0,
      rotateY: last.rotateY ?? 0,
      rotateZ: last.rotateZ ?? 0,
    };
  }

  // Locate active segment [k1, k2] where k1.frame <= frame < k2.frame
  let k1 = sorted[0];
  let k2 = sorted[1];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (frame >= sorted[i].frame && frame <= sorted[i + 1].frame) {
      k1 = sorted[i];
      k2 = sorted[i + 1];
      break;
    }
  }

  const span = Math.max(1, k2.frame - k1.frame);
  const rawProgress = (frame - k1.frame) / span;
  const easingType = (k2.easing as SupportedEasing) ?? 'ease-in-out';
  const progress = evaluateEasing(rawProgress, easingType);

  const lerp = (a: number, b: number) => a + (b - a) * progress;

  return {
    x: lerp(k1.x, k2.x),
    y: lerp(k1.y, k2.y),
    zoom: lerp(k1.zoom, k2.zoom),
    rotateX: lerp(k1.rotateX ?? 0, k2.rotateX ?? 0),
    rotateY: lerp(k1.rotateY ?? 0, k2.rotateY ?? 0),
    rotateZ: lerp(k1.rotateZ ?? 0, k2.rotateZ ?? 0),
  };
}
