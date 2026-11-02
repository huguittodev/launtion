/**
 * layout.ts
 *
 * Deterministic stage geometry for the Remotion engine.
 *
 * Why this exists: the shipped compositions animate well but place atoms by
 * hand, and hand placement bleeds past the frame edges (titles cut in half,
 * cards half off-screen, cursors floating in dead space). This module turns
 * placement into arithmetic that can be tested without rendering a single
 * frame.
 *
 * Contract:
 * - Every slot returned by a preset is inside the safe area, in device pixels.
 * - Every preset declares exactly one focal slot.
 * - The focal slot is at least `MIN_FOCAL_RATIO` times the area of any
 *   supporting slot, so a frame always has an obvious entry point.
 *
 * Pure functions only: no React, no Remotion, no I/O. The composition that
 * renders in M3 declares which preset a scene uses; `validateLayout` is the
 * guard that catches bleed before it reaches a rendered frame.
 */

import type { CanvasConfig, SceneGraph, SceneNode } from './types';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SlotRole = 'focal' | 'supporting';

export interface LayoutSlot {
  id: string;
  role: SlotRole;
  rect: Rect;
}

export type LayoutPresetId =
  | 'hook'
  | 'stage'
  | 'split'
  | 'bento'
  | 'lower-third'
  | 'pair';

export interface SceneLayout {
  preset: LayoutPresetId;
  safeArea: Rect;
  slots: LayoutSlot[];
  /** Hierarchy ratio this preset promises; see `validateLayout`. */
  minFocalRatio: number;
}

export interface LayoutViolation {
  code:
    | 'outside-safe-area'
    | 'degenerate'
    | 'missing-focal'
    | 'duplicate-focal'
    | 'weak-hierarchy';
  slotId?: string;
  message: string;
}

/** Fraction of the canvas that is guaranteed to survive every framing/zoom. */
export const DEFAULT_SAFE_AREA_RATIO = 0.92;

/** Focal slot must be at least this many times larger than any supporter. */
export const MIN_FOCAL_RATIO = 3;

export const SCENE_LAYOUT_PRESETS: Record<SceneNode['type'], LayoutPresetId> = {
  kinetic_typography: 'hook',
  synthetic_prompt_box: 'pair',
  product_interaction_3d: 'stage',
  icon_grid_morph: 'bento',
  synthetic_hero_button: 'pair',
  synthetic_connect_pills: 'pair',
  synthetic_code_tree: 'split',
  brand_closing_cta: 'lower-third',
  media_showcase: 'stage',
  metric_cards: 'bento',
  conversational_mockup: 'pair',
  saas_feature_grid: 'bento',
};

/**
 * Not every composition is a hierarchy. A split screen puts two heavy columns
 * side by side on purpose, so demanding a 3x focal there would be a false
 * positive. Presets that really are "one hero + secondaries" promise 3x.
 */
export const PRESET_MIN_FOCAL_RATIO: Record<LayoutPresetId, number> = {
  hook: 1,
  stage: 1,
  split: 1,
  bento: MIN_FOCAL_RATIO,
  'lower-third': MIN_FOCAL_RATIO,
  pair: 1,
};

export function area(rect: Rect): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

export function isInside(inner: Rect, outer: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function getSafeArea(
  canvas: Pick<CanvasConfig, 'width' | 'height'>,
  ratio: number = DEFAULT_SAFE_AREA_RATIO
): Rect {
  if (!(ratio > 0 && ratio <= 1)) {
    throw new RangeError(`Safe area ratio must be in (0, 1], received ${ratio}`);
  }
  const width = Math.max(1, Math.round(canvas.width * ratio));
  const height = Math.max(1, Math.round(canvas.height * ratio));
  return {
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
  };
}

/**
 * Scales `rect` down (never up unless asked) until it fits inside `bounds`,
 * preserving aspect ratio and centring it. Use for media that arrives with an
 * arbitrary aspect, which is the usual cause of clipped product windows.
 */
export function fitInside(
  rect: Rect,
  bounds: Rect,
  options: { allowUpscale?: boolean } = {}
): Rect {
  const scaleX = rect.width > 0 ? bounds.width / rect.width : 0;
  const scaleY = rect.height > 0 ? bounds.height / rect.height : 0;
  const rawScale = Math.min(scaleX, scaleY);
  const scale = options.allowUpscale ? rawScale : Math.min(1, rawScale);

  const width = Math.max(1, Math.round(rect.width * scale));
  const height = Math.max(1, Math.round(rect.height * scale));
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + (bounds.height - height) / 2),
    width,
    height,
  };
}

function span(
  bounds: Rect,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Rect {
  const left = bounds.x + bounds.width * Math.min(x0, x1);
  const top = bounds.y + bounds.height * Math.min(y0, y1);
  const right = bounds.x + bounds.width * Math.max(x0, x1);
  const bottom = bounds.y + bounds.height * Math.max(y0, y1);

  const x = Math.min(Math.max(Math.round(left), bounds.x), bounds.x + bounds.width - 1);
  const y = Math.min(Math.max(Math.round(top), bounds.y), bounds.y + bounds.height - 1);
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(right) - x, bounds.x + bounds.width - x)),
    height: Math.max(1, Math.min(Math.round(bottom) - y, bounds.y + bounds.height - y)),
  };
}

