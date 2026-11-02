/**
 * simple-edit.ts
 *
 * Pure helpers for Vidiaura's minimalist editor. They expose only the handful of
 * things a non-technical user may change (4 texts, style, format) and apply them to
 * a SceneGraph, always re-validating with SceneGraphSchema. Invalid edits are
 * rejected (the previous graph is returned) so the player can never break.
 */

import { remapCanvasPoint } from '../scene-graph/media-layout';
import { SceneGraphSchema } from '../scene-graph/schema';
import type { MotionArchetype, SceneGraph } from '../scene-graph/types';
import { neutral, sceneThemes, signal } from '../design/tokens';

export interface SimpleTexts {
  hook: string;
  valueProp: string;
  cta: string;
  productName: string;
}

export type AspectFormat = '16:9' | '9:16';

export const SIMPLE_TEXT_LIMITS = {
  hook: 120,
  valueProp: 100,
  cta: 30,
  productName: 50,
} as const;

export interface StylePreset {
  id: MotionArchetype;
  label: string;
  description: string;
  swatch: [string, string];
  backdropVariant: SceneGraph['artDirection']['backdropVariant'];
  surfaceTheme: SceneGraph['artDirection']['surfaceTheme'];
}

export const STYLE_PRESETS: readonly StylePreset[] = [
  {
    id: 'base44-studio',
    label: 'Base44 Studio',
    description: 'Crema cálido, UI flotante en 3D y tipografía bold.',
    swatch: [sceneThemes.lightEditorial.background, sceneThemes.lightEditorial.accent],
    backdropVariant: 'light-editorial',
    surfaceTheme: 'light',
  },
  {
    id: 'linear-dark',
    label: 'Linear Dark',
    description: 'Obsidiana con bordes de neón sutil y estilo ultra-limpio.',
    swatch: [sceneThemes.darkPrecision.background, signal.indigoBright],
    backdropVariant: 'dark-precision',
    surfaceTheme: 'dark',
  },
  {
    id: 'bento-grid',
    label: 'Bento Grid',
    description: 'Retícula de funcionalidades que converge al centro.',
    swatch: [neutral.stone, neutral.ink],
    backdropVariant: 'solid',
    surfaceTheme: 'light',
  },
  {
    id: 'kinetic-hook',
    label: 'Kinetic Hook',
    description: 'Palabras gigantes animadas antes de revelar la app.',
    swatch: [sceneThemes.playful.background, sceneThemes.playful.accent],
    backdropVariant: 'aurora-blur',
    surfaceTheme: 'dark',
  },
] as const;

export function isMotionArchetype(value: unknown): value is MotionArchetype {
  return STYLE_PRESETS.some((p) => p.id === value);
}

const FORMAT_SIZES: Record<AspectFormat, { width: number; height: number }> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

export function getAspectFormat(graph: SceneGraph): AspectFormat {
  return graph.canvas.width < graph.canvas.height ? '9:16' : '16:9';
}

