/**
 * queue.ts
 *
 * Observable, idempotent, time-limited, and retry-safe RenderQueue.
 * Implements Rule 8 and Rule 9 of AGENTS.md.
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RenderJob, RenderJobStatus, RenderRequest } from './types';
import { RenderSettingsSchema, computeIdempotencyKey } from './schema';

export interface RenderQueueOptions {
  maxQueueDepth?: number;
  outputDir?: string;
}

export class RenderQueue extends EventEmitter {
  private jobs: Map<string, RenderJob> = new Map();
  private idempotencyIndex: Map<string, string> = new Map(); // idempotencyKey -> jobId
  private readonly maxQueueDepth: number;
  private readonly outputDir: string;

  constructor(options?: RenderQueueOptions) {
    super();
    this.maxQueueDepth = options?.maxQueueDepth ?? 50;
    this.outputDir = options?.outputDir ?? path.resolve('/tmp', 'launtion-renders');

    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      try {
        fs.mkdirSync(this.outputDir, { recursive: true });
      } catch {
        // Ignore in environments where filesystem is mocked or permission restricted
      }
    }
  }

  /**
   * Enqueues a render request or returns existing idempotent job.
   */
  public enqueue(request: RenderRequest): RenderJob {
    const compositionId = request.compositionId;
    const sceneGraph = request.sceneGraph;
    const parsedSettings = RenderSettingsSchema.parse(request.settings ?? {});
    const idempotencyKey = computeIdempotencyKey(compositionId, sceneGraph, parsedSettings);

    // Idempotency check: see if a matching job already exists
    const existingJobId = this.idempotencyIndex.get(idempotencyKey);
    if (existingJobId) {
      const existingJob = this.jobs.get(existingJobId);
      if (existingJob) {
        // If still pending or actively rendering, return existing job
        if (existingJob.status === 'queued' || existingJob.status === 'rendering') {
          return existingJob;
        }

        // If completed, verify file exists on disk
        if (existingJob.status === 'completed' && existingJob.outputPath) {
          if (fs.existsSync(existingJob.outputPath)) {
            try {
              const stat = fs.statSync(existingJob.outputPath);
              if (stat.size > 0) {
                return existingJob;
              }
            } catch {
              // File inaccessible or corrupted, re-enqueue
            }
          }
        }
      }
    }

    // Safety check: ensure queue depth does not exceed max capacity
    const pendingCount = Array.from(this.jobs.values()).filter(
      (j) => j.status === 'queued' || j.status === 'rendering'
    ).length;

    if (pendingCount >= this.maxQueueDepth) {
      throw new Error(`Render queue capacity exceeded (maximum ${this.maxQueueDepth} active jobs)`);
    }

    const jobId = `job_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const outputPath = path.join(this.outputDir, `${jobId}.mp4`);
    const downloadUrl = `/api/render/${jobId}/download`;

    const job: RenderJob = {
      id: jobId,
      idempotencyKey,
      compositionId,
      sceneGraph,
      settings: parsedSettings,
      status: 'queued',
      progress: 0.0,
      framesRendered: 0,
      totalFrames: sceneGraph?.canvas.durationInFrames ?? 480,
      renderedBytes: 0,
      currentStage: 'bundling',
      outputPath,
      downloadUrl,
      attempts: 0,
      maxAttempts: 2, // 1 retry on transient system errors
      createdAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    this.idempotencyIndex.set(idempotencyKey, jobId);

    this.emit('job:enqueued', job);
    return job;
  }

  /**
   * Retrieves a job by ID.
   */
  public getJob(id: string): RenderJob | undefined {
    return this.jobs.get(id);
  }

  /**
   * Finds a job by its idempotency key.
   */
  public findJobByIdempotencyKey(key: string): RenderJob | undefined {
    const jobId = this.idempotencyIndex.get(key);
    return jobId ? this.jobs.get(jobId) : undefined;
  }

  /**
   * Updates an existing job's state and emits corresponding events.
   */
  public updateJob(id: string, patch: Partial<RenderJob>): RenderJob | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    const previousStatus = job.status;
    Object.assign(job, patch);

    if (patch.status && patch.status !== previousStatus) {
      if (patch.status === 'rendering') {
        this.emit('job:started', job);
      } else if (patch.status === 'completed') {
        this.emit('job:completed', job);
      } else if (patch.status === 'failed') {
        this.emit('job:failed', { job, error: job.error });
      } else if (patch.status === 'cancelled') {
        this.emit('job:cancelled', job);
      }
    }

    if (patch.progress !== undefined || patch.framesRendered !== undefined || patch.currentStage !== undefined) {
      this.emit('job:progress', { job, progress: job.progress });
    }

    return job;
  }

  /**
   * Marks a job as cancelled.
   */
  public cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return false; // Cannot cancel finished job
    }

    this.updateJob(id, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    });
    return true;
  }

  /**
   * Returns next available job in queued state.
   */
  public getNextQueuedJob(): RenderJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.status === 'queued') {
        return job;
      }
    }
    return undefined;
  }

  /**
   * Lists all jobs with optional status filter.
   */
  public listJobs(filter?: { status?: RenderJobStatus }): RenderJob[] {
    const all = Array.from(this.jobs.values());
    if (filter?.status) {
      return all.filter((j) => j.status === filter.status);
    }
    return all;
  }

  /**
   * Clears all jobs and indices (primarily for testing).
   */
  public clear(): void {
    this.jobs.clear();
    this.idempotencyIndex.clear();
  }
}

export const renderQueue = new RenderQueue();
