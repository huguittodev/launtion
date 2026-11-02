/**
 * tests/render-worker-adversarial.test.ts
 *
 * EMPIRICAL ADVERSARIAL STRESS TEST HARNESS — Phase 7 Background Render Worker.
 *
 * Evaluates the system under hostile conditions:
 * 1. High Concurrency & Queue Capacity:
 *    - 25+ simultaneous jobs with concurrency limits
 *    - Strict FIFO execution order validation
 *    - Queue capacity exhaustion & HTTP 429 response verification
 *    - Automatic slot recovery and queue draining
 * 2. Idempotency Deduplication:
 *    - Thundering Herd: 30 simultaneous asynchronous requests with identical payload
 *    - Verification of exact SHA-256 matching and single execution
 *    - Sequential idempotency & disk MP4 presence check
 *    - File deletion recovery: re-enqueue when cached MP4 is deleted or empty
 * 3. Timeout Watchdog:
 *    - Enforces RENDER_TIMEOUT on simulated hanging renderers
 *    - Cancels Remotion renderMedia signal
 *    - Slot release verification: worker picks up next queued job immediately
 * 4. Mid-Render Cancellation:
 *    - Cancels active rendering job, verifying status transition to 'cancelled'
 *    - Slot release verification: queue dispatches next pending job
 *    - Cancellation of queued (pending) jobs
 *    - Idempotent / redundant cancellation safety
 * 5. Byte-Range Streaming:
 *    - HTTP 206 Partial Content for 'bytes=0-1024'
 *    - HTTP 206 Partial Content for 'bytes=1024-'
 *    - Last-byte Range request 'bytes=9999-9999'
 *    - Out-of-bounds start & inverted ranges -> HTTP 416
 *    - Full download without Range header -> HTTP 200
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { NextRequest } from 'next/server';
import {
  RenderQueue,
  RenderWorker,
  RenderService,
  renderService,
  computeIdempotencyKey,
  type RenderJob,
} from '../src/lib/render';
import { POST as renderPost } from '../src/app/api/render/route';
import { GET as renderDownload } from '../src/app/api/render/[id]/download/route';
import type { SceneGraph } from '../src/lib/scene-graph/types';

// Deterministic SceneGraph fixture
const baseSceneGraph: SceneGraph = {
  version: '2.0',
  canvas: {
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 60,
  },
  artDirection: {
    backdropVariant: 'dark-precision',
    surfaceTheme: 'dark',
    primaryAccent: '#3b82f6',
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
        words: ['Stress', 'Test', 'Render'],
        accentWordIndex: 0,
      },
    },
  ],
};

describe('Adversarial Stress Test: Phase 7 Render Queue & Worker', () => {
  const stressOutputDir = path.resolve('/tmp', 'launtion-stress-render');

  beforeEach(() => {
    if (!fs.existsSync(stressOutputDir)) {
      fs.mkdirSync(stressOutputDir, { recursive: true });
    }
    renderService.reset();
  });

  afterEach(() => {
    renderService.reset();
    if (fs.existsSync(stressOutputDir)) {
      fs.rmSync(stressOutputDir, { recursive: true, force: true });
    }
  });

  /* ========================================================================= */
  /* Focus Area 1: High Concurrency & Queue Capacity                           */
  /* ========================================================================= */
  describe('Focus Area 1: High Concurrency & Queue Capacity', () => {
    it('1.1 Enqueues 25 distinct jobs: strictly respects concurrency limit and drains FIFO', async () => {
      const queue = new RenderQueue({ outputDir: stressOutputDir });
      const concurrencyLimit = 3;
      let activeExecutions = 0;
      let peakConcurrency = 0;
      const executionStartOrder: string[] = [];
      const executionCompletedOrder: string[] = [];

      const worker = new RenderWorker({
        queue,
        concurrency: concurrencyLimit,
        renderMediaFn: (async ({ outputLocation }: { outputLocation: string }) => {
          activeExecutions++;
          if (activeExecutions > peakConcurrency) {
            peakConcurrency = activeExecutions;
          }
          // Simulate non-trivial frame render
          await new Promise((resolve) => setTimeout(resolve, 20));

          // Write mock output MP4
          fs.writeFileSync(outputLocation, 'fake-mp4-data');
          activeExecutions--;
        }) as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async () => ({
          id: 'InteractiveSurfaceDemo',
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 60,
        })) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      queue.on('job:started', (job: RenderJob) => {
        executionStartOrder.push(job.id);
      });

      queue.on('job:completed', (job: RenderJob) => {
        executionCompletedOrder.push(job.id);
      });

      worker.start();

      // Enqueue 25 distinct jobs
      const enqueuedJobIds: string[] = [];
      for (let i = 0; i < 25; i++) {
        const job = queue.enqueue({
          compositionId: 'InteractiveSurfaceDemo',
          settings: { quality: i + 1 }, // ensure distinct settings so distinct jobs
        });
        enqueuedJobIds.push(job.id);
      }

      assert.equal(enqueuedJobIds.length, 25);
      assert.equal(queue.listJobs().length, 25);

      // Wait until all 25 jobs are completed
      const deadline = Date.now() + 5000;
      while (executionCompletedOrder.length < 25 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }

      worker.stop();

      // Assertions
      assert.equal(executionCompletedOrder.length, 25, 'All 25 jobs should be completed');
      assert.ok(
        peakConcurrency <= concurrencyLimit,
        `Peak concurrency (${peakConcurrency}) must never exceed limit (${concurrencyLimit})`
      );
      assert.ok(peakConcurrency > 1, 'Should utilize multiple worker slots');
      // FIFO execution start order check
      assert.deepEqual(
        executionStartOrder,
        enqueuedJobIds,
        'Jobs must start in strict FIFO order matching enqueue sequence'
      );
    });

    it('1.2 Enforces queue capacity cap and returns HTTP 429 when queue is saturated', async () => {
      // Use renderService with maxQueueDepth = 10
      const limitedQueue = new RenderQueue({ maxQueueDepth: 10, outputDir: stressOutputDir });
      const testService = new RenderService(limitedQueue);

      // Enqueue 10 active jobs to saturate queue
      for (let i = 0; i < 10; i++) {
        testService.enqueue({
          compositionId: 'InteractiveSurfaceDemo',
          settings: { quality: i + 10 },
        });
      }

      assert.equal(limitedQueue.listJobs().length, 10);

      // 11th job must throw capacity exceeded in queue
      assert.throws(
        () =>
          testService.enqueue({
            compositionId: 'InteractiveSurfaceDemo',
            settings: { quality: 99 },
          }),
        /Render queue capacity exceeded \(maximum 10 active jobs\)/
      );

      // Now verify via API Route POST /api/render
      // Fill the global renderService queue up to 50
      const globalQueue = renderService.getQueue();
      const initialActiveCount = globalQueue.listJobs().filter(
        (j) => j.status === 'queued' || j.status === 'rendering'
      ).length;

      // Fill remaining slots
      const fillersNeeded = 50 - initialActiveCount;
      for (let i = 0; i < fillersNeeded; i++) {
        renderService.enqueue({
          compositionId: 'InteractiveSurfaceDemo',
          settings: { quality: (i % 90) + 1, scale: 0.5 + (i * 0.01) },
        });
      }

      // Next POST /api/render must return HTTP 429
      const overCapacityReq = new NextRequest('http://localhost:3000/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositionId: 'InteractiveSurfaceDemo',
          settings: { scale: 1.99 },
        }),
      });

      const res429 = await renderPost(overCapacityReq);
      assert.equal(res429.status, 429, 'Expected HTTP 429 Too Many Requests when queue depth is saturated');
      const body429 = await res429.json();
      assert.equal(body429.error, 'Cola de renderizado saturada');
      assert.ok(body429.message.includes('capacity exceeded'));
    });
  });

  /* ========================================================================= */
  /* Focus Area 2: Idempotency Deduplication                                   */
  /* ========================================================================= */
  describe('Focus Area 2: Idempotency Deduplication', () => {
    it('2.1 Thundering Herd: 30 concurrent identical POST requests yield identical jobId and single job', async () => {
      const payload = {
        compositionId: 'InteractiveSurfaceDemo',
        sceneGraph: baseSceneGraph,
        settings: { codec: 'h264', scale: 1.0 },
      };

      // Dispatch 30 simultaneous POST requests via Promise.all
      const promises = Array.from({ length: 30 }).map(() => {
        const req = new NextRequest('http://localhost:3000/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return renderPost(req);
      });

      const responses = await Promise.all(promises);

      // Verify all 30 returned HTTP 202
      for (const res of responses) {
        assert.equal(res.status, 202);
      }

      const bodies = await Promise.all(responses.map((r) => r.json()));
      const firstJobId = bodies[0].jobId;
      assert.ok(firstJobId, 'Job ID should be returned');

      // Every response must have the exact same jobId
      for (const b of bodies) {
        assert.equal(b.jobId, firstJobId, 'All concurrent identical requests must map to the same jobId');
      }

      // Verify only 1 job actually exists in the queue
      const allJobs = renderService.listJobs();
      assert.equal(allJobs.length, 1, 'Exactly one job must be created in queue');
      assert.equal(allJobs[0].id, firstJobId);
    });

    it('2.2 Deduplicates sequential identical requests and verifies completed file caching & recovery', async () => {
      const queue = new RenderQueue({ outputDir: stressOutputDir });
      const requestPayload = {
        compositionId: 'InteractiveSurfaceDemo' as const,
        sceneGraph: baseSceneGraph,
      };

      // 1. Initial enqueue
      const job1 = queue.enqueue(requestPayload);
      assert.equal(job1.status, 'queued');

      // 2. Sequential enqueue while still queued returns identical job
      const job2 = queue.enqueue(requestPayload);
      assert.equal(job2.id, job1.id);

      // 3. Complete job with MP4 file on disk
      fs.writeFileSync(job1.outputPath!, 'rendered-mp4-stream-content');
      queue.updateJob(job1.id, {
        status: 'completed',
        progress: 1.0,
      });

      // 4. Sequential enqueue after completion returns completed job
      const job3 = queue.enqueue(requestPayload);
      assert.equal(job3.id, job1.id);
      assert.equal(job3.status, 'completed');

      // 5. Delete output file to simulate disk expiry or cleanup
      fs.unlinkSync(job1.outputPath!);

      // 6. Sequential enqueue after file deletion recovers and creates fresh job
      const job4 = queue.enqueue(requestPayload);
      assert.notEqual(job4.id, job1.id, 'Should generate new job when output file was unlinked');
      assert.equal(job4.status, 'queued');
    });

    it('2.3 Generates distinct SHA-256 keys for even minor variation in settings or scenes', () => {
      const keyBase = computeIdempotencyKey('InteractiveSurfaceDemo', baseSceneGraph, { scale: 1.0 });
      const keyScale = computeIdempotencyKey('InteractiveSurfaceDemo', baseSceneGraph, { scale: 1.0001 });
      const keyCodec = computeIdempotencyKey('InteractiveSurfaceDemo', baseSceneGraph, { codec: 'prores' });

      // Modified sceneGraph text
      const modifiedGraph = JSON.parse(JSON.stringify(baseSceneGraph));
      modifiedGraph.scenes[0].payload.words = ['Different', 'Words'];
      const keyScene = computeIdempotencyKey('InteractiveSurfaceDemo', modifiedGraph, { scale: 1.0 });

      assert.notEqual(keyBase, keyScale);
      assert.notEqual(keyBase, keyCodec);
      assert.notEqual(keyBase, keyScene);
    });
  });

  /* ========================================================================= */
  /* Focus Area 3: Timeout Watchdog (RENDER_TIMEOUT) & Slot Recovery           */
  /* ========================================================================= */
  describe('Focus Area 3: Timeout Watchdog (RENDER_TIMEOUT) & Slot Recovery', () => {
    it('3.1 Enforces timeout watchdog, invokes cancelSignal, and frees worker slot for subsequent jobs', async () => {
      const queue = new RenderQueue({ outputDir: stressOutputDir });
      let cancelSignalTriggered = false;
      const executedJobs: string[] = [];

      const worker = new RenderWorker({
        queue,
        concurrency: 1, // Strictly 1 slot to verify slot release
        makeCancelSignalFn: () => ({
          cancelSignal: () => {},
          cancel: () => {
            cancelSignalTriggered = true;
          },
        }),
        renderMediaFn: (async ({ composition, outputLocation }: { composition: { id: string }; outputLocation: string }) => {
          executedJobs.push(composition.id);
          if (composition.id === 'LaunchDemo') {
            // Simulated hanging render (longer than timeoutMs)
            return new Promise<void>((_, reject) => {
              const timer = setTimeout(() => {
                reject(new Error('Hanging render aborted'));
              }, 500);
              // Clean up on cancel
              return () => clearTimeout(timer);
            });
          }
          // Normal quick render for other jobs
          fs.writeFileSync(outputLocation, 'fake-mp4');
        }) as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async ({ id }: { id: string }) => ({
          id,
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 60,
        })) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      worker.start();

      // Enqueue Job 1 (hangs, timeout 60ms)
      const hangingJob = queue.enqueue({
        compositionId: 'LaunchDemo',
        settings: { timeoutMs: 60 },
      });

      // Enqueue Job 2 (normal, behind Job 1)
      const normalJob = queue.enqueue({
        compositionId: 'InteractiveSurfaceDemo',
        settings: { timeoutMs: 10000 },
      });

      // Wait for Job 1 to time out and Job 2 to finish
      const deadline = Date.now() + 3000;
      while (normalJob.status !== 'completed' && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 20));
      }

      worker.stop();

      // Verify Job 1 failed with RENDER_TIMEOUT
      const failedJob = queue.getJob(hangingJob.id);
      assert.equal(failedJob?.status, 'failed');
      assert.equal(failedJob?.error?.code, 'RENDER_TIMEOUT');
      assert.ok(cancelSignalTriggered, 'Cancel signal should have been called on timeout');

      // CRITICAL: Verify Job 2 completed successfully, proving worker slot was released!
      const completedJob = queue.getJob(normalJob.id);
      assert.equal(completedJob?.status, 'completed', 'Worker slot must be freed so subsequent job completes');
      assert.deepEqual(executedJobs, ['LaunchDemo', 'InteractiveSurfaceDemo']);
    });
  });

  /* ========================================================================= */
  /* Focus Area 4: Mid-Render Cancellation & Queue State Transitions           */
  /* ========================================================================= */
  describe('Focus Area 4: Mid-Render Cancellation & Queue State Transitions', () => {
    it('4.1 Mid-render cancellation stops execution, marks cancelled, and releases worker slot', async () => {
      const queue = new RenderQueue({ outputDir: stressOutputDir });
      let cancelFnCalled = false;
      let resolveLongTask!: () => void;
      const longTaskPromise = new Promise<void>((resolve) => {
        resolveLongTask = resolve;
      });

      const worker = new RenderWorker({
        queue,
        concurrency: 1,
        makeCancelSignalFn: () => ({
          cancelSignal: () => {},
          cancel: () => {
            cancelFnCalled = true;
            resolveLongTask();
          },
        }),
        renderMediaFn: (async ({ composition, outputLocation }: { composition: { id: string }; outputLocation: string }) => {
          if (composition.id === 'LaunchDemo') {
            await longTaskPromise;
            throw new Error('Render aborted by user cancellation');
          }
          fs.writeFileSync(outputLocation, 'fake-mp4');
        }) as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async ({ id }: { id: string }) => ({
          id,
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 60,
        })) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      worker.start();

      // Enqueue Job 1 to be cancelled mid-render
      const job1 = queue.enqueue({ compositionId: 'LaunchDemo' });
      // Enqueue Job 2 waiting in queue
      const job2 = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });

      // Wait until Job 1 is actively rendering
      while (job1.status !== 'rendering') {
        await new Promise((r) => setTimeout(r, 10));
      }

      // Cancel Job 1 mid-render
      const cancelSuccess = worker.cancel(job1.id);
      assert.equal(cancelSuccess, true);
      assert.equal(cancelFnCalled, true);

      // Wait for Job 2 to complete
      const deadline = Date.now() + 2000;
      while (job2.status !== 'completed' && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10));
      }

      worker.stop();

      // Job 1 should be cancelled
      assert.equal(queue.getJob(job1.id)?.status, 'cancelled');
      // Job 2 should be completed
      assert.equal(queue.getJob(job2.id)?.status, 'completed');
    });

    it('4.2 Cancels queued job prior to worker dispatch without running it', async () => {
      const queue = new RenderQueue({ outputDir: stressOutputDir });
      let executedCount = 0;

      const worker = new RenderWorker({
        queue,
        concurrency: 1,
        renderMediaFn: (async ({ outputLocation }: { outputLocation: string }) => {
          executedCount++;
          fs.writeFileSync(outputLocation, 'fake-mp4');
        }) as unknown as typeof import('@remotion/renderer').renderMedia,
        selectCompositionFn: (async () => ({
          id: 'InteractiveSurfaceDemo',
          width: 1920,
          height: 1080,
          fps: 30,
          durationInFrames: 60,
        })) as unknown as typeof import('@remotion/renderer').selectComposition,
      });

      // Enqueue Job A and Job B
      const jobA = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 10 } });
      const jobB = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo', settings: { quality: 20 } });

      // Cancel Job B while still in queued status before worker starts
      const cancelledB = queue.cancelJob(jobB.id);
      assert.equal(cancelledB, true);
      assert.equal(queue.getJob(jobB.id)?.status, 'cancelled');

      // Start worker
      worker.start();

      // Wait for Job A to complete
      const deadline = Date.now() + 2000;
      while (jobA.status !== 'completed' && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 10));
      }

      worker.stop();

      // Only Job A should have executed
      assert.equal(executedCount, 1);
      assert.equal(queue.getJob(jobA.id)?.status, 'completed');
      assert.equal(queue.getJob(jobB.id)?.status, 'cancelled');
    });

    it('4.3 Idempotent cancellation: repeated or invalid cancellations return false gracefully', () => {
      const queue = new RenderQueue({ outputDir: stressOutputDir });
      const job = queue.enqueue({ compositionId: 'InteractiveSurfaceDemo' });

      // First cancel succeeds
      assert.equal(queue.cancelJob(job.id), true);
      assert.equal(queue.getJob(job.id)?.status, 'cancelled');

      // Second cancel on already cancelled job returns false
      assert.equal(queue.cancelJob(job.id), false);

      // Cancel on non-existent job returns false
      assert.equal(queue.cancelJob('non_existent_job_xyz'), false);
    });
  });

  /* ========================================================================= */
  /* Focus Area 5: Byte-Range Streaming (GET /api/render/[id]/download)        */
  /* ========================================================================= */
  describe('Focus Area 5: Byte-Range Streaming (GET /api/render/[id]/download)', () => {
    const testFileSize = 10000;
    const testBuffer = Buffer.alloc(testFileSize);
    // Fill with predictable cyclic pattern: 0, 1, 2, ..., 255
    for (let i = 0; i < testFileSize; i++) {
      testBuffer[i] = i % 256;
    }

    let completedJobId: string;
    let completedFilePath: string;

    beforeEach(() => {
      const job = renderService.enqueue({ compositionId: 'InteractiveSurfaceDemo' });
      completedJobId = job.id;
      completedFilePath = path.join(stressOutputDir, `${completedJobId}.mp4`);
      fs.writeFileSync(completedFilePath, testBuffer);

      renderService.getQueue().updateJob(completedJobId, {
        status: 'completed',
        progress: 1.0,
        outputPath: completedFilePath,
      });
    });

    it('5.1 Standard Range: bytes=0-1024 returns HTTP 206 and exact first 1025 bytes', async () => {
      const req = new NextRequest(`http://localhost:3000/api/render/${completedJobId}/download`, {
        headers: { Range: 'bytes=0-1024' },
      });
      const res = await renderDownload(req, { params: Promise.resolve({ id: completedJobId }) });

      assert.equal(res.status, 206, 'Should return HTTP 206 Partial Content');
      assert.equal(res.headers.get('Content-Type'), 'video/mp4');
      assert.equal(res.headers.get('Accept-Ranges'), 'bytes');
      assert.equal(res.headers.get('Content-Range'), `bytes 0-1024/${testFileSize}`);
      assert.equal(res.headers.get('Content-Length'), '1025');

      const arrayBuffer = await res.arrayBuffer();
      const receivedBuffer = Buffer.from(arrayBuffer);
      assert.equal(receivedBuffer.length, 1025);
      assert.deepEqual(receivedBuffer, testBuffer.subarray(0, 1025));
    });

    it('5.2 Suffix Range: bytes=1024- returns HTTP 206 from byte 1024 to end of file', async () => {
      const req = new NextRequest(`http://localhost:3000/api/render/${completedJobId}/download`, {
        headers: { Range: 'bytes=1024-' },
      });
      const res = await renderDownload(req, { params: Promise.resolve({ id: completedJobId }) });

      const expectedLength = testFileSize - 1024; // 8976
      assert.equal(res.status, 206);
      assert.equal(res.headers.get('Content-Range'), `bytes 1024-${testFileSize - 1}/${testFileSize}`);
      assert.equal(res.headers.get('Content-Length'), expectedLength.toString());

      const arrayBuffer = await res.arrayBuffer();
      const receivedBuffer = Buffer.from(arrayBuffer);
      assert.equal(receivedBuffer.length, expectedLength);
      assert.deepEqual(receivedBuffer, testBuffer.subarray(1024, testFileSize));
    });

    it('5.3 Boundary Range: last byte bytes=9999-9999 returns 1 byte', async () => {
      const req = new NextRequest(`http://localhost:3000/api/render/${completedJobId}/download`, {
        headers: { Range: 'bytes=9999-9999' },
      });
      const res = await renderDownload(req, { params: Promise.resolve({ id: completedJobId }) });

      assert.equal(res.status, 206);
      assert.equal(res.headers.get('Content-Range'), `bytes 9999-9999/${testFileSize}`);
      assert.equal(res.headers.get('Content-Length'), '1');

      const arrayBuffer = await res.arrayBuffer();
      const receivedBuffer = Buffer.from(arrayBuffer);
      assert.equal(receivedBuffer.length, 1);
      assert.equal(receivedBuffer[0], testBuffer[9999]);
    });

    it('5.4 Out-of-bounds start: bytes=10000- returns HTTP 416 Range Not Satisfiable', async () => {
      const req = new NextRequest(`http://localhost:3000/api/render/${completedJobId}/download`, {
        headers: { Range: 'bytes=10000-' },
      });
      const res = await renderDownload(req, { params: Promise.resolve({ id: completedJobId }) });

      assert.equal(res.status, 416, 'Expected HTTP 416 Range Not Satisfiable');
      assert.equal(res.headers.get('Content-Range'), `bytes */${testFileSize}`);
    });

    it('5.5 Inverted range: bytes=800-200 returns HTTP 416 Range Not Satisfiable', async () => {
      const req = new NextRequest(`http://localhost:3000/api/render/${completedJobId}/download`, {
        headers: { Range: 'bytes=800-200' },
      });
      const res = await renderDownload(req, { params: Promise.resolve({ id: completedJobId }) });

      assert.equal(res.status, 416);
      assert.equal(res.headers.get('Content-Range'), `bytes */${testFileSize}`);
    });

    it('5.6 Full download without Range header returns HTTP 200 and entire file', async () => {
      const req = new NextRequest(`http://localhost:3000/api/render/${completedJobId}/download`);
      const res = await renderDownload(req, { params: Promise.resolve({ id: completedJobId }) });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('Content-Type'), 'video/mp4');
      assert.equal(res.headers.get('Content-Length'), testFileSize.toString());
      assert.equal(res.headers.get('Accept-Ranges'), 'bytes');

      const arrayBuffer = await res.arrayBuffer();
      const receivedBuffer = Buffer.from(arrayBuffer);
      assert.equal(receivedBuffer.length, testFileSize);
      assert.deepEqual(receivedBuffer, testBuffer);
    });
  });
});
