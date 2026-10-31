/**
 * schema.ts
 * Strict Zod validation schemas for InteractionMap and InteractionEvent contracts.
 */

import { z } from 'zod';

export const EventProvenanceSchema = z.enum(['observed', 'inferred', 'simulated']);

export const InteractionEventTypeSchema = z.enum(['click', 'hover', 'focus', 'scroll']);

export const BaseResolutionSchema = z.object({
  width: z.number().int().positive({ message: 'Base resolution width must be a positive integer' }),
  height: z.number().int().positive({ message: 'Base resolution height must be a positive integer' }),
});

export const InteractionEventSchema = z.object({
  id: z.string().min(1, { message: 'Event id cannot be empty' }),
  type: InteractionEventTypeSchema,
  frame: z.number().int().nonnegative({ message: 'Frame must be a non-negative integer' }),
  duration: z.number().int().positive({ message: 'Duration must be a positive integer' }).optional(),
  x: z.number().min(0.0).max(1.0, { message: 'Coordinate x must be normalized between 0.0 and 1.0' }),
  y: z.number().min(0.0).max(1.0, { message: 'Coordinate y must be normalized between 0.0 and 1.0' }),
  targetId: z.string().min(1).optional(),
  provenance: EventProvenanceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const InteractionMapSchema = z
  .object({
    version: z.literal('2.0'),
    baseResolution: BaseResolutionSchema,
    fps: z.number().int().positive({ message: 'FPS must be a positive integer' }),
    durationInFrames: z.number().int().positive({ message: 'Duration in frames must be a positive integer' }),
    events: z.array(InteractionEventSchema),
  })
  .refine(
    (data) => data.events.every((evt) => evt.frame <= data.durationInFrames),
    {
      message: 'All interaction events must occur within the durationInFrames limit',
      path: ['events'],
    }
  );

export type InteractionMapParsed = z.infer<typeof InteractionMapSchema>;
export type InteractionEventParsed = z.infer<typeof InteractionEventSchema>;
export type BaseResolutionParsed = z.infer<typeof BaseResolutionSchema>;
export type EventProvenanceParsed = z.infer<typeof EventProvenanceSchema>;
export type InteractionEventTypeParsed = z.infer<typeof InteractionEventTypeSchema>;
