/**
 * tests/adversarial-phase5-render.test.ts
 *
 * Empirical Adversarial Verification Suite — Phase 5 Challenger 2:
 * Adversarially verify Remotion composition rendering and audio stability for SceneGraphs
 * synthesized via Input Intelligence (Multimodal Analysis) across all 480 frames [0, 480].
 *
 * Verification Scope:
 * 1. SceneGraph Synthesis:
 *    - Deterministic Visual Fallback (golden-ratio SaaS UI zones: nav, search, card, CTA, filter chip)
 *    - Deterministic Fallback with Custom Context & Embedded Asset Data URI
 *    - Gemini Vision Mock Detections (base-1000 integer boxes, parsed from code fences)
 *    - Gemini Vision Mock Detections (unit float boxes with inverted coordinates & bounds healing)
 *    - Adversarial Minimal Detection (single CTA, stressing synthesizer fallback categories)
 * 2. 480-Frame Camera Kinematics & Stability Oracles:
 *    - Camera parameters (position Dx/Dy/Dz, target x/y, effective FOV, rotation) across all frames [0, 480]
 *    - ZERO NaN, ZERO undefined, ZERO Infinity in all parameters and CSS transform strings
 *    - Camera focal drift strictly < 0.1 px (both internal analytical drift and independent CSS 4x4 matrix oracle)
 * 3. 480-Frame SmartCursor Kinematics & Boundary Oracles:
 *    - Cursor coordinates (x, y) strictly bounded within [0.0, 1.0] across all frames [0, 480]
 *    - Dynamic click compression [0.90, 1.00] and physical ripple radius validation
 * 4. Audio Cue Scheduling & Soft-Knee Limiter Oracles:
 *    - Mandatory presence of key SFX cues: 'camera-whoosh', 'keyboard-tap', 'mouse-click', 'chime'
 *    - Valid non-negative frame offsets within duration bounds
 *    - Master gain strictly <= 0.95 across all frames [0, 480] (zero digital clipping)
 *    - High-polyphony stress test with all four SFX overlapping simultaneously at maximum volume
 * 5. Remotion Render Verification:
 *    - Render still frames of InteractiveSurfaceDemo at critical narrative beats [86, 163, 326, 432]
 *    - Binary PNG validation: 8-byte magic header, IHDR dimensions (1920x1080), IEND trailer, size > 25KB
 */

import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { interpolate, Easing } from 'remotion';

import {
  generateDeterministicVisualFallback,
  analyzeMediaWithGeminiVision,
  synthesizeInferredInteractionMap,
  adaptInferredInteractionToSceneGraph,
  normalizeBoundingBox,
  type VisualLandmark,
} from '../src/lib/input-intelligence';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import type { AudioAsset, SceneGraph } from '../src/lib/scene-graph/types';
import { evaluateCameraPath } from '../remotion/motion-kit/camera/CameraPath';
import {
  calculateCameraTransform,
  createRotationMatrix3D,
  type ViewportDimensions,
  type FocalPoint2D,
} from '../remotion/motion-kit/camera/CameraTransform';
import { interpolateCursorTrack } from '../remotion/motion-kit/cursor/BezierPath';
import { buildAudioTimeline } from '../remotion/motion-kit/audio/AudioTimeline';
import { calculateFadeGain } from '../remotion/motion-kit/audio/FadeController';
import { calculateDuckingFactor, softLimitGain } from '../remotion/motion-kit/audio/AudioMixer';

/**
 * Independent CSS Transform Parser & Homogeneous 4x4 Projection Oracle.
 * Simulates browser/Remotion DOM rendering forward kinematics independently:
 * 1. P_rel = Pf - C (relative to optical center C = (W/2, H/2))
 * 2. Rotate R = Rx * Ry * Rz
 * 3. Scale S = zoom
 * 4. Translate D = (dx, dy, dz)
 * 5. Perspective projection: screen = C + finalRel / (1 - finalRelZ / perspective)
 */
interface ParsedCssTransform {
  dx: number;
  dy: number;
  dz: number;
  scale: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
}

