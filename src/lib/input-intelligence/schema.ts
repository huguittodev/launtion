/**
 * src/lib/input-intelligence/schema.ts
 *
 * Strict Zod validation schemas for Input Intelligence (Multimodal Analysis).
 * Validates multimodal upload payloads, visual landmark detections, and API response contracts.
 */

import { z } from 'zod';
import { InteractionMapSchema } from '../interaction-map/schema';
import { SceneGraphSchema } from '../scene-graph/schema';

export const AllowedMimeTypesEnum = z.enum([
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
]);

export type AllowedMimeType = z.infer<typeof AllowedMimeTypesEnum>;

export const MediaTypeEnum = z.enum(['image', 'video']);
export type MediaType = z.infer<typeof MediaTypeEnum>;

export const DetectedElementCategorySchema = z.enum([
  'cta',
  'input',
  'card',
  'navigation',
  'metric',
  'tab',
  'other',
]);

export type DetectedElementCategory = z.infer<typeof DetectedElementCategorySchema>;

export const SuggestedActionSchema = z.enum(['click', 'hover', 'focus', 'scroll']);
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

/**
 * 2D Bounding box tuple [ymin, xmin, ymax, xmax].
 * May be provided as normalized unit floats [0.0, 1.0] or base-1000 integers [0, 1000].
 */
export const Box2dTupleSchema = z.tuple([
  z.number(), // ymin
  z.number(), // xmin
  z.number(), // ymax
  z.number(), // xmax
]);

export type Box2dTuple = z.infer<typeof Box2dTupleSchema>;

export const VisualLandmarkSchema = z.object({
  id: z.string().min(1, 'Landmark id is required'),
  label: z.string().min(1, 'Landmark label is required').max(100),
  category: DetectedElementCategorySchema,
  type: z.string().optional(),
  box2d: Box2dTupleSchema.optional(),
  normalizedCenter: z.object({
    x: z.number().min(0.0).max(1.0),
    y: z.number().min(0.0).max(1.0),
  }),
  confidence: z.number().min(0.0).max(1.0).default(1.0),
  suggestedAction: SuggestedActionSchema.default('click'),
  targetZoom: z.number().min(0.8).max(3.5).optional(),
});

export type VisualLandmark = z.infer<typeof VisualLandmarkSchema>;
export const DetectedElementSchema = VisualLandmarkSchema;
export type DetectedElement = VisualLandmark;

export const InputContextSchema = z.object({
  title: z.string().trim().max(100).optional(),
  productType: z.string().trim().max(80).optional(),
  targetCtaLabel: z.string().trim().max(60).optional(),
});

export type InputContext = z.infer<typeof InputContextSchema>;

/**
 * Validates base64 string and checks approximate decoded size <= 20 MB.
 */
function validateBase64Data(val: string): boolean {
  const raw = val.includes(',') ? val.split(',')[1] : val;
  const stripped = raw.replace(/\s+/g, '');
  if (stripped.length === 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(stripped);
}

function validateBase64Size(val: string, maxBytes = 20 * 1024 * 1024): boolean {
  const raw = val.includes(',') ? val.split(',')[1] : val;
  const stripped = raw.replace(/\s+/g, '');
  const approximateBytes = (stripped.length * 3) / 4;
  return approximateBytes <= maxBytes;
}

export const InputIntelligencePayloadSchema = z
  .object({
    // Support fileBase64, base64Data, or fileData
    fileBase64: z.string().optional(),
    base64Data: z.string().optional(),
    fileData: z.string().optional(),

    mimeType: AllowedMimeTypesEnum,
    mediaType: MediaTypeEnum.optional(),
    filename: z.string().trim().max(150).optional(),
    fileName: z.string().trim().max(150).optional(),

    prompt: z.string().trim().max(500).optional(),
    productContext: InputContextSchema.optional(),
    context: InputContextSchema.optional(),

    targetDurationInFrames: z.number().int().min(60).max(1200).optional().default(480),
    fps: z.number().int().positive().optional().default(30),
  })
  .refine(
    (data) => Boolean(data.fileBase64 || data.base64Data || data.fileData),
    {
      message: 'fileBase64, base64Data, or fileData is required',
      path: ['base64Data'],
    }
  )
  .refine(
    (data) => {
      const payload = data.fileBase64 || data.base64Data || data.fileData;
      if (!payload) return false;
      return validateBase64Data(payload);
    },
    {
      message: 'Invalid base64 encoding format',
      path: ['base64Data'],
    }
  )
  .refine(
    (data) => {
      const payload = data.fileBase64 || data.base64Data || data.fileData;
      if (!payload) return false;
      return validateBase64Size(payload);
    },
    {
      message: 'File size exceeds maximum 20MB limit',
      path: ['base64Data'],
    }
  );

export type InputIntelligencePayload = z.infer<typeof InputIntelligencePayloadSchema>;
export type InputIntelligencePayloadInput = z.input<typeof InputIntelligencePayloadSchema>;

export const InputIntelligenceRequestSchema = InputIntelligencePayloadSchema;
export type InputIntelligenceRequest = InputIntelligencePayload;
export type InputIntelligenceRequestInput = InputIntelligencePayloadInput;

export const InputIntelligenceResultSchema = z.object({
  success: z.boolean(),
  source: z.enum(['gemini', 'gemini-vision', 'deterministic-fallback']),
  model: z.string().optional(),
  reason: z.string().optional(),
  latencyMs: z.number(),
  summary: z.string(),
  landmarks: z.array(VisualLandmarkSchema),
  detectedElements: z.array(VisualLandmarkSchema),
  interactionMap: InteractionMapSchema,
  sceneGraph: SceneGraphSchema,
  asset: z
    .object({
      filename: z.string().optional(),
      mimeType: z.string(),
      dataUri: z.string().optional(),
    })
    .optional(),
});

export type InputIntelligenceResult = z.infer<typeof InputIntelligenceResultSchema>;
export const InputIntelligenceResponseSchema = InputIntelligenceResultSchema;
export type InputIntelligenceResponse = InputIntelligenceResult;
