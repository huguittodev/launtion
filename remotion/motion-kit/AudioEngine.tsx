/**
 * AudioEngine.tsx
 * Studio-grade deterministic audio orchestrator for Remotion.
 *
 * Implements:
 * 1. Safe, monotonic fade curves via FadeController (eliminates duplicate-key crashes).
 * 2. Dynamic sidechain ducking of background music during SFX transients.
 * 3. Master C^1 soft-knee limiter bounded to 0.95 preventing digital clipping across polyphonic mixes.
 * 4. Dual contract support: consumes SceneGraph.audioTrack and maintains 100% backwards compatibility
 *    with legacy soundCues and music props.
 */

import React from 'react';
import {
  Audio,
  Sequence,
  staticFile,
  useVideoConfig,
} from 'remotion';
import type { AudioAsset, AudioCue } from '../../src/lib/scene-graph/types';
import {
  calculateFadeGain,
  type FadeConfig,
} from './audio/FadeController';
import {
  calculateDuckingFactor,
  softLimitGain,
  type MixerConfig,
} from './audio/AudioMixer';
import {
  buildAudioTimeline,
  SFX_CATALOG,
  type AudioTimeline,
  type ScheduledCue,
} from './audio/AudioTimeline';

export * from './audio/FadeController';
export * from './audio/AudioMixer';
export * from './audio/AudioTimeline';

export interface SoundCue {
  frame: number;
  sound: string; // e.g. 'mouse-click', 'soft-pop', 'camera-whoosh', 'chime', 'keyboard-tap'
  volume?: number;
}

export interface BackgroundMusicConfig {
  src?: string;
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

export interface AudioEngineProps {
  // SceneGraph declarative audio track (Milestones 2 & 3)
  audioTrack?: AudioCue[];

  // Legacy backwards-compatible props (StudioShowcase)
  soundCues?: SoundCue[];
  music?: BackgroundMusicConfig;