function parseCssTransformString(transform: string): ParsedCssTransform {
  const translateMatch = transform.match(
    /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*([-0-9.]+)px\)/
  );
  const scaleMatch = transform.match(/scale\(([-0-9.]+)\)/);
  const rxMatch = transform.match(/rotateX\(([-0-9.]+)deg\)/);
  const ryMatch = transform.match(/rotateY\(([-0-9.]+)deg\)/);
  const rzMatch = transform.match(/rotateZ\(([-0-9.]+)deg\)/);

  if (!translateMatch || !scaleMatch || !rxMatch || !ryMatch || !rzMatch) {
    throw new Error(`Failed to parse CSS transform string: "${transform}"`);
  }

  return {
    dx: parseFloat(translateMatch[1]),
    dy: parseFloat(translateMatch[2]),
    dz: parseFloat(translateMatch[3]),
    scale: parseFloat(scaleMatch[1]),
    rotateX: parseFloat(rxMatch[1]),
    rotateY: parseFloat(ryMatch[1]),
    rotateZ: parseFloat(rzMatch[1]),
  };
}

function computeCssOracleProjectedFocalPoint(
  viewport: ViewportDimensions,
  focalPoint: FocalPoint2D,
  transformStr: string,
  perspective = 1200,
  anchorPoint: FocalPoint2D = { x: 0.5, y: 0.5 }
): { screenX: number; screenY: number; targetX: number; targetY: number; error: number } {
  const parsed = parseCssTransformString(transformStr);

  const W = viewport.width;
  const H = viewport.height;
  const Cx = W / 2;
  const Cy = H / 2;

  const targetX = anchorPoint.x * W;
  const targetY = anchorPoint.y * H;

  const Px = focalPoint.x * W;
  const Py = focalPoint.y * H;

  const relX = Px - Cx;
  const relY = Py - Cy;
  const relZ = 0;

  const R = createRotationMatrix3D(parsed.rotateX, parsed.rotateY, parsed.rotateZ);
  const rotX = R[0] * relX + R[1] * relY + R[2] * relZ;
  const rotY = R[3] * relX + R[4] * relY + R[5] * relZ;
  const rotZ = R[6] * relX + R[7] * relY + R[8] * relZ;

  const finalRelX = rotX * parsed.scale + parsed.dx;
  const finalRelY = rotY * parsed.scale + parsed.dy;
  const finalRelZ = rotZ * parsed.scale + parsed.dz;

  const perspFactor = perspective > 0 ? 1 - finalRelZ / perspective : 1;
  const projectedX = perspFactor !== 0 ? Cx + finalRelX / perspFactor : Cx + finalRelX;
  const projectedY = perspFactor !== 0 ? Cy + finalRelY / perspFactor : Cy + finalRelY;

  const error = Math.hypot(projectedX - targetX, projectedY - targetY);

  return { screenX: projectedX, screenY: projectedY, targetX, targetY, error };
}

/**
 * Calculates effective vertical and horizontal Field of View in degrees.
 */
function calculateFieldOfView(
  width: number,
  height: number,
  perspective: number,
  zoom: number
): { fovYDeg: number; fovXDeg: number } {
  const effectiveFocal = perspective * zoom;
  const fovYDeg = 2 * Math.atan(height / (2 * effectiveFocal)) * (180 / Math.PI);
  const fovXDeg = 2 * Math.atan(width / (2 * effectiveFocal)) * (180 / Math.PI);
  return { fovYDeg, fovXDeg };
}

