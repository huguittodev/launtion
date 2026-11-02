/**
 * scene-layout.test.ts
 *
 * Geometry invariants for the stage layout engine. These assertions are the
 * ones that catch "title cut in half" and "card bleeding off-screen" before a
 * frame is ever rendered.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  area,
  buildPreset,
  DEFAULT_SAFE_AREA_RATIO,
  fitInside,
  getSafeArea,
  isInside,
  layoutSceneGraph,
  MIN_FOCAL_RATIO,
  PRESET_MIN_FOCAL_RATIO,
  resolveSceneLayout,
  SCENE_LAYOUT_PRESETS,
  validateLayout,
  type LayoutPresetId,
  type LayoutSlot,
  type Rect,
} from '../src/lib/scene-graph/layout';
import type { CanvasConfig } from '../src/lib/scene-graph/types';
import { generateDeterministicSceneGraph } from '../src/lib/ai/deterministic-fallback';

const CANVASES: CanvasConfig[] = [
  { width: 1920, height: 1080, fps: 30, durationInFrames: 480 },
  { width: 1080, height: 1920, fps: 30, durationInFrames: 480 },
  { width: 1080, height: 1080, fps: 30, durationInFrames: 480 },
  { width: 720, height: 1280, fps: 30, durationInFrames: 480 },
  { width: 101, height: 99, fps: 30, durationInFrames: 480 },
];

const PRESETS = Object.keys(PRESET_MIN_FOCAL_RATIO) as LayoutPresetId[];

function slot(id: string, role: LayoutSlot['role'], rect: Rect): LayoutSlot {
  return { id, role, rect };
}

describe('stage layout', () => {
  test('1. safe area is centred and keeps the requested ratio', () => {
    const safe = getSafeArea({ width: 1920, height: 1080 });
    assert.equal(safe.width, Math.round(1920 * DEFAULT_SAFE_AREA_RATIO));
    assert.equal(safe.height, Math.round(1080 * DEFAULT_SAFE_AREA_RATIO));
    assert.equal(safe.x, Math.round((1920 - safe.width) / 2));
    assert.equal(safe.y, Math.round((1080 - safe.height) / 2));

    const tight = getSafeArea({ width: 1000, height: 1000 }, 0.5);
    assert.deepEqual(tight, { x: 250, y: 250, width: 500, height: 500 });

    assert.throws(() => getSafeArea({ width: 100, height: 100 }, 0), RangeError);
    assert.throws(() => getSafeArea({ width: 100, height: 100 }, 1.5), RangeError);
  });

  test('2. every preset stays inside the safe area on every canvas', () => {
    for (const canvas of CANVASES) {
      const safe = getSafeArea(canvas);
      for (const preset of PRESETS) {
        const slots = buildPreset(preset, safe);
        assert.ok(slots.length > 0, `${preset} produced no slots`);
        for (const s of slots) {
          assert.ok(
            isInside(s.rect, safe),
            `${preset}/${s.id} bleeds on ${canvas.width}x${canvas.height}: ${JSON.stringify(s.rect)} vs ${JSON.stringify(safe)}`
          );
          assert.ok(
            s.rect.width > 0 && s.rect.height > 0,
            `${preset}/${s.id} is degenerate on ${canvas.width}x${canvas.height}`
          );
        }
      }
    }
  });

  test('3. every preset declares exactly one focal slot and validates clean', () => {
    for (const canvas of CANVASES) {
      const safe = getSafeArea(canvas);
      for (const preset of PRESETS) {
        const slots = buildPreset(preset, safe);
        assert.equal(
          slots.filter((s) => s.role === 'focal').length,
          1,
          `${preset} must declare exactly one focal slot`
        );

        const violations = validateLayout(safe, slots, {
          minFocalRatio: PRESET_MIN_FOCAL_RATIO[preset],
        });
        assert.deepEqual(
          violations,
          [],
          `${preset} on ${canvas.width}x${canvas.height}: ${violations.map((v) => v.message).join('; ')}`
        );
      }
    }
  });

  test('4. hierarchy presets really give the focal slot 3x the area', () => {
    for (const preset of PRESETS.filter((p) => PRESET_MIN_FOCAL_RATIO[p] >= 3)) {
      const slots = buildPreset(preset, getSafeArea({ width: 1920, height: 1080 }));
      const focal = slots.find((s) => s.role === 'focal');
      assert.ok(focal, `${preset} has no focal slot`);
      for (const supporting of slots.filter((s) => s.role === 'supporting')) {
        assert.ok(
          area(focal.rect) >= area(supporting.rect) * MIN_FOCAL_RATIO,
          `${preset}: focal is not ${MIN_FOCAL_RATIO}x "${supporting.id}"`
        );
      }
    }
  });

  test('5. grid and anchored presets fill the stage vertically (no dead band)', () => {
    // A bento grid must fill its grid, and a lower-third must sit on the bottom
    // edge. `stage`/`split` are inset panels with intentional breathing room,
    // and `hook`/`pair` are centred bands, so they are excluded.
    const FULL_BLEED: LayoutPresetId[] = ['bento', 'lower-third'];

    for (const canvas of CANVASES) {
      const safe = getSafeArea(canvas);
      for (const preset of FULL_BLEED) {
        const slots = buildPreset(preset, safe);
        const top = Math.min(...slots.map((s) => s.rect.y));
        const bottom = Math.max(...slots.map((s) => s.rect.y + s.rect.height));
        assert.equal(top, safe.y, `${preset} leaves dead space above the stage`);
        assert.equal(
          bottom,
          safe.y + safe.height,
          `${preset} leaves dead space below the stage`
        );
      }
    }
  });

  test('6. fitInside preserves aspect, centres, and never upscales by default', () => {
    const bounds: Rect = { x: 100, y: 50, width: 800, height: 800 };

    const shrunk = fitInside({ x: 0, y: 0, width: 1600, height: 900 }, bounds);
    assert.equal(shrunk.width, 800);
    assert.equal(shrunk.height, 450);
    assert.equal(shrunk.x, 100);
    assert.equal(shrunk.y, 225);
    assert.ok(isInside(shrunk, bounds));

    const untouched = fitInside({ x: 0, y: 0, width: 400, height: 300 }, bounds);
    assert.deepEqual(untouched, { x: 300, y: 300, width: 400, height: 300 });

    const upscaled = fitInside({ x: 0, y: 0, width: 400, height: 300 }, bounds, {
      allowUpscale: true,
    });
    assert.deepEqual(upscaled, { x: 100, y: 150, width: 800, height: 600 });
  });

  test('7. validateLayout catches the failures that used to ship', () => {
    const safe: Rect = { x: 0, y: 0, width: 1000, height: 1000 };

    const bleeding = validateLayout(safe, [
      slot('headline', 'focal', { x: 960, y: 100, width: 100, height: 100 }),
    ]);
    assert.deepEqual(
      bleeding.map((v) => [v.code, v.slotId]),
      [['outside-safe-area', 'headline']]
    );

    const negative = validateLayout(safe, [
      slot('window', 'focal', { x: -1, y: -40, width: 500, height: 500 }),
    ]);
    assert.equal(negative[0]?.code, 'outside-safe-area');

    // A zero-size slot that sits inside the safe area is degenerate but not
    // bleeding. Both checks are independent, which is what we want.
    const empty = validateLayout(safe, [
      slot('card', 'focal', { x: 10, y: 10, width: 0, height: 0 }),
    ]);
    assert.deepEqual(empty.map((v) => v.code), ['degenerate']);

    const flat = validateLayout(safe, [
      slot('hero', 'focal', { x: 0, y: 0, width: 100, height: 100 }),
      slot('tile', 'supporting', { x: 200, y: 0, width: 80, height: 80 }),
    ]);
    assert.deepEqual(flat.map((v) => v.code), ['weak-hierarchy']);

    const noFocal = validateLayout(safe, [
      slot('a', 'supporting', { x: 0, y: 0, width: 100, height: 100 }),
    ]);
    assert.deepEqual(noFocal.map((v) => v.code), ['missing-focal']);

    const twoFocals = validateLayout(safe, [
      slot('a', 'focal', { x: 0, y: 0, width: 400, height: 400 }),
      slot('b', 'focal', { x: 500, y: 0, width: 400, height: 400 }),
    ]);
    assert.deepEqual(twoFocals.map((v) => v.code), ['duplicate-focal']);
  });

  test('8. every SceneGraph scene type has a registered preset', () => {
    assert.deepEqual(Object.keys(SCENE_LAYOUT_PRESETS).sort(), [
      'brand_closing_cta',
      'conversational_mockup',
      'icon_grid_morph',
      'kinetic_typography',
      'media_showcase',
      'metric_cards',
      'product_interaction_3d',
      'synthetic_code_tree',
      'synthetic_connect_pills',
      'synthetic_hero_button',
      'synthetic_prompt_box',
    ]);
  });

  test('9. a real generated graph lays out cleanly and deterministically', () => {
    const graph = generateDeterministicSceneGraph({
      productName: 'Datamesh Cloud',
      description: 'Infraestructura de datos con telemetría en tiempo real',
      tagline: 'Datos que se mueven a la velocidad de tu producto',
      goal: 'launch',
      tone: 'tech-precision',
    });

    const first = layoutSceneGraph(graph);
    const second = layoutSceneGraph(graph);

    assert.equal(first.length, graph.scenes.length);
    assert.deepEqual(first, second);

    for (const [index, entry] of first.entries()) {
      assert.equal(entry.sceneId, graph.scenes[index].id);
      assert.equal(entry.startFrame, graph.scenes[index].startFrame);
      assert.equal(entry.layout.preset, SCENE_LAYOUT_PRESETS[graph.scenes[index].type]);
      assert.deepEqual(
        validateLayout(entry.layout.safeArea, entry.layout.slots, {
          minFocalRatio: entry.layout.minFocalRatio,
        }),
        [],
        `${graph.scenes[index].type} produced an invalid layout`
      );
    }

    const direct = resolveSceneLayout(graph.scenes[0], graph.canvas);
    assert.equal(direct.slots[0].role, 'focal');
  });
});
