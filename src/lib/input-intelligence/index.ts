/**
 * src/lib/input-intelligence/index.ts
 *
 * Barrel export for Phase 5: Input Intelligence (Multimodal Analysis).
 */

export * from './schema';
export type {
  NormalizedBoundingBox,
  AnalyzeMediaOptions,
  SynthesizerOptions,
  FallbackOptions,
} from './types';
export * from './visual-fallback';
export * from './interaction-synthesizer';
export * from './gemini-vision-adapter';
