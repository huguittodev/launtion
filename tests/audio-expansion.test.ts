/**
 * tests/audio-expansion.test.ts
 *
 * Comprehensive test suite verifying Milestone 1 expanded audio engine,
 * 18-asset AudioAssetSchema, AllowedMimeTypesEnum, and procedural scheduling.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { AudioAssetSchema } from '../src/lib/scene-graph/schema';
import type { AudioAsset } from '../src/lib/scene-graph/types';
import { AllowedMimeTypesEnum } from '../src/lib/input-intelligence/schema';
import {
  SFX_CATALOG,
  buildAudioTimeline,
  getMechanicalTapAsset,
  resolveClickAsset,
  scheduleProceduralKeystrokes,
  scheduleSceneTransitionWhooshes,
  MECHANICAL_TAPS,
} from '../remotion/motion-kit/audio/AudioTimeline';
import { calculateDuckingFactor, softLimitGain } from '../remotion/motion-kit/audio/AudioMixer';

const ALL_18_AUDIO_ASSETS: AudioAsset[] = [
  'mouse-click',
  'camera-whoosh',
  'keyboard-tap',
  'chime',
  'soft-pop',
  'ambient-beat',
  'transition-whoosh-heavy',
  'transition-whoosh-fast',
  'sound-riser',
  'sub-bass-drop',
  'click-switch',
  'click-soft',
  'mechanical-tap-1',
  'mechanical-tap-2',
  'mechanical-tap-3',
  'mechanical-tap-4',
  'pop-clean',
  'success-chime',
];

describe('Milestone 1 Expanded Audio Engine & Schema Integration Tests', () => {
  describe('1. AudioAssetSchema & AllowedMimeTypesEnum Validation', () => {
    test('1.1 AudioAssetSchema admits all 18 commercial sound assets and rejects unauthorized', () => {
      assert.equal(ALL_18_AUDIO_ASSETS.length, 18);
      for (const asset of ALL_18_AUDIO_ASSETS) {
        const parsed = AudioAssetSchema.safeParse(asset);
        assert.ok(parsed.success, `Asset ${asset} failed AudioAssetSchema validation`);
      }

      // Rejects unknown asset
      const invalidParsed = AudioAssetSchema.safeParse('laser-gun');
      assert.equal(invalidParsed.success, false);
    });

    test('1.2 AllowedMimeTypesEnum admits video/webm and image/jpg alongside existing formats', () => {
      const targetMimes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'video/mp4',
        'video/webm',
      ];
      assert.equal(targetMimes.length, 6);
      for (const mime of targetMimes) {
        const parsed = AllowedMimeTypesEnum.safeParse(mime);
        assert.ok(parsed.success, `MIME ${mime} should be admitted`);
      }

      // Rejects unsupported formats
      const invalidMimes = ['image/gif', 'application/pdf', 'video/quicktime', 'text/plain'];
      for (const mime of invalidMimes) {
        const parsed = AllowedMimeTypesEnum.safeParse(mime);
        assert.equal(parsed.success, false, `MIME ${mime} should be rejected`);
      }
    });
  });

  describe('2. SFX_CATALOG Profile Integrity', () => {
    test('2.1 Every one of the 18 assets has a complete, valid catalog profile', () => {
      for (const asset of ALL_18_AUDIO_ASSETS) {
        const profile = SFX_CATALOG[asset];
        assert.ok(profile, `Missing catalog profile for asset: ${asset}`);
        assert.equal(profile.asset, asset);
        assert.ok(profile.filename.startsWith('sfx/'));
        assert.ok(profile.durationSec > 0);
        assert.ok(profile.durationFramesAt30Fps > 0);
        assert.ok(profile.nominalVolume > 0 && profile.nominalVolume <= 1.0);
      }
    });

    test('2.2 Priority categorization adheres strictly to ducking rules', () => {
      const priority2Assets: AudioAsset[] = [
        'camera-whoosh',
        'transition-whoosh-heavy',
        'transition-whoosh-fast',
        'sound-riser',
        'sub-bass-drop',
        'chime',
        'success-chime',
      ];

      for (const asset of priority2Assets) {
        assert.equal(
          SFX_CATALOG[asset].duckingPriority,
          2,
          `Asset ${asset} should have priority 2`
        );
      }

      const priority1Assets: AudioAsset[] = [
        'mouse-click',
        'click-switch',
        'click-soft',
        'keyboard-tap',
        'mechanical-tap-1',
        'mechanical-tap-2',
        'mechanical-tap-3',
        'mechanical-tap-4',
        'soft-pop',
        'pop-clean',
      ];

      for (const asset of priority1Assets) {
        assert.equal(
          SFX_CATALOG[asset].duckingPriority,
          1,
          `Asset ${asset} should have priority 1`
        );
      }

      assert.equal(SFX_CATALOG['ambient-beat'].duckingPriority, 0);
      assert.equal(SFX_CATALOG['ambient-beat'].isMusic, true);
    });
  });

  describe('3. Procedural Audio Scheduling Mechanics', () => {
    test('3.1 Keystroke scheduling cycles round-robin across mechanical-tap-1..4', () => {
      for (let i = 0; i < 16; i++) {
        const expected = MECHANICAL_TAPS[i % 4];
        assert.equal(getMechanicalTapAsset(i), expected);
      }

      const typingCues = scheduleProceduralKeystrokes({
        startFrame: 30,
        charCount: 8,
        framesPerChar: 3,
      });

      assert.equal(typingCues.length, 8);
      assert.equal(typingCues[0].asset, 'mechanical-tap-1');
      assert.equal(typingCues[1].asset, 'mechanical-tap-2');
      assert.equal(typingCues[2].asset, 'mechanical-tap-3');
      assert.equal(typingCues[3].asset, 'mechanical-tap-4');
      assert.equal(typingCues[4].asset, 'mechanical-tap-1');
      assert.equal(typingCues[0].frame, 30);
      assert.equal(typingCues[1].frame, 33);
      assert.equal(typingCues[7].frame, 51);
    });

    test('3.2 Click alternation resolves correctly based on role and sequence', () => {
      assert.equal(resolveClickAsset('subtle'), 'click-soft');
      assert.equal(resolveClickAsset('primary'), 'click-switch');
      assert.equal(resolveClickAsset('standard', 0), 'mouse-click');
      assert.equal(resolveClickAsset('standard', 1), 'click-soft');
      assert.equal(resolveClickAsset('standard', 2), 'mouse-click');
    });

    test('3.3 Scene boundary transition whooshes trigger on scene boundaries with lead frames', () => {
      const scenes = [
        { startFrame: 0, durationInFrames: 90, type: 'kinetic_typography' },
        { startFrame: 90, durationInFrames: 120, type: 'product_interaction_3d' },
        { startFrame: 210, durationInFrames: 90, type: 'icon_grid_morph' },
        { startFrame: 300, durationInFrames: 180, type: 'brand_closing_cta' },
      ];

      const whooshes = scheduleSceneTransitionWhooshes({
        scenes,
        canvasDurationInFrames: 480,
        leadFrames: 2,
      });

      assert.equal(whooshes.length, 3);
      // Scene 1: frame 90 - 2 = 88, product_interaction_3d -> transition-whoosh-heavy
      assert.equal(whooshes[0].frame, 88);
      assert.equal(whooshes[0].asset, 'transition-whoosh-heavy');

      // Scene 2: frame 210 - 2 = 208, icon_grid_morph -> transition-whoosh-fast
      assert.equal(whooshes[1].frame, 208);
      assert.equal(whooshes[1].asset, 'transition-whoosh-fast');

      // Scene 3: frame 300 - 2 = 298, brand_closing_cta -> transition-whoosh-heavy
      assert.equal(whooshes[2].frame, 298);
      assert.equal(whooshes[2].asset, 'transition-whoosh-heavy');
    });

    test('3.4 buildAudioTimeline with procedural options seamlessly enhances audioTrack', () => {
      const timeline = buildAudioTimeline({
        audioTrack: [
          { id: 'tap-0', frame: 10, asset: 'keyboard-tap' },
          { id: 'tap-1', frame: 15, asset: 'keyboard-tap' },
          { id: 'clk-0', frame: 40, asset: 'mouse-click' },
          { id: 'clk-1', frame: 50, asset: 'mouse-click' },
        ],
        durationInFrames: 300,
        fps: 30,
        procedural: {
          enableKeystrokeCycling: true,
          enableClickAlternation: true,
        },
      });

      assert.equal(timeline.cues.length, 4);
      assert.equal(timeline.cues[0].asset, 'mechanical-tap-1');
      assert.equal(timeline.cues[1].asset, 'mechanical-tap-2');
      assert.equal(timeline.cues[2].asset, 'mouse-click');
      assert.equal(timeline.cues[3].asset, 'click-soft');
    });
  });

  describe('4. Sidechain Ducking & Headroom Limiter Integration with New Assets', () => {
    test('4.1 New priority-2 assets trigger sidechain ducking down to 0.55', () => {
      const sfx = [
        { startFrame: 100, durationInFrames: 15, priority: SFX_CATALOG['transition-whoosh-heavy'].duckingPriority },
      ];

      assert.equal(calculateDuckingFactor(90, sfx), 1.0);
      assert.equal(calculateDuckingFactor(105, sfx), 0.55);
      assert.ok(calculateDuckingFactor(120, sfx) >= 0.55 && calculateDuckingFactor(120, sfx) <= 1.0);
      assert.equal(calculateDuckingFactor(130, sfx), 1.0);
    });

    test('4.2 Soft limiter bounds polyphony of all 18 assets strictly <= 0.95', () => {
      // All 18 assets firing simultaneously at full volume
      const totalRawGain = ALL_18_AUDIO_ASSETS.reduce(
        (sum, asset) => sum + SFX_CATALOG[asset].nominalVolume,
        0
      );

      assert.ok(totalRawGain > 1.0, `Total raw volume ${totalRawGain} must exceed 1.0 for stress test`);

      const { limitedGain, limitFactor } = softLimitGain(totalRawGain, 0.75, 0.95);
      assert.ok(limitedGain <= 0.95, `Limited gain ${limitedGain} exceeded 0.95 ceiling`);
      assert.ok(limitFactor < 1.0, `Limit factor must compress sum`);
      assert.ok(limitedGain > 0.75, `Limited gain must remain above knee threshold`);
    });
  });
});
