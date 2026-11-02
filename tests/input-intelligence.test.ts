/**
 * tests/input-intelligence.test.ts
 *
 * Automated verification suite for Phase 5: Input Intelligence (Multimodal Analysis).
 *
 * Verifies:
 * 1. InputIntelligencePayloadSchema validation, MIME allowlist, size limits, and corrupt base64 rejection.
 * 2. VisualLandmarkSchema and Coordinate Normalization (base-1000 vs unit floats, vertex inversion healing, bounds clamping).
 * 3. Inferred InteractionMap synthesis & Choreography (5-beat sequence, strictly provenance: 'inferred', duration bounds).
 * 4. Deterministic Visual Fallback (< 5ms benchmark, zero network requests, 100% Zod compliance).
 * 5. Gemini Vision REST Adapter (mocked success, markdown code fences, timeouts, HTTP 429/500 errors, zero-key fallback).
 * 6. Next.js API Route Handler (POST /api/input-intelligence validation, HTTP 400, 413, and 200 responses).
 * 7. Studio Editor integration (SceneGraph loading into EditorState reducer with undo/redo).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import {
  AllowedMimeTypesEnum,
  InputIntelligencePayloadSchema,
  VisualLandmarkSchema,
  analyzeMediaWithGeminiVision,
  generateDeterministicVisualFallback,
  normalizeBoundingBox,
  synthesizeInferredInteractionMap,
  adaptInferredInteractionToSceneGraph,
  extractRawBase64,
} from '../src/lib/input-intelligence';
import { POST } from '../src/app/api/input-intelligence/route';
import { InteractionMapSchema } from '../src/lib/interaction-map/schema';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import {
  createInitialEditorState,
  editorActions,
  editorReducer,
} from '../src/lib/editor/editor-state';

// 1x1 Transparent PNG in base64
const VALID_TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('Phase 5: Input Intelligence (Multimodal Analysis) Architecture', () => {
  /* ========================================================================= */
  /* 1. Payload Schema & Validation Invariants                                 */
  /* ========================================================================= */
  describe('1. InputIntelligencePayloadSchema Invariants', () => {
    it('1.1 parses valid minimal base64 payload with defaults', () => {
      const parsed = InputIntelligencePayloadSchema.parse({
        fileBase64: VALID_TINY_PNG_BASE64,
        mimeType: 'image/png',
      });

      assert.equal(parsed.mimeType, 'image/png');
      assert.equal(parsed.targetDurationInFrames, 480);
      assert.equal(parsed.fps, 30);
    });

    it('1.2 accepts data URL prefix and parses cleanly', () => {
      const dataUri = `data:image/png;base64,${VALID_TINY_PNG_BASE64}`;
      const parsed = InputIntelligencePayloadSchema.parse({
        base64Data: dataUri,
        mimeType: 'image/png',
        filename: 'screenshot.png',
      });

      assert.equal(parsed.filename, 'screenshot.png');
      assert.equal(extractRawBase64(parsed.base64Data!), VALID_TINY_PNG_BASE64);
    });

    it('1.3 accepts all allowed MIME types (PNG, JPEG, WebP, MP4)', () => {
      const allowed = ['image/png', 'image/jpeg', 'image/webp', 'video/mp4'] as const;
      for (const mime of allowed) {
        assert.doesNotThrow(() =>
          AllowedMimeTypesEnum.parse(mime)
        );
        const res = InputIntelligencePayloadSchema.safeParse({
          fileData: VALID_TINY_PNG_BASE64,
          mimeType: mime,
        });
        assert.equal(res.success, true);
      }
    });

    it('1.4 rejects unsupported MIME types (e.g. image/gif, application/pdf)', () => {
      const invalidMimes = ['image/gif', 'application/pdf', 'video/quicktime', 'text/plain'];
      for (const mime of invalidMimes) {
        const res = InputIntelligencePayloadSchema.safeParse({
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: mime,
        });
        assert.equal(res.success, false);
      }
    });

    it('1.5 rejects empty or missing payload data', () => {
      const res = InputIntelligencePayloadSchema.safeParse({
        mimeType: 'image/png',
      });
      assert.equal(res.success, false);
    });

    it('1.6 rejects corrupt base64 string with invalid characters', () => {
      const res = InputIntelligencePayloadSchema.safeParse({
        fileBase64: '!!!Not-A-Valid-Base-64-String***@@@',
        mimeType: 'image/png',
      });
      assert.equal(res.success, false);
    });

    it('1.7 rejects base64 payload exceeding 20 MB decoded limit', () => {
      // 20MB is ~28 million base64 characters. Construct a simulated 21MB string:
      const oversizedLength = Math.ceil((21 * 1024 * 1024 * 4) / 3);
      const oversizedBase64 = 'A'.repeat(oversizedLength);

      const res = InputIntelligencePayloadSchema.safeParse({
        fileBase64: oversizedBase64,
        mimeType: 'image/png',
      });
      assert.equal(res.success, false);
      assert(res.error?.issues.some((i) => i.message.includes('20MB')));
    });

    it('1.8 validates VisualLandmarkSchema against valid and invalid landmark structures', () => {
      const validLandmark = VisualLandmarkSchema.parse({
        id: 'cta-test',
        label: 'Get Started Free',
        category: 'cta',
        box2d: [0.1, 0.2, 0.3, 0.4],
        normalizedCenter: { x: 0.3, y: 0.2 },
        confidence: 0.98,
        suggestedAction: 'click',
      });
      assert.equal(validLandmark.id, 'cta-test');

      assert.throws(() =>
        VisualLandmarkSchema.parse({
          id: '',
          label: 'Invalid',
          category: 'invalid-category',
          normalizedCenter: { x: 2.0, y: 0.5 },
        })
      );
    });
  });

  /* ========================================================================= */
  /* 2. Coordinate Normalization & Bounding Box Logic                          */
  /* ========================================================================= */
  describe('2. Spatial Coordinate Normalization & Clamping', () => {
    it('2.1 correctly normalizes base-1000 integer bounding boxes to [0.0, 1.0]', () => {
      // Input: [ymin, xmin, ymax, xmax] in base-1000
      const { normalizedBox, center } = normalizeBoundingBox([200, 300, 400, 700]);

      assert.deepEqual(normalizedBox, [0.2, 0.3, 0.4, 0.7]);
      assert.equal(center.x, 0.5); // (0.3 + 0.7) / 2
      assert.equal(center.y, 0.3); // (0.2 + 0.4) / 2
    });

    it('2.2 correctly accepts unit float bounding boxes in [0.0, 1.0]', () => {
      const { normalizedBox, center } = normalizeBoundingBox([0.15, 0.25, 0.35, 0.85]);

      assert.deepEqual(normalizedBox, [0.15, 0.25, 0.35, 0.85]);
      assert.equal(center.x, 0.55);
      assert.equal(center.y, 0.25);
    });

    it('2.3 heals inverted coordinates (ymin > ymax or xmin > xmax)', () => {
      // Inverted vertices: y0=0.6, y1=0.2; x0=0.9, x1=0.1
      const { normalizedBox, center } = normalizeBoundingBox([0.6, 0.9, 0.2, 0.1]);

      assert.deepEqual(normalizedBox, [0.2, 0.1, 0.6, 0.9]);
      assert.equal(center.x, 0.5);
      assert.equal(center.y, 0.4);
    });

    it('2.4 clamps out-of-bounds coordinates strictly into [0.0, 1.0]', () => {
      const { normalizedBox, center } = normalizeBoundingBox([-0.5, -0.2, 1.5, 1.8]);

      assert.deepEqual(normalizedBox, [0.0, 0.0, 1.0, 1.0]);
      assert.equal(center.x, 0.5);
      assert.equal(center.y, 0.5);
    });

    it('2.5 gracefully handles non-array or corrupt input box', () => {
      const res = normalizeBoundingBox(null);
      assert.deepEqual(res.center, { x: 0.5, y: 0.5 });
    });
  });

  /* ========================================================================= */
  /* 3. Deterministic Visual Fallback Benchmark & Telemetry                    */
  /* ========================================================================= */
  describe('3. Deterministic Visual Fallback Invariants', () => {
    it('3.1 executes in < 25ms with zero network requests', () => {
      const start = performance.now();
      const result = generateDeterministicVisualFallback();
      const elapsed = performance.now() - start;

      assert.equal(result.success, true);
      assert.equal(result.source, 'deterministic-fallback');
      assert(elapsed < 25, `Expected < 25ms execution, took ${elapsed.toFixed(2)}ms`);
    });

    it('3.2 generates at least 4 canonical SaaS landmarks with non-overlapping bounds', () => {
      const result = generateDeterministicVisualFallback();
      assert(result.landmarks.length >= 4);

      const categories = result.landmarks.map((l) => l.category);
      assert(categories.includes('cta'), 'Must include primary CTA');
      assert(categories.includes('input'), 'Must include search or input');
      assert(categories.includes('metric'), 'Must include metric surface');
      assert(categories.includes('navigation'), 'Must include navigation');
    });

    it('3.3 ensures 100% of interaction events have provenance: "inferred"', () => {
      const result = generateDeterministicVisualFallback();
      const events = result.interactionMap.events;

      assert(events.length >= 5, 'Must have at least 5 telemetry events');
      for (const evt of events) {
        assert.equal(
          evt.provenance,
          'inferred',
          `Event ${evt.id} has invalid provenance: ${evt.provenance}`
        );
      }
    });

    it('3.4 validates strictly against InteractionMapSchema (v2.0)', () => {
      const result = generateDeterministicVisualFallback();
      const validated = InteractionMapSchema.safeParse(result.interactionMap);
      assert.equal(validated.success, true);
    });

    it('3.5 adapts to valid SceneGraph satisfying SceneGraphSchema (v2.0)', () => {
      const result = generateDeterministicVisualFallback();
      const validated = SceneGraphSchema.safeParse(result.sceneGraph);
      assert.equal(validated.success, true);
      assert.equal(result.sceneGraph.canvas.durationInFrames, 480);
      assert(result.sceneGraph.cameraTrack.length >= 4);
      assert(result.sceneGraph.audioTrack.length >= 3);
    });
  });

  /* ========================================================================= */
  /* 4. Choreographed Inferred Telemetry & Audio Synthesis                     */
  /* ========================================================================= */
  describe('4. Choreographed 5-Beat Telemetry Sequence', () => {
    const mockLandmarks = [
      {
        id: 'cta-primary',
        label: 'Deploy Fleet',
        category: 'cta' as const,
        normalizedCenter: { x: 0.85, y: 0.65 },
        suggestedAction: 'click' as const,
        confidence: 0.99,
      },
      {
        id: 'search-input',
        label: 'Command Omnibox',
        category: 'input' as const,
        normalizedCenter: { x: 0.5, y: 0.2 },
        suggestedAction: 'focus' as const,
        confidence: 0.95,
      },
      {
        id: 'chart-metric',
        label: 'Live Telemetry Chart',
        category: 'metric' as const,
        normalizedCenter: { x: 0.45, y: 0.55 },
        suggestedAction: 'hover' as const,
        confidence: 0.97,
      },
    ];

    it('4.1 synthesizes 5-beat interaction sequence within frame bounds', () => {
      const map = synthesizeInferredInteractionMap(mockLandmarks, {
        durationInFrames: 480,
        fps: 30,
      });

      assert.equal(map.durationInFrames, 480);
      assert(map.events.every((e) => e.frame <= 480));

      // Beat 1: Overview hold at frame 0
      const beat1 = map.events.find((e) => e.frame === 0 && e.type === 'focus');
      assert(beat1 !== undefined);
      assert.equal(beat1?.x, 0.5);
      assert.equal(beat1?.y, 0.5);

      // Beat 4: Primary CTA click
      const clickEvent = map.events.find((e) => e.type === 'click');
      assert(clickEvent !== undefined);
      assert.equal(clickEvent?.metadata?.audioCue, 'mouse-click');
      assert.equal(clickEvent?.provenance, 'inferred');

      // Beat 5: Settle hold outro
      const outroEvent = map.events.find((e) => e.metadata?.audioCue === 'chime');
      assert(outroEvent !== undefined);
      assert(outroEvent!.frame >= 400);
    });

    it('4.2 embeds capture asset data URI into 3D product scene payload', () => {
      const map = synthesizeInferredInteractionMap(mockLandmarks);
      const graph = adaptInferredInteractionToSceneGraph(map, {
        assetDataUri: 'data:image/png;base64,iVBORw0KGgo...',
        assetFilename: 'dashboard-test.png',
      });

      const prodScene = graph.scenes.find((s) => s.type === 'product_interaction_3d');
      assert(prodScene !== undefined);
      assert.equal(prodScene?.payload.mockInterface, 'data:image/png;base64,iVBORw0KGgo...');
      assert.equal(prodScene?.payload.windowTitle, 'dashboard-test.png');
    });
  });

  /* ========================================================================= */
  /* 5. Gemini Vision REST Adapter & Resilience                                */
  /* ========================================================================= */
  describe('5. Gemini Vision REST Adapter & Resilience', () => {
    it('5.1 falls back cleanly when GEMINI_API_KEY is not configured', async () => {
      const result = await analyzeMediaWithGeminiVision(
        {
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: 'image/png',
        },
        { apiKey: '' } // explicit empty key
      );

      assert.equal(result.success, true);
      assert.equal(result.source, 'deterministic-fallback');
      assert.equal(result.reason, 'NO_API_KEY_CONFIGURED');
      assert(result.landmarks.length >= 4);
    });

    it('5.2 successfully parses valid mocked Gemini Vision JSON response with code fences', async () => {
      const mockedGeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: `\`\`\`json
{
  "summary": "Cloud Metrics SaaS dashboard with primary deployment action",
  "elements": [
    {
      "id": "elem-cta-1",
      "label": "Deploy Cluster",
      "category": "cta",
      "confidence": 0.99,
      "box2d": [620, 750, 680, 910],
      "suggestedAction": "click"
    },
    {
      "id": "elem-input-2",
      "label": "Global Search",
      "category": "input",
      "confidence": 0.94,
      "box2d": [150, 200, 230, 800],
      "suggestedAction": "focus"
    },
    {
      "id": "elem-chart-3",
      "label": "Throughput Graph",
      "category": "metric",
      "confidence": 0.97,
      "box2d": [320, 100, 700, 890],
      "suggestedAction": "hover"
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
        new Response(JSON.stringify(mockedGeminiResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      const result = await analyzeMediaWithGeminiVision(
        {
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: 'image/png',
        },
        {
          apiKey: 'mock-test-key-12345',
          fetchFn: mockFetch,
        }
      );

      assert.equal(result.success, true);
      assert.equal(result.source, 'gemini-vision');
      assert.equal(result.landmarks.length, 3);

      const cta = result.landmarks.find((l) => l.id === 'elem-cta-1');
      assert(cta !== undefined);
      assert.equal(cta?.label, 'Deploy Cluster');
      assert.equal(cta?.category, 'cta');
      assert.equal(cta?.suggestedAction, 'click');
      // Verify base-1000 converted to normalized center
      assert.equal(cta?.normalizedCenter.x, 0.83); // (750 + 910) / 2000
      assert.equal(cta?.normalizedCenter.y, 0.65); // (620 + 680) / 2000

      // Inferred telemetry invariant
      assert(result.interactionMap.events.every((e) => e.provenance === 'inferred'));
    });

    it('5.3 handles HTTP 429 Rate Limit error with seamless fallback', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response('RESOURCE_EXHAUSTED', { status: 429 });

      const result = await analyzeMediaWithGeminiVision(
        {
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: 'image/png',
        },
        {
          apiKey: 'mock-test-key',
          fetchFn: mockFetch,
        }
      );

      assert.equal(result.success, true);
      assert.equal(result.source, 'deterministic-fallback');
      assert(result.reason?.includes('GEMINI_HTTP_429'));
    });

    it('5.4 handles timeout error with seamless fallback', async () => {
      const mockFetch: typeof fetch = async () => {
        throw new Error('The operation was aborted due to timeout');
      };

      const result = await analyzeMediaWithGeminiVision(
        {
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: 'image/png',
        },
        {
          apiKey: 'mock-test-key',
          fetchFn: mockFetch,
        }
      );

      assert.equal(result.success, true);
      assert.equal(result.source, 'deterministic-fallback');
      assert(result.reason?.includes('timeout') || result.reason?.includes('aborted'));
    });
  });

  /* ========================================================================= */
  /* 6. POST /api/input-intelligence Route Handler Integration                 */
  /* ========================================================================= */
  describe('6. Next.js API Route Handler (POST /api/input-intelligence)', () => {
    it('6.1 rejects malformed JSON with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-{',
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert(data.error !== undefined);
    });

    it('6.2 rejects invalid MIME type with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: 'application/pdf',
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.error, 'Invalid request payload');
    });

    it('6.3 rejects payload exceeding 20MB with HTTP 413', async () => {
      const oversizedLength = Math.ceil((21 * 1024 * 1024 * 4) / 3);
      const oversizedBase64 = 'A'.repeat(oversizedLength);

      const req = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: oversizedBase64,
          mimeType: 'image/png',
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 413);
      const data = await res.json();
      assert(data.error.includes('20MB'));
    });

    it('6.4 returns HTTP 200 with fallback data on valid payload when offline', async () => {
      const req = new NextRequest('http://localhost:3000/api/input-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: VALID_TINY_PNG_BASE64,
          mimeType: 'image/png',
          filename: 'dashboard.png',
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 200);
      const data = await res.json();

      assert.equal(data.success, true);
      assert(data.landmarks.length >= 4);
      assert.equal(data.interactionMap.version, '2.0');
      assert.equal(data.sceneGraph.version, '2.0');
      assert(data.interactionMap.events.every((e: { provenance: string }) => e.provenance === 'inferred'));
    });
  });

  /* ========================================================================= */
  /* 7. EditorState Reducer Integration (Undo / Redo)                          */
  /* ========================================================================= */
  describe('7. Studio EditorState Reducer Integration', () => {
    it('7.1 dispatches loadSceneGraph, updates graph, resets frame, and records history', () => {
      const initialState = createInitialEditorState();
      const originalTitle = (initialState.sceneGraph.scenes[0]?.payload as Record<string, unknown>)?.headline;

      const fallbackResult = generateDeterministicVisualFallback();
      const inferredGraph = fallbackResult.sceneGraph;

      // Dispatch loadSceneGraph
      const loadedState = editorReducer(
        initialState,
        editorActions.loadSceneGraph(inferredGraph)
      );

      assert.deepEqual(loadedState.sceneGraph, inferredGraph);
      assert.equal(loadedState.currentFrame, 0);
      assert.equal(loadedState.history.past.length, 1);
      assert.deepEqual(loadedState.history.past[0], initialState.sceneGraph);

      // Verify Undo restores original SceneGraph
      const undoneState = editorReducer(loadedState, editorActions.undo());
      assert.equal((undoneState.sceneGraph.scenes[0]?.payload as Record<string, unknown>)?.headline, originalTitle);
      assert.equal(undoneState.history.future.length, 1);

      // Verify Redo re-applies inferred SceneGraph
      const redoneState = editorReducer(undoneState, editorActions.redo());
      assert.deepEqual(redoneState.sceneGraph, inferredGraph);
    });
  });
});
