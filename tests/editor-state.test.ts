/**
 * tests/editor-state.test.ts
 *
 * Automated verification of Phase 3 Reactive Editor State Management:
 * - Deterministic transitions
 * - Numerical boundary clamping
 * - SceneGraphSchema invariant preservation
 * - Immutability guarantees
 * - Undo/Redo & Reset
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  editorActions,
  editorReducer,
  initialEditorState,
  createInitialEditorState,
} from '../src/lib/editor/editor-state';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import { defaultSceneGraph } from '../remotion/compositions/InteractiveSurfaceDemo';

describe('Phase 3: Editor State Reducer & Zod Integrity', () => {
  describe('1. Initial State Validity', () => {
    test('initial state contains defaultSceneGraph and satisfies SceneGraphSchema', () => {
      const state = initialEditorState;
      assert.equal(state.sceneGraph.version, '2.0');
      assert.equal(state.isDirty, false);
      assert.equal(state.isPlaying, false);
      assert.equal(state.currentFrame, 0);
      assert.equal(state.validationNotice, null);
      assert.equal(state.history.past.length, 0);
      assert.equal(state.history.future.length, 0);

      const parsed = SceneGraphSchema.safeParse(state.sceneGraph);
      assert.equal(parsed.success, true);
    });

    test('createInitialEditorState returns a fresh independent state', () => {
      const stateA = createInitialEditorState();
      const stateB = createInitialEditorState();
      assert.notEqual(stateA, stateB);
      assert.notEqual(stateA.sceneGraph, stateB.sceneGraph);
      assert.deepEqual(stateA.sceneGraph, stateB.sceneGraph);
    });

    test('createInitialEditorState supports multi-scene preset', () => {
      const state = createInitialEditorState('multi-scene');
      assert.ok(state.sceneGraph.scenes.length >= 4);
      assert.equal(SceneGraphSchema.safeParse(state.sceneGraph).success, true);
    });
  });

  describe('2. UPDATE_TEXT Mutations', () => {
    test('updates windowTitle and preserves schema validity', () => {
      const action = editorActions.updateText(
        'windowTitle',
        'Acme SaaS Studio — Production Dashboard'
      );
      const next = editorReducer(initialEditorState, action);

      assert.notEqual(next, initialEditorState);
      assert.notEqual(next.sceneGraph, initialEditorState.sceneGraph);
      assert.equal(
        (next.sceneGraph.scenes[0].payload as { windowTitle?: string }).windowTitle,
        'Acme SaaS Studio — Production Dashboard'
      );
      assert.equal(next.history.past.length, 1);
      assert.equal(next.isDirty, true);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('updates textToType on initialEditorState and preserves schema validity', () => {
      const customPrompt = 'Analyze customer retention trends across Q3 subscriptions';
      const next = editorReducer(
        initialEditorState,
        editorActions.updateText('textToType', customPrompt)
      );

      assert.notEqual(next, initialEditorState);
      const payload = next.sceneGraph.scenes[0].payload as { textToType?: string };
      assert.equal(payload.textToType, customPrompt);
      assert.equal(next.isDirty, true);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('updates buttonText on initialEditorState and preserves schema validity', () => {
      const customButton = 'Deploy Service';
      const next = editorReducer(
        initialEditorState,
        editorActions.updateText('buttonText', customButton)
      );

      assert.notEqual(next, initialEditorState);
      const payload = next.sceneGraph.scenes[0].payload as { buttonText?: string };
      assert.equal(payload.buttonText, customButton);
      assert.equal(next.isDirty, true);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('updates all copy fields on initialEditorState without schema stripping', () => {
      let state = initialEditorState;
      state = editorReducer(state, editorActions.updateText('productName', 'EnterpriseFlow'));
      state = editorReducer(state, editorActions.updateText('tagline', 'Intelligence at the edge'));
      state = editorReducer(state, editorActions.updateText('title', 'Service Architecture'));
      state = editorReducer(state, editorActions.updateText('headline', 'GLOBAL INFRASTRUCTURE'));

      const payload = state.sceneGraph.scenes[0].payload as Record<string, unknown>;
      assert.equal(payload.productName, 'EnterpriseFlow');
      assert.equal(payload.tagline, 'Intelligence at the edge');
      assert.equal(payload.title, 'Service Architecture');
      assert.equal(payload.headline, 'GLOBAL INFRASTRUCTURE');
      assert.equal(SceneGraphSchema.safeParse(state.sceneGraph).success, true);
    });

    test('clamps text exceeding maximum character length', () => {
      const oversizedTitle = 'Z'.repeat(250); // Max windowTitle is 80
      const next = editorReducer(
        initialEditorState,
        editorActions.updateText('windowTitle', oversizedTitle)
      );

      const title = (next.sceneGraph.scenes[0].payload as { windowTitle?: string }).windowTitle;
      assert.ok(title !== undefined);
      assert.equal(title.length, 80);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('handles empty text gracefully with non-empty fallback to satisfy min(1)', () => {
      const next = editorReducer(
        initialEditorState,
        editorActions.updateText('windowTitle', '')
      );

      const title = (next.sceneGraph.scenes[0].payload as { windowTitle?: string }).windowTitle;
      assert.ok(title !== undefined && title.length >= 1);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('updates array fields such as files or words cleanly', () => {
      const multiSceneState = createInitialEditorState('multi-scene');
      const next = editorReducer(
        multiSceneState,
        editorActions.updateText('files', ['core/engine.ts', 'api/routes.ts'])
      );

      const codeScene = next.sceneGraph.scenes.find((s) => s.type === 'synthetic_code_tree');
      assert.ok(codeScene);
      assert.deepEqual(
        (codeScene.payload as { files?: string[] }).files,
        ['core/engine.ts', 'api/routes.ts']
      );
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });
  });

  describe('3. UPDATE_ART_DIRECTION Mutations', () => {
    test('updates backdropVariant, surfaceTheme, and primaryAccent', () => {
      const next = editorReducer(
        initialEditorState,
        editorActions.updateArtDirection({
          backdropVariant: 'aurora-blur',
          surfaceTheme: 'light',
          primaryAccent: '#3B82F6',
        })
      );

      assert.equal(next.sceneGraph.artDirection.backdropVariant, 'aurora-blur');
      assert.equal(next.sceneGraph.artDirection.surfaceTheme, 'light');
      assert.equal(next.sceneGraph.artDirection.primaryAccent, '#3B82F6');
      assert.equal(next.isDirty, true);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('retains valid hex when invalid hex color is supplied', () => {
      const next = editorReducer(
        initialEditorState,
        editorActions.updateArtDirection({
          primaryAccent: 'not-a-hex-color',
        })
      );

      assert.match(
        next.sceneGraph.artDirection.primaryAccent,
        /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
      );
      assert.ok(next.validationNotice !== null);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('accepts 3-digit shorthand hex colors', () => {
      const next = editorReducer(
        initialEditorState,
        editorActions.updateArtDirection({
          primaryAccent: '#F50',
        })
      );

      assert.equal(next.sceneGraph.artDirection.primaryAccent, '#F50');
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });
  });

  describe('4. UPDATE_CAMERA_FOCAL Mutations & Boundary Clamping', () => {
    test('updates active camera keyframe target (x, y) and zoom', () => {
      const next = editorReducer(
        initialEditorState,
        editorActions.updateCameraFocal({
          keyframeIndex: 0,
          x: 0.65,
          y: 0.35,
          zoom: 2.4,
          rotateX: 12,
          rotateY: -8,
        })
      );

      const kf0 = next.sceneGraph.cameraTrack[0];
      assert.equal(kf0.x, 0.65);
      assert.equal(kf0.y, 0.35);
      assert.equal(kf0.zoom, 2.4);
      assert.equal(kf0.rotateX, 12);
      assert.equal(kf0.rotateY, -8);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('strictly clamps out-of-bounds coordinates to [0.0, 1.0]', () => {
      const next = editorReducer(
        initialEditorState,
        editorActions.updateCameraFocal({
          keyframeIndex: 0,
          x: -1.5,
          y: 2.8,
        })
      );

      const kf0 = next.sceneGraph.cameraTrack[0];
      assert.equal(kf0.x, 0.0);
      assert.equal(kf0.y, 1.0);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });

    test('strictly clamps zoom to [0.8, 3.5]', () => {
      const nextMin = editorReducer(
        initialEditorState,
        editorActions.updateCameraFocal({
          keyframeIndex: 0,
          zoom: 0.1,
        })
      );
      assert.equal(nextMin.sceneGraph.cameraTrack[0].zoom, 0.8);

      const nextMax = editorReducer(
        initialEditorState,
        editorActions.updateCameraFocal({
          keyframeIndex: 0,
          zoom: 9.9,
        })
      );
      assert.equal(nextMax.sceneGraph.cameraTrack[0].zoom, 3.5);
      assert.equal(SceneGraphSchema.safeParse(nextMax.sceneGraph).success, true);
    });

    test('safely handles non-finite values (NaN, Infinity)', () => {
      const next = editorReducer(
        initialEditorState,
        editorActions.updateCameraFocal({
          keyframeIndex: 0,
          x: NaN,
          y: Infinity,
          zoom: -Infinity,
        })
      );

      const kf0 = next.sceneGraph.cameraTrack[0];
      assert.ok(Number.isFinite(kf0.x));
      assert.ok(Number.isFinite(kf0.y));
      assert.ok(Number.isFinite(kf0.zoom));
      assert.ok(kf0.x >= 0.0 && kf0.x <= 1.0);
      assert.ok(kf0.y >= 0.0 && kf0.y <= 1.0);
      assert.ok(kf0.zoom >= 0.8 && kf0.zoom <= 3.5);
      assert.equal(SceneGraphSchema.safeParse(next.sceneGraph).success, true);
    });
  });

  describe('5. RESET_SCENE_GRAPH & History (Undo / Redo)', () => {
    test('resets scene graph to default and records history', () => {
      const edited = editorReducer(
        initialEditorState,
        editorActions.updateArtDirection({ primaryAccent: '#10B981' })
      );
      assert.equal(edited.sceneGraph.artDirection.primaryAccent, '#10B981');

      const reset = editorReducer(edited, editorActions.resetSceneGraph('default'));
      assert.equal(
        reset.sceneGraph.artDirection.primaryAccent,
        defaultSceneGraph.artDirection.primaryAccent
      );
      assert.equal(reset.isDirty, false);
      assert.equal(reset.history.past.length, 2);
    });

    test('undo reverts last change, redo restores it', () => {
      const step1 = editorReducer(
        initialEditorState,
        editorActions.updateArtDirection({ primaryAccent: '#3B82F6' })
      );
      const step2 = editorReducer(
        step1,
        editorActions.updateArtDirection({ primaryAccent: '#10B981' })
      );

      const undone = editorReducer(step2, editorActions.undo());
      assert.equal(undone.sceneGraph.artDirection.primaryAccent, '#3B82F6');

      const redone = editorReducer(undone, editorActions.redo());
      assert.equal(redone.sceneGraph.artDirection.primaryAccent, '#10B981');
    });

    test('undo on empty past history is a no-op', () => {
      const unchanged = editorReducer(initialEditorState, editorActions.undo());
      assert.equal(unchanged, initialEditorState);
    });

    test('redo on empty future history is a no-op', () => {
      const unchanged = editorReducer(initialEditorState, editorActions.redo());
      assert.equal(unchanged, initialEditorState);
    });
  });

  describe('6. Playback & Keyframe Navigation Actions', () => {
    test('SET_CURRENT_FRAME clamps to canvas bounds', () => {
      const next1 = editorReducer(initialEditorState, editorActions.setCurrentFrame(120));
      assert.equal(next1.currentFrame, 120);

      const nextOver = editorReducer(initialEditorState, editorActions.setCurrentFrame(9999));
      assert.equal(
        nextOver.currentFrame,
        initialEditorState.sceneGraph.canvas.durationInFrames - 1
      );

      const nextUnder = editorReducer(initialEditorState, editorActions.setCurrentFrame(-50));
      assert.equal(nextUnder.currentFrame, 0);
    });

    test('SET_CURRENT_FRAME safely guards against NaN and Infinity', () => {
      const nextNaN = editorReducer(initialEditorState, editorActions.setCurrentFrame(NaN));
      assert.equal(nextNaN.currentFrame, 0);
      assert.ok(Number.isFinite(nextNaN.currentFrame));

      const nextInf = editorReducer(initialEditorState, editorActions.setCurrentFrame(Infinity));
      assert.equal(
        nextInf.currentFrame,
        initialEditorState.sceneGraph.canvas.durationInFrames - 1
      );
    });

    test('SET_PLAYING toggles play state', () => {
      const next = editorReducer(initialEditorState, editorActions.setPlaying(true));
      assert.equal(next.isPlaying, true);

      const stopped = editorReducer(next, editorActions.setPlaying(false));
      assert.equal(stopped.isPlaying, false);
    });

    test('SET_ACTIVE_KEYFRAME clamps index to track length', () => {
      const trackLen = initialEditorState.sceneGraph.cameraTrack.length;
      const next = editorReducer(initialEditorState, editorActions.setActiveKeyframe(2));
      assert.equal(next.activeKeyframeIndex, 2);

      const over = editorReducer(initialEditorState, editorActions.setActiveKeyframe(100));
      assert.equal(over.activeKeyframeIndex, trackLen - 1);
    });

    test('SET_ACTIVE_KEYFRAME safely guards against NaN and Infinity', () => {
      const trackLen = initialEditorState.sceneGraph.cameraTrack.length;
      const nextNaN = editorReducer(initialEditorState, editorActions.setActiveKeyframe(NaN));
      assert.equal(nextNaN.activeKeyframeIndex, 0);
      assert.ok(Number.isFinite(nextNaN.activeKeyframeIndex));

      const nextInf = editorReducer(initialEditorState, editorActions.setActiveKeyframe(Infinity));
      assert.equal(nextInf.activeKeyframeIndex, trackLen - 1);
    });
  });

  describe('7. Immutability Guarantees', () => {
    test('does not mutate original state or nested objects', () => {
      const original = createInitialEditorState();
      const originalAccent = original.sceneGraph.artDirection.primaryAccent;
      const originalKf0X = original.sceneGraph.cameraTrack[0].x;

      const next = editorReducer(
        original,
        editorActions.updateArtDirection({ primaryAccent: '#EAB308' })
      );

      assert.equal(original.sceneGraph.artDirection.primaryAccent, originalAccent);
      assert.equal(next.sceneGraph.artDirection.primaryAccent, '#EAB308');

      const nextCamera = editorReducer(
        next,
        editorActions.updateCameraFocal({ keyframeIndex: 0, x: 0.99 })
      );

      assert.equal(original.sceneGraph.cameraTrack[0].x, originalKf0X);
      assert.equal(nextCamera.sceneGraph.cameraTrack[0].x, 0.99);
    });
  });
});
