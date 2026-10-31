/**
 * tests/adversarial-mapper-adapter.test.ts
 *
 * Adversarial test suite challenging:
 * 1. CoordinateMapper mathematical precision, bounds clamping, NaN/Infinity robustness,
 *    negative canvas handling, and round-trip fidelity.
 * 2. interactionToSceneGraphAdapter transformation robustness, empty events, single event,
 *    100 simultaneous events, extreme corners, camera monotonicity, Bezier control points,
 *    and SFX audio catalog enforcement.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  clamp01,
  clampNormalized,
  clampPixel,
  toPixels,
  toNormalized,
  fitWithinBounds,
  normalizedRectToPixel,
  pixelRectToNormalized,
  mapLocalToCanvasNormalized,
  mapCanvasToLocalNormalized,
  distanceNormalized,
  distancePixel,
  getRectCenterNormalized,
  CoordinateMapper,
} from '../src/lib/interaction-map/CoordinateMapper';
import { InteractionMapSchema } from '../src/lib/interaction-map/schema';
import type { InteractionMap, InteractionEvent } from '../src/lib/interaction-map/types';
import { SceneGraphSchema, AudioAssetSchema } from '../src/lib/scene-graph/schema';
import { interactionToSceneGraphAdapter } from '../src/lib/scene-graph/adapter';
import type { AudioAsset } from '../src/lib/scene-graph/types';

const ALLOWED_AUDIO_ASSETS: AudioAsset[] = [
  'mouse-click',
  'camera-whoosh',
  'keyboard-tap',
  'chime',
  'soft-pop',
  'ambient-beat',
];

describe('Adversarial Challenge 1: CoordinateMapper Mathematical Precision & Robustness', () => {
  describe('1.1 Edge Cases, NaN, Infinity, and Clamping', () => {
    test('clamp handles non-finite values safely by resolving to min', () => {
      assert.equal(clamp(NaN, 0, 1), 0);
      assert.equal(clamp(Infinity, 0, 1), 0);
      assert.equal(clamp(-Infinity, 0, 1), 0);
      assert.equal(clamp(NaN, 10, 20), 10);
      assert.equal(clamp(Infinity, -5, 5), -5);
    });

    test('clamp handles normal and out-of-bounds scalar values', () => {
      assert.equal(clamp(-100, 0, 1), 0);
      assert.equal(clamp(100, 0, 1), 1);
      assert.equal(clamp(0.5, 0, 1), 0.5);
      assert.equal(clamp(0, 0, 1), 0);
      assert.equal(clamp(1, 0, 1), 1);
      assert.equal(clamp(-0.00001, 0, 1), 0);
      assert.equal(clamp(1.00001, 0, 1), 1);
    });

    test('clamp01 adheres strictly to [0.0, 1.0]', () => {
      assert.equal(clamp01(-999), 0.0);
      assert.equal(clamp01(999), 1.0);
      assert.equal(clamp01(0.0), 0.0);
      assert.equal(clamp01(1.0), 1.0);
      assert.equal(clamp01(0.734), 0.734);
      assert.equal(clamp01(NaN), 0.0);
      assert.equal(clamp01(Infinity), 0.0);
      assert.equal(clamp01(-Infinity), 0.0);
    });

    test('clampNormalized clamps 2D point to unit square [0,1]x[0,1]', () => {
      const p = clampNormalized({ x: -10, y: 15 });
      assert.deepEqual(p, { x: 0, y: 1 });

      const nanP = clampNormalized({ x: NaN, y: Infinity });
      assert.deepEqual(nanP, { x: 0, y: 0 });
    });

    test('clampPixel clamps point to canvas boundaries', () => {
      const bounds = { width: 1920, height: 1080 };
      assert.deepEqual(clampPixel({ x: -50, y: 1500 }, bounds), { x: 0, y: 1080 });
      assert.deepEqual(clampPixel({ x: 960, y: 540 }, bounds), { x: 960, y: 540 });
      assert.deepEqual(clampPixel({ x: NaN, y: Infinity }, bounds), { x: 0, y: 0 });
    });

    test('distance and center helper methods operate correctly', () => {
      const dNorm = distanceNormalized({ x: 0, y: 0 }, { x: 3, y: 4 });
      assert.equal(dNorm, 5);

      const dPix = distancePixel({ x: 10, y: 20 }, { x: 10, y: 50 });
      assert.equal(dPix, 30);

      const center = getRectCenterNormalized({ x: 0.2, y: 0.4, width: 0.4, height: 0.2 });
      assert.equal(center.x, 0.4);
      assert.equal(center.y, 0.5);

      assert.equal(CoordinateMapper.clamp01(0.5), 0.5);
    });
  });

  describe('1.2 Negative, Zero, and Non-Finite Canvas Dimensions', () => {
    const invalidDimensions = [
      { width: -1920, height: 1080, desc: 'negative width' },
      { width: 1920, height: -1080, desc: 'negative height' },
      { width: 0, height: 1080, desc: 'zero width' },
      { width: 1920, height: 0, desc: 'zero height' },
      { width: -100, height: -100, desc: 'both negative' },
      { width: NaN, height: 1080, desc: 'NaN width' },
      { width: 1920, height: NaN, desc: 'NaN height' },
      { width: Infinity, height: 1080, desc: 'Infinity width' },
      { width: 1920, height: Infinity, desc: 'Infinity height' },
      { width: -Infinity, height: 1080, desc: '-Infinity width' },
    ];

    for (const { width, height, desc } of invalidDimensions) {
      test(`toPixels rejects ${desc} (${width}x${height}) with RangeError`, () => {
        assert.throws(
          () => toPixels({ x: 0.5, y: 0.5 }, { width, height }),
          RangeError
        );
      });

      test(`toNormalized rejects ${desc} (${width}x${height}) with RangeError`, () => {
        assert.throws(
          () => toNormalized({ x: 500, y: 500 }, { width, height }),
          RangeError
        );
      });
    }

    test('fitWithinBounds rejects invalid source and target dimensions with RangeError', () => {
      assert.throws(
        () => fitWithinBounds({ width: -100, height: 100 }, { width: 1920, height: 1080 }),
        RangeError
      );
      assert.throws(
        () => fitWithinBounds({ width: 100, height: 100 }, { width: 0, height: 1080 }),
        RangeError
      );
      assert.throws(
        () => fitWithinBounds({ width: NaN, height: 100 }, { width: 1920, height: 1080 }),
        RangeError
      );
    });

    test('mapCanvasToLocalNormalized rejects container rect with non-positive dimensions', () => {
      assert.throws(
        () => mapCanvasToLocalNormalized({ x: 0.5, y: 0.5 }, { x: 0, y: 0, width: 0, height: 1 }),
        RangeError
      );
      assert.throws(
        () => mapCanvasToLocalNormalized({ x: 0.5, y: 0.5 }, { x: 0, y: 0, width: 1, height: -1 }),
        RangeError
      );
    });
  });

  describe('1.3 Round-Trip Mathematical Accuracy: toNormalized(toPixels(u, v)) == (u, v)', () => {
    const resolutions = [
      { width: 1920, height: 1080, name: '1080p FHD' },
      { width: 1080, height: 1920, name: '9:16 Vertical Story' },
      { width: 1080, height: 1080, name: '1:1 Square' },
      { width: 3840, height: 2160, name: '4K UHD' },
      { width: 1280, height: 720, name: '720p HD' },
      { width: 2560, height: 1440, name: '1440p QHD' },
      { width: 1366, height: 768, name: '1366x768 Common Laptop' },
      { width: 1240, height: 680, name: 'Custom Surface' },
      { width: 997, height: 1009, name: 'Prime Dimensions' },
      { width: 7, height: 13, name: 'Small Prime Resolution' },
      { width: 1, height: 1, name: 'Minimal 1x1' },
    ];

    test('Canonical corner and boundary round-trips are exact', () => {
      const canonicalPoints = [
        { x: 0.0, y: 0.0 },
        { x: 1.0, y: 1.0 },
        { x: 0.0, y: 1.0 },
        { x: 1.0, y: 0.0 },
        { x: 0.5, y: 0.5 },
        { x: 0.25, y: 0.75 },
        { x: 0.125, y: 0.875 },
      ];

      for (const res of resolutions) {
        for (const pt of canonicalPoints) {
          const px = toPixels(pt, res, false);
          const norm = toNormalized(px, res, true);
          assert.equal(norm.x, pt.x, `norm.x mismatch at ${res.name} for point (${pt.x}, ${pt.y})`);
          assert.equal(norm.y, pt.y, `norm.y mismatch at ${res.name} for point (${pt.x}, ${pt.y})`);
        }
      }
    });

    test('Large-scale random round-trip numerical precision across 10,000 points', () => {
      let maxErrorX = 0;
      let maxErrorY = 0;
      let exactMatches = 0;
      const NUM_SAMPLES = 1000; // 1,000 per resolution x 10 resolutions = 10,000 checks

      for (const res of resolutions.slice(0, 10)) {
        for (let i = 0; i < NUM_SAMPLES; i++) {
          const u = Math.random();
          const v = Math.random();

          const px = toPixels({ x: u, y: v }, res, false);
          const norm = toNormalized(px, res, true);

          const errX = Math.abs(norm.x - u);
          const errY = Math.abs(norm.y - v);

          if (errX > maxErrorX) maxErrorX = errX;
          if (errY > maxErrorY) maxErrorY = errY;

          if (errX === 0 && errY === 0) exactMatches++;

          // Maximum floating point drift must not exceed IEEE 754 epsilon margin (1e-14)
          assert.ok(
            errX < 1e-14,
            `Float drift X too large: ${errX} for u=${u} in ${res.name}`
          );
          assert.ok(
            errY < 1e-14,
            `Float drift Y too large: ${errY} for v=${v} in ${res.name}`
          );
        }
      }

      console.log(`[PASS] Round-trip verified: Max error X = ${maxErrorX.toExponential(4)}, Max error Y = ${maxErrorY.toExponential(4)}, Exact matches = ${exactMatches}/10000`);
    });

    test('Integer snapping behaves deterministically within 0.5px quantization bound', () => {
      const res = { width: 1920, height: 1080 };
      for (let i = 0; i < 500; i++) {
        const u = Math.random();
        const v = Math.random();
        const pxSnapped = toPixels({ x: u, y: v }, res, true);

        assert.equal(Number.isInteger(pxSnapped.x), true);
        assert.equal(Number.isInteger(pxSnapped.y), true);

        const normSnapped = toNormalized(pxSnapped, res, true);
        const errX = Math.abs(normSnapped.x - u);
        const errY = Math.abs(normSnapped.y - v);

        // Discretization error bounded by 0.5 / dimension
        assert.ok(errX <= 0.5 / res.width + 1e-12);
        assert.ok(errY <= 0.5 / res.height + 1e-12);
      }
    });

    test('Rect round-trip conversion preserves geometry', () => {
      const canvas = { width: 1920, height: 1080 };
      const originalRect = { x: 0.1, y: 0.2, width: 0.4, height: 0.5 };
      const pxRect = normalizedRectToPixel(originalRect, canvas, false);
      const recoveredRect = pixelRectToNormalized(pxRect, canvas, true);

      assert.ok(Math.abs(recoveredRect.x - originalRect.x) < 1e-14);
      assert.ok(Math.abs(recoveredRect.y - originalRect.y) < 1e-14);
      assert.ok(Math.abs(recoveredRect.width - originalRect.width) < 1e-14);
      assert.ok(Math.abs(recoveredRect.height - originalRect.height) < 1e-14);
    });

    test('Local to canvas normalized round-trip', () => {
      const containerRect = { x: 0.2, y: 0.3, width: 0.6, height: 0.4 };
      const localPt = { x: 0.75, y: 0.25 };
      const canvasPt = mapLocalToCanvasNormalized(localPt, containerRect);
      const recoveredPt = mapCanvasToLocalNormalized(canvasPt, containerRect);

      assert.ok(Math.abs(recoveredPt.x - localPt.x) < 1e-14);
      assert.ok(Math.abs(recoveredPt.y - localPt.y) < 1e-14);
    });
  });
});

describe('Adversarial Challenge 2: interactionToSceneGraphAdapter Transformation Robustness', () => {
  function createValidMap(events: InteractionEvent[], duration = 480): InteractionMap {
    return {
      version: '2.0',
      baseResolution: { width: 1920, height: 1080 },
      fps: 30,
      durationInFrames: duration,
      events,
    };
  }

  test('2.1 Empty events array produces 100% valid SceneGraph', () => {
    const emptyMap = createValidMap([]);
    InteractionMapSchema.parse(emptyMap);

    const sceneGraph = interactionToSceneGraphAdapter(emptyMap);
    const parsed = SceneGraphSchema.parse(sceneGraph);

    assert.equal(parsed.version, '2.0');
    assert.equal(parsed.canvas.durationInFrames, 480);
    assert.ok(parsed.cameraTrack.length > 0, 'Camera track must have establishing keyframes');
    assert.ok(parsed.cursorTrack.length > 0, 'Cursor track must have initial rest position');
    assert.ok(parsed.audioTrack.length > 0, 'Audio track must have ambient beat and outro chime');
    assert.ok(parsed.scenes.length > 0, 'Scenes must have at least one scene');

    // Camera track strictly monotonic
    for (let i = 1; i < parsed.cameraTrack.length; i++) {
      assert.ok(
        parsed.cameraTrack[i].frame > parsed.cameraTrack[i - 1].frame,
        `Camera keyframes must be strictly monotonic: frame ${parsed.cameraTrack[i].frame} not > ${parsed.cameraTrack[i - 1].frame}`
      );
    }
  });

  test('2.2 Single event variations (at start, middle, and end frames)', () => {
    const singleEventScenarios: InteractionEvent[][] = [
      // Single event at frame 0
      [
        {
          id: 'evt-0',
          type: 'hover',
          frame: 0,
          x: 0.1,
          y: 0.2,
          provenance: 'observed',
        },
      ],
      // Single click in middle
      [
        {
          id: 'evt-click-mid',
          type: 'click',
          frame: 240,
          x: 0.5,
          y: 0.5,
          provenance: 'observed',
        },
      ],
      // Single focus at final frame
      [
        {
          id: 'evt-focus-end',
          type: 'focus',
          frame: 480,
          x: 0.85,
          y: 0.75,
          provenance: 'simulated',
        },
      ],
    ];

    for (const events of singleEventScenarios) {
      const map = createValidMap(events);
      InteractionMapSchema.parse(map);

      const sg = interactionToSceneGraphAdapter(map);
      const parsed = SceneGraphSchema.parse(sg);

      // Verify camera monotonicity
      for (let i = 1; i < parsed.cameraTrack.length; i++) {
        assert.ok(
          parsed.cameraTrack[i].frame > parsed.cameraTrack[i - 1].frame,
          `Camera track non-monotonic: ${parsed.cameraTrack[i - 1].frame} -> ${parsed.cameraTrack[i].frame}`
        );
      }

      // Verify all audio cues are in allowed catalog
      for (const cue of parsed.audioTrack) {
        assert.ok(
          ALLOWED_AUDIO_ASSETS.includes(cue.asset),
          `Unauthorized audio asset: ${cue.asset}`
        );
        assert.equal(AudioAssetSchema.safeParse(cue.asset).success, true);
      }
    }
  });

  test('2.3 100 Simultaneous events on the same frame', () => {
    const simultaneousEvents: InteractionEvent[] = [];
    const targetFrame = 120;

    for (let i = 0; i < 100; i++) {
      const type: 'click' | 'hover' | 'focus' | 'scroll' =
        i % 4 === 0 ? 'click' : i % 4 === 1 ? 'focus' : i % 4 === 2 ? 'hover' : 'scroll';
      simultaneousEvents.push({
        id: `simultaneous-evt-${i}`,
        type,
        frame: targetFrame,
        x: (i % 10) / 10,
        y: Math.floor(i / 10) / 10,
        provenance: 'simulated',
      });
    }

    const map = createValidMap(simultaneousEvents, 480);
    InteractionMapSchema.parse(map);

    const sg = interactionToSceneGraphAdapter(map);
    const parsed = SceneGraphSchema.parse(sg);

    // 1. Strict camera monotonicity check
    for (let i = 1; i < parsed.cameraTrack.length; i++) {
      assert.ok(
        parsed.cameraTrack[i].frame > parsed.cameraTrack[i - 1].frame,
        `Camera track must be strictly monotonic: ${parsed.cameraTrack[i - 1].frame} -> ${parsed.cameraTrack[i].frame}`
      );
      assert.ok(parsed.cameraTrack[i].frame <= 480, 'Keyframe frame must be <= durationInFrames');
    }

    // 2. Cursor track monotonicity
    for (let i = 1; i < parsed.cursorTrack.length; i++) {
      assert.ok(
        parsed.cursorTrack[i].frame >= parsed.cursorTrack[i - 1].frame,
        `Cursor track must be monotonic: ${parsed.cursorTrack[i - 1].frame} -> ${parsed.cursorTrack[i].frame}`
      );
    }

    // 3. Audio cue uniqueness
    const cueIds = new Set<string>();
    for (const cue of parsed.audioTrack) {
      assert.ok(!cueIds.has(cue.id), `Duplicate audio cue ID found: ${cue.id}`);
      cueIds.add(cue.id);
      assert.ok(ALLOWED_AUDIO_ASSETS.includes(cue.asset), `Unauthorized audio asset: ${cue.asset}`);
    }

    console.log(`[PASS] 100 simultaneous events handled: ${parsed.cameraTrack.length} cam keyframes, ${parsed.cursorTrack.length} cursor keyframes, ${parsed.audioTrack.length} audio cues`);
  });

  test('2.4 Extreme corner events at (0, 0) and (1, 1)', () => {
    const extremeEvents: InteractionEvent[] = [
      { id: 'corner-00', type: 'click', frame: 30, x: 0.0, y: 0.0, provenance: 'observed' },
      { id: 'corner-11', type: 'click', frame: 90, x: 1.0, y: 1.0, provenance: 'observed' },
      { id: 'corner-01', type: 'hover', frame: 150, x: 0.0, y: 1.0, provenance: 'observed' },
      { id: 'corner-10', type: 'focus', frame: 210, x: 1.0, y: 0.0, provenance: 'simulated' },
      { id: 'corner-00-again', type: 'click', frame: 270, x: 0.0, y: 0.0, provenance: 'observed' },
      { id: 'corner-11-again', type: 'click', frame: 330, x: 1.0, y: 1.0, provenance: 'observed' },
    ];

    const map = createValidMap(extremeEvents, 480);
    InteractionMapSchema.parse(map);

    const sg = interactionToSceneGraphAdapter(map);
    const parsed = SceneGraphSchema.parse(sg);

    // Verify camera keyframes optical bounds
    for (const kf of parsed.cameraTrack) {
      assert.ok(kf.x >= 0.0 && kf.x <= 1.0, `Camera focal X out of [0, 1]: ${kf.x}`);
      assert.ok(kf.y >= 0.0 && kf.y <= 1.0, `Camera focal Y out of [0, 1]: ${kf.y}`);
      assert.ok(kf.zoom >= 0.8 && kf.zoom <= 3.5, `Camera zoom out of [0.8, 3.5]: ${kf.zoom}`);
    }

    // Verify cursor keyframes and Bezier control points
    for (const kf of parsed.cursorTrack) {
      assert.ok(kf.x >= 0.0 && kf.x <= 1.0, `Cursor X out of [0, 1]: ${kf.x}`);
      assert.ok(kf.y >= 0.0 && kf.y <= 1.0, `Cursor Y out of [0, 1]: ${kf.y}`);

      if (kf.controlX !== undefined) {
        assert.ok(Number.isFinite(kf.controlX), `controlX is non-finite: ${kf.controlX}`);
        assert.ok(kf.controlX >= 0.0 && kf.controlX <= 1.0, `controlX out of bounds: ${kf.controlX}`);
      }
      if (kf.controlY !== undefined) {
        assert.ok(Number.isFinite(kf.controlY), `controlY is non-finite: ${kf.controlY}`);
        assert.ok(kf.controlY >= 0.0 && kf.controlY <= 1.0, `controlY out of bounds: ${kf.controlY}`);
      }
    }
  });

  test('2.5 Injected unauthorized audio cue in metadata is strictly rejected/ignored', () => {
    const maliciousEvents: InteractionEvent[] = [
      {
        id: 'malicious-cue-1',
        type: 'hover',
        frame: 50,
        x: 0.5,
        y: 0.5,
        provenance: 'simulated',
        metadata: {
          audioCue: 'unauthorized-heavy-explosion.wav',
        },
      },
      {
        id: 'malicious-cue-2',
        type: 'click',
        frame: 100,
        x: 0.5,
        y: 0.5,
        provenance: 'simulated',
        metadata: {
          audioCue: 'malicious-script-exec',
        },
      },
      {
        id: 'valid-cue-3',
        type: 'hover',
        frame: 150,
        x: 0.5,
        y: 0.5,
        provenance: 'simulated',
        metadata: {
          audioCue: 'keyboard-tap',
        },
      },
    ];

    const map = createValidMap(maliciousEvents, 300);
    const sg = interactionToSceneGraphAdapter(map);
    const parsed = SceneGraphSchema.parse(sg);

    // Ensure NONE of the unauthorized assets made it into the scene graph
    for (const cue of parsed.audioTrack) {
      assert.notEqual(cue.asset, 'unauthorized-heavy-explosion.wav');
      assert.notEqual(cue.asset, 'malicious-script-exec');
      assert.ok(ALLOWED_AUDIO_ASSETS.includes(cue.asset));
    }

    // Verify keyboard-tap was properly scheduled
    const tapCue = parsed.audioTrack.find((c) => c.asset === 'keyboard-tap');
    assert.ok(tapCue, 'Authorized keyboard-tap cue should be scheduled');
  });

  test('2.6 Multi-scene generation and custom options conformance', () => {
    const map = createValidMap([
      { id: 'e1', type: 'click', frame: 60, x: 0.3, y: 0.4, provenance: 'observed' },
      { id: 'e2', type: 'focus', frame: 180, x: 0.7, y: 0.6, provenance: 'inferred' },
    ]);

    const multiSg = interactionToSceneGraphAdapter(map, {
      generateMultiSceneSequence: true,
      artDirection: {
        backdropVariant: 'aurora-blur',
        surfaceTheme: 'light',
        primaryAccent: '#3B82F6',
      },
      camera: {
        overviewZoom: 1.1,
        focusZoom: 2.8,
      },
    });

    const parsedMulti = SceneGraphSchema.parse(multiSg);
    assert.equal(parsedMulti.scenes.length, 4);
    assert.equal(parsedMulti.artDirection.backdropVariant, 'aurora-blur');
    assert.equal(parsedMulti.artDirection.surfaceTheme, 'light');
    assert.equal(parsedMulti.artDirection.primaryAccent, '#3B82F6');

    // Verify total scene coverage
    for (const scene of parsedMulti.scenes) {
      assert.ok(scene.startFrame <= parsedMulti.canvas.durationInFrames);
      assert.ok(scene.durationInFrames > 0);
    }
  });
});
