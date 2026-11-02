import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SURFACE_HEADER_HEIGHT,
  computeSurfaceLayout,
  mediaToCanvasNormalized,
  remapCanvasPoint,
} from '../src/lib/scene-graph/media-layout';
import { synthesizeInferredInteractionMap } from '../src/lib/input-intelligence/interaction-synthesizer';
import type { VisualLandmark } from '../src/lib/input-intelligence/types';

const H = { width: 1920, height: 1080 };
const V = { width: 1080, height: 1920 };

describe('media layout', () => {
  it('centers the surface and keeps the media area below the header', () => {
    const l = computeSurfaceLayout(H, 16 / 9);
    assert.equal(l.surfaceX * 2 + l.surfaceWidth, H.width);
    assert.equal(l.surfaceY * 2 + l.surfaceHeight, H.height);
    assert.equal(l.contentY, l.surfaceY + SURFACE_HEADER_HEIGHT);
    assert.ok(Math.abs(l.contentWidth / l.contentHeight - 16 / 9) < 0.01);
  });

  it('maps media corners/center onto the exact pixels of the media area', () => {
    const l = computeSurfaceLayout(H, 1.6);
    const tl = mediaToCanvasNormalized(l, H, 0, 0);
    const br = mediaToCanvasNormalized(l, H, 1, 1);
    assert.ok(Math.abs(tl.x * H.width - l.contentX) < 1e-6);
    assert.ok(Math.abs(tl.y * H.height - l.contentY) < 1e-6);
    assert.ok(Math.abs(br.x * H.width - (l.contentX + l.contentWidth)) < 1e-6);
    assert.ok(Math.abs(br.y * H.height - (l.contentY + l.contentHeight)) < 1e-6);
  });

  it('fits portrait recordings inside the canvas', () => {
    const l = computeSurfaceLayout(H, 9 / 19.5);
    assert.ok(l.surfaceHeight <= H.height);
    assert.ok(l.surfaceWidth < l.surfaceHeight);
  });

  it('keeps a point on the same pixel of the recording when reframing 16:9 -> 9:16', () => {
    const aspect = 16 / 10;
    const a = computeSurfaceLayout(H, aspect);
    const b = computeSurfaceLayout(V, aspect);
    const media = { x: 0.8, y: 0.3 };
    const inH = mediaToCanvasNormalized(a, H, media.x, media.y);
    const inV = remapCanvasPoint(H, V, aspect, inH);
    const expected = mediaToCanvasNormalized(b, V, media.x, media.y);
    assert.ok(Math.abs(inV.x - expected.x) < 1e-6);
    assert.ok(Math.abs(inV.y - expected.y) < 1e-6);
  });

  it('is robust to garbage aspect values', () => {
    for (const a of [NaN, -1, 0, Infinity, undefined, null]) {
      const l = computeSurfaceLayout(H, a as number);
      assert.ok(l.contentWidth > 0 && l.contentHeight > 0);
    }
  });
});

describe('timed interaction synthesis', () => {
  const lm = (id: string, t: number, x: number, y: number, action: VisualLandmark['suggestedAction'], category: VisualLandmark['category']): VisualLandmark => ({
    id, label: id, category, normalizedCenter: { x, y }, confidence: 0.9, suggestedAction: action, timeSeconds: t,
    box2d: [y - 0.04, x - 0.08, y + 0.04, x + 0.08],
  });

  it('places events at the recorded seconds, over the real pixels', () => {
    const landmarks = [
      lm('search', 2, 0.3, 0.15, 'focus', 'input'),
      lm('publish', 6, 0.85, 0.9, 'click', 'cta'),
    ];
    const map = synthesizeInferredInteractionMap(landmarks, {
      fps: 30, durationInFrames: 480, baseWidth: 1920, baseHeight: 1080, mediaAspect: 16 / 9, mediaDurationSeconds: 9,
    });
    const layout = computeSurfaceLayout(H, 16 / 9);
    const click = map.events.find((e) => e.type === 'click');
    assert.ok(click);
    assert.equal(click.frame, 180);
    const expected = mediaToCanvasNormalized(layout, H, 0.85, 0.9);
    assert.ok(Math.abs(click.x - expected.x) < 1e-6);
    assert.ok(Math.abs(click.y - expected.y) < 1e-6);
    assert.equal(map.durationInFrames, 270);
    assert.ok(map.events.every((e) => e.provenance === 'inferred'));
    const frames = map.events.map((e) => e.frame);
    assert.deepEqual(frames, [...frames].sort((a, b) => a - b));
  });

  it('different recordings produce different choreography', () => {
    const a = synthesizeInferredInteractionMap([lm('a', 1, 0.2, 0.2, 'click', 'cta'), lm('b', 4, 0.7, 0.6, 'click', 'cta')], { mediaDurationSeconds: 8 });
    const b = synthesizeInferredInteractionMap([lm('a', 3, 0.5, 0.5, 'click', 'cta'), lm('b', 9, 0.1, 0.8, 'focus', 'input')], { mediaDurationSeconds: 14 });
    assert.notDeepEqual(a.events.map((e) => e.frame), b.events.map((e) => e.frame));
  });
});
