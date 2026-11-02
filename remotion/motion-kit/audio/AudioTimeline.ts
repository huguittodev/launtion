/**
 * AudioTimeline.ts
 * Frame-accurate deterministic audio cue scheduler consuming SceneGraph.audioTrack.
 * Supports 18 allowlisted commercial SFX assets, dynamic sidechain ducking profiles,
 * and procedural sound scheduling (keystroke cycling, click alternation, scene transition whooshes).
 */

import type { AudioAsset, AudioCue } from '../../../src/lib/scene-graph/types';

export interface AssetProfile {
  asset: AudioAsset;
  filename: string;
  durationSec: number;
  durationFramesAt30Fps: number;
  isMusic: boolean;
  duckingPriority: number; // 0 = background, 1 = subtle (no ducking), 2 = energetic (triggers sidechain ducking)
  nominalVolume: number;
}

/**
 * Complete 18-Asset Catalog of Studio-Grade Commercial Audio Profiles.
 * Adheres strictly to AGENTS.md Rule 14 and Vidiaura Art Direction.
 */
export const SFX_CATALOG: Record<AudioAsset, AssetProfile> = {
  // --- Legacy Assets (Preserved 100% Backward Compatible) ---
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

  // --- Expanded 12-Piece SaaS SFX Bank (Base44 Cinematic Direction) ---
  'transition-whoosh-heavy': {
    asset: 'transition-whoosh-heavy',
    filename: 'sfx/transition-whoosh-heavy.wav',
    durationSec: 0.50,
    durationFramesAt30Fps: 15,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.70,
  },
  'transition-whoosh-fast': {
    asset: 'transition-whoosh-fast',
    filename: 'sfx/transition-whoosh-fast.wav',
    durationSec: 0.30,
    durationFramesAt30Fps: 9,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.65,
  },
  'sound-riser': {
    asset: 'sound-riser',
    filename: 'sfx/sound-riser.wav',
    durationSec: 1.20,
    durationFramesAt30Fps: 36,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.60,
  },
  'sub-bass-drop': {
    asset: 'sub-bass-drop',
    filename: 'sfx/sub-bass-drop.wav',
    durationSec: 0.80,
    durationFramesAt30Fps: 24,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.75,
  },
  'click-switch': {
    asset: 'click-switch',
    filename: 'sfx/click-switch.wav',
    durationSec: 0.06,
    durationFramesAt30Fps: 4,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.80,
  },
  'click-soft': {
    asset: 'click-soft',
    filename: 'sfx/click-soft.wav',
    durationSec: 0.05,
    durationFramesAt30Fps: 3,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.60,
  },
  'mechanical-tap-1': {
    asset: 'mechanical-tap-1',
    filename: 'sfx/mechanical-tap-1.wav',
    durationSec: 0.05,
    durationFramesAt30Fps: 3,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.45,
  },
  'mechanical-tap-2': {
    asset: 'mechanical-tap-2',
    filename: 'sfx/mechanical-tap-2.wav',
    durationSec: 0.05,
    durationFramesAt30Fps: 3,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.45,
  },
  'mechanical-tap-3': {
    asset: 'mechanical-tap-3',
    filename: 'sfx/mechanical-tap-3.wav',
    durationSec: 0.05,
    durationFramesAt30Fps: 3,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.45,
  },
  'mechanical-tap-4': {
    asset: 'mechanical-tap-4',
    filename: 'sfx/mechanical-tap-4.wav',
    durationSec: 0.05,
    durationFramesAt30Fps: 3,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.45,
  },
  'pop-clean': {
    asset: 'pop-clean',
    filename: 'sfx/pop-clean.wav',
    durationSec: 0.10,
    durationFramesAt30Fps: 5,
    isMusic: false,
    duckingPriority: 1,
    nominalVolume: 0.65,
  },
  'success-chime': {
    asset: 'success-chime',
    filename: 'sfx/success-chime.wav',
    durationSec: 0.60,
    durationFramesAt30Fps: 18,
    isMusic: false,
    duckingPriority: 2,
    nominalVolume: 0.70,
  },
};

/* ========================================================================= */
/* Procedural Audio Scheduling Constants & Utilities                        */
/* ========================================================================= */

/**
 * 4-Variant mechanical tap cycle avoiding machine-gun acoustic repetition.
 */
export const MECHANICAL_TAPS: readonly AudioAsset[] = [
  'mechanical-tap-1',
  'mechanical-tap-2',
  'mechanical-tap-3',
  'mechanical-tap-4',
] as const;

/**
 * Returns round-robin mechanical tap asset for a given keystroke index.
 */
export function getMechanicalTapAsset(index: number): AudioAsset {
  const safeIndex = Math.abs(Math.floor(index));
  return MECHANICAL_TAPS[safeIndex % MECHANICAL_TAPS.length];
}

/**
 * Click interaction roles for procedural dispatch.
 */
export type ClickInteractionRole = 'subtle' | 'primary' | 'standard';

/**
 * Resolves appropriate click SFX asset based on interaction weight and sequence index.
 */
export function resolveClickAsset(role: ClickInteractionRole = 'standard', index = 0): AudioAsset {
  switch (role) {
    case 'subtle':
      return 'click-soft';
    case 'primary':
      return 'click-switch';
    case 'standard':
    default:
      // Alternates between mouse-click and click-soft to eliminate repetition
      return index % 2 === 0 ? 'mouse-click' : 'click-soft';
  }
}

