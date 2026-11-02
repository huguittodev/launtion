/**
 * schema.ts
 *
 * Strict Zod validation schemas for Phase 6 Screen Recorder & Observed Telemetry.
 */

import { z } from 'zod';
import { BaseResolutionSchema, InteractionMapSchema } from '../interaction-map/schema';
import { SceneGraphSchema } from '../scene-graph/schema';

export const RecordedPointerEventTypeSchema = z.enum([
  'move',
  'click',
  'mousedown',
  'mouseup',
  'pointerdown',
  'pointerup',
  'wheel',
  'scroll',
  'hover',
]);

export const RawPointerEventTypeSchema = RecordedPointerEventTypeSchema;

export const TargetElementMetadataSchema = z.object({
  tagName: z.string().max(50),
  id: z.string().max(100).optional(),
  className: z.string().max(150).optional(),
  textSnippet: z.string().max(100).optional(),
});

export const RecordedPointerEventSchema = z.preprocess(
  (val) => {
    if (val && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const elapsed =
        typeof obj.timestampMs === 'number'
          ? obj.timestampMs
          : typeof obj.t_ms === 'number'
          ? obj.t_ms
          : 0;
      const ts =
        typeof obj.timestamp === 'number'
          ? obj.timestamp
          : elapsed;
      const normX =
        typeof obj.x === 'number'
          ? obj.x
          : typeof obj.normalizedX === 'number'
          ? obj.normalizedX
          : undefined;
      const normY =
        typeof obj.y === 'number'
          ? obj.y
          : typeof obj.normalizedY === 'number'
          ? obj.normalizedY
          : undefined;
      const targetTag =
        typeof obj.targetTag === 'string'
          ? obj.targetTag
          : typeof (obj.targetElement as Record<string, unknown> | undefined)?.tagName === 'string'
          ? ((obj.targetElement as Record<string, unknown>).tagName as string)
          : undefined;

      return {
        ...obj,
        timestampMs: elapsed,
        t_ms: elapsed,
        timestamp: ts,
        x: normX,
        y: normY,
        normalizedX: normX,
        normalizedY: normY,
        targetTag,
      };
    }
    return val;
  },
  z.object({
    id: z.string().min(1, { message: 'Event id cannot be empty' }),
    type: RecordedPointerEventTypeSchema,
    timestampMs: z.number().nonnegative({ message: 'Timestamp must be non-negative' }),
    t_ms: z.number().nonnegative({ message: 'Relative timestamp must be non-negative' }),
    x: z
      .number()
      .min(0.0, { message: 'Coordinate x must be in [0.0, 1.0]' })
      .max(1.0, { message: 'Coordinate x must be in [0.0, 1.0]' }),
    y: z
      .number()
      .min(0.0, { message: 'Coordinate y must be in [0.0, 1.0]' })
      .max(1.0, { message: 'Coordinate y must be in [0.0, 1.0]' }),
    normalizedX: z
      .number()
      .min(0.0, { message: 'Coordinate x must be in [0.0, 1.0]' })
      .max(1.0, { message: 'Coordinate x must be in [0.0, 1.0]' })
      .optional(),
    normalizedY: z
      .number()
      .min(0.0, { message: 'Coordinate y must be in [0.0, 1.0]' })
      .max(1.0, { message: 'Coordinate y must be in [0.0, 1.0]' })
      .optional(),
    rawPixelX: z.number().optional(),
    rawPixelY: z.number().optional(),
    clientX: z.number().optional(),
    clientY: z.number().optional(),
    button: z.number().int().min(0).max(5).optional(),
    targetTag: z.string().optional(),
    targetId: z.string().optional(),
    targetElement: TargetElementMetadataSchema.optional(),
    deltaY: z.number().optional(),
  })
);

export const RawPointerEventSchema = RecordedPointerEventSchema;

export const RecordingViewportSchema = z.object({
  width: z.number().int().positive({ message: 'Viewport width must be a positive integer' }),
  height: z.number().int().positive({ message: 'Viewport height must be a positive integer' }),
  devicePixelRatio: z.number().positive().default(1.0),
});

export const CursorCaptureModeSchema = z.enum(['never', 'always', 'motion']);

export const RecorderConfigSchema = z.object({
  fps: z.number().int().positive().default(30),
  maxDurationSeconds: z.number().int().min(1).max(300).default(60),
  throttleMs: z.number().positive().default(33),
  captureCursor: CursorCaptureModeSchema.default('never'),
  videoBitsPerSecond: z.number().int().positive().default(5_000_000),
  captureAudio: z.boolean().default(true),
  timesliceMs: z.number().int().positive().default(500),
});

