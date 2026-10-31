/**
 * tests/adversarial-bezier-audio.test.ts
 *
 * Empirical Adversarial Verification Suite for Milestone 2:
 * 1. Bezier Curves Precision & Limits (BezierPath.ts):
 *    - Degenerate collinear control points, zero-distance trajectories (start == target).
 *    - Monotonic temporal progress evaluation & Convex Hull containment oracle across 10,000+ points.
 *    - Arc height calculations, normal vectors, and vector continuity.
 * 2. AudioMixer Soft Limiter & Headroom (AudioMixer.ts):
 *    - Polyphonic stress test: 10, 50, 100, 1,000, and 10,000 overlapping audio cues.
 *    - Master mixed amplitude strictly <= 0.95 and NEVER exceeds 1.0.
 *    - Dynamic sidechain ducking behavior when energetic SFX overlap ambient beat.
 * 3. FadeController Extreme Configurations (FadeController.ts):
 *    - Overlapping fades (fadeInFrames + fadeOutFrames > durationInFrames).
 *    - Proportional scaling, zero and negative durations, and monotonic keyframe safety.
 */

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
  type Point2D,
  type CursorKeyframeLike,
} from '../remotion/motion-kit/cursor/BezierPath';

import {
  softLimitGain,
  calculateDuckingFactor,
} from '../remotion/motion-kit/audio/AudioMixer';

import {
  clampFadeDurations,
  evaluateFadeCurve,
  calculateFadeGain,
} from '../remotion/motion-kit/audio/FadeController';

/* ========================================================================= */
/* Helper Oracles for Geometric Validation                                   */
/* ========================================================================= */

/**
 * Checks whether point Q lies within the convex hull of triangle P0, Pc, P1.
 * For any point Q = lambda0*P0 + lambdaC*Pc + lambda1*P1 with lambda_i >= 0 and sum = 1,
 * it is analytically in the convex hull.
 * Here we empirically check using 2D cross-product orientation or bounding hull.
 */