export interface SceneBoundary {
  startFrame: number;
  durationInFrames: number;
  type?: string;
}

export interface ProceduralAudioOptions {
  /**
   * If true, remaps repetitive 'keyboard-tap' cues across mechanical-tap-1..4.
   */
  enableKeystrokeCycling?: boolean;

  /**
   * If true, alternates generic 'mouse-click' cues across click-soft, click-switch, and mouse-click.
   */
  enableClickAlternation?: boolean;

  /**
   * If true and scenes are provided, automatically schedules transition whooshes at scene boundaries.
   */
  enableSceneTransitions?: boolean;

  /**
   * Scene nodes or boundary descriptors used for scene transition whooshes.
   */
  scenes?: SceneBoundary[];

  /**
   * Lead frame offset for scene transition whoosh (e.g. 2 frames before boundary).
   */
  sceneWhooshLeadFrames?: number;
}

/**
 * Generates an array of AudioCues for simulated typing with round-robin tap variations.
 */
export function scheduleProceduralKeystrokes(params: {
  startFrame: number;
  charCount: number;
  framesPerChar?: number;
  volume?: number;
  idPrefix?: string;
}): AudioCue[] {
  const { startFrame, charCount, framesPerChar = 3, volume, idPrefix = 'type' } = params;
  const cues: AudioCue[] = [];

  for (let i = 0; i < charCount; i++) {
    const frame = startFrame + i * framesPerChar;
    const asset = getMechanicalTapAsset(i);
    cues.push({
      id: `${idPrefix}-${i}-${frame}`,
      frame,
      asset,
      volume: volume ?? SFX_CATALOG[asset]?.nominalVolume ?? 0.45,
    });
  }

  return cues;
}

/**
 * Generates transition whooshes on scene boundaries.
 */
export function scheduleSceneTransitionWhooshes(params: {
  scenes: SceneBoundary[];
  canvasDurationInFrames: number;
  leadFrames?: number;
  volume?: number;
}): AudioCue[] {
  const { scenes, canvasDurationInFrames, leadFrames = 2, volume } = params;
  const whooshCues: AudioCue[] = [];

  // Skip scene 0 start frame (0) since intro music starts there
  for (let i = 1; i < scenes.length; i++) {
    const scene = scenes[i];
    const triggerFrame = Math.max(0, scene.startFrame - leadFrames);
    if (triggerFrame >= canvasDurationInFrames) continue;

    // Heavy transition for 3D product entry or brand closing CTA, fast for intermediate feature cards
    const isHeavy =
      scene.type === 'product_interaction_3d' ||
      scene.type === 'brand_closing_cta' ||
      i === 1 ||
      i === scenes.length - 1;

    const asset: AudioAsset = isHeavy ? 'transition-whoosh-heavy' : 'transition-whoosh-fast';

    whooshCues.push({
      id: `scene-trans-whoosh-${i}-${triggerFrame}`,
      frame: triggerFrame,
      asset,
      volume: volume ?? SFX_CATALOG[asset]?.nominalVolume ?? 0.70,
    });
  }

  return whooshCues;
}

/* ========================================================================= */
/* Audio Timeline Assembly & Scheduling Engine                              */
/* ========================================================================= */

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

export interface BuildAudioTimelineParams {
  audioTrack: AudioCue[];
  durationInFrames: number;
  fps?: number;
  procedural?: ProceduralAudioOptions;
}

/**
 * Builds a deterministic chronological AudioTimeline from SceneGraph audioTrack,
 * with optional procedural audio enhancement (keystroke cycling, click alternation, scene whooshes).
 */
export function buildAudioTimeline(params: BuildAudioTimelineParams): AudioTimeline {
  const fps = params.fps ?? 30;
  const durationInFrames = Math.max(1, params.durationInFrames);
  const procedural = params.procedural;

  // Process raw cues through procedural pipeline if requested
  let workingTrack = [...params.audioTrack];

  if (procedural?.enableKeystrokeCycling) {
    let tapCounter = 0;
    workingTrack = workingTrack.map((cue) => {
      if (cue.asset === 'keyboard-tap') {
        const cycledAsset = getMechanicalTapAsset(tapCounter++);
        return { ...cue, asset: cycledAsset };
      }
      return cue;
    });
  }

  if (procedural?.enableClickAlternation) {
    let clickCounter = 0;
    workingTrack = workingTrack.map((cue) => {
      if (cue.asset === 'mouse-click') {
        const variants: AudioAsset[] = ['mouse-click', 'click-soft', 'click-switch'];
        const cycledAsset = variants[clickCounter % variants.length];
        clickCounter++;
        return { ...cue, asset: cycledAsset };
      }
      return cue;
    });
  }

  if (procedural?.enableSceneTransitions && procedural.scenes && procedural.scenes.length > 1) {
    const whooshCues = scheduleSceneTransitionWhooshes({
      scenes: procedural.scenes,
      canvasDurationInFrames: durationInFrames,
      leadFrames: procedural.sceneWhooshLeadFrames ?? 2,
    });
    workingTrack.push(...whooshCues);
  }

  const scheduled: ScheduledCue[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < workingTrack.length; i++) {
    const rawCue = workingTrack[i];
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
