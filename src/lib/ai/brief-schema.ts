/**
 * brief-schema.ts
 *
 * Strict Zod validation schemas and TypeScript types for the SaaS Product Brief.
 * Governs all inputs consumed by the Creative Director Agent (Gemini & Deterministic Fallback).
 */

import { z } from 'zod';
import { BackdropVariantSchema, HexColorRegex, SurfaceThemeSchema } from '../scene-graph/schema';

export const BrandToneSchema = z.enum([
  'tech-precision',
  'punchy-social',
  'editorial-clean',
  'minimal',
  'modern-punchy',
  'minimal-editorial',
  'technical-precision',
]);

export type BrandTone = z.infer<typeof BrandToneSchema>;

export const ProductGoalSchema = z.enum([
  'launch',
  'feature_announcement',
  'product_demo',
  'version_update',
]);

export type ProductGoal = z.infer<typeof ProductGoalSchema>;

export const BriefAssetSchema = z.object({
  assetId: z.string().min(1),
  kind: z.enum(['image', 'screen_recording', 'logo']),
  url: z.string().url().optional(),
  label: z.string().max(80).optional(),
});

export type BriefAsset = z.infer<typeof BriefAssetSchema>;

export const ProductBriefSchema = z.object({
  productName: z
    .string()
    .trim()
    .min(1, 'Product name is required')
    .max(50, 'Max 50 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Max 500 characters'),
  tagline: z.string().trim().max(100, 'Max 100 characters').optional(),
  targetAudience: z.string().trim().max(100).optional().default('Modern Software Teams'),
  goal: ProductGoalSchema.optional().default('launch'),
  tone: BrandToneSchema.optional().default('tech-precision'),
  primaryColor: z
    .string()
    .regex(HexColorRegex, 'Invalid hex color (#RGB or #RRGGBB)')
    .optional(),
  accentColor: z
    .string()
    .regex(HexColorRegex, 'Invalid hex color (#RGB or #RRGGBB)')
    .optional(),
  backdropVariant: BackdropVariantSchema.optional(),
  surfaceTheme: SurfaceThemeSchema.optional(),
  features: z
    .array(z.string().trim().min(1).max(60))
    .max(5)
    .optional()
    .default([]),
  ctaText: z.string().trim().max(30).optional().default('Get Started Free'),
  durationSeconds: z.number().int().min(15).max(20).optional().default(16),
  targetDurationInFrames: z.number().int().positive().optional().default(480),
  fps: z.number().int().positive().optional().default(30),
  resolution: z
    .object({
      width: z.number().int().positive().default(1920),
      height: z.number().int().positive().default(1080),
    })
    .optional()
    .default({ width: 1920, height: 1080 }),
  assets: z.array(BriefAssetSchema).max(5).optional().default([]),
});

export type ProductBrief = z.infer<typeof ProductBriefSchema>;
export type ProductBriefInput = z.input<typeof ProductBriefSchema>;