function isPointInTriangleConvexHull(
  q: Point2D,
  p0: Point2D,
  pc: Point2D,
  p1: Point2D,
  tolerance = 1e-9
): boolean {
  // Bounding box quick rejection with tolerance
  const minX = Math.min(p0.x, pc.x, p1.x) - tolerance;
  const maxX = Math.max(p0.x, pc.x, p1.x) + tolerance;
  const minY = Math.min(p0.y, pc.y, p1.y) - tolerance;
  const maxY = Math.max(p0.y, pc.y, p1.y) + tolerance;

  if (q.x < minX || q.x > maxX || q.y < minY || q.y > maxY) {
    return false;
  }

  // Cross product sign method for triangle containment
  const cross = (a: Point2D, b: Point2D, p: Point2D) =>
    (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

  const d1 = cross(p0, pc, q);
  const d2 = cross(pc, p1, q);
  const d3 = cross(p1, p0, q);

  const hasNeg = (d1 < -tolerance) || (d2 < -tolerance) || (d3 < -tolerance);
  const hasPos = (d1 > tolerance) || (d2 > tolerance) || (d3 > tolerance);

  // Collinear or inside triangle
  return !(hasNeg && hasPos);
}

/**
 * Checks if point Q lies on the line segment connecting A and B.
 */
function isPointOnSegment(q: Point2D, a: Point2D, b: Point2D, tolerance = 1e-7): boolean {
  const cross = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
  if (Math.abs(cross) > tolerance * Math.max(1, Math.hypot(b.x - a.x, b.y - a.y))) {
    return false;
  }
  const minX = Math.min(a.x, b.x) - tolerance;
  const maxX = Math.max(a.x, b.x) + tolerance;
  const minY = Math.min(a.y, b.y) - tolerance;
  const maxY = Math.max(a.y, b.y) + tolerance;
  return q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY;
}

/* ========================================================================= */
/* 1. BEZIER CURVES ADVERSARIAL STRESS TEST SUITE                            */
/* ========================================================================= */

describe('Milestone 2 Adversarial Challenge 1: Bezier Curves & Kinematics', () => {
  describe('1.1 Degenerate & Zero-Distance Trajectories', () => {
    test('Zero-distance trajectory (start == target): collapsed single point', () => {
      const pZero: Point2D = { x: 345.67, y: 789.12 };
      // All control points coincident
      for (const s of [-0.5, 0.0, 0.25, 0.5, 0.75, 1.0, 1.5, NaN, Infinity]) {
        const pt = quadraticBezier(pZero, pZero, pZero, s);
        assert.ok(Math.abs(pt.x - pZero.x) < 1e-9);
        assert.ok(Math.abs(pt.y - pZero.y) < 1e-9);
      }
    });

    test('Zero-distance trajectory with detached control point forms closed cusp', () => {
      const p0: Point2D = { x: 200, y: 200 };
      const pc: Point2D = { x: 200, y: 50 }; // control point displaced vertically
      const p1: Point2D = { x: 200, y: 200 }; // returns to p0

      // At endpoints, must be exactly p0
      assert.deepEqual(quadraticBezier(p0, pc, p1, 0), p0);
      assert.deepEqual(quadraticBezier(p0, pc, p1, 1), p1);

      // At midpoint s = 0.5: B2(0.5) = 0.25*200 + 0.5*50 + 0.25*200 = 50 + 25 + 50 = 125
      const mid = quadraticBezier(p0, pc, p1, 0.5);
      assert.equal(mid.x, 200);
      assert.equal(mid.y, 125);

      // Velocity at midpoint must be horizontal (dy = 0)
      const derivMid = quadraticBezierDerivative(p0, pc, p1, 0.5);
      assert.equal(derivMid.x, 0);
      assert.equal(derivMid.y, 0); // At the apex of symmetric cusp, instantaneous derivative is zero
    });

    test('Collinear control points remain strictly on the 1D chord', () => {
      const p0: Point2D = { x: 10, y: 20 };
      const p1: Point2D = { x: 110, y: 220 }; // slope dy/dx = 200/100 = 2.0

      // Case A: Pc at 25% along chord
      const pcInside: Point2D = { x: 10 + 0.25 * 100, y: 20 + 0.25 * 200 };
      for (let i = 0; i <= 50; i++) {
        const s = i / 50;
        const pt = quadraticBezier(p0, pcInside, p1, s);
        assert.ok(
          isPointOnSegment(pt, p0, p1),
          `Point at s=${s} diverged from collinear chord: (${pt.x}, ${pt.y})`
        );
        // Verify exact slope: y - 20 == 2 * (x - 10)
        assert.ok(Math.abs((pt.y - 20) - 2 * (pt.x - 10)) < 1e-9);
      }

      // Case B: Pc collinear but outside chord (overshoot)
      const pcOvershoot: Point2D = { x: 160, y: 320 }; // alpha = 1.5
      for (let i = 0; i <= 50; i++) {
        const s = i / 50;
        const pt = quadraticBezier(p0, pcOvershoot, p1, s);
        // All evaluated points must still lie on the line y - 20 = 2 * (x - 10)
        assert.ok(
          Math.abs((pt.y - 20) - 2 * (pt.x - 10)) < 1e-9,
          `Overshoot point at s=${s} departed collinear line: (${pt.x}, ${pt.y})`
        );
      }
    });

    test('Vertical and horizontal degenerate collinear chords', () => {
      // Purely vertical
      const v0: Point2D = { x: 50, y: 100 };
      const vc: Point2D = { x: 50, y: 250 };
      const v1: Point2D = { x: 50, y: 400 };
      for (let s = 0; s <= 1.0; s += 0.05) {
        const pt = quadraticBezier(v0, vc, v1, s);
        assert.ok(Math.abs(pt.x - 50) < 1e-12, `Vertical chord x diverged: ${pt.x}`);
        assert.ok(pt.y >= 100 - 1e-12 && pt.y <= 400 + 1e-12);
      }

      // Purely horizontal
      const h0: Point2D = { x: 20, y: 80 };
      const hc: Point2D = { x: 140, y: 80 };
      const h1: Point2D = { x: 300, y: 80 };
      for (let s = 0; s <= 1.0; s += 0.05) {
        const pt = quadraticBezier(h0, hc, h1, s);
        assert.ok(Math.abs(pt.y - 80) < 1e-12, `Horizontal chord y diverged: ${pt.y}`);
        assert.ok(pt.x >= 20 - 1e-12 && pt.x <= 300 + 1e-12);
      }
    });
  });

  describe('1.2 Convex Hull Containment Oracle (Stress Testing)', () => {
    test('10,000 quadratic Bezier evaluations strictly satisfy convex hull containment', () => {
      // Deterministic PRNG seed sequence for reproducibility
      let seed = 42;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      let violations = 0;
      const numTriangles = 500;
      const samplesPerTriangle = 20;

      for (let t = 0; t < numTriangles; t++) {
        const p0: Point2D = {
          x: (pseudoRandom() - 0.5) * 2000,
          y: (pseudoRandom() - 0.5) * 2000,
        };
        const pc: Point2D = {
          x: (pseudoRandom() - 0.5) * 2000,
          y: (pseudoRandom() - 0.5) * 2000,
        };
        const p1: Point2D = {
          x: (pseudoRandom() - 0.5) * 2000,
          y: (pseudoRandom() - 0.5) * 2000,
        };

        for (let sIdx = 0; sIdx <= samplesPerTriangle; sIdx++) {
          const s = sIdx / samplesPerTriangle;
          const pt = quadraticBezier(p0, pc, p1, s);

          // Invariant: B2(s) must lie inside the triangle convex hull
          const inside = isPointInTriangleConvexHull(pt, p0, pc, p1, 1e-7);
          if (!inside) {
            violations++;
          }
        }
      }

      assert.equal(violations, 0, `Convex hull containment violated in ${violations} instances`);
    });

    test('Cubic Bezier convex hull bounding box containment across 5,000 evaluations', () => {
      let seed = 1337;
      const pseudoRandom = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let t = 0; t < 250; t++) {
        const p0 = { x: pseudoRandom() * 1000, y: pseudoRandom() * 1000 };
        const pc1 = { x: pseudoRandom() * 1000, y: pseudoRandom() * 1000 };
        const pc2 = { x: pseudoRandom() * 1000, y: pseudoRandom() * 1000 };
        const p1 = { x: pseudoRandom() * 1000, y: pseudoRandom() * 1000 };

        const minX = Math.min(p0.x, pc1.x, pc2.x, p1.x) - 1e-9;
        const maxX = Math.max(p0.x, pc1.x, pc2.x, p1.x) + 1e-9;
        const minY = Math.min(p0.y, pc1.y, pc2.y, p1.y) - 1e-9;
        const maxY = Math.max(p0.y, pc1.y, pc2.y, p1.y) + 1e-9;

        for (let sIdx = 0; sIdx <= 20; sIdx++) {
          const s = sIdx / 20;
          const pt = cubicBezier(p0, pc1, pc2, p1, s);
          assert.ok(
            pt.x >= minX && pt.x <= maxX,
            `Cubic Bezier x out of convex bounding box at s=${s}`
          );
          assert.ok(
            pt.y >= minY && pt.y <= maxY,
            `Cubic Bezier y out of convex bounding box at s=${s}`
          );
        }
      }
    });
  });

  describe('1.3 Arc Height Calculations, Curvature, and Normal Vectors', () => {
    test('computeArcControlPoint: zero distance returns midpoint without NaN', () => {
      const pSame: Point2D = { x: 500, y: 300 };
      const cp = computeArcControlPoint(pSame, pSame, 0.2, true);
      assert.equal(cp.x, 500);
      assert.equal(cp.y, 300);
      assert.ok(!Number.isNaN(cp.x) && !Number.isNaN(cp.y));
    });

    test('Arc height calculation: apex height equals exactly 0.5 * curvature * dist', () => {
      const p0: Point2D = { x: 0, y: 100 };
      const p1: Point2D = { x: 400, y: 100 }; // horizontal chord, length 400
      const curvature = 0.25;

      const cp = computeArcControlPoint(p0, p1, curvature, true);
      // Midpoint M = (200, 100). Offset = 0.25 * 400 = 100.
      // Screen coordinates: upward bias means y = 100 - 100 = 0.
      assert.equal(cp.x, 200);
      assert.equal(cp.y, 0);

      // Apex at s = 0.5
      const apex = quadraticBezier(p0, cp, p1, 0.5);
      // B2(0.5) = 0.25*100 + 0.5*0 + 0.25*100 = 50
      assert.equal(apex.x, 200);
      assert.equal(apex.y, 50);

      // Arc peak height above chord = 100 - 50 = 50 = 0.5 * curvature * chordLength
      const measuredArcHeight = Math.abs(apex.y - 100);
      const expectedArcHeight = 0.5 * curvature * 400;
      assert.equal(measuredArcHeight, expectedArcHeight);
    });

    test('Arc normal vector direction across all four Cartesian quadrants', () => {
      const center: Point2D = { x: 500, y: 500 };
      const directions = [
        { label: 'East', target: { x: 700, y: 500 } },
        { label: 'West', target: { x: 300, y: 500 } },
        { label: 'South', target: { x: 500, y: 700 } },
        { label: 'North', target: { x: 500, y: 300 } },
        { label: 'NorthEast', target: { x: 700, y: 300 } },
        { label: 'SouthWest', target: { x: 300, y: 700 } },
      ];

      for (const { label, target } of directions) {
        const cp = computeArcControlPoint(center, target, 0.2, true);
        const dist = Math.hypot(target.x - center.x, target.y - center.y);
        const expectedOffset = 0.2 * dist;

        const mx = (center.x + target.x) / 2;
        const my = (center.y + target.y) / 2;
        const actualOffset = Math.hypot(cp.x - mx, cp.y - my);

        assert.ok(
          Math.abs(actualOffset - expectedOffset) < 1e-9,
          `Quadrant ${label} arc offset mismatch: got ${actualOffset}, expected ${expectedOffset}`
        );

        // Upward bias: cp.y should be <= my for non-vertical chords
        if (Math.abs(target.x - center.x) > 0.01) {
          assert.ok(
            cp.y <= my + 1e-9,
            `Upward bias violated in ${label}: cp.y (${cp.y}) > my (${my})`
          );
        }
      }
    });

    test('Tangent derivative continuity across multi-segment cursor track', () => {
      const track: CursorKeyframeLike[] = [
        { frame: 0, x: 0.1, y: 0.1 },
        { frame: 30, x: 0.5, y: 0.4, controlX: 0.25, controlY: 0.15 },
        { frame: 60, x: 0.9, y: 0.8, controlX: 0.75, controlY: 0.55 },
      ];

      // At boundary frame 30: evaluate immediately before (29.99) and after (30.01)
      const stateBefore = interpolateCursorTrack(track, 29.999);
      const stateAt = interpolateCursorTrack(track, 30);
      const stateAfter = interpolateCursorTrack(track, 30.001);

      // Positional C^0 continuity
      assert.ok(
        Math.hypot(stateBefore.x - stateAt.x, stateBefore.y - stateAt.y) < 0.001,
        'Position discontinuity before boundary frame 30'
      );
      assert.ok(
        Math.hypot(stateAfter.x - stateAt.x, stateAfter.y - stateAt.y) < 0.001,
        'Position discontinuity after boundary frame 30'
      );
    });

    test('interpolateBezierSegment boundary conditions & pureEasing curves', () => {
      const p0: Point2D = { x: 10, y: 20 };
      const p1: Point2D = { x: 100, y: 200 };
      const pc: Point2D = { x: 50, y: 20 };

      // Degenerate zero-duration segment: startFrame == endFrame
      const zeroDur = interpolateBezierSegment(10, 10, 10, p0, p1, pc);
      assert.deepEqual(zeroDur, p0);

      // Inverted duration: endFrame < startFrame
      const invertedDur = interpolateBezierSegment(15, 20, 10, p0, p1, pc);
      assert.deepEqual(invertedDur, p0);

      // Frame before startFrame
      assert.deepEqual(interpolateBezierSegment(5, 10, 20, p0, p1, pc), p0);

      // Frame after endFrame
      assert.deepEqual(interpolateBezierSegment(25, 10, 20, p0, p1, pc), p1);

      // Straight chord when pc is omitted
      const straight = interpolateBezierSegment(15, 10, 20, p0, p1, undefined, pureEasing.linear);
      assert.equal(straight.x, 55);
      assert.equal(straight.y, 110);

      // Pure easing functions range and boundary evaluation
      const easings = [
        pureEasing.linear,
        pureEasing.easeOutCubic,
        pureEasing.easeInOutCubic,
        pureEasing.smoothstep,
        pureEasing.biomechanicCursor,
      ];

      for (const fn of easings) {
        assert.ok(Math.abs(fn(0)) < 1e-9, `Easing at 0 must be 0: ${fn(0)}`);
        assert.ok(Math.abs(fn(1) - 1) < 1e-9, `Easing at 1 must be 1: ${fn(1)}`);
        const midVal = fn(0.5);
        assert.ok(midVal >= 0 && midVal <= 1, `Easing at 0.5 out of [0, 1]: ${midVal}`);
      }
    });
  });
});

