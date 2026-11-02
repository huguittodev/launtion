/**
 * src/lib/input-intelligence/interaction-synthesizer.ts
 *
 * Deterministic synthesis of authentic Inferred InteractionMap (v2.0)
 * from visual landmark detections, enforcing mandatory `provenance: 'inferred'`
 * on 100% of generated telemetry events.
 *
 * Transforms the synthesized InteractionMap into an executable Remotion SceneGraph
 * via `interactionToSceneGraphAdapter`.
 */

import { CoordinateMapper } from '../interaction-map/CoordinateMapper';
import { DEFAULT_ACCENT } from '../design/tokens';
import { InteractionMapSchema } from '../interaction-map/schema';
import type { InteractionEvent, InteractionMap } from '../interaction-map/types';
import { interactionToSceneGraphAdapter } from '../scene-graph/adapter';
import { SceneGraphSchema } from '../scene-graph/schema';
import type { SceneGraph } from '../scene-graph/types';
import type { SynthesizerOptions, VisualLandmark } from './types';

/**
 * Normalizes any coordinate safely to the [0.08, 0.92] padded active canvas bounds.
 */
function safeCoordinate(val: number): number {
  return CoordinateMapper.clamp(val, 0.08, 0.92);
}

/**
 * Synthesizes an Inferred InteractionMap (v2.0) with a choreographed 5-beat interaction sequence.
 * Every single interaction event MUST strictly have `provenance: 'inferred'`.
 */
