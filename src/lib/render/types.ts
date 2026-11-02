/**
 * types.ts
 *
 * TypeScript interface contracts for Phase 7: Background Render Worker.
 * Strict types governing render jobs, settings, progress reporting, and queue states.
 */

import type { SceneGraph } from '../scene-graph/types';

export type RenderJobStatus =
  | 'queued'
  | 'rendering'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RenderStage =
  | 'bundling'
  | 'rendering_frames'
  | 'encoding'
  | 'muxing'
  | 'finished';

export type RenderCodec = 'h264' | 'h265' | 'vp8' | 'vp9' | 'prores';
export type RenderAudioCodec = 'aac' | 'mp3' | 'opus';
export type RenderImageFormat = 'jpeg' | 'png';

export interface RenderSettings {
  codec: RenderCodec;
  audioCodec: RenderAudioCodec;
  imageFormat: RenderImageFormat;
  quality: number; // 1 to 100
  scale: number; // 0.1 to 2.0
  concurrency: number; // worker thread concurrency (default 1)
  timeoutMs: number; // watchdog timeout in ms (default 180000 = 3 min)
  muted: boolean; // mute all audio
}

export interface RenderRequest {
  compositionId: 'InteractiveSurfaceDemo' | 'StudioShowcase' | 'LaunchDemo';
  sceneGraph?: SceneGraph;
  settings?: Partial<RenderSettings>;
}

export interface RenderError {
  code: string;
  message: string;
  details?: string;
}

export interface RenderJobProgress {
  status: RenderJobStatus;
  progress: number; // Normalized 0.0 to 1.0
  framesRendered: number;
  totalFrames: number;
  renderedBytes: number;
  currentStage: RenderStage;
  error?: RenderError;
}

export interface RenderJob extends RenderJobProgress {
  id: string;
  idempotencyKey: string;
  compositionId: string;
  sceneGraph?: SceneGraph;
  settings: RenderSettings;
  outputPath?: string;
  downloadUrl?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
}