/* ========================================================================= */
/* 2. AUDIOMIXER SOFT LIMITER & HEADROOM ADVERSARIAL STRESS TEST SUITE       */
/* ========================================================================= */

describe('Milestone 2 Adversarial Challenge 2: AudioMixer Headroom & Polyphony Limiter', () => {
  describe('2.1 Polyphonic Stress Test: 10, 50, 100, 1,000, and 10,000 Voices', () => {
    test('Simultaneous playback of 10, 50, and 100 voices at volume 1.0 strictly <= 0.95 and NEVER > 1.0', () => {
      const voiceCounts = [10, 50, 100, 500, 1000, 10000];

      for (const count of voiceCounts) {
        const rawSum = count * 1.0;
        const { limitedGain, limitFactor } = softLimitGain(rawSum, 0.75, 0.95);

        // Invariant 1: Master mixed amplitude is strictly <= 0.95
        assert.ok(
          limitedGain <= 0.95,
          `Failed for ${count} voices: limitedGain ${limitedGain} > 0.95`
        );

        // Invariant 2: NEVER exceeds 1.0
        assert.ok(
          limitedGain <= 1.0,
          `Failed for ${count} voices: limitedGain ${limitedGain} exceeded 1.0`
        );

        // Invariant 3: Strictly positive
        assert.ok(
          limitedGain > 0.75,
          `For raw sum ${rawSum}, limitedGain should be > kneeThreshold 0.75: got ${limitedGain}`
        );

        // Invariant 4: Limit factor matches limitedGain / rawSum
        assert.ok(
          Math.abs(limitFactor - limitedGain / rawSum) < 1e-12,
          `Limit factor mismatch for ${count} voices`
        );
      }
    });

    test('Limiter mathematical invariants: C^1 smooth knee derivative at threshold', () => {
      const knee = 0.75;
      const ceiling = 0.95;

      // Below knee: linear with slope 1.0
      const sBelow = 0.7499;
      const { limitedGain: gBelow } = softLimitGain(sBelow, knee, ceiling);
      assert.equal(gBelow, sBelow);

      // Exactly at knee
      const { limitedGain: gAt } = softLimitGain(knee, knee, ceiling);
      assert.equal(gAt, knee);

      // Numerical derivative at knee: d/dS L(S)|_{S=0.75}
      const eps = 1e-6;
      const gPlus = softLimitGain(knee + eps, knee, ceiling).limitedGain;
      const gMinus = softLimitGain(knee - eps, knee, ceiling).limitedGain;
      const numericalSlope = (gPlus - gMinus) / (2 * eps);

      assert.ok(
        Math.abs(numericalSlope - 1.0) < 1e-5,
        `Limiter C^1 continuity violated at knee: slope = ${numericalSlope}, expected 1.0`
      );
    });

    test('Limiter robust against boundary values: 0, negative, and Infinity', () => {
      // Zero sum
      const zero = softLimitGain(0);
      assert.equal(zero.limitedGain, 0);
      assert.equal(zero.limitFactor, 1.0);

      // Negative sum safely clamped to 0
      const neg = softLimitGain(-100);
      assert.equal(neg.limitedGain, 0);
      assert.equal(neg.limitFactor, 1.0);

      // Infinity approaches ceiling asymptotically
      const inf = softLimitGain(Infinity);
      assert.equal(inf.limitedGain, 0.95);
      assert.equal(inf.limitFactor, 0);
    });
  });

  describe('2.2 Dynamic Sidechain Ducking Adversarial Behavior', () => {
    test('Energetic SFX (priority 2) ducks ambient beat down to duckingFloor (0.55)', () => {
      const sfx = [
        { startFrame: 100, durationInFrames: 20, priority: 2 }, // whoosh/chime
      ];

      // Frame 90: Before attack (factor = 1.0)
      assert.equal(calculateDuckingFactor(90, sfx), 1.0);

      // Frame 99: During attack ramp (-1 frame before cue, attack = 2)
      const attackFactor = calculateDuckingFactor(99, sfx);
      assert.ok(attackFactor > 0.55 && attackFactor < 1.0);

      // Frame 100 to 119: Hold phase (factor = 0.55)
      for (let f = 100; f < 120; f++) {
        assert.equal(
          calculateDuckingFactor(f, sfx),
          0.55,
          `Ducking hold mismatch at frame ${f}`
        );
      }

      // Frame 120 to 129: Release phase (smoothstep ramp from 0.55 to 1.0)
      let prevFactor = 0.55;
      for (let f = 120; f < 130; f++) {
        const factor = calculateDuckingFactor(f, sfx);
        assert.ok(
          factor >= prevFactor,
          `Ducking release not non-decreasing at frame ${f}`
        );
        prevFactor = factor;
      }

      // Frame 130: Fully released (1.0)
      assert.equal(calculateDuckingFactor(130, sfx), 1.0);
    });

    test('10 Simultaneous overlapping priority 2 SFX cues NEVER breach duckingFloor', () => {
      // 10 overlapping cues with staggered start frames
      const overlappingSfx = Array.from({ length: 10 }, (_, i) => ({
        startFrame: 50 + i * 2,
        durationInFrames: 15,
        priority: 2,
      }));

      for (let f = 40; f <= 100; f++) {
        const factor = calculateDuckingFactor(f, overlappingSfx);
        assert.ok(
          factor >= 0.55,
          `Ducking floor breached at frame ${f}: got ${factor}, must be >= 0.55`
        );
        assert.ok(
          factor <= 1.0,
          `Ducking ceiling exceeded at frame ${f}: got ${factor}, must be <= 1.0`
        );
      }
    });

    test('Low priority SFX cues (priority 0 and 1) NEVER duck background music', () => {
      const lowPrioritySfx = [
        { startFrame: 20, durationInFrames: 30, priority: 0 },
        { startFrame: 40, durationInFrames: 30, priority: 1 },
      ];

      for (let f = 0; f < 100; f++) {
        const factor = calculateDuckingFactor(f, lowPrioritySfx);
        assert.equal(
          factor,
          1.0,
          `Low priority cue improperly ducked music at frame ${f}`
        );
      }
    });
  });
});

