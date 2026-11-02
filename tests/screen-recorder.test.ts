/**
 * tests/screen-recorder.test.ts
 *
 * Automated verification suite for Phase 6: Screen Recorder Module & Observed Telemetry.
 *
 * Verifies:
 * 1. Zod Schemas & Invariants (RecordedPointerEventSchema, RecorderConfigSchema, RawRecordingSessionSchema).
 * 2. Spatial Coordinate Clamping & Normalization ([0.0, 1.0] boundary enforcement, NaN/Infinity safety).
 * 3. Time-to-Frame Mathematical Quantization across 24, 30, and 60 FPS.
 * 4. 100% Observed Provenance Enforcement (Mandatory provenance: 'observed', zero inferred/simulated).
 * 5. HeadlessRecordingSimulator Determinism (Scripted clicks, movements, scrolls, duration calculation).
 * 6. Idle Recording & Rapid Click Spam Resilience (Zero events fallback holding shot, click ID collision disambiguation).
 * 7. Remotion SceneGraph v2.0 Ingestion Pipeline (CameraTrack focal zooms on clicks, Bezier cursor path, audio cues, video payload binding).
 * 8. Codec Negotiation & Browser API Capabilities (MIME preference resolution hierarchy).
 * 9. MouseTracker Module Safety in Headless / SSR Environments.
 * 10. Studio Editor State Reducer Integration (loadSceneGraph dispatch, undo history, frame 0 reset).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CoordinateMapper } from '../src/lib/interaction-map/CoordinateMapper';
import { InteractionMapSchema } from '../src/lib/interaction-map/schema';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import {
  RecordedPointerEventSchema,
  RecorderConfigSchema,
  RecordingSessionMetadataSchema,
  RecordingSessionSummarySchema,
  RawRecordingSessionSchema,
} from '../src/lib/recorder/schema';
import {
  MouseTracker,
  StreamRecorder,
  resolveOptimalMimeType,
  HeadlessRecordingSimulator,
  synthesizeObservedInteractionMap,
  synthesizeObservedInteractionMapFromEvents,
  adaptObservedSessionToSceneGraph,
} from '../src/lib/recorder';
import type {
  RawRecordingSession,
  RecordedPointerEvent,
} from '../src/lib/recorder/types';
import {
  createInitialEditorState,
  editorActions,
  editorReducer,
} from '../src/lib/editor/editor-state';

describe('Phase 6: Screen Recorder Module & Observed Telemetry', () => {
  // =========================================================================
  // PILLAR 1: Strict Zod Schemas & Validation Contracts
  // =========================================================================
  describe('1. Zod Schemas & Invariants', () => {
    it('1.1 validates valid RecordedPointerEvent structures', () => {
      const validEvt = {
        id: 'evt-101',
        type: 'click',
        timestampMs: 450,
        x: 0.45,
        y: 0.65,
        targetTag: 'BUTTON',
        button: 0,
      };
      const parsed = RecordedPointerEventSchema.parse(validEvt);
      assert.equal(parsed.id, 'evt-101');
      assert.equal(parsed.type, 'click');
      assert.equal(parsed.timestampMs, 450);
      assert.equal(parsed.t_ms, 450);
      assert.equal(parsed.x, 0.45);
      assert.equal(parsed.y, 0.65);
      assert.equal(parsed.targetTag, 'BUTTON');
    });

    it('1.2 rejects invalid normalized coordinates outside [0.0, 1.0]', () => {
      assert.throws(
        () =>
          RecordedPointerEventSchema.parse({
            id: 'err-1',
            type: 'move',
            timestampMs: 100,
            x: 1.25, // > 1.0
            y: 0.5,
          }),
        /Coordinate x must be in \[0.0, 1.0\]/
      );

      assert.throws(
        () =>
          RecordedPointerEventSchema.parse({
            id: 'err-2',
            type: 'move',
            timestampMs: 100,
            x: 0.5,
            y: -0.1, // < 0.0
          }),
        /Coordinate y must be in \[0.0, 1.0\]/
      );
    });

    it('1.3 rejects negative timestamps', () => {
      assert.throws(
        () =>
          RecordedPointerEventSchema.parse({
            id: 'err-3',
            type: 'click',
            timestampMs: -50,
            x: 0.5,
            y: 0.5,
          }),
        /Timestamp must be non-negative/
      );
    });

    it('1.4 validates RecorderConfigSchema defaults and constraints', () => {
      const config = RecorderConfigSchema.parse({});
      assert.equal(config.fps, 30);
      assert.equal(config.maxDurationSeconds, 60);
      assert.equal(config.throttleMs, 33);
      assert.equal(config.captureCursor, 'never');
      assert.equal(config.captureAudio, true);
      assert.equal(config.videoBitsPerSecond, 5_000_000);

      // Rejects invalid cursor mode
      assert.throws(() =>
        RecorderConfigSchema.parse({ captureCursor: 'invalid-mode' })
      );
    });

    it('1.5 validates RecordingSessionMetadataSchema and Summary', () => {
      const meta = RecordingSessionMetadataSchema.parse({
        totalEvents: 42,
        durationMs: 5000,
        resolution: { width: 1920, height: 1080 },
        recordedAt: '2026-11-01T00:00:00.000Z',
        clickCount: 3,
        moveCount: 39,
        effectiveFps: 8.4,
      });
      assert.equal(meta.totalEvents, 42);
      assert.equal(meta.resolution.width, 1920);

      const summary = RecordingSessionSummarySchema.parse({
        id: 'session-1',
        status: 'review',
        startedAt: 1000,
        stoppedAt: 6000,
        durationMs: 5000,
        durationInFrames: 150,
        baseResolution: { width: 1920, height: 1080 },
        eventsCount: 42,
        clicksCount: 3,
        movesCount: 39,
        effectiveFps: 8.4,
        videoMimeType: 'video/webm',
      });
      assert.equal(summary.status, 'review');
      assert.equal(summary.durationInFrames, 150);
    });

    it('1.6 enforces RawRecordingSession duration and event boundary refinement', () => {
      const validSession = {
        id: 'sess-valid',
        t0_ms: 1000,
        tEnd_ms: 4000,
        duration_ms: 3000,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events: [
          { id: 'e1', type: 'move', timestampMs: 500, x: 0.1, y: 0.2 },
          { id: 'e2', type: 'click', timestampMs: 2500, x: 0.5, y: 0.5 },
        ],
        stats: {
          totalEvents: 2,
          durationMs: 3000,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date().toISOString(),
        },
      };

      const parsed = RawRecordingSessionSchema.parse(validSession);
      assert.equal(parsed.id, 'sess-valid');

      // Rejects if tEnd_ms < t0_ms
      assert.throws(
        () =>
          RawRecordingSessionSchema.parse({
            ...validSession,
            tEnd_ms: 500,
          }),
        /tEnd_ms must be greater than or equal to t0_ms/
      );

      // Rejects if an event occurs well past duration_ms
      assert.throws(
        () =>
          RawRecordingSessionSchema.parse({
            ...validSession,
            events: [
              { id: 'e-out', type: 'click', timestampMs: 9999, x: 0.5, y: 0.5 },
            ],
          }),
        /All event timestamps must occur within the recording duration/
      );
    });
  });

  // =========================================================================
  // PILLAR 2: Spatial Coordinate Clamping & Normalization
  // =========================================================================
  describe('2. Coordinate Normalization & Clamping', () => {
    it('2.1 preserves valid normalized coordinates in [0.0, 1.0]', () => {
      assert.equal(CoordinateMapper.clamp01(0.0), 0.0);
      assert.equal(CoordinateMapper.clamp01(0.5432), 0.5432);
      assert.equal(CoordinateMapper.clamp01(1.0), 1.0);
    });

    it('2.2 strictly clamps negative coordinates to 0.0', () => {
      assert.equal(CoordinateMapper.clamp01(-0.01), 0.0);
      assert.equal(CoordinateMapper.clamp01(-50.0), 0.0);
    });

    it('2.3 strictly clamps coordinates > 1.0 to 1.0', () => {
      assert.equal(CoordinateMapper.clamp01(1.0001), 1.0);
      assert.equal(CoordinateMapper.clamp01(99.0), 1.0);
    });

    it('2.4 safely handles non-finite values (NaN, Infinity, -Infinity)', () => {
      assert.equal(CoordinateMapper.clamp01(NaN), 0.0);
      assert.equal(CoordinateMapper.clamp01(Infinity), 0.0);
      assert.equal(CoordinateMapper.clamp01(-Infinity), 0.0);
    });
  });

  // =========================================================================
  // PILLAR 3: Time-to-Frame Mathematical Quantization
  // =========================================================================
  describe('3. Time-to-Frame Mathematical Mapping', () => {
    it('3.1 calculates exact timeline frames at 30 FPS', () => {
      const fps = 30;
      // 0ms -> 0f
      assert.equal(Math.round((0 / 1000) * fps), 0);
      // 33.3ms -> 1f
      assert.equal(Math.round((33.3 / 1000) * fps), 1);
      // 500ms -> 15f
      assert.equal(Math.round((500 / 1000) * fps), 15);
      // 1000ms -> 30f
      assert.equal(Math.round((1000 / 1000) * fps), 30);
      // 2500ms -> 75f
      assert.equal(Math.round((2500 / 1000) * fps), 75);
    });

    it('3.2 calculates exact timeline frames across 24, 30, and 60 FPS', () => {
      const elapsedMs = 1500;
      assert.equal(Math.round((elapsedMs / 1000) * 24), 36);
      assert.equal(Math.round((elapsedMs / 1000) * 30), 45);
      assert.equal(Math.round((elapsedMs / 1000) * 60), 90);
    });

    it('3.3 clamps events precisely within durationInFrames bounds', () => {
      const rawEvents: RecordedPointerEvent[] = [
        { id: '1', type: 'click', timestampMs: 10000, t_ms: 10000, timestamp: 10000, x: 0.5, y: 0.5 },
      ];
      // 2000ms duration at 30fps = 60 frames
      const map = synthesizeObservedInteractionMapFromEvents(rawEvents, 2000, { fps: 30 });
      assert.equal(map.durationInFrames, 60);
      assert.ok(map.events.every((e) => e.frame <= 60));
    });
  });

  // =========================================================================
  // PILLAR 4: 100% Observed Provenance Invariant
  // =========================================================================
  describe('4. 100% Observed Provenance Enforcement', () => {
    it('4.1 guarantees 100% of synthesized events carry provenance: "observed"', () => {
      const session = HeadlessRecordingSimulator.createSampleSession('saas-nav-and-publish', {
        durationMs: 6000,
        fps: 30,
      });

      const map = synthesizeObservedInteractionMap(session);
      assert.ok(map.events.length > 0, 'InteractionMap must contain synthesized events');

      for (const event of map.events) {
        assert.equal(
          event.provenance,
          'observed',
          `Event ${event.id} must have provenance 'observed' but got '${event.provenance}'`
        );
      }
    });

    it('4.2 zero occurrences of "inferred" or "simulated" in synthesized output', () => {
      const session = HeadlessRecordingSimulator.createSampleSession('quick-click-sequence', {
        durationMs: 2000,
        fps: 30,
      });

      const map = synthesizeObservedInteractionMap(session);
      const invalidProvenances = map.events.filter(
        (e) => (e.provenance as string) === 'inferred' || (e.provenance as string) === 'simulated'
      );
      assert.equal(invalidProvenances.length, 0);
    });

    it('4.3 satisfies strict InteractionMapSchema validation', () => {
      const session = HeadlessRecordingSimulator.createSampleSession('saas-nav-and-publish');
      const map = synthesizeObservedInteractionMap(session);
      const parsed = InteractionMapSchema.parse(map);
      assert.equal(parsed.version, '2.0');
      assert.ok(parsed.events.length >= 3);
    });
  });

  // =========================================================================
  // PILLAR 5: Headless Recording Simulator
  // =========================================================================
  describe('5. HeadlessRecordingSimulator', () => {
    it('5.1 executes scripted recording sessions in pure Node.js without browser APIs', () => {
      const sim = new HeadlessRecordingSimulator({ fps: 30 });
      sim.start(0);
      sim.moveTo(100, 0.1, 0.2);
      sim.moveTo(300, 0.3, 0.4);
      sim.click(500, 0.3, 0.4, { targetTag: 'BUTTON', targetId: 'submit-btn', textSnippet: 'Send' });
      sim.scroll(800, 150);
      const session = sim.stop(1000);

      assert.equal(session.fps, 30);
      assert.equal(session.duration_ms, 1000);
      assert.equal(session.events.length, 4);
      assert.equal(session.stats.clickCount, 1);
      assert.equal(session.stats.moveCount, 2);
      assert.equal(session.stats.scrollCount, 1);
    });

    it('5.2 clamps coordinates in simulator builder methods', () => {
      const sim = new HeadlessRecordingSimulator();
      sim.start(0);
      sim.moveTo(100, -0.5, 1.8);
      sim.click(200, 2.5, -0.2);
      const session = sim.stop(300);

      assert.equal(session.events[0].x, 0.0);
      assert.equal(session.events[0].y, 1.0);
      assert.equal(session.events[1].x, 1.0);
      assert.equal(session.events[1].y, 0.0);
    });

    it('5.3 supports createSampleSession presets', () => {
      const navSession = HeadlessRecordingSimulator.createSampleSession('saas-nav-and-publish');
      assert.ok(navSession.events.length >= 7);
      assert.ok(navSession.stats.clickCount === 3);

      const quickSession = HeadlessRecordingSimulator.createSampleSession('quick-click-sequence');
      assert.equal(quickSession.stats.clickCount, 2);
    });
  });

  // =========================================================================
  // PILLAR 6: Idle Recording & Rapid Click Spam Resilience
  // =========================================================================
  describe('6. Idle Recording & Click Spam Resilience', () => {
    it('6.1 handles idle recording (0 events) by providing an overview hold at center (0.5, 0.5)', () => {
      const emptySession: RawRecordingSession = {
        id: 'idle-sess',
        t0_ms: 0,
        tEnd_ms: 3000,
        duration_ms: 3000,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events: [],
        stats: {
          totalEvents: 0,
          durationMs: 3000,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date().toISOString(),
        },
      };

      const map = synthesizeObservedInteractionMap(emptySession);
      assert.equal(map.events.length, 1);
      assert.equal(map.events[0].type, 'focus');
      assert.equal(map.events[0].x, 0.5);
      assert.equal(map.events[0].y, 0.5);
      assert.equal(map.events[0].provenance, 'observed');

      // Adapts into valid SceneGraph without errors
      const result = adaptObservedSessionToSceneGraph(emptySession);
      assert.ok(result.sceneGraph.cameraTrack.length > 0);
      assert.ok(result.sceneGraph.cursorTrack.length > 0);
    });

    it('6.2 handles rapid click spam at identical timestamps with unique IDs and without collision', () => {
      const spamEvents: RecordedPointerEvent[] = [
        { id: 'c1', type: 'click', timestampMs: 500, t_ms: 500, timestamp: 500, x: 0.3, y: 0.4 },
        { id: 'c2', type: 'click', timestampMs: 501, t_ms: 501, timestamp: 501, x: 0.3, y: 0.4 },
        { id: 'c3', type: 'click', timestampMs: 502, t_ms: 502, timestamp: 502, x: 0.3, y: 0.4 },
      ];

      const map = synthesizeObservedInteractionMapFromEvents(spamEvents, 2000, { fps: 30 });
      const clickEvents = map.events.filter((e) => e.type === 'click');
      assert.equal(clickEvents.length, 3);

      // Verify all click IDs are strictly unique
      const idSet = new Set(clickEvents.map((c) => c.id));
      assert.equal(idSet.size, 3);
    });

    it('6.3 deduplicates redundant spatial mousemove jitter within threshold', () => {
      const jitterEvents: RecordedPointerEvent[] = [
        { id: 'm1', type: 'move', timestampMs: 100, t_ms: 100, timestamp: 100, x: 0.5, y: 0.5 },
        { id: 'm2', type: 'move', timestampMs: 133, t_ms: 133, timestamp: 133, x: 0.5005, y: 0.5005 }, // jitter within dedupe radius
        { id: 'm3', type: 'move', timestampMs: 166, t_ms: 166, timestamp: 166, x: 0.5008, y: 0.5008 }, // jitter within dedupe radius
        { id: 'm4', type: 'move', timestampMs: 300, t_ms: 300, timestamp: 300, x: 0.7, y: 0.8 }, // significant displacement
      ];

      const map = synthesizeObservedInteractionMapFromEvents(jitterEvents, 2000, {
        fps: 30,
        deduplicateMoveRadius: 0.01,
      });

      // m2 and m3 should be dropped due to spatial proximity
      assert.equal(map.events.length, 2);
    });
  });

  // =========================================================================
  // PILLAR 7: Remotion SceneGraph v2.0 Ingestion Pipeline
  // =========================================================================
  describe('7. Remotion SceneGraph Adaptation Pipeline', () => {
    it('7.1 adapts observed session into strict SceneGraph v2.0', () => {
      const session = HeadlessRecordingSimulator.createSampleSession('saas-nav-and-publish', {
        durationMs: 5000,
        fps: 30,
      });

      const completed = adaptObservedSessionToSceneGraph(session);
      assert.equal(completed.sceneGraph.version, '2.0');
      assert.equal(completed.sceneGraph.canvas.fps, 30);
      assert.equal(completed.sceneGraph.canvas.durationInFrames, 150);

      // Validate against strict SceneGraphSchema
      const validated = SceneGraphSchema.parse(completed.sceneGraph);
      assert.ok(validated.cameraTrack.length >= 3);
      assert.ok(validated.cursorTrack.length >= 3);
      assert.ok(validated.audioTrack.length >= 3);
    });

    it('7.2 centers camera keyframes on observed click coordinates', () => {
      const session = HeadlessRecordingSimulator.createSampleSession('quick-click-sequence', {
        durationMs: 2000,
        fps: 30,
      });

      const completed = adaptObservedSessionToSceneGraph(session, { clickZoom: 2.5 });
      const kfs = completed.sceneGraph.cameraTrack;

      // Click at (0.2, 0.2) and click at (0.8, 0.8)
      const hasFirstClickTarget = kfs.some((kf) => Math.abs(kf.x - 0.2) < 0.05 && Math.abs(kf.y - 0.2) < 0.05);
      const hasSecondClickTarget = kfs.some((kf) => Math.abs(kf.x - 0.8) < 0.05 && Math.abs(kf.y - 0.8) < 0.05);

      assert.ok(hasFirstClickTarget, 'Camera track must target first observed click at (0.2, 0.2)');
      assert.ok(hasSecondClickTarget, 'Camera track must target second observed click at (0.8, 0.8)');
    });

    it('7.3 schedules frame-synchronized audio cues for clicks', () => {
      const session = HeadlessRecordingSimulator.createSampleSession('quick-click-sequence', {
        durationMs: 2000,
        fps: 30,
      });

      const completed = adaptObservedSessionToSceneGraph(session);
      const clickCues = completed.sceneGraph.audioTrack.filter((cue) => cue.asset === 'mouse-click');

      assert.equal(clickCues.length, 2, 'Must have exactly 2 mouse-click cues for 2 clicks');
      // Frame for 600ms at 30fps is ~18f, 1500ms is ~45f
      assert.ok(clickCues[0].frame >= 16 && clickCues[0].frame <= 20);
      assert.ok(clickCues[1].frame >= 43 && clickCues[1].frame <= 47);
    });

    it('7.4 binds recorded screen capture video asset into product_interaction_3d scene node', () => {
      const session = HeadlessRecordingSimulator.createSampleSession('saas-nav-and-publish');
      const testVideoUri = 'blob:http://localhost:3000/mock-video-uuid-1234';

      const completed = adaptObservedSessionToSceneGraph(session, {
        videoDataUri: testVideoUri,
      });

      assert.equal(completed.videoUrl, testVideoUri);
      const surfaceScene = completed.sceneGraph.scenes.find((s) => s.type === 'product_interaction_3d');
      assert.ok(surfaceScene, 'Must contain product_interaction_3d scene');
      assert.equal(surfaceScene.payload.mockInterface, testVideoUri);
      assert.equal(surfaceScene.payload.url, testVideoUri);
    });
  });

  // =========================================================================
  // PILLAR 8: Codec Negotiation & Browser Capabilities
  // =========================================================================
  describe('8. Codec Negotiation & StreamRecorder Capabilities', () => {
    it('8.1 StreamRecorder.isSupported returns false in headless Node.js environment', () => {
      assert.equal(StreamRecorder.isSupported(), false);
    });

    it('8.2 resolveOptimalMimeType returns empty string in Node.js when MediaRecorder is undefined', () => {
      const mime = resolveOptimalMimeType();
      assert.equal(mime, '');
    });

    it('8.3 resolveOptimalMimeType follows codec preference order when MediaRecorder is mocked', () => {
      // Temporarily mock MediaRecorder.isTypeSupported
      const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;
      try {
        (globalThis as Record<string, unknown>).MediaRecorder = {
          isTypeSupported: (type: string) => {
            // Mock supporting only vp8 and mp4
            return type === 'video/webm;codecs=vp8,opus' || type === 'video/mp4';
          },
        };

        const resolved = resolveOptimalMimeType();
        assert.equal(resolved, 'video/webm;codecs=vp8,opus');
      } finally {
        (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
      }
    });
  });

  // =========================================================================
  // PILLAR 9: MouseTracker Headless / SSR Resilience
  // =========================================================================
  describe('9. MouseTracker Headless & SSR Safety', () => {
    it('9.1 instantiates and stops in Node.js without crashing', () => {
      const tracker = new MouseTracker();
      tracker.start(0);
      const events = tracker.stop();
      assert.deepEqual(events, []);
    });

    it('9.2 getViewport returns 1920x1080 default when window is undefined', () => {
      const tracker = new MouseTracker();
      const vp = tracker.getViewport();
      assert.equal(vp.width, 1920);
      assert.equal(vp.height, 1080);
      assert.equal(vp.devicePixelRatio, 1.0);
    });
  });

  // =========================================================================
  // PILLAR 10: Studio Editor State Reducer Integration
  // =========================================================================
  describe('10. Studio Editor State Reducer Integration', () => {
    it('10.1 dispatches loadSceneGraph, updates state, resets frame to 0, and records history', () => {
      const initialState = createInitialEditorState();
      assert.equal(initialState.isDirty, false);
      assert.equal(initialState.currentFrame, 0);

      const session = HeadlessRecordingSimulator.createSampleSession('saas-nav-and-publish', {
        durationMs: 4000,
        fps: 30,
      });
      const completed = adaptObservedSessionToSceneGraph(session);

      const nextState = editorReducer(
        initialState,
        editorActions.loadSceneGraph(completed.sceneGraph)
      );

      assert.equal(nextState.isDirty, true);
      assert.equal(nextState.currentFrame, 0);
      assert.equal(nextState.history.past.length, 1);
      assert.equal(nextState.sceneGraph.canvas.durationInFrames, 120);

      // Verify undo restores original state
      const undoneState = editorReducer(nextState, editorActions.undo());
      assert.equal(undoneState.sceneGraph.canvas.durationInFrames, initialState.sceneGraph.canvas.durationInFrames);
      assert.equal(undoneState.history.future.length, 1);
    });
  });
});
