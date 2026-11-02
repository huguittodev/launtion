/**
 * tests/creative-director.test.ts
 *
 * Automated verification suite for Phase 4: Creative Director Agent (Gemini).
 *
 * Tests:
 * 1. ProductBriefSchema validation, defaults, boundary limits, and error handling.
 * 2. Deterministic Algorithmic Fallback Engine compliance with SceneGraphSchema,
 *    480-frame timeline budget, 5 required micro-scenes, 3D camera bounds, and audio cues.
 * 3. Gemini adapter and POST /api/creative-director route handling (mocked fetch, timeouts,
 *    markdown code fence strip, schema healing, and fallback guarantees).
 * 4. EditorState reducer LOAD_SCENE_GRAPH integration with undo/redo history stacks.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import {
  BrandToneSchema,
  ProductBriefSchema,
  cleanModelJsonOutput,
  generateCreativeDirectorSceneGraph,
  generateDeterministicSceneGraph,
  sanitizeAiSceneGraph,
} from '../src/lib/ai';
import { POST } from '../src/app/api/creative-director/route';
import {
  createInitialEditorState,
  editorActions,
  editorReducer,
} from '../src/lib/editor/editor-state';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import type { SceneGraph } from '../src/lib/scene-graph/types';

describe('Phase 4: Creative Director Agent Architecture', () => {
  /* ========================================================================= */
  /* 1. ProductBriefSchema Invariants                                          */
  /* ========================================================================= */
  describe('1. ProductBriefSchema Invariants & Validation', () => {
    it('1.1 parses valid minimal brief and applies default values', () => {
      const brief = ProductBriefSchema.parse({
        productName: 'PulseMetrics',
        description: 'Real-time telemetry and infrastructure monitoring for cloud microservices.',
      });

      assert.equal(brief.productName, 'PulseMetrics');
      assert.equal(brief.targetAudience, 'Modern Software Teams');
      assert.equal(brief.goal, 'launch');
      assert.equal(brief.tone, 'tech-precision');
      assert.equal(brief.ctaText, 'Get Started Free');
      assert.equal(brief.targetDurationInFrames, 480);
      assert.equal(brief.fps, 30);
      assert.deepEqual(brief.resolution, { width: 1920, height: 1080 });
      assert.deepEqual(brief.features, []);
    });

    it('1.2 rejects empty product name or whitespace-only name', () => {
      assert.throws(
        () =>
          ProductBriefSchema.parse({
            productName: '   ',
            description: 'Valid description that has sufficient length.',
          }),
        (err: unknown) => {
          assert(err instanceof Error);
          return err.message.includes('Product name is required');
        }
      );
    });

    it('1.3 rejects product name exceeding 50 characters', () => {
      assert.throws(
        () =>
          ProductBriefSchema.parse({
            productName: 'A'.repeat(51),
            description: 'Valid description with sufficient length for testing.',
          }),
        (err: unknown) => {
          assert(err instanceof Error);
          return err.message.includes('Max 50 characters');
        }
      );
    });

    it('1.4 rejects description under 10 characters', () => {
      assert.throws(
        () =>
          ProductBriefSchema.parse({
            productName: 'Short',
            description: 'Too short',
          }),
        (err: unknown) => {
          assert(err instanceof Error);
          return err.message.includes('Description must be at least 10 characters');
        }
      );
    });

    it('1.5 rejects description exceeding 500 characters', () => {
      assert.throws(
        () =>
          ProductBriefSchema.parse({
            productName: 'Valid Name',
            description: 'X'.repeat(501),
          }),
        (err: unknown) => {
          assert(err instanceof Error);
          return err.message.includes('Max 50 characters') || err.message.includes('Max 500');
        }
      );
    });

    it('1.6 validates primaryColor and accentColor with HexColorRegex', () => {
      // Valid 6-digit and 3-digit hex
      const valid = ProductBriefSchema.parse({
        productName: 'Test SaaS',
        description: 'Valid product description for testing color fields.',
        accentColor: '#3B82F6',
        primaryColor: '#F00',
      });
      assert.equal(valid.accentColor, '#3B82F6');
      assert.equal(valid.primaryColor, '#F00');

      // Invalid color strings
      assert.throws(() =>
        ProductBriefSchema.parse({
          productName: 'Test',
          description: 'Valid product description for testing color fields.',
          accentColor: 'blue',
        })
      );
      assert.throws(() =>
        ProductBriefSchema.parse({
          productName: 'Test',
          description: 'Valid product description for testing color fields.',
          accentColor: '#GGFFFF',
        })
      );
    });

    it('1.7 accepts all valid brand tones', () => {
      const tones = [
        'tech-precision',
        'punchy-social',
        'editorial-clean',
        'minimal',
        'modern-punchy',
        'minimal-editorial',
        'technical-precision',
      ] as const;

      for (const tone of tones) {
        const parsed = BrandToneSchema.parse(tone);
        assert.equal(parsed, tone);
      }
    });
  });

  /* ========================================================================= */
  /* 2. Deterministic Algorithmic Fallback Engine                              */
  /* ========================================================================= */
  describe('2. Deterministic Algorithmic Fallback Engine', () => {
    const sampleBrief = {
      productName: 'Base44',
      tagline: 'Autonomous App Generation with Deterministic Video',
      description: 'Generate full-stack Next.js web applications directly from conversational product prompts.',
      tone: 'tech-precision' as const,
      accentColor: '#FF5C35',
      features: ['Real-time sync', 'Zero config deployments', 'Instant rollbacks'],
    };

    it('2.1 generates 100% valid SceneGraph against SceneGraphSchema', () => {
      const graph = generateDeterministicSceneGraph(sampleBrief);
      const validation = SceneGraphSchema.safeParse(graph);
      assert.equal(validation.success, true);
    });

    it('2.2 exact canvas duration is 480 frames at 30 FPS (16.0s)', () => {
      const graph = generateDeterministicSceneGraph(sampleBrief);
      assert.equal(graph.canvas.durationInFrames, 480);
      assert.equal(graph.canvas.fps, 30);
      assert.equal(graph.canvas.width, 1920);
      assert.equal(graph.canvas.height, 1080);
    });

    it('2.3 contains exactly 5 sequential micro-scenes partitioning 480 frames', () => {
      const graph = generateDeterministicSceneGraph(sampleBrief);
      assert.equal(graph.scenes.length, 5);

      const [s1, s2, s3, s4, s5] = graph.scenes;

      // F0-F90: Hook (synthetic_prompt_box)
      assert.equal(s1.type, 'synthetic_prompt_box');
      assert.equal(s1.startFrame, 0);
      assert.equal(s1.durationInFrames, 90);
      assert(s1.payload.textToType.includes('Base44'));

      // F90-F240: Core Surface (product_interaction_3d)
      assert.equal(s2.type, 'product_interaction_3d');
      assert.equal(s2.startFrame, 90);
      assert.equal(s2.durationInFrames, 150);
      assert.equal(s2.payload.productName, 'Base44');

      // F240-F330: Architecture / Integration (synthetic_code_tree)
      assert.equal(s3.type, 'synthetic_code_tree');
      assert.equal(s3.startFrame, 240);
      assert.equal(s3.durationInFrames, 90);
      assert(Array.isArray(s3.payload.files));
      assert(s3.payload.files.length >= 3);

      // F330-F400: Hero Action (synthetic_hero_button)
      assert.equal(s4.type, 'synthetic_hero_button');
      assert.equal(s4.startFrame, 330);
      assert.equal(s4.durationInFrames, 70);
      assert.equal(s4.payload.clickFrame, 365);

      // F400-F480: Brand Closing (brand_closing_cta)
      assert.equal(s5.type, 'brand_closing_cta');
      assert.equal(s5.startFrame, 400);
      assert.equal(s5.durationInFrames, 80);
      assert.equal(s5.payload.productName, 'Base44');

      // Check sum of durations equals exactly 480
      const totalSceneFrames = graph.scenes.reduce((acc, sc) => acc + sc.durationInFrames, 0);
      assert.equal(totalSceneFrames, 480);
    });

    it('2.4 cameraTrack keyframes strictly bounded by 480 frames with valid zoom & coordinates', () => {
      const graph = generateDeterministicSceneGraph(sampleBrief);
      assert(graph.cameraTrack.length >= 8);

      for (const kf of graph.cameraTrack) {
        assert(kf.frame >= 0 && kf.frame <= 480, `Keyframe frame ${kf.frame} exceeds canvas bounds`);
        assert(kf.x >= 0.0 && kf.x <= 1.0, `Camera focal x ${kf.x} out of [0, 1]`);
        assert(kf.y >= 0.0 && kf.y <= 1.0, `Camera focal y ${kf.y} out of [0, 1]`);
        assert(kf.zoom >= 0.8 && kf.zoom <= 3.5, `Camera zoom ${kf.zoom} out of [0.8, 3.5]`);
      }

      // First keyframe at frame 0 and last keyframe at frame 480
      assert.equal(graph.cameraTrack[0].frame, 0);
      assert.equal(graph.cameraTrack[graph.cameraTrack.length - 1].frame, 480);
    });

    it('2.5 cursorTrack keyframes strictly bounded by 480 frames with valid click triggers', () => {
      const graph = generateDeterministicSceneGraph(sampleBrief);
      assert(graph.cursorTrack.length >= 6);

      const clickFrames = graph.cursorTrack.filter((ck) => ck.click).map((ck) => ck.frame);
      assert(clickFrames.includes(65), 'Click event at prompt submit missing');
      assert(clickFrames.includes(150), 'Click event at core surface missing');
      assert(clickFrames.includes(365), 'Click event at hero button missing');

      for (const ck of graph.cursorTrack) {
        assert(ck.frame >= 0 && ck.frame <= 480);
        assert(ck.x >= 0.0 && ck.x <= 1.0);
        assert(ck.y >= 0.0 && ck.y <= 1.0);
      }
    });

    it('2.6 audioTrack SFX cues strictly aligned with actions and bounded by 480 frames', () => {
      const graph = generateDeterministicSceneGraph(sampleBrief);
      assert(graph.audioTrack.length >= 10);

      // Verify unique IDs and bounded frames
      const seenIds = new Set<string>();
      for (const cue of graph.audioTrack) {
        assert(!seenIds.has(cue.id), `Duplicate audio cue ID: ${cue.id}`);
        seenIds.add(cue.id);
        assert(cue.frame >= 0 && cue.frame <= 480);
        assert(cue.volume === undefined || (cue.volume >= 0.0 && cue.volume <= 1.0));
      }

      // Verify audio sync with cursor clicks
      const clickCues = graph.audioTrack.filter((c) => c.asset === 'mouse-click').map((c) => c.frame);
      assert(clickCues.includes(65), 'SFX mouse-click missing at frame 65');
      assert(clickCues.includes(150), 'SFX mouse-click missing at frame 150');
      assert(clickCues.includes(365), 'SFX mouse-click missing at frame 365');
    });

    it('2.7 maps tone properly to ArtDirection backdrops and surfaces', () => {
      const editorialGraph = generateDeterministicSceneGraph({
        productName: 'Nordic Clean',
        description: 'Minimalist editorial note-taking app for thoughtful writers.',
        tone: 'editorial-clean',
      });
      assert.equal(editorialGraph.artDirection.backdropVariant, 'light-editorial');
      assert.equal(editorialGraph.artDirection.surfaceTheme, 'light');

      const punchyGraph = generateDeterministicSceneGraph({
        productName: 'ViralFlow',
        description: 'High-energy social marketing video creator for TikTok and Reels.',
        tone: 'punchy-social',
      });
      assert.equal(punchyGraph.artDirection.backdropVariant, 'aurora-blur');
      assert.equal(punchyGraph.artDirection.surfaceTheme, 'dark');

      const precisionGraph = generateDeterministicSceneGraph({
        productName: 'KernelMetrics',
        description: 'Low-latency operating system profiling and kernel observability.',
        tone: 'tech-precision',
      });
      assert.equal(precisionGraph.artDirection.backdropVariant, 'dark-precision');
      assert.equal(precisionGraph.artDirection.surfaceTheme, 'dark');
    });

    it('2.8 executes in under 5 milliseconds (pure determinism benchmark)', () => {
      const start = performance.now();
      for (let i = 0; i < 20; i++) {
        generateDeterministicSceneGraph(sampleBrief);
      }
      const elapsed = performance.now() - start;
      const avgMs = elapsed / 20;
      assert(avgMs < 5, `Fallback generator took ${avgMs}ms on average, expected < 5ms`);
    });
  });

  /* ========================================================================= */
  /* 3. Gemini REST Adapter & Route Integration                               */
  /* ========================================================================= */
  describe('3. Gemini REST Adapter & Route Integration', () => {
    const validBrief = {
      productName: 'PulseStream',
      description: 'Distributed event stream processing and analytical database for cloud SaaS.',
      tone: 'tech-precision' as const,
      accentColor: '#3B82F6',
    };

    it('3.1 without API key returns 200 with source: deterministic-fallback', async () => {
      const result = await generateCreativeDirectorSceneGraph(validBrief, {
        apiKey: '',
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert.equal(result.reason, 'NO_API_KEY_CONFIGURED');
      assert.equal(result.sceneGraph.version, '2.0');
      assert.equal(result.sceneGraph.canvas.durationInFrames, 480);
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
    });

    it('3.2 with valid Gemini structured JSON returns source: gemini', async () => {
      const mockGeneratedGraph = generateDeterministicSceneGraph(validBrief);

      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify(mockGeneratedGraph),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

      const result = await generateCreativeDirectorSceneGraph(validBrief, {
        apiKey: 'test-mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'gemini');
      assert.equal(result.sceneGraph.version, '2.0');
      assert.equal(result.sceneGraph.canvas.durationInFrames, 480);
    });

    it('3.3 cleans markdown code fence wrappers from AI output', () => {
      const rawWithFences = '```json\n{\n  "version": "2.0"\n}\n```';
      const cleaned = cleanModelJsonOutput(rawWithFences);
      assert.equal(cleaned, '{\n  "version": "2.0"\n}');
    });

    it('3.4 sanitizes minor AI hallucinations (clamps frames, zoom, coords)', () => {
      const rawAiOutput = {
        version: '2.0.0', // slight version drift
        canvas: { width: 1920, height: 1080, fps: 30, durationInFrames: 480 },
        artDirection: { backdropVariant: 'unknown-backdrop', surfaceTheme: 'dark', primaryAccent: '#3B82F6' },
        cameraTrack: [
          { frame: 500, x: 1.5, y: -0.2, zoom: 4.5 }, // out of bounds
        ],
        cursorTrack: [
          { frame: 500, x: 1.2, y: -0.5 },
        ],
        audioTrack: [
          { id: '', frame: 500, asset: 'laser-gun', volume: 1.5 },
        ],
        scenes: [
          {
            id: 'sc-1',
            type: 'synthetic_prompt_box',
            startFrame: 500,
            durationInFrames: 100,
            payload: { textToType: 'Hello' },
          },
        ],
      };

      const sanitized = sanitizeAiSceneGraph(rawAiOutput, ProductBriefSchema.parse(validBrief)) as SceneGraph;

      assert.equal(sanitized.version, '2.0');
      assert.equal(sanitized.cameraTrack[0].frame, 480);
      assert.equal(sanitized.cameraTrack[0].zoom, 3.5);
      assert.equal(sanitized.cameraTrack[0].x, 1.0);
      assert.equal(sanitized.cameraTrack[0].y, 0.0);
      assert.equal(sanitized.audioTrack[0].frame, 480);
      assert.equal(sanitized.audioTrack[0].asset, 'soft-pop'); // replaced invalid asset
      assert.equal(sanitized.audioTrack[0].volume, 1.0);
    });

    it('3.5 gracefully falls back when Gemini returns HTTP 500 error', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response('Internal Server Error', { status: 500 });

      const result = await generateCreativeDirectorSceneGraph(validBrief, {
        apiKey: 'test-mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert(result.reason?.includes('GEMINI_HTTP_500'));
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
    });

    it('3.6 gracefully falls back when fetch throws network error or timeout', async () => {
      const mockFetch: typeof fetch = async () => {
        throw new Error('Connection timed out after 12000ms');
      };

      const result = await generateCreativeDirectorSceneGraph(validBrief, {
        apiKey: 'test-mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert(result.reason?.includes('Connection timed out'));
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
    });

    it('3.7 POST /api/creative-director rejects invalid brief with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/creative-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: '', // invalid
          description: 'Too short', // invalid (< 10 chars)
        }),
      });

      const response = await POST(req);
      assert.equal(response.status, 400);

      const json = await response.json();
      assert.equal(json.error, 'Datos del producto inválidos');
      assert(Array.isArray(json.issues));
    });

    it('3.8 POST /api/creative-director handles malformed JSON body with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/creative-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ malformed json',
      });

      const response = await POST(req);
      assert.equal(response.status, 400);
      const json = await response.json();
      assert.equal(json.error, 'Cuerpo de petición JSON inválido');
    });

    it('3.9 POST /api/creative-director succeeds with HTTP 200 on valid request', async () => {
      const req = new NextRequest('http://localhost:3000/api/creative-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'LaunchFlow',
          description: 'Automated video motion generation for SaaS product announcements.',
          tone: 'tech-precision',
          accentColor: '#FF5C35',
        }),
      });

      const response = await POST(req);
      assert.equal(response.status, 200);

      const json = await response.json();
      assert.equal(json.success, true);
      assert(json.source === 'gemini' || json.source === 'deterministic-fallback');
      assert.equal(SceneGraphSchema.safeParse(json.sceneGraph).success, true);
    });
  });

  /* ========================================================================= */
  /* 4. Editor State Reducer Integration: LOAD_SCENE_GRAPH                     */
  /* ========================================================================= */
  describe('4. Editor State Reducer Integration: LOAD_SCENE_GRAPH', () => {
    it('4.1 loads new AI SceneGraph, updates state, and resets frame to 0', () => {
      const initialState = createInitialEditorState('default');
      const generatedGraph = generateDeterministicSceneGraph({
        productName: 'NewAISaaS',
        description: 'Generated by creative director agent for live player rendering.',
      });

      const nextState = editorReducer(
        initialState,
        editorActions.loadSceneGraph(generatedGraph, 'Generated via Gemini')
      );

      assert.equal(nextState.sceneGraph.scenes[0].id, 'scene-1-hook-prompt');
      assert.equal(nextState.currentFrame, 0);
      assert.equal(nextState.activeKeyframeIndex, 0);
      assert.equal(nextState.selectedSceneId, 'scene-1-hook-prompt');
      assert.equal(nextState.isDirty, true);
      assert.equal(nextState.validationNotice, null);
    });

    it('4.2 pushes previous state to history.past enabling undo / redo', () => {
      const initialState = createInitialEditorState('default');
      const originalTitle = (initialState.sceneGraph.scenes[0].payload as { windowTitle?: string }).windowTitle;

      const generatedGraph = generateDeterministicSceneGraph({
        productName: 'AI Studio',
        description: 'New composition replacing default scene graph.',
      });

      const stateAfterLoad = editorReducer(
        initialState,
        editorActions.loadSceneGraph(generatedGraph)
      );

      assert.equal(stateAfterLoad.history.past.length, 1);
      assert.equal(stateAfterLoad.history.future.length, 0);

      // Perform Undo
      const stateAfterUndo = editorReducer(stateAfterLoad, editorActions.undo());
      const restoredTitle = (stateAfterUndo.sceneGraph.scenes[0].payload as { windowTitle?: string }).windowTitle;
      assert.equal(restoredTitle, originalTitle);
      assert.equal(stateAfterUndo.history.future.length, 1);

      // Perform Redo
      const stateAfterRedo = editorReducer(stateAfterUndo, editorActions.redo());
      assert.equal(stateAfterRedo.sceneGraph.scenes[0].id, 'scene-1-hook-prompt');
      assert.equal(stateAfterRedo.history.past.length, 1);
    });

    it('4.3 rejects invalid SceneGraph candidate and sets validationNotice without corrupting state', () => {
      const initialState = createInitialEditorState('default');
      const invalidCandidate = {
        version: '1.0', // invalid version
        canvas: { width: -100, height: 1080, fps: 30, durationInFrames: 480 },
      } as unknown as SceneGraph;

      const nextState = editorReducer(
        initialState,
        editorActions.loadSceneGraph(invalidCandidate)
      );

      assert.equal(nextState.sceneGraph, initialState.sceneGraph);
      assert(nextState.validationNotice !== null);
      assert.equal(nextState.history.past.length, 0);
    });
  });
});