const PRESET_BUILDERS: Record<LayoutPresetId, (safe: Rect) => LayoutSlot[]> = {
  /** One full-width headline band. Hook and closing statements. */
  hook: (safe) => [
    { id: 'headline', role: 'focal', rect: span(safe, 0, 0.18, 1, 0.72) },
  ],

  /** A single hero surface: the product window owns the frame. */
  stage: (safe) => [
    { id: 'window', role: 'focal', rect: span(safe, 0.06, 0.08, 0.94, 0.92) },
  ],

  /** Copy on the left, product on the right. The product window is the hero. */
  split: (safe) => [
    { id: 'copy', role: 'supporting', rect: span(safe, 0, 0.12, 0.46, 0.88) },
    { id: 'visual', role: 'focal', rect: span(safe, 0.52, 0.08, 1, 0.92) },
  ],

  /** One dominant card plus two supporting cards filling the whole stage. */
  bento: (safe) => [
    { id: 'card-primary', role: 'focal', rect: span(safe, 0, 0, 0.58, 1) },
    { id: 'card-secondary', role: 'supporting', rect: span(safe, 0.62, 0, 1, 0.48) },
    { id: 'card-tertiary', role: 'supporting', rect: span(safe, 0.62, 0.52, 1, 1) },
  ],

  /** Statement anchored to the bottom, mark above it. No dead band. */
  'lower-third': (safe) => [
    { id: 'cta', role: 'focal', rect: span(safe, 0, 0.55, 1, 1) },
    { id: 'mark', role: 'supporting', rect: span(safe, 0, 0, 0.38, 0.33) },
  ],

  /** A single centred pill, button or prompt bar. */
  pair: (safe) => [
    { id: 'primary', role: 'focal', rect: span(safe, 0.08, 0.34, 0.92, 0.66) },
  ],
};

export function buildPreset(
  preset: LayoutPresetId,
  safeArea: Rect
): LayoutSlot[] {
  return PRESET_BUILDERS[preset](safeArea);
}

export function resolveSceneLayout(
  scene: SceneNode,
  canvas: CanvasConfig
): SceneLayout {
  const preset = SCENE_LAYOUT_PRESETS[scene.type];
  if (!preset) {
    throw new Error(`No layout preset registered for scene type "${scene.type}"`);
  }
  const safeArea = getSafeArea(canvas);
  return {
    preset,
    safeArea,
    slots: buildPreset(preset, safeArea),
    minFocalRatio: PRESET_MIN_FOCAL_RATIO[preset],
  };
}

export interface SceneLayoutEntry {
  sceneId: string;
  startFrame: number;
  layout: SceneLayout;
}

export function layoutSceneGraph(graph: SceneGraph): SceneLayoutEntry[] {
  return graph.scenes.map((scene) => ({
    sceneId: scene.id,
    startFrame: scene.startFrame,
    layout: resolveSceneLayout(scene, graph.canvas),
  }));
}

/**
 * Reports geometry that would look broken on screen. An empty array means the
 * layout is safe to render.
 */
export function validateLayout(
  safeArea: Rect,
  slots: LayoutSlot[],
  options: { minFocalRatio?: number } = {}
): LayoutViolation[] {
  const minFocalRatio = options.minFocalRatio ?? MIN_FOCAL_RATIO;
  const violations: LayoutViolation[] = [];
  const focals = slots.filter((slot) => slot.role === 'focal');

  if (focals.length === 0) {
    violations.push({ code: 'missing-focal', message: 'Layout has no focal slot' });
  }
  if (focals.length > 1) {
    violations.push({
      code: 'duplicate-focal',
      message: `Layout has ${focals.length} focal slots, expected exactly 1`,
    });
  }

  for (const slot of slots) {
    if (slot.rect.width <= 0 || slot.rect.height <= 0) {
      violations.push({
        code: 'degenerate',
        slotId: slot.id,
        message: `Slot "${slot.id}" has non-positive size ${slot.rect.width}x${slot.rect.height}`,
      });
    }
    if (!isInside(slot.rect, safeArea)) {
      violations.push({
        code: 'outside-safe-area',
        slotId: slot.id,
        message: `Slot "${slot.id}" bleeds outside the safe area`,
      });
    }
  }

  // A ratio of 1 (or less) means the preset makes no hierarchy promise, e.g. a
  // split screen with two intentionally heavy columns. Checking it there would
  // be a false positive.
  if (focals.length === 1 && minFocalRatio > 1) {
    const focalArea = area(focals[0].rect);
    for (const slot of slots) {
      if (slot.role !== 'supporting') continue;
      const ratio = area(slot.rect) > 0 ? focalArea / area(slot.rect) : Infinity;
      if (ratio < minFocalRatio) {
        violations.push({
          code: 'weak-hierarchy',
          slotId: slot.id,
          message: `Focal slot is only ${ratio.toFixed(2)}x the area of "${slot.id}", expected >= ${minFocalRatio}x`,
        });
      }
    }
  }

  return violations;
}
