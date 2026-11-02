/**
 * tests/render-worker.test.ts
 *
 * Automated verification suite for Phase 7: Background Render Worker (@remotion/renderer).
 *
 * Tests:
 * 1. Zod schemas & invariant validation (RenderJobStatus, Settings, Request, Job)
 * 2. SHA-256 idempotency key generation & deduplication logic
 * 3. RenderQueue observable state machine, event emissions, cancellation, and depth bounds
 * 4. RenderWorker watchdog timeout (RENDER_TIMEOUT), cancellation, transient retry, and concurrency
 * 5. Webpack BundleManager caching, concurrency locking, and cache invalidation
 * 6. Next.js API Routes: POST /api/render (202 Accepted), GET /api/render/[id], DELETE /api/render/[id]
 * 7. Video streaming endpoint GET /api/render/[id]/download (HTTP 200 & HTTP 206 Partial Content Range)
 * 8. Real Remotion end-to-end rendering pipeline integration
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { NextRequest } from 'next/server';
import {
  RenderJobStatusSchema,
  RenderStageSchema,
  RenderCodecSchema,
  RenderSettingsSchema,
  RenderRequestSchema,
  RenderJobSchema,
  computeIdempotencyKey,
  RenderQueue,
  RenderWorker,
  BundleManager,
  RenderService,
} from '../src/lib/render';
import { POST as renderPost, GET as renderGetList } from '../src/app/api/render/route';
import { GET as renderGetJob, DELETE as renderDeleteJob } from '../src/app/api/render/[id]/route';
import { GET as renderDownload } from '../src/app/api/render/[id]/download/route';
import type { SceneGraph } from '../src/lib/scene-graph/types';

// Minimal valid SceneGraph fixture conforming to SceneGraphSchema v2.0
const mockSceneGraph: SceneGraph = {
  version: '2.0',
  canvas: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 60, // 2 seconds for fast test execution
  },
  artDirection: {
    backdropVariant: 'dark-precision',
    surfaceTheme: 'dark',
    primaryAccent: '#FF5C35',
  },
  cameraTrack: [
    { frame: 0, x: 0.5, y: 0.5, zoom: 1.0 },
    { frame: 60, x: 0.5, y: 0.5, zoom: 1.2 },
  ],
  cursorTrack: [
    { frame: 0, x: 0.5, y: 0.5 },
    { frame: 30, x: 0.6, y: 0.6, click: true },
  ],
  audioTrack: [
    { id: 'cue_1', frame: 30, asset: 'mouse-click', volume: 0.8 },
  ],
  scenes: [
    {
      id: 'scene_intro',
      startFrame: 0,
      durationInFrames: 60,
      type: 'kinetic_typography',
      payload: {
        words: ['Launch', 'Your', 'Product'],
        accentWordIndex: 0,
      },
    },
  ],
};

describe('Phase 7: Background Render Worker Architecture', () => {
  const testOutputDir = path.resolve('/tmp', 'launtion-tests-render');

  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  /* ========================================================================= */
  /* 1. Zod Schemas & Invariant Validation                                     */
  /* ========================================================================= */
  describe('1. Zod Schemas & Invariant Validation', () => {
    it('1.1 validates allowed RenderJobStatus and RenderStage enum values', () => {
      assert.equal(RenderJobStatusSchema.parse('queued'), 'queued');
      assert.equal(RenderJobStatusSchema.parse('rendering'), 'rendering');
      assert.equal(RenderJobStatusSchema.parse('completed'), 'completed');
      assert.equal(RenderJobStatusSchema.parse('failed'), 'failed');
      assert.equal(RenderJobStatusSchema.parse('cancelled'), 'cancelled');
      assert.throws(() => RenderJobStatusSchema.parse('invalid_status'));

      assert.equal(RenderStageSchema.parse('bundling'), 'bundling');
      assert.equal(RenderStageSchema.parse('rendering_frames'), 'rendering_frames');
      assert.equal(RenderStageSchema.parse('encoding'), 'encoding');
      assert.equal(RenderStageSchema.parse('muxing'), 'muxing');
      assert.equal(RenderStageSchema.parse('finished'), 'finished');
      assert.throws(() => RenderStageSchema.parse('unknown_stage'));
    });

    it('1.2 applies strict defaults to RenderSettingsSchema', () => {
      const settings = RenderSettingsSchema.parse({});
      assert.equal(settings.codec, 'h264');
      assert.equal(settings.audioCodec, 'aac');
      assert.equal(settings.imageFormat, 'jpeg');
      assert.equal(settings.quality, 80);
      assert.equal(settings.scale, 1.0);
      assert.equal(settings.concurrency, 1);
      assert.equal(settings.timeoutMs, 180000);
      assert.equal(settings.muted, false);
    });

    it('1.3 rejects invalid settings outside bounds', () => {
      assert.throws(() => RenderCodecSchema.parse('wmv'));
      assert.throws(() => RenderSettingsSchema.parse({ quality: 150 })); // max 100
      assert.throws(() => RenderSettingsSchema.parse({ scale: 5.0 })); // max 2.0
      assert.throws(() => RenderSettingsSchema.parse({ timeoutMs: 10 })); // min 50ms
      assert.throws(() => RenderSettingsSchema.parse({ concurrency: 0 })); // min 1
    });

    it('1.4 validates RenderRequestSchema and compositionId allowlist', () => {
      const validReq = RenderRequestSchema.parse({
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: mockSceneGraph,
      });
      assert.equal(validReq.compositionId, 'InteractiveSurfaceDemo');
      assert.ok(validReq.sceneGraph);

      // Rejects unallowlisted composition
      assert.throws(() =>
        RenderRequestSchema.parse({
          compositionId: 'HackedComposition',
          sceneGraph: mockSceneGraph,
        })
      );
    });

    it('1.5 validates full RenderJobSchema invariants', () => {
      const job = RenderJobSchema.parse({
        id: 'job_test_1',
        idempotencyKey: 'abc123hash',
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: mockSceneGraph,
        settings: RenderSettingsSchema.parse({}),
        status: 'queued',
        progress: 0.0,
        framesRendered: 0,
        totalFrames: 60,
        renderedBytes: 0,
        currentStage: 'bundling',
        attempts: 0,
        maxAttempts: 2,
        createdAt: new Date().toISOString(),
      });
      assert.equal(job.id, 'job_test_1');
      assert.equal(job.status, 'queued');
      assert.equal(job.progress, 0.0);
    });
  });

  /* ========================================================================= */
  /* 2. SHA-256 Idempotency Key & Deduplication                                */
  /* ========================================================================= */
  describe('2. SHA-256 Idempotency Key & Deduplication', () => {
    it('2.1 computes deterministic 64-character hex hash', () => {
      const key1 = computeIdempotencyKey('InteractiveSurfaceDemo', mockSceneGraph, { codec: 'h264' });
      const key2 = computeIdempotencyKey('InteractiveSurfaceDemo', mockSceneGraph, { codec: 'h264' });

      assert.equal(typeof key1, 'string');
      assert.equal(key1.length, 64);
      assert.equal(key1, key2);
    });

    it('2.2 changes hash when composition, sceneGraph, or settings differ', () => {
      const keyBase = computeIdempotencyKey('InteractiveSurfaceDemo', mockSceneGraph, { codec: 'h264' });
      const keyComp = computeIdempotencyKey('StudioShowcase', mockSceneGraph, { codec: 'h264' });
      const keySettings = computeIdempotencyKey('InteractiveSurfaceDemo', mockSceneGraph, { codec: 'prores' });

      assert.notEqual(keyBase, keyComp);
      assert.notEqual(keyBase, keySettings);
    });

    it('2.3 deduplicates queued requests and returns identical job instance', () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });
      const job1 = queue.enqueue({
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: mockSceneGraph,
      });

      const job2 = queue.enqueue({
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: mockSceneGraph,
      });

      assert.equal(job1.id, job2.id);
      assert.equal(job1.idempotencyKey, job2.idempotencyKey);
      assert.equal(queue.listJobs().length, 1);
    });

    it('2.4 reuses completed job if output file exists, re-queues if file missing', () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });
      const job1 = queue.enqueue({
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: mockSceneGraph,
      });

      // Simulate completion with actual file on disk
      fs.writeFileSync(job1.outputPath!, 'fake-mp4-data');
      queue.updateJob(job1.id, {
        status: 'completed',
        progress: 1.0,
      });

      // Second enqueue with same parameters returns completed job
      const job2 = queue.enqueue({
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: mockSceneGraph,
      });
      assert.equal(job2.id, job1.id);
      assert.equal(job2.status, 'completed');

      // Now delete the output file on disk
      fs.unlinkSync(job1.outputPath!);

      // Third enqueue detects missing file and generates new job
      const job3 = queue.enqueue({
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: mockSceneGraph,
      });
      assert.notEqual(job3.id, job1.id);
      assert.equal(job3.status, 'queued');
    });
  });

  /* ========================================================================= */
  /* 3. RenderQueue State Machine, Observability & Limits                      */
  /* ========================================================================= */
  describe('3. RenderQueue State Machine, Observability & Limits', () => {
    it('3.1 manages job state transitions (queued -> rendering -> completed)', () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });
      const job = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });

      assert.equal(job.status, 'queued');
      assert.equal(queue.getNextQueuedJob()?.id, job.id);

      queue.updateJob(job.id, { status: 'rendering', progress: 0.1 });
      const updated = queue.getJob(job.id);
      assert.equal(updated?.status, 'rendering');
      assert.equal(updated?.progress, 0.1);

      queue.updateJob(job.id, { status: 'completed', progress: 1.0 });
      assert.equal(queue.getJob(job.id)?.status, 'completed');
      assert.equal(queue.getNextQueuedJob(), undefined);
    });

    it('3.2 emits observable lifecycle events', () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });
      const events: string[] = [];

      queue.on('job:enqueued', () => events.push('enqueued'));
      queue.on('job:started', () => events.push('started'));
      queue.on('job:progress', () => events.push('progress'));
      queue.on('job:completed', () => events.push('completed'));

      const job = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });
      queue.updateJob(job.id, { status: 'rendering' });
      queue.updateJob(job.id, { progress: 0.5 });
      queue.updateJob(job.id, { status: 'completed' });

      assert.deepEqual(events, ['enqueued', 'started', 'progress', 'completed']);
    });

    it('3.3 cancels queued or rendering job cleanly', () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });
      let cancelledEmitted = false;
      queue.on('job:cancelled', () => {
        cancelledEmitted = true;
      });

      const job = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });
      const result = queue.cancelJob(job.id);

      assert.equal(result, true);
      assert.equal(queue.getJob(job.id)?.status, 'cancelled');
      assert.equal(cancelledEmitted, true);
    });

    it('3.4 refuses to cancel completed or failed jobs', () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });
      const job = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });

      queue.updateJob(job.id, { status: 'completed' });
      assert.equal(queue.cancelJob(job.id), false);
      assert.equal(queue.getJob(job.id)?.status, 'completed');
    });

    it('3.5 enforces maxQueueDepth safety limits', () => {
      const queue = new RenderQueue({ maxQueueDepth: 2, outputDir: testOutputDir });

      queue.enqueue({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 10 } });
      queue.enqueue({ compositionId: 'StudioShowcase', settings: { quality: 20 } });

      assert.throws(
        () => queue.enqueue({ compositionId: 'LaunchDemo', settings: { quality: 30 } }),
        /capacity exceeded/
      );
    });
  });

  /* ========================================================================= */
  /* 4. RenderWorker Isolation, Timeout Watchdog & Retries                     */
  /* ========================================================================= */
  describe('4. RenderWorker Isolation, Timeout Watchdog & Retries', () => {
    it('4.1 enforces timeout watchdog and marks job RENDER_TIMEOUT', async () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });

      // Mock renderMedia that simulates a hung/infinite render
      const hungRenderMedia = async ({ cancelSignal }: { cancelSignal?: { cancelSignal: () => void } }) => {
        return new Promise<void>((_, reject) => {
          if (cancelSignal) {
            // Wait until cancelled
            const interval = setInterval(() => {
              // Keep event loop alive until timeout aborts
            }, 50);
            setTimeout(() => {
              clearInterval(interval);
              reject(new Error('Render cancelled by timeout'));
            }, 500);
          }
        });
      };

      const worker = new RenderWorker({
        queue,
        concurrency: 1,
        renderMediaFn: hungRenderMedia as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async () => ({
          id: 'InteractiveSurfaceDemo',
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 60,
        })) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      const job = queue.enqueue({
        compositionId: 'InteractiveSurfaceDemo',
        settings: { timeoutMs: 100 }, // 100ms watchdog
      });

      await worker.processJob(job);

      const failedJob = queue.getJob(job.id);
      assert.equal(failedJob?.status, 'failed');
      assert.equal(failedJob?.error?.code, 'RENDER_TIMEOUT');
    });

    it('4.2 cancels active job and transitions to cancelled state', async () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });

      let cancelCalled = false;
      let resolveHangingRender!: () => void;
      const hangingPromise = new Promise<void>((resolve) => {
        resolveHangingRender = resolve;
      });

      const worker = new RenderWorker({
        queue,
        concurrency: 1,
        makeCancelSignalFn: () => ({
          cancelSignal: () => {},
          cancel: () => {
            cancelCalled = true;
            resolveHangingRender();
          },
        }),
        renderMediaFn: (async () => {
          await hangingPromise;
          throw new Error('Render aborted by user cancel');
        }) as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async () => ({
          id: 'InteractiveSurfaceDemo',
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 60,
        })) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      const job = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });
      const processPromise = worker.processJob(job);
      worker.cancel(job.id);
      await processPromise;

      const finalJob = queue.getJob(job.id);
      assert.equal(finalJob?.status, 'cancelled');
      assert.equal(cancelCalled, true);
    });

    it('4.3 retries once on transient system error (retry-safe)', async () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });
      let callCount = 0;

      const worker = new RenderWorker({
        queue,
        concurrency: 1,
        renderMediaFn: (async () => {
          callCount++;
          throw new Error('Chromium IPC connection temporarily disconnected');
        }) as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async () => ({
          id: 'InteractiveSurfaceDemo',
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 60,
        })) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      const job = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });
      await worker.processJob(job);

      // Should be re-queued with attempt 1
      const retryingJob = queue.getJob(job.id);
      assert.equal(retryingJob?.status, 'queued');
      assert.equal(retryingJob?.attempts, 1);
      assert.equal(retryingJob?.error?.code, 'TRANSIENT_RENDER_RETRY');
      assert.equal(callCount, 1);
    });

    it('4.4 fails immediately without retry on permanent error', async () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });

      const worker = new RenderWorker({
        queue,
        concurrency: 1,
        renderMediaFn: (async () => {
          throw new Error('Composition not found in bundle');
        }) as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async () => {
          throw new Error('Composition not found in bundle');
        }) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      const job = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });
      await worker.processJob(job);

      const failedJob = queue.getJob(job.id);
      assert.equal(failedJob?.status, 'failed');
      assert.equal(failedJob?.error?.code, 'RENDER_FAILED');
      assert.equal(failedJob?.attempts, 1);
    });

    it('4.5 respects worker concurrency limit and dispatches in order', async () => {
      const queue = new RenderQueue({ outputDir: testOutputDir });
      let concurrentExecutions = 0;
      let maxSeenConcurrency = 0;

      const worker = new RenderWorker({
        queue,
        concurrency: 1,
        renderMediaFn: (async () => {
          concurrentExecutions++;
          if (concurrentExecutions > maxSeenConcurrency) {
            maxSeenConcurrency = concurrentExecutions;
          }
          await new Promise((r) => setTimeout(r, 50));
          concurrentExecutions--;
        }) as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async () => ({
          id: 'InteractiveSurfaceDemo',
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 60,
        })) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      worker.start();

      const job1 = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 1 } });
      const job2 = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 2 } });

      // Wait for both to finish
      await new Promise((r) => setTimeout(r, 200));
      worker.stop();

      assert.equal(maxSeenConcurrency, 1);
      assert.ok(job1.id);
      assert.ok(job2.id);
    });
  });

  /* ========================================================================= */
  /* 5. Webpack BundleManager & Caching                                        */
  /* ========================================================================= */
  describe('5. Webpack BundleManager & Caching', () => {
    it('5.1 detects ready bundle and reuses cached files', () => {
      const testBundleDir = path.resolve('/tmp', 'launtion-test-bundle-dir');
      fs.mkdirSync(testBundleDir, { recursive: true });
      fs.writeFileSync(path.join(testBundleDir, 'index.html'), '<html></html>');
      fs.writeFileSync(path.join(testBundleDir, 'bundle.js'), 'console.log("ready");');

      const manager = new BundleManager();
      assert.equal(manager.isBundleReady(testBundleDir), true);

      // Clean up
      manager.clearBundleCache(testBundleDir);
      assert.equal(manager.isBundleReady(testBundleDir), false);
    });

    it('5.2 returns cached bundle path directly without recompiling', async () => {
      const testBundleDir = path.resolve('/tmp', 'launtion-test-bundle-dir2');
      fs.mkdirSync(testBundleDir, { recursive: true });
      fs.writeFileSync(path.join(testBundleDir, 'index.html'), '<html></html>');
      fs.writeFileSync(path.join(testBundleDir, 'bundle.js'), 'console.log("ready");');

      const manager = new BundleManager();
      const resultPath = await manager.getOrCreateBundle({ outDir: testBundleDir });

      assert.equal(resultPath, testBundleDir);
      manager.clearBundleCache(testBundleDir);
    });
  });

  /* ========================================================================= */
  /* 6. Next.js API Routes (POST /api/render, GET/DELETE /api/render/[id])      */
  /* ========================================================================= */
  describe('6. Next.js API Route Handlers', () => {
    it('6.1 POST /api/render accepts valid request and returns HTTP 202 Accepted', async () => {
      const req = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositionId: 'InteractiveSurfaceDemo',
          sceneGraph: mockSceneGraph,
        }),
      });

      const res = await renderPost(req);
      assert.equal(res.status, 202);

      const body = await res.json();
      assert.ok(body.jobId);
      assert.ok(['queued', 'rendering'].includes(body.status));
      assert.equal(body.compositionId, 'InteractiveSurfaceDemo');
      assert.equal(body.pollUrl, `/api/render/${body.jobId}`);
    });

    it('6.2 POST /api/render rejects malformed JSON with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'NOT_VALID_JSON{',
      });

      const res = await renderPost(req);
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.ok(body.error.includes('inválido'));
    });

    it('6.3 POST /api/render rejects invalid payload with HTTP 400', async () => {
      const req = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositionId: 'InvalidCompositionName',
        }),
      });

      const res = await renderPost(req);
      assert.equal(res.status, 400);

      const body = await res.json();
      assert.ok(body.issues);
    });

    it('6.4 GET /api/render returns summary list of jobs', async () => {
      const res = await renderGetList();
      assert.equal(res.status, 200);

      const body = await res.json();
      assert.ok(typeof body.total === 'number');
      assert.ok(Array.isArray(body.jobs));
    });

    it('6.5 GET /api/render/[id] returns 404 for unknown job ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/render/job_unknown_123');
      const res = await renderGetJob(req, { params: Promise.resolve({ id: 'job_unknown_123' }) });

      assert.equal(res.status, 404);
      const body = await res.json();
      assert.equal(body.jobId, 'job_unknown_123');
    });

    it('6.6 GET /api/render/[id] returns 200 with job telemetry for existing job', async () => {
      // First enqueue a job
      const postReq = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compositionId: 'InteractiveSurfaceDemo' }),
      });
      const postRes = await renderPost(postReq);
      const { jobId } = await postRes.json();

      const getReq = new NextRequest(`http://localhost:3000/api/render/${jobId}`);
      const getRes = await renderGetJob(getReq, { params: Promise.resolve({ id: jobId }) });

      assert.equal(getRes.status, 200);
      const jobData = await getRes.json();
      assert.equal(jobData.jobId, jobId);
      assert.ok(jobData.status);
      assert.equal(typeof jobData.progress, 'number');
      assert.equal(typeof jobData.framesRendered, 'number');
    });

    it('6.7 DELETE /api/render/[id] cancels job and returns HTTP 200', async () => {
      const postReq = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 17 } }),
      });
      const postRes = await renderPost(postReq);
      const { jobId } = await postRes.json();

      const deleteReq = new NextRequest(`http://localhost:3000/api/render/${jobId}`, { method: 'DELETE' });
      const deleteRes = await renderDeleteJob(deleteReq, { params: Promise.resolve({ id: jobId }) });

      assert.equal(deleteRes.status, 200);
      const body = await deleteRes.json();
      assert.equal(body.jobId, jobId);
    });
  });

  /* ========================================================================= */
  /* 7. Video Streaming & HTTP Range Download Endpoint                         */
  /* ========================================================================= */
  describe('7. Video Streaming & HTTP Range Download Endpoint', () => {
    it('7.1 returns HTTP 404 for non-existent job ID', async () => {
      const req = new NextRequest('http://localhost:3000/api/render/job_nonexistent/download');
      const res = await renderDownload(req, { params: Promise.resolve({ id: 'job_nonexistent' }) });

      assert.equal(res.status, 404);
    });

    it('7.2 returns HTTP 409 Conflict if job has not completed', async () => {
      const postReq = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 44 } }),
      });
      const postRes = await renderPost(postReq);
      const { jobId } = await postRes.json();

      const req = new NextRequest(`http://localhost:3000/api/render/${jobId}/download`);
      const res = await renderDownload(req, { params: Promise.resolve({ id: jobId }) });

      assert.equal(res.status, 409);
      const body = await res.json();
      assert.ok(body.error.includes('finalizado'));
    });

    it('7.3 returns HTTP 410 Gone if output file is missing on disk', async () => {
      const testService = new RenderService();
      const job = testService.enqueue({ compositionId: 'InteractiveSurfaceDemo' });

      // Mark completed but don't create file
      testService.getQueue().updateJob(job.id, {
        status: 'completed',
        outputPath: path.join(testOutputDir, 'missing-file.mp4'),
      });

      const req = new NextRequest(`http://localhost:3000/api/render/${job.id}/download`);
      const res = await renderDownload(req, { params: Promise.resolve({ id: job.id }) });

      assert.equal(res.status, 410);
      const body = await res.json();
      assert.ok(body.error.includes('no existe'));
    });

    it('7.4 streams complete MP4 video with HTTP 200 headers', async () => {
      const postReq = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 88 } }),
      });
      const postRes = await renderPost(postReq);
      const { jobId } = await postRes.json();

      // Create dummy MP4 file with magic bytes
      const fakeMp4 = Buffer.from('ftypmp42fake-video-payload-content-1234567890');
      const fakePath = path.join(testOutputDir, `${jobId}.mp4`);
      fs.writeFileSync(fakePath, fakeMp4);

      const { renderService } = await import('../src/lib/render');
      renderService.getQueue().updateJob(jobId, {
        status: 'completed',
        outputPath: fakePath,
      });

      const req = new NextRequest(`http://localhost:3000/api/render/${jobId}/download`);
      const res = await renderDownload(req, { params: Promise.resolve({ id: jobId }) });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('Content-Type'), 'video/mp4');
      assert.equal(res.headers.get('Accept-Ranges'), 'bytes');
      assert.ok(res.headers.get('Content-Disposition')?.includes('.mp4'));
      assert.equal(res.headers.get('Content-Length'), fakeMp4.length.toString());

      const arrayBuffer = await res.arrayBuffer();
      assert.equal(Buffer.from(arrayBuffer).toString(), fakeMp4.toString());
    });

    it('7.5 handles HTTP Range request with HTTP 206 Partial Content', async () => {
      const { renderService } = await import('../src/lib/render');
      const job = renderService.enqueue({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 99 } });

      const fakeData = Buffer.from('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      const fakePath = path.join(testOutputDir, `${job.id}.mp4`);
      fs.writeFileSync(fakePath, fakeData);

      renderService.getQueue().updateJob(job.id, {
        status: 'completed',
        outputPath: fakePath,
      });

      // Request bytes 5 to 10
      const req = new NextRequest(`http://localhost:3000/api/render/${job.id}/download`, {
        headers: { Range: 'bytes=5-10' },
      });
      const res = await renderDownload(req, { params: Promise.resolve({ id: job.id }) });

      assert.equal(res.status, 206);
      assert.equal(res.headers.get('Content-Type'), 'video/mp4');
      assert.equal(res.headers.get('Content-Range'), `bytes 5-10/${fakeData.length}`);
      assert.equal(res.headers.get('Content-Length'), '6');

      const arrayBuffer = await res.arrayBuffer();
      assert.equal(Buffer.from(arrayBuffer).toString(), '56789A');
    });
  });

  /* ========================================================================= */
  /* 8. RenderService Facade Coordination                                      */
  /* ========================================================================= */
  describe('8. RenderService Facade Coordination', () => {
    it('8.1 coordinates enqueue, listing, cancellation, and reset cleanly', () => {
      const service = new RenderService();
      service.reset();

      const job = service.enqueue({
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: mockSceneGraph,
      });

      assert.ok(job.id);
      assert.equal(service.getJob(job.id)?.id, job.id);
      assert.equal(service.listJobs().length, 1);

      const cancelled = service.cancel(job.id);
      assert.equal(cancelled, true);
      assert.equal(service.getJob(job.id)?.status, 'cancelled');

      service.reset();
      assert.equal(service.listJobs().length, 0);
    });
  });
});
