/**
 * src/lib/input-intelligence/visual-fallback.ts
 *
 * Deterministic Algorithmic Layout Fallback for Input Intelligence.
 * Synthesizes standard SaaS interface topology landmarks based on golden-ratio UI zones.
 *
 * Guaranteed execution in < 5ms with zero external network requests.
 * Used when GEMINI_API_KEY is not set or when upstream Gemini API calls fail or time out.
 */

import {
  adaptInferredInteractionToSceneGraph,
  synthesizeInferredInteractionMap,
} from './interaction-synthesizer';
import type { FallbackOptions, InputIntelligenceResult, VisualLandmark } from './types';

/**
 * Canonical SaaS UI landmarks generated deterministically.
 */
export function generateCanonicalSaaSVisualLandmarks(
  targetCtaLabel?: string
): VisualLandmark[] {
  return [
    {
      id: 'fallback-nav-01',
      label: 'Navigation Header & Workspace',
      category: 'navigation',
      type: 'nav_bar',
      box2d: [20, 40, 100, 960],
      normalizedCenter: { x: 0.2, y: 0.08 },
      confidence: 0.98,
      suggestedAction: 'focus',
      targetZoom: 1.25,
    },
    {
      id: 'fallback-search-02',
      label: 'Search & Command Palette (Cmd+K)',
      category: 'input',
      type: 'search_input',
      box2d: [160, 220, 240, 780],
      normalizedCenter: { x: 0.5, y: 0.2 },
      confidence: 0.95,
      suggestedAction: 'focus',
      targetZoom: 1.5,
    },
    {
      id: 'fallback-metric-03',
      label: 'Real-Time Telemetry & Metric Surface',
      category: 'metric',
      type: 'hero_card',
      box2d: [300, 120, 720, 880],
      normalizedCenter: { x: 0.42, y: 0.54 },
      confidence: 0.96,
      suggestedAction: 'hover',
      targetZoom: 2.1,
    },
    {
      id: 'fallback-cta-04',
      label: targetCtaLabel?.trim() || 'Deploy & Publish',
      category: 'cta',
      type: 'primary_cta',
      box2d: [600, 740, 680, 920],
      normalizedCenter: { x: 0.8, y: 0.65 },
      confidence: 0.99,
      suggestedAction: 'click',
      targetZoom: 2.35,
    },
    {
      id: 'fallback-pill-05',
      label: 'Active Filter / Environment Chip',
      category: 'other',
      type: 'pill_button',
      box2d: [740, 680, 820, 860],
      normalizedCenter: { x: 0.72, y: 0.78 },
      confidence: 0.92,
      suggestedAction: 'hover',
      targetZoom: 1.7,
    },
  ];
}

/**
 * Generates an authentic deterministic visual fallback result with zero network dependencies.
 * Satisfies all Zod schemas, ensures provenance: 'inferred', and executes in < 5ms.
 */
export function generateDeterministicVisualFallback(
  options?: FallbackOptions & { reason?: string }
): InputIntelligenceResult {
  const startTime = performance.now();

  const landmarks = generateCanonicalSaaSVisualLandmarks(
    options?.productContext?.targetCtaLabel
  );

  const interactionMap = synthesizeInferredInteractionMap(landmarks, {
    fps: options?.fps ?? 30,
    durationInFrames: options?.durationInFrames ?? options?.targetDurationInFrames ?? 480,
    baseWidth: options?.baseWidth ?? 1920,
    baseHeight: options?.baseHeight ?? 1080,
    productContext: options?.productContext,
  });

  const sceneGraph = adaptInferredInteractionToSceneGraph(interactionMap, {
    assetDataUri: options?.assetDataUri,
    assetFilename: options?.assetFilename,
  });

  const latencyMs = Math.round(performance.now() - startTime);

  return {
    success: true,
    source: 'deterministic-fallback',
    reason: options?.reason,
    latencyMs,
    summary:
      'Topología SaaS canónica sintetizada deterministamente (zonas áureas: navegación, búsqueda, métricas y CTA primario).',
    landmarks,
    detectedElements: landmarks,
    interactionMap,
    sceneGraph,
    asset: options?.assetDataUri
      ? {
          filename: options.assetFilename,
          mimeType: options.mimeType ?? 'image/png',
          dataUri: options.assetDataUri,
        }
      : undefined,
  };
}
