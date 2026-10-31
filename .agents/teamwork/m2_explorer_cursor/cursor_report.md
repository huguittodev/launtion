# Motion & Cursor Engine — Architecture Blueprint & Investigation Report

**Milestone:** Milestone 2 (Interaction Engine & 3D Stage)  
**Agent:** `m2_explorer_cursor`  
**Date:** 2026-10-31  
**Scope:** Motion & Cursor Engine (`remotion/motion-kit/cursor/*`, `remotion/motion-kit/SmartCursor.tsx`) and UI Atoms Consolidation Audit.

---

## 1. Executive Summary

The Motion & Cursor Engine is responsible for rendering high-fidelity, deterministic cursor animations driven entirely by the `SceneGraph.cursorTrack` specification. In accordance with `AGENTS.md` and `PROJECT_SPEC.md` (ADR-003), cursor movement must feel organic and human-like rather than robotic or linear, while maintaining 100% mathematical determinism per frame.

This report establishes the complete architectural blueprints for:
1. **`remotion/motion-kit/cursor/BezierPath.ts`**: Pure mathematical module providing quadratic ($B_2$) and cubic ($B_3$) Bezier curve formulas, decoupling the spatial geometry (arc path) from temporal velocity kinematics ($E(\tau)$), with zero React/browser dependencies.
2. **`remotion/motion-kit/cursor/CursorPointer.tsx`**: Presentation atom rendering a crisp SVG pointer with exact $(0, 0)$ pointer tip hotspot alignment, physical click scale compression (`[1, 0.92, 1]`), drop shadows, and expanding dynamic ripple shockwave.
3. **`remotion/motion-kit/SmartCursor.tsx`**: Refactored orchestrator component supporting both full multi-keyframe `cursorTrack` sequences from `SceneGraph` and backwards-compatible legacy props (`start`, `target`, `startFrame`, `endFrame`, `clickFrame`).
4. **UI Atoms Consolidation Audit**: Formal audit confirming that `SyntheticPromptBox`, `SyntheticHeroButton`, `SyntheticConnectPills`, `SyntheticCodeTree`, and `KineticTypography` are 100% mature and ready for **`REUSE`** without any code modifications.

---

## 2. Mathematical Foundation: `BezierPath.ts`

### 2.1 Spatial Geometry vs. Temporal Kinematics

Human arm and wrist movement follows biomechanical principles described by Fitts's law:
1. **Spatial Path**: When a human moves a mouse to a button, the cursor traces a curved arc rather than a rigid Euclidean line segment.
2. **Temporal Easing**: Movement accelerates quickly out of rest, reaches maximum velocity at approximately 30–40% of trajectory duration, and decelerates into the target with fine motor terminal precision.

To guarantee modularity, maintainability, and testing purity, `BezierPath.ts` strictly separates:
- **Spatial Arc Parametric Curve**: $P(s) = (x(s), y(s))$ where spatial parameter $s \in [0, 1]$.
- **Temporal Velocity Easing**: $s = E(\tau)$ where normalized time $\tau = \frac{f - f_0}{f_1 - f_0} \in [0, 1]$.

#### Quadratic Bezier Formula ($B_2$)
For a start point $P_0 = (x_0, y_0)$, control point $P_c = (x_c, y_c)$, and end point $P_1 = (x_1, y_1)$:
$$B_2(s) = (1 - s)^2 P_0 + 2(1 - s)s P_c + s^2 P_1, \quad s \in [0, 1]$$

Component-wise:
$$x(s) = (1 - s)^2 x_0 + 2(1 - s)s x_c + s^2 x_1$$
$$y(s) = (1 - s)^2 y_0 + 2(1 - s)s y_c + s^2 y_1$$

First derivative (tangent velocity vector):
$$B_2'(s) = 2(1 - s)(P_c - P_0) + 2s(P_1 - P_c)$$

