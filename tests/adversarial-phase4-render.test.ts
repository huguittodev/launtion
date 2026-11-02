/**
 * tests/adversarial-phase4-render.test.ts
 *
 * Empirical Adversarial Verification Suite — Phase 4 Challenger 2:
 * Adversarially verify Remotion composition rendering with AI-generated / synthesized SceneGraphs
 * from the Creative Director engine across all 480 frames [0, 479].
 *
 * Verification Scope:
 * 1. Diverse Brief Synthesis:
 *    - Enterprise Dark Theme ('technical-precision', 'dark-precision', dark surface)
 *    - Minimal Light Theme ('editorial-clean', 'light-editorial', light surface)
 *    - Bold Playful Theme ('punchy-social', 'aurora-blur', vibrant accent)
 *    - Extreme Boundary Stress Brief (max length strings, shorthand hex, 5 features)
 *    - Sanitized AI Structured Output (simulated LLM candidate passing through sanitizeAiSceneGraph)
 * 2. 480-Frame Exhaustive Mathematical Oracles:
 *    - ZERO NaNs in CameraRig CSS matrix transforms across all 480 frames
 *    - ZERO NaNs in SmartCursor kinematics, click scale compression, and ripple
 *    - Camera focal drift strictly <= 0.5px (zero focal drift law) across all frames and briefs
 *    - AudioEngine master gain strictly <= 0.95 (zero digital clipping) across all frames and briefs
 * 3. Remotion Still PNG Render & Byte Stream Verification:
 *    - Render still frames at diverse commercial beats [120, 240, 365, 440]
 *    - Empirical PNG binary header validation (magic bytes, IHDR chunk, IEND chunk)
 *    - Resolution verification (1920x1080) and minimum payload size (> 25KB)
 * 4. High-Polyphony SFX Stress Invariant:
 *    - 30 simultaneous maximum-volume SFX overlapping with background music bounded <= 0.95
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { interpolate, Easing } from 'remotion';

import { ProductBriefSchema, type ProductBrief } from '../src/lib/ai/brief-schema';
import { generateDeterministicSceneGraph } from '../src/lib/ai/deterministic-fallback';
import { sanitizeAiSceneGraph } from '../src/lib/ai/gemini-adapter';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import type { AudioAsset, SceneGraph } from '../src/lib/scene-graph/types';
import { evaluateCameraPath } from '../remotion/motion-kit/camera/CameraPath';
import { calculateCameraTransform } from '../remotion/motion-kit/camera/CameraTransform';
import { interpolateCursorTrack } from '../remotion/motion-kit/cursor/BezierPath';
import { buildAudioTimeline } from '../remotion/motion-kit/audio/AudioTimeline';
import { calculateFadeGain } from '../remotion/motion-kit/audio/FadeController';
import { calculateDuckingFactor, softLimitGain } from '../remotion/motion-kit/audio/AudioMixer';

describe('Adversarial Verification: Creative Director SceneGraphs & Remotion 480-Frame Render Integrity', () => {
  const outDir = path.resolve(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // =========================================================================
  // 1. DIVERSE BRIEFS DEFINITIONS
  // =========================================================================
  const briefs: Record<string, ProductBrief> = {
    enterpriseDark: ProductBriefSchema.parse({
      productName: 'Datamesh Cloud',
      description: 'Enterprise distributed transactional lakehouse with real-time stream synchronization and autonomous telemetry.',
      tagline: 'Enterprise data fabric at planetary scale',
      targetAudience: 'Infrastructure & Data Engineers',
      goal: 'launch',
      tone: 'technical-precision',
      primaryColor: '#2563EB',
      accentColor: '#38BDF8',
      surfaceTheme: 'dark',
      backdropVariant: 'dark-precision',
      features: ['Distributed Raft Engine', 'Zero Copy Telemetry', 'Sub-millisecond Replay'],
      ctaText: 'Deploy Enterprise Cluster',
      durationSeconds: 16,
      targetDurationInFrames: 480,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
    }),

    minimalLight: ProductBriefSchema.parse({
      productName: 'Clarion Editorial',
      description: 'Minimalist publishing environment with distraction-free typography and real-time collaboration.',
      tagline: 'Pure focus for modern writers and journalists',
      targetAudience: 'Content Designers & Authors',
      goal: 'feature_announcement',
      tone: 'editorial-clean',
      primaryColor: '#181716',
      accentColor: '#4F46E5',
      surfaceTheme: 'light',
      backdropVariant: 'light-editorial',
      features: ['Clean Typography', 'Instant Markdown Sync', 'Static CDN Export'],
      ctaText: 'Start Writing Free',
      durationSeconds: 16,
      targetDurationInFrames: 480,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
    }),

    boldPlayful: ProductBriefSchema.parse({
      productName: 'VibeCheck Gamify',
      description: 'Viral gamification and engagement booster for high-growth consumer apps and creator brands.',
      tagline: 'Turn user engagement into viral growth loops',
      targetAudience: 'Consumer Growth Hackers',
      goal: 'product_demo',
      tone: 'punchy-social',
      primaryColor: '#EC4899',
      accentColor: '#8B5CF6',
      surfaceTheme: 'dark',
      backdropVariant: 'aurora-blur',
      features: ['Reward Streaks', 'Social Wheel', 'Leaderboard Drops'],
      ctaText: 'Boost Retention 10x',
      durationSeconds: 16,
      targetDurationInFrames: 480,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
    }),

    boundaryStress: ProductBriefSchema.parse({
      productName: 'UltraScalr'.padEnd(50, 'A'), // Exact 50 chars
      description: 'Mission-critical distributed database system for high-velocity streaming workloads. '.repeat(6).slice(0, 500), // Exact 500 chars
      tagline: 'Planetary latency guarantees and infinite durability for real-time edge workloads'.padEnd(100, '.'), // Exact 100 chars
      targetAudience: 'Elite Chief Technology Officers & Distributed Systems Architects Worldwide',
      goal: 'version_update',
      tone: 'minimal',
      primaryColor: '#ABC', // 3-char shorthand hex
      accentColor: '#10B981',
      features: [
        'Multi-Region Active Raft Partitioning Engine',
        'Deterministic Frame Synchronization Protocol',
        'Sub-Millisecond Read Latency Globally Distributed',
        'Automated Zero-Downtime Cluster Rebalancing',
        'Cryptographic Tamper-Proof Audit Logging Stream',
      ],
      ctaText: 'Start Enterprise POC Now', // 24 chars <= 30
      durationSeconds: 16,
      targetDurationInFrames: 480,
      fps: 30,
      resolution: { width: 1920, height: 1080 },
    }),
  };

  // Synthesize graphs
  const synthesizedGraphs: Record<string, SceneGraph> = {
    enterpriseDark: generateDeterministicSceneGraph(briefs.enterpriseDark),
    minimalLight: generateDeterministicSceneGraph(briefs.minimalLight),
    boldPlayful: generateDeterministicSceneGraph(briefs.boldPlayful),
    boundaryStress: generateDeterministicSceneGraph(briefs.boundaryStress),
  };

  // Create a 5th graph simulating AI structured output passed through sanitizeAiSceneGraph
  const rawAiCandidate = {
    version: '2.0',
    canvas: { width: 1920, height: 1080, fps: 30, durationInFrames: 480 },
    artDirection: {
      backdropVariant: 'aurora-blur',
      surfaceTheme: 'dark',
      primaryAccent: '#F59E0B',
    },
    cameraTrack: [
      { frame: 0, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 5, rotateY: -3, easing: 'ease-in-out' },
      { frame: 90, x: 0.5, y: 0.5, zoom: 1.05, rotateX: 0, rotateY: 0, easing: 'ease-in-out' },
      { frame: 160, x: 0.65, y: 0.40, zoom: 2.35, rotateX: -3, rotateY: 2, easing: 'ease-in-out' },
      { frame: 250, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0, rotateY: 0, easing: 'ease-in-out' },
      { frame: 350, x: 0.5, y: 0.5, zoom: 1.2, rotateX: 0, rotateY: 0, easing: 'ease-in-out' },
      { frame: 480, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0, rotateY: 0, easing: 'ease-in-out' },
    ],
    cursorTrack: [
      { frame: 0, x: 0.9, y: 0.9 },
      { frame: 80, x: 0.6, y: 0.6, controlX: 0.75, controlY: 0.8, click: true },
      { frame: 160, x: 0.65, y: 0.4, controlX: 0.5, controlY: 0.5, click: true },
      { frame: 350, x: 0.5, y: 0.5, controlX: 0.7, controlY: 0.6, click: true },
      { frame: 480, x: 0.95, y: 0.95 },
    ],
    audioTrack: [
      { id: 'ai-amb', frame: 0, asset: 'ambient-beat', volume: 0.35, fadeInFrames: 20, fadeOutFrames: 40 },
      { id: 'ai-tap', frame: 15, asset: 'keyboard-tap', volume: 0.5 },
      { id: 'ai-click1', frame: 80, asset: 'mouse-click', volume: 0.85 },
      { id: 'ai-whoosh1', frame: 120, asset: 'camera-whoosh', volume: 0.45 },
      { id: 'ai-click2', frame: 160, asset: 'mouse-click', volume: 0.85 },
      { id: 'ai-pop', frame: 250, asset: 'soft-pop', volume: 0.6 },
      { id: 'ai-click3', frame: 350, asset: 'mouse-click', volume: 0.85 },
      { id: 'ai-chime', frame: 400, asset: 'chime', volume: 0.75 },
    ],
    scenes: [
      {
        id: 'ai-scene-1',
        type: 'synthetic_prompt_box',
        startFrame: 0,
        fromFrame: 0,
        durationInFrames: 90,
        payload: { textToType: 'Deploy AI neural clusters with automated telemetry', typingSpeed: 1.2 },
      },
      {
        id: 'ai-scene-2',
        type: 'product_interaction_3d',
        startFrame: 90,
        fromFrame: 90,
        durationInFrames: 150,
        payload: { productName: 'NeuralMesh', windowTitle: 'NeuralMesh AI Console', headline: 'Distributed Mesh', buttonText: 'Deploy' },
      },
      {
        id: 'ai-scene-3',
        type: 'synthetic_code_tree',
        startFrame: 240,
        fromFrame: 240,
        durationInFrames: 90,
        payload: { title: 'NeuralMesh Architecture', files: ['core/engine.ts', 'mesh/router.ts'] },
      },
      {
        id: 'ai-scene-4',
        type: 'synthetic_hero_button',
        startFrame: 330,
        fromFrame: 330,
        durationInFrames: 70,
        payload: { buttonText: 'Deploy Now', variant: 'glow-primary', clickFrame: 350 },
      },
      {
        id: 'ai-scene-5',
        type: 'brand_closing_cta',
        startFrame: 400,
        fromFrame: 400,
        durationInFrames: 80,
        payload: { productName: 'NeuralMesh', tagline: 'Intelligence at Scale', showLogo: true, buttonText: 'Get Started' },
      },
    ],
  };

  const sanitizedAiGraph = SceneGraphSchema.parse(
    sanitizeAiSceneGraph(rawAiCandidate, briefs.boldPlayful)
  );
  synthesizedGraphs.sanitizedAiGraph = sanitizedAiGraph;

  // =========================================================================
  // 2. SYNTHESIZED SCENEGRAPH VALIDITY BENCHMARK
  // =========================================================================
  describe('1. Diverse Brief Synthesis & Zod Schema Validation', () => {
    test('1.1 All 5 synthesized SceneGraphs satisfy SceneGraphSchema with zero validation warnings', () => {
      for (const [key, graph] of Object.entries(synthesizedGraphs)) {
        const parsed = SceneGraphSchema.safeParse(graph);
        assert.ok(parsed.success, `Graph ${key} failed SceneGraphSchema validation: ${JSON.stringify(parsed.error?.issues)}`);
        assert.equal(graph.canvas.durationInFrames, 480);
        assert.equal(graph.canvas.fps, 30);
        assert.equal(graph.canvas.width, 1920);
        assert.equal(graph.canvas.height, 1080);
        assert.equal(graph.scenes.length, 5);
      }
    });

    test('1.2 Art direction correctly mirrors requested brand tones and color schemes', () => {
      // Enterprise Dark
      assert.equal(synthesizedGraphs.enterpriseDark.artDirection.surfaceTheme, 'dark');
      assert.equal(synthesizedGraphs.enterpriseDark.artDirection.backdropVariant, 'dark-precision');
      assert.equal(synthesizedGraphs.enterpriseDark.artDirection.primaryAccent, '#38BDF8');

      // Minimal Light
      assert.equal(synthesizedGraphs.minimalLight.artDirection.surfaceTheme, 'light');
      assert.equal(synthesizedGraphs.minimalLight.artDirection.backdropVariant, 'light-editorial');
      assert.equal(synthesizedGraphs.minimalLight.artDirection.primaryAccent, '#4F46E5');

      // Bold Playful
      assert.equal(synthesizedGraphs.boldPlayful.artDirection.surfaceTheme, 'dark');
      assert.equal(synthesizedGraphs.boldPlayful.artDirection.backdropVariant, 'aurora-blur');
      assert.equal(synthesizedGraphs.boldPlayful.artDirection.primaryAccent, '#8B5CF6');

      // Boundary Stress
      assert.equal(synthesizedGraphs.boundaryStress.artDirection.surfaceTheme, 'dark');
      assert.equal(synthesizedGraphs.boundaryStress.artDirection.primaryAccent, '#10B981');
    });
  });

  // =========================================================================
  // 3. 480-FRAME ZERO-NAN & FOCAL DRIFT VERIFICATION (ALL BRIEFS)
  // =========================================================================
  describe('2. 480-Frame Zero-NaN & Camera Focal Drift Oracles', () => {
    for (const [briefKey, graph] of Object.entries(synthesizedGraphs)) {
      test(`2.1 [${briefKey}] Evaluates all 480 frames with ZERO NaNs and focal drift <= 0.5px`, () => {
        let maxFocalDrift = 0;
        let nanCount = 0;

        for (let frame = 0; frame < 480; frame++) {
          const cameraState = evaluateCameraPath(graph.cameraTrack, frame);

          // Check camera state values
          if (
            Number.isNaN(cameraState.x) ||
            Number.isNaN(cameraState.y) ||
            Number.isNaN(cameraState.zoom) ||
            (cameraState.rotateX !== undefined && Number.isNaN(cameraState.rotateX)) ||
            (cameraState.rotateY !== undefined && Number.isNaN(cameraState.rotateY)) ||
            (cameraState.rotateZ !== undefined && Number.isNaN(cameraState.rotateZ))
          ) {
            nanCount++;
          }

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

          // Verify transform string
          if (
            transformResult.transform.includes('NaN') ||
            transformResult.transform.includes('undefined') ||
            transformResult.transform.includes('null')
          ) {
            nanCount++;
          }

          // Verify focal drift
          assert.ok(
            Number.isFinite(transformResult.focalDrift),
            `Frame ${frame}: focal drift must be finite, got ${transformResult.focalDrift}`
          );
          if (transformResult.focalDrift > maxFocalDrift) {
            maxFocalDrift = transformResult.focalDrift;
          }

          assert.ok(
            transformResult.focalDrift <= 0.5,
            `[${briefKey}] Frame ${frame}: focal drift ${transformResult.focalDrift}px exceeds 0.5px maximum threshold`
          );
        }

        assert.equal(nanCount, 0, `[${briefKey}] Detected ${nanCount} NaNs in camera transform calculations!`);
        assert.ok(maxFocalDrift <= 0.5, `[${briefKey}] Max focal drift ${maxFocalDrift}px exceeds 0.5px`);
      });
    }
  });

  // =========================================================================
  // 4. 480-FRAME SMARTCURSOR KINEMATICS & CLICK SCALE INVARIANT (ALL BRIEFS)
  // =========================================================================
  describe('3. 480-Frame SmartCursor Kinematics & Click Physics Oracles', () => {
    for (const [briefKey, graph] of Object.entries(synthesizedGraphs)) {
      test(`3.1 [${briefKey}] Evaluates all 480 frames of cursor kinematics with ZERO NaNs and bounded click compression`, () => {
        let nanCount = 0;
        let minClickScale = 1.0;
        let maxRippleRadius = 0;

        for (let frame = 0; frame < 480; frame++) {
          const cursorState = interpolateCursorTrack(graph.cursorTrack, frame);

          if (
            Number.isNaN(cursorState.x) ||
            Number.isNaN(cursorState.y) ||
            !Number.isFinite(cursorState.x) ||
            !Number.isFinite(cursorState.y)
          ) {
            nanCount++;
          }

          assert.ok(cursorState.x >= 0.0 && cursorState.x <= 1.0, `[${briefKey}] Frame ${frame}: x=${cursorState.x} out of [0, 1]`);
          assert.ok(cursorState.y >= 0.0 && cursorState.y <= 1.0, `[${briefKey}] Frame ${frame}: y=${cursorState.y} out of [0, 1]`);

          // Click compression & ripple simulation
          let clickScale = 1.0;
          let rippleRadius = 0;
          let rippleOpacity = 0;

          if (cursorState.isClickActive && cursorState.clickElapsed >= 0) {
            const elapsed = cursorState.clickElapsed;
            clickScale = interpolate(elapsed, [0, 2, 6], [1.0, 0.92, 1.0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

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

          if (
            Number.isNaN(clickScale) ||
            Number.isNaN(rippleRadius) ||
            Number.isNaN(rippleOpacity)
          ) {
            nanCount++;
          }

          if (clickScale < minClickScale) {
            minClickScale = clickScale;
          }
          if (rippleRadius > maxRippleRadius) {
            maxRippleRadius = rippleRadius;
          }

          assert.ok(clickScale >= 0.90 && clickScale <= 1.0, `[${briefKey}] Frame ${frame}: clickScale=${clickScale} out of bounds`);
          assert.ok(rippleOpacity >= 0.0 && rippleOpacity <= 0.70, `[${briefKey}] Frame ${frame}: rippleOpacity=${rippleOpacity}`);
        }

        assert.equal(nanCount, 0, `[${briefKey}] Detected ${nanCount} NaNs in SmartCursor kinematics!`);
        assert.ok(minClickScale <= 0.93 && minClickScale >= 0.91, `[${briefKey}] Expected physical click compression ~0.92, observed: ${minClickScale}`);
      });
    }
  });

  // =========================================================================
  // 5. 480-FRAME AUDIO TIMELINE & MASTER LIMITER ORACLE (ALL BRIEFS)
  // =========================================================================
  describe('4. 480-Frame AudioEngine Scheduling & Soft-Knee Limiter Oracles', () => {
    for (const [briefKey, graph] of Object.entries(synthesizedGraphs)) {
      test(`4.1 [${briefKey}] Evaluates master volume across all 480 frames strictly <= 0.95 (zero clipping)`, () => {
        const timeline = buildAudioTimeline({
          audioTrack: graph.audioTrack,
          durationInFrames: graph.canvas.durationInFrames,
          fps: graph.canvas.fps,
        });

        assert.ok(timeline.cues.length > 0, `[${briefKey}] Must schedule audio cues`);
        assert.ok(timeline.musicCues.length > 0, `[${briefKey}] Must have background music`);
        assert.ok(timeline.sfxCues.length > 0, `[${briefKey}] Must have SFX cues`);

        const sfxDuckingMeta = timeline.sfxCues.map((c) => ({
          startFrame: c.startFrame,
          durationInFrames: c.durationInFrames,
          priority: c.duckingPriority,
        }));

        let maxMasterVolume = 0;
        let nanCount = 0;

        for (let frame = 0; frame < 480; frame++) {
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

          const { limitFactor, limitedGain } = softLimitGain(rawSum, 0.70, 0.95);

          if (Number.isNaN(limitFactor) || Number.isNaN(limitedGain)) {
            nanCount++;
          }

          if (limitedGain > maxMasterVolume) {
            maxMasterVolume = limitedGain;
          }

          assert.ok(
            limitedGain <= 0.950001,
            `[${briefKey}] Frame ${frame}: limitedGain=${limitedGain} breached 0.95 headroom ceiling!`
          );
          assert.ok(
            limitedGain >= 0,
            `[${briefKey}] Frame ${frame}: limitedGain=${limitedGain} must be >= 0`
          );
        }

        assert.equal(nanCount, 0, `[${briefKey}] Detected ${nanCount} NaNs in AudioEngine limiter!`);
        assert.ok(maxMasterVolume <= 0.950001, `[${briefKey}] Max master volume ${maxMasterVolume} exceeds 0.95`);
      });
    }

    test('4.2 High-Polyphony SFX Stress: 30 simultaneous maximum-volume SFX cues remain bounded <= 0.95', () => {
      const graph = synthesizedGraphs.enterpriseDark;
      const stressedAudioTrack = [...graph.audioTrack];

      // Inject 30 overlapping SFX cues at frame 150
      for (let i = 0; i < 30; i++) {
        stressedAudioTrack.push({
          id: `stress-sfx-${i}`,
          frame: 150,
          asset: (i % 2 === 0 ? 'mouse-click' : 'camera-whoosh') as AudioAsset,
          volume: 1.0,
        });
      }

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

      // Frame 150 has massive raw sum: background music + 30 SFX at 1.0
      const activeCues = timeline.cues.filter((c) => 150 >= c.startFrame && 150 < c.endFrame);
      let rawSum = 0;
      for (const cue of activeCues) {
        if (cue.isMusic) {
          const mGain = calculateFadeGain(150 - cue.startFrame, {
            durationInFrames: cue.durationInFrames,
            fadeInFrames: cue.fadeInFrames,
            fadeOutFrames: cue.fadeOutFrames,
            targetVolume: cue.volume,
          });
          const mDuck = calculateDuckingFactor(150, sfxDuckingMeta);
          rawSum += mGain * mDuck;
        } else {
          rawSum += cue.volume;
        }
      }

      assert.ok(rawSum > 25.0, `Expected massive raw sum (> 25.0), observed: ${rawSum}`);
      const { limitedGain, limitFactor } = softLimitGain(rawSum, 0.70, 0.95);

      assert.ok(limitedGain <= 0.950000, `High polyphony limitedGain=${limitedGain} must be <= 0.95`);
      assert.ok(limitedGain >= 0.940000, `High polyphony limitedGain=${limitedGain} should approach headroom ceiling`);
      assert.ok(limitFactor < 0.05, `Limit factor should compress gain drastically, observed: ${limitFactor}`);
    });
  });

  // =========================================================================
  // 6. REMOTION STILL RENDER PNG & BYTE STREAM VERIFICATION
  // =========================================================================
  describe('5. Remotion Still Render PNG & Binary Byte Stream Empirical Verification', () => {
    const renderTargets = [
      {
        theme: 'enterpriseDark',
        frame: 120, // Hook -> Core Surface 3D zoom inspection (2.1x)
        outputFile: 'adversarial-p4-enterprise-f120.png',
      },
      {
        theme: 'minimalLight',
        frame: 240, // Core Surface -> Architecture Code Tree transition
        outputFile: 'adversarial-p4-light-f240.png',
      },
      {
        theme: 'boldPlayful',
        frame: 365, // Hero Action button click beat
        outputFile: 'adversarial-p4-playful-f365.png',
      },
      {
        theme: 'boundaryStress',
        frame: 440, // Brand closing CTA finale beat
        outputFile: 'adversarial-p4-stress-f440.png',
      },
    ];

    for (const target of renderTargets) {
      test(`5.1 Renders ${target.theme} at frame ${target.frame} to valid PNG byte stream`, () => {
        const graph = synthesizedGraphs[target.theme];
        const propsPath = path.resolve(outDir, `props-${target.theme}.json`);
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

        // Log verified empirical metrics for handoff report
        // console.log(`[PASS] ${target.outputFile}: ${fileStat.size} bytes, ${durationMs}ms, 1920x1080`);
      });
    }
  });
});
