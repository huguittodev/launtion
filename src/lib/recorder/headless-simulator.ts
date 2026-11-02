/**
 * headless-simulator.ts
 *
 * Deterministic headless recording simulator for automated Node.js CI testing.
 * Allows programmatic creation and execution of synthetic user interaction sessions
 * with scripted mouse coordinates, timestamps, and discrete clicks without requiring
 * a browser window or physical display server.
 */

import { CoordinateMapper } from '../interaction-map/CoordinateMapper';
import type {
  RawRecordingSession,
  RecordedPointerEvent,
  RecordingSessionMetadata,
  RecordingViewport,
} from './types';

export interface HeadlessSimulatorOptions {
  viewport?: Partial<RecordingViewport>;
  fps?: number;
}

export class HeadlessRecordingSimulator {
  private viewport: RecordingViewport;
  private fps: number;
  private t0_ms = 0;
  private currentTime_ms = 0;
  private eventCounter = 0;
  private events: RecordedPointerEvent[] = [];
  private isRecording = false;

  constructor(options?: HeadlessSimulatorOptions) {
    this.viewport = {
      width: options?.viewport?.width ?? 1920,
      height: options?.viewport?.height ?? 1080,
      devicePixelRatio: options?.viewport?.devicePixelRatio ?? 1.0,
    };
    this.fps = options?.fps ?? 30;
  }

  public start(t0_ms = 0): this {
    this.isRecording = true;
    this.t0_ms = t0_ms;
    this.currentTime_ms = t0_ms;
    this.events = [];
    this.eventCounter = 0;
    return this;
  }

  public moveTo(time_ms: number, normX: number, normY: number): this {
    if (!this.isRecording) throw new Error('Simulator is not started. Call start() first.');
    this.currentTime_ms = Math.max(this.t0_ms, time_ms);
    const clampedX = CoordinateMapper.clamp01(normX);
    const clampedY = CoordinateMapper.clamp01(normY);
    const elapsed = this.currentTime_ms - this.t0_ms;

    this.events.push({
      id: `sim-evt-${++this.eventCounter}`,
      timestampMs: elapsed,
      t_ms: elapsed,
      timestamp: this.t0_ms + elapsed,
      type: 'move',
      x: clampedX,
      y: clampedY,
      normalizedX: clampedX,
      normalizedY: clampedY,
      rawPixelX: Math.round(clampedX * this.viewport.width),
      rawPixelY: Math.round(clampedY * this.viewport.height),
      clientX: Math.round(clampedX * this.viewport.width),
      clientY: Math.round(clampedY * this.viewport.height),
      button: 0,
    });

    return this;
  }

  public click(
    time_ms: number,
    normX: number,
    normY: number,
    metadata?: { targetTag?: string; targetId?: string; textSnippet?: string }
  ): this {
    if (!this.isRecording) throw new Error('Simulator is not started. Call start() first.');
    this.currentTime_ms = Math.max(this.t0_ms, time_ms);
    const clampedX = CoordinateMapper.clamp01(normX);
    const clampedY = CoordinateMapper.clamp01(normY);
    const elapsed = this.currentTime_ms - this.t0_ms;

    this.events.push({
      id: `sim-evt-${++this.eventCounter}`,
      timestampMs: elapsed,
      t_ms: elapsed,
      timestamp: this.t0_ms + elapsed,
      type: 'click',
      x: clampedX,
      y: clampedY,
      normalizedX: clampedX,
      normalizedY: clampedY,
      rawPixelX: Math.round(clampedX * this.viewport.width),
      rawPixelY: Math.round(clampedY * this.viewport.height),
      clientX: Math.round(clampedX * this.viewport.width),
      clientY: Math.round(clampedY * this.viewport.height),
      button: 0,
      targetTag: metadata?.targetTag || 'BUTTON',
      targetId: metadata?.targetId,
      targetElement: metadata
        ? {
            tagName: metadata.targetTag || 'BUTTON',
            id: metadata.targetId,
            textSnippet: metadata.textSnippet,
          }
        : undefined,
    });

    return this;
  }