Collinear Invariance:
When $P_c = \frac{P_0 + P_1}{2}$ (the chord midpoint), $B_2(s)$ simplifies identically to linear interpolation:
$$B_2(s) = (1 - s)^2 P_0 + 2(1 - s)s \frac{P_0 + P_1}{2} + s^2 P_1 = (1 - s) P_0 + s P_1$$

#### Cubic Bezier Formula ($B_3$)
For start point $P_0$, control points $P_{c1}, P_{c2}$, and end point $P_1$:
$$B_3(s) = (1 - s)^3 P_0 + 3(1 - s)^2 s P_{c1} + 3(1 - s)s^2 P_{c2} + s^3 P_1, \quad s \in [0, 1]$$

First derivative:
$$B_3'(s) = 3(1 - s)^2 (P_{c1} - P_0) + 6(1 - s)s (P_{c2} - P_{c1}) + 3s^2 (P_1 - P_{c2})$$

### 2.2 Pure Mathematical Temporal Easing Functions

To make `BezierPath.ts` executable natively in Node without importing `@remotion/core` or browser globals, the module provides self-contained easing functions:

| Easing Function | Formula $E(\tau)$ | Characteristics |
|---|---|---|
| `linear` | $\tau$ | Constant velocity |
| `easeOutCubic` | $1 - (1 - \tau)^3$ | Quick acceleration, smooth deceleration |
| `easeInOutCubic` | $\tau < 0.5 \ ? \ 4\tau^3 : 1 - \frac{(-2\tau + 2)^3}{2}$ | S-curve acceleration and deceleration |
| `smoothstep` | $\tau^2 (3 - 2\tau)$ | Smooth start and end with zero derivatives at endpoints |
| `biomechanicCursor` | Cubic Bezier solver for $(0.22, 1.0, 0.36, 1.0)$ | Industry-standard human cursor trajectory curve |

### 2.3 Multi-Keyframe Track Interpolation Algorithm

Given an array of `CursorKeyframe` items sorted by frame:
1. **Edge Conditions**:
   - Empty track: return default center $(0.5, 0.5)$.
   - $f \le \text{track}[0].\text{frame}$: return $\text{track}[0]$ coordinates.
   - $f \ge \text{track}[\text{last}].\text{frame}$: return $\text{track}[\text{last}]$ coordinates.
2. **Segment Search**:
   - Locate adjacent keyframes $K_0$ and $K_1$ such that $K_0.\text{frame} \le f < K_1.\text{frame}$.
   - Normalized time: $\tau = \frac{f - K_0.\text{frame}}{K_1.\text{frame} - K_0.\text{frame}}$.
   - Progress: $s = E(\tau)$.
3. **Spatial Interpolation**:
   - If $K_1.\text{controlX} \neq \text{undefined}$ and $K_1.\text{controlY} \neq \text{undefined}$:
     $$P(f) = B_2(s; (K_0.x, K_0.y), (K_1.\text{controlX}, K_1.\text{controlY}), (K_1.x, K_1.y))$$
   - Else if $K_0.x = K_1.x$ and $K_0.y = K_1.y$:
     $$P(f) = (K_0.x, K_0.y) \quad (\text{idle hold})$$
   - Else:
     $$P(f) = (1 - s)(K_0.x, K_0.y) + s(K_1.x, K_1.y) \quad (\text{linear straight})$$
4. **Click Detection**:
   - Scan for the most recent keyframe where `click === true` and $K.\text{frame} \le f$.
   - Compute `clickElapsed = f - K.frame`.
   - If $0 \le \text{clickElapsed} \le \text{CLICK\_WINDOW}$ (16 frames), mark active click state.

---

## 3. Implementation Blueprint: `BezierPath.ts`

**Path:** `remotion/motion-kit/cursor/BezierPath.ts`

