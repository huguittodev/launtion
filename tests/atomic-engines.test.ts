/**
 * tests/atomic-engines.test.ts
 *
 * Comprehensive Automated Verification Suite for Milestone 2: Atomic Engines:
 * 1. Camera Engine: Zero focal drift benchmark (e <= 0.5px, analytical e == 0),
 *    rotation-compensated translation D = S * R * (C - Pf), FocalTracker, and CameraPath.
 * 2. Cursor Engine: BezierPath quadratic and cubic curves, collinear midpoint invariance,
 *    biomechanic easing, arc control points, and multi-keyframe track interpolation.
 * 3. Audio Engine: FadeController monotonic curves, clamping invariants, AudioMixer
 *    soft-knee limiter ceiling (bounded <= 0.95), and AudioTimeline scheduling.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateCameraTransform,
  createRotationMatrix3D,
  degToRad,
} from '../remotion/motion-kit/camera/CameraTransform';
import {
  normalizeFocalPoint,
  clampFocalToZoomBounds,
  getFocalVisibleRect,
} from '../remotion/motion-kit/camera/FocalTracker';
import {
  evaluateCameraPath,
  evaluateEasing,
} from '../remotion/motion-kit/camera/CameraPath';
import {
  quadraticBezier,
  quadraticBezierDerivative,
  cubicBezier,
  interpolateBezierSegment,
  interpolateCursorTrack,
  computeArcControlPoint,
  pureEasing,
  type Point2D,
} from '../remotion/motion-kit/cursor/BezierPath';
import {
  clampFadeDurations,
  evaluateFadeCurve,
  calculateFadeGain,
} from '../remotion/motion-kit/audio/FadeController';
import {
  softLimitGain,
  calculateDuckingFactor,
} from '../remotion/motion-kit/audio/AudioMixer';
import {
  buildAudioTimeline,
  getActiveCuesAtFrame,
  SFX_CATALOG,
} from '../remotion/motion-kit/audio/AudioTimeline';
import type { AudioCue, CameraKeyframe, CursorKeyframe } from '../src/lib/scene-graph/types';

describe('Milestone 2: Atomic Engines Verification Suite', () => {
  /* ======================================================================= */
  /* 1. CAMERA ENGINE VERIFICATION                                           */
  /* ======================================================================= */
  describe('1. Camera Engine & 3D Transform Physics', () => {
    test('1.1 Zero focal drift benchmark: drift <= 0.5px across 1,000 parameter combinations', () => {
      const W = 1920;
      const H = 1080;
      const perspective = 1200;

      let maxNumericalDrift = 0;

      // Deterministic pseudo-random sequence for repeatability
      for (let i = 0; i < 1000; i++) {
        const u = 0.05 + ((i * 37) % 100) * 0.009; // 0.05 to 0.95
        const v = 0.05 + ((i * 53) % 100) * 0.009; // 0.05 to 0.95
        const zoom = 0.8 + ((i * 17) % 100) * 0.027; // 0.8 to 3.5
        const rx = -15 + ((i * 11) % 100) * 0.3; // -15 to +15 deg
        const ry = -15 + ((i * 23) % 100) * 0.3; // -15 to +15 deg
        const rz = -10 + ((i * 29) % 100) * 0.2; // -10 to +10 deg

        const result = calculateCameraTransform({
          viewport: { width: W, height: H },
          focalPoint: { x: u, y: v },
          zoom,
          rotation: { rotateX: rx, rotateY: ry, rotateZ: rz },
          perspective,
        });

        // The analytical focal drift must be mathematically bounded to <= 0.5px
        assert.ok(
          result.focalDrift <= 0.5,
          `Drift exceeded 0.5px threshold: got ${result.focalDrift}px at iteration ${i}`
        );

        if (result.focalDrift > maxNumericalDrift) {
          maxNumericalDrift = result.focalDrift;
        }

        // Verify gimbal origin is strictly pinned to optical center
        assert.equal(result.transformOrigin, '50% 50%');
        assert.equal(result.perspectiveOrigin, '50% 50%');
      }

      // Max numerical drift should be virtually zero (floating point precision)
      assert.ok(
        maxNumericalDrift < 1e-6,
        `Expected near-zero machine precision drift, got ${maxNumericalDrift}`
      );
    });

    test('1.2 Optical center invariance: focal (0.5, 0.5) with zero rotation and zoom 1.0 produces zero translation', () => {
      const result = calculateCameraTransform({
        viewport: { width: 1920, height: 1080 },
        focalPoint: { x: 0.5, y: 0.5 },
        zoom: 1.0,
        rotation: { rotateX: 0, rotateY: 0, rotateZ: 0 },
      });

      assert.equal(result.translation.x, 0);
      assert.equal(result.translation.y, 0);
      assert.equal(result.translation.z, 0);
      assert.equal(result.focalDrift, 0);
      assert.ok(result.transform.includes('translate3d(0px, 0px, 0px) scale(1) rotateX(0deg) rotateY(0deg) rotateZ(0deg)'));
    });

    test('1.3 3D Rotation matrix orthogonality: R * R^T = Identity', () => {
      const angles = [
        { rx: 12, ry: -8, rz: 5 },
        { rx: -25, ry: 15, rz: -12 },
        { rx: 0, ry: 45, rz: 0 },
      ];

      for (const { rx, ry, rz } of angles) {
        const R = createRotationMatrix3D(rx, ry, rz);

        // Multiply R * R^T
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            let dot = 0;
            for (let k = 0; k < 3; k++) {
              dot += R[row * 3 + k] * R[col * 3 + k];
            }
            const expected = row === col ? 1.0 : 0.0;
            assert.ok(
              Math.abs(dot - expected) < 1e-10,
              `Orthogonality failed at row ${row}, col ${col}: got ${dot}, expected ${expected}`
            );
          }
        }
      }
    });

    test('1.4 FocalTracker: legacy percentage auto-detection and bounds clamping', () => {
      // Legacy percentages [0 - 100] converted to [0.0, 1.0]
      const legacyPoint = normalizeFocalPoint({ x: 38, y: 54 });
      assert.ok(Math.abs(legacyPoint.x - 0.38) < 1e-9);
      assert.ok(Math.abs(legacyPoint.y - 0.54) < 1e-9);

      // Already normalized values stay unchanged
      const normPoint = normalizeFocalPoint({ x: 0.75, y: 0.25 });
      assert.equal(normPoint.x, 0.75);
      assert.equal(normPoint.y, 0.25);

      // Non-finite values safely resolve to center (0.5, 0.5)
      const nanPoint = normalizeFocalPoint({ x: NaN, y: Infinity });
      assert.equal(nanPoint.x, 0.5);
      assert.equal(nanPoint.y, 0.5);

      // Zoom containment: at zoom 2.0, half visible extent is 0.25.
      // A focal point at 0.10 must be clamped to at least 0.25.
      const clamped = clampFocalToZoomBounds({ x: 0.10, y: 0.95 }, 2.0);
      assert.equal(clamped.x, 0.25);
      assert.equal(clamped.y, 0.75);

      // Visible rectangle at zoom 2.0
      const rect = getFocalVisibleRect({ x: 0.5, y: 0.5 }, 2.0, { width: 1920, height: 1080 });
      assert.equal(rect.width, 960);
      assert.equal(rect.height, 540);
      assert.equal(rect.x, 480);
      assert.equal(rect.y, 270);
    });

    test('1.5 CameraPath: multi-keyframe trajectory deterministic evaluation', () => {
      const track: CameraKeyframe[] = [
        { frame: 10, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0, easing: 'ease-in-out' },
        { frame: 40, x: 0.3, y: 0.7, zoom: 2.0, rotateX: 10, easing: 'ease-in-out' },
        { frame: 70, x: 0.8, y: 0.2, zoom: 1.5, rotateX: -5, easing: 'linear' },
      ];

      // Before first keyframe
      const before = evaluateCameraPath(track, 5);
      assert.equal(before.x, 0.5);
      assert.equal(before.zoom, 1.0);

      // Exactly at keyframe 1
      const atK1 = evaluateCameraPath(track, 10);
      assert.equal(atK1.x, 0.5);
      assert.equal(atK1.zoom, 1.0);

      // Midpoint between k1 and k2 (frame 25)
      const mid = evaluateCameraPath(track, 25);
      assert.ok(mid.x < 0.5 && mid.x > 0.3);
      assert.ok(mid.zoom > 1.0 && mid.zoom < 2.0);

      // Exactly at keyframe 2
      const atK2 = evaluateCameraPath(track, 40);
      assert.equal(atK2.x, 0.3);
      assert.equal(atK2.zoom, 2.0);
      assert.equal(atK2.rotateX, 10);

      // Beyond last keyframe
      const after = evaluateCameraPath(track, 100);
      assert.equal(after.x, 0.8);
      assert.equal(after.zoom, 1.5);
      assert.equal(after.rotateX, -5);

      // Unsorted track should produce identical results
      const unsortedTrack = [track[2], track[0], track[1]];
      const unsortedResult = evaluateCameraPath(unsortedTrack, 25);
      assert.equal(unsortedResult.x, mid.x);
      assert.equal(unsortedResult.zoom, mid.zoom);
    });

    test('1.6 Math helpers: degToRad and evaluateEasing curves', () => {
      assert.equal(degToRad(0), 0);
      assert.ok(Math.abs(degToRad(180) - Math.PI) < 1e-10);
      assert.equal(evaluateEasing(0, 'linear'), 0);
      assert.equal(evaluateEasing(1, 'linear'), 1);
      assert.equal(evaluateEasing(0.5, 'linear'), 0.5);
      assert.ok(evaluateEasing(0.5, 'cubic') > 0.5);
      assert.equal(evaluateEasing(0, 'spring'), 0);
      assert.equal(evaluateEasing(1, 'spring'), 1);
    });
  });

  /* ======================================================================= */
  /* 2. MOTION & CURSOR ENGINE VERIFICATION                                  */
  /* ======================================================================= */
  describe('2. Motion & Cursor Engine (Bezier Curves & Kinematics)', () => {
    const p0: Point2D = { x: 100, y: 200 };
    const pc: Point2D = { x: 250, y: 50 };
    const p1: Point2D = { x: 400, y: 300 };

    test('2.1 Quadratic Bezier B2(s) boundary and collinear midpoint invariance', () => {
      // s = 0 returns P0
      const start = quadraticBezier(p0, pc, p1, 0);
      assert.equal(start.x, 100);
      assert.equal(start.y, 200);

      // s = 1 returns P1
      const end = quadraticBezier(p0, pc, p1, 1);
      assert.equal(end.x, 400);
      assert.equal(end.y, 300);

      // Collinear midpoint property: when Pc = (P0 + P1)/2, curve equals linear interpolation
      const midPc: Point2D = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      for (const s of [0.1, 0.25, 0.5, 0.75, 0.9]) {
        const bezierPt = quadraticBezier(p0, midPc, p1, s);
        const linearPt = {
          x: (1 - s) * p0.x + s * p1.x,
          y: (1 - s) * p0.y + s * p1.y,
        };
        assert.ok(Math.abs(bezierPt.x - linearPt.x) < 1e-10);
        assert.ok(Math.abs(bezierPt.y - linearPt.y) < 1e-10);
      }
    });

    test('2.2 Quadratic Bezier derivative matches finite difference approximation', () => {
      const s = 0.45;
      const analyticalDeriv = quadraticBezierDerivative(p0, pc, p1, s);

      // Numerical finite difference: (B(s + eps) - B(s - eps)) / (2 * eps)
      const eps = 1e-6;
      const fPlus = quadraticBezier(p0, pc, p1, s + eps);
      const fMinus = quadraticBezier(p0, pc, p1, s - eps);
      const numericalDx = (fPlus.x - fMinus.x) / (2 * eps);
      const numericalDy = (fPlus.y - fMinus.y) / (2 * eps);

      assert.ok(Math.abs(analyticalDeriv.x - numericalDx) < 1e-5);
      assert.ok(Math.abs(analyticalDeriv.y - numericalDy) < 1e-5);
    });

    test('2.3 Cubic Bezier B3(s) boundary and interpolation', () => {
      const pc1 = { x: 150, y: 100 };
      const pc2 = { x: 300, y: 50 };

      const start = cubicBezier(p0, pc1, pc2, p1, 0);
      assert.equal(start.x, p0.x);
      assert.equal(start.y, p0.y);

      const end = cubicBezier(p0, pc1, pc2, p1, 1);
      assert.equal(end.x, p1.x);
      assert.equal(end.y, p1.y);
    });

    test('2.4 Biomechanical cursor easing curve monotonicity and boundary bounds', () => {
      assert.equal(pureEasing.biomechanicCursor(0), 0);
      assert.ok(Math.abs(pureEasing.biomechanicCursor(1) - 1) < 1e-9);

      // Strictly increasing monotonic velocity
      let prev = -1;
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const val = pureEasing.biomechanicCursor(t);
        assert.ok(val >= prev, `Easing monotonicity violated at t=${t}`);
        assert.ok(val >= 0 && val <= 1, `Easing value out of bounds: ${val}`);
        prev = val;
      }
    });

    test('2.5 Perpendicular arc control point computation', () => {
      const ptA = { x: 0.2, y: 0.5 };
      const ptB = { x: 0.8, y: 0.5 };

      // For a horizontal chord with upward bias, control point must have y < 0.5
      const cp = computeArcControlPoint(ptA, ptB, 0.2, true);
      assert.equal(cp.x, 0.5); // centered horizontally
      assert.ok(cp.y < 0.5, `Upward arc control point y should be < 0.5: got ${cp.y}`);
    });

    test('2.6 Multi-keyframe cursor track interpolation and click detection', () => {
      const cursorTrack: CursorKeyframe[] = [
        { frame: 0, x: 0.1, y: 0.1 },
        { frame: 30, x: 0.5, y: 0.5, controlX: 0.3, controlY: 0.1 },
        { frame: 60, x: 0.8, y: 0.9, click: true },
      ];

      // At start frame
      const s0 = interpolateCursorTrack(cursorTrack, 0);
      assert.equal(s0.x, 0.1);
      assert.equal(s0.y, 0.1);
      assert.equal(s0.isClickActive, false);

      // Between keyframes (curved path)
      const s15 = interpolateCursorTrack(cursorTrack, 15);
      assert.ok(s15.x > 0.1 && s15.x < 0.5);
      assert.ok(s15.y > 0.1 && s15.y < 0.5);

      // At click frame (60)
      const s60 = interpolateCursorTrack(cursorTrack, 60);
      assert.equal(s60.x, 0.8);
      assert.equal(s60.y, 0.9);
      assert.equal(s60.isClickActive, true);
      assert.equal(s60.clickElapsed, 0);

      // 4 frames after click (within 16 frame click window)
      const s64 = interpolateCursorTrack(cursorTrack, 64);
      assert.equal(s64.isClickActive, true);
      assert.equal(s64.clickElapsed, 4);

      // 20 frames after click (past click window)
      const s80 = interpolateCursorTrack(cursorTrack, 80);
      assert.equal(s80.isClickActive, false);
      assert.equal(s80.clickElapsed, -1);
    });

    test('2.7 interpolateBezierSegment straight and curved interpolation', () => {
      const segLinear = interpolateBezierSegment(15, 0, 30, { x: 0, y: 0 }, { x: 100, y: 100 });
      assert.ok(segLinear.x > 0 && segLinear.x < 100);
      assert.ok(segLinear.y > 0 && segLinear.y < 100);

      const segCurved = interpolateBezierSegment(15, 0, 30, { x: 0, y: 0 }, { x: 100, y: 100 }, { x: 50, y: 0 });
      assert.ok(segCurved.x > 0 && segCurved.y >= 0);
    });
  });

  /* ======================================================================= */
  /* 3. AUDIO & SFX ENGINE VERIFICATION                                      */
  /* ======================================================================= */
  describe('3. Audio & SFX Engine (Mixer, Limiter & Fades)', () => {
    test('3.1 FadeController safe clamping invariant: clampedFadeIn + clampedFadeOut <= durationInFrames', () => {
      // Overlapping request: duration 30, fadeIn 25, fadeOut 25 (total 50 > 30)
      const clamped = clampFadeDurations(30, 25, 25);
      assert.ok(clamped.clampedFadeIn + clamped.clampedFadeOut <= 30);
      assert.equal(clamped.clampedFadeIn, 15);
      assert.equal(clamped.clampedFadeOut, 15);
      assert.equal(clamped.sustainFrames, 0);

      // Extreme: zero duration
      const zeroClamped = clampFadeDurations(0, 10, 10);
      assert.equal(zeroClamped.clampedFadeIn, 0);
      assert.equal(zeroClamped.clampedFadeOut, 0);

      // Negative duration
      const negClamped = clampFadeDurations(-50, 10, 10);
      assert.equal(negClamped.clampedFadeIn, 0);
      assert.equal(negClamped.clampedFadeOut, 0);
    });

    test('3.2 FadeController monotonicity across timeline', () => {
      const config = {
        durationInFrames: 120,
        fadeInFrames: 30,
        fadeOutFrames: 40,
        targetVolume: 0.8,
        curve: 'smoothstep' as const,
      };

      // 1. Fade-in segment [0, 29] must be monotonically non-decreasing
      let prev = 0;
      for (let f = 0; f < 30; f++) {
        const gain = calculateFadeGain(f, config);
        assert.ok(gain >= prev, `Fade-in not non-decreasing at frame ${f}`);
        prev = gain;
      }

      // 2. Sustain segment [30, 79] must be constant targetVolume
      for (let f = 30; f < 80; f++) {
        const gain = calculateFadeGain(f, config);
        assert.equal(gain, 0.8, `Sustain gain mismatch at frame ${f}`);
      }

      // 3. Fade-out segment [80, 119] must be monotonically non-increasing
      prev = 0.8;
      for (let f = 80; f < 120; f++) {
        const gain = calculateFadeGain(f, config);
        assert.ok(gain <= prev + 1e-10, `Fade-out not non-increasing at frame ${f}`);
        prev = gain;
      }

      // Frame beyond duration must be 0
      assert.equal(calculateFadeGain(120, config), 0);
      assert.equal(calculateFadeGain(-1, config), 0);
    });

    test('3.3 AudioMixer soft-knee limiter absolute ceiling <= 0.95 under extreme overload', () => {
      // 100 simultaneous voices at volume 1.0 (raw sum = 100.0)
      const { limitedGain, limitFactor } = softLimitGain(100.0, 0.75, 0.95);

      assert.ok(
        limitedGain <= 0.95,
        `Limiter ceiling violated: got ${limitedGain}, must be <= 0.95`
      );
      assert.ok(
        limitedGain > 0.94,
        `Limiter should approach ceiling closely: got ${limitedGain}`
      );
      assert.ok(limitFactor < 0.01, `Limit factor should compress heavily: got ${limitFactor}`);
    });

    test('3.4 AudioMixer bit-perfect linear transparency below knee threshold', () => {
      // Inputs below 0.75 must be completely uncolored (L(S) === S)
      const sparseSums = [0.0, 0.1, 0.25, 0.5, 0.749];
      for (const sum of sparseSums) {
        const { limitedGain, limitFactor } = softLimitGain(sum, 0.75, 0.95);
        assert.equal(limitedGain, sum);
        assert.equal(limitFactor, 1.0);
      }
    });

    test('3.5 Dynamic sidechain ducking envelope calculation', () => {
      const sfx = [
        { startFrame: 50, durationInFrames: 12, priority: 2 }, // camera-whoosh
      ];

      // Well before cue: no ducking (1.0)
      assert.equal(calculateDuckingFactor(40, sfx), 1.0);

      // During hold phase (frame 55): maximum ducking (0.55 default)
      assert.equal(calculateDuckingFactor(55, sfx), 0.55);

      // Well after release phase (frame 80): returned to 1.0
      assert.equal(calculateDuckingFactor(80, sfx), 1.0);
    });

    test('3.6 AudioTimeline: catalog mapping, duration and deduplication', () => {
      const audioTrack: AudioCue[] = [
        { id: 'tap-1', frame: 5, asset: 'keyboard-tap' },
        { id: 'whoosh-1', frame: 20, asset: 'camera-whoosh' },
        { id: 'tap-1', frame: 50, asset: 'keyboard-tap' }, // duplicate id
      ];

      const timeline = buildAudioTimeline({
        audioTrack,
        durationInFrames: 300,
        fps: 30,
      });

      assert.equal(timeline.cues.length, 3);
      // Duplicate ID must be disambiguated
      assert.notEqual(timeline.cues[0].id, timeline.cues[2].id);

      // Catalog properties
      assert.equal(SFX_CATALOG['camera-whoosh'].durationFramesAt30Fps, 12);
      assert.equal(SFX_CATALOG['keyboard-tap'].isMusic, false);

      // Active cue query
      const activeAt22 = getActiveCuesAtFrame(timeline, 22);
      assert.equal(activeAt22.length, 1);
      assert.equal(activeAt22[0].asset, 'camera-whoosh');
    });

    test('3.7 evaluateFadeCurve across linear, smoothstep and exponential curves', () => {
      assert.equal(evaluateFadeCurve(0, 'linear'), 0);
      assert.equal(evaluateFadeCurve(1, 'linear'), 1);
      assert.equal(evaluateFadeCurve(0, 'smoothstep'), 0);
      assert.equal(evaluateFadeCurve(1, 'smoothstep'), 1);
      assert.equal(evaluateFadeCurve(0.5, 'smoothstep'), 0.5);
      assert.equal(evaluateFadeCurve(0, 'exponential'), 0);
      assert.ok(Math.abs(evaluateFadeCurve(1, 'exponential') - 1) < 1e-9);
    });
  });
});