function firstPayload(
  graph: SceneGraph,
  type: string
): Record<string, unknown> | undefined {
  const scene = graph.scenes.find((s) => s.type === type);
  return scene ? (scene.payload as unknown as Record<string, unknown>) : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/** Reads the 4 user-facing texts from whichever scenes carry them. */
export function readSimpleTexts(graph: SceneGraph): SimpleTexts {
  const kinetic = firstPayload(graph, 'kinetic_typography');
  const prompt = firstPayload(graph, 'synthetic_prompt_box');
  const closing = firstPayload(graph, 'brand_closing_cta');
  const hero = firstPayload(graph, 'synthetic_hero_button');
  const product = firstPayload(graph, 'product_interaction_3d');

  const kineticWords = Array.isArray(kinetic?.words)
    ? (kinetic.words as unknown[]).filter((w): w is string => typeof w === 'string').join(' ')
    : undefined;

  return {
    hook: str(kineticWords) ?? str(prompt?.textToType) ?? '',
    valueProp: str(closing?.tagline) ?? str(product?.tagline) ?? '',
    cta: str(closing?.buttonText) ?? str(hero?.buttonText) ?? str(product?.buttonText) ?? '',
    productName: str(closing?.productName) ?? str(product?.productName) ?? '',
  };
}

export interface EditResult {
  graph: SceneGraph;
  ok: boolean;
  error?: string;
}

function validate(candidate: SceneGraph, fallback: SceneGraph): EditResult {
  const parsed = SceneGraphSchema.safeParse(candidate);
  if (parsed.success) return { graph: parsed.data, ok: true };
  return {
    graph: fallback,
    ok: false,
    error: parsed.error.issues[0]?.message ?? 'Cambio no válido',
  };
}

/** Applies a single text edit. Empty strings are ignored for required fields. */
export function applySimpleText(
  graph: SceneGraph,
  field: keyof SimpleTexts,
  rawValue: string
): EditResult {
  const value = rawValue.slice(0, SIMPLE_TEXT_LIMITS[field]);
  const candidate = structuredClone(graph);

  for (const scene of candidate.scenes) {
    const p = scene.payload as unknown as Record<string, unknown>;
    switch (field) {
      case 'hook':
        if (scene.type === 'kinetic_typography') {
          const words = value.split(/\s+/).filter(Boolean);
          if (words.length > 0) {
            p.words = words;
            if (typeof p.accentWordIndex === 'number' && p.accentWordIndex >= words.length) {
              p.accentWordIndex = words.length - 1;
            }
          }
        } else if (scene.type === 'synthetic_prompt_box' && value.trim().length > 0) {
          p.textToType = value;
        }
        break;
      case 'valueProp':
        if (scene.type === 'brand_closing_cta' && value.trim().length > 0) p.tagline = value;
        else if (scene.type === 'product_interaction_3d' && 'tagline' in p) p.tagline = value;
        break;
      case 'cta':
        if (value.trim().length === 0) break;
        if (
          scene.type === 'brand_closing_cta' ||
          scene.type === 'synthetic_hero_button' ||
          scene.type === 'product_interaction_3d'
        ) {
          if (scene.type !== 'product_interaction_3d' || 'buttonText' in p) p.buttonText = value;
        }
        break;
      case 'productName':
        if (value.trim().length === 0) break;
        if (scene.type === 'brand_closing_cta') p.productName = value;
        else if (scene.type === 'product_interaction_3d' && 'productName' in p) p.productName = value;
        break;
    }
  }
  return validate(candidate, graph);
}

/** Applies one of the 4 style presets (archetype + matching backdrop/theme). */
export function applyStyle(graph: SceneGraph, archetype: MotionArchetype): EditResult {
  const preset = STYLE_PRESETS.find((p) => p.id === archetype);
  if (!preset) return { graph, ok: false, error: 'Estilo desconocido' };
  const candidate = structuredClone(graph);
  candidate.artDirection = {
    ...candidate.artDirection,
    archetype: preset.id,
    backdropVariant: preset.backdropVariant,
    surfaceTheme: preset.surfaceTheme,
  };
  return validate(candidate, graph);
}

/** Switches between 16:9 and 9:16. Camera keyframes are normalized so they carry over. */
export function applyAspect(graph: SceneGraph, format: AspectFormat): EditResult {
  const size = FORMAT_SIZES[format];
  if (!size) return { graph, ok: false, error: 'Formato desconocido' };
  const candidate = structuredClone(graph);
  const from = { width: graph.canvas.width, height: graph.canvas.height };
  const to = { width: size.width, height: size.height };
  const surface = candidate.scenes.find((s) => s.type === 'product_interaction_3d');
  const aspect =
    surface && surface.type === 'product_interaction_3d' ? surface.payload.mediaAspect : undefined;
  if (from.width !== to.width || from.height !== to.height) {
    // Keep cursor and camera on the same pixel of the recording after the reframe.
    const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
    for (const kf of candidate.cursorTrack ?? []) {
      const p = remapCanvasPoint(from, to, aspect, { x: kf.x, y: kf.y });
      kf.x = clamp01(p.x);
      kf.y = clamp01(p.y);
      if (kf.controlX !== undefined && kf.controlY !== undefined) {
        const c = remapCanvasPoint(from, to, aspect, { x: kf.controlX, y: kf.controlY });
        kf.controlX = clamp01(c.x);
        kf.controlY = clamp01(c.y);
      }
    }
    for (const kf of candidate.cameraTrack ?? []) {
      const p = remapCanvasPoint(from, to, aspect, { x: kf.x, y: kf.y });
      kf.x = clamp01(p.x);
      kf.y = clamp01(p.y);
    }
  }
  candidate.canvas = { ...candidate.canvas, width: size.width, height: size.height };
  return validate(candidate, graph);
}

/** Sets the user's real recording/screenshot on every product_interaction_3d or media_showcase scene. */
export function applyUserMedia(
  graph: SceneGraph,
  mediaUrl: string | null,
  mediaAspect?: number
): EditResult {
  if (!mediaUrl) return { graph, ok: true };
  const candidate = structuredClone(graph);
  let touched = false;
  for (const scene of candidate.scenes) {
    if (scene.type === 'product_interaction_3d') {
      scene.payload.url = mediaUrl;
      if (mediaAspect) scene.payload.mediaAspect = mediaAspect;
      touched = true;
    } else if (scene.type === 'media_showcase') {
      scene.payload.mediaUrl = mediaUrl;
      scene.payload.zoomScale = 1.15;
      scene.payload.mediaType = mediaUrl.includes('video') || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm') ? 'video' : 'image';
      touched = true;
    }
  }

  // If no dedicated media scene exists, convert the central scene to media_showcase
  if (!touched && candidate.scenes.length >= 2) {
    const targetIdx = Math.min(1, candidate.scenes.length - 2);
    const existing = candidate.scenes[targetIdx];
    const prevPayload = existing.payload as Record<string, unknown>;
    candidate.scenes[targetIdx] = {
      id: `media-showcase-${existing.id}`,
      type: 'media_showcase',
      startFrame: existing.startFrame,
      fromFrame: existing.startFrame,
      durationInFrames: existing.durationInFrames,
      payload: {
        mediaUrl,
        mediaType: mediaUrl.includes('video') || mediaUrl.endsWith('.mp4') || mediaUrl.endsWith('.webm') ? 'video' : 'image',
        headline: (typeof prevPayload.headline === 'string' && prevPayload.headline) || (typeof prevPayload.productName === 'string' && prevPayload.productName) || 'Product Interface',
        tagline: typeof prevPayload.tagline === 'string' ? prevPayload.tagline : 'Live Demonstration',
        zoomScale: 1.15,
      },
    };
    touched = true;
  }

  if (!touched) return { graph, ok: true };
  return validate(candidate, graph);
}