describe('Adversarial Verification: Input Intelligence SceneGraphs & Remotion 480-Frame Render Stability', () => {
  const outDir = path.resolve(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // 1x1 Transparent PNG in base64
  const VALID_TINY_PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  const synthesizedGraphs: Record<string, SceneGraph> = {};

  before(async () => {
    // 1. Canonical deterministic visual fallback
    const fallbackResult = generateDeterministicVisualFallback({
      targetDurationInFrames: 480,
      fps: 30,
      baseWidth: 1920,
      baseHeight: 1080,
    });
    synthesizedGraphs.deterministicFallback = SceneGraphSchema.parse(fallbackResult.sceneGraph);

    // 2. Deterministic fallback with custom context and asset URI
    const customFallback = generateDeterministicVisualFallback({
      targetDurationInFrames: 480,
      fps: 30,
      productContext: {
        title: 'CloudMatrix Telemetry',
        targetCtaLabel: 'Deploy Cluster Now',
        productType: 'cloud-infrastructure',
      },
      assetFilename: 'dashboard-telemetry.png',
      assetDataUri: `data:image/png;base64,${VALID_TINY_PNG}`,
    });
    synthesizedGraphs.customContextFallback = SceneGraphSchema.parse(customFallback.sceneGraph);

    // 3. Mocked Gemini Vision base-1000 detection with code fences
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: `\`\`\`json
{
  "summary": "Enterprise cloud telemetry dashboard with real-time throughput metrics",
  "elements": [
    {
      "id": "gemini-nav-01",
      "label": "Global Operations Nav",
      "category": "navigation",
      "box2d": [30, 60, 90, 940],
      "suggestedAction": "focus",
      "confidence": 0.96
    },
    {
      "id": "gemini-search-02",
      "label": "Command Palette & Omnibox",
      "category": "input",
      "box2d": [140, 220, 210, 780],
      "suggestedAction": "focus",
      "confidence": 0.94
    },
    {
      "id": "gemini-metric-03",
      "label": "Throughput & Latency Heatmap",
      "category": "metric",
      "box2d": [310, 140, 690, 860],
      "suggestedAction": "hover",
      "confidence": 0.98
    },
    {
      "id": "gemini-cta-04",
      "label": "Deploy Edge Cluster",
      "category": "cta",
      "box2d": [630, 760, 690, 920],
      "suggestedAction": "click",
      "confidence": 0.99
    }
  ]
}
\`\`\``,
              },
            ],
          },
        },
      ],
    };

    const mockFetch: typeof fetch = async () =>
      new Response(JSON.stringify(mockGeminiResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const result = await analyzeMediaWithGeminiVision(
      {
        fileBase64: VALID_TINY_PNG,
        mimeType: 'image/png',
        targetDurationInFrames: 480,
        fps: 30,
      },
      {
        apiKey: 'mock-gemini-key',
        fetchFn: mockFetch,
      }
    );
    synthesizedGraphs.geminiVisionMock = SceneGraphSchema.parse(result.sceneGraph);

    // 4. Unit float mock detections with inverted vertices
    const rawInvertedBox = [0.85, 0.92, 0.65, 0.74]; // [ymin, xmin, ymax, xmax]
    const healedBox = normalizeBoundingBox(rawInvertedBox);

    const floatLandmarks: VisualLandmark[] = [
      {
        id: 'float-nav',
        label: 'Top Navigation Menu',
        category: 'navigation',
        box2d: [0.02, 0.05, 0.09, 0.95],
        normalizedCenter: { x: 0.5, y: 0.055 },
        confidence: 0.95,
        suggestedAction: 'focus',
      },
      {
        id: 'float-input',
        label: 'Search Query Input',
        category: 'input',
        box2d: [0.15, 0.25, 0.22, 0.75],
        normalizedCenter: { x: 0.5, y: 0.185 },
        confidence: 0.93,
        suggestedAction: 'focus',
      },
      {
        id: 'float-card',
        label: 'Analytics Summary Card',
        category: 'card',
        box2d: [0.32, 0.18, 0.68, 0.82],
        normalizedCenter: { x: 0.5, y: 0.5 },
        confidence: 0.97,
        suggestedAction: 'hover',
      },
      {
        id: 'float-cta',
        label: 'Start Free Trial',
        category: 'cta',
        box2d: healedBox.normalizedBox,
        normalizedCenter: healedBox.center,
        confidence: 0.99,
        suggestedAction: 'click',
      },
    ];

    const floatInteractionMap = synthesizeInferredInteractionMap(floatLandmarks, {
      durationInFrames: 480,
      fps: 30,
    });
    synthesizedGraphs.floatLandmarksMock = SceneGraphSchema.parse(
      adaptInferredInteractionToSceneGraph(floatInteractionMap)
    );

    // 5. Minimal detection (single CTA)
    const minimalLandmark: VisualLandmark[] = [
      {
        id: 'lone-cta',
        label: 'Quick Deploy',
        category: 'cta',
        normalizedCenter: { x: 0.88, y: 0.72 },
        suggestedAction: 'click',
        confidence: 0.99,
      },
    ];

    const minimalMap = synthesizeInferredInteractionMap(minimalLandmark, {
      durationInFrames: 480,
      fps: 30,
    });
    synthesizedGraphs.minimalDetection = SceneGraphSchema.parse(
      adaptInferredInteractionToSceneGraph(minimalMap)
    );
  });

  // =========================================================================
  // 1. SCENEGRAPH SYNTHESIS BENCHMARK (FALLBACK & GEMINI VISION MOCKS)
  // =========================================================================
  describe('1. Input Intelligence SceneGraph Synthesis Invariants', () => {
    test('1.1 Synthesized graphs satisfy SceneGraphSchema with valid canvas dimensions', () => {
      assert.equal(Object.keys(synthesizedGraphs).length, 5);

      for (const [key, graph] of Object.entries(synthesizedGraphs)) {
        const parsed = SceneGraphSchema.safeParse(graph);
        assert.ok(parsed.success, `Graph [${key}] failed SceneGraphSchema validation`);
        assert.equal(graph.canvas.durationInFrames, 480);
        assert.equal(graph.canvas.fps, 30);
        assert.equal(graph.canvas.width, 1920);
        assert.equal(graph.canvas.height, 1080);
        assert.ok(graph.cameraTrack.length >= 3);
        assert.ok(graph.cursorTrack.length >= 3);
        assert.ok(graph.audioTrack.length >= 4);
      }
    });

    test('1.2 Custom context and asset URI are correctly preserved in 3D surface scene payload', () => {
      const graph = synthesizedGraphs.customContextFallback;
      const surfaceScene = graph.scenes.find((s) => s.type === 'product_interaction_3d');
      assert.ok(surfaceScene !== undefined);
      assert.equal(surfaceScene?.payload.mockInterface, `data:image/png;base64,${VALID_TINY_PNG}`);
      assert.equal(surfaceScene?.payload.windowTitle, 'dashboard-telemetry.png');
    });

    test('1.3 Gemini Vision mock extraction yields inferred interaction telemetry', () => {
      const graph = synthesizedGraphs.geminiVisionMock;
      assert.ok(graph.cameraTrack.length >= 4);
      assert.ok(graph.cursorTrack.length >= 4);
    });

    test('1.4 Normalizes inverted bounding boxes and clamps center coordinates', () => {
      const rawInvertedBox = [0.85, 0.92, 0.65, 0.74]; // [ymin, xmin, ymax, xmax]
      const healedBox = normalizeBoundingBox(rawInvertedBox);
      assert.deepEqual(healedBox.normalizedBox, [0.65, 0.74, 0.85, 0.92]);
      assert.equal(healedBox.center.x, 0.83);
      assert.equal(healedBox.center.y, 0.75);
    });

    test('1.5 Minimal detection synthesizes full 10-event choreography without unhandled exceptions', () => {
      const graph = synthesizedGraphs.minimalDetection;
      assert.ok(graph.cameraTrack.length >= 4);
      assert.ok(graph.cursorTrack.length >= 4);
    });
  });

  // =========================================================================
  // 2. 480-FRAME CAMERA PARAMETERS & FOCAL DRIFT ORACLES (< 0.1px)
  // =========================================================================
  describe('2. 480-Frame Camera Kinematics, Parameters & Zero-Drift Oracles (< 0.1px)', () => {
    test('2.1 Evaluates frames 0..480 across all 5 SceneGraphs: zero NaN/undefined/Infinity and focal drift < 0.1px', () => {
      assert.equal(Object.keys(synthesizedGraphs).length, 5);

      for (const [key, graph] of Object.entries(synthesizedGraphs)) {
        let maxAnalyticalDrift = 0;
        let maxCssOracleDrift = 0;
        let nanOrInfCount = 0;

        for (let frame = 0; frame <= 480; frame++) {
          const cameraState = evaluateCameraPath(graph.cameraTrack, frame);

          // 1. Verify cameraState values
          const stateValues = [
            cameraState.x,
            cameraState.y,
            cameraState.zoom,
            cameraState.rotateX ?? 0,
            cameraState.rotateY ?? 0,
            cameraState.rotateZ ?? 0,
          ];

          for (const val of stateValues) {
            if (val === undefined || Number.isNaN(val) || !Number.isFinite(val)) {
              nanOrInfCount++;
            }
          }

          // Camera target must reside inside [0.0, 1.0]
          assert.ok(
            cameraState.x >= 0.0 && cameraState.x <= 1.0,
            `[${key}] Frame ${frame}: camera target x=${cameraState.x} out of [0, 1]`
          );
          assert.ok(
            cameraState.y >= 0.0 && cameraState.y <= 1.0,
            `[${key}] Frame ${frame}: camera target y=${cameraState.y} out of [0, 1]`
          );
          assert.ok(
            cameraState.zoom >= 0.8 && cameraState.zoom <= 3.5,
            `[${key}] Frame ${frame}: zoom=${cameraState.zoom} out of bounds [0.8, 3.5]`
          );

          // 2. Compute 3D Camera Transform
          const transformResult = calculateCameraTransform({
            viewport: { width: graph.canvas.width, height: graph.canvas.height },
            focalPoint: { x: cameraState.x, y: cameraState.y },
            zoom: cameraState.zoom,
            rotation: {
              rotateX: cameraState.rotateX ?? 0,
              rotateY: cameraState.rotateY ?? 0,
              rotateZ: cameraState.rotateZ ?? 0,
            },
            perspective: 1200,
          });

          // Verify position parameters (Dx, Dy, Dz)
          const pos = transformResult.translation;
          if (
            !Number.isFinite(pos.x) ||
            !Number.isFinite(pos.y) ||
            !Number.isFinite(pos.z)
          ) {
            nanOrInfCount++;
          }

          // Verify rotation parameters
          const rot = transformResult.rotation;
          if (
            !Number.isFinite(rot.rotateX) ||
            !Number.isFinite(rot.rotateY) ||
            !Number.isFinite(rot.rotateZ)
          ) {
            nanOrInfCount++;
          }

          // Verify effective Field of View (FOV)
          const fov = calculateFieldOfView(
            graph.canvas.width,
            graph.canvas.height,
            transformResult.perspective,
            cameraState.zoom
          );

          if (!Number.isFinite(fov.fovYDeg) || !Number.isFinite(fov.fovXDeg)) {
            nanOrInfCount++;
          }
          assert.ok(
            fov.fovYDeg > 10 && fov.fovYDeg < 90,
            `[${key}] Frame ${frame}: vertical FOV=${fov.fovYDeg}deg out of physical lens range`
          );
          assert.ok(
            fov.fovXDeg > 15 && fov.fovXDeg < 120,
            `[${key}] Frame ${frame}: horizontal FOV=${fov.fovXDeg}deg out of physical lens range`
          );

          // Verify CSS transform string has no corrupt tokens
          if (
            transformResult.transform.includes('NaN') ||
            transformResult.transform.includes('undefined') ||
            transformResult.transform.includes('Infinity')
          ) {
            nanOrInfCount++;
          }

          // 3. Focal Drift Verification
          // A) Analytical internal drift
          assert.ok(
            Number.isFinite(transformResult.focalDrift),
            `[${key}] Frame ${frame}: focal drift must be finite`
          );
          if (transformResult.focalDrift > maxAnalyticalDrift) {
            maxAnalyticalDrift = transformResult.focalDrift;
          }
          assert.ok(
            transformResult.focalDrift < 0.1,
            `[${key}] Frame ${frame}: internal focal drift ${transformResult.focalDrift}px >= 0.1px`
          );

          // B) Independent CSS 4x4 Forward Kinematics Oracle
          const oracle = computeCssOracleProjectedFocalPoint(
            { width: graph.canvas.width, height: graph.canvas.height },
            { x: cameraState.x, y: cameraState.y },
            transformResult.transform,
            1200
          );

          if (oracle.error > maxCssOracleDrift) {
            maxCssOracleDrift = oracle.error;
          }
          assert.ok(
            oracle.error < 0.1,
            `[${key}] Frame ${frame}: CSS Oracle focal drift ${oracle.error}px >= 0.1px threshold!`
          );
        }

        assert.equal(nanOrInfCount, 0, `[${key}] Detected ${nanOrInfCount} NaNs/Infs in camera parameters!`);
        assert.ok(maxAnalyticalDrift < 0.0001, `[${key}] Max analytical drift was ${maxAnalyticalDrift}px`);
        assert.ok(maxCssOracleDrift < 0.1, `[${key}] Max CSS Oracle drift ${maxCssOracleDrift}px >= 0.1px`);
      }
    });
  });

  // =========================================================================
  // 3. 480-FRAME SMARTCURSOR KINEMATICS & BOUNDS ORACLES [0.0, 1.0]
  // =========================================================================
  describe('3. 480-Frame SmartCursor Kinematics & Bounds Oracles [0.0, 1.0]', () => {
    test('3.1 Evaluates frames 0..480 across all 5 SceneGraphs: cursor (x, y) resides inside [0.0, 1.0]', () => {
      assert.equal(Object.keys(synthesizedGraphs).length, 5);

      for (const [key, graph] of Object.entries(synthesizedGraphs)) {
        let nanCount = 0;
        let minClickScale = 1.0;
        let clickDetected = false;

        for (let frame = 0; frame <= 480; frame++) {
          const cursorState = interpolateCursorTrack(graph.cursorTrack, frame);

          if (
            cursorState.x === undefined ||
            cursorState.y === undefined ||
            Number.isNaN(cursorState.x) ||
            Number.isNaN(cursorState.y) ||
            !Number.isFinite(cursorState.x) ||
            !Number.isFinite(cursorState.y)
          ) {
            nanCount++;
          }

          // Strict coordinate boundaries [0.0, 1.0]
          assert.ok(
            cursorState.x >= 0.0 && cursorState.x <= 1.0,
            `[${key}] Frame ${frame}: cursor x=${cursorState.x} outside [0.0, 1.0]`
          );
          assert.ok(
            cursorState.y >= 0.0 && cursorState.y <= 1.0,
            `[${key}] Frame ${frame}: cursor y=${cursorState.y} outside [0.0, 1.0]`
          );

          // Physical click simulation & compression
          if (cursorState.isClickActive && cursorState.clickElapsed >= 0) {
            clickDetected = true;
            const elapsed = cursorState.clickElapsed;
            const clickScale = interpolate(elapsed, [0, 2, 6], [1.0, 0.92, 1.0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            const rippleRadius = interpolate(elapsed, [0, 16], [4, 46], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });

            if (Number.isNaN(clickScale) || Number.isNaN(rippleRadius)) {
              nanCount++;
            }

            if (clickScale < minClickScale) {
              minClickScale = clickScale;
            }

            assert.ok(clickScale >= 0.90 && clickScale <= 1.0, `[${key}] Frame ${frame}: clickScale=${clickScale}`);
            assert.ok(rippleRadius >= 4 && rippleRadius <= 46, `[${key}] Frame ${frame}: rippleRadius=${rippleRadius}`);
          }
        }

        assert.equal(nanCount, 0, `[${key}] Detected ${nanCount} NaNs in SmartCursor kinematics!`);
        assert.ok(clickDetected, `[${key}] Expected at least one active click during 480 frames`);
        assert.ok(minClickScale <= 0.93 && minClickScale >= 0.91, `[${key}] Observed click compression: ${minClickScale}`);
      }
    });
  });

  // =========================================================================
  // 4. AUDIO CUES SCHEDULE, REQUIRED SFX & SOFT LIMITER CEILING (<= 0.95)
  // =========================================================================
  describe('4. Audio Cues Verification & Soft-Knee Limiter Ceiling (<= 0.95)', () => {
    const requiredSfx: AudioAsset[] = ['camera-whoosh', 'keyboard-tap', 'mouse-click', 'chime'];

    test('4.1 All 5 SceneGraphs contain mandatory sound cues with valid offsets and volumes <= 0.95', () => {
      assert.equal(Object.keys(synthesizedGraphs).length, 5);

      for (const [key, graph] of Object.entries(synthesizedGraphs)) {
        const audioAssetsInGraph = new Set(graph.audioTrack.map((c) => c.asset));

        for (const req of requiredSfx) {
          assert.ok(
            audioAssetsInGraph.has(req),
            `[${key}] Missing mandatory sound cue "${req}" in audioTrack! Present: ${Array.from(audioAssetsInGraph).join(', ')}`
          );
        }

        // Verify each individual cue has valid frame offset and volume
        for (const cue of graph.audioTrack) {
          assert.ok(
            Number.isInteger(cue.frame) && cue.frame >= 0 && cue.frame <= 480,
            `[${key}] Audio cue "${cue.id}" has invalid frame offset: ${cue.frame}`
          );

          if (cue.volume !== undefined) {
            assert.ok(
              cue.volume >= 0.0 && cue.volume <= 0.95,
              `[${key}] Audio cue "${cue.id}" volume=${cue.volume} breaches ceiling [0.0, 0.95]`
            );
          }
        }
      }
    });

    test('4.2 Evaluates frame-accurate audio mix across all 480 frames strictly <= 0.95 for all 5 SceneGraphs', () => {
      for (const [key, graph] of Object.entries(synthesizedGraphs)) {
        const timeline = buildAudioTimeline({
          audioTrack: graph.audioTrack,
          durationInFrames: graph.canvas.durationInFrames,
          fps: graph.canvas.fps,
        });

        assert.ok(timeline.cues.length >= 4);
        assert.ok(timeline.musicCues.length >= 1);
        assert.ok(timeline.sfxCues.length >= 3);

        const sfxDuckingMeta = timeline.sfxCues.map((c) => ({
          startFrame: c.startFrame,
          durationInFrames: c.durationInFrames,
          priority: c.duckingPriority,
        }));

        let maxMasterVolume = 0;
        let nanCount = 0;

        for (let frame = 0; frame <= 480; frame++) {
          const activeCues = timeline.cues.filter(
            (c) => frame >= c.startFrame && frame < c.endFrame
          );

          let rawSum = 0;
          for (const cue of activeCues) {
            if (cue.isMusic) {
              const mGain = calculateFadeGain(frame - cue.startFrame, {
                durationInFrames: cue.durationInFrames,
                fadeInFrames: cue.fadeInFrames,
                fadeOutFrames: cue.fadeOutFrames,
                targetVolume: cue.volume,
              });
              const mDuck = calculateDuckingFactor(frame, sfxDuckingMeta);
              rawSum += mGain * mDuck;
            } else {
              rawSum += cue.volume;
            }
          }

          const { limitFactor, limitedGain } = softLimitGain(rawSum, 0.75, 0.95);

          if (Number.isNaN(limitFactor) || Number.isNaN(limitedGain) || !Number.isFinite(limitedGain)) {
            nanCount++;
          }

          if (limitedGain > maxMasterVolume) {
            maxMasterVolume = limitedGain;
          }

          assert.ok(
            limitedGain <= 0.950001,
            `[${key}] Frame ${frame}: limitedGain=${limitedGain} breached 0.95 headroom ceiling!`
          );
          assert.ok(
            limitedGain >= 0,
            `[${key}] Frame ${frame}: limitedGain=${limitedGain} must be >= 0`
          );
        }

        assert.equal(nanCount, 0, `[${key}] Detected ${nanCount} NaNs in AudioMixer limiter!`);
        assert.ok(maxMasterVolume <= 0.950001, `[${key}] Max master volume ${maxMasterVolume} exceeds 0.95`);
      }
    });

    test('4.3 Polyphony Stress Test: All 4 mandatory SFX overlapping simultaneously at maximum volume bounded <= 0.95', () => {
      const graph = synthesizedGraphs.deterministicFallback;
      const stressedAudioTrack = [...graph.audioTrack];

      // Inject 4 overlapping SFX at frame 200 with maximum volume 1.0
      stressedAudioTrack.push(
        { id: 'stress-whoosh', frame: 200, asset: 'camera-whoosh', volume: 1.0 },
        { id: 'stress-tap', frame: 200, asset: 'keyboard-tap', volume: 1.0 },
        { id: 'stress-click', frame: 200, asset: 'mouse-click', volume: 1.0 },
        { id: 'stress-chime', frame: 200, asset: 'chime', volume: 1.0 }
      );

      const timeline = buildAudioTimeline({
        audioTrack: stressedAudioTrack,
        durationInFrames: 480,
        fps: 30,
      });

      const sfxDuckingMeta = timeline.sfxCues.map((c) => ({
        startFrame: c.startFrame,
        durationInFrames: c.durationInFrames,
        priority: c.duckingPriority,
      }));

      const activeCues = timeline.cues.filter((c) => 200 >= c.startFrame && 200 < c.endFrame);
      let rawSum = 0;
      for (const cue of activeCues) {
        if (cue.isMusic) {
          const mGain = calculateFadeGain(200 - cue.startFrame, {
            durationInFrames: cue.durationInFrames,
            fadeInFrames: cue.fadeInFrames,
            fadeOutFrames: cue.fadeOutFrames,
            targetVolume: cue.volume,
          });
          const mDuck = calculateDuckingFactor(200, sfxDuckingMeta);
          rawSum += mGain * mDuck;
        } else {
          rawSum += cue.volume;
        }
      }

      assert.ok(rawSum >= 4.0, `Expected massive raw sum (>= 4.0), observed: ${rawSum}`);
      const { limitedGain, limitFactor } = softLimitGain(rawSum, 0.75, 0.95);

      assert.ok(limitedGain <= 0.950000, `High polyphony limitedGain=${limitedGain} must be <= 0.95`);
      assert.ok(limitedGain >= 0.940000, `High polyphony limitedGain=${limitedGain} should approach headroom ceiling`);
      assert.ok(limitFactor < 0.25, `Limit factor should compress gain significantly, observed: ${limitFactor}`);
    });
  });

  // =========================================================================
  // 5. REMOTION STILL RENDER PNG & BYTE STREAM VERIFICATION
  // =========================================================================
  describe('5. Remotion Composition Render PNG & Byte Stream Verification', () => {
    const renderTargets = [
      {
        name: 'deterministicFallback',
        frame: 163, // Beat 3: Inspect Card with 3D camera tilt and 2.1x zoom
        outputFile: 'adversarial-p5-fallback-f163.png',
      },
      {
        name: 'deterministicFallback',
        frame: 326, // Beat 4: CTA Click with physical ripple and cursor compression
        outputFile: 'adversarial-p5-fallback-f326.png',
      },
      {
        name: 'geminiVisionMock',
        frame: 86, // Beat 2: Search input approach & focus
        outputFile: 'adversarial-p5-gemini-f86.png',
      },
      {
        name: 'geminiVisionMock',
        frame: 432, // Beat 5: Outro settle hold with chime
        outputFile: 'adversarial-p5-gemini-f432.png',
      },
    ];

    for (const target of renderTargets) {
      test(`5.1 Renders [${target.name}] at frame ${target.frame} to valid PNG byte stream`, () => {
        const graph = synthesizedGraphs[target.name];
        assert.ok(graph !== undefined, `Graph ${target.name} must be synthesized`);

        const propsPath = path.resolve(outDir, `props-p5-${target.outputFile}.json`);
        fs.writeFileSync(propsPath, JSON.stringify({ sceneGraph: graph }, null, 2));

        const outputPath = path.resolve(outDir, target.outputFile);
        const startTime = Date.now();
        const cmd = `npx remotion still remotion/index.ts InteractiveSurfaceDemo ${outputPath} --frame=${target.frame} --props=${propsPath} --overwrite`;

        const cmdOutput = execSync(cmd, { encoding: 'utf-8', timeout: 45000 });
        const durationMs = Date.now() - startTime;
        assert.ok(durationMs >= 0, 'Render duration must be non-negative');

        assert.ok(
          cmdOutput.includes('Rendered') || cmdOutput.includes(outputPath) || cmdOutput.includes('1/1'),
          `Remotion CLI output should confirm render: ${cmdOutput}`
        );
        assert.ok(fs.existsSync(outputPath), `Output PNG file must exist at ${outputPath}`);

        const fileStat = fs.statSync(outputPath);
        assert.ok(fileStat.size > 25000, `Output PNG size (${fileStat.size} bytes) should be > 25KB`);

        // Read binary buffer
        const buffer = fs.readFileSync(outputPath);

        // 1. Check PNG 8-byte magic sequence: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
        const expectedMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
        for (let i = 0; i < 8; i++) {
          assert.equal(
            buffer[i],
            expectedMagic[i],
            `PNG byte[${i}] mismatch: expected 0x${expectedMagic[i].toString(16)}, got 0x${buffer[i]?.toString(16)}`
          );
        }

        // 2. Check IHDR chunk header (starts at byte 12: 'IHDR')
        const chunkType = buffer.toString('ascii', 12, 16);
        assert.equal(chunkType, 'IHDR', `First PNG chunk must be IHDR, found: ${chunkType}`);

        // 3. Check width & height encoded in IHDR (bytes 16-23)
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        assert.equal(width, 1920, `Rendered PNG width must be 1920, got: ${width}`);
        assert.equal(height, 1080, `Rendered PNG height must be 1080, got: ${height}`);

        // 4. Check IEND chunk trailer at end of PNG file
        const last12Bytes = buffer.subarray(buffer.length - 12);
        const iendType = last12Bytes.toString('ascii', 4, 8);
        assert.equal(iendType, 'IEND', `Last PNG chunk must be IEND, found: ${iendType}`);
      });
    }
  });
});