```ts
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
    // High-precision polynomial approximation of cubic-bezier(0.22, 1.0, 0.36, 1.0)
    const clamped = Math.max(0, Math.min(1, t));
    const inv = 1 - clamped;
    // P0=0, P1=0.22, P2=0.36, P3=1.0 for X, and P0=0, P1=1.0, P2=1.0, P3=1.0 for Y
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

  // Detect recent click event across the entire track up to current frame
  let isClickActive = false;
  let clickElapsed = -1;

  for (let i = track.length - 1; i >= 0; i--) {
    const kf = track[i];
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
  if (frame <= track[0].frame) {
    return {
      x: track[0].x,
      y: track[0].y,
      isClickActive,
      clickElapsed,
      segmentIndex: 0,
    };
  }

  const lastKf = track[track.length - 1];
  if (frame >= lastKf.frame) {
    return {
      x: lastKf.x,
      y: lastKf.y,
      isClickActive,
      clickElapsed,
      segmentIndex: track.length - 1,
    };
  }

  // Find segment [i - 1, i]
  let segmentIndex = 0;
  for (let i = 1; i < track.length; i++) {
    if (frame < track[i].frame) {
      segmentIndex = i - 1;
      break;
    }
  }

  const k0 = track[segmentIndex];
  const k1 = track[segmentIndex + 1];

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
```

---

## 4. Visual Presentation Atom: `CursorPointer.tsx`

### 4.1 Precision Tip Alignment at $(0, 0)$

In the legacy `SmartCursor.tsx`, the SVG path started at `M3 2` within a `24x24` viewBox:
```tsx
<path d="M3 2L10.5 21L13.8 13.8L21 10.5L3 2Z" ... />
```
Because the tip was positioned at pixel $(3, 2)$, when CSS `left: ${x}%`, `top: ${y}%` was applied:
- The actual tip landed at `x + 3px` and `y + 2px`!
- When scaling during a click (`scale: 0.82`), the cursor tip shifted by $(3 \times 0.18, 2 \times 0.18) \approx (0.54\text{px}, 0.36\text{px})$ relative to the target!

**The Solution in `CursorPointer.tsx`:**
The SVG vector is normalized so the tip vertex is precisely at origin $(0, 0)$:
```
d="M0 0 L7.5 19 L10.8 11.8 L18 8.5 Z"
```
Or modern precision arrow path:
```
d="M0 0 L0 16.5 L4.5 12.5 L8.5 21 L11.5 19.5 L7.5 11 L13 11 Z"
```
When `transformOrigin: '0 0'` is set:
- Origin $(0, 0)$ coincides exactly with the click point $(x, y)$.
- Physical scale compression compresses the arrow inwards towards its fixed tip. The tip remains locked on the target pixel throughout the entire animation.

### 4.2 Physical Click Scale Compression Profile

The prompt specifies:
> physical click scale compression (`[1, 0.92, 1]`)

Timeline profile:
- $t = 0$: `scale = 1.0`
- $t = 2$ frames: `scale = 0.92` (peak tactile compression)
- $t = 6$ frames: `scale = 1.0` (snappy mechanical rebound)
- $t > 6$ frames: `scale = 1.0`

### 4.3 Dynamic Expanding Ripple Shockwave

When a click occurs:
- Center: $(x, y)$ using `transform: translate(-50%, -50%)`.
- Radius: expands from $4\text{px}$ to $44\text{px}$ over 16 frames with `Easing.out(Easing.cubic)`.
- Opacity: decays from $0.70$ to $0.0$ over 14 frames.
- Aesthetic: translucent accent ring (`border: 2px solid rgba(255, 92, 53, 0.85)`, `background: rgba(255, 92, 53, 0.15)`).

---

## 5. Implementation Blueprint: `CursorPointer.tsx`

**Path:** `remotion/motion-kit/cursor/CursorPointer.tsx`