export const StreamRecorderOptionsSchema = z.object({
  fps: z.number().int().min(15).max(120).default(30),
  maxDurationSeconds: z.number().int().min(1).max(300).default(60),
  throttleMs: z.number().positive().default(33),
  captureCursor: CursorCaptureModeSchema.default('never'),
  videoBitsPerSecond: z.number().int().positive().default(5_000_000),
  audio: z.boolean().default(true),
  timesliceMs: z.number().int().min(100).max(2000).default(500),
  mimeTypePreference: z.array(z.string()).optional(),
  video: z
    .object({
      cursor: CursorCaptureModeSchema.optional(),
      displaySurface: z.enum(['browser', 'window', 'monitor']).optional(),
      frameRate: z.object({ ideal: z.number().optional(), max: z.number().optional() }).optional(),
      width: z.object({ ideal: z.number().optional(), max: z.number().optional() }).optional(),
      height: z.object({ ideal: z.number().optional(), max: z.number().optional() }).optional(),
    })
    .optional(),
});

export const RecordingSessionStatusSchema = z.enum([
  'idle',
  'preparing',
  'recording',
  'paused',
  'stopping',
  'stopped',
  'review',
  'completed',
  'error',
]);

export const RecordingSessionMetadataSchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  resolution: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
  recordedAt: z.string().min(1),
  clickCount: z.number().int().nonnegative().optional(),
  moveCount: z.number().int().nonnegative().optional(),
  scrollCount: z.number().int().nonnegative().optional(),
  effectiveFps: z.number().nonnegative().optional(),
});

export const RecordingSessionSummarySchema = z.object({
  id: z.string().min(1),
  status: RecordingSessionStatusSchema,
  startedAt: z.number().nonnegative(),
  stoppedAt: z.number().nonnegative().optional(),
  durationMs: z.number().nonnegative(),
  durationInFrames: z.number().int().nonnegative(),
  baseResolution: BaseResolutionSchema,
  eventsCount: z.number().int().nonnegative(),
  clicksCount: z.number().int().nonnegative(),
  movesCount: z.number().int().nonnegative(),
  scrollsCount: z.number().int().nonnegative().optional(),
  effectiveFps: z.number().nonnegative(),
  videoMimeType: z.string().default('video/webm'),
  videoBlobSize: z.number().int().nonnegative().optional(),
  errorMessage: z.string().optional(),
});

export const RawRecordingSessionSchema = z
  .object({
    id: z.string().min(1),
    t0_ms: z.number().nonnegative(),
    tEnd_ms: z.number().nonnegative(),
    duration_ms: z.number().nonnegative(),
    viewport: RecordingViewportSchema,
    fps: z.number().int().positive().default(30),
    events: z.array(RecordedPointerEventSchema),
    videoMimeType: z.string().optional(),
    stats: RecordingSessionMetadataSchema,
  })
  .refine((data) => data.tEnd_ms >= data.t0_ms, {
    message: 'tEnd_ms must be greater than or equal to t0_ms',
    path: ['tEnd_ms'],
  })
  .refine(
    (data) => data.events.every((evt) => evt.timestampMs <= data.duration_ms + 100),
    {
      message: 'All event timestamps must occur within the recording duration',
      path: ['events'],
    }
  );

export const TelemetrySynthesizerOptionsSchema = z.object({
  fps: z.number().int().positive().default(30),
  baseWidth: z.number().int().positive().default(1920),
  baseHeight: z.number().int().positive().default(1080),
  minDwellMsForFocus: z.number().int().positive().default(300),
  clickZoom: z.number().min(1.0).max(3.5).default(2.2),
  overviewZoom: z.number().min(0.8).max(1.5).default(1.0),
  deduplicateMoveRadius: z.number().min(0.0).max(0.1).default(0.002),
  videoDataUri: z.string().optional(),
});

export const CompletedRecordingSessionSchema = z.object({
  id: z.string().min(1),
  videoBlobUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  metadata: RecordingSessionMetadataSchema,
  summary: RecordingSessionSummarySchema,
  events: z.array(RecordedPointerEventSchema),
  rawEvents: z.array(RecordedPointerEventSchema),
  interactionMap: InteractionMapSchema,
  sceneGraph: SceneGraphSchema,
});
