/**
 * tests/empirical-challenger-remediation.test.ts
 *
 * EMPIRICAL CHALLENGER VERIFICATION HARNESS
 * Rigorous empirical stress-testing for Phase 6 remediation:
 * - CH-01: Native browser "Stop sharing" trigger -> duration_ms > 0 and RawRecordingSessionSchema validation.
 * - CH-02: Synchronous mediaRecorder.stop() failure -> monotonic duration_ms and no 54-year epoch drift.
 * - CH-03: MediaRecorder constructor & start failure -> zero track leaks, complete stream release.
 * - CH-04: Codec negotiation -> mediaRecorder.mimeType precedence and Blob type alignment.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { StreamRecorder } from '../src/lib/recorder/stream-recorder';
import { RawRecordingSessionSchema } from '../src/lib/recorder/schema';
import type { RawRecordingSession } from '../src/lib/recorder/types';

// =============================================================================
// MOCK HARNESS
// =============================================================================

class MockTrack extends EventTarget {
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

class MockStream {
  tracks: MockTrack[];

  constructor(tracks: MockTrack[] = [new MockTrack('video')]) {
    this.tracks = tracks;
  }

  getTracks(): MockTrack[] {
    return this.tracks;
  }

  getVideoTracks(): MockTrack[] {
    return this.tracks.filter((t) => t.kind === 'video');
  }

  getAudioTracks(): MockTrack[] {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
}

interface MockRecorderOptions {
  mimeType?: string;
  videoBitsPerSecond?: number;
}

class BaseMockMediaRecorder extends EventTarget {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  stream: MockStream;
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  static isTypeSupported(): boolean {
    return true;
  }

  constructor(stream: MockStream, options?: MockRecorderOptions) {
    super();
    this.stream = stream;
    this.mimeType = options?.mimeType || 'video/webm';
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

function setupEnvironment(
  customStream?: MockStream,
  customMediaRecorderClass?: typeof BaseMockMediaRecorder
) {
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalMediaRecorder = (globalThis as Record<string, unknown>).MediaRecorder;

  const stream = customStream ?? new MockStream([new MockTrack('video')]);

  Object.defineProperty(globalThis, 'navigator', {
    value: {
      mediaDevices: {
        getDisplayMedia: async () => stream,
      },
    },
    configurable: true,
    writable: true,
  });

  (globalThis as Record<string, unknown>).MediaRecorder = customMediaRecorderClass ?? BaseMockMediaRecorder;

  const cleanup = () => {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    } else {
      delete (globalThis as Record<string, unknown>).navigator;
    }
    (globalThis as Record<string, unknown>).MediaRecorder = originalMediaRecorder;
  };

  return { cleanup, stream };
}

// =============================================================================
// EMPIRICAL CHALLENGER PROBES
// =============================================================================

describe('EMPIRICAL CHALLENGER: Phase 6 Remediation Stress Harness', () => {

  // ---------------------------------------------------------------------------
  // CH-01: Native browser "Stop sharing" trigger
  // ---------------------------------------------------------------------------
  describe('CH-01: Native browser "Stop sharing" trigger & duration accuracy', () => {
    it('Probe 1.1: Native track end sets tEnd_ms, recorder.stop() accurately calculates elapsed duration (>0)', async () => {
      const { cleanup, stream } = setupEnvironment();
      try {
        let callbackFired = false;
        const recorder = new StreamRecorder();
        const startResult = await recorder.start(() => {
          callbackFired = true;
        });

        assert.equal(recorder.isRecording(), true);
        assert.ok(startResult.t0_ms > 0);

        // Wait 120ms
        await new Promise((r) => setTimeout(r, 120));

        // User clicks native browser "Stop sharing" floating bar
        const rawRecorder = (recorder as unknown as { mediaRecorder: BaseMockMediaRecorder }).mediaRecorder;
        rawRecorder.state = 'inactive';
        stream.getVideoTracks()[0].stop();

        assert.equal(callbackFired, true);

        // Now stop the recorder
        const stopResult = await recorder.stop();

        // 1. duration_ms must be strictly > 0 and closely reflect the 120ms elapsed
        assert.ok(
          stopResult.duration_ms >= 100,
          `duration_ms (${stopResult.duration_ms}ms) must be >= 100ms`
        );
        assert.ok(
          stopResult.duration_ms < 500,
          `duration_ms (${stopResult.duration_ms}ms) must be reasonably bounded < 500ms`
        );

        // 2. RawRecordingSessionSchema must parse without error
        const sessionPayload: RawRecordingSession = {
          id: 'probe-1.1-sess',
          t0_ms: startResult.t0_ms,
          tEnd_ms: startResult.t0_ms + stopResult.duration_ms,
          duration_ms: stopResult.duration_ms,
          viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
          fps: 30,
          events: [
            { id: 'ev-1', type: 'move', timestampMs: 30, t_ms: 30, timestamp: 30, x: 0.2, y: 0.3 },
            { id: 'ev-2', type: 'click', timestampMs: 80, t_ms: 80, timestamp: 80, x: 0.5, y: 0.5 },
          ],
          stats: {
            totalEvents: 2,
            durationMs: stopResult.duration_ms,
            resolution: { width: 1920, height: 1080 },
            recordedAt: new Date().toISOString(),
          },
        };

        const parsed = RawRecordingSessionSchema.parse(sessionPayload);
        assert.equal(parsed.duration_ms, stopResult.duration_ms);
        assert.equal(parsed.events.length, 2);
      } finally {
        cleanup();
      }
    });

    it('Probe 1.2: Host delay before recorder.stop() does NOT inflate duration beyond track end', async () => {
      const { cleanup, stream } = setupEnvironment();
      try {
        const recorder = new StreamRecorder();
        await recorder.start();

        // Simulate 80ms recording
        await new Promise((r) => setTimeout(r, 80));

        // Track ends via native browser button
        const rawRecorder = (recorder as unknown as { mediaRecorder: BaseMockMediaRecorder }).mediaRecorder;
        rawRecorder.state = 'inactive';
        stream.getVideoTracks()[0].stop();

        // Simulate a 200ms delay by the host before calling recorder.stop()
        await new Promise((r) => setTimeout(r, 200));

        const stopResult = await recorder.stop();

        // The duration should be locked to track end (~80ms), NOT ~280ms
        assert.ok(
          stopResult.duration_ms >= 60 && stopResult.duration_ms < 200,
          `duration_ms should lock to track end (~80ms), but got ${stopResult.duration_ms}ms`
        );
      } finally {
        cleanup();
      }
    });

    it('Probe 1.3: Immediate track end (0ms) produces valid duration_ms >= 0 without NaN or negative values', async () => {
      const { cleanup, stream } = setupEnvironment();
      try {
        const recorder = new StreamRecorder();
        await recorder.start();

        // Stop track immediately
        const rawRecorder = (recorder as unknown as { mediaRecorder: BaseMockMediaRecorder }).mediaRecorder;
        rawRecorder.state = 'inactive';
        stream.getVideoTracks()[0].stop();

        const stopResult = await recorder.stop();
        assert.ok(!Number.isNaN(stopResult.duration_ms));
        assert.ok(stopResult.duration_ms >= 0);
      } finally {
        cleanup();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // CH-02: Synchronous mediaRecorder.stop() failure
  // ---------------------------------------------------------------------------
  describe('CH-02: Synchronous mediaRecorder.stop() failure & monotonic bounding', () => {
    it('Probe 2.1: Faulty MediaRecorder throwing on stop() never produces 54-year epoch mismatch', async () => {
      const { cleanup } = setupEnvironment();
      try {
        const recorder = new StreamRecorder();
        await recorder.start();

        await new Promise((r) => setTimeout(r, 50));

        const rawRecorder = (recorder as unknown as { mediaRecorder: BaseMockMediaRecorder }).mediaRecorder;
        rawRecorder.stop = () => {
          throw new DOMException('Hardware encoder failed unexpectedly', 'InvalidStateError');
        };

        const stopResult = await recorder.stop();

        // Verification: duration_ms MUST NOT drift into epoch time (1.7e12 ms / 54 years)
        assert.ok(
          stopResult.duration_ms < 10_000,
          `duration_ms must be strictly < 10,000ms, but got ${stopResult.duration_ms}`
        );
        assert.ok(stopResult.duration_ms >= 40, `duration_ms should be >= 40ms, got ${stopResult.duration_ms}`);
        assert.ok(stopResult.mimeType.startsWith('video/webm'), `Expected webm mimeType, got ${stopResult.mimeType}`);
        assert.ok(stopResult.videoBlob instanceof Blob);
      } finally {
        cleanup();
      }
    });

    it('Probe 2.2: Double stop() call after synchronous failure is idempotent and safe', async () => {
      const { cleanup } = setupEnvironment();
      try {
        const recorder = new StreamRecorder();
        await recorder.start();

        const rawRecorder = (recorder as unknown as { mediaRecorder: BaseMockMediaRecorder }).mediaRecorder;
        rawRecorder.stop = () => {
          throw new Error('Fatal stop fault');
        };

        const res1 = await recorder.stop();
        const res2 = await recorder.stop();

        assert.equal(res1.duration_ms, res2.duration_ms);
        assert.equal(recorder.isRecording(), false);
      } finally {
        cleanup();
      }
    });

    it('Probe 2.3: Synchronous stop error with track already ended respects original tEnd_ms', async () => {
      const { cleanup, stream } = setupEnvironment();
      try {
        const recorder = new StreamRecorder();
        await recorder.start();

        await new Promise((r) => setTimeout(r, 70));
        stream.getVideoTracks()[0].stop();

        const rawRecorder = (recorder as unknown as { mediaRecorder: BaseMockMediaRecorder }).mediaRecorder;
        rawRecorder.stop = () => {
          throw new Error('Crashed during stop');
        };

        // Delay 100ms before calling stop()
        await new Promise((r) => setTimeout(r, 100));

        const res = await recorder.stop();
        assert.ok(
          res.duration_ms >= 50 && res.duration_ms < 150,
          `Expected duration locked to track end (~70ms), got ${res.duration_ms}`
        );
      } finally {
        cleanup();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // CH-03: MediaRecorder constructor & start failure
  // ---------------------------------------------------------------------------
  describe('CH-03: MediaRecorder constructor & start failure track leak prevention', () => {
    it('Probe 3.1: Fatal constructor error stops all active video tracks and cleans up stream', async () => {
      class ExplodingMediaRecorder extends BaseMockMediaRecorder {
        constructor() {
          super(new MockStream());
          throw new TypeError('Failed to construct MediaRecorder: Format not supported');
        }
      }

      const mockTrack = new MockTrack('video');
      const mockStream = new MockStream([mockTrack]);

      const { cleanup } = setupEnvironment(mockStream, ExplodingMediaRecorder);
      try {
        const recorder = new StreamRecorder();
        await assert.rejects(
          async () => {
            await recorder.start();
          },
          /Format not supported/
        );

        // Track MUST be stopped immediately
        assert.equal(mockTrack.stopped, true, 'Video track must be stopped on constructor crash');
        assert.equal(mockTrack.readyState, 'ended');
        assert.equal(recorder.getStream(), null, 'Stream reference must be null');
        assert.equal(recorder.isRecording(), false, 'isRecording must be false');
      } finally {
        cleanup();
      }
    });

    it('Probe 3.2: Multi-track stream (video + multiple audio) releases ALL tracks on constructor failure', async () => {
      class ExplodingMediaRecorder extends BaseMockMediaRecorder {
        constructor() {
          super(new MockStream());
          throw new Error('Out of memory');
        }
      }

      const vTrack = new MockTrack('video');
      const aTrack1 = new MockTrack('audio');
      const aTrack2 = new MockTrack('audio');
      const multiStream = new MockStream([vTrack, aTrack1, aTrack2]);

      const { cleanup } = setupEnvironment(multiStream, ExplodingMediaRecorder);
      try {
        const recorder = new StreamRecorder();
        await assert.rejects(async () => {
          await recorder.start();
        });

        assert.equal(vTrack.stopped, true, 'Video track must be stopped');
        assert.equal(aTrack1.stopped, true, 'Audio track 1 must be stopped');
        assert.equal(aTrack2.stopped, true, 'Audio track 2 must be stopped');
        assert.equal(recorder.getStream(), null);
      } finally {
        cleanup();
      }
    });

    it('Probe 3.3: mediaRecorder.start() throwing cleans up stream tracks and resets active state', async () => {
      class FailingStartMediaRecorder extends BaseMockMediaRecorder {
        start() {
          throw new DOMException('Cannot start recording: Device disconnected', 'InvalidStateError');
        }
      }

      const mockTrack = new MockTrack('video');
      const mockStream = new MockStream([mockTrack]);

      const { cleanup } = setupEnvironment(mockStream, FailingStartMediaRecorder);
      try {
        const recorder = new StreamRecorder();
        await assert.rejects(
          async () => {
            await recorder.start();
          },
          /Device disconnected/
        );

        assert.equal(mockTrack.stopped, true, 'Track must be stopped on start() crash');
        assert.equal(recorder.getStream(), null);
        assert.equal(recorder.isRecording(), false);
      } finally {
        cleanup();
      }
    });

    it('Probe 3.4: Asynchronous onerror event stops tracks and marks recording inactive', async () => {
      const mockTrack = new MockTrack('video');
      const mockStream = new MockStream([mockTrack]);

      const { cleanup } = setupEnvironment(mockStream);
      try {
        const recorder = new StreamRecorder();
        await recorder.start();
        assert.equal(recorder.isRecording(), true);

        const rawRecorder = (recorder as unknown as { mediaRecorder: BaseMockMediaRecorder }).mediaRecorder;
        assert.ok(rawRecorder.onerror !== null, 'onerror handler must be attached');

        // Trigger asynchronous error event
        rawRecorder.onerror(new Event('error'));

        assert.equal(recorder.isRecording(), false, 'Recording must become inactive on error');
        assert.equal(mockTrack.stopped, true, 'Stream tracks must be stopped on error');
      } finally {
        cleanup();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // CH-04: Codec negotiation & Blob container matching
  // ---------------------------------------------------------------------------
  describe('CH-04: Codec negotiation & container matching precedence', () => {
    it('Probe 4.1: mediaRecorder.mimeType takes precedence when options had empty candidate match', async () => {
      class H264BrowserRecorder extends BaseMockMediaRecorder {
        constructor(stream: MockStream, options?: MockRecorderOptions) {
          super(stream, options);
          this.mimeType = 'video/mp4;codecs=avc1';
        }
        static isTypeSupported(): boolean {
          return false; // Force resolveOptimalMimeType to return ''
        }
      }

      const { cleanup } = setupEnvironment(undefined, H264BrowserRecorder);
      try {
        const recorder = new StreamRecorder();
        const startResult = await recorder.start();

        // Must report video/mp4;codecs=avc1 from mediaRecorder, NOT empty or default webm
        assert.equal(startResult.mimeType, 'video/mp4;codecs=avc1');

        const rawRecorder = (recorder as unknown as { mediaRecorder: BaseMockMediaRecorder }).mediaRecorder;
        rawRecorder.emitChunk(new Blob([new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])]));

        const stopResult = await recorder.stop();

        // Blob container type MUST match the mediaRecorder.mimeType
        assert.equal(stopResult.mimeType, 'video/mp4;codecs=avc1');
        assert.equal(stopResult.videoBlob.type, 'video/mp4;codecs=avc1');
      } finally {
        cleanup();
      }
    });

    it('Probe 4.2: Codec mismatch override: mediaRecorder.mimeType wins over user preference', async () => {
      class Vp9Recorder extends BaseMockMediaRecorder {
        constructor(stream: MockStream, options?: MockRecorderOptions) {
          super(stream, options);
          this.mimeType = 'video/webm;codecs=vp9,opus';
        }
      }

      const { cleanup } = setupEnvironment(undefined, Vp9Recorder);
      try {
        // User requested mp4, but host recorder created vp9
        const recorder = new StreamRecorder({
          mimeTypePreference: ['video/mp4'],
        });

        const startResult = await recorder.start();
        assert.equal(startResult.mimeType, 'video/webm;codecs=vp9,opus');

        const stopResult = await recorder.stop();
        assert.equal(stopResult.mimeType, 'video/webm;codecs=vp9,opus');
        assert.equal(stopResult.videoBlob.type, 'video/webm;codecs=vp9,opus');
      } finally {
        cleanup();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Deep Edge Stress Probes (Environment edge cases & Synthesizer invariants)
  // ---------------------------------------------------------------------------
  describe('Deep Edge Stress: Environmental Fallbacks & TargetId Contracts', () => {
    it('Probe 5.1: Calling stop() on unstarted recorder is safe, duration_ms is 0, no error', async () => {
      const recorder = new StreamRecorder();
      const res = await recorder.stop();
      assert.equal(res.duration_ms, 0);
      assert.equal(res.videoBlob.size, 0);
      assert.equal(res.mimeType, 'video/webm');
    });

    it('Probe 5.2: Fallback to Date.now() when performance.now is unavailable remains monotonic', async () => {
      const originalPerformance = globalThis.performance;
      try {
        // @ts-expect-error - simulating environment without performance.now
        delete globalThis.performance;

        const { cleanup } = setupEnvironment();
        try {
          const recorder = new StreamRecorder();
          const startRes = await recorder.start();
          assert.ok(startRes.t0_ms > 0);

          await new Promise((r) => setTimeout(r, 60));

          const stopRes = await recorder.stop();
          assert.ok(
            stopRes.duration_ms >= 50 && stopRes.duration_ms < 1000,
            `duration_ms should be >= 50ms using Date.now() fallback, got ${stopRes.duration_ms}`
          );
        } finally {
          cleanup();
        }
      } finally {
        globalThis.performance = originalPerformance;
      }
    });

    it('Probe 5.3: targetId empty string normalization passes strict InteractionEventSchema across all event types', async () => {
      const { synthesizeObservedInteractionMapFromEvents } = await import('../src/lib/recorder');
      const { InteractionMapSchema } = await import('../src/lib/interaction-map/schema');

      const rawEvents = [
        { id: 'ev-focus-test', type: 'click' as const, timestampMs: 500, t_ms: 500, timestamp: 500, x: 0.5, y: 0.5, targetId: '' },
        { id: 'ev-scroll-test', type: 'scroll' as const, timestampMs: 700, t_ms: 700, timestamp: 700, x: 0.5, y: 0.5, targetId: '', deltaY: 200 },
        { id: 'ev-hover-test', type: 'move' as const, timestampMs: 900, t_ms: 900, timestamp: 900, x: 0.7, y: 0.7, targetId: '' },
      ];

      const map = synthesizeObservedInteractionMapFromEvents(rawEvents, 1500, {
        fps: 30,
        minDwellMsForFocus: 100,
      });

      // Validates InteractionMapSchema
      const validated = InteractionMapSchema.parse(map);
      assert.ok(validated.events.length >= 3);

      for (const evt of validated.events) {
        // targetId should NEVER be empty string "", it must be undefined or non-empty string
        assert.notEqual(evt.targetId, '', `Event ${evt.id} has empty string targetId`);
        assert.equal(evt.targetId, undefined);
        assert.equal(evt.provenance, 'observed');
      }
    });
  });
});