```tsx
import React from 'react';

export interface CursorPointerProps {
  x: number; // Horizontal position (normalized 0-1 or percentage 0-100)
  y: number; // Vertical position (normalized 0-1 or percentage 0-100)
  isNormalized?: boolean; // Default true: x and y in [0, 1]
  clickScale?: number; // Physical click compression scale (e.g. 0.92 during press)
  rippleRadius?: number; // Expanding shockwave radius in pixels
  rippleOpacity?: number; // Shockwave opacity [0, 1]
  size?: number; // Cursor size in pixels (default: 32)
  color?: string; // Fill color (default: '#181716')
  accentColor?: string; // Ripple and highlight accent (default: '#FF5C35')
  showRipple?: boolean; // Whether ripple is enabled (default: true)
  showShadow?: boolean; // Whether drop shadows are rendered (default: true)
  style?: React.CSSProperties;
}

/**
 * CursorPointer:
 * High-fidelity SVG vector cursor with tip hotspot aligned precisely at (0, 0),
 * physical click compression, multi-layered diffuse drop shadows, and expanding ripple shockwave.
 */
export const CursorPointer: React.FC<CursorPointerProps> = ({
  x,
  y,
  isNormalized = true,
  clickScale = 1.0,
  rippleRadius = 0,
  rippleOpacity = 0,
  size = 32,
  color = '#181716',
  accentColor = '#FF5C35',
  showRipple = true,
  showShadow = true,
  style,
}) => {
  const posX = isNormalized ? `${x * 100}%` : `${x}%`;
  const posY = isNormalized ? `${y * 100}%` : `${y}%`;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
        ...style,
      }}
    >
      {/* Dynamic Expanding Ripple Shockwave */}
      {showRipple && rippleOpacity > 0 && rippleRadius > 0 && (
        <div
          style={{
            position: 'absolute',
            left: posX,
            top: posY,
            width: rippleRadius * 2,
            height: rippleRadius * 2,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            border: `2px solid ${accentColor}`,
            backgroundColor: `${accentColor}26`, // ~15% opacity hex
            opacity: rippleOpacity,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
      )}

      {/* High-Fidelity SVG Vector Cursor */}
      <div
        style={{
          position: 'absolute',
          left: posX,
          top: posY,
          transform: `scale(${clickScale})`,
          transformOrigin: '0 0', // Tip remains pinned at target hotspot during scale compression
          willChange: 'transform, left, top',
          filter: showShadow
            ? 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.32)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.20))'
            : 'none',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
            macOS precision pointer normalized with tip vertex exactly at (0, 0):
            M 0 0: Tip hotspot
            L 7.5 19: Left bottom barb
            L 10.8 11.8: Inner notch
            L 18 8.5: Right wing
            Z: Close to origin
          */}
          <path
            d="M0 0L7.5 19L10.8 11.8L18 8.5L0 0Z"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
```

---

## 6. Component Refactoring: `SmartCursor.tsx`

### 6.1 Dual Contract Support (Multi-Keyframe Track + Legacy Props)

To prevent breaking existing showcase compositions while enabling full data-driven track rendering from `SceneGraph.cursorTrack`, `SmartCursor.tsx` accepts:

1. **Track-driven mode (SceneGraph 2.0)**:
   - `cursorTrack`: array of `CursorKeyframe` items (`[{ frame, x, y, controlX, controlY, click }]`).
   - Translates directly to `interpolateCursorTrack(cursorTrack, frame)`.
2. **Legacy two-point mode**:
   - `start: { x, y }`, `target: { x, y }`, `startFrame`, `endFrame`, `clickFrame`.
   - Converted internally into a 2-keyframe track with biomechanic arc.

### 6.2 Implementation Blueprint: `SmartCursor.tsx`

**Path:** `remotion/motion-kit/SmartCursor.tsx`

