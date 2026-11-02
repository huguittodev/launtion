/**
 * tests/adversarial-creative-director.test.ts
 *
 * Empirical Adversarial Challenger Suite for Phase 4: Creative Director Agent:
 * 1. Fuzzing ProductBriefSchema & API Route (50+ malformed input vectors, boundary breaches, invalid types, 400 responses)
 * 2. High-Throughput Stress Test: 500 randomized SceneGraph generations via generateDeterministicSceneGraph
 *    - Invariant: 500/500 pass SceneGraphSchema.safeParse().success === true (0 failures)
 *    - Invariant: mean latency strictly < 3.0 ms per generation
 * 3. Gemini Error Modes Mock Matrix (HTTP 429, HTTP 500, HTTP 503, Network Abort/Timeout, Corrupt Non-JSON, Missing Fields)
 *    - Invariant: generateCreativeDirectorSceneGraph ALWAYS falls back to a valid SceneGraph without throwing or crashing
 * 4. API Route Resilience Under Upstream Failure (HTTP 200 with deterministic-fallback payload and zero unhandled exceptions)
 */

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../src/app/api/creative-director/route';
import {
  BrandToneSchema,
  ProductBriefSchema,
  type ProductBriefInput,
  cleanModelJsonOutput,
  generateCreativeDirectorSceneGraph,
  generateDeterministicSceneGraph,
  sanitizeAiSceneGraph,
} from '../src/lib/ai';
import { HexColorRegex, SceneGraphSchema } from '../src/lib/scene-graph/schema';
import type { SceneGraph } from '../src/lib/scene-graph/types';

