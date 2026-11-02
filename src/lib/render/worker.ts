/**
 * worker.ts
 *
 * Isolated background render worker using @remotion/renderer.
 * Implements concurrency limits, timeout watchdog (RENDER_TIMEOUT),
 * cancellation handling, retry safety, and frame-accurate progress updates.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import type * as RendererModule from '@remotion/renderer';
import type { RenderJob } from './types';
import { RenderQueue, renderQueue } from './queue';
import { BundleManager, bundleManager } from './bundle-manager';

function loadRenderer(): typeof RendererModule {
  const req = createRequire(import.meta.url);
  const pkg = ['@remotion', 'renderer'].join('/');
  return req(pkg);
}

export interface RenderWorkerOptions {
  queue?: RenderQueue;
  bundleManager?: BundleManager;
  concurrency?: number;
  renderMediaFn?: typeof RendererModule.renderMedia;
  selectCompositionFn?: typeof RendererModule.selectComposition;
  makeCancelSignalFn?: typeof RendererModule.makeCancelSignal;
}

interface ActiveJobContext {
  cancel: () => void;
  timeoutId: NodeJS.Timeout;
  isTimedOut: boolean;
  isCancelled: boolean;
}

export class RenderWorker {
  private readonly queue: RenderQueue;
  private readonly bundleManager: BundleManager;
  private readonly concurrency: number;
  private readonly renderMediaFn: typeof RendererModule.renderMedia;
  private readonly selectCompositionFn: typeof RendererModule.selectComposition;
  private readonly makeCancelSignalFn: typeof RendererModule.makeCancelSignal;

  private isRunning = false;
  private activeJobsCount = 0;
  private activeJobs: Map<string, ActiveJobContext> = new Map();
  private boundEnqueuedListener: (job: RenderJob) => void;

  constructor(options?: RenderWorkerOptions) {
    this.queue = options?.queue ?? renderQueue;
    this.bundleManager = options?.bundleManager ?? bundleManager;
    this.concurrency = options?.concurrency ?? 1;

    let renderer: typeof RendererModule | null = null;
    const getRendererModule = () => {
      if (!renderer) {
        renderer = loadRenderer();
      }
      return renderer;
    };

    this.renderMediaFn = options?.renderMediaFn ?? ((...args) => getRendererModule().renderMedia(...args));
    this.selectCompositionFn = options?.selectCompositionFn ?? ((...args) => getRendererModule().selectComposition(...args));
    this.makeCancelSignalFn = options?.makeCancelSignalFn ?? (() => getRendererModule().makeCancelSignal());

    this.boundEnqueuedListener = () => {
      this.dispatch();
    };
  }

  /**
   * Starts the background render worker.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.queue.on('job:enqueued', this.boundEnqueuedListener);
    this.dispatch();
  }

  /**
   * Stops the background worker and aborts any currently active renders.
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.queue.off('job:enqueued', this.boundEnqueuedListener);

    // Cancel all active jobs
    for (const [jobId, ctx] of this.activeJobs.entries()) {
      clearTimeout(ctx.timeoutId);
      ctx.isCancelled = true;
      try {
        ctx.cancel();
      } catch {
        // Ignore cancellation errors on shutdown
      }
      this.queue.cancelJob(jobId);
    }
    this.activeJobs.clear();
    this.activeJobsCount = 0;
  }

  /**
   * Cancels a specific job if it is actively running.
   */
  public cancel(jobId: string): boolean {
    const ctx = this.activeJobs.get(jobId);
    if (ctx) {
      clearTimeout(ctx.timeoutId);
      ctx.isCancelled = true;
      try {
        ctx.cancel();
      } catch {
        // Ignore
      }
    }
    return this.queue.cancelJob(jobId);
  }

  /**
   * Returns current number of active rendering jobs.
   */
  public getActiveCount(): number {
    return this.activeJobsCount;
  }

  /**
   * Returns whether the worker is idle.
   */
  public isIdle(): boolean {
    return this.activeJobsCount === 0;
  }

  /**
   * Checks queue and dispatches next available job up to concurrency limit.
   */
  public dispatch(): void {
    if (!this.isRunning) return;
    if (this.activeJobsCount >= this.concurrency) return;

    const nextJob = this.queue.getNextQueuedJob();
    if (!nextJob) return;

    this.activeJobsCount++;
    this.processJob(nextJob)
      .catch(() => {
        // Error handling is fully encapsulated within processJob
      })
      .finally(() => {
        this.activeJobsCount--;
        this.dispatch();
      });
  }

  /**
   * Executes the render pipeline for a single job.
   */
  public async processJob(job: RenderJob): Promise<void> {
    const startTime = Date.now();
    const { cancelSignal, cancel } = this.makeCancelSignalFn();

    const ctx: ActiveJobContext = {
      cancel,
      timeoutId: null as unknown as NodeJS.Timeout,
      isTimedOut: false,
      isCancelled: false,
    };

    // 1. Time-limited Watchdog Timer (Rule 9)
    const timeoutMs = job.settings.timeoutMs || 180000;
    ctx.timeoutId = setTimeout(() => {
      ctx.isTimedOut = true;
      try {
        ctx.cancel();
      } catch {
        // Ignore
      }
      this.queue.updateJob(job.id, {
        status: 'failed',
        error: {
          code: 'RENDER_TIMEOUT',
          message: `Render exceeded maximum allotted time of ${timeoutMs}ms`,
        },
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      });
    }, timeoutMs);

    this.activeJobs.set(job.id, ctx);

    // Update job to rendering status
    this.queue.updateJob(job.id, {
      status: 'rendering',
      startedAt: new Date().toISOString(),
      currentStage: 'bundling',
      progress: 0.0,
      framesRendered: 0,
    });

    try {
      // 2. Webpack Bundling Stage
      const bundleServeUrl = await this.bundleManager.getOrCreateBundle();

      // Check if cancelled or timed out during bundling
      if (ctx.isCancelled || ctx.isTimedOut) {
        return;
      }

      this.queue.updateJob(job.id, {
        currentStage: 'rendering_frames',
      });

      // 3. Composition Selection
      const inputProps = job.sceneGraph ? { sceneGraph: job.sceneGraph } : undefined;
      const composition = await this.selectCompositionFn({
        serveUrl: bundleServeUrl,
        id: job.compositionId,
        inputProps,
      });

      if (!composition) {
        throw new Error(`Composition "${job.compositionId}" not found in entry bundle`);
      }

      const totalFrames = composition.durationInFrames;
      this.queue.updateJob(job.id, {
        totalFrames,
      });

      // Ensure target output directory exists
      if (job.outputPath) {
        const outDir = path.dirname(job.outputPath);
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
      }

      // 4. Remotion Media Rendering
      await this.renderMediaFn({
        composition,
        serveUrl: bundleServeUrl,
        codec: job.settings.codec,
        audioCodec: job.settings.audioCodec,
        imageFormat: job.settings.imageFormat,
        scale: job.settings.scale,
        outputLocation: job.outputPath!,
        inputProps,
        concurrency: job.settings.concurrency,
        cancelSignal,
        muted: job.settings.muted,
        onProgress: (p) => {
          if (ctx.isCancelled || ctx.isTimedOut) return;

          const renderedFrames = p.renderedFrames ?? 0;
          const normalizedProgress = Math.min(
            1.0,
            Math.max(0.0, p.progress !== undefined ? p.progress : renderedFrames / totalFrames)
          );

          let stage = job.currentStage;
          if (p.stitchStage === 'encoding' || p.encodedFrames > 0) {
            stage = 'encoding';
          } else if (p.stitchStage === 'muxing') {
            stage = 'muxing';
          } else if (renderedFrames > 0) {
            stage = 'rendering_frames';
          }

          let renderedBytes = job.renderedBytes;
          if (job.outputPath && fs.existsSync(job.outputPath)) {
            try {
              const stat = fs.statSync(job.outputPath);
              renderedBytes = stat.size;
            } catch {
              // Ignore stat read during streaming encode
            }
          }

          this.queue.updateJob(job.id, {
            progress: normalizedProgress,
            framesRendered: renderedFrames,
            totalFrames,
            renderedBytes,
            currentStage: stage,
          });
        },
      });

      // Clear timeout watchdog
      clearTimeout(ctx.timeoutId);

      // If aborted via cancellation or timeout, do not mark completed
      if (ctx.isCancelled || ctx.isTimedOut) {
        return;
      }

      // Verify final output file on disk
      let finalBytes = 0;
      if (job.outputPath && fs.existsSync(job.outputPath)) {
        const stat = fs.statSync(job.outputPath);
        finalBytes = stat.size;
      }

      if (finalBytes === 0) {
        throw new Error('Render completed but output MP4 file was empty or missing on disk');
      }

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startTime;

      this.queue.updateJob(job.id, {
        status: 'completed',
        progress: 1.0,
        currentStage: 'finished',
        framesRendered: totalFrames,
        renderedBytes: finalBytes,
        completedAt,
        durationMs,
      });
    } catch (err: unknown) {
      clearTimeout(ctx.timeoutId);

      // If already marked as cancelled or timed out, keep that terminal state
      if (ctx.isCancelled || ctx.isTimedOut) {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      const isCancellationError =
        errorMessage.toLowerCase().includes('cancel') ||
        errorMessage.toLowerCase().includes('aborted');

      if (isCancellationError) {
        this.queue.updateJob(job.id, {
          status: 'cancelled',
          completedAt: new Date().toISOString(),
          durationMs: Date.now() - startTime,
        });
        return;
      }

      // Check retry-safety for transient system errors (Rule 9)
      const currentAttempts = job.attempts + 1;
      const isPermanentError =
        errorMessage.includes('not found') ||
        errorMessage.includes('validation') ||
        errorMessage.includes('Invalid');

      if (!isPermanentError && currentAttempts < job.maxAttempts) {
        // Retry once for transient errors
        this.queue.updateJob(job.id, {
          status: 'queued',
          attempts: currentAttempts,
          currentStage: 'bundling',
          progress: 0.0,
          error: {
            code: 'TRANSIENT_RENDER_RETRY',
            message: `Transient render failure, attempting retry (${currentAttempts}/${job.maxAttempts}): ${errorMessage}`,
          },
        });
        return;
      }

      // Permanent failure or exhausted retries
      this.queue.updateJob(job.id, {
        status: 'failed',
        attempts: currentAttempts,
        error: {
          code: 'RENDER_FAILED',
          message: errorMessage,
          details: err instanceof Error ? err.stack : undefined,
        },
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      });
    } finally {
      clearTimeout(ctx.timeoutId);
      this.activeJobs.delete(job.id);
    }
  }
}

export const renderWorker = new RenderWorker();
