/**
 * schema.ts
 *
 * Zod validation schemas for Phase 7 Background Render Worker.
 * Enforces strict input validation, settings limits, and idempotency key hashing.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import { SceneGraphSchema } from '../scene-graph/schema';

export const RenderJobStatusSchema = z.enum([
  'queued',
  'rendering',
  'completed',
  'failed',
  'cancelled',
]);

export const RenderStageSchema = z.enum([
  'bundling',
  'rendering_frames',
  'encoding',
  'muxing',
  'finished',
]);

export const RenderCodecSchema = z.enum([
  'h264',
  'h265',
  'vp8',
  'vp9',
  'prores',
]);

export const RenderAudioCodecSchema = z.enum([
  'aac',
  'mp3',
  'opus',
]);

export const RenderImageFormatSchema = z.enum([
  'jpeg',
  'png',
]);

export const RenderSettingsSchema = z.object({
  codec: RenderCodecSchema.default('h264'),
  audioCodec: RenderAudioCodecSchema.default('aac'),
  imageFormat: RenderImageFormatSchema.default('jpeg'),
  quality: z.number().int().min(1).max(100).default(80),
  scale: z.number().min(0.1).max(2.0).default(1.0),
  concurrency: z.number().int().min(1).max(16).default(1),
  timeoutMs: z.number().int().min(50).max(600000).default(180000), // 3 minutes default, max 10 mins
  muted: z.boolean().default(false),
});

export const RenderRequestSchema = z.object({
  compositionId: z
    .enum([
      'InteractiveSurfaceDemo',
      'VidiauraShowcase',
      'StudioShowcase',
      'LaunchDemo',
    ])
    .default('InteractiveSurfaceDemo'),
  sceneGraph: SceneGraphSchema.optional(),
  settings: RenderSettingsSchema.partial().default({}),
});

export const RenderErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.string().optional(),
});

export const RenderJobProgressSchema = z.object({
  status: RenderJobStatusSchema,
  progress: z.number().min(0).max(1),
  framesRendered: z.number().int().nonnegative(),
  totalFrames: z.number().int().nonnegative(),
  renderedBytes: z.number().int().nonnegative(),
  currentStage: RenderStageSchema,
  error: RenderErrorSchema.optional(),
});

export const RenderJobSchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  compositionId: z.string().min(1),
  sceneGraph: SceneGraphSchema.optional(),
  settings: RenderSettingsSchema,
  status: RenderJobStatusSchema,
  progress: z.number().min(0).max(1),
  framesRendered: z.number().int().nonnegative(),
  totalFrames: z.number().int().nonnegative(),
  renderedBytes: z.number().int().nonnegative(),
  currentStage: RenderStageSchema,
  outputPath: z.string().optional(),
  downloadUrl: z.string().optional(),
  error: RenderErrorSchema.optional(),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  createdAt: z.string(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
});

/**
 * Deterministically computes SHA-256 idempotency key for a render request.
 */
export function computeIdempotencyKey(
  compositionId: string,
  sceneGraph?: unknown,
  settings?: unknown
): string {
  const payload = {
    compositionId,
    sceneGraph: sceneGraph ?? null,
    settings: settings ?? {},
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
