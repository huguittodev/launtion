/**
 * tests/adversarial-screen-recorder.test.ts
 *
 * Empirical Adversarial Verification Suite for Phase 6: Screen Recorder Module & Observed Telemetry.
 * Specifically probes:
 * 1. MediaStream and MediaRecorder lifecycle failure modes (aborts, unexpected track ends, error events, track leaks).
 * 2. Zero-event recordings (immediate start/stop, zero telemetry events, NaN/Infinity safety).
 * 3. Long recording duration handling (1-hour simulation, 108,000 frames, memory and boundary constraints).
 * 4. Blob creation, MIME type negotiation, and container mismatch across codecs (WebM, MP4).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  StreamRecorder,
  resolveOptimalMimeType,
  synthesizeObservedInteractionMapFromEvents,
  adaptObservedSessionToSceneGraph,
} from '../src/lib/recorder';
import {
  RawRecordingSessionSchema,
  StreamRecorderOptionsSchema,
} from '../src/lib/recorder/schema';
import { InteractionMapSchema } from '../src/lib/interaction-map/schema';
import { SceneGraphSchema } from '../src/lib/scene-graph/schema';
import type {
  RawRecordingSession,
  RecordedPointerEvent,
} from '../src/lib/recorder/types';

// =============================================================================
// MOCK HARNESS FOR W3C MEDIASTREAM & MEDIARECORDER LIFECYCLE
// =============================================================================

class MockMediaStreamTrack extends EventTarget {
  kind: string;
  readyState: 'live' | 'ended' = 'live';
  stopped = false;

  constructor(kind = 'video') {
    super();
    this.kind = kind;
  }

  getSettings() {
    return { width: 1920, height: 1080, frameRate: 30 };
  }

  stop() {
    this.stopped = true;
    this.readyState = 'ended';
    this.dispatchEvent(new Event('ended'));
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[];

  constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack('video')]) {
    this.tracks = tracks;
  }

  getTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }

  getVideoTracks(): MockMediaStreamTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }
}

interface MockMediaRecorderOptions {
  mimeType?: string;
  videoBitsPerSecond?: number;
}

class MockMediaRecorder extends EventTarget {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: MockMediaStream;
  mimeType: string;
  videoBitsPerSecond?: number;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  static supportedMimes = new Set<string>([
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1',
    'video/mp4',
  ]);

  static isTypeSupported(mime: string): boolean {
    return MockMediaRecorder.supportedMimes.has(mime);
  }

  constructor(stream: MockMediaStream, options?: MockMediaRecorderOptions) {
    super();
    this.stream = stream;
    this.mimeType = options?.mimeType || 'video/webm';
    this.videoBitsPerSecond = options?.videoBitsPerSecond;
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    if (this.onstop) {
      this.onstop(new Event('stop'));
    }
  }

  emitChunk(chunk: Blob) {
    if (this.ondataavailable) {
      this.ondataavailable({ data: chunk });
    }
  }
}

function setupBrowserMocks(customGetDisplayMedia?: () => Promise<MockMediaStream>) {
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;

  const mockTrack = new MockMediaStreamTrack('video');
  const mockStream = new MockMediaStream([mockTrack]);

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: {
        getDisplayMedia: customGetDisplayMedia ?? (async () => mockStream),
      },
    },
    configurable: true,
    writable: true,
  });

  (globalThis as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

  const cleanup = () => {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    } else {
      delete (globalThis as Record<string, unknown>).navigator;
    }
    (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
  };

  return { cleanup, mockTrack, mockStream };
}

// =============================================================================
// CHALLENGE SUITE
// =============================================================================

describe('Adversarial Challenge Phase 6: Screen Recorder & Stream Lifecycle', () => {
  // ===========================================================================
  // CHALLENGE 1: MediaStream Failure Modes & Lifecycle
  // ===========================================================================
  describe('Challenge 1: MediaStream Failure Modes & Lifecycle in StreamRecorder', () => {
    it('1.1 handles user permission cancellation (NotAllowedError) cleanly without recording active', async () => {
      const { cleanup } = setupBrowserMocks(async () => {
        const err = new Error('Permission denied');
        err.name = 'NotAllowedError';
        throw err;
      });

      try {
        const recorder = new StreamRecorder();
        await assert.rejects(
          async () => {
            await recorder.start();
          },
          /Permiso denegado o selección de pantalla cancelada\./
        );

        assert.equal(recorder.isRecording(), false);
        // Calling stop after failed start should be safe
        const stopResult = await recorder.stop();
        assert.equal(stopResult.videoBlob.size, 0);
        assert.equal(stopResult.duration_ms, 0);
      } finally {
        cleanup();
      }
    });

    it('1.2 handles unexpected stream abortion before start completes (AbortError)', async () => {
      const { cleanup } = setupBrowserMocks(async () => {
        const err = new Error('Display surface capture aborted');
        err.name = 'AbortError';
        throw err;
      });

      try {
        const recorder = new StreamRecorder();
        await assert.rejects(
          async () => {
            await recorder.start();
          },
          /Display surface capture aborted/
        );
        assert.equal(recorder.isRecording(), false);
      } finally {
        cleanup();
      }
    });

    it('1.3 Track ending unexpectedly (browser "Stop sharing" bar) calculates non-zero duration_ms and validates schema', async () => {
      const { cleanup, mockTrack } = setupBrowserMocks();

      try {
        let streamEndedCallbackFired = false;
        const recorder = new StreamRecorder();

        await recorder.start(() => {
          streamEndedCallbackFired = true;
        });

        assert.equal(recorder.isRecording(), true);

        // Simulate 200ms passing
        await new Promise((r) => setTimeout(r, 100));

        // When user clicks native browser "Stop sharing" floating bar:
        // 1. The video track ends
        // 2. The browser automatically transitions MediaRecorder to 'inactive'
        const rawRecorder = (recorder as unknown as { mediaRecorder: MockMediaRecorder }).mediaRecorder;
        rawRecorder.state = 'inactive';

        // Trigger native track ended event
        mockTrack.stop();
        assert.equal(streamEndedCallbackFired, true);

        // Consumer responds to onStreamEnded by stopping the recorder
        const stopResult = await recorder.stop();

        // REMEDIATION VERIFICATION:
        // duration_ms must be non-zero and accurately reflect elapsed time (> 50ms)
        assert.ok(
          stopResult.duration_ms >= 50,
          `Remediation verification: duration_ms should be >= 50ms, got ${stopResult.duration_ms}`
        );

        // Consequence verification: RawRecordingSession validation SUCCEEDS with events within duration_ms
        const parsedSession = RawRecordingSessionSchema.parse({
          id: 'sess-after-native-stop',
          t0_ms: 1000,
          tEnd_ms: 1000 + stopResult.duration_ms,
          duration_ms: stopResult.duration_ms,
          viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
          fps: 30,
          events: [
            { id: 'ev1', type: 'click', timestampMs: 30, x: 0.5, y: 0.5 },
          ],
          stats: {
            totalEvents: 1,
            durationMs: stopResult.duration_ms,
            resolution: { width: 1920, height: 1080 },
            recordedAt: new Date().toISOString(),
          },
        });
        assert.equal(parsedSession.id, 'sess-after-native-stop');
      } finally {
        cleanup();
      }
    });

    it('1.4 Synchronous MediaRecorder.stop() exception preserves monotonic duration_ms without 54-year drift', async () => {
      const { cleanup } = setupBrowserMocks();

      try {
        const recorder = new StreamRecorder();
        await recorder.start();

        const rawRecorder = (recorder as unknown as { mediaRecorder: MockMediaRecorder }).mediaRecorder;
        // Force mediaRecorder.stop to throw an error (simulating hardware encoder fault)
        rawRecorder.stop = () => {
          throw new Error('Hardware encoder crashed on stop');
        };

        const stopResult = await recorder.stop();

        // REMEDIATION VERIFICATION:
        // duration_ms must use monotonic time, strictly < 10,000ms, not ~1.7e12ms (54 years)
        assert.ok(
          stopResult.duration_ms >= 0 && stopResult.duration_ms < 10_000,
          `Remediation verification: duration_ms should be reasonable (< 10,000ms), got ${stopResult.duration_ms}`
        );
      } finally {
        cleanup();
      }
    });

    it('1.5 MediaRecorder error event is handled by StreamRecorder', async () => {
      const { cleanup } = setupBrowserMocks();

      try {
        const recorder = new StreamRecorder();
        await recorder.start();

        const rawRecorder = (recorder as unknown as { mediaRecorder: MockMediaRecorder }).mediaRecorder;

        // REMEDIATION VERIFICATION: mediaRecorder.onerror is attached
        assert.ok(rawRecorder.onerror !== null, 'StreamRecorder must attach an onerror listener to MediaRecorder');

        // When an error occurs, error handler marks recording inactive and cleans up
        if (rawRecorder.onerror) {
          rawRecorder.onerror(new Event('error'));
        }
        assert.equal(recorder.isRecording(), false, 'StreamRecorder should transition to not recording on error');
      } finally {
        cleanup();
      }
    });

    it('1.6 Stream cleanup stops all tracks properly during normal stop', async () => {
      const { cleanup, mockTrack } = setupBrowserMocks();

      try {
        const recorder = new StreamRecorder();
        await recorder.start();
        assert.equal(mockTrack.stopped, false);

        await recorder.stop();
        assert.equal(mockTrack.stopped, true, 'StreamRecorder must stop all tracks on stop()');
        assert.equal(recorder.getStream(), null, 'Stream reference must be cleared after stop()');
      } finally {
        cleanup();
      }
    });

    it('1.7 MediaRecorder constructor throwing cleans up stream tracks without leaking', async () => {
      const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;
      const { cleanup, mockTrack } = setupBrowserMocks();

      try {
        // Mock MediaRecorder constructor to throw fatal initialization error
        function FatalMediaRecorder() {
          throw new Error('MediaRecorder fatal initialization error');
        }
        FatalMediaRecorder.isTypeSupported = () => true;

        (globalThis as Record<string, unknown>).MediaRecorder = FatalMediaRecorder;

        const recorder = new StreamRecorder();
        await assert.rejects(
          async () => {
            await recorder.start();
          },
          /MediaRecorder fatal initialization error/
        );

        // REMEDIATION VERIFICATION:
        // Stream tracks must be stopped even if MediaRecorder constructor throws
        assert.equal(
          mockTrack.stopped,
          true,
          'Remediation verification: MediaRecorder constructor exception cleans up stream tracks'
        );
      } finally {
        (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
        cleanup();
      }
    });
  });

  // ===========================================================================
  // CHALLENGE 2: Zero-Event Recordings (Instant Start & Stop)
  // ===========================================================================
  describe('Challenge 2: Zero-Event Recordings & Mathematical Robustness', () => {
    it('2.1 user starts and immediately stops with duration = 0ms and 0 events', () => {
      const rawEvents: RecordedPointerEvent[] = [];
      const durationMs = 0;

      const map = synthesizeObservedInteractionMapFromEvents(rawEvents, durationMs, { fps: 30 });

      // Verifies durationInFrames defaults safely to minimum 30 frames
      assert.equal(map.durationInFrames, 30);
      assert.equal(map.events.length, 1);

      // Verifies fallback event is valid
      const fallback = map.events[0];
      assert.equal(fallback.id, 'obs-initial-overview');
      assert.equal(fallback.type, 'focus');
      assert.equal(fallback.frame, 0);
      assert.equal(fallback.duration, 30);
      assert.equal(fallback.x, 0.5);
      assert.equal(fallback.y, 0.5);
      assert.equal(fallback.provenance, 'observed');

      // Validates against strict Zod InteractionMapSchema
      const validatedMap = InteractionMapSchema.parse(map);
      assert.equal(validatedMap.durationInFrames, 30);
    });

    it('2.2 zero-event session adapts into 100% valid SceneGraph without NaN values', () => {
      const emptySession: RawRecordingSession = {
        id: 'zero-event-sess',
        t0_ms: 1000,
        tEnd_ms: 1000,
        duration_ms: 0,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events: [],
        stats: {
          totalEvents: 0,
          durationMs: 0,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date(1000).toISOString(),
          effectiveFps: 0,
        },
      };

      const result = adaptObservedSessionToSceneGraph(emptySession);

      // Verify no NaN or undefined in summary
      assert.equal(result.summary.eventsCount, 0);
      assert.equal(result.summary.clicksCount, 0);
      assert.equal(result.summary.movesCount, 0);
      assert.equal(result.summary.effectiveFps, 0);
      assert.equal(result.summary.durationInFrames, 30);

      // Verify SceneGraph validity
      const sg = SceneGraphSchema.parse(result.sceneGraph);
      assert.equal(sg.canvas.durationInFrames, 30);
      assert.ok(sg.cameraTrack.length >= 2);
      assert.ok(sg.cursorTrack.length >= 1);
      assert.ok(sg.audioTrack.length >= 1);

      // Check all keyframes for NaN
      for (const kf of sg.cameraTrack) {
        assert.ok(!Number.isNaN(kf.x), 'Camera x cannot be NaN');
        assert.ok(!Number.isNaN(kf.y), 'Camera y cannot be NaN');
        assert.ok(!Number.isNaN(kf.zoom), 'Camera zoom cannot be NaN');
        assert.ok(!Number.isNaN(kf.frame), 'Camera frame cannot be NaN');
      }

      for (const kf of sg.cursorTrack) {
        assert.ok(!Number.isNaN(kf.x), 'Cursor x cannot be NaN');
        assert.ok(!Number.isNaN(kf.y), 'Cursor y cannot be NaN');
        assert.ok(!Number.isNaN(kf.frame), 'Cursor frame cannot be NaN');
      }

      for (const cue of sg.audioTrack) {
        assert.ok(!Number.isNaN(cue.frame), 'Audio cue frame cannot be NaN');
        assert.ok(!Number.isNaN(cue.volume ?? 1), 'Audio cue volume cannot be NaN');
      }
    });

    it('2.3 handles negative and extreme fractional durations safely without throwing', () => {
      const negativeDuration = synthesizeObservedInteractionMapFromEvents([], -500, { fps: 30 });
      assert.equal(negativeDuration.durationInFrames, 30);

      const microDuration = synthesizeObservedInteractionMapFromEvents([], 0.0001, { fps: 60 });
      assert.equal(microDuration.durationInFrames, 30);
    });

    it('2.4 rejects NaN duration at Zod boundary', () => {
      // RawRecordingSessionSchema must reject NaN duration
      assert.throws(
        () => {
          RawRecordingSessionSchema.parse({
            id: 'nan-session',
            t0_ms: 0,
            tEnd_ms: 100,
            duration_ms: NaN,
            viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
            fps: 30,
            events: [],
            stats: {
              totalEvents: 0,
              durationMs: 0,
              resolution: { width: 1920, height: 1080 },
              recordedAt: new Date().toISOString(),
            },
          });
        },
        /NaN/i
      );
    });

    it('2.5 handles scroll-only recording without clicks producing 100% valid SceneGraph', () => {
      const scrollEvents: RecordedPointerEvent[] = [
        { id: 'sc1', type: 'scroll', timestampMs: 200, t_ms: 200, timestamp: 200, x: 0.5, y: 0.5, deltaY: 150 },
        { id: 'sc2', type: 'scroll', timestampMs: 800, t_ms: 800, timestamp: 800, x: 0.5, y: 0.5, deltaY: -80 },
      ];

      const session: RawRecordingSession = {
        id: 'scroll-only-session',
        t0_ms: 0,
        tEnd_ms: 2000,
        duration_ms: 2000,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events: scrollEvents,
        stats: {
          totalEvents: 2,
          durationMs: 2000,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date().toISOString(),
          scrollCount: 2,
        },
      };

      const result = adaptObservedSessionToSceneGraph(session);
      const validatedSg = SceneGraphSchema.parse(result.sceneGraph);

      assert.equal(validatedSg.canvas.durationInFrames, 60);
      assert.ok(validatedSg.cameraTrack.length >= 1);
      assert.ok(validatedSg.cursorTrack.length >= 1);
    });

    it('2.6 micro-jitter only (all movements within dedupe radius) safely preserves observed events', () => {
      const jitterEvents: RecordedPointerEvent[] = [
        { id: 'j1', type: 'move', timestampMs: 100, t_ms: 100, timestamp: 100, x: 0.5, y: 0.5 },
        { id: 'j2', type: 'move', timestampMs: 130, t_ms: 130, timestamp: 130, x: 0.5005, y: 0.5005 },
        { id: 'j3', type: 'move', timestampMs: 160, t_ms: 160, timestamp: 160, x: 0.5008, y: 0.5008 },
      ];

      const map = synthesizeObservedInteractionMapFromEvents(jitterEvents, 1000, {
        fps: 30,
        deduplicateMoveRadius: 0.05,
      });

      assert.ok(map.events.length >= 1);
      assert.ok(map.events.every((e) => e.provenance === 'observed'));
    });
  });

  // ===========================================================================
  // CHALLENGE 3: Long Recording Duration Handling (1-Hour Simulation)
  // ===========================================================================
  describe('Challenge 3: Long Recording Duration Handling (1-Hour Simulation)', () => {
    it('3.1 simulates 1-hour recording (3,600,000 ms, 108,000 frames) with 5,000 events', () => {
      const oneHourMs = 3_600_000;
      const fps = 30;
      const expectedFrames = (oneHourMs / 1000) * fps; // 108,000 frames

      // Generate 5,000 events spaced across 1 hour
      const events: RecordedPointerEvent[] = [];
      const eventCount = 5000;
      const stepMs = oneHourMs / eventCount;

      for (let i = 0; i < eventCount; i++) {
        const t = Math.round(i * stepMs);
        const isClick = i % 25 === 0; // 200 clicks total
        const normX = ((i * 17) % 1000) / 1000;
        const normY = ((i * 31) % 1000) / 1000;

        events.push({
          id: `hour-evt-${i}`,
          type: isClick ? 'click' : 'move',
          timestampMs: t,
          t_ms: t,
          timestamp: 1000 + t,
          x: normX,
          y: normY,
          rawPixelX: Math.round(normX * 1920),
          rawPixelY: Math.round(normY * 1080),
          button: 0,
        });
      }

      const tStart = performance.now();
      const map = synthesizeObservedInteractionMapFromEvents(events, oneHourMs, { fps });
      const synthesisTimeMs = performance.now() - tStart;

      // Synthesis must finish promptly (< 500ms)
      assert.ok(
        synthesisTimeMs < 500,
        `1-hour telemetry synthesis took too long: ${synthesisTimeMs}ms`
      );

      assert.equal(map.durationInFrames, expectedFrames);
      assert.ok(map.events.length > 200);

      // Verify all event frames are strictly bounded within timeline
      for (const evt of map.events) {
        assert.ok(evt.frame >= 0 && evt.frame <= expectedFrames);
        assert.equal(evt.provenance, 'observed');
      }

      // Validates SceneGraph generation for 108,000 frames
      const rawSession: RawRecordingSession = {
        id: 'one-hour-session',
        t0_ms: 0,
        tEnd_ms: oneHourMs,
        duration_ms: oneHourMs,
        viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
        fps: 30,
        events,
        stats: {
          totalEvents: events.length,
          durationMs: oneHourMs,
          resolution: { width: 1920, height: 1080 },
          recordedAt: new Date(0).toISOString(),
          effectiveFps: Number(((events.length / oneHourMs) * 1000).toFixed(2)),
        },
      };

      const completed = adaptObservedSessionToSceneGraph(rawSession);
      assert.equal(completed.sceneGraph.canvas.durationInFrames, expectedFrames);
      assert.ok(completed.sceneGraph.cameraTrack.length > 50);
      assert.ok(completed.sceneGraph.cursorTrack.length > 50);
      assert.ok(completed.sceneGraph.audioTrack.length > 100);

      // Validate strict SceneGraphSchema
      const validatedSg = SceneGraphSchema.parse(completed.sceneGraph);
      assert.equal(validatedSg.canvas.durationInFrames, 108_000);
    });

    it('3.2 StreamRecorderOptionsSchema strictly caps maxDurationSeconds to 300 (5 minutes)', () => {
      // Verify schema enforces 300-second maximum
      assert.throws(
        () => {
          StreamRecorderOptionsSchema.parse({ maxDurationSeconds: 3600 });
        },
        /300/,
        'StreamRecorderOptionsSchema must enforce maxDurationSeconds <= 300'
      );

      const validConfig = StreamRecorderOptionsSchema.parse({ maxDurationSeconds: 180 });
      assert.equal(validConfig.maxDurationSeconds, 180);
    });

    it('3.3 50,000 pointer events stress test completes in < 500ms without stack overflow', () => {
      const count = 50_000;
      const durationMs = 1_800_000; // 30 minutes
      const events: RecordedPointerEvent[] = [];

      for (let i = 0; i < count; i++) {
        const t = Math.round((i / count) * durationMs);
        events.push({
          id: `stress-${i}`,
          type: i % 100 === 0 ? 'click' : 'move',
          timestampMs: t,
          t_ms: t,
          timestamp: t,
          x: ((i * 13) % 1000) / 1000,
          y: ((i * 29) % 1000) / 1000,
          button: 0,
        });
      }

      const t0 = performance.now();
      const map = synthesizeObservedInteractionMapFromEvents(events, durationMs, { fps: 30 });
      const elapsed = performance.now() - t0;

      assert.ok(elapsed < 500, `50,000 events took ${elapsed}ms (expected < 500ms)`);
      assert.equal(map.durationInFrames, 54_000);
    });
  });

  // ===========================================================================
  // CHALLENGE 4: Blob Creation & MIME Type Detection Across Supported Codecs
  // ===========================================================================
  describe('Challenge 4: Blob Creation & MIME Type Resolution Across Codecs', () => {
    it('4.1 resolveOptimalMimeType resolves VP9 when available', () => {
      const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;
      try {
        (globalThis as Record<string, unknown>).MediaRecorder = {
          isTypeSupported: (mime: string) => mime.includes('vp9'),
        };

        const resolved = resolveOptimalMimeType();
        assert.equal(resolved, 'video/webm;codecs=vp9,opus');
      } finally {
        (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
      }
    });

    it('4.2 resolveOptimalMimeType resolves H264 WebM when VP9/VP8 unsupported', () => {
      const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;
      try {
        (globalThis as Record<string, unknown>).MediaRecorder = {
          isTypeSupported: (mime: string) => mime === 'video/webm;codecs=h264',
        };

        const resolved = resolveOptimalMimeType();
        assert.equal(resolved, 'video/webm;codecs=h264');
      } finally {
        (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
      }
    });

    it('4.3 resolveOptimalMimeType falls back to MP4 on Safari macOS/iOS environment', () => {
      const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;
      try {
        // Safari supports MP4 but NOT WebM
        (globalThis as Record<string, unknown>).MediaRecorder = {
          isTypeSupported: (mime: string) => mime.startsWith('video/mp4'),
        };

        const resolved = resolveOptimalMimeType();
        assert.equal(resolved, 'video/mp4;codecs=avc1');
      } finally {
        (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
      }
    });

    it('4.4 Blob creation succeeds with various MIME types', () => {
      const chunk1 = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]); // EBML header
      const chunk2 = new Uint8Array([0x01, 0x02, 0x03, 0x04]);

      const webmBlob = new Blob([chunk1, chunk2], { type: 'video/webm' });
      assert.equal(webmBlob.size, 8);
      assert.equal(webmBlob.type, 'video/webm');

      const mp4Blob = new Blob([chunk1, chunk2], { type: 'video/mp4' });
      assert.equal(mp4Blob.size, 8);
      assert.equal(mp4Blob.type, 'video/mp4');
    });

    it('4.5 StreamRecorder correctly sets videoBlob type to selectedMimeType', async () => {
      const { cleanup } = setupBrowserMocks();

      try {
        const recorder = new StreamRecorder({
          mimeTypePreference: ['video/mp4;codecs=avc1'],
        });

        const startRes = await recorder.start();
        assert.equal(startRes.mimeType, 'video/mp4;codecs=avc1');

        const rawRecorder = (recorder as unknown as { mediaRecorder: MockMediaRecorder }).mediaRecorder;
        rawRecorder.emitChunk(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'video/mp4' }));

        const stopRes = await recorder.stop();
        assert.equal(stopRes.mimeType, 'video/mp4;codecs=avc1');
        assert.equal(stopRes.videoBlob.type, 'video/mp4;codecs=avc1');
        assert.equal(stopRes.videoBlob.size, 4);
      } finally {
        cleanup();
      }
    });

    it('4.6 MediaRecorder.mimeType takes precedence over fallback when selectedMimeType is empty', async () => {
      const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;
      const { cleanup } = setupBrowserMocks();

      try {
        // Emulate browser that defaults to video/mp4 when instantiated without options
        class DefaultMp4Recorder extends MockMediaRecorder {
          constructor(stream: MockMediaStream, options?: MockMediaRecorderOptions) {
            super(stream, options);
            this.mimeType = 'video/mp4';
          }
        }
        DefaultMp4Recorder.supportedMimes = new Set<string>(); // Pretend isTypeSupported returns false for all candidate queries
        DefaultMp4Recorder.isTypeSupported = () => false;

        (globalThis as Record<string, unknown>).MediaRecorder = DefaultMp4Recorder;

        const recorder = new StreamRecorder();
        const startRes = await recorder.start();

        // REMEDIATION VERIFICATION:
        // StreamRecorder respects mediaRecorder.mimeType ('video/mp4') even if selectedMimeType was empty
        assert.equal(startRes.mimeType, 'video/mp4');

        const rawRecorder = (recorder as unknown as { mediaRecorder: MockMediaRecorder }).mediaRecorder;
        assert.equal(rawRecorder.mimeType, 'video/mp4', 'Browser mediaRecorder actually recorded in video/mp4 container');

        const stopRes = await recorder.stop();

        // The Blob is correctly stamped as video/mp4 matching the actual recorded container
        assert.equal(
          stopRes.videoBlob.type,
          'video/mp4',
          'Remediation verification: StreamRecorder correctly tagged MP4 bitstream as video/mp4'
        );
        assert.equal(stopRes.mimeType, 'video/mp4');
      } finally {
        (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
        cleanup();
      }
    });
  });
});
