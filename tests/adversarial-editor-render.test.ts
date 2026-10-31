/**
 * tests/adversarial-editor-render.test.ts
 *
 * Empirical Adversarial Verification Suite:
 * Adversarially verify Remotion composition rendering with dynamically modified SceneGraphs
 * produced by the editor state manager.
 *
 * Scope:
 * 1. Mutate defaultSceneGraph and multi-scene presets using editorReducer actions:
 *    a) Modify all copy strings (window title, prompt text, hero button, tagline).
 *    b) Switch theme to surfaceTheme: 'light', backdropVariant: 'light-editorial', primaryAccent: '#00F0FF'.
 *    c) Shift camera focal keyframes to boundary coordinates (0.05, 0.95) with zoom 3.5.
 * 2. 480-Frame Zero-NaN Invariant Check on CameraRig CSS transforms & SmartCursor kinematics.
 * 3. 480-Frame AudioEngine schedule & soft-knee headroom limiter verification (zero digital clipping).
 * 4. Remotion Still Rendering Execution with modified props.
 * 5. Package tree & @remotion/player 4.0.539 exact version integrity.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  editorActions,
  editorReducer,
  createInitialEditorState,
  initialEditorState,
} from '../src/lib/editor/editor-state';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import type { SceneGraph } from '../src/lib/scene-graph/types';
import { evaluateCameraPath } from '../remotion/motion-kit/camera/CameraPath';
import { calculateCameraTransform } from '../remotion/motion-kit/camera/CameraTransform';
import { interpolateCursorTrack } from '../remotion/motion-kit/cursor/BezierPath';
import { buildAudioTimeline } from '../remotion/motion-kit/audio/AudioTimeline';
import { calculateFadeGain } from '../remotion/motion-kit/audio/FadeController';
import { calculateDuckingFactor, softLimitGain } from '../remotion/motion-kit/audio/AudioMixer';
import { interpolate, Easing } from 'remotion';

describe('Adversarial Verification: Editor State Dynamic Modifications & Remotion Render Integrity', () => {
  // Ensure output directory exists
  const outDir = path.resolve(process.cwd(), 'out');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // =========================================================================
  // 1. DYNAMIC MUTATION PIPELINE VIA EDITOR REDUCER
  // =========================================================================
  describe('1. Adversarial SceneGraph Mutations via editorReducer', () => {
    test('1.1 Mutates single-scene defaultSceneGraph with copy strings, light editorial theme, and extreme camera focal', () => {
      let state = initialEditorState;

      // a) Modify copy strings
      state = editorReducer(
        state,
        editorActions.updateText('windowTitle', 'Adversarial Enterprise Studio — Production Dashboard')
      );
      state = editorReducer(
        state,
        editorActions.updateText('textToType', 'Build an autonomous spatial telemetry agent with 3D camera tracking')
      );
      state = editorReducer(
        state,
        editorActions.updateText('buttonText', 'Launch Production')
      );
      state = editorReducer(
        state,
        editorActions.updateText('tagline', 'Ultra-fast determinism for motion engines')
      );

      // b) Switch theme
      state = editorReducer(
        state,
        editorActions.updateArtDirection({
          surfaceTheme: 'light',
          backdropVariant: 'light-editorial',
          primaryAccent: '#00F0FF',
        })
      );

      // c) Shift camera focal keyframes to boundary coordinates (0.05, 0.95) with zoom 3.5
      assert.ok(state.sceneGraph.cameraTrack.length > 0, 'Camera track must contain keyframes');
      for (let i = 0; i < state.sceneGraph.cameraTrack.length; i++) {
        state = editorReducer(
          state,
          editorActions.updateCameraFocal({
            keyframeIndex: i,
            x: 0.05,
            y: 0.95,
            zoom: 3.5,
          })
        );
      }

      // Assertions on mutated SceneGraph
      assert.equal(state.validationNotice, null);
      assert.equal(state.sceneGraph.artDirection.surfaceTheme, 'light');
      assert.equal(state.sceneGraph.artDirection.backdropVariant, 'light-editorial');
      assert.equal(state.sceneGraph.artDirection.primaryAccent, '#00F0FF');

      for (const kf of state.sceneGraph.cameraTrack) {
        assert.equal(kf.x, 0.05);
        assert.equal(kf.y, 0.95);
        assert.equal(kf.zoom, 3.5);
      }

      // Validate against strict Zod SceneGraphSchema
      const parsed = SceneGraphSchema.safeParse(state.sceneGraph);
      assert.equal(parsed.success, true, 'Mutated single-scene graph must strictly satisfy SceneGraphSchema');
    });

    test('1.2 Mutates multi-scene preset: modifies all copy fields across scenes, theme and extreme focal points', () => {
      let state = createInitialEditorState('multi-scene');

      // a) Modify copy strings for each specific scene node
      state = editorReducer(
        state,
        editorActions.updateText('textToType', 'Adversarial Prompt: Real-time 3D camera rig generation', 'scene-1-prompt')
      );
      state = editorReducer(
        state,
        editorActions.updateText('title', 'Adversarial Architecture • Core Shaders', 'scene-2-architecture')
      );
      state = editorReducer(
        state,
        editorActions.updateText('buttonText', 'Deploy Cluster', 'scene-3-hero-action')
      );
      state = editorReducer(
        state,
        editorActions.updateText('productName', 'Launtion Core', 'scene-4-closing')
      );
      state = editorReducer(
        state,
        editorActions.updateText('tagline', 'Deterministic Motion at Any Scale', 'scene-4-closing')
      );

      // b) Switch theme
      state = editorReducer(
        state,
        editorActions.updateArtDirection({
          surfaceTheme: 'light',
          backdropVariant: 'light-editorial',
          primaryAccent: '#00F0FF',
        })
      );

      // c) Shift camera keyframes to boundary coordinates (0.05, 0.95) with zoom 3.5
      for (let i = 0; i < state.sceneGraph.cameraTrack.length; i++) {
        state = editorReducer(
          state,
          editorActions.updateCameraFocal({
            keyframeIndex: i,
            x: 0.05,
            y: 0.95,
            zoom: 3.5,
          })
        );
      }

      assert.equal(state.validationNotice, null);
      assert.equal(state.sceneGraph.artDirection.surfaceTheme, 'light');
      assert.equal(state.sceneGraph.artDirection.backdropVariant, 'light-editorial');
      assert.equal(state.sceneGraph.artDirection.primaryAccent, '#00F0FF');

      // Check scene payloads
      const promptScene = state.sceneGraph.scenes.find((s) => s.type === 'synthetic_prompt_box');
      assert.ok(promptScene);
      assert.equal((promptScene.payload as { textToType: string }).textToType, 'Adversarial Prompt: Real-time 3D camera rig generation');

      const heroScene = state.sceneGraph.scenes.find((s) => s.type === 'synthetic_hero_button');
      assert.ok(heroScene);
      assert.equal((heroScene.payload as { buttonText: string }).buttonText, 'Deploy Cluster');

      const closingScene = state.sceneGraph.scenes.find((s) => s.type === 'brand_closing_cta');
      assert.ok(closingScene);
      assert.equal((closingScene.payload as { tagline: string }).tagline, 'Deterministic Motion at Any Scale');

      const parsed = SceneGraphSchema.safeParse(state.sceneGraph);
      assert.equal(parsed.success, true, 'Mutated multi-scene graph must strictly satisfy SceneGraphSchema');
    });
  });

  // =========================================================================
  // 2. 480-FRAME ZERO-NAN INVARIANT: CAMERA RIG CSS TRANSFORMS
  // =========================================================================
  describe('2. CameraRig CSS Transform Matrix: 480-Frame Zero-NaN Invariant Check', () => {
    // Generate the adversarial SceneGraph
    function createAdversarialSceneGraph(): SceneGraph {
      let state = initialEditorState;
      state = editorReducer(
        state,
        editorActions.updateArtDirection({
          surfaceTheme: 'light',
          backdropVariant: 'light-editorial',
          primaryAccent: '#00F0FF',
        })
      );
      for (let i = 0; i < state.sceneGraph.cameraTrack.length; i++) {
        state = editorReducer(
          state,
          editorActions.updateCameraFocal({
            keyframeIndex: i,
            x: 0.05,
            y: 0.95,
            zoom: 3.5,
          })
        );
      }
      return state.sceneGraph;
    }

    test('2.1 Zero NaN in CameraRig CSS transform across all 480 frames at boundary (0.05, 0.95) & zoom 3.5', () => {
      const graph = createAdversarialSceneGraph();
      const totalFrames = graph.canvas.durationInFrames; // 480 frames
      assert.equal(totalFrames, 480);

      for (let frame = 0; frame < totalFrames; frame++) {
        const cameraState = evaluateCameraPath(graph.cameraTrack, frame);

        // State invariants
        assert.ok(!Number.isNaN(cameraState.x), `Frame ${frame}: cameraState.x is NaN`);
        assert.ok(!Number.isNaN(cameraState.y), `Frame ${frame}: cameraState.y is NaN`);
        assert.ok(!Number.isNaN(cameraState.zoom), `Frame ${frame}: cameraState.zoom is NaN`);
        assert.ok(Number.isFinite(cameraState.x), `Frame ${frame}: cameraState.x must be finite`);
        assert.ok(Number.isFinite(cameraState.y), `Frame ${frame}: cameraState.y must be finite`);
        assert.ok(Number.isFinite(cameraState.zoom), `Frame ${frame}: cameraState.zoom must be finite`);

        // Compute 3D transform
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

        // Numerical transform validation
        assert.ok(!Number.isNaN(transformResult.translation.x), `Frame ${frame}: translation.x is NaN`);
        assert.ok(!Number.isNaN(transformResult.translation.y), `Frame ${frame}: translation.y is NaN`);
        assert.ok(!Number.isNaN(transformResult.translation.z), `Frame ${frame}: translation.z is NaN`);
        assert.ok(Number.isFinite(transformResult.translation.x), `Frame ${frame}: translation.x must be finite`);
        assert.ok(Number.isFinite(transformResult.translation.y), `Frame ${frame}: translation.y must be finite`);
        assert.ok(Number.isFinite(transformResult.translation.z), `Frame ${frame}: translation.z must be finite`);

        // CSS string validation
        assert.ok(!transformResult.transform.includes('NaN'), `Frame ${frame}: CSS transform contains 'NaN': ${transformResult.transform}`);
        assert.ok(!transformResult.transform.includes('undefined'), `Frame ${frame}: CSS transform contains 'undefined'`);
        assert.ok(!transformResult.transform.includes('null'), `Frame ${frame}: CSS transform contains 'null'`);
        assert.match(
          transformResult.transform,
          /^translate3d\(-?[0-9.]+px,\s*-?[0-9.]+px,\s*-?[0-9.]+px\)\s*scale\([0-9.]+\)\s*rotateX\(-?[0-9.]+deg\)\s*rotateY\(-?[0-9.]+deg\)\s*rotateZ\(-?[0-9.]+deg\)$/,
          `Frame ${frame}: CSS transform string pattern match failed: ${transformResult.transform}`
        );

        // Focal drift check (zero focal drift law <= 0.5px)
        assert.ok(
          transformResult.focalDrift <= 0.5,
          `Frame ${frame}: focal drift ${transformResult.focalDrift}px exceeds 0.5px maximum threshold`
        );
      }
    });

    test('2.2 Zero NaN in CameraRig under alternating boundary focal keyframes: (0.0, 0.0), (1.0, 1.0), (0.05, 0.95)', () => {
      let state = initialEditorState;
      const boundaryPoints = [
        { x: 0.0, y: 0.0, zoom: 3.5 },
        { x: 1.0, y: 1.0, zoom: 3.5 },
        { x: 0.05, y: 0.95, zoom: 3.5 },
        { x: 0.95, y: 0.05, zoom: 3.5 },
      ];

      for (let i = 0; i < state.sceneGraph.cameraTrack.length; i++) {
        const pt = boundaryPoints[i % boundaryPoints.length];
        state = editorReducer(
          state,
          editorActions.updateCameraFocal({
            keyframeIndex: i,
            x: pt.x,
            y: pt.y,
            zoom: pt.zoom,
          })
        );
      }

      for (let frame = 0; frame < 480; frame++) {
        const cameraState = evaluateCameraPath(state.sceneGraph.cameraTrack, frame);
        const transformResult = calculateCameraTransform({
          viewport: { width: 1920, height: 1080 },
          focalPoint: { x: cameraState.x, y: cameraState.y },
          zoom: cameraState.zoom,
          rotation: {
            rotateX: cameraState.rotateX ?? 0,
            rotateY: cameraState.rotateY ?? 0,
            rotateZ: cameraState.rotateZ ?? 0,
          },
          perspective: 1200,
        });

        assert.ok(!transformResult.transform.includes('NaN'), `Frame ${frame}: transform contains NaN under alternating boundaries`);
        assert.ok(transformResult.focalDrift <= 0.5, `Frame ${frame}: focal drift ${transformResult.focalDrift}px > 0.5px`);
      }
    });
  });

  // =========================================================================
  // 3. 480-FRAME ZERO-NAN INVARIANT: SMARTCURSOR KINEMATICS & CLICK PHYSICS
  // =========================================================================
  describe('3. SmartCursor Vector Kinematics & Click Physics: 480-Frame Zero-NaN Invariant Check', () => {
    test('3.1 Zero NaN in SmartCursor position, click compression scale, and ripple across all 480 frames', () => {
      const graph = initialEditorState.sceneGraph;
      const totalFrames = graph.canvas.durationInFrames;

      for (let frame = 0; frame < totalFrames; frame++) {
        const cursorState = interpolateCursorTrack(graph.cursorTrack, frame);

        // Position coordinates
        assert.ok(!Number.isNaN(cursorState.x), `Frame ${frame}: cursor x is NaN`);
        assert.ok(!Number.isNaN(cursorState.y), `Frame ${frame}: cursor y is NaN`);
        assert.ok(Number.isFinite(cursorState.x), `Frame ${frame}: cursor x must be finite`);
        assert.ok(Number.isFinite(cursorState.y), `Frame ${frame}: cursor y must be finite`);
        assert.ok(cursorState.x >= 0.0 && cursorState.x <= 1.0, `Frame ${frame}: cursor x=${cursorState.x} out of [0, 1]`);
        assert.ok(cursorState.y >= 0.0 && cursorState.y <= 1.0, `Frame ${frame}: cursor y=${cursorState.y} out of [0, 1]`);

        // Click physics calculations matching SmartCursor.tsx
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

        assert.ok(!Number.isNaN(clickScale), `Frame ${frame}: clickScale is NaN`);
        assert.ok(!Number.isNaN(rippleRadius), `Frame ${frame}: rippleRadius is NaN`);
        assert.ok(!Number.isNaN(rippleOpacity), `Frame ${frame}: rippleOpacity is NaN`);
        assert.ok(clickScale >= 0.90 && clickScale <= 1.0, `Frame ${frame}: clickScale=${clickScale} out of bounds`);

        // Check CSS strings
        const posX = `${cursorState.x * 100}%`;
        const posY = `${cursorState.y * 100}%`;
        const transform = `scale(${clickScale})`;

        assert.ok(!posX.includes('NaN'), `Frame ${frame}: posX contains NaN`);
        assert.ok(!posY.includes('NaN'), `Frame ${frame}: posY contains NaN`);
        assert.ok(!transform.includes('NaN'), `Frame ${frame}: transform contains NaN`);
      }
    });
  });

  // =========================================================================
  // 4. 480-FRAME AUDIO ENGINE SCHEDULING & SOFT-KNEE LIMITER
  // =========================================================================
  describe('4. AudioEngine Deterministic Scheduling & Limiter: 480-Frame Verification', () => {
    test('4.1 Accurately schedules cues without digital clipping (master gain <= 0.95 ceiling) across all 480 frames', () => {
      const graph = initialEditorState.sceneGraph;
      const timeline = buildAudioTimeline({
        audioTrack: graph.audioTrack,
        durationInFrames: graph.canvas.durationInFrames,
        fps: graph.canvas.fps,
      });

      assert.ok(timeline.cues.length > 0, 'Audio timeline must contain scheduled cues');
      assert.ok(timeline.musicCues.length > 0, 'Audio timeline must contain background music');
      assert.ok(timeline.sfxCues.length > 0, 'Audio timeline must contain SFX cues');

      const sfxDuckingMeta = timeline.sfxCues.map((c) => ({
        startFrame: c.startFrame,
        durationInFrames: c.durationInFrames,
        priority: c.duckingPriority,
      }));

      // Evaluate master volume for each frame
      for (let frame = 0; frame < 480; frame++) {
        const activeCues = timeline.cues.filter(
          (c) => frame >= c.startFrame && frame < c.endFrame
        );

        // Sum raw gain across all active cues
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

        // Apply soft-knee limiter
        const { limitFactor, limitedGain } = softLimitGain(rawSum, 0.70, 0.95);

        assert.ok(!Number.isNaN(limitFactor), `Frame ${frame}: limitFactor is NaN`);
        assert.ok(!Number.isNaN(limitedGain), `Frame ${frame}: limitedGain is NaN`);
        assert.ok(limitedGain >= 0, `Frame ${frame}: limitedGain must be non-negative`);
        assert.ok(
          limitedGain <= 0.950001,
          `Frame ${frame}: limitedGain ${limitedGain} exceeds headroom ceiling 0.95 (clipping!)`
        );
      }
    });

    test('4.2 Audio scheduling with extreme polyphony (simulated 20 overlapping SFX cues at max volume)', () => {
      // Create artificial cues with massive overlap
      const highDensityTrack = [...initialEditorState.sceneGraph.audioTrack];
      for (let i = 0; i < 20; i++) {
        highDensityTrack.push({
          id: `stress-cue-${i}`,
          frame: 100, // all trigger at frame 100
          asset: 'mouse-click',
          volume: 1.0,
        });
      }

      const timeline = buildAudioTimeline({
        audioTrack: highDensityTrack,
        durationInFrames: 480,
        fps: 30,
      });

      const sfxDuckingMeta = timeline.sfxCues.map((c) => ({
        startFrame: c.startFrame,
        durationInFrames: c.durationInFrames,
        priority: c.duckingPriority,
      }));

      // Test frame 100 where 20+ sounds fire simultaneously
      const activeCues = timeline.cues.filter(
        (c) => 100 >= c.startFrame && 100 < c.endFrame
      );

      let rawSum = 0;
      for (const cue of activeCues) {
        if (cue.isMusic) {
          const mGain = calculateFadeGain(100 - cue.startFrame, {
            durationInFrames: cue.durationInFrames,
            fadeInFrames: cue.fadeInFrames,
            fadeOutFrames: cue.fadeOutFrames,
            targetVolume: cue.volume,
          });
          const mDuck = calculateDuckingFactor(100, sfxDuckingMeta);
          rawSum += mGain * mDuck;
        } else {
          rawSum += cue.volume;
        }
      }

      assert.ok(rawSum > 10.0, `Raw sum should be very high due to 20 cues, got ${rawSum}`);
      const { limitedGain } = softLimitGain(rawSum, 0.70, 0.95);
      assert.ok(
        limitedGain <= 0.950001,
        `Post limit gain ${limitedGain} must not breach 0.95 under extreme overload`
      );
      assert.ok(!Number.isNaN(limitedGain));
    });
  });

  // =========================================================================
  // 5. REMOTION STILL RENDER EXECUTION
  // =========================================================================
  describe('5. Remotion Still Render Execution', () => {
    test('5.1 Executes Remotion still render with modified SceneGraph props to out/test-editor-modified.png', () => {
      let state = initialEditorState;
      state = editorReducer(
        state,
        editorActions.updateText('windowTitle', 'Adversarial Still Render Window')
      );
      state = editorReducer(
        state,
        editorActions.updateArtDirection({
          surfaceTheme: 'light',
          backdropVariant: 'light-editorial',
          primaryAccent: '#00F0FF',
        })
      );
      for (let i = 0; i < state.sceneGraph.cameraTrack.length; i++) {
        state = editorReducer(
          state,
          editorActions.updateCameraFocal({
            keyframeIndex: i,
            x: 0.05,
            y: 0.95,
            zoom: 3.5,
          })
        );
      }

      const propsPath = path.resolve(outDir, 'adversarial-props.json');
      fs.writeFileSync(propsPath, JSON.stringify({ sceneGraph: state.sceneGraph }, null, 2));

      const outputPath = path.resolve(outDir, 'test-editor-modified.png');
      const cmd = `npx remotion still remotion/index.ts InteractiveSurfaceDemo ${outputPath} --props=${propsPath} --overwrite`;

      const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
      assert.ok(
        output.includes('Rendered') || output.includes(outputPath),
        `Remotion still command output should confirm render success: ${output}`
      );
      assert.ok(fs.existsSync(outputPath), `Still image output must exist at ${outputPath}`);

      const stats = fs.statSync(outputPath);
      assert.ok(stats.size > 10000, `Rendered still image size (${stats.size} bytes) should be > 10KB`);

      // Verify PNG header magic bytes (\x89PNG\r\n\x1a\n)
      const buffer = fs.readFileSync(outputPath);
      const isPng =
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a;
      assert.equal(isPng, true, 'Output file must be a valid PNG image');
    });

    test('5.2 Executes Remotion still render for multi-scene preset at frame 240', () => {
      let state = createInitialEditorState('multi-scene');
      state = editorReducer(
        state,
        editorActions.updateArtDirection({
          surfaceTheme: 'light',
          backdropVariant: 'light-editorial',
          primaryAccent: '#00F0FF',
        })
      );

      const propsPath = path.resolve(outDir, 'adversarial-multiscene-props.json');
      fs.writeFileSync(propsPath, JSON.stringify({ sceneGraph: state.sceneGraph }, null, 2));

      const outputPath = path.resolve(outDir, 'test-multiscene-frame-240.png');
      const cmd = `npx remotion still remotion/index.ts InteractiveSurfaceDemo ${outputPath} --frame=240 --props=${propsPath} --overwrite`;

      const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
      assert.ok(
        output.includes('Rendered') || output.includes(outputPath),
        `Remotion still must succeed for multi-scene at frame 240: ${output}`
      );
      assert.ok(fs.existsSync(outputPath), `Multi-scene still must exist at ${outputPath}`);

      const stats = fs.statSync(outputPath);
      assert.ok(stats.size > 10000, 'Multi-scene image size must be > 10KB');
    });
  });

  // =========================================================================
  // 6. PACKAGE TREE & @REMOTION/PLAYER EXACT VERSION INTEGRITY
  // =========================================================================
  describe('6. Package Tree & @remotion/player Version Integrity', () => {
    test('6.1 package.json dependencies strictly match Remotion 4.0.539', () => {
      const packageJsonPath = path.resolve(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

      assert.equal(
        pkg.dependencies['@remotion/player'],
        '4.0.539',
        `@remotion/player must be exact version 4.0.539, found: ${pkg.dependencies['@remotion/player']}`
      );
      assert.equal(
        pkg.dependencies['remotion'],
        '4.0.539',
        `remotion must be exact version 4.0.539, found: ${pkg.dependencies['remotion']}`
      );
      assert.equal(
        pkg.dependencies['@remotion/cli'],
        '4.0.539',
        `@remotion/cli must be exact version 4.0.539, found: ${pkg.dependencies['@remotion/cli']}`
      );
    });

    test('6.2 pnpm dependency tree reports zero missing peer dependencies', () => {
      const pnpmOutput = execSync('pnpm ls --depth 0', { encoding: 'utf-8' });
      assert.ok(pnpmOutput.includes('@remotion/player@4.0.539'), 'pnpm ls must contain @remotion/player@4.0.539');
      assert.ok(pnpmOutput.includes('remotion@4.0.539'), 'pnpm ls must contain remotion@4.0.539');
      assert.ok(pnpmOutput.includes('@remotion/cli@4.0.539'), 'pnpm ls must contain @remotion/cli@4.0.539');
      assert.ok(!pnpmOutput.toLowerCase().includes('unmet peer'), 'pnpm ls must not have unmet peer dependencies');
    });
  });
});