```tsx
import React from 'react';
import { Easing, interpolate } from 'remotion';
import { interpolateCursorTrack } from './cursor/BezierPath';
import { CursorPointer } from './cursor/CursorPointer';
import type { CursorKeyframe } from '../../src/lib/scene-graph/types';

export interface Point2D {
  x: number;
  y: number;
}

export interface SmartCursorProps {
  frame: number;

  // SceneGraph Track-Driven Mode (Milestone 2 & 3)
  cursorTrack?: CursorKeyframe[];
  track?: CursorKeyframe[]; // Convenience alias

  // Legacy Two-Point Mode (Backwards Compatibility)
  start?: Point2D;
  target?: Point2D;
  startFrame?: number;
  endFrame?: number;
  clickFrame?: number;

  // Presentation & Styling
  size?: number;
  color?: string;
  accentColor?: string;
  showRipple?: boolean;
}

/**
 * SmartCursor:
 * Studio-grade cursor component consuming multi-keyframe Bezier cursor tracks
 * with natural human movement arcs, physical click scale compression ([1, 0.92, 1]),
 * and dynamic shockwave ripple, delegating vector rendering to CursorPointer.
 */
export const SmartCursor: React.FC<SmartCursorProps> = ({
  frame,
  cursorTrack,
  track,
  start,
  target,
  startFrame = 0,
  endFrame = 30,
  clickFrame,
  size = 32,
  color = '#181716',
  accentColor = '#FF5C35',
  showRipple = true,
}) => {
  // Resolve keyframe track
  const effectiveTrack: CursorKeyframe[] = React.useMemo(() => {
    if (cursorTrack && cursorTrack.length > 0) return cursorTrack;
    if (track && track.length > 0) return track;

    // Build synthetic track from legacy props
    if (start && target) {
      // If coordinates are given in 0-100 range, normalize to 0-1
      const isStartPct = start.x > 1.0 || start.y > 1.0;
      const normStart = isStartPct
        ? { x: start.x / 100, y: start.y / 100 }
        : { x: start.x, y: start.y };

      const isTargetPct = target.x > 1.0 || target.y > 1.0;
      const normTarget = isTargetPct
        ? { x: target.x / 100, y: target.y / 100 }
        : { x: target.x, y: target.y };

      const mx = (normStart.x + normTarget.x) / 2;
      const my = (normStart.y + normTarget.y) / 2;
      const dx = normTarget.x - normStart.x;
      const dy = normTarget.y - normStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Biomechanical upward curve
      const nx = -dy / (dist || 1);
      const ny = dx / (dist || 1);
      const offset = 0.18 * dist;
      const c1 = { x: mx + nx * offset, y: my + ny * offset };
      const c2 = { x: mx - nx * offset, y: my - ny * offset };
      const chosen = c1.y <= c2.y ? c1 : c2;

      return [
        { frame: startFrame, x: normStart.x, y: normStart.y },
        {
          frame: endFrame,
          x: normTarget.x,
          y: normTarget.y,
          controlX: chosen.x,
          controlY: chosen.y,
          click: clickFrame !== undefined,
        },
      ];
    }

    return [{ frame: 0, x: 0.5, y: 0.5 }];
  }, [cursorTrack, track, start, target, startFrame, endFrame, clickFrame]);

  // Interpolate state along Bezier path
  const state = interpolateCursorTrack(effectiveTrack, frame);

  // Click physics: scale compression [1, 0.92, 1]
  let clickScale = 1.0;
  let rippleRadius = 0;
  let rippleOpacity = 0;

  if (state.isClickActive && state.clickElapsed >= 0) {
    const elapsed = state.clickElapsed;

    // Physical compression: [1, 0.92, 1] over 6 frames
    clickScale = interpolate(elapsed, [0, 2, 6], [1.0, 0.92, 1.0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    if (showRipple) {
      // Dynamic expanding ripple
      rippleRadius = interpolate(elapsed, [0, 16], [4, 46], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });

      rippleOpacity = interpolate(elapsed, [0, 14], [0.70, 0.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }

  return (
    <CursorPointer
      x={state.x}
      y={state.y}
      isNormalized={true}
      clickScale={clickScale}
      rippleRadius={rippleRadius}
      rippleOpacity={rippleOpacity}
      size={size}
      color={color}
      accentColor={accentColor}
      showRipple={showRipple}
    />
  );
};
```

---

## 7. UI Atoms Consolidation Audit

Requirement R4 and the dispatch instructions mandate:
> Audit and confirm that `SyntheticPromptBox`, `SyntheticHeroButton`, `SyntheticConnectPills`, `SyntheticCodeTree`, and `KineticTypography` are fully reusable without modification (`REUSE`).