describe('Adversarial Stress Suite: Phase 4 Creative Director Agent & Route Resilience', () => {
  /* ========================================================================= */
  /* 1. PRODUCT BRIEF SCHEMA & API ROUTE FUZZING                               */
  /* ========================================================================= */
  describe('1. ProductBriefSchema & API Route Fuzzing', () => {
    // Comprehensive adversarial fuzzing inputs matrix
    const malformedBriefs: Array<{ label: string; payload: unknown; expectedIssueField?: string }> = [
      // 1.1 Missing / empty fields
      { label: 'empty object', payload: {}, expectedIssueField: 'productName' },
      { label: 'missing productName', payload: { description: 'A completely valid description of sufficient length.' }, expectedIssueField: 'productName' },
      { label: 'missing description', payload: { productName: 'Launtion' }, expectedIssueField: 'description' },
      { label: 'null productName', payload: { productName: null, description: 'Valid product description.' }, expectedIssueField: 'productName' },
      { label: 'null description', payload: { productName: 'Launtion', description: null }, expectedIssueField: 'description' },
      { label: 'empty string productName', payload: { productName: '', description: 'Valid product description.' }, expectedIssueField: 'productName' },
      { label: 'whitespace productName', payload: { productName: '   \t\n  ', description: 'Valid product description.' }, expectedIssueField: 'productName' },
      { label: 'empty string description', payload: { productName: 'Launtion', description: '' }, expectedIssueField: 'description' },
      { label: 'whitespace description', payload: { productName: 'Launtion', description: '          ' }, expectedIssueField: 'description' },
      { label: 'sub-minimum description (9 chars)', payload: { productName: 'Launtion', description: '123456789' }, expectedIssueField: 'description' },

      // 1.2 Boundary breaches (max length exceedance)
      { label: 'productName 51 chars', payload: { productName: 'X'.repeat(51), description: 'Valid description of sufficient length.' }, expectedIssueField: 'productName' },
      { label: 'productName 500 chars', payload: { productName: 'P'.repeat(500), description: 'Valid description of sufficient length.' }, expectedIssueField: 'productName' },
      { label: 'description 501 chars', payload: { productName: 'Launtion', description: 'D'.repeat(501) }, expectedIssueField: 'description' },
      { label: 'description 5,000 chars', payload: { productName: 'Launtion', description: 'D'.repeat(5000) }, expectedIssueField: 'description' },
      { label: 'tagline 101 chars', payload: { productName: 'Launtion', description: 'Valid description.', tagline: 'T'.repeat(101) }, expectedIssueField: 'tagline' },
      { label: 'ctaText 31 chars', payload: { productName: 'Launtion', description: 'Valid description.', ctaText: 'C'.repeat(31) }, expectedIssueField: 'ctaText' },
      { label: 'targetAudience 101 chars', payload: { productName: 'Launtion', description: 'Valid description.', targetAudience: 'A'.repeat(101) }, expectedIssueField: 'targetAudience' },

      // 1.3 Color validation fuzzing (HexColorRegex)
      { label: 'non-hex color name "red"', payload: { productName: 'Launtion', description: 'Valid description.', accentColor: 'red' }, expectedIssueField: 'accentColor' },
      { label: 'non-hex color name "blue"', payload: { productName: 'Launtion', description: 'Valid description.', primaryColor: 'blue' }, expectedIssueField: 'primaryColor' },
      { label: 'hex missing hash "FF5C35"', payload: { productName: 'Launtion', description: 'Valid description.', accentColor: 'FF5C35' }, expectedIssueField: 'accentColor' },
      { label: 'hex with invalid chars "#GG0000"', payload: { productName: 'Launtion', description: 'Valid description.', accentColor: '#GG0000' }, expectedIssueField: 'accentColor' },
      { label: 'hex invalid length 2 "#FF"', payload: { productName: 'Launtion', description: 'Valid description.', primaryColor: '#FF' }, expectedIssueField: 'primaryColor' },
      { label: 'hex invalid length 4 "#FFFF"', payload: { productName: 'Launtion', description: 'Valid description.', accentColor: '#FFFF' }, expectedIssueField: 'accentColor' },
      { label: 'hex invalid length 5 "#FFFFF"', payload: { productName: 'Launtion', description: 'Valid description.', primaryColor: '#FFFFF' }, expectedIssueField: 'primaryColor' },
      { label: 'hex invalid length 8 "#FFFFFFFF"', payload: { productName: 'Launtion', description: 'Valid description.', accentColor: '#FFFFFFFF' }, expectedIssueField: 'accentColor' },
      { label: 'rgb() format color', payload: { productName: 'Launtion', description: 'Valid description.', primaryColor: 'rgb(255, 0, 0)' }, expectedIssueField: 'primaryColor' },

      // 1.4 Tone and Goal enum fuzzing
      { label: 'invalid brand tone "hyper-aggressive"', payload: { productName: 'Launtion', description: 'Valid description.', tone: 'hyper-aggressive' }, expectedIssueField: 'tone' },
      { label: 'invalid brand tone "cyberpunk"', payload: { productName: 'Launtion', description: 'Valid description.', tone: 'cyberpunk' }, expectedIssueField: 'tone' },
      { label: 'numeric brand tone', payload: { productName: 'Launtion', description: 'Valid description.', tone: 123 }, expectedIssueField: 'tone' },
      { label: 'invalid goal "viral_spread"', payload: { productName: 'Launtion', description: 'Valid description.', goal: 'viral_spread' }, expectedIssueField: 'goal' },
      { label: 'invalid goal "fundraising"', payload: { productName: 'Launtion', description: 'Valid description.', goal: 'fundraising' }, expectedIssueField: 'goal' },

      // 1.5 Features array fuzzing
      { label: 'features array > 5 items', payload: { productName: 'Launtion', description: 'Valid description.', features: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6'] }, expectedIssueField: 'features' },
      { label: 'features item empty string', payload: { productName: 'Launtion', description: 'Valid description.', features: ['Valid', ''] }, expectedIssueField: 'features' },
      { label: 'features item 61 chars', payload: { productName: 'Launtion', description: 'Valid description.', features: ['F'.repeat(61)] }, expectedIssueField: 'features' },

      // 1.6 Numerical boundaries fuzzing
      { label: 'durationSeconds < 15', payload: { productName: 'Launtion', description: 'Valid description.', durationSeconds: 14 }, expectedIssueField: 'durationSeconds' },
      { label: 'durationSeconds > 20', payload: { productName: 'Launtion', description: 'Valid description.', durationSeconds: 21 }, expectedIssueField: 'durationSeconds' },
      { label: 'durationSeconds float (16.5)', payload: { productName: 'Launtion', description: 'Valid description.', durationSeconds: 16.5 }, expectedIssueField: 'durationSeconds' },
      { label: 'targetDurationInFrames negative', payload: { productName: 'Launtion', description: 'Valid description.', targetDurationInFrames: -100 }, expectedIssueField: 'targetDurationInFrames' },
      { label: 'targetDurationInFrames zero', payload: { productName: 'Launtion', description: 'Valid description.', targetDurationInFrames: 0 }, expectedIssueField: 'targetDurationInFrames' },
      { label: 'fps zero', payload: { productName: 'Launtion', description: 'Valid description.', fps: 0 }, expectedIssueField: 'fps' },

      // 1.7 Resolution fuzzing
      { label: 'resolution width negative', payload: { productName: 'Launtion', description: 'Valid description.', resolution: { width: -1920, height: 1080 } }, expectedIssueField: 'resolution' },
      { label: 'resolution height zero', payload: { productName: 'Launtion', description: 'Valid description.', resolution: { width: 1920, height: 0 } }, expectedIssueField: 'resolution' },

      // 1.8 Assets array fuzzing
      { label: 'assets > 5 items', payload: { productName: 'Launtion', description: 'Valid description.', assets: Array(6).fill({ assetId: 'a', kind: 'image' }) }, expectedIssueField: 'assets' },
      { label: 'asset missing assetId', payload: { productName: 'Launtion', description: 'Valid description.', assets: [{ kind: 'image' }] }, expectedIssueField: 'assets' },
      { label: 'asset invalid kind', payload: { productName: 'Launtion', description: 'Valid description.', assets: [{ assetId: 'a1', kind: '3d_model' }] }, expectedIssueField: 'assets' },
      { label: 'asset invalid url format', payload: { productName: 'Launtion', description: 'Valid description.', assets: [{ assetId: 'a1', kind: 'image', url: 'not-a-valid-url' }] }, expectedIssueField: 'assets' },

      // 1.9 Type mismatches
      { label: 'productName is number', payload: { productName: 42, description: 'Valid description.' }, expectedIssueField: 'productName' },
      { label: 'description is boolean', payload: { productName: 'Valid', description: true }, expectedIssueField: 'description' },
      { label: 'features is string instead of array', payload: { productName: 'Valid', description: 'Valid description.', features: 'feature1, feature2' }, expectedIssueField: 'features' },
      { label: 'resolution is string', payload: { productName: 'Valid', description: 'Valid description.', resolution: '1920x1080' }, expectedIssueField: 'resolution' },
    ];

    it(`1.1 rejects all ${malformedBriefs.length} adversarial fuzz vectors with safeParse === false`, () => {
      let rejectedCount = 0;
      for (const { label, payload, expectedIssueField } of malformedBriefs) {
        const parsed = ProductBriefSchema.safeParse(payload);
        assert.equal(
          parsed.success,
          false,
          `Fuzz vector "${label}" was expected to fail validation, but succeeded!`
        );
        rejectedCount++;

        if (expectedIssueField && !parsed.success) {
          const matchedIssue = parsed.error.issues.some((issue) =>
            issue.path.join('.').includes(expectedIssueField)
          );
          assert.ok(
            matchedIssue,
            `Fuzz vector "${label}" expected issue in field "${expectedIssueField}", but got paths: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`
          );
        }
      }
      assert.equal(rejectedCount, malformedBriefs.length);
    });

    it('1.2 POST /api/creative-director rejects all malformed fuzz payloads with HTTP 400', async () => {
      // Test a representative sample of 15 malformed payloads through the Next.js API route handler
      const testSubset = malformedBriefs.slice(0, 15);

      for (const { label, payload } of testSubset) {
        const req = new NextRequest('http://localhost:3000/api/creative-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const res = await POST(req);
        assert.equal(
          res.status,
          400,
          `API route did not return HTTP 400 for malformed payload: "${label}" (got ${res.status})`
        );

        const data = await res.json();
        assert.equal(data.error, 'Datos del producto inválidos');
        assert.ok(Array.isArray(data.issues) && data.issues.length > 0);
      }
    });

    it('1.3 POST /api/creative-director handles unparseable JSON strings with HTTP 400', async () => {
      const corruptJsonPayloads = [
        '{',
        '{"productName":',
        '{"productName": "Unclosed string}',
        'undefined',
        'NaN',
        '<<<XML NOT JSON>>>',
      ];

      for (const corrupt of corruptJsonPayloads) {
        const req = new NextRequest('http://localhost:3000/api/creative-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: corrupt,
        });

        const res = await POST(req);
        assert.equal(res.status, 400, `Corrupt JSON "${corrupt}" did not return HTTP 400`);
        const data = await res.json();
        assert.equal(data.error, 'Cuerpo de petición JSON inválido');
      }
    });

    it('1.4 POST /api/creative-director handles non-object JSON values (string, number, boolean, array) with HTTP 400', async () => {
      const nonObjectPayloads = [
        '"Just a plain string"',
        '42',
        'true',
        'false',
        '["item1", "item2"]',
        'null',
      ];

      for (const nonObj of nonObjectPayloads) {
        const req = new NextRequest('http://localhost:3000/api/creative-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: nonObj,
        });

        const res = await POST(req);
        assert.equal(res.status, 400, `Non-object JSON payload ${nonObj} did not return HTTP 400`);
      }
    });

    it('1.5 rejects invalid brand tones and validates all allowlisted BrandToneSchema values', () => {
      const validTones = [
        'tech-precision',
        'punchy-social',
        'editorial-clean',
        'minimal',
        'modern-punchy',
        'minimal-editorial',
        'technical-precision',
      ];

      for (const tone of validTones) {
        assert.equal(BrandToneSchema.safeParse(tone).success, true);
      }

      const invalidTones = [
        '',
        'ultra-punchy',
        'tech_precision',
        'TECH-PRECISION',
        'clean',
        'corporate-bland',
      ];

      for (const tone of invalidTones) {
        assert.equal(BrandToneSchema.safeParse(tone).success, false);
      }
    });
  });

  /* ========================================================================= */
  /* 2. DETERMINISTIC SYNTHESIZER 500-ITERATION STRESS TEST                    */
  /* ========================================================================= */
  describe('2. Deterministic Fallback Synthesizer: 500-Run Stress Benchmark', () => {
    // Deterministic pseudo-random number generator (xorshift32) for perfectly reproducible stress runs
    function createPRNG(seed = 1337) {
      let s = seed >>> 0;
      return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return (s >>> 0) / 4294967296;
      };
    }

    const tones = [
      'tech-precision',
      'punchy-social',
      'editorial-clean',
      'minimal',
      'modern-punchy',
      'minimal-editorial',
      'technical-precision',
    ] as const;

    const goals = ['launch', 'feature_announcement', 'product_demo', 'version_update'] as const;

    const sampleFeaturesPool = [
      'Real-time WebSocket Sync',
      'Zero-Config Edge Deployments',
      'Bi-directional Event Streaming',
      'Hardware-accelerated Rendering',
      'Deterministic Frame Buffer',
      'Sub-millisecond State Storage',
      'Continuous Telemetry Pipeline',
      'Automated Schema Generation',
      'Live Collaboration Studio',
      'Multi-region Asset Ingestion',
    ];

    const sampleColors = [
      '#FF5C35', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899',
      '#F59E0B', '#06B6D4', '#E11D48', '#0EA5E9', '#6366F1',
      '#F00', '#0F0', '#00F', '#FFF', '#123',
    ];

    function generateRandomBrief(prng: () => number, index: number): ProductBriefInput {
      const tone = tones[Math.floor(prng() * tones.length)];
      const goal = goals[Math.floor(prng() * goals.length)];
      const numFeatures = Math.floor(prng() * 6); // 0 to 5 features
      const features: string[] = [];
      for (let f = 0; f < numFeatures; f++) {
        features.push(sampleFeaturesPool[Math.floor(prng() * sampleFeaturesPool.length)]);
      }

      const hasAccent = prng() > 0.2;
      const hasPrimary = prng() > 0.2;
      const accentColor = hasAccent ? sampleColors[Math.floor(prng() * sampleColors.length)] : undefined;
      const primaryColor = hasPrimary ? sampleColors[Math.floor(prng() * sampleColors.length)] : undefined;

      const productNames = [
        `CloudStream_${index}`,
        `PulseIO-${index}`,
        `SynthEngine v${(index % 10) + 1}.0`,
        `HyperScale-${index}`,
        `ApexMetrics [${index}]`,
        `KubePulse (Global)`,
        `NeonCore #${index}`,
      ];

      return {
        productName: productNames[index % productNames.length],
        description: `High-performance deterministic streaming video synthesis engine for SaaS cloud applications - generation #${index}.`,
        tagline: prng() > 0.3 ? `Accelerating cloud delivery for cycle #${index}` : undefined,
        targetAudience: prng() > 0.4 ? 'Modern Engineering Teams' : undefined,
        tone,
        goal,
        accentColor,
        primaryColor,
        features,
        ctaText: prng() > 0.3 ? 'Start Building Now' : undefined,
      };
    }

    it('2.1 executes 500 randomized generations with 100% validity (500/500 pass) and evaluates in < 3ms/gen', () => {
      const TOTAL_RUNS = 500;
      const prng = createPRNG(424242);

      let successCount = 0;
      let failureCount = 0;
      const durations: number[] = [];

      for (let i = 0; i < TOTAL_RUNS; i++) {
        const brief = generateRandomBrief(prng, i);

        const t0 = performance.now();
        const graph = generateDeterministicSceneGraph(brief);
        const elapsed = performance.now() - t0;
        durations.push(elapsed);

        // Strict Zod validation on generated output
        const validation = SceneGraphSchema.safeParse(graph);
        if (validation.success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Structural and physical invariant assertions
        assert.equal(graph.version, '2.0', `Run #${i}: graph.version must be '2.0'`);
        assert.equal(graph.canvas.durationInFrames, 480, `Run #${i}: durationInFrames must be 480`);
        assert.equal(graph.canvas.fps, 30, `Run #${i}: fps must be 30`);
        assert.equal(graph.scenes.length, 5, `Run #${i}: must contain exactly 5 scenes`);

        // Check scene continuity (F0 to F480 without gaps)
        const totalDuration = graph.scenes.reduce((acc, sc) => acc + sc.durationInFrames, 0);
        assert.equal(totalDuration, 480, `Run #${i}: sum of scene durations must equal 480`);

        // Camera track invariant
        assert.ok(graph.cameraTrack.length >= 8, `Run #${i}: cameraTrack must have >= 8 keyframes`);
        for (const kf of graph.cameraTrack) {
          assert.ok(kf.frame >= 0 && kf.frame <= 480, `Run #${i}: kf.frame ${kf.frame} out of bounds`);
          assert.ok(kf.x >= 0.0 && kf.x <= 1.0, `Run #${i}: kf.x ${kf.x} out of bounds`);
          assert.ok(kf.y >= 0.0 && kf.y <= 1.0, `Run #${i}: kf.y ${kf.y} out of bounds`);
          assert.ok(kf.zoom >= 0.8 && kf.zoom <= 3.5, `Run #${i}: kf.zoom ${kf.zoom} out of bounds`);
        }

        // Cursor track invariant & click alignment
        assert.ok(graph.cursorTrack.length >= 6, `Run #${i}: cursorTrack must have >= 6 keyframes`);
        const clickFrames = graph.cursorTrack.filter((ck) => ck.click).map((ck) => ck.frame);
        assert.ok(clickFrames.length >= 3, `Run #${i}: cursor track must have at least 3 click events`);

        // Audio cues synchronization with cursor clicks
        const mouseClickCues = graph.audioTrack.filter((ac) => ac.asset === 'mouse-click').map((ac) => ac.frame);
        for (const clickFrame of clickFrames) {
          assert.ok(
            mouseClickCues.includes(clickFrame),
            `Run #${i}: mouse-click audio cue missing at cursor click frame ${clickFrame}`
          );
        }
      }

      // Compute statistics
      const totalTimeMs = durations.reduce((a, b) => a + b, 0);
      const avgLatencyMs = totalTimeMs / TOTAL_RUNS;
      const sorted = [...durations].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(TOTAL_RUNS * 0.5)];
      const p95 = sorted[Math.floor(TOTAL_RUNS * 0.95)];
      const p99 = sorted[Math.floor(TOTAL_RUNS * 0.99)];
      const maxLatencyMs = sorted[sorted.length - 1];

      // Diagnostic metrics logged for test output transparency
      console.log(`\n=== EMPIRICAL DETERMINISTIC GENERATOR STRESS METRICS ===`);
      console.log(`Iterations: ${TOTAL_RUNS}`);
      console.log(`Successes: ${successCount} / ${TOTAL_RUNS} (100.0%)`);
      console.log(`Failures: ${failureCount} / ${TOTAL_RUNS} (0.0%)`);
      console.log(`Total Time: ${totalTimeMs.toFixed(2)} ms`);
      console.log(`Mean Latency: ${avgLatencyMs.toFixed(4)} ms / generation (Threshold: < 3.0 ms)`);
      console.log(`P50: ${p50.toFixed(4)} ms | P95: ${p95.toFixed(4)} ms | P99: ${p99.toFixed(4)} ms | Max: ${maxLatencyMs.toFixed(4)} ms`);
      console.log(`========================================================\n`);

      // Mandatory Empirical Assertions
      assert.equal(successCount, 500, `Expected 500 successful generations, got ${successCount}`);
      assert.equal(failureCount, 0, `Expected 0 failures, got ${failureCount}`);
      assert.ok(
        avgLatencyMs < 3.0,
        `Average generation latency ${avgLatencyMs.toFixed(3)}ms exceeded maximum threshold of 3.0ms`
      );
    });
  });

  /* ========================================================================= */
  /* 3. GEMINI ERROR MODES & RESILIENCE MATRIX                                 */
  /* ========================================================================= */
  describe('3. Gemini Error Modes Mock Matrix & Fallback Resilience', () => {
    const validTestBrief = {
      productName: 'ApexTelemetry',
      description: 'Distributed real-time analytics and telemetry pipeline for mission-critical software.',
      tone: 'tech-precision' as const,
      accentColor: '#3B82F6',
    };

    it('3.1 handles HTTP 429 (Rate Limit / Quota Exceeded) gracefully with valid fallback', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 429,
              message: 'Resource has been exhausted (e.g. check quota).',
              status: 'RESOURCE_EXHAUSTED',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );

      const result = await generateCreativeDirectorSceneGraph(validTestBrief, {
        apiKey: 'mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert.ok(result.reason?.includes('GEMINI_HTTP_429'), `Reason should mention 429, got: ${result.reason}`);
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
      assert.equal(result.sceneGraph.canvas.durationInFrames, 480);
    });

    it('3.2 handles HTTP 500 (Internal Server Error) gracefully with valid fallback', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response('Internal Server Error', { status: 500 });

      const result = await generateCreativeDirectorSceneGraph(validTestBrief, {
        apiKey: 'mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert.ok(result.reason?.includes('GEMINI_HTTP_500'), `Reason should mention 500, got: ${result.reason}`);
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
    });

    it('3.3 handles HTTP 503 (Service Unavailable) gracefully with valid fallback', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response('Service Temporarily Unavailable', { status: 503 });

      const result = await generateCreativeDirectorSceneGraph(validTestBrief, {
        apiKey: 'mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert.ok(result.reason?.includes('GEMINI_HTTP_503'), `Reason should mention 503, got: ${result.reason}`);
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
    });

    it('3.4 handles network timeout / abort signal without throwing', async () => {
      const mockFetch: typeof fetch = async () => {
        const error = new Error('The operation was aborted due to timeout');
        error.name = 'TimeoutError';
        throw error;
      };

      const result = await generateCreativeDirectorSceneGraph(validTestBrief, {
        apiKey: 'mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert.ok(
        result.reason?.includes('aborted') || result.reason?.includes('timeout'),
        `Reason should report timeout/abort, got: ${result.reason}`
      );
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
    });

    it('3.5 handles raw HTML gateway response (corrupt non-JSON) without crashing', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response(
          '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>',
          { status: 200, headers: { 'Content-Type': 'text/html' } }
        );

      const result = await generateCreativeDirectorSceneGraph(validTestBrief, {
        apiKey: 'mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
    });

    it('3.6 handles truncated JSON model response without crashing', async () => {
      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: '{"version": "2.0", "canvas": { "width": 1920,', // truncated
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

      const result = await generateCreativeDirectorSceneGraph(validTestBrief, {
        apiKey: 'mock-key',
        fetchFn: mockFetch,
      });

      assert.equal(result.source, 'deterministic-fallback');
      assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
    });

    it('3.7 handles empty candidates and empty content parts', async () => {
      const emptyPayloads = [
        { candidates: [] },
        { candidates: [{}] },
        { candidates: [{ content: {} }] },
        { candidates: [{ content: { parts: [] } }] },
        { candidates: [{ content: { parts: [{ text: '' }] } }] },
      ];

      for (const payload of emptyPayloads) {
        const mockFetch: typeof fetch = async () =>
          new Response(JSON.stringify(payload), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });

        const result = await generateCreativeDirectorSceneGraph(validTestBrief, {
          apiKey: 'mock-key',
          fetchFn: mockFetch,
        });

        assert.equal(result.source, 'deterministic-fallback');
        assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
      }
    });

    it('3.8 handles model output with missing required fields (e.g. missing scenes or canvas)', async () => {
      const corruptSceneGraphs = [
        {}, // completely empty
        { version: '2.0' }, // missing canvas, scenes, tracks
        { version: '2.0', canvas: { width: 1920, height: 1080, fps: 30, durationInFrames: 480 } }, // missing scenes
        { scenes: [] }, // missing canvas and tracks
      ];

      for (const corruptGraph of corruptSceneGraphs) {
        const mockFetch: typeof fetch = async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [{ text: JSON.stringify(corruptGraph) }],
                  },
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );

        const result = await generateCreativeDirectorSceneGraph(validTestBrief, {
          apiKey: 'mock-key',
          fetchFn: mockFetch,
        });

        assert.equal(result.source, 'deterministic-fallback');
        assert.equal(SceneGraphSchema.safeParse(result.sceneGraph).success, true);
      }
    });

    it('3.9 sanitizes and heals minor LLM hallucinations when possible', () => {
      const hallucinatedGraph = {
        version: '1.0-hallucinated',
        canvas: { width: 9999, height: 9999, fps: 120, durationInFrames: 1000 },
        artDirection: { backdropVariant: 'neon-matrix', surfaceTheme: 'cyber', primaryAccent: 'invalid-color' },
        cameraTrack: [
          { frame: -50, x: -2.0, y: 5.0, zoom: 0.1 },
          { frame: 1000, x: 2.0, y: -1.0, zoom: 10.0 },
        ],
        cursorTrack: [
          { frame: 999, x: 3.5, y: -2.5, click: true },
        ],
        audioTrack: [
          { id: '', frame: 1200, asset: 'heavy-metal-screech', volume: 5.0 },
        ],
        scenes: [
          { id: '', type: 'synthetic_prompt_box', startFrame: 50, durationInFrames: 500, payload: { textToType: 'Test' } },
        ],
      };

      const sanitized = sanitizeAiSceneGraph(hallucinatedGraph, ProductBriefSchema.parse(validTestBrief)) as SceneGraph;

      // Invariants enforced by sanitizer
      assert.equal(sanitized.version, '2.0');
      assert.equal(sanitized.canvas.durationInFrames, 480);
      assert.equal(sanitized.canvas.fps, 30);
      assert.equal(sanitized.canvas.width, 1920);
      assert.equal(sanitized.canvas.height, 1080);
      assert.equal(sanitized.artDirection.backdropVariant, 'dark-precision'); // default fallback
      assert.equal(sanitized.artDirection.surfaceTheme, 'dark'); // default fallback
      // Primary accent healed to valid hex (#FF5C35)
      assert.ok(HexColorRegex.test(sanitized.artDirection.primaryAccent));
      assert.equal(sanitized.artDirection.primaryAccent, '#FF5C35');

      // Camera keyframes clamped
      assert.equal(sanitized.cameraTrack[0].frame, 0); // clamped from -50
      assert.equal(sanitized.cameraTrack[0].x, 0.0); // clamped from -2.0
      assert.equal(sanitized.cameraTrack[0].y, 1.0); // clamped from 5.0
      assert.equal(sanitized.cameraTrack[0].zoom, 0.8); // clamped from 0.1 min
      assert.equal(sanitized.cameraTrack[1].frame, 480); // clamped from 1000
      assert.equal(sanitized.cameraTrack[1].zoom, 3.5); // clamped from 10.0 max

      // Cursor track clamped
      assert.equal(sanitized.cursorTrack[0].frame, 480);
      assert.equal(sanitized.cursorTrack[0].x, 1.0);
      assert.equal(sanitized.cursorTrack[0].y, 0.0);

      // Audio cue healed
      assert.equal(sanitized.audioTrack[0].frame, 480);
      assert.equal(sanitized.audioTrack[0].asset, 'soft-pop'); // replaced invalid asset
      assert.equal(sanitized.audioTrack[0].volume, 1.0); // clamped from 5.0
    });

    it('3.10 strips adversarial markdown code fences and whitespace from model output', () => {
      const fenceVariations = [
        { raw: '```json\n{"version":"2.0"}\n```', expected: '{"version":"2.0"}' },
        { raw: '```\n{"version":"2.0"}\n```', expected: '{"version":"2.0"}' },
        { raw: '   ```json   \n   {"version":"2.0"}   \n   ```   ', expected: '{"version":"2.0"}' },
        { raw: '{"version":"2.0"}', expected: '{"version":"2.0"}' },
        { raw: '```json{"version":"2.0"}```', expected: '{"version":"2.0"}' },
      ];

      for (const { raw, expected } of fenceVariations) {
        assert.equal(cleanModelJsonOutput(raw), expected);
      }
    });
  });

  /* ========================================================================= */
  /* 4. POST /api/creative-director INTEGRATION RESILIENCE                     */
  /* ========================================================================= */
  describe('4. API Route Integration Resilience Under Failure Modes', () => {
    it('4.1 returns HTTP 200 with deterministic fallback when upstream Gemini throws 429', async () => {
      // Temporarily override global fetch to simulate 429 inside Next.js route
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ error: { code: 429, message: 'Rate limit exceeded' } }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          })) as typeof fetch;

        // Provide temporary env var so route attempts calling fetch
        process.env.GEMINI_API_KEY = 'temp-test-key';

        const req = new NextRequest('http://localhost:3000/api/creative-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: 'StressTestSaaS',
            description: 'Verifying end-to-end route resilience under upstream 429 rate limits.',
          }),
        });

        const res = await POST(req);
        assert.equal(res.status, 200, 'Expected route to return 200 with fallback, got ' + res.status);

        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.source, 'deterministic-fallback');
        assert.ok(data.reason?.includes('429'));
        assert.equal(SceneGraphSchema.safeParse(data.sceneGraph).success, true);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
      }
    });

    it('4.2 returns HTTP 200 with deterministic fallback when upstream Gemini throws 500', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async () =>
          new Response('Internal Server Error', { status: 500 })) as typeof fetch;

        process.env.GEMINI_API_KEY = 'temp-test-key';

        const req = new NextRequest('http://localhost:3000/api/creative-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: 'CrashRecoverySaaS',
            description: 'Verifying end-to-end route resilience under upstream 500 server crash.',
          }),
        });

        const res = await POST(req);
        assert.equal(res.status, 200);

        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.source, 'deterministic-fallback');
        assert.ok(data.reason?.includes('500'));
        assert.equal(SceneGraphSchema.safeParse(data.sceneGraph).success, true);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
      }
    });

    it('4.3 returns HTTP 200 with deterministic fallback when fetch network connection drops', async () => {
      const originalFetch = globalThis.fetch;
      try {
        globalThis.fetch = (async () => {
          throw new TypeError('fetch failed: ECONNREFUSED 127.0.0.1:443');
        }) as typeof fetch;

        process.env.GEMINI_API_KEY = 'temp-test-key';

        const req = new NextRequest('http://localhost:3000/api/creative-director', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: 'OfflineSaaS',
            description: 'Verifying end-to-end route resilience under network disconnect.',
          }),
        });

        const res = await POST(req);
        assert.equal(res.status, 200);

        const data = await res.json();
        assert.equal(data.success, true);
        assert.equal(data.source, 'deterministic-fallback');
        assert.ok(data.reason?.includes('ECONNREFUSED') || data.reason?.includes('fetch failed'));
        assert.equal(SceneGraphSchema.safeParse(data.sceneGraph).success, true);
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.GEMINI_API_KEY;
      }
    });
  });
});
