/**
 * tests/adversarial-phase5-stress.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS HARNESS — Phase 5 Input Intelligence (Multimodal Analysis)
 *
 * Stress-tests and empirically verifies:
 * 1. Telemetry Invariant: 300+ synthesized maps, ensuring 100% of events have `provenance === 'inferred'`,
 *    with zero instances of 'observed' or 'simulated'.
 * 2. Boundary Stress: Inverted vertices, out-of-bounds coordinates (<0, >1000, >1.0), degenerate zero-area boxes,
 *    non-finite values, and high landmark counts (50, 100, 250, 500) without crashing or NaN generation.
 * 3. Payload & Fallback Speed: 500 Monte Carlo evaluations of `generateDeterministicVisualFallback` to confirm
 *    p99 < 10ms with 100% valid Zod outputs, plus invalid MIME types, corrupt base64, empty payloads, and oversized payloads.
 * 4. SceneGraph Adapter Integration: Verifies that 100% of synthesized InteractionMaps convert into valid SceneGraph v2.0
 *    without throwing errors or producing NaNs.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import {
  InputIntelligencePayloadSchema,
  InputIntelligenceResultSchema,
  normalizeBoundingBox,
  synthesizeInferredInteractionMap,
  adaptInferredInteractionToSceneGraph,
  generateDeterministicVisualFallback,
} from '../src/lib/input-intelligence';
import type { VisualLandmark, DetectedElementCategory } from '../src/lib/input-intelligence/types';
import { POST } from '../src/app/api/input-intelligence/route';
import { InteractionMapSchema } from '../src/lib/interaction-map/schema';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import { interactionToSceneGraphAdapter } from '../src/lib/scene-graph/adapter';

// Minimal 1x1 valid PNG in base64
const VALID_TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

const CATEGORIES: DetectedElementCategory[] = [
  'cta',
  'input',
  'card',
  'metric',
  'navigation',
  'tab',
  'other',
];

describe('Empirical Adversarial Stress Harness: Phase 5 Input Intelligence', () => {
  /* ========================================================================= */
  /* 1. Telemetry Invariant Challenge (Hundreds of Synthesized Outputs)         */
  /* ========================================================================= */
  describe('1. Telemetry Invariant: Mandatory provenance === "inferred"', () => {
    it('1.1 verifies across 300 synthesized InteractionMaps that 100% of events have provenance: "inferred"', () => {
      const TOTAL_MAPS = 300;
      let totalEventsChecked = 0;
      let inferredCount = 0;
      let observedCount = 0;
      let simulatedCount = 0;
      let unknownCount = 0;

      for (let i = 0; i < TOTAL_MAPS; i++) {
        // Vary landmark count: 0, 1, 2, 5, 10, 25, 50
        const landmarkCount = [0, 1, 2, 5, 10, 25, 50][i % 7];
        const landmarks: VisualLandmark[] = [];

        for (let j = 0; j < landmarkCount; j++) {
          const category = CATEGORIES[(i + j) % CATEGORIES.length];
          landmarks.push({
            id: `test-elem-${i}-${j}`,
            label: `Dynamic Label ${i}_${j} [${category}]`,
            category,
            normalizedCenter: {
              x: ((i * 17 + j * 31) % 100) / 100,
              y: ((i * 23 + j * 19) % 100) / 100,
            },
            box2d: [
              ((j * 20) % 800) / 1000,
              ((j * 25) % 800) / 1000,
              (((j * 20) % 800) + 150) / 1000,
              (((j * 25) % 800) + 200) / 1000,
            ],
            confidence: 0.8 + ((j % 20) / 100),
            suggestedAction: j % 2 === 0 ? 'click' : 'hover',
            targetZoom: 1.5 + (j % 10) * 0.1,
          });
        }

        const duration = [60, 120, 240, 480, 720, 1200][i % 6];
        const fps = [24, 30, 60][i % 3];
        const baseWidth = [1280, 1920, 2560, 3840, 1080][i % 5];
        const baseHeight = [720, 1080, 1440, 2160, 1920][i % 5];

        const map = synthesizeInferredInteractionMap(landmarks, {
          durationInFrames: duration,
          fps,
          baseWidth,
          baseHeight,
          productContext: {
            title: `Product Run ${i}`,
            targetCtaLabel: `Action Button ${i}`,
          },
        });

        // Strict Zod contract validation
        InteractionMapSchema.parse(map);

        assert.equal(map.version, '2.0');
        assert.equal(map.durationInFrames, duration);
        assert.equal(map.fps, fps);
        assert.equal(map.baseResolution.width, baseWidth);
        assert.equal(map.baseResolution.height, baseHeight);
        assert(map.events.length > 0, 'InteractionMap must contain choreographed events');

        for (const evt of map.events) {
          totalEventsChecked++;
          if (evt.provenance === 'inferred') {
            inferredCount++;
          } else if (evt.provenance === 'observed') {
            observedCount++;
          } else if (evt.provenance === 'simulated') {
            simulatedCount++;
          } else {
            unknownCount++;
          }

          // Frame monotonicity and boundaries
          assert(
            evt.frame >= 0 && evt.frame <= duration,
            `Event frame ${evt.frame} must be within [0, ${duration}]`
          );
          // Normalized coordinates
          assert(
            evt.x >= 0.0 && evt.x <= 1.0,
            `Event x (${evt.x}) must be strictly within [0.0, 1.0]`
          );
          assert(
            evt.y >= 0.0 && evt.y <= 1.0,
            `Event y (${evt.y}) must be strictly within [0.0, 1.0]`
          );
          assert(!Number.isNaN(evt.x), 'Event x cannot be NaN');
          assert(!Number.isNaN(evt.y), 'Event y cannot be NaN');
          assert(!Number.isNaN(evt.frame), 'Event frame cannot be NaN');
        }
      }

      // Invariant assertions across the entire corpus
      assert.equal(totalEventsChecked, 3000, 'Expected exactly 3000 events across 300 maps');
      assert.equal(inferredCount, 3000, 'All 3000 events MUST have provenance: "inferred"');
      assert.equal(observedCount, 0, 'Zero events may have provenance: "observed"');
      assert.equal(simulatedCount, 0, 'Zero events may have provenance: "simulated"');
      assert.equal(unknownCount, 0, 'Zero events may have unknown provenance');
    });

    it('1.2 verifies deterministic fallback interaction map maintains strictly provenance: "inferred"', () => {
      for (let i = 0; i < 50; i++) {
        const fallbackResult = generateDeterministicVisualFallback({
          durationInFrames: 300,
          fps: 30,
        });

        for (const evt of fallbackResult.interactionMap.events) {
          assert.equal(
            evt.provenance,
            'inferred',
            `Fallback event ${evt.id} must strictly have provenance: "inferred"`
          );
        }
      }
    });
  });

  /* ========================================================================= */
  /* 2. Boundary Stress Harness: Extreme Bounding Boxes & High Landmark Counts */
  /* ========================================================================= */
  describe('2. Boundary Stress: Extreme Coordinates, Degenerate Boxes & High Landmark Counts', () => {
    it('2.1 Inverted Vertices: correctly resolves and heals reversed coordinates', () => {
      const invertedCases: Array<{
        raw: [number, number, number, number];
        isBase1000: boolean;
      }> = [
        // base-1000 inverted [ymax, xmax, ymin, xmin]
        { raw: [900, 800, 100, 200], isBase1000: true },
        // unit float inverted
        { raw: [0.95, 0.85, 0.05, 0.15], isBase1000: false },
        // axis-swapped base-1000
        { raw: [1000, 0, 0, 1000], isBase1000: true },
        // axis-swapped unit float
        { raw: [1.0, 0.0, 0.0, 1.0], isBase1000: false },
        // asymmetric inverted
        { raw: [850, 120, 210, 940], isBase1000: true },
      ];

      for (const { raw } of invertedCases) {
        const { normalizedBox, center } = normalizeBoundingBox(raw);
        const [ymin, xmin, ymax, xmax] = normalizedBox;

        assert(ymin <= ymax, `ymin (${ymin}) must be <= ymax (${ymax})`);
        assert(xmin <= xmax, `xmin (${xmin}) must be <= xmax (${xmax})`);
        assert(ymin >= 0.0 && ymin <= 1.0, `ymin (${ymin}) must be in [0.0, 1.0]`);
        assert(ymax >= 0.0 && ymax <= 1.0, `ymax (${ymax}) must be in [0.0, 1.0]`);
        assert(xmin >= 0.0 && xmin <= 1.0, `xmin (${xmin}) must be in [0.0, 1.0]`);
        assert(xmax >= 0.0 && xmax <= 1.0, `xmax (${xmax}) must be in [0.0, 1.0]`);

        assert(center.x >= 0.0 && center.x <= 1.0, `center.x (${center.x}) must be in [0.0, 1.0]`);
        assert(center.y >= 0.0 && center.y <= 1.0, `center.y (${center.y}) must be in [0.0, 1.0]`);
        assert(!Number.isNaN(center.x), 'center.x must not be NaN');
        assert(!Number.isNaN(center.y), 'center.y must not be NaN');
      }
    });

    it('2.2 Out-of-bounds coordinates: clamps negative and oversized coordinates strictly to [0.0, 1.0]', () => {
      const oobCases: Array<[number, number, number, number]> = [
        [-500, -200, 800, 900], // negative base-1000
        [-1.5, -2.5, 3.5, 4.5], // out of bounds unit floats
        [1500, 2000, 3000, 4000], // far beyond base-1000
        [-99999, -99999, 99999, 99999], // extreme numeric values
        [-0.5, 0.2, 0.8, 1.5], // mixed unit bounds
        [-100, -100, -50, -50], // entirely negative base-1000
      ];

      for (const box of oobCases) {
        const { normalizedBox, center } = normalizeBoundingBox(box);
        const [ymin, xmin, ymax, xmax] = normalizedBox;

        assert(ymin >= 0.0 && ymin <= 1.0, `ymin (${ymin}) clamped to [0.0, 1.0]`);
        assert(ymax >= 0.0 && ymax <= 1.0, `ymax (${ymax}) clamped to [0.0, 1.0]`);
        assert(xmin >= 0.0 && xmin <= 1.0, `xmin (${xmin}) clamped to [0.0, 1.0]`);
        assert(xmax >= 0.0 && xmax <= 1.0, `xmax (${xmax}) clamped to [0.0, 1.0]`);

        assert(center.x >= 0.0 && center.x <= 1.0, `center.x (${center.x}) clamped to [0.0, 1.0]`);
        assert(center.y >= 0.0 && center.y <= 1.0, `center.y (${center.y}) clamped to [0.0, 1.0]`);
        assert(!Number.isNaN(center.x));
        assert(!Number.isNaN(center.y));
      }
    });

    it('2.3 Degenerate boxes (zero area / points / slits): handles gracefully without NaN or div-by-zero', () => {
      const degenerateBoxes: Array<[number, number, number, number]> = [
        [500, 500, 500, 500], // zero area point in base-1000
        [0, 0, 0, 0], // origin point
        [1000, 1000, 1000, 1000], // maximum corner point
        [0.5, 0.5, 0.5, 0.5], // unit float point
        [100, 500, 900, 500], // zero width vertical slit
        [500, 100, 500, 900], // zero height horizontal slit
      ];

      for (const box of degenerateBoxes) {
        const { normalizedBox, center } = normalizeBoundingBox(box);
        assert(normalizedBox.every(Number.isFinite), 'All normalizedBox coordinates must be finite');
        assert(!Number.isNaN(center.x), `center.x must not be NaN for degenerate box ${JSON.stringify(box)}`);
        assert(!Number.isNaN(center.y), `center.y must not be NaN for degenerate box ${JSON.stringify(box)}`);
        assert(Number.isFinite(center.x));
        assert(Number.isFinite(center.y));
        assert(center.x >= 0.0 && center.x <= 1.0);
        assert(center.y >= 0.0 && center.y <= 1.0);
      }
    });

    it('2.4 Corrupt / Non-Numeric Inputs: falls back to default safe bounds', () => {
      const corruptInputs: unknown[] = [
        null,
        undefined,
        'not-an-array',
        {},
        true,
        [],
        [10, 20],
        [NaN, 10, 20, 30],
        [Infinity, 0, 1, 2],
        [-Infinity, -Infinity, 0, 1],
        ['a', 'b', 'c', 'd'],
      ];

      for (const input of corruptInputs) {
        const { normalizedBox, center } = normalizeBoundingBox(input);
        assert.deepEqual(normalizedBox, [0.2, 0.2, 0.8, 0.8]);
        assert.deepEqual(center, { x: 0.5, y: 0.5 });
      }
    });

    it('2.5 High Landmark Counts: handles 50, 100, 250, and 500 landmarks without crashing or producing NaN', () => {
      const counts = [50, 100, 250, 500];

      for (const count of counts) {
        const landmarks: VisualLandmark[] = Array.from({ length: count }, (_, idx) => ({
          id: `stress-landmark-${count}-${idx}`,
          label: `Massive UI Component #${idx}`,
          category: CATEGORIES[idx % CATEGORIES.length],
          normalizedCenter: {
            x: Number(((idx * 7) % 1000 / 1000).toFixed(4)),
            y: Number(((idx * 13) % 1000 / 1000).toFixed(4)),
          },
          box2d: [100, 100, 300, 300],
          confidence: 0.95,
          suggestedAction: idx % 3 === 0 ? 'click' : idx % 3 === 1 ? 'focus' : 'hover',
        }));

        const t0 = performance.now();
        const map = synthesizeInferredInteractionMap(landmarks, {
          durationInFrames: 480,
          fps: 30,
        });
        const elapsed = performance.now() - t0;

        assert(elapsed < 20, `Synthesis for ${count} landmarks took ${elapsed.toFixed(2)}ms (must be < 20ms)`);
        assert.doesNotThrow(() => InteractionMapSchema.parse(map));
        assert.equal(map.events.every((e) => e.provenance === 'inferred'), true);
        assert.equal(map.events.some((e) => Number.isNaN(e.x) || Number.isNaN(e.y)), false);
      }
    });
  });

  /* ========================================================================= */
  /* 3. Payload & Fallback Speed Stress (500 Monte Carlo Runs + Corrupt Data)  */
  /* ========================================================================= */
  describe('3. Payload & Fallback Speed Stress Harness', () => {
    it('3.1 executes 500 Monte Carlo evaluations of generateDeterministicVisualFallback reliably < 10ms with 100% valid Zod outputs', () => {
      const MONTE_CARLO_RUNS = 500;
      const latencies: number[] = [];
      let validOutputs = 0;

      for (let i = 0; i < MONTE_CARLO_RUNS; i++) {
        const duration = 60 + ((i * 13) % 1140);
        const fps = [24, 30, 60][i % 3];
        const hasAsset = i % 2 === 0;

        const t0 = performance.now();
        const result = generateDeterministicVisualFallback({
          durationInFrames: duration,
          fps,
          productContext: {
            title: `Monte Carlo App #${i}`,
            targetCtaLabel: `Start Trial #${i}`,
          },
          assetDataUri: hasAsset ? `data:image/png;base64,${VALID_TINY_PNG_BASE64}` : undefined,
          assetFilename: hasAsset ? `run-${i}.png` : undefined,
        });
        const elapsed = performance.now() - t0;
        latencies.push(elapsed);

        // Verify Zod schema compliance
        InputIntelligenceResultSchema.parse(result);
        assert.equal(result.success, true);
        assert.equal(result.source, 'deterministic-fallback');
        assert(result.landmarks.length >= 4);
        assert(result.interactionMap.events.length > 0);
        assert.equal(result.interactionMap.events.every((e) => e.provenance === 'inferred'), true);
        validOutputs++;
      }

      assert.equal(validOutputs, MONTE_CARLO_RUNS, '100% of outputs must validate under Zod');

      latencies.sort((a, b) => a - b);
      const min = latencies[0];
      const max = latencies[latencies.length - 1];
      const mean = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;
      const p50 = latencies[Math.floor(latencies.length * 0.5)];
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      const p99 = latencies[Math.floor(latencies.length * 0.99)];

      // Assertions on performance
      assert(mean < 5.0, `Mean fallback latency (${mean.toFixed(3)}ms) must be < 5.0ms`);
      assert(p95 < 8.0, `95th percentile latency (${p95.toFixed(3)}ms) must be < 8.0ms`);
      assert(p99 < 10.0, `99th percentile latency (${p99.toFixed(3)}ms) must be < 10.0ms`);

      // Record benchmark telemetry in assertion message
      assert(
        max < 15.0,
        `Max latency (${max.toFixed(3)}ms) including cold-start should not exceed 15ms. (p50=${p50.toFixed(3)}ms, p99=${p99.toFixed(3)}ms, min=${min.toFixed(3)}ms)`
      );
    });

    it('3.2 rejects all unsupported MIME types via InputIntelligencePayloadSchema', () => {
      const unsupportedMimes = [
        'image/gif',
        'application/pdf',
        'video/quicktime',
        'video/avi',
        'video/x-matroska',
        'text/html',
        'text/plain',
        'audio/mpeg',
        'image/svg+xml',
        'application/json',
        '',
      ];

      for (const mime of unsupportedMimes) {
        const res = InputIntelligencePayloadSchema.safeParse({
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: mime,
        });
        assert.equal(res.success, false, `MIME type ${mime} must be rejected`);
      }
    });

    it('3.3 rejects corrupt, non-base64, or improperly padded payloads', () => {
      const corruptPayloads = [
        '!!!NOT-VALID-BASE-64!!!',
        'data:image/png;base64,***CORRUPT***',
        'iVBORw0KGg==@@@@EXTRA_CHARS',
        '   ',
        '',
        'data:image/png;base64,',
        '🚀🔥✨🌟',
        'a'.repeat(10) + '!@#$%',
      ];

      for (const corrupt of corruptPayloads) {
        const res = InputIntelligencePayloadSchema.safeParse({
          fileBase64: corrupt,
          mimeType: 'image/png',
        });
        assert.equal(res.success, false, `Corrupt base64 string "${corrupt.slice(0, 20)}" must be rejected`);
      }
    });

    it('3.4 rejects empty and missing payloads', () => {
      const emptyBodies: unknown[] = [
        {},
        { mimeType: 'image/png' },
        { fileBase64: '', mimeType: 'image/png' },
        { base64Data: '', mimeType: 'image/png' },
        { fileData: '', mimeType: 'image/png' },
      ];

      for (const body of emptyBodies) {
        const res = InputIntelligencePayloadSchema.safeParse(body);
        assert.equal(res.success, false, `Empty payload must be rejected`);
      }
    });

    it('3.5 rejects payloads exceeding the 20 MB size limit', () => {
      // 21 MB payload
      const length21MB = Math.ceil((21 * 1024 * 1024 * 4) / 3);
      const payload21MB = 'B'.repeat(length21MB);

      const res21 = InputIntelligencePayloadSchema.safeParse({
        fileBase64: payload21MB,
        mimeType: 'image/png',
      });
      assert.equal(res21.success, false);
      assert(res21.error?.issues.some((i) => i.message.includes('20MB')));

      // 25 MB payload
      const length25MB = Math.ceil((25 * 1024 * 1024 * 4) / 3);
      const payload25MB = 'C'.repeat(length25MB);

      const res25 = InputIntelligencePayloadSchema.safeParse({
        fileBase64: payload25MB,
        mimeType: 'video/mp4',
      });
      assert.equal(res25.success, false);
      assert(res25.error?.issues.some((i) => i.message.includes('20MB')));
    });

    it('3.6 POST /api/input-intelligence route handler adversarial stress', async () => {
      // 1. Invalid JSON body
      const reqInvalidJson = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"unclosed": json',
      });
      const resInvalidJson = await POST(reqInvalidJson);
      assert.equal(resInvalidJson.status, 400);

      // 2. Invalid MIME
      const reqBadMime = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: 'image/tiff',
        }),
      });
      const resBadMime = await POST(reqBadMime);
      assert.equal(resBadMime.status, 400);

      // 3. Corrupt base64
      const reqCorrupt = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: '@@@NotValidBase64@@@',
          mimeType: 'image/png',
        }),
      });
      const resCorrupt = await POST(reqCorrupt);
      assert.equal(resCorrupt.status, 400);

      // 4. Oversized (> 20MB) -> HTTP 413
      const length22MB = Math.ceil((22 * 1024 * 1024 * 4) / 3);
      const reqOversized = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: 'D'.repeat(length22MB),
          mimeType: 'image/png',
        }),
      });
      const resOversized = await POST(reqOversized);
      assert.equal(resOversized.status, 413);

      // 5. Offline valid payload -> HTTP 200 with deterministic fallback
      const reqValid = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: 'image/webp',
          filename: 'adversarial-test.webp',
        }),
      });
      const resValid = await POST(reqValid);
      assert.equal(resValid.status, 200);
      const json = await resValid.json();
      assert.equal(json.success, true);
      assert.equal(json.source, 'deterministic-fallback');
      assert.equal(json.interactionMap.events.every((e: { provenance: string }) => e.provenance === 'inferred'), true);
    });
  });

  /* ========================================================================= */
  /* 4. SceneGraph Adapter Integration Robustness                              */
  /* ========================================================================= */
  describe('4. SceneGraph Adapter Integration: Valid SceneGraph v2.0 Production', () => {
    it('4.1 transforms 100 diverse synthesized InteractionMaps into SceneGraph v2.0 without errors or NaNs', () => {
      const TEST_COUNT = 100;

      for (let i = 0; i < TEST_COUNT; i++) {
        // Diverse landmark combinations
        const landmarkCount = i % 20;
        const landmarks: VisualLandmark[] = Array.from({ length: landmarkCount }, (_, idx) => ({
          id: `adapter-test-${i}-${idx}`,
          label: `Widget ${idx}`,
          category: CATEGORIES[(i + idx) % CATEGORIES.length],
          normalizedCenter: {
            x: ((i * 13 + idx * 7) % 100) / 100,
            y: ((i * 19 + idx * 11) % 100) / 100,
          },
          box2d: [100, 100, 400, 400],
          confidence: 0.9,
          suggestedAction: idx % 2 === 0 ? 'click' : 'hover',
        }));

        const duration = [60, 150, 300, 480, 900][i % 5];
        const fps = [24, 30, 60][i % 3];
        const baseWidth = [1280, 1920, 3840][i % 3];
        const baseHeight = [720, 1080, 2160][i % 3];

        const map = synthesizeInferredInteractionMap(landmarks, {
          durationInFrames: duration,
          fps,
          baseWidth,
          baseHeight,
        });

        // 1. Direct adapter invocation
        const directSceneGraph = interactionToSceneGraphAdapter(map);
        SceneGraphSchema.parse(directSceneGraph);

        assert.equal(directSceneGraph.version, '2.0');
        assert.equal(directSceneGraph.canvas.durationInFrames, duration);
        assert.equal(directSceneGraph.canvas.fps, fps);
        assert.equal(directSceneGraph.canvas.width, baseWidth);
        assert.equal(directSceneGraph.canvas.height, baseHeight);
        assert(directSceneGraph.scenes.length >= 1);

        // 2. Synthesizer wrapper invocation with asset metadata
        const enrichedSceneGraph = adaptInferredInteractionToSceneGraph(map, {
          assetDataUri: `data:image/png;base64,${VALID_TINY_PNG_BASE64}`,
          assetFilename: `test-render-${i}.png`,
        });
        SceneGraphSchema.parse(enrichedSceneGraph);

        const surfaceScene = enrichedSceneGraph.scenes.find((s) => s.type === 'product_interaction_3d');
        assert(surfaceScene !== undefined, 'product_interaction_3d scene must exist');
        assert.equal(surfaceScene.payload?.windowTitle, `test-render-${i}.png`);
        assert(surfaceScene.payload?.mockInterface?.startsWith('data:image/png;base64,'));

        // Inspect keyframes for NaN safety
        const camTrack = enrichedSceneGraph.cameraTrack ?? [];
        for (const kf of camTrack) {
          assert(!Number.isNaN(kf.x), 'Camera keyframe x must not be NaN');
          assert(!Number.isNaN(kf.y), 'Camera keyframe y must not be NaN');
          assert(!Number.isNaN(kf.zoom), 'Camera keyframe zoom must not be NaN');
          assert(kf.frame >= 0 && kf.frame <= duration, 'Camera keyframe frame must be in bounds');
        }

        const cursorTrack = enrichedSceneGraph.cursorTrack ?? [];
        for (const ck of cursorTrack) {
          assert(!Number.isNaN(ck.x), 'Cursor keyframe x must not be NaN');
          assert(!Number.isNaN(ck.y), 'Cursor keyframe y must not be NaN');
          assert(ck.frame >= 0 && ck.frame <= duration, 'Cursor keyframe frame must be in bounds');
        }
      }
    });

    it('4.2 preserves audio SFX catalog constraints in adapted SceneGraph', () => {
      const ALLOWED_SFX = new Set([
        'mouse-click',
        'camera-whoosh',
        'keyboard-tap',
        'chime',
        'soft-pop',
        'ambient-beat',
      ]);

      const map = synthesizeInferredInteractionMap([], { durationInFrames: 480, fps: 30 });
      const sceneGraph = adaptInferredInteractionToSceneGraph(map);

      for (const cue of sceneGraph.audioTrack ?? []) {
        assert(
          ALLOWED_SFX.has(cue.asset),
          `Audio cue asset "${cue.asset}" must belong to allowed SFX catalog`
        );
        assert(cue.frame >= 0 && cue.frame <= 480);
        if (typeof cue.volume === 'number') {
          assert(cue.volume >= 0 && cue.volume <= 1.0);
        }
      }
    });
  });
});