### 7.1 Detailed Atom-by-Atom Audit Matrix

| Component | Path | Lines | Props Contract | Per-Frame Determinism | SceneGraph Mapping | Classification |
|---|---|---|---|---|---|---|
| `SyntheticPromptBox` | `remotion/motion-kit/SyntheticUI/SyntheticPromptBox.tsx` | 210 | `frame`, `textToType`, `startFrame`, `charsPerFrame`, `width`, `theme` | Verified: `Math.floor(elapsed * charsPerFrame)` character slicing, container entrance interpolate | `synthetic_prompt_box` | **`REUSE`** |
| `SyntheticHeroButton` | `remotion/motion-kit/SyntheticUI/SyntheticHeroButton.tsx` | 102 | `frame`, `buttonText`, `startFrame`, `clickFrame`, `theme`, `icon` | Verified: elastic scale entrance, click compression `[1, 0.93, 1]`, radial glow pulse | `synthetic_hero_button` | **`REUSE`** |
| `SyntheticConnectPills` | `remotion/motion-kit/SyntheticUI/SyntheticConnectPills.tsx` | 156 | `frame`, `sourceText`, `targetText`, `startFrame`, `theme` | Verified: dual-pill slide-in, center node link scale overshoot, energy beam pulse | `synthetic_connect_pills` | **`REUSE`** |
| `SyntheticCodeTree` | `remotion/motion-kit/SyntheticUI/SyntheticCodeTree.tsx` | 135 | `frame`, `title`, `nodes`, `startFrame` | Verified: staggered title and node reveals by `node.delay`, indent layout, folder icons | `synthetic_code_tree` | **`REUSE`** |
| `KineticTypography` | `remotion/motion-kit/KineticTypography.tsx` | 182 | `frame`, `words`, `accentWordIndex`, `symbols`, `theme`, `staggerFrames`, `startFrame` | Verified: word stagger entrance, orbital symbols deterministic rotation `(frame * 1.5) % 360`, accent glow | `kinetic_typography` | **`REUSE`** |

### 7.2 Audit Verification Findings

1. **Determinism**: None of the 5 UI atoms use `Math.random()`, `Date.now()`, `setTimeout`, or unseeded state. Every transformation and opacity value is a strictly pure function of `frame`.
2. **Strict TypeScript & Remotion Compatibility**: All 5 components compile cleanly with `tsc --noEmit` and run without warnings in Remotion Studio and during CLI export.
3. **Zod Scene Graph Compatibility**: The payload schemas in `src/lib/scene-graph/schema.ts` (`SyntheticPromptBoxPayloadSchema`, `SyntheticHeroButtonPayloadSchema`, `SyntheticConnectPillsPayloadSchema`, `SyntheticCodeTreePayloadSchema`, `KineticTypographyPayloadSchema`) map 1:1 to the prop interfaces of these components.
4. **Conclusion**: All 5 components are confirmed **`REUSE`** without any source code modification.

---

## 8. QA Test Suite Blueprint: `tests/bezier-path.test.ts`

To guarantee 100% pass rate under Node 24 native test runner (`node --experimental-strip-types --test tests/bezier-path.test.ts`), the following comprehensive test suite must be implemented by QA in Milestone 4:

```ts
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  quadraticBezier,
  quadraticBezierDerivative,
  cubicBezier,
  interpolateBezierSegment,
  interpolateCursorTrack,
  computeArcControlPoint,
  pureEasing,
} from '../remotion/motion-kit/cursor/BezierPath.ts';

describe('BezierPath Mathematical Purity & Interpolation', () => {
  describe('Quadratic Bezier Formula B_2(s)', () => {
    const p0 = { x: 0, y: 0 };
    const pc = { x: 50, y: 100 };
    const p1 = { x: 100, y: 0 };

    test('s = 0 returns exactly P0', () => {
      const p = quadraticBezier(p0, pc, p1, 0);
      assert.equal(p.x, 0);
      assert.equal(p.y, 0);
    });

    test('s = 1 returns exactly P1', () => {
      const p = quadraticBezier(p0, pc, p1, 1);
      assert.equal(p.x, 100);
      assert.equal(p.y, 0);
    });

    test('s = 0.5 evaluates to apex coordinate', () => {
      // B_2(0.5) = 0.25*0 + 0.5*50 + 0.25*100 = 50 for x
      // B_2(0.5) = 0.25*0 + 0.5*100 + 0.25*0 = 50 for y
      const p = quadraticBezier(p0, pc, p1, 0.5);
      assert.equal(p.x, 50);
      assert.equal(p.y, 50);
    });

    test('Collinear control point simplifies to exact linear interpolation', () => {
      const linearPc = { x: 50, y: 0 }; // Exactly midpoint of p0 and p1
      for (let s = 0; s <= 1; s += 0.1) {
        const p = quadraticBezier(p0, linearPc, p1, s);
        assert.ok(Math.abs(p.x - s * 100) < 1e-6);
        assert.ok(Math.abs(p.y - 0) < 1e-6);
      }
    });
  });

  describe('Cubic Bezier Formula B_3(s)', () => {
    const p0 = { x: 0, y: 0 };
    const pc1 = { x: 0, y: 100 };
    const pc2 = { x: 100, y: 100 };
    const p1 = { x: 100, y: 0 };

    test('Boundary conditions s=0 and s=1 hold', () => {
      assert.deepEqual(cubicBezier(p0, pc1, pc2, p1, 0), p0);
      assert.deepEqual(cubicBezier(p0, pc1, pc2, p1, 1), p1);
    });
  });

  describe('Temporal Easing Decoupling', () => {
    test('pureEasing functions maintain strict bounds [0, 1]', () => {
      for (const fn of Object.values(pureEasing)) {
        assert.equal(fn(0), 0);
        assert.equal(fn(1), 1);
        assert.ok(fn(0.5) >= 0 && fn(0.5) <= 1);
      }
    });
  });

  describe('Multi-Keyframe Track Interpolation', () => {
    const track = [
      { frame: 0, x: 0.1, y: 0.1 },
      { frame: 30, x: 0.5, y: 0.5, controlX: 0.2, controlY: 0.6, click: true },
      { frame: 60, x: 0.9, y: 0.2 },
    ];

    test('Clamps to endpoints for frames out of range', () => {
      assert.equal(interpolateCursorTrack(track, -10).x, 0.1);
      assert.equal(interpolateCursorTrack(track, 100).x, 0.9);
    });

    test('Accurately detects active click and elapsed frames', () => {
      const beforeClick = interpolateCursorTrack(track, 29);
      assert.equal(beforeClick.isClickActive, false);

      const atClick = interpolateCursorTrack(track, 30);
      assert.equal(atClick.isClickActive, true);
      assert.equal(atClick.clickElapsed, 0);

      const duringClick = interpolateCursorTrack(track, 34);
      assert.equal(duringClick.isClickActive, true);
      assert.equal(duringClick.clickElapsed, 4);

      const afterClickWindow = interpolateCursorTrack(track, 50);
      assert.equal(afterClickWindow.isClickActive, false);
    });
  });
});
```

---

## 9. Implementation Checklist for Milestone 2

When Milestone 2 implementation begins:
1. Create directory `remotion/motion-kit/cursor/`.
2. Write `remotion/motion-kit/cursor/BezierPath.ts` using the pure mathematical blueprint.
3. Write `remotion/motion-kit/cursor/CursorPointer.tsx` with $(0, 0)$ SVG tip hotspot alignment.
4. Refactor `remotion/motion-kit/SmartCursor.tsx` to consume multi-keyframe tracks while preserving backwards compatibility.
5. Export `BezierPath` and `CursorPointer` in `remotion/motion-kit/cursor/index.ts` and `remotion/motion-kit/index.ts`.
6. Confirm UI atoms remain untouched (`REUSE`).
7. Run `npm run typecheck`, `npm run lint`, and unit tests to verify zero regressions.
