/**
 * BezierPath.ts
 * Pure mathematical functions for quadratic and cubic Bezier curve interpolation,
 * separating spatial arc geometry from temporal velocity kinematics.
 * Zero external runtime dependencies; 100% testable in pure Node.js.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface CursorKeyframeLike {
  frame: number;
  x: number;
  y: number;
  controlX?: number;
  controlY?: number;
  click?: boolean;
}

export type EasingFn = (t: number) => number;

/* ========================================================================= */
/* Pure Temporal Easing Functions                                            */
/* ========================================================================= */

export const pureEasing = {
  linear: (t: number): number => t,
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  smoothstep: (t: number): number => t * t * (3 - 2 * t),
  /**
   * Biomechanical natural cursor curve approximating cubic-bezier(0.22, 1, 0.36, 1).
   * Rapid acceleration out of start point, peak velocity around 35%, smooth terminal homing.
   */
  biomechanicCursor: (t: number): number => {
    const clamped = Math.max(0, Math.min(1, t));
    const inv = 1 - clamped;
    return 1 - Math.pow(inv, 2.8);
  },
};

/* ========================================================================= */
/* Parametric Bezier Calculations                                            */
/* ========================================================================= */

/**
 * Evaluates a 2D quadratic Bezier curve at spatial parameter s in [0, 1].
 * Formula: B_2(s) = (1-s)^2 * P0 + 2*(1-s)*s * Pc + s^2 * P1
 */
export function quadraticBezier(
  p0: Point2D,
  pc: Point2D,
  p1: Point2D,
  s: number
): Point2D {
  const clampedS = Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0;
  const inv = 1 - clampedS;
  const invSq = inv * inv;
  const sSq = clampedS * clampedS;
  const cross = 2 * inv * clampedS;

  return {
    x: invSq * p0.x + cross * pc.x + sSq * p1.x,
    y: invSq * p0.y + cross * pc.y + sSq * p1.y,
  };
}

/**
 * Evaluates first derivative (tangent velocity vector) of quadratic Bezier.
 * Formula: B_2'(s) = 2*(1-s)*(Pc - P0) + 2*s*(P1 - Pc)
 */
export function quadraticBezierDerivative(
  p0: Point2D,
  pc: Point2D,
  p1: Point2D,
  s: number
): Point2D {
  const clampedS = Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0;
  return {
    x: 2 * (1 - clampedS) * (pc.x - p0.x) + 2 * clampedS * (p1.x - pc.x),
    y: 2 * (1 - clampedS) * (pc.y - p0.y) + 2 * clampedS * (p1.y - pc.y),
  };
}

/**
 * Evaluates a 2D cubic Bezier curve at spatial parameter s in [0, 1].
 * Formula: B_3(s) = (1-s)^3 * P0 + 3*(1-s)^2*s * Pc1 + 3*(1-s)*s^2 * Pc2 + s^3 * P1
 */
export function cubicBezier(
  p0: Point2D,
  pc1: Point2D,
  pc2: Point2D,
  p1: Point2D,
  s: number
): Point2D {
  const clampedS = Number.isFinite(s) ? Math.max(0, Math.min(1, s)) : 0;
  const inv = 1 - clampedS;
  const inv3 = inv * inv * inv;
  const s3 = clampedS * clampedS * clampedS;
  const c1 = 3 * inv * inv * clampedS;
  const c2 = 3 * inv * clampedS * clampedS;

  return {
    x: inv3 * p0.x + c1 * pc1.x + c2 * pc2.x + s3 * p1.x,
    y: inv3 * p0.y + c1 * pc1.y + c2 * pc2.y + s3 * p1.y,
  };
}

/**
 * Interpolates a single segment from p0 at startFrame to p1 at endFrame with optional control point.
 * Separates spatial Bezier arc from temporal velocity easing E(tau).
 */
export function interpolateBezierSegment(
  frame: number,
  startFrame: number,
  endFrame: number,
  p0: Point2D,
  p1: Point2D,
  pc?: Point2D,
  easing: EasingFn = pureEasing.biomechanicCursor
): Point2D {
  if (frame <= startFrame || endFrame <= startFrame) {
    return { x: p0.x, y: p0.y };
  }
  if (frame >= endFrame) {
    return { x: p1.x, y: p1.y };
  }

  const tau = (frame - startFrame) / (endFrame - startFrame);
  const s = easing(tau);

  if (pc) {
    return quadraticBezier(p0, pc, p1, s);
  }

  // Linear straight interpolation
  return {
    x: p0.x + (p1.x - p0.x) * s,
    y: p0.y + (p1.y - p0.y) * s,
  };
}