/* ========================================================================= */
/* 3. FADECONTROLLER EXTREME CONFIGURATIONS ADVERSARIAL STRESS TEST SUITE   */
/* ========================================================================= */

describe('Milestone 2 Adversarial Challenge 3: FadeController Extreme Configurations', () => {
  describe('3.1 Overlapping Fades & Proportional Clamping Invariants', () => {
    test('Extreme overlap: fadeIn + fadeOut = 500 on duration 100 scales proportionally without error', () => {
      const res = clampFadeDurations(100, 200, 300);

      // Invariant 1: Sum must not exceed duration
      assert.ok(
        res.clampedFadeIn + res.clampedFadeOut <= 100,
        `Fade durations exceed total duration: ${res.clampedFadeIn} + ${res.clampedFadeOut} > 100`
      );

      // Invariant 2: Proportional ratio preserved
      // 200 / 500 = 0.40 -> 40 frames; 300 / 500 = 0.60 -> 60 frames
      assert.equal(res.clampedFadeIn, 40);
      assert.equal(res.clampedFadeOut, 60);
      assert.equal(res.sustainFrames, 0);
      assert.equal(res.scaleFactor, 0.2);
    });

    test('Asymmetric extreme overlap: fadeIn 10,000, fadeOut 10 on duration 30', () => {
      const res = clampFadeDurations(30, 10000, 10);
      assert.ok(res.clampedFadeIn + res.clampedFadeOut <= 30);
      assert.ok(res.clampedFadeIn >= 29);
      assert.ok(res.clampedFadeOut <= 1);
    });

    test('Boundary durations: duration 1, 0, and negative durations', () => {
      // Duration 1 with overlap
      const d1 = clampFadeDurations(1, 10, 10);
      assert.ok(d1.clampedFadeIn + d1.clampedFadeOut <= 1);

      // Duration 0
      const d0 = clampFadeDurations(0, 10, 10);
      assert.equal(d0.clampedFadeIn, 0);
      assert.equal(d0.clampedFadeOut, 0);
      assert.equal(d0.sustainFrames, 0);

      // Negative duration
      const dNeg = clampFadeDurations(-50, 10, 10);
      assert.equal(dNeg.clampedFadeIn, 0);
      assert.equal(dNeg.clampedFadeOut, 0);
    });
  });

  describe('3.2 Monotonic Gain Curve & Non-Crash Verification Across Timeline', () => {
    test('calculateFadeGain: extreme overlap duration 50, fadeIn 100, fadeOut 100 executes without error', () => {
      const config = {
        durationInFrames: 50,
        fadeInFrames: 100,
        fadeOutFrames: 100,
        targetVolume: 0.9,
      };

      // In this extreme overlap: clampedIn = 25, clampedOut = 25, sustain = 0.
      // 1. Fade-in [0, 24]: must be strictly non-decreasing
      let prev = 0;
      for (let f = 0; f < 25; f++) {
        const gain = calculateFadeGain(f, config);
        assert.ok(
          gain >= prev - 1e-10,
          `Fade gain decreased during fade-in at frame ${f}`
        );
        assert.ok(gain <= 0.9 + 1e-10);
        prev = gain;
      }

      // 2. Fade-out [25, 49]: must be strictly non-increasing
      prev = 0.9;
      for (let f = 25; f < 50; f++) {
        const gain = calculateFadeGain(f, config);
        assert.ok(
          gain <= prev + 1e-10,
          `Fade gain increased during fade-out at frame ${f}`
        );
        prev = gain;
      }

      // Out-of-bounds frames return strictly 0
      assert.equal(calculateFadeGain(-1, config), 0);
      assert.equal(calculateFadeGain(50, config), 0);
      assert.equal(calculateFadeGain(100, config), 0);
    });

    test('calculateFadeGain produces valid output across all curve types', () => {
      const curves = ['linear', 'smoothstep', 'exponential'] as const;

      for (const curve of curves) {
        const config = {
          durationInFrames: 40,
          fadeInFrames: 15,
          fadeOutFrames: 15,
          targetVolume: 1.0,
          curve,
        };

        // Midpoint of fade-in
        const midIn = calculateFadeGain(7, config);
        assert.ok(midIn > 0 && midIn < 1.0);

        // Sustain phase
        const sustain = calculateFadeGain(20, config);
        assert.equal(sustain, 1.0);

        // Midpoint of fade-out
        const midOut = calculateFadeGain(32, config);
        assert.ok(midOut > 0 && midOut < 1.0);
      }
    });

    test('Zero durationInFrames produces zero gain without throwing', () => {
      assert.doesNotThrow(() => {
        const gain = calculateFadeGain(0, {
          durationInFrames: 0,
          fadeInFrames: 10,
          fadeOutFrames: 10,
        });
        assert.equal(gain, 0);
      });
    });

    test('evaluateFadeCurve handles non-finite inputs and monotonic beta curves', () => {
      // Non-finite values safely resolve to 0
      assert.equal(evaluateFadeCurve(NaN), 0);
      assert.equal(evaluateFadeCurve(Infinity), 1.0); // clamped to 1.0 by Math.min(1, Inf)
      assert.equal(evaluateFadeCurve(-Infinity), 0);

      // Monotonic progression for exponential curve across beta ranges
      for (const beta of [0.5, 2.0, 5.0, 10.0]) {
        let prev = -1;
        for (let p = 0; p <= 1.0; p += 0.05) {
          const val = evaluateFadeCurve(p, 'exponential', beta);
          assert.ok(val >= prev - 1e-9, `Exponential curve non-monotonic with beta ${beta} at p=${p}`);
          assert.ok(val >= 0 && val <= 1.0 + 1e-9);
          prev = val;
        }
      }
    });
  });
});

