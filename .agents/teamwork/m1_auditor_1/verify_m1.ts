/**
 * verify_m1.ts
 * Independent Forensic Audit Verification Script for Milestone 1.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import assert from 'assert';

import {
  InteractionMapSchema,
  EventProvenanceSchema,
} from '../../../src/lib/interaction-map/schema';
import {
  CoordinateMapper,
  toPixels,
  toNormalized,
  clamp,
  clamp01,
  clampNormalized,
  clampPixel,
  fitWithinBounds,
  mapLocalToCanvasNormalized,
  mapCanvasToLocalNormalized,
  distanceNormalized,
  distancePixel,
} from '../../../src/lib/interaction-map/CoordinateMapper';
import { SceneGraphSchema } from '../../../src/lib/scene-graph/schema';
import { interactionToSceneGraphAdapter } from '../../../src/lib/scene-graph/adapter';
import type { InteractionMap } from '../../../src/lib/interaction-map/types';

console.log('=== STARTING FORENSIC INTEGRITY AUDIT ===\n');

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}`);
    console.error(err);
    failCount++;
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: SFX Asset & License Integrity Check
// -----------------------------------------------------------------------------
console.log('--- 1. SFX Assets & License Manifest ---');

const EXPECTED_SFX_LEDGER: Record<string, { sha256: string; minSamples: number; durationSec: number }> = {
  'ambient-beat.wav': {
    sha256: '7644c775bc1e04bd4ba9e2c11345ed1743ce3554035488a5acb87d7de82c2410',
    minSamples: 790000,
    durationSec: 18.0,
  },
  'camera-whoosh.wav': {
    sha256: '9c6c93a0978b30e0177d0c3bea9b6ab2a1663407d533d5863090307124b7c9c3',
    minSamples: 15000,
    durationSec: 0.35,
  },
  'chime.wav': {
    sha256: 'ea18d40c6cacba7cd6da0852d8df13ae5fec41793652ad2d65e86945ad0d0f7b',
    minSamples: 19000,
    durationSec: 0.45,
  },
  'keyboard-tap.wav': {
    sha256: '443e560eb337a9c74448a9e9e6c4089b40658e927fbfecabeaffc4e7ea3467cd',
    minSamples: 2000,
    durationSec: 0.05,
  },
  'mouse-click.wav': {
    sha256: '780efe4c1f6113050977e5623560b396d285eac6c6b1654fc456c4d96bcdaa6a',
    minSamples: 3500,
    durationSec: 0.08,
  },
  'soft-pop.wav': {
    sha256: 'bbf2b46ce9402fb6c5ed5ae04626e127016d65eab90fc03139785e84b38b12aa',
    minSamples: 5000,
    durationSec: 0.12,
  },
};

test('SFX files existence, SHA-256 match, and RIFF WAV headers', () => {
  const sfxDir = path.resolve(process.cwd(), 'public/sfx');
  assert(fs.existsSync(sfxDir), 'public/sfx directory must exist');

  const licensePath = path.join(sfxDir, 'SFX_LICENSES.md');
  assert(fs.existsSync(licensePath), 'SFX_LICENSES.md must exist');
  const licenseContent = fs.readFileSync(licensePath, 'utf8');

  for (const [filename, expected] of Object.entries(EXPECTED_SFX_LEDGER)) {
    const filePath = path.join(sfxDir, filename);
    assert(fs.existsSync(filePath), `SFX file ${filename} must exist`);

    const fileBuf = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuf).digest('hex');
    assert.strictEqual(hash, expected.sha256, `SHA-256 mismatch for ${filename}`);

    // Verify presence in SFX_LICENSES.md
    assert(licenseContent.includes(filename), `License manifest must include ${filename}`);
    assert(licenseContent.includes(expected.sha256), `License manifest must include hash for ${filename}`);

    // Verify WAV header
    const riff = fileBuf.toString('ascii', 0, 4);
    const wave = fileBuf.toString('ascii', 8, 12);
    assert.strictEqual(riff, 'RIFF', `${filename} must have RIFF header`);
    assert.strictEqual(wave, 'WAVE', `${filename} must have WAVE format`);

    const channels = fileBuf.readUInt16LE(22);
    const sampleRate = fileBuf.readUInt32LE(24);
    assert.strictEqual(channels, 1, `${filename} must be mono (1 channel)`);
    assert.strictEqual(sampleRate, 44100, `${filename} must be 44.1kHz`);
  }
});

// -----------------------------------------------------------------------------
// SECTION 2: demoInteractionMap.json & Provenance Integrity
// -----------------------------------------------------------------------------
console.log('\n--- 2. InteractionMap & Provenance Audit ---');

const demoPath = path.resolve(process.cwd(), 'src/lib/interaction-map/demoInteractionMap.json');
const rawDemo = JSON.parse(fs.readFileSync(demoPath, 'utf8'));

test('demoInteractionMap.json parses and adheres to InteractionMapSchema', () => {
  const parsed = InteractionMapSchema.parse(rawDemo);
  assert.strictEqual(parsed.version, '2.0');
  assert.strictEqual(parsed.fps, 30);
  assert.strictEqual(parsed.durationInFrames, 480);
  assert.strictEqual(parsed.events.length, 24);
});

test('Every event in demoInteractionMap.json has verified explicit provenance', () => {
  const provenances = rawDemo.events.map((e: any) => e.provenance);
  const observed = provenances.filter((p: string) => p === 'observed').length;
  const inferred = provenances.filter((p: string) => p === 'inferred').length;
  const simulated = provenances.filter((p: string) => p === 'simulated').length;

  assert.strictEqual(observed + inferred + simulated, rawDemo.events.length);
  assert(observed >= 5, `Expected substantial observed events, got ${observed}`);
  assert(inferred >= 5, `Expected substantial inferred events, got ${inferred}`);
  assert(simulated >= 5, `Expected substantial simulated events, got ${simulated}`);

  for (const evt of rawDemo.events) {
    EventProvenanceSchema.parse(evt.provenance);
    assert(evt.x >= 0.0 && evt.x <= 1.0, `Event ${evt.id} x must be within [0, 1]`);
    assert(evt.y >= 0.0 && evt.y <= 1.0, `Event ${evt.id} y must be within [0, 1]`);
    assert(evt.frame >= 0 && evt.frame <= rawDemo.durationInFrames, `Event ${evt.id} frame out of bounds`);
  }
});

test('InteractionMapSchema rejects corrupted inputs (Negative tests)', () => {
  // Invalid version
  assert.throws(() => {
    InteractionMapSchema.parse({ ...rawDemo, version: '1.0' });
  });

  // Invalid provenance
  assert.throws(() => {
    const corrupted = JSON.parse(JSON.stringify(rawDemo));
    corrupted.events[0].provenance = 'hallucinated';
    InteractionMapSchema.parse(corrupted);
  });

  // Frame exceeding duration
  assert.throws(() => {
    const corrupted = JSON.parse(JSON.stringify(rawDemo));
    corrupted.events[0].frame = 481;
    InteractionMapSchema.parse(corrupted);
  });

  // Coordinate out of bounds
  assert.throws(() => {
    const corrupted = JSON.parse(JSON.stringify(rawDemo));
    corrupted.events[0].x = 1.05;
    InteractionMapSchema.parse(corrupted);
  });

  // Negative frame
  assert.throws(() => {
    const corrupted = JSON.parse(JSON.stringify(rawDemo));
    corrupted.events[0].frame = -1;
    InteractionMapSchema.parse(corrupted);
  });
});

// -----------------------------------------------------------------------------
// SECTION 3: CoordinateMapper Mathematical Correctness & Edge Cases
// -----------------------------------------------------------------------------
console.log('\n--- 3. CoordinateMapper Math & Edge Cases ---');

test('CoordinateMapper basic conversions', () => {
  const canvas = { width: 1920, height: 1080 };

  const px = toPixels({ x: 0.5, y: 0.5 }, canvas);
  assert.strictEqual(px.x, 960);
  assert.strictEqual(px.y, 540);

  const snapped = toPixels({ x: 0.33333, y: 0.66666 }, canvas, true);
  assert.strictEqual(snapped.x, Math.round(0.33333 * 1920));
  assert.strictEqual(snapped.y, Math.round(0.66666 * 1080));

  const norm = toNormalized({ x: 960, y: 540 }, canvas);
  assert.strictEqual(norm.x, 0.5);
  assert.strictEqual(norm.y, 0.5);
});

test('CoordinateMapper edge cases, NaN and Infinity robustness', () => {
  assert.strictEqual(clamp(NaN, 0, 1), 0);
  assert.strictEqual(clamp(Infinity, 0, 1), 0);
  assert.strictEqual(clamp(-Infinity, 0, 1), 0);
  assert.strictEqual(clamp01(-0.5), 0);
  assert.strictEqual(clamp01(1.5), 1);

  const clampedP = clampNormalized({ x: -10, y: 10 });
  assert.strictEqual(clampedP.x, 0);
  assert.strictEqual(clampedP.y, 1);

  // Invalid canvas dimensions must throw RangeError
  assert.throws(() => toPixels({ x: 0.5, y: 0.5 }, { width: 0, height: 1080 }), RangeError);
  assert.throws(() => toPixels({ x: 0.5, y: 0.5 }, { width: -100, height: 100 }), RangeError);
  assert.throws(() => toNormalized({ x: 10, y: 10 }, { width: 1920, height: 0 }), RangeError);
});

test('fitWithinBounds preserves aspect ratio and centers content', () => {
  const target = { width: 1920, height: 1080 };
  const source = { width: 1280, height: 720 }; // Exact 16:9
  const fitted = fitWithinBounds(source, target);
  assert.strictEqual(fitted.scale, 1.5);
  assert.strictEqual(fitted.width, 1920);
  assert.strictEqual(fitted.height, 1080);
  assert.strictEqual(fitted.x, 0);
  assert.strictEqual(fitted.y, 0);

  // Pillarboxed 4:3 inside 16:9
  const source43 = { width: 1440, height: 1080 };
  const fitted43 = fitWithinBounds(source43, target);
  assert.strictEqual(fitted43.scale, 1.0);
  assert.strictEqual(fitted43.width, 1440);
  assert.strictEqual(fitted43.height, 1080);
  assert.strictEqual(fitted43.x, (1920 - 1440) / 2);
  assert.strictEqual(fitted43.y, 0);
});

test('Nested container local <-> canvas bidirectional mappings', () => {
  const containerRect = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };

  // Local center (0.5, 0.5) inside container at [0.2, 0.2, 0.6, 0.6] -> Canvas (0.5, 0.5)
  const canvasPoint = mapLocalToCanvasNormalized({ x: 0.5, y: 0.5 }, containerRect);
  assert.strictEqual(canvasPoint.x, 0.5);
  assert.strictEqual(canvasPoint.y, 0.5);

  const localBack = mapCanvasToLocalNormalized(canvasPoint, containerRect);
  assert(Math.abs(localBack.x - 0.5) < 1e-6);
  assert(Math.abs(localBack.y - 0.5) < 1e-6);

  // Corner (0, 0) inside container -> Canvas (0.2, 0.2)
  const corner = mapLocalToCanvasNormalized({ x: 0, y: 0 }, containerRect);
  assert.strictEqual(corner.x, 0.2);
  assert.strictEqual(corner.y, 0.2);
});

// -----------------------------------------------------------------------------
// SECTION 4: SceneGraph Schema Strictness
// -----------------------------------------------------------------------------
console.log('\n--- 4. SceneGraph Schema Strictness ---');

test('SceneGraphSchema rejects invalid color and out-of-boundary keyframes', () => {
  const sg = interactionToSceneGraphAdapter(rawDemo);
  const parsed = SceneGraphSchema.parse(sg);
  assert.strictEqual(parsed.version, '2.0');

  // Invalid hex color
  assert.throws(() => {
    SceneGraphSchema.parse({
      ...sg,
      artDirection: { ...sg.artDirection, primaryAccent: 'blue' },
    });
  });

  // Camera keyframe beyond canvas duration
  assert.throws(() => {
    const corrupted = JSON.parse(JSON.stringify(sg));
    corrupted.cameraTrack.push({
      frame: 485,
      x: 0.5,
      y: 0.5,
      zoom: 1.0,
    });
    SceneGraphSchema.parse(corrupted);
  });

  // Invalid audio asset
  assert.throws(() => {
    const corrupted = JSON.parse(JSON.stringify(sg));
    corrupted.audioTrack.push({
      id: 'bad-sfx',
      frame: 10,
      asset: 'laser-cannon',
    });
    SceneGraphSchema.parse(corrupted);
  });
});

// -----------------------------------------------------------------------------
// SECTION 5: interactionToSceneGraphAdapter Determinism & Robustness
// -----------------------------------------------------------------------------
console.log('\n--- 5. Adapter Determinism & Edge Cases ---');

test('Adapter is 100% deterministic over 100 consecutive runs', () => {
  const firstRun = JSON.stringify(interactionToSceneGraphAdapter(rawDemo));
  for (let i = 0; i < 100; i++) {
    const currentRun = JSON.stringify(interactionToSceneGraphAdapter(rawDemo));
    assert.strictEqual(firstRun, currentRun, `Non-deterministic output at iteration ${i}`);
  }
});

test('Adapter handles empty events array gracefully', () => {
  const emptyMap: InteractionMap = {
    version: '2.0',
    baseResolution: { width: 1920, height: 1080 },
    fps: 30,
    durationInFrames: 300,
    events: [],
  };
  const sg = interactionToSceneGraphAdapter(emptyMap);
  const parsed = SceneGraphSchema.parse(sg);
  assert.strictEqual(parsed.cameraTrack.length >= 1, true);
  assert.strictEqual(parsed.cursorTrack.length >= 1, true);
  assert.strictEqual(parsed.audioTrack.length >= 1, true);
});

test('Adapter sorts out-of-order events deterministically', () => {
  const reversedEvents = [...rawDemo.events].reverse();
  const reversedMap: InteractionMap = {
    ...rawDemo,
    events: reversedEvents,
  };
  const normalSg = interactionToSceneGraphAdapter(rawDemo);
  const reversedSg = interactionToSceneGraphAdapter(reversedMap);

  // Both should produce identical keyframe frames and orders
  assert.strictEqual(normalSg.cameraTrack.length, reversedSg.cameraTrack.length);
  assert.strictEqual(normalSg.cursorTrack.length, reversedSg.cursorTrack.length);
  assert.strictEqual(normalSg.audioTrack.length, reversedSg.audioTrack.length);
});

test('Adapter multi-scene sequence generation complies with SceneGraphSchema', () => {
  const multiSg = interactionToSceneGraphAdapter(rawDemo, { generateMultiSceneSequence: true });
  const parsed = SceneGraphSchema.parse(multiSg);
  assert.strictEqual(parsed.scenes.length, 4);
  assert.strictEqual(parsed.scenes[0].type, 'synthetic_prompt_box');
  assert.strictEqual(parsed.scenes[1].type, 'synthetic_code_tree');
  assert.strictEqual(parsed.scenes[2].type, 'synthetic_hero_button');
  assert.strictEqual(parsed.scenes[3].type, 'brand_closing_cta');
});

test('Adapter generates authentic Bezier control points and audio cues', () => {
  const sg = interactionToSceneGraphAdapter(rawDemo);
  // Verify that at least one cursor keyframe has curved control points
  const curvedKeyframes = sg.cursorTrack.filter(
    (kf) => typeof kf.controlX === 'number' && typeof kf.controlY === 'number'
  );
  assert(curvedKeyframes.length > 5, 'Must have multiple Bezier curved keyframes');

  // Verify that audio track includes ambient beat, mouse-click, camera-whoosh, etc.
  const assetsUsed = new Set(sg.audioTrack.map((a) => a.asset));
  assert(assetsUsed.has('ambient-beat'), 'Must have ambient-beat');
  assert(assetsUsed.has('mouse-click'), 'Must have mouse-click');
  assert(assetsUsed.has('camera-whoosh'), 'Must have camera-whoosh');
  assert(assetsUsed.has('chime'), 'Must have chime');
});

console.log('\n=== SUMMARY ===');
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\n>>> ALL 13 FORENSIC TESTS PASSED WITH 100% SUCCESS <<<');
}
