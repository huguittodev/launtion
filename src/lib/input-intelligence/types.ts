/**
 * src/lib/input-intelligence/types.ts
 *
 * TypeScript types and interfaces for Input Intelligence (Multimodal Analysis).
 */

import type { AllowedMimeType, InputContext } from './schema';

export type {
  AllowedMimeType,
  Box2dTuple,
  DetectedElement,
  DetectedElementCategory,
  InputContext,
  InputIntelligencePayload,
  InputIntelligencePayloadInput,
  InputIntelligenceRequest,
  InputIntelligenceResponse,
  InputIntelligenceResult,
  MediaType,
  SuggestedAction,
  VisualLandmark,
} from './schema';

export interface NormalizedBoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface AnalyzeMediaOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

export interface SynthesizerOptions {
  fps?: number;
  durationInFrames?: number;
  targetDurationInFrames?: number;
  baseWidth?: number;
  baseHeight?: number;
  productContext?: InputContext;
  assetDataUri?: string;
  assetFilename?: string;
  /** width/height of the user's recording (used to map detected pixels onto the canvas). */
  mediaAspect?: number;
  /** Duration in seconds when the media is a video. */
  mediaDurationSeconds?: number;
}

export interface FallbackOptions {
  fps?: number;
  durationInFrames?: number;
  targetDurationInFrames?: number;
  baseWidth?: number;
  baseHeight?: number;
  productContext?: InputContext;
  assetDataUri?: string;
  assetFilename?: string;
  mimeType?: AllowedMimeType;
}
