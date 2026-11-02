/**
 * tests/adversarial-recorder-stress.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS SUITE: Phase 6 Screen Recorder & Observed Telemetry
 *
 * Rigorously probes:
 * 1. Coordinate Clamping & Boundary Edge Conditions:
 *    - Values < 0 (-0.001, -50, -1e10), > 1 (1.001, 50, 1e10), -0, subnormals.
 *    - NaN, +Infinity, -Infinity handling across CoordinateMapper and schemas.
 *    - Negative timestamps, out-of-order timestamps, timestamps > duration.
 *    - Empty strings in targetId, extreme durations, zero/negative durations.
 * 2. High-Frequency Burst Mouse Movements:
 *    - 10,000 events in 100ms (micro-jitter spam vs wide diagonal sweeps).
 *    - Spatial deduplication throughput, downsampling efficiency, and execution budget.
 *    - Strict bitwise/deterministic reproducibility across 10 repeated runs.
 *    - Heap memory growth and memory leak prevention under repeated stress bursts.
 * 3. Headless Recording Simulator & Complex User Interactions:
 *    - Rapid drag-and-drop trajectories (50 sub-steps in 200ms).
 *    - Rapid double click / click spam (5ms delta, same coordinates).
 *    - Pause and resume with large quiescent time gaps (pullback verification).
 *    - Negative pause/time parameter resilience (time monotonicity enforcement).
 *    - Simulator and MouseTracker lifecycle invariants (double start, double stop).
 * 4. Downstream Spline Interpolation & SceneGraph Robustness:
 *    - Bezier control point stability on dense and degenerate chords.
 *    - 100% Observed provenance invariant under high stress.
 *    - Strict Zod validation on generated InteractionMap and SceneGraph.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CoordinateMapper } from '../src/lib/interaction-map/CoordinateMapper';
import { InteractionMapSchema } from '../src/lib/interaction-map/schema';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import {
  RecordedPointerEventSchema,
} from '../src/lib/recorder/schema';
import {
  HeadlessRecordingSimulator,
  MouseTracker,
  synthesizeObservedInteractionMap,
  synthesizeObservedInteractionMapFromEvents,
  adaptObservedSessionToSceneGraph,
} from '../src/lib/recorder';
import type {
  RawRecordingSession,
  RecordedPointerEvent,
} from '../src/lib/recorder/types';

describe('Adversarial Stress Suite: Phase 6 Screen Recorder & Observed Telemetry', () => {
  // =========================================================================
  // PILLAR 1: Coordinate Clamping & Boundary Edge Conditions
  // =========================================================================
  describe('1. Boundary Edge Conditions & Clamping Oracles', () => {
    it('1.1 CoordinateMapper.clamp01 rigorously confines extreme out-of-bound floats', () => {
      const extremeNegative = [-0.0000001, -0.5, -1.0, -100.0, -1e12, -Number.MAX_VALUE];
      for (const val of extremeNegative) {
        assert.equal(CoordinateMapper.clamp01(val), 0.0, `Expected 0.0 for ${val}`);
      }

      const extremePositive = [1.0000001, 1.5, 2.0, 100.0, 1e12, Number.MAX_VALUE];
      for (const val of extremePositive) {
        assert.equal(CoordinateMapper.clamp01(val), 1.0, `Expected 1.0 for ${val}`);
      }

      // Signed zero and subnormal floats
      assert.equal(CoordinateMapper.clamp01(-0), 0.0);
      assert.equal(CoordinateMapper.clamp01(Number.MIN_VALUE), Number.MIN_VALUE);
      assert.equal(CoordinateMapper.clamp01(Number.EPSILON), Number.EPSILON);
    });

    it('1.2 CoordinateMapper.clamp01 safely sanitizes NaN and infinities to 0.0', () => {
      assert.equal(CoordinateMapper.clamp01(NaN), 0.0);
      assert.equal(CoordinateMapper.clamp01(Infinity), 0.0);
      assert.equal(CoordinateMapper.clamp01(-Infinity), 0.0);
    });

    it('1.3 RecordedPointerEventSchema strictly rejects invalid coordinates and timestamps', () => {
      const base = { id: 'evt-probe', type: 'move' as const, timestampMs: 100 };

      // Rejects out of bounds
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, x: -0.001, y: 0.5 }), /Coordinate x/);
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, x: 1.001, y: 0.5 }), /Coordinate x/);
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, x: 0.5, y: -0.001 }), /Coordinate y/);
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, x: 0.5, y: 1.001 }), /Coordinate y/);

      // Rejects NaN and Infinities in coordinates
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, x: NaN, y: 0.5 }), /expected number/i);
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, x: 0.5, y: NaN }), /expected number/i);
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, x: Infinity, y: 0.5 }), /expected number|Coordinate x/i);
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, x: 0.5, y: -Infinity }), /expected number|Coordinate y/i);

      // Rejects negative timestamp
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, timestampMs: -0.001, x: 0.5, y: 0.5 }), /Timestamp must be non-negative/);
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, timestampMs: -100, x: 0.5, y: 0.5 }), /Timestamp must be non-negative/);

      // Rejects NaN timestamp
      assert.throws(() => RecordedPointerEventSchema.parse({ ...base, timestampMs: NaN, x: 0.5, y: 0.5 }), /expected number/i);
    });

    it('1.4 telemetry synthesizer clamps out-of-bound raw events and generates valid InteractionMap', () => {
      // Raw events with extreme coordinates, negative timestamp, and out-of-order sequence
      const unvalidatedRaw: RecordedPointerEvent[] = [
        { id: 'raw-1', type: 'move', timestampMs: -50, t_ms: -50, timestamp: 0, x: -5.0, y: 12.0 },
        { id: 'raw-2', type: 'click', timestampMs: 800, t_ms: 800, timestamp: 800, x: 1.8, y: -0.4 },
        { id: 'raw-3', type: 'move', timestampMs: 300, t_ms: 300, timestamp: 300, x: 0.5, y: 0.5 },
      ];

      const map = synthesizeObservedInteractionMapFromEvents(unvalidatedRaw, 1000, { fps: 30 });
      const validated = InteractionMapSchema.parse(map);

      // raw-1 (hover at 0f), raw-3 (hover at 9f), dwell-focus prelude (15f), raw-2 (click at 24f)
      assert.equal(validated.events.length, 4);
      // Verify negative timestamp clamped to frame 0
      assert.equal(validated.events[0].frame, 0);
      assert.equal(validated.events[0].x, 0.0);
      assert.equal(validated.events[0].y, 1.0);

      // Verify out-of-order sequence was sorted chronologically
      for (let i = 0; i < validated.events.length - 1; i++) {
        assert.ok(
          validated.events[i].frame <= validated.events[i + 1].frame,
          `Events must be sorted by frame: ${validated.events[i].frame} <= ${validated.events[i + 1].frame}`
        );
      }

      // Verify raw-2 coordinates clamped to [1.0, 0.0]
      const clickEvt = validated.events.find((e) => e.type === 'click');
      assert.ok(clickEvt);
      assert.equal(clickEvt.x, 1.0);
      assert.equal(clickEvt.y, 0.0);
    });

    it('1.5 telemetry synthesizer safely sorts randomly shuffled timestamps', () => {
      const timestamps = [1900, 250, 420, 1100, 50, 3000, 800, 1500, 2100, 100];
      const shuffled: RecordedPointerEvent[] = timestamps.map((t, idx) => ({
        id: `rnd-${idx}`,
        type: 'move',
        timestampMs: t,
        t_ms: t,
        timestamp: t,
        x: 0.1 + (idx * 0.08),
        y: 0.2 + (idx * 0.05),
      }));

      const map = synthesizeObservedInteractionMapFromEvents(shuffled, 3500, { fps: 30 });
      assert.ok(map.events.length > 0);

      // Invariant: strict non-decreasing frame order
      for (let i = 0; i < map.events.length - 1; i++) {
        assert.ok(
          map.events[i].frame <= map.events[i + 1].frame,
          `Frame ordering violated at index ${i}: ${map.events[i].frame} > ${map.events[i + 1].frame}`
        );
      }
    });

    it('1.6 handles empty sessions and zero-duration edge cases gracefully', () => {
      // 0 duration defaults to minimum timeline budget
      const emptyMap = synthesizeObservedInteractionMapFromEvents([], 0, { fps: 30 });
      assert.ok(emptyMap.durationInFrames >= 30);
      assert.equal(emptyMap.events.length, 1); // Fallback overview hold
      assert.equal(emptyMap.events[0].type, 'focus');
      assert.equal(emptyMap.events[0].x, 0.5);
      assert.equal(emptyMap.events[0].y, 0.5);

      // Adapt to SceneGraph
      const emptySession: RawRecordingSession = {
        id: 'sess-empty-zero',
        t0_ms: 100,
        tEnd_ms: 100,
        duration_ms: 0,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events: [],
        stats: {
          totalEvents: 0,
          durationMs: 0,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date().toISOString(),
        },
      };

      const adapted = adaptObservedSessionToSceneGraph(emptySession);
      const validatedSG = SceneGraphSchema.parse(adapted.sceneGraph);
      assert.ok(validatedSG.cameraTrack.length > 0);
      assert.ok(validatedSG.cursorTrack.length > 0);
      assert.ok(validatedSG.audioTrack.length > 0);
    });

    it('1.7 confirms contract edge case: empty string targetId is normalized to undefined', () => {
      // 1. undefined targetId passes cleanly
      const rawWithUndefinedTargetId: RecordedPointerEvent[] = [
        { id: 't-1', type: 'click', timestampMs: 200, t_ms: 200, timestamp: 200, x: 0.5, y: 0.5, targetId: undefined },
      ];
      const map = synthesizeObservedInteractionMapFromEvents(rawWithUndefinedTargetId, 1000, { fps: 30 });
      assert.ok(InteractionMapSchema.parse(map));

      // 2. empty string targetId ('') is normalized to undefined, passing InteractionMapSchema validation
      const rawWithEmptyTargetId: RecordedPointerEvent[] = [
        { id: 't-2', type: 'click', timestampMs: 200, t_ms: 200, timestamp: 200, x: 0.5, y: 0.5, targetId: '' },
      ];
      const map2 = synthesizeObservedInteractionMapFromEvents(rawWithEmptyTargetId, 1000, { fps: 30 });
      const parsed2 = InteractionMapSchema.parse(map2);
      assert.equal(parsed2.events.find((e) => e.type === 'click')?.targetId, undefined);
    });

    it('1.8 processes wheel and scroll events with extreme deltaY values safely into valid SceneGraph', () => {
      const scrollEvents: RecordedPointerEvent[] = [
        { id: 's-1', type: 'scroll', timestampMs: 100, t_ms: 100, timestamp: 100, x: 0.5, y: 0.5, deltaY: 500 },
        { id: 's-2', type: 'wheel', timestampMs: 200, t_ms: 200, timestamp: 200, x: 0.5, y: 0.5, deltaY: -1000 },
        { id: 's-3', type: 'scroll', timestampMs: 300, t_ms: 300, timestamp: 300, x: 0.5, y: 0.5, deltaY: 0 },
      ];

      const map = synthesizeObservedInteractionMapFromEvents(scrollEvents, 1000, { fps: 30 });
      const validatedMap = InteractionMapSchema.parse(map);
      const scrolls = validatedMap.events.filter((e) => e.type === 'scroll');
      assert.equal(scrolls.length, 3);
      assert.equal(scrolls[0].metadata?.deltaY, 500);
      assert.equal(scrolls[1].metadata?.deltaY, -1000);
      assert.equal(scrolls[2].metadata?.deltaY, 0);

      // Verify SceneGraph adaptation succeeds with scroll events present
      const session: RawRecordingSession = {
        id: 'scroll-sess',
        t0_ms: 0,
        tEnd_ms: 1000,
        duration_ms: 1000,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events: scrollEvents,
        stats: {
          totalEvents: 3,
          durationMs: 1000,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date().toISOString(),
          scrollCount: 3,
        },
      };

      const completed = adaptObservedSessionToSceneGraph(session);
      const validatedSG = SceneGraphSchema.parse(completed.sceneGraph);
      assert.ok(validatedSG.cameraTrack.length > 0);
    });
  });

  // =========================================================================
  // PILLAR 2: High-Frequency Burst Mouse Movements (10,000 events in 100ms)
  // =========================================================================
  describe('2. High-Frequency Burst Stress (10,000 events in 100ms)', () => {
    it('2.1 micro-jitter burst: 10,000 sub-pixel events are downsampled without performance degradation', () => {
      const eventCount = 10_000;
      const durationMs = 100;
      const burstEvents: RecordedPointerEvent[] = new Array(eventCount);

      // Micro-jitter centered at (0.5, 0.5) with delta <= 0.0005 (well below 0.002 dedupeRadius)
      for (let i = 0; i < eventCount; i++) {
        const t = (i / eventCount) * durationMs;
        const angle = i * 0.1;
        burstEvents[i] = {
          id: `burst-jitter-${i}`,
          type: 'move',
          timestampMs: t,
          t_ms: t,
          timestamp: 1000 + t,
          x: 0.5 + Math.sin(angle) * 0.0005,
          y: 0.5 + Math.cos(angle) * 0.0005,
        };
      }

      const tStart = performance.now();
      const map = synthesizeObservedInteractionMapFromEvents(burstEvents, durationMs, {
        fps: 30,
        deduplicateMoveRadius: 0.002,
      });
      const tElapsed = performance.now() - tStart;

      // Performance assertion: 10,000 events synthesized in < 50ms
      assert.ok(
        tElapsed < 100,
        `Telemetry synthesis for 10,000 jitter events took ${tElapsed.toFixed(2)}ms, exceeding 100ms budget`
      );

      // Downsampling assertion: micro-jitter must be radically compressed
      assert.ok(
        map.events.length <= 5,
        `Expected <= 5 events after spatial deduplication, got ${map.events.length}`
      );
      assert.equal(map.events[0].type, 'hover');
    });

    it('2.2 wide-sweep burst: 10,000 spatial movements across screen are processed deterministically', () => {
      const eventCount = 10_000;
      const durationMs = 100;
      const sweepEvents: RecordedPointerEvent[] = new Array(eventCount);

      // Linear diagonal sweep from (0.05, 0.05) to (0.95, 0.95)
      for (let i = 0; i < eventCount; i++) {
        const alpha = i / eventCount;
        const t = alpha * durationMs;
        sweepEvents[i] = {
          id: `burst-sweep-${i}`,
          type: 'move',
          timestampMs: t,
          t_ms: t,
          timestamp: 1000 + t,
          x: 0.05 + alpha * 0.9,
          y: 0.05 + alpha * 0.9,
        };
      }

      const tStart = performance.now();
      const map = synthesizeObservedInteractionMapFromEvents(sweepEvents, durationMs, {
        fps: 30,
        deduplicateMoveRadius: 0.002,
      });
      const tElapsed = performance.now() - tStart;

      assert.ok(
        tElapsed < 150,
        `Telemetry synthesis for 10,000 sweep events took ${tElapsed.toFixed(2)}ms, exceeding 150ms budget`
      );

      // Deduplication compresses diagonal (hypot 1.27) with step ~0.002 into ~500-700 key points
      assert.ok(
        map.events.length < 1000,
        `Expected downsampling to compress 10,000 events to < 1000, got ${map.events.length}`
      );
      assert.ok(map.events.length > 50, `Downsampling should preserve trajectory, got ${map.events.length}`);

      // Verify InteractionMap validity
      const validatedMap = InteractionMapSchema.parse(map);
      assert.equal(validatedMap.events.length, map.events.length);
    });

    it('2.3 adapts 10,000 burst events into complete SceneGraph v2.0 within performance budget', () => {
      const eventCount = 10_000;
      const durationMs = 2000;
      const events: RecordedPointerEvent[] = new Array(eventCount);

      for (let i = 0; i < eventCount; i++) {
        const t = (i / eventCount) * durationMs;
        const isClick = i === 2500 || i === 7500;
        events[i] = {
          id: `evt-${i}`,
          type: isClick ? 'click' : 'move',
          timestampMs: t,
          t_ms: t,
          timestamp: 5000 + t,
          x: CoordinateMapper.clamp01((Math.sin(i * 0.05) + 1) / 2),
          y: CoordinateMapper.clamp01((Math.cos(i * 0.05) + 1) / 2),
        };
      }

      const session: RawRecordingSession = {
        id: 'burst-session-full',
        t0_ms: 5000,
        tEnd_ms: 7000,
        duration_ms: durationMs,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events,
        stats: {
          totalEvents: eventCount,
          durationMs,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date().toISOString(),
          clickCount: 2,
          moveCount: eventCount - 2,
        },
      };

      const tStart = performance.now();
      const completed = adaptObservedSessionToSceneGraph(session);
      const tElapsed = performance.now() - tStart;

      assert.ok(
        tElapsed < 250,
        `Full adaptation of 10,000 events took ${tElapsed.toFixed(2)}ms, exceeding 250ms budget`
      );

      // Validate output
      const validatedSG = SceneGraphSchema.parse(completed.sceneGraph);
      assert.equal(validatedSG.canvas.fps, 30);
      assert.equal(validatedSG.canvas.durationInFrames, 60);

      // Exactly 2 clicks should generate click SFX cues
      const clickCues = validatedSG.audioTrack.filter((c) => c.asset === 'mouse-click');
      assert.equal(clickCues.length, 2);
    });

    it('2.4 strict mathematical determinism: 10 identical runs produce bitwise identical output', () => {
      const eventCount = 1_000;
      const durationMs = 1500;
      const events: RecordedPointerEvent[] = new Array(eventCount);

      for (let i = 0; i < eventCount; i++) {
        const t = (i / eventCount) * durationMs;
        events[i] = {
          id: `det-${i}`,
          type: i % 250 === 0 ? 'click' : 'move',
          timestampMs: t,
          t_ms: t,
          timestamp: 1000 + t,
          x: Number(((Math.sin(i) + 1) / 2).toFixed(6)),
          y: Number(((Math.cos(i) + 1) / 2).toFixed(6)),
        };
      }

      const session: RawRecordingSession = {
        id: 'det-session',
        t0_ms: 1000,
        tEnd_ms: 2500,
        duration_ms: durationMs,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events,
        stats: {
          totalEvents: eventCount,
          durationMs,
          resolution: { width: 1920, height: 1080 },
          recordedAt: '2026-11-01T00:00:00.000Z',
        },
      };

      const baseline = JSON.stringify(adaptObservedSessionToSceneGraph(session).sceneGraph);

      for (let run = 1; run <= 10; run++) {
        const current = JSON.stringify(adaptObservedSessionToSceneGraph(session).sceneGraph);
        assert.equal(
          current,
          baseline,
          `Run ${run} deviated from baseline deterministic output`
        );
      }
    });

    it('2.5 memory leak verification: repeated 10,000 burst cycles maintain stable heap', () => {
      const eventCount = 10_000;
      const durationMs = 100;
      const burstEvents: RecordedPointerEvent[] = new Array(eventCount);

      for (let i = 0; i < eventCount; i++) {
        const t = (i / eventCount) * durationMs;
        burstEvents[i] = {
          id: `mem-${i}`,
          type: 'move',
          timestampMs: t,
          t_ms: t,
          timestamp: 1000 + t,
          x: 0.1 + (i / eventCount) * 0.8,
          y: 0.1 + (i / eventCount) * 0.8,
        };
      }

      // Warmup run
      synthesizeObservedInteractionMapFromEvents(burstEvents, durationMs);

      const memInitial = process.memoryUsage().heapUsed;

      // Execute 25 consecutive burst syntheses
      for (let i = 0; i < 25; i++) {
        const map = synthesizeObservedInteractionMapFromEvents(burstEvents, durationMs);
        assert.ok(map.events.length > 0);
      }

      const memFinal = process.memoryUsage().heapUsed;
      const heapDeltaMb = (memFinal - memInitial) / (1024 * 1024);

      // Heap should not grow uncontrollably (< 35 MB net growth over 25x 10,000 event processing)
      assert.ok(
        heapDeltaMb < 35,
        `Potential memory leak detected: Heap grew by ${heapDeltaMb.toFixed(2)} MB over 25 burst cycles`
      );
    });

    it('2.6 handles 1,000 rapid clicks at identical timestamp without ID collision or quadratic explosion', () => {
      const clickCount = 1_000;
      const spamClicks: RecordedPointerEvent[] = new Array(clickCount);
      for (let i = 0; i < clickCount; i++) {
        spamClicks[i] = {
          id: `click-spam-${i}`,
          type: 'click',
          timestampMs: 500,
          t_ms: 500,
          timestamp: 1500,
          x: 0.5,
          y: 0.5,
        };
      }

      const tStart = performance.now();
      const map = synthesizeObservedInteractionMapFromEvents(spamClicks, 2000, { fps: 30 });
      const tElapsed = performance.now() - tStart;

      assert.ok(tElapsed < 100, `Synthesizing 1000 simultaneous clicks took ${tElapsed.toFixed(2)}ms, exceeding 100ms budget`);
      assert.equal(map.events.length, clickCount);

      // Verify all synthesized IDs are unique
      const idSet = new Set(map.events.map((e) => e.id));
      assert.equal(idSet.size, clickCount);
    });
  });

  // =========================================================================
  // PILLAR 3: Headless Simulator & Complex Interaction Scenarios
  // =========================================================================
  describe('3. Headless Simulator Complex User Interactions', () => {
    it('3.1 simulates rapid drag-and-drop gesture across 50 discrete waypoints', () => {
      const sim = new HeadlessRecordingSimulator({ fps: 30 });
      sim.start(0);

      // Drag start at (0.2, 0.2)
      sim.moveTo(100, 0.2, 0.2);
      sim.click(150, 0.2, 0.2, { targetTag: 'DIV', targetId: 'draggable-card' });

      // Rapid drag path: 50 steps from (0.2, 0.2) to (0.8, 0.7) over 300ms
      const dragSteps = 50;
      for (let s = 1; s <= dragSteps; s++) {
        const alpha = s / dragSteps;
        const t = 150 + alpha * 300;
        const x = 0.2 + alpha * 0.6;
        const y = 0.2 + alpha * 0.5;
        sim.moveTo(Math.round(t), x, y);
      }

      // Drag drop release
      sim.click(480, 0.8, 0.7, { targetTag: 'DIV', targetId: 'drop-zone' });
      const session = sim.stop(600);

      assert.equal(session.events.length, 53);
      assert.equal(session.stats.clickCount, 2);
      assert.equal(session.stats.moveCount, 51);

      // Synthesize and verify
      const map = synthesizeObservedInteractionMap(session);
      const validatedMap = InteractionMapSchema.parse(map);
      assert.ok(validatedMap.events.length >= 2);

      const adapted = adaptObservedSessionToSceneGraph(session);
      assert.ok(adapted.sceneGraph.cameraTrack.length >= 2);
      assert.ok(adapted.sceneGraph.cursorTrack.length >= 2);
    });

    it('3.2 simulates rapid double-click spam (5ms delta, same coordinates)', () => {
      const sim = new HeadlessRecordingSimulator({ fps: 30 });
      sim.start(0);
      sim.moveTo(400, 0.45, 0.55);
      // Double click
      sim.click(500, 0.45, 0.55, { targetTag: 'BUTTON', targetId: 'btn-double', textSnippet: 'Open' });
      sim.click(505, 0.45, 0.55, { targetTag: 'BUTTON', targetId: 'btn-double', textSnippet: 'Open' });
      const session = sim.stop(1000);

      assert.equal(session.stats.clickCount, 2);
      const clickEvts = session.events.filter((e) => e.type === 'click');
      assert.notEqual(clickEvts[0].id, clickEvts[1].id, 'Click IDs must be unique');

      const map = synthesizeObservedInteractionMap(session);
      const mapClicks = map.events.filter((e) => e.type === 'click');
      assert.equal(mapClicks.length, 2, 'InteractionMap must retain both clicks');

      // Both clicks must produce unique IDs in InteractionMap
      assert.notEqual(mapClicks[0].id, mapClicks[1].id);

      const completed = adaptObservedSessionToSceneGraph(session);
      const sfxClicks = completed.sceneGraph.audioTrack.filter((a) => a.asset === 'mouse-click');
      assert.equal(sfxClicks.length, 2, 'Audio track must contain SFX cues for both clicks');
    });

    it('3.3 simulates pause and resume with quiescent gap triggering camera pullback', () => {
      const sim = new HeadlessRecordingSimulator({ fps: 30 });
      sim.start(0);

      // Action 1: Click at top-left
      sim.moveTo(200, 0.15, 0.15);
      sim.click(400, 0.15, 0.15);

      // Quiescent Pause: 3,000ms idle gap
      sim.pause(3000);

      // Action 2: Click at bottom-right after pause
      sim.moveTo(3600, 0.85, 0.85);
      sim.click(3800, 0.85, 0.85);
      const session = sim.stop(4500);

      assert.equal(session.duration_ms, 4500);

      const completed = adaptObservedSessionToSceneGraph(session);
      const cameraTrack = completed.sceneGraph.cameraTrack;

      // Because the quiescent gap between actions is 3000ms (~90 frames > 30),
      // the adapter must insert an overview return keyframe (zoom 1.0 at center 0.5, 0.5)
      const hasOverviewReturn = cameraTrack.some(
        (kf) => kf.frame > 20 && kf.frame < 100 && Math.abs(kf.zoom - 1.0) < 0.05 && Math.abs(kf.x - 0.5) < 0.05
      );

      assert.ok(
        hasOverviewReturn,
        'Camera engine must insert overview pullback during long quiescent pause gap'
      );
    });

    it('3.4 simulator rejects time regression and handles negative pause durations safely', () => {
      const sim = new HeadlessRecordingSimulator();
      sim.start(1000);

      // Calling pause with negative duration should not rewind time
      sim.pause(-500);
      sim.moveTo(800, 0.3, 0.3); // Attempting to pass time earlier than t0
      const session = sim.stop();

      assert.ok(session.events[0].timestampMs >= 0, 'timestampMs must remain non-negative');
      assert.ok(session.duration_ms >= 0, 'duration_ms must remain non-negative');
    });

    it('3.5 simulator throws helpful errors if interaction methods are called before start()', () => {
      const sim = new HeadlessRecordingSimulator();
      assert.throws(() => sim.moveTo(100, 0.5, 0.5), /Simulator is not started/);
      assert.throws(() => sim.click(100, 0.5, 0.5), /Simulator is not started/);
      assert.throws(() => sim.scroll(100, 50), /Simulator is not started/);
      assert.throws(() => sim.pause(100), /Simulator is not started/);
      assert.throws(() => sim.stop(), /Simulator is not started/);
    });

    it('3.6 MouseTracker lifecycle invariants: idempotent start and stop in SSR/headless', () => {
      const tracker = new MouseTracker({ throttleMs: 16 });

      // Multiple start calls should not throw or duplicate listeners
      tracker.start(0);
      tracker.start(100);

      // Multiple stop calls should be idempotent
      const events1 = tracker.stop();
      const events2 = tracker.stop();

      assert.deepEqual(events1, []);
      assert.deepEqual(events2, []);
    });
  });

  // =========================================================================
  // PILLAR 4: Spline Interpolation, Bezier & Downstream SceneGraph Robustness
  // =========================================================================
  describe('4. Spline Interpolation & SceneGraph Robustness', () => {
    it('4.1 Bezier control points remain strictly confined within [0.05, 0.95] canvas bounds', () => {
      // Test movements across all four corners: (0,0) -> (1,1), (0,1) -> (1,0), etc.
      const cornerMovements: RecordedPointerEvent[] = [
        { id: 'c1', type: 'move', timestampMs: 100, t_ms: 100, timestamp: 100, x: 0.0, y: 0.0 },
        { id: 'c2', type: 'move', timestampMs: 600, t_ms: 600, timestamp: 600, x: 1.0, y: 1.0 },
        { id: 'c3', type: 'move', timestampMs: 1100, t_ms: 1100, timestamp: 1100, x: 0.0, y: 1.0 },
        { id: 'c4', type: 'move', timestampMs: 1600, t_ms: 1600, timestamp: 1600, x: 1.0, y: 0.0 },
      ];

      const map = synthesizeObservedInteractionMapFromEvents(cornerMovements, 2000, { fps: 30 });
      assert.ok(map.events.length >= 2);
      const completed = adaptObservedSessionToSceneGraph({
        id: 'corner-sess',
        t0_ms: 0,
        tEnd_ms: 2000,
        duration_ms: 2000,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events: cornerMovements,
        stats: {
          totalEvents: 4,
          durationMs: 2000,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date().toISOString(),
        },
      });

      for (const kf of completed.sceneGraph.cursorTrack) {
        if (kf.controlX !== undefined) {
          assert.ok(
            kf.controlX >= 0.05 && kf.controlX <= 0.95,
            `Bezier controlX ${kf.controlX} out of bounds [0.05, 0.95]`
          );
        }
        if (kf.controlY !== undefined) {
          assert.ok(
            kf.controlY >= 0.05 && kf.controlY <= 0.95,
            `Bezier controlY ${kf.controlY} out of bounds [0.05, 0.95]`
          );
        }
      }
    });

    it('4.2 100% Observed Provenance invariant holds strictly across all stress-generated events', () => {
      const sim = new HeadlessRecordingSimulator({ fps: 60 });
      sim.start(0);

      // Generate 20 diverse events: moves, clicks, scrolls
      for (let i = 0; i < 20; i++) {
        const t = (i + 1) * 100;
        if (i % 4 === 0) {
          sim.click(t, (i * 0.04) % 1.0, ((i + 2) * 0.04) % 1.0);
        } else if (i % 5 === 0) {
          sim.scroll(t, 200);
        } else {
          sim.moveTo(t, (i * 0.05) % 1.0, ((i + 1) * 0.05) % 1.0);
        }
      }

      const session = sim.stop(2500);
      const map = synthesizeObservedInteractionMap(session, { fps: 60 });

      assert.ok(map.events.length >= 15);
      for (const evt of map.events) {
        assert.equal(
          evt.provenance,
          'observed',
          `Event ${evt.id} has illegal provenance '${evt.provenance}'. Only 'observed' is permitted.`
        );
      }
    });
  });
});