export function synthesizeInferredInteractionMap(
  landmarks: VisualLandmark[],
  options?: SynthesizerOptions
): InteractionMap {
  const fps = options?.fps ?? 30;
  const duration = options?.durationInFrames ?? 480;
  const width = options?.baseWidth ?? 1920;
  const height = options?.baseHeight ?? 1080;

  // 1. Identify key UI landmarks by semantic category and labels
  const ctas = landmarks.filter((l) => l.category === 'cta');
  const inputs = landmarks.filter((l) => l.category === 'input');
  const cards = landmarks.filter((l) => l.category === 'card' || l.category === 'metric');
  const navs = landmarks.filter((l) => l.category === 'navigation' || l.category === 'tab');
  const others = landmarks.filter((l) => l.category === 'other');

  // Fallback landmarks if specific categories were not detected
  const ctaTarget =
    ctas[0] ||
    others.find((o) => /button|start|deploy|publish|submit|sign/i.test(o.label)) ||
    landmarks[0] || {
      id: 'fallback-cta',
      label: options?.productContext?.targetCtaLabel || 'Get Started',
      category: 'cta' as const,
      normalizedCenter: { x: 0.8, y: 0.65 },
      suggestedAction: 'click' as const,
    };

  const inputTarget =
    inputs[0] ||
    others.find((o) => /search|prompt|input|find|command/i.test(o.label)) || {
      id: 'fallback-input',
      label: 'Search or Command Palette',
      category: 'input' as const,
      normalizedCenter: { x: 0.5, y: 0.2 },
      suggestedAction: 'focus' as const,
    };

  const cardTarget =
    cards[0] ||
    others[0] || {
      id: 'fallback-card',
      label: 'Interactive Metrics Dashboard',
      category: 'metric' as const,
      normalizedCenter: { x: 0.42, y: 0.54 },
      suggestedAction: 'hover' as const,
    };

  const navTarget =
    navs[0] || {
      id: 'fallback-nav',
      label: 'Navigation & Workspace',
      category: 'navigation' as const,
      normalizedCenter: { x: 0.2, y: 0.08 },
      suggestedAction: 'focus' as const,
    };

  // Helper to scale beat frame proportionally to duration
  const scaleF = (ratio: number) => Math.min(duration - 1, Math.max(0, Math.round(ratio * duration)));

  // 2. Choreograph 5-Beat Narrative Sequence
  // Beat 1: Overview Hold (ratio 0.0 -> 0.07)
  // Beat 2: Input / Navigation Approach & Focus (ratio 0.10 -> 0.22)
  // Beat 3: Hero / Metric Card Inspection (ratio 0.28 -> 0.46)
  // Beat 4: Primary CTA Bezier Approach & Click (ratio 0.55 -> 0.72)
  // Beat 5: Wide Outro Pullback & Settle Hold (ratio 0.80 -> 1.0)

  const events: InteractionEvent[] = [
    // Beat 1: Overview Hold
    {
      id: 'inferred-evt-01-overview',
      type: 'focus',
      frame: scaleF(0.0),
      duration: Math.max(15, scaleF(0.07)),
      x: 0.5,
      y: 0.5,
      provenance: 'inferred',
      metadata: {
        zoomTarget: 1.0,
        description: 'Wide establishing overview hold',
      },
    },

    // Beat 2: Input Approach & Focus
    {
      id: `inferred-evt-02-${navTarget.id}`,
      type: 'hover',
      frame: scaleF(0.1),
      duration: Math.max(10, scaleF(0.06)),
      x: safeCoordinate(navTarget.normalizedCenter.x),
      y: safeCoordinate(navTarget.normalizedCenter.y),
      targetId: navTarget.id,
      provenance: 'inferred',
      metadata: {
        targetElement: navTarget.label,
        category: navTarget.category,
      },
    },
    {
      id: `inferred-evt-03-${inputTarget.id}`,
      type: 'focus',
      frame: scaleF(0.18),
      duration: Math.max(15, scaleF(0.08)),
      x: safeCoordinate(inputTarget.normalizedCenter.x),
      y: safeCoordinate(inputTarget.normalizedCenter.y),
      targetId: inputTarget.id,
      provenance: 'inferred',
      metadata: {
        zoomTarget: 1.5,
        audioCue: 'keyboard-tap',
        targetElement: inputTarget.label,
        category: inputTarget.category,
      },
    },

    // Beat 3: Card / Metric Inspection
    {
      id: `inferred-evt-04-${cardTarget.id}-approach`,
      type: 'hover',
      frame: scaleF(0.28),
      duration: Math.max(10, scaleF(0.05)),
      x: safeCoordinate(cardTarget.normalizedCenter.x),
      y: safeCoordinate(cardTarget.normalizedCenter.y),
      targetId: cardTarget.id,
      provenance: 'inferred',
      metadata: {
        targetElement: cardTarget.label,
      },
    },
    {
      id: `inferred-evt-05-${cardTarget.id}-inspect`,
      type: 'focus',
      frame: scaleF(0.34),
      duration: Math.max(25, scaleF(0.14)),
      x: safeCoordinate(cardTarget.normalizedCenter.x),
      y: safeCoordinate(cardTarget.normalizedCenter.y),
      targetId: cardTarget.id,
      provenance: 'inferred',
      metadata: {
        zoomTarget: 2.1,
        rotateX: 2.5,
        rotateY: -1.5,
        audioCue: 'camera-whoosh',
        targetElement: cardTarget.label,
        category: cardTarget.category,
      },
    },

    // Beat 4: Primary CTA Focus, Approach & Click
    {
      id: `inferred-evt-06-${ctaTarget.id}-focus`,
      type: 'focus',
      frame: scaleF(0.56),
      duration: Math.max(20, scaleF(0.12)),
      x: safeCoordinate(ctaTarget.normalizedCenter.x),
      y: safeCoordinate(ctaTarget.normalizedCenter.y),
      targetId: ctaTarget.id,
      provenance: 'inferred',
      metadata: {
        zoomTarget: 2.35,
        audioCue: 'camera-whoosh',
        targetElement: ctaTarget.label,
      },
    },
    {
      id: `inferred-evt-07-${ctaTarget.id}-approach`,
      type: 'hover',
      frame: scaleF(0.62),
      duration: Math.max(10, scaleF(0.05)),
      x: safeCoordinate(ctaTarget.normalizedCenter.x),
      y: safeCoordinate(ctaTarget.normalizedCenter.y),
      targetId: ctaTarget.id,
      provenance: 'inferred',
      metadata: {
        targetElement: ctaTarget.label,
      },
    },
    {
      id: `inferred-evt-08-${ctaTarget.id}-click`,
      type: 'click',
      frame: scaleF(0.68),
      duration: 15,
      x: safeCoordinate(ctaTarget.normalizedCenter.x),
      y: safeCoordinate(ctaTarget.normalizedCenter.y),
      targetId: ctaTarget.id,
      provenance: 'inferred',
      metadata: {
        button: 'primary',
        clickRipple: true,
        audioCue: 'mouse-click',
        targetElement: ctaTarget.label,
        category: ctaTarget.category,
      },
    },

    // Beat 5: Outro Pullback & Settle
    {
      id: 'inferred-evt-09-pullback',
      type: 'focus',
      frame: scaleF(0.78),
      duration: Math.max(20, scaleF(0.1)),
      x: 0.5,
      y: 0.5,
      provenance: 'inferred',
      metadata: {
        zoomTarget: 1.0,
        audioCue: 'camera-whoosh',
        description: 'Pullback to canvas overview',
      },
    },
    {
      id: 'inferred-evt-10-settle',
      type: 'focus',
      frame: scaleF(0.9),
      duration: Math.max(20, duration - scaleF(0.9)),
      x: 0.5,
      y: 0.5,
      provenance: 'inferred',
      metadata: {
        zoomTarget: 1.0,
        audioCue: 'chime',
        description: 'Outro settle hold',
      },
    },
  ];

  // Guarantee every event has provenance: 'inferred'
  const sanitizedEvents = events.map((evt) => ({
    ...evt,
    provenance: 'inferred' as const,
    frame: Math.max(0, Math.min(duration - 1, evt.frame)),
  }));

  const rawMap: InteractionMap = {
    version: '2.0',
    baseResolution: { width, height },
    fps,
    durationInFrames: duration,
    events: sanitizedEvents,
  };

  // Validate strictly against schema
  return InteractionMapSchema.parse(rawMap);
}

/**
 * Transforms an Inferred InteractionMap into a broadcast-quality SceneGraph (v2.0).
 */
export function adaptInferredInteractionToSceneGraph(
  interactionMap: InteractionMap,
  options?: SynthesizerOptions
): SceneGraph {
  const sceneGraph = interactionToSceneGraphAdapter(interactionMap, {
    artDirection: {
      backdropVariant: 'dark-precision',
      surfaceTheme: 'dark',
      primaryAccent: DEFAULT_ACCENT,
    },
  });

  // If asset data URI was provided, enrich the 3D surface scene payload
  if (options?.assetDataUri) {
    const surfaceScene = sceneGraph.scenes.find((s) => s.type === 'product_interaction_3d');
    if (surfaceScene && surfaceScene.payload) {
      surfaceScene.payload.mockInterface = options.assetDataUri;
      surfaceScene.payload.url = options.assetDataUri;
      if (options.assetFilename) {
        surfaceScene.payload.windowTitle = options.assetFilename;
      }
    }
  }

  return SceneGraphSchema.parse(sceneGraph);
}