/* ========================================================================= */
/* Multi-Keyframe Track Interpolator                                         */
/* ========================================================================= */

export interface CursorTrackState {
  x: number;
  y: number;
  tangentAngle?: number;
  isClickActive: boolean;
  clickElapsed: number; // Frames since last click if within click window, else -1
  segmentIndex: number;
}

export function interpolateCursorTrack(
  track: CursorKeyframeLike[],
  frame: number,
  options?: {
    easing?: EasingFn;
    clickWindowFrames?: number;
    fallbackPosition?: Point2D;
  }
): CursorTrackState {
  const fallback = options?.fallbackPosition ?? { x: 0.5, y: 0.5 };
  const clickWindow = options?.clickWindowFrames ?? 16;
  const easing = options?.easing ?? pureEasing.biomechanicCursor;

  if (!track || track.length === 0) {
    return {
      x: fallback.x,
      y: fallback.y,
      isClickActive: false,
      clickElapsed: -1,
      segmentIndex: -1,
    };
  }

  // Deterministically sort keyframes by frame
  const sorted = [...track].sort((a, b) => a.frame - b.frame);

  // Detect recent click event across the entire track up to current frame
  let isClickActive = false;
  let clickElapsed = -1;

  for (let i = sorted.length - 1; i >= 0; i--) {
    const kf = sorted[i];
    if (kf.click && frame >= kf.frame) {
      const elapsed = frame - kf.frame;
      if (elapsed <= clickWindow) {
        isClickActive = true;
        clickElapsed = elapsed;
      }
      break;
    }
  }

  // Track position evaluation
  if (frame <= sorted[0].frame) {
    return {
      x: sorted[0].x,
      y: sorted[0].y,
      isClickActive,
      clickElapsed,
      segmentIndex: 0,
    };
  }

  const lastKf = sorted[sorted.length - 1];
  if (frame >= lastKf.frame) {
    return {
      x: lastKf.x,
      y: lastKf.y,
      isClickActive,
      clickElapsed,
      segmentIndex: sorted.length - 1,
    };
  }

  // Find segment [i - 1, i]
  let segmentIndex = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (frame < sorted[i].frame) {
      segmentIndex = i - 1;
      break;
    }
  }

  const k0 = sorted[segmentIndex];
  const k1 = sorted[segmentIndex + 1];

  const p0: Point2D = { x: k0.x, y: k0.y };
  const p1: Point2D = { x: k1.x, y: k1.y };
  const pc: Point2D | undefined =
    k1.controlX !== undefined && k1.controlY !== undefined
      ? { x: k1.controlX, y: k1.controlY }
      : undefined;

  const currentPos = interpolateBezierSegment(
    frame,
    k0.frame,
    k1.frame,
    p0,
    p1,
    pc,
    easing
  );

  // Optional tangent orientation
  let tangentAngle: number | undefined;
  if (pc) {
    const tau = (frame - k0.frame) / Math.max(1, k1.frame - k0.frame);
    const s = easing(tau);
    const deriv = quadraticBezierDerivative(p0, pc, p1, s);
    tangentAngle = Math.atan2(deriv.y, deriv.x);
  }

  return {
    x: currentPos.x,
    y: currentPos.y,
    tangentAngle,
    isClickActive,
    clickElapsed,
    segmentIndex,
  };
}

/**
 * Computes a perpendicular control point for a natural curved movement chord.
 */
export function computeArcControlPoint(
  p0: Point2D,
  p1: Point2D,
  curvature = 0.18,
  upwardBias = true
): Point2D {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.001) {
    return { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  }

  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;

  // Perpendicular normal vectors
  const nx1 = -dy / dist;
  const ny1 = dx / dist;

  const offset = curvature * dist;
  const c1 = { x: mx + nx1 * offset, y: my + ny1 * offset };
  const c2 = { x: mx - nx1 * offset, y: my - ny1 * offset };

  if (upwardBias) {
    // In screen coordinates (y positive downwards), smaller y is upwards
    return c1.y <= c2.y ? c1 : c2;
  }

  return c1;
}
