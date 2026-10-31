/**
 * AudioTimeline.ts
 * Frame-accurate deterministic audio cue scheduler consuming SceneGraph.audioTrack.
 */

import type { AudioAsset, AudioCue } from '../../../src/lib/scene-graph/types';

export interface AssetProfile {
  asset: AudioAsset;
  filename: string;
  durationSec: number;
  durationFramesAt30Fps: number;
  isMusic: boolean;
  duckingPriority: number; // 0 = background, 1 = subtle, 2 = energetic (triggers ducking)
  nominalVolume: number;
}

export const SFX_CATALOG: Record<AudioAsset, AssetProfile> = {
  'ambient-beat': {
    asset: 'ambient-beat',
    filename: 'sfx/ambient-beat.wav',
    durationSec: 18.0,
    durationFramesAt30Fps: 540,
    isMusic: true,
    duckingPriority: 0,
    nominalVolume: 0.32,
  },
  'camera-whoosh': {
    asset: 'camera-whoosh',
    filename: 'sfx/camera-whoosh.wav',
    durationSec: 0.35,
    durationFramesAt30Fps: 12,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.65,
  },
  'chime': {
    asset: 'chime',
    filename: 'sfx/chime.wav',
    durationSec: 0.45,
    durationFramesAt30Fps: 15,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.75,
  },
  'keyboard-tap': {
    asset: 'keyboard-tap',
    filename: 'sfx/keyboard-tap.wav',
    durationSec: 0.05,
    durationFramesAt30Fps: 4,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.50,
  },
  'mouse-click': {
    asset: 'mouse-click',
    filename: 'sfx/mouse-click.wav',
    durationSec: 0.08,
    durationFramesAt30Fps: 5,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.85,
  },
  'soft-pop': {
    asset: 'soft-pop',
    filename: 'sfx/soft-pop.wav',
    durationSec: 0.12,
    durationFramesAt30Fps: 6,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.65,
  },
};

export interface ScheduledCue {
  id: string;
  asset: AudioAsset;
  resolvedSrc: string;
  startFrame: number;
  durationInFrames: number;
  endFrame: number;
  volume: number;
  fadeInFrames: number;
  fadeOutFrames: number;
  isMusic: boolean;
  duckingPriority: number;
}

export interface AudioTimeline {
  durationInFrames: number;
  fps: number;
  cues: ScheduledCue[];
  musicCues: ScheduledCue[];
  sfxCues: ScheduledCue[];
}

/**
 * Builds a deterministic chronological AudioTimeline from SceneGraph audioTrack.
 */
export function buildAudioTimeline(params: {
  audioTrack: AudioCue[];
  durationInFrames: number;
  fps?: number;
}): AudioTimeline {
  const fps = params.fps ?? 30;
  const durationInFrames = Math.max(1, params.durationInFrames);
  const scheduled: ScheduledCue[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < params.audioTrack.length; i++) {
    const rawCue = params.audioTrack[i];
    if (rawCue.frame >= durationInFrames) continue;

    const profile = SFX_CATALOG[rawCue.asset];
    if (!profile) continue; // Unknown/unauthorized assets rejected

    let cueId = rawCue.id || `cue-${rawCue.asset}-${rawCue.frame}`;
    if (seenIds.has(cueId)) {
      cueId = `${cueId}-${i}`;
    }
    seenIds.add(cueId);

    const isMusic = profile.isMusic;
    const duration = isMusic
      ? durationInFrames
      : Math.max(profile.durationFramesAt30Fps, Math.ceil(profile.durationSec * fps));

    const endFrame = Math.min(durationInFrames, rawCue.frame + duration);
    const volume = rawCue.volume ?? profile.nominalVolume;

    scheduled.push({
      id: cueId,
      asset: rawCue.asset,
      resolvedSrc: profile.filename,
      startFrame: rawCue.frame,
      durationInFrames: duration,
      endFrame,
      volume,
      fadeInFrames: rawCue.fadeInFrames ?? (isMusic ? 15 : 0),
      fadeOutFrames: rawCue.fadeOutFrames ?? (isMusic ? 30 : 0),
      isMusic,
      duckingPriority: profile.duckingPriority,
    });
  }

  // Sort chronologically by startFrame
  scheduled.sort((a, b) => a.startFrame - b.startFrame);

  return {
    durationInFrames,
    fps,
    cues: scheduled,
    musicCues: scheduled.filter((c) => c.isMusic),
    sfxCues: scheduled.filter((c) => !c.isMusic),
  };
}

/**
 * Returns all active scheduled cues for a given frame.
 */
export function getActiveCuesAtFrame(
  timeline: AudioTimeline,
  frame: number
): ScheduledCue[] {
  return timeline.cues.filter((c) => frame >= c.startFrame && frame < c.endFrame);
}