  public scroll(time_ms: number, deltaY = 100): this {
    if (!this.isRecording) throw new Error('Simulator is not started. Call start() first.');
    this.currentTime_ms = Math.max(this.t0_ms, time_ms);
    const elapsed = this.currentTime_ms - this.t0_ms;
    const last = this.events[this.events.length - 1];
    const x = last ? last.x : 0.5;
    const y = last ? last.y : 0.5;

    this.events.push({
      id: `sim-evt-${++this.eventCounter}`,
      timestampMs: elapsed,
      t_ms: elapsed,
      timestamp: this.t0_ms + elapsed,
      type: 'scroll',
      x,
      y,
      normalizedX: x,
      normalizedY: y,
      rawPixelX: Math.round(x * this.viewport.width),
      rawPixelY: Math.round(y * this.viewport.height),
      deltaY,
    });

    return this;
  }

  public pause(duration_ms: number): this {
    if (!this.isRecording) throw new Error('Simulator is not started. Call start() first.');
    this.currentTime_ms += Math.max(0, duration_ms);
    return this;
  }

  public stop(endTime_ms?: number): RawRecordingSession {
    if (!this.isRecording) throw new Error('Simulator is not started. Call start() first.');
    this.isRecording = false;

    const tEnd = Math.max(this.currentTime_ms, endTime_ms ?? this.currentTime_ms);
    const duration_ms = Math.max(0, tEnd - this.t0_ms);

    const clickCount = this.events.filter((e) => e.type === 'click').length;
    const moveCount = this.events.filter((e) => e.type === 'move').length;
    const scrollCount = this.events.filter((e) => e.type === 'scroll' || e.type === 'wheel').length;
    const effectiveFps =
      duration_ms > 0
        ? Number(((this.events.length / duration_ms) * 1000).toFixed(2))
        : 0;

    const stats: RecordingSessionMetadata = {
      totalEvents: this.events.length,
      durationMs: duration_ms,
      resolution: {
        width: this.viewport.width,
        height: this.viewport.height,
      },
      recordedAt: new Date(this.t0_ms || Date.now()).toISOString(),
      clickCount,
      moveCount,
      scrollCount,
      effectiveFps,
    };

    return {
      id: `sim-session-${Date.now()}`,
      t0_ms: this.t0_ms,
      tEnd_ms: tEnd,
      duration_ms,
      viewport: this.viewport,
      fps: this.fps,
      events: [...this.events],
      videoMimeType: 'video/webm',
      stats,
    };
  }

  /**
   * Generates a realistic mock SaaS user workflow session.
   */
  public static createSampleSession(
    scenario: 'saas-nav-and-publish' | 'quick-click-sequence' | 'idle-hold',
    options?: { durationMs?: number; fps?: number }
  ): RawRecordingSession {
    const fps = options?.fps ?? 30;
    const sim = new HeadlessRecordingSimulator({ fps });
    sim.start(0);

    if (scenario === 'saas-nav-and-publish') {
      const totalMs = options?.durationMs ?? 6000;
      const scale = totalMs / 6000;
      // Step 1: User rests at center overview
      sim.moveTo(Math.round(200 * scale), 0.5, 0.5);
      // Step 2: Moves to search input
      sim.moveTo(Math.round(800 * scale), 0.45, 0.22);
      sim.click(Math.round(1200 * scale), 0.45, 0.22, {
        targetTag: 'INPUT',
        targetId: 'search-query',
        textSnippet: 'Find reports',
      });
      // Step 3: Dwell and move to table row
      sim.moveTo(Math.round(2200 * scale), 0.35, 0.48);
      sim.click(Math.round(2700 * scale), 0.35, 0.48, {
        targetTag: 'TR',
        targetId: 'row-analytics',
        textSnippet: 'Q3 Metric Fleet',
      });
      // Step 4: Move to primary hero Publish button
      sim.moveTo(Math.round(4000 * scale), 0.78, 0.65);
      sim.click(Math.round(4600 * scale), 0.78, 0.65, {
        targetTag: 'BUTTON',
        targetId: 'hero-publish-btn',
        textSnippet: 'Publish',
      });
      // Step 5: Settle
      sim.moveTo(Math.round(5200 * scale), 0.5, 0.5);
      return sim.stop(totalMs);
    }

    if (scenario === 'quick-click-sequence') {
      const totalMs = options?.durationMs ?? 2000;
      const scale = totalMs / 2000;
      sim.moveTo(Math.round(300 * scale), 0.2, 0.2);
      sim.click(Math.round(600 * scale), 0.2, 0.2);
      sim.moveTo(Math.round(1200 * scale), 0.8, 0.8);
      sim.click(Math.round(1500 * scale), 0.8, 0.8);
      return sim.stop(totalMs);
    }

    // 'idle-hold'
    const totalMs = options?.durationMs ?? 3000;
    return sim.stop(totalMs);
  }
}
