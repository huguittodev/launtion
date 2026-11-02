/**
 * service.ts
 *
 * Singleton facade coordinating the RenderQueue and isolated RenderWorker.
 * Provides unified API for route handlers and background jobs.
 */

import type { RenderJob, RenderJobStatus, RenderRequest } from './types';
import { RenderQueue, renderQueue } from './queue';
import { RenderWorker, renderWorker } from './worker';

export class RenderService {
  private readonly queue: RenderQueue;
  private readonly worker: RenderWorker;
  private autoStarted = false;

  constructor(queue = renderQueue, worker = renderWorker) {
    this.queue = queue;
    this.worker = worker;
  }

  private ensureWorkerStarted(): void {
    if (!this.autoStarted) {
      this.worker.start();
      this.autoStarted = true;
    }
  }

  /**
   * Enqueues a render request and activates background worker dispatch.
   */
  public enqueue(request: RenderRequest): RenderJob {
    this.ensureWorkerStarted();
    const job = this.queue.enqueue(request);
    this.worker.dispatch();
    return job;
  }

  /**
   * Retrieves a job by ID.
   */
  public getJob(id: string): RenderJob | undefined {
    return this.queue.getJob(id);
  }

  /**
   * Cancels a job.
   */
  public cancel(id: string): boolean {
    return this.worker.cancel(id);
  }

  /**
   * Lists jobs with optional status filter.
   */
  public listJobs(filter?: { status?: RenderJobStatus }): RenderJob[] {
    return this.queue.listJobs(filter);
  }

  /**
   * Manually starts the background worker.
   */
  public start(): void {
    this.worker.start();
    this.autoStarted = true;
  }

  /**
   * Stops the background worker and releases resources.
   */
  public stop(): void {
    this.worker.stop();
    this.autoStarted = false;
  }

  /**
   * Resets queue and stops worker (used primarily in test suites).
   */
  public reset(): void {
    this.worker.stop();
    this.queue.clear();
    this.autoStarted = false;
  }

  public getQueue(): RenderQueue {
    return this.queue;
  }

  public getWorker(): RenderWorker {
    return this.worker;
  }
}

export const renderService = new RenderService();