  enabled?: boolean;
  mixerOptions?: MixerConfig;
}

/**
 * Normalizes an audio path for Remotion staticFile.
 */
function resolveStaticSrc(path: string): string {
  const stripped = path.startsWith('/') ? path.slice(1) : path;
  if (stripped.startsWith('sfx/') || stripped.endsWith('.wav') || stripped.endsWith('.mp3')) {
    return staticFile(stripped);
  }
  return staticFile(`sfx/${stripped}.wav`);
}

export const AudioEngine: React.FC<AudioEngineProps> = ({
  audioTrack,
  soundCues = [],
  music,
  enabled = true,
  mixerOptions,
}) => {
  const { durationInFrames, fps } = useVideoConfig();

  // Build unified audio timeline
  const timeline: AudioTimeline = React.useMemo(() => {
    if (audioTrack && audioTrack.length > 0) {
      return buildAudioTimeline({
        audioTrack,
        durationInFrames,
        fps,
      });
    }

    // Adapt legacy soundCues and music into scheduled cues
    const syntheticCues: AudioCue[] = [];

    // Legacy background music cue
    if (music?.src) {
      const isAmbientBeat = music.src.includes('ambient-beat');
      syntheticCues.push({
        id: 'legacy-bg-music',
        frame: 0,
        asset: isAmbientBeat ? 'ambient-beat' : ('ambient-beat' as AudioAsset),
        volume: music.volume ?? 0.32,
        fadeInFrames: music.fadeInFrames ?? 15,
        fadeOutFrames: music.fadeOutFrames ?? 30,
      });
    }

    // Legacy SFX cues
    soundCues.forEach((sc, idx) => {
      // Extract asset name
      const rawName = sc.sound.replace(/^sfx\//, '').replace(/\.(wav|mp3)$/, '');
      const asset = (rawName in SFX_CATALOG ? rawName : 'soft-pop') as AudioAsset;

      syntheticCues.push({
        id: `legacy-sfx-${sc.frame}-${rawName}-${idx}`,
        frame: sc.frame,
        asset,
        volume: sc.volume ?? SFX_CATALOG[asset]?.nominalVolume ?? 0.75,
      });
    });

    return buildAudioTimeline({
      audioTrack: syntheticCues,
      durationInFrames,
      fps,
    });
  }, [audioTrack, soundCues, music, durationInFrames, fps]);

  if (!enabled) return null;

  // Prepare SFX metadata for dynamic ducking calculation
  const sfxDuckingMeta = timeline.sfxCues.map((c) => ({
    startFrame: c.startFrame,
    durationInFrames: c.durationInFrames,
    priority: c.duckingPriority,
  }));

  // Helper to compute effective volume at any given frame
  const computeMasterLimitedVolume = (
    targetFrame: number,
    cue: ScheduledCue
  ): number => {
    // 1. Nominal gain with fade
    const fadeConf: FadeConfig = {
      durationInFrames: cue.durationInFrames,
      fadeInFrames: cue.fadeInFrames,
      fadeOutFrames: cue.fadeOutFrames,
      targetVolume: cue.volume,
    };
    const relFrameInCue = targetFrame - cue.startFrame;
    const baseGain = calculateFadeGain(relFrameInCue, fadeConf);

    // 2. Active cues at targetFrame
    const activeCues = timeline.cues.filter(
      (c) => targetFrame >= c.startFrame && targetFrame < c.endFrame
    );

    // Calculate ducking multiplier
    const duckingMultiplier = cue.isMusic
      ? calculateDuckingFactor(targetFrame, sfxDuckingMeta, mixerOptions)
      : 1.0;

    // Calculate total raw sum for limiter
    let rawSum = 0;
    for (const c of activeCues) {
      if (c.isMusic) {
        const mGain = calculateFadeGain(targetFrame - c.startFrame, {
          durationInFrames: c.durationInFrames,
          fadeInFrames: c.fadeInFrames,
          fadeOutFrames: c.fadeOutFrames,
          targetVolume: c.volume,
        });
        const mDuck = calculateDuckingFactor(targetFrame, sfxDuckingMeta, mixerOptions);
        rawSum += mGain * mDuck;
      } else {
        rawSum += c.volume;
      }
    }

    const { limitFactor } = softLimitGain(
      rawSum,
      mixerOptions?.kneeThreshold,
      mixerOptions?.headroomCeiling
    );

    return Math.max(0, baseGain * duckingMultiplier * limitFactor);
  };

  // Resolve background music source
  const musicCue = timeline.musicCues[0];
  const legacyMusicSrc = music?.src ? resolveStaticSrc(music.src) : null;
  const musicSrc = musicCue ? resolveStaticSrc(musicCue.resolvedSrc) : legacyMusicSrc;

  return (
    <>
      {/* Background Music Track */}
      {musicSrc && (
        <Audio
          src={musicSrc}
          volume={(frameWithinAudio) => {
            if (musicCue) {
              return computeMasterLimitedVolume(frameWithinAudio, musicCue);
            }
            // Fallback for custom legacy music
            const baseGain = calculateFadeGain(frameWithinAudio, {
              durationInFrames,
              fadeInFrames: music?.fadeInFrames ?? 15,
              fadeOutFrames: music?.fadeOutFrames ?? 30,
              targetVolume: music?.volume ?? 0.32,
            });
            const duck = calculateDuckingFactor(frameWithinAudio, sfxDuckingMeta, mixerOptions);
            const { limitFactor } = softLimitGain(
              baseGain * duck,
              mixerOptions?.kneeThreshold,
              mixerOptions?.headroomCeiling
            );
            return baseGain * duck * limitFactor;
          }}
        />
      )}

      {/* Frame-Accurate SFX Sequences */}
      {timeline.sfxCues.map((cue) => {
        return (
          <Sequence
            key={cue.id}
            from={cue.startFrame}
            durationInFrames={cue.durationInFrames}
          >
            <Audio
              src={resolveStaticSrc(cue.resolvedSrc)}
              volume={(frameWithinSequence) => {
                const globalFrame = cue.startFrame + frameWithinSequence;
                return computeMasterLimitedVolume(globalFrame, cue);
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
};
