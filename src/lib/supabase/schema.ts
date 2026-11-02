/**
 * schema.ts
 *
 * Zod schemas for Phase 8 SaaS layer.
 * Validates untrusted client payloads before database insertion.
 */

import { z } from 'zod';
import { SceneGraphSchema } from '../scene-graph/schema';

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre no puede estar vacío')
    .max(120, 'El nombre no puede superar 120 caracteres'),
  sceneGraph: SceneGraphSchema,
  thumbnail_url: z.string().url().nullable().optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  sceneGraph: SceneGraphSchema.optional(),
  thumbnail_url: z.string().url().nullable().optional(),
});

export const ProjectSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  thumbnail_url: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ProjectResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  scene_graph: SceneGraphSchema,
  thumbnail_url: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const AssetUploadMetadataSchema = z.object({
  name: z.string().trim().min(1),
  projectId: z.string().uuid().optional(),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4']),
  sizeBytes: z.number().int().positive().max(104857600), // Max 100MB
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
export type ProjectSummary = z.infer<typeof ProjectSummarySchema>;
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;
export type AssetUploadMetadata = z.infer<typeof AssetUploadMetadataSchema>;
