/**
 * tests/adversarial-editor-state.test.ts
 *
 * Empirical Adversarial Challenger Suite for Phase 3 Reactive State Management:
 * 1. Adversarial Fuzzing (Extreme coordinates, NaNs, infinities, 5000+ char strings, malformed hex, invalid zoom)
 * 2. Stochastic Monte Carlo Invariant Oracle (1,000 random actions verifying SceneGraphSchema.safeParse().success === true)
 * 3. History Stack Stress & Boundary Invariant (100 rapid mutations, stack max 50 bound, bidirectional undo/redo consistency)
 * 4. High-Throughput Performance Benchmark (1,000 state transitions + full Zod validations < 500ms total)
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  editorActions,
  editorReducer,
  createInitialEditorState,
  type EditorAction,
  type EditorState,
} from '../src/lib/editor/editor-state';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import type { BackdropVariant, SurfaceTheme } from '../src/lib/scene-graph/types';

describe('Adversarial Stress Suite: Phase 3 Reactive State Management & Invariants', () => {

  // =========================================================================
  // 1. ADVERSARIAL FUZZING UNDER MALFORMED & EXTREME INPUTS
  // =========================================================================
  describe('1. Adversarial Fuzzing: Malformed, Extreme & Corrupted Inputs', () => {
    test('1.1 Camera coordinates: negative, extreme, NaN, and Infinity inputs are safely clamped', () => {
      let state = createInitialEditorState();

      // Negative, out-of-bounds, infinite, and NaN coordinates/zooms
      const extremeCoordinates = [
        { x: -999999.99, y: -0.0001, zoom: -5.0 },
        { x: 1000000.0, y: 55555.55, zoom: 999.9 },
        { x: -Infinity, y: Infinity, zoom: -Infinity },
        { x: NaN, y: NaN, zoom: NaN },
        { x: 0.0000001, y: 0.9999999, zoom: 0.1 }, // sub-minimum zoom (should clamp to 0.8)
        { x: 0.5, y: 0.5, zoom: 10.0 },            // super-maximum zoom (should clamp to 3.5)
      ];

      for (const coords of extremeCoordinates) {
        state = editorReducer(
          state,
          editorActions.updateCameraFocal({
            keyframeIndex: 0,
            x: coords.x,
            y: coords.y,
            zoom: coords.zoom,
            rotateX: coords.x,
            rotateY: coords.y,
            rotateZ: coords.zoom,
          })
        );

        const kf = state.sceneGraph.cameraTrack[0];
        assert.ok(Number.isFinite(kf.x), `x must be finite, got ${kf.x}`);
        assert.ok(Number.isFinite(kf.y), `y must be finite, got ${kf.y}`);
        assert.ok(Number.isFinite(kf.zoom), `zoom must be finite, got ${kf.zoom}`);
        assert.ok(kf.x >= 0.0 && kf.x <= 1.0, `x=${kf.x} must be in [0, 1]`);
        assert.ok(kf.y >= 0.0 && kf.y <= 1.0, `y=${kf.y} must be in [0, 1]`);
        assert.ok(kf.zoom >= 0.8 && kf.zoom <= 3.5, `zoom=${kf.zoom} must be in [0.8, 3.5]`);
        assert.ok(kf.rotateX! >= -90 && kf.rotateX! <= 90, `rotateX=${kf.rotateX} in [-90, 90]`);
        assert.ok(kf.rotateY! >= -90 && kf.rotateY! <= 90, `rotateY=${kf.rotateY} in [-90, 90]`);
        assert.ok(kf.rotateZ! >= -180 && kf.rotateZ! <= 180, `rotateZ=${kf.rotateZ} in [-180, 180]`);

        // Schema invariant
        const parsed = SceneGraphSchema.safeParse(state.sceneGraph);
        assert.equal(parsed.success, true, 'SceneGraphSchema must validate after extreme coordinates');
      }
    });

    test('1.2 String fuzzing: empty strings, zero-width, emojis, and strings exceeding 5,000 characters', () => {
      let state = createInitialEditorState();

      const giant5kString = 'A'.repeat(5500);
      const giantEmojiString = '🚀🔥⚡'.repeat(2000);
      const controlChars = '\u0000\u001F\t\n\r\b\f';
      const zeroWidth = '\u200B\u200C\u200D\uFEFF';

      const adversarialStrings = [
        '',
        '   ',
        zeroWidth,
        controlChars,
        giant5kString,
        giantEmojiString,
      ];

      const textFields = [
        'windowTitle',
        'textToType',
        'buttonText',
        'title',
        'productName',
        'tagline',
        'headline',
        'sourceText',
        'targetText',
      ];

      for (const field of textFields) {
        for (const str of adversarialStrings) {
          state = editorReducer(
            state,
            editorActions.updateText(field, str)
          );

          // Assert SceneGraphSchema invariant is strictly preserved
          const parsed = SceneGraphSchema.safeParse(state.sceneGraph);
          assert.equal(
            parsed.success,
            true,
            `SceneGraphSchema must remain valid after updating field '${field}' with string length ${str.length}`
          );
        }
      }
    });

    test('1.3 Color fuzzing: invalid hex codes (#ZZZZZZ, rgb(0,0,0), blue, unclosed, too short)', () => {
      let state = createInitialEditorState();

      const malformedColors = [
        '#ZZZZZZ',
        'rgb(0,0,0)',
        'rgba(255, 0, 0, 0.5)',
        'blue',
        '#12',
        '#1234',
        '#12345',
        '#1234567',
        '#12345678',
        '123456',
        '',
        '#',
        '#GGGGGG',
        'hsl(200, 50%, 50%)',
        'transparent',
      ];

      for (const malformed of malformedColors) {
        state = editorReducer(
          state,
          editorActions.updateArtDirection({ primaryAccent: malformed })
        );

        // State must remain valid, primaryAccent must not accept malformed hex
        const currentAccent = state.sceneGraph.artDirection.primaryAccent;
        assert.match(
          currentAccent,
          /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
          `primaryAccent '${currentAccent}' must remain a valid hex code`
        );
        assert.ok(
          state.validationNotice !== null,
          `validationNotice should be set when rejecting malformed color '${malformed}'`
        );

        const parsed = SceneGraphSchema.safeParse(state.sceneGraph);
        assert.equal(parsed.success, true, `SceneGraphSchema must remain valid after malformed color '${malformed}'`);
      }

      // Valid hex test to confirm recovery
      state = editorReducer(
        state,
        editorActions.updateArtDirection({ primaryAccent: '#00FF88' })
      );
      assert.equal(state.sceneGraph.artDirection.primaryAccent, '#00FF88');
      assert.equal(state.validationNotice, null);
    });

    test('1.4 Out-of-bounds keyframe indices and frame navigation fuzzing', () => {
      let state = createInitialEditorState();
      const duration = state.sceneGraph.canvas.durationInFrames;

      // Extreme numerical frame values are strictly clamped to canvas duration
      const extremeFiniteFrames = [-9999, -50, -1, 0, 1, 150, duration - 1, duration, duration + 1000, 99999, Infinity, -Infinity];

      for (const f of extremeFiniteFrames) {
        state = editorReducer(state, editorActions.setCurrentFrame(f));
        assert.ok(Number.isFinite(state.currentFrame), `currentFrame must be finite, got ${state.currentFrame}`);
        assert.ok(state.currentFrame >= 0, `currentFrame must be >= 0, got ${state.currentFrame}`);
        assert.ok(state.currentFrame < duration, `currentFrame must be < duration (${duration}), got ${state.currentFrame}`);
      }

      // Extreme numerical keyframe indices are strictly clamped to track length
      const extremeFiniteIndices = [-999, -50, -1, 0, 1, 5, 27, 28, 9999, Infinity, -Infinity];
      for (const idx of extremeFiniteIndices) {
        state = editorReducer(state, editorActions.setActiveKeyframe(idx));
        assert.ok(Number.isFinite(state.activeKeyframeIndex), `activeKeyframeIndex must be finite, got ${state.activeKeyframeIndex}`);
        assert.ok(
          state.activeKeyframeIndex >= 0 &&
          state.activeKeyframeIndex < state.sceneGraph.cameraTrack.length,
          `activeKeyframeIndex=${state.activeKeyframeIndex} must be within track length bounds`
        );
      }

      // Empirical edge-case discovery: NaN input preservation
      // When NaN is dispatched to SET_CURRENT_FRAME or SET_ACTIVE_KEYFRAME,
      // assert that state.sceneGraph remains 100% schema-valid without corruption.
      const nanFrameState = editorReducer(state, editorActions.setCurrentFrame(NaN));
      assert.equal(SceneGraphSchema.safeParse(nanFrameState.sceneGraph).success, true);

      const nanKeyframeState = editorReducer(state, editorActions.setActiveKeyframe(NaN));
      assert.equal(SceneGraphSchema.safeParse(nanKeyframeState.sceneGraph).success, true);
    });
  });

  // =========================================================================
  // 2. STOCHASTIC MONTE CARLO INVARIANT ORACLE (1,000 RANDOM ACTIONS)
  // =========================================================================
  describe('2. Stochastic Monte Carlo Invariant Oracle (1,000 Iterations)', () => {
    test('asserts state.sceneGraph is ALWAYS 100% compliant with SceneGraphSchema across 1,000 continuous random mutations', () => {
      // Deterministic PRNG seed for strict reproducibility
      let seed = 42875;
      function pseudoRandom(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      function randomChoice<T>(arr: T[]): T {
        return arr[Math.floor(pseudoRandom() * arr.length)];
      }

      const backdropOptions: BackdropVariant[] = ['dark-precision', 'light-editorial', 'aurora-blur', 'solid'];
      const themeOptions: SurfaceTheme[] = ['light', 'dark'];
      const hexSamples = ['#FF5500', '#00AAFF', '#10B981', '#FFF', '#121212', '#INVALID', 'red', '#ZZZZZZ'];
      const textSamples = [
        'Standard text',
        '',
        ' ',
        'Super long text '.repeat(100),
        'Special characters !@#$%^&*()_+~`|}{[]:;?><,./-',
        'Unicode: 日本語 • العربية • 🚀🔥⚡',
      ];
      const textFields = [
        'windowTitle',
        'textToType',
        'buttonText',
        'title',
        'productName',
        'tagline',
        'headline',
        'files',
        'words',
        'nonExistentField',
      ];

      let state: EditorState = createInitialEditorState('multi-scene');
      let validParseCount = 0;
      const totalIterations = 1000;

      for (let i = 0; i < totalIterations; i++) {
        const actionChoice = Math.floor(pseudoRandom() * 10);
        let action: EditorAction;

        switch (actionChoice) {
          case 0: // UPDATE_TEXT
            action = editorActions.updateText(
              randomChoice(textFields),
              pseudoRandom() > 0.8
                ? [randomChoice(textSamples), randomChoice(textSamples)]
                : randomChoice(textSamples),
              pseudoRandom() > 0.5 ? 'scene-product-3d' : 'non-existent-scene-id'
            );
            break;

          case 1: // UPDATE_ART_DIRECTION
            action = editorActions.updateArtDirection({
              backdropVariant: randomChoice(backdropOptions),
              surfaceTheme: randomChoice(themeOptions),
              primaryAccent: randomChoice(hexSamples),
            });
            break;

          case 2: // UPDATE_CAMERA_FOCAL
            action = editorActions.updateCameraFocal({
              keyframeIndex: Math.floor((pseudoRandom() - 0.2) * 10),
              x: (pseudoRandom() - 0.5) * 4.0, // [-2.0, 2.0]
              y: (pseudoRandom() - 0.5) * 4.0,
              zoom: (pseudoRandom() - 0.2) * 12.0, // [-2.4, 9.6]
              rotateX: (pseudoRandom() - 0.5) * 360,
              rotateY: (pseudoRandom() - 0.5) * 360,
              rotateZ: (pseudoRandom() - 0.5) * 720,
              easing: randomChoice(['linear', 'ease-in-out', 'spring'] as const),
            });
            break;

          case 3: // SET_ACTIVE_KEYFRAME
            action = editorActions.setActiveKeyframe(Math.floor((pseudoRandom() - 0.2) * 20));
            break;

          case 4: // SET_CURRENT_FRAME
            action = editorActions.setCurrentFrame(Math.floor((pseudoRandom() - 0.2) * 500));
            break;

          case 5: // SET_PLAYING
            action = editorActions.setPlaying(pseudoRandom() > 0.5);
            break;

          case 6: // SELECT_SCENE
            action = editorActions.selectScene(pseudoRandom() > 0.3 ? 'scene-product-3d' : null);
            break;

          case 7: // RESET_SCENE_GRAPH
            action = editorActions.resetSceneGraph(pseudoRandom() > 0.5 ? 'default' : 'multi-scene');
            break;

          case 8: // UNDO
            action = editorActions.undo();
            break;

          case 9: // REDO
            action = editorActions.redo();
            break;

          default:
            action = editorActions.undo();
        }

        // Apply action to reducer
        state = editorReducer(state, action);

        // Continuous Invariant Check: sceneGraph MUST satisfy SceneGraphSchema
        const check = SceneGraphSchema.safeParse(state.sceneGraph);
        if (!check.success) {
          throw new Error(
            `Invariant violation at iteration ${i} on action ${action.type}: ${JSON.stringify(check.error.issues)}`
          );
        }
        validParseCount++;
      }

      assert.equal(
        validParseCount,
        totalIterations,
        `Expected all ${totalIterations} random iterations to satisfy SceneGraphSchema with 100% compliance`
      );
    });
  });

  // =========================================================================
  // 3. HISTORY STACK INTEGRITY & BOUNDARY INVARIANTS (UNDO / REDO)
  // =========================================================================
  describe('3. History Stack Integrity, Bounding (Max 50) & Bidirectional Consistency', () => {
    test('3.1 Past history stack is strictly bounded at max 50 entries across 100 rapid mutations', () => {
      let state = createInitialEditorState();

      // Execute 100 distinct mutations
      for (let i = 1; i <= 100; i++) {
        state = editorReducer(
          state,
          editorActions.updateCameraFocal({
            keyframeIndex: 0,
            x: Number((0.01 * (i % 99)).toFixed(4)),
            y: Number((0.01 * (i % 99)).toFixed(4)),
            zoom: 1.0 + (i % 20) * 0.1,
          })
        );

        // Verify past stack never exceeds 50
        assert.ok(
          state.history.past.length <= 50,
          `Iteration ${i}: state.history.past.length (${state.history.past.length}) exceeded max capacity of 50`
        );
      }

      assert.equal(state.history.past.length, 50, 'After 100 mutations, past history must be exactly capped at 50');
      assert.equal(state.history.future.length, 0, 'Future history must remain 0 while mutating forward');
    });

    test('3.2 Bidirectional Undo/Redo consistency and future stack bounds across 100 steps', () => {
      let state = createInitialEditorState();

      // Record 60 distinct mutations
      const recordedSnapshots: string[] = [];
      recordedSnapshots.push(JSON.stringify(state.sceneGraph));

      for (let i = 1; i <= 60; i++) {
        state = editorReducer(
          state,
          editorActions.updateArtDirection({
            primaryAccent: `#${i.toString(16).padStart(2, '0')}88AA`,
          })
        );
        recordedSnapshots.push(JSON.stringify(state.sceneGraph));
      }

      // Past is capped at 50
      assert.equal(state.history.past.length, 50);

      // Perform 50 sequential UNDOs
      for (let u = 0; u < 50; u++) {
        const preUndoPastLen: number = state.history.past.length;
        const preUndoFutureLen: number = state.history.future.length;

        state = editorReducer(state, editorActions.undo());

        assert.equal(state.history.past.length, preUndoPastLen - 1);
        assert.equal(state.history.future.length, preUndoFutureLen + 1);
        assert.ok(state.history.future.length <= 50, 'Future stack should never exceed 50');
        assert.equal(SceneGraphSchema.safeParse(state.sceneGraph).success, true);
      }

      assert.equal(state.history.past.length, 0, 'All past history undone');
      assert.equal(state.history.future.length, 50, 'Future history contains exactly 50 snapshots');

      // Further UNDO on empty past is a safe no-op
      const noopUndo = editorReducer(state, editorActions.undo());
      assert.equal(noopUndo.history.past.length, 0);
      assert.equal(noopUndo.history.future.length, 50);

      // Perform 50 sequential REDOs
      for (let r = 0; r < 50; r++) {
        const preRedoPastLen: number = state.history.past.length;
        const preRedoFutureLen: number = state.history.future.length;

        state = editorReducer(state, editorActions.redo());

        assert.equal(state.history.past.length, preRedoPastLen + 1);
        assert.equal(state.history.future.length, preRedoFutureLen - 1);
        assert.ok(state.history.past.length <= 50, 'Past stack should never exceed 50 during redo');
        assert.equal(SceneGraphSchema.safeParse(state.sceneGraph).success, true);
      }

      assert.equal(state.history.future.length, 0, 'All future history redone');
      assert.equal(state.history.past.length, 50, 'Past history restored to 50');

      // The final restored graph must exactly match the 60th mutation snapshot
      const finalJson = JSON.stringify(state.sceneGraph);
      assert.equal(finalJson, recordedSnapshots[60], 'State after 50 Redos must match 60th mutation snapshot');
    });

    test('3.3 New mutation after UNDO invalidates future history stack (fork branch integrity)', () => {
      let state = createInitialEditorState();

      // Mutation 1
      state = editorReducer(state, editorActions.updateArtDirection({ primaryAccent: '#111111' }));
      // Mutation 2
      state = editorReducer(state, editorActions.updateArtDirection({ primaryAccent: '#222222' }));
      // Mutation 3
      state = editorReducer(state, editorActions.updateArtDirection({ primaryAccent: '#333333' }));

      // Undo once -> at '#222222'
      state = editorReducer(state, editorActions.undo());
      assert.equal(state.sceneGraph.artDirection.primaryAccent, '#222222');
      assert.equal(state.history.future.length, 1);

      // Branch mutation -> should clear future
      state = editorReducer(state, editorActions.updateArtDirection({ primaryAccent: '#444444' }));
      assert.equal(state.sceneGraph.artDirection.primaryAccent, '#444444');
      assert.equal(state.history.future.length, 0, 'New mutation on branch must clear future history stack');
    });
  });

  // =========================================================================
  // 4. HIGH-THROUGHPUT PERFORMANCE BENCHMARK (< 500ms FOR 1,000 TRANSITIONS)
  // =========================================================================
  describe('4. High-Throughput Performance Benchmark', () => {
    test('1,000 state transitions + pre-commit Zod validations execute in < 500ms total (< 0.5ms/transition)', () => {
      let state = createInitialEditorState();
      const iterations = 1000;

      // Warmup JIT (50 iterations)
      for (let w = 0; w < 50; w++) {
        state = editorReducer(
          state,
          editorActions.updateCameraFocal({
            keyframeIndex: 0,
            x: 0.5 + (w % 10) * 0.01,
          })
        );
      }

      // Benchmark execution
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const typeMod = i % 4;
        switch (typeMod) {
          case 0:
            state = editorReducer(
              state,
              editorActions.updateCameraFocal({
                keyframeIndex: 0,
                x: 0.1 + (i % 80) * 0.01,
                y: 0.2 + (i % 70) * 0.01,
                zoom: 1.0 + (i % 25) * 0.1,
              })
            );
            break;
          case 1:
            state = editorReducer(
              state,
              editorActions.updateText(
                'windowTitle',
                `Benchmark Title Mutation #${i}`
              )
            );
            break;
          case 2:
            state = editorReducer(
              state,
              editorActions.updateArtDirection({
                primaryAccent: i % 2 === 0 ? '#3B82F6' : '#10B981',
                surfaceTheme: i % 3 === 0 ? 'dark' : 'light',
              })
            );
            break;
          case 3:
            state = editorReducer(state, editorActions.undo());
            break;
        }
      }

      const totalTimeMs = performance.now() - startTime;
      const perTransitionMs = totalTimeMs / iterations;

      // Quantitative assertions
      assert.ok(
        totalTimeMs < 500,
        `1,000 state transitions took ${totalTimeMs.toFixed(2)}ms, exceeding the 500ms SLA target!`
      );
      assert.ok(
        perTransitionMs < 0.5,
        `Average transition latency ${perTransitionMs.toFixed(3)}ms exceeds 0.5ms SLA limit`
      );

      // Verify final state integrity
      const finalValidation = SceneGraphSchema.safeParse(state.sceneGraph);
      assert.equal(finalValidation.success, true);
    });
  });
});
