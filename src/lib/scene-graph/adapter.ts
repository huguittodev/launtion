/**
 * adapter.ts
 * Pure deterministic transformation from InteractionMap to SceneGraph.
 */

import { clamp, clamp01, distanceNormalized } from '../interaction-map/CoordinateMapper';
import type { InteractionEvent, InteractionMap } from '../interaction-map/types';
import type {
  AudioCue,
  CameraKeyframe,
  CursorKeyframe,
  SceneGraph,
  SceneNode,
} from './types';

export interface AdapterOptions {
  artDirection?: {
    backdropVariant?: 'dark-precision' | 'light-editorial' | 'aurora-blur' | 'solid';
    surfaceTheme?: 'light' | 'dark';
    primaryAccent?: string;
  };
  camera?: {
    overviewZoom?: number; // Default 1.0
    focusZoom?: number; // Default 2.2
    transitionFrames?: number; // Default 35
    leadInFrames?: number; // Default 15
    holdFrames?: number; // Default 30
    overviewPitchX?: number; // Default 6.0 deg
    overviewYawY?: number; // Default -4.0 deg
  };
  cursor?: {
    curvatureFactor?: number; // Default 0.18
    minMoveFrames?: number; // Default 18
    maxMoveFrames?: number; // Default 40
  };
  audio?: {
    ambientVolume?: number; // Default 0.35
    clickVolume?: number; // Default 0.85
    whooshVolume?: number; // Default 0.45
    tapVolume?: number; // Default 0.50
    popVolume?: number; // Default 0.60
    chimeVolume?: number; // Default 0.70
  };
  scenes?: SceneNode[];
  generateMultiSceneSequence?: boolean;
}

/**
 * Calculates a curved Bezier control point perpendicular to the movement chord.
 */
function computeBezierControlPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  curvature = 0.18
): { controlX: number; controlY: number } {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.02) {
    return {
      controlX: clamp01((p0.x + p1.x) / 2),
      controlY: clamp01((p0.y + p1.y) / 2),
    };
  }

  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;

  // Unit normal vectors perpendicular to movement chord
  const nx1 = -dy / dist;
  const ny1 = dx / dist;

  const nx2 = dy / dist;
  const ny2 = -dx / dist;

  // Offset magnitude scaled by distance
  const offset = curvature * dist * Math.min(1.0, dist / 0.15);

  const c1 = { x: mx + nx1 * offset, y: my + ny1 * offset };
  const c2 = { x: mx + nx2 * offset, y: my + ny2 * offset };

  // Select candidate closest to center or within safe bounds
  const isC1Valid = c1.x >= 0.05 && c1.x <= 0.95 && c1.y >= 0.05 && c1.y <= 0.95;
  const isC2Valid = c2.x >= 0.05 && c2.x <= 0.95 && c2.y >= 0.05 && c2.y <= 0.95;

  let chosen = c1;
  if (!isC1Valid && isC2Valid) {
    chosen = c2;
  } else if (isC1Valid && isC2Valid) {
    // Biomechanical upward bias or center attraction
    chosen = c1.y <= c2.y ? c1 : c2;
  }

  return {
    controlX: clamp(chosen.x, 0.05, 0.95),
    controlY: clamp(chosen.y, 0.05, 0.95),
  };
}

/**
 * Pure deterministic transformation from InteractionMap to SceneGraph.
 */
export function interactionToSceneGraphAdapter(
  interactionMap: InteractionMap,
  options?: AdapterOptions
): SceneGraph {
  const fps = interactionMap.fps || 30;
  const duration = interactionMap.durationInFrames;
  const width = interactionMap.baseResolution.width;
  const height = interactionMap.baseResolution.height;

  const camOpt = {
    overviewZoom: options?.camera?.overviewZoom ?? 1.0,
    focusZoom: options?.camera?.focusZoom ?? 2.2,
    transitionFrames: options?.camera?.transitionFrames ?? 35,
    leadInFrames: options?.camera?.leadInFrames ?? 15,
    holdFrames: options?.camera?.holdFrames ?? 30,
    overviewPitchX: options?.camera?.overviewPitchX ?? 6.0,
    overviewYawY: options?.camera?.overviewYawY ?? -4.0,
  };

  const curOpt = {
    curvatureFactor: options?.cursor?.curvatureFactor ?? 0.18,
    minMoveFrames: options?.cursor?.minMoveFrames ?? 18,
    maxMoveFrames: options?.cursor?.maxMoveFrames ?? 40,
  };

  const audOpt = {
    ambientVolume: options?.audio?.ambientVolume ?? 0.35,
    clickVolume: options?.audio?.clickVolume ?? 0.85,
    whooshVolume: options?.audio?.whooshVolume ?? 0.45,
    tapVolume: options?.audio?.tapVolume ?? 0.50,
    popVolume: options?.audio?.popVolume ?? 0.60,
    chimeVolume: options?.audio?.chimeVolume ?? 0.70,
  };

  // Sort events chronologically to guarantee deterministic processing
  const sortedEvents: InteractionEvent[] = [...interactionMap.events].sort(
    (a, b) => a.frame - b.frame
  );

  // ---------------------------------------------------------------------------
  // 1. Build Camera Track
  // ---------------------------------------------------------------------------
  const cameraTrack: CameraKeyframe[] = [];

  const addCameraKeyframe = (kf: CameraKeyframe): void => {
    const clampedFrame = Math.max(0, Math.min(duration, kf.frame));
    const kfClamped: CameraKeyframe = {
      ...kf,
      frame: clampedFrame,
      x: clamp01(kf.x),
      y: clamp01(kf.y),
      zoom: clamp(kf.zoom, 0.8, 3.5),
    };

    if (cameraTrack.length === 0) {
      cameraTrack.push(kfClamped);
      return;
    }

    const last = cameraTrack[cameraTrack.length - 1];
    if (kfClamped.frame > last.frame) {
      cameraTrack.push(kfClamped);
    } else if (kfClamped.frame === last.frame) {
      // Overwrite/update if at exact same frame
      cameraTrack[cameraTrack.length - 1] = kfClamped;
    }
  };

  // Initial establishing wide keyframe
  addCameraKeyframe({
    frame: 0,
    x: 0.5,
    y: 0.5,
    zoom: camOpt.overviewZoom,
    rotateX: camOpt.overviewPitchX,
    rotateY: camOpt.overviewYawY,
    rotateZ: 0,
    easing: 'ease-in-out',
  });

  // Extract focal events (explicit focus events, clicks, or events with zoom targets)
  const focalEvents = sortedEvents.filter(
    (e) =>
      e.type === 'focus' ||
      e.type === 'click' ||
      (e.metadata?.zoomTarget && typeof e.metadata.zoomTarget === 'number')
  );

  let lastCamEndFrame = 0;

  for (const event of focalEvents) {
    const targetX = clamp(event.x, 0.15, 0.85);
    const targetY = clamp(event.y, 0.15, 0.85);
    const eventZoomTarget =
      typeof event.metadata?.zoomTarget === 'number'
        ? clamp(event.metadata.zoomTarget, 0.8, 3.5)
        : event.type === 'click'
        ? camOpt.focusZoom
        : camOpt.focusZoom;

    const eventRotateX =
      typeof event.metadata?.rotateX === 'number'
        ? clamp(event.metadata.rotateX, -90, 90)
        : 0;
    const eventRotateY =
      typeof event.metadata?.rotateY === 'number'
        ? clamp(event.metadata.rotateY, -90, 90)
        : 0;

    const arrivalFrame = Math.max(lastCamEndFrame + 1, Math.min(duration, event.frame));
    const departureFrame = Math.max(
      lastCamEndFrame + 1,
      arrivalFrame - camOpt.transitionFrames
    );

    // If there is a large quiescent gap between actions, insert an overview pullback
    if (departureFrame > lastCamEndFrame + 30) {
      const overviewReturn = lastCamEndFrame + 20;
      if (overviewReturn < departureFrame - 10) {
        addCameraKeyframe({
          frame: overviewReturn,
          x: 0.5,
          y: 0.5,
          zoom: camOpt.overviewZoom,
          rotateX: camOpt.overviewPitchX * 0.8,
          rotateY: camOpt.overviewYawY * 0.8,
          rotateZ: 0,
          easing: 'ease-in-out',
        });
      }
    }

    const prevKf = cameraTrack[cameraTrack.length - 1];

    // Departure keyframe
    if (departureFrame > prevKf.frame) {
      addCameraKeyframe({
        frame: departureFrame,
        x: prevKf.x,
        y: prevKf.y,
        zoom: prevKf.zoom,
        rotateX: prevKf.rotateX,
        rotateY: prevKf.rotateY,
        rotateZ: 0,
        easing: 'ease-in-out',
      });
    }

    // Arrival keyframe
    addCameraKeyframe({
      frame: arrivalFrame,
      x: targetX,
      y: targetY,
      zoom: eventZoomTarget,
      rotateX: eventRotateX,
      rotateY: eventRotateY,
      rotateZ: 0,
      easing: 'ease-in-out',
    });

    // Hold keyframe
    const holdDuration = event.duration ?? camOpt.holdFrames;
    const holdEndFrame = Math.min(duration, arrivalFrame + holdDuration);

    if (holdEndFrame > arrivalFrame) {
      addCameraKeyframe({
        frame: holdEndFrame,
        x: targetX,
        y: targetY,
        zoom: eventZoomTarget,
        rotateX: eventRotateX,
        rotateY: eventRotateY,
        rotateZ: 0,
        easing: 'ease-in-out',
      });
    }

    lastCamEndFrame = holdEndFrame;
  }

  // Final concluding pullback to overview
  if (lastCamEndFrame < duration - 15) {
    const pullbackStart = Math.min(duration - 10, lastCamEndFrame + 5);
    const pullbackEnd = Math.min(duration, pullbackStart + 35);

    const prevKf = cameraTrack[cameraTrack.length - 1];
    if (pullbackStart > prevKf.frame) {
      addCameraKeyframe({
        frame: pullbackStart,
        x: prevKf.x,
        y: prevKf.y,
        zoom: prevKf.zoom,
        rotateX: prevKf.rotateX,
        rotateY: prevKf.rotateY,
        rotateZ: 0,
        easing: 'ease-in-out',
      });
    }

    addCameraKeyframe({
      frame: pullbackEnd,
      x: 0.5,
      y: 0.5,
      zoom: camOpt.overviewZoom,
      rotateX: camOpt.overviewPitchX * 0.6,
      rotateY: camOpt.overviewYawY * 0.6,
      rotateZ: 0,
      easing: 'ease-in-out',
    });
  }

  // ---------------------------------------------------------------------------
  // 2. Build Cursor Track
  // ---------------------------------------------------------------------------
  const cursorTrack: CursorKeyframe[] = [];

  const addCursorKeyframe = (kf: CursorKeyframe): void => {
    const clampedFrame = Math.max(0, Math.min(duration, kf.frame));
    const kfClamped: CursorKeyframe = {
      ...kf,
      frame: clampedFrame,
      x: clamp01(kf.x),
      y: clamp01(kf.y),
    };

    if (cursorTrack.length === 0) {
      cursorTrack.push(kfClamped);
      return;
    }

    const last = cursorTrack[cursorTrack.length - 1];
    if (kfClamped.frame > last.frame) {
      cursorTrack.push(kfClamped);
    } else if (kfClamped.frame === last.frame) {
      cursorTrack[cursorTrack.length - 1] = kfClamped;
    }
  };

  let currentPos = { x: 0.7, y: 0.8 };
  let currentCursorFrame = 0;

  // Initial cursor rest position
  addCursorKeyframe({
    frame: 0,
    x: currentPos.x,
    y: currentPos.y,
  });

  for (const event of sortedEvents) {
    const targetPos = {
      x: clamp(event.x, 0.05, 0.95),
      y: clamp(event.y, 0.05, 0.95),
    };

    const dist = distanceNormalized(currentPos, targetPos);
    const moveDuration = Math.round(
      clamp(18 + dist * 30, curOpt.minMoveFrames, curOpt.maxMoveFrames)
    );
    const startMoveFrame = Math.max(currentCursorFrame + 1, event.frame - moveDuration);

    // If there was an idle rest period before this movement departed, insert a rest hold keyframe
    if (startMoveFrame > currentCursorFrame + 3) {
      addCursorKeyframe({
        frame: startMoveFrame,
        x: currentPos.x,
        y: currentPos.y,
      });
    }

    // Determine Bezier control point
    let controlPoint: { controlX: number; controlY: number };
    if (
      typeof event.metadata?.curveControlX === 'number' &&
      typeof event.metadata?.curveControlY === 'number'
    ) {
      controlPoint = {
        controlX: event.metadata.curveControlX,
        controlY: event.metadata.curveControlY,
      };
    } else {
      controlPoint = computeBezierControlPoint(
        currentPos,
        targetPos,
        curOpt.curvatureFactor
      );
    }

    addCursorKeyframe({
      frame: event.frame,
      x: targetPos.x,
      y: targetPos.y,
      controlX: controlPoint.controlX,
      controlY: controlPoint.controlY,
      click: event.type === 'click',
    });

    currentPos = targetPos;
    currentCursorFrame = event.frame;
  }

  // ---------------------------------------------------------------------------
  // 3. Build Audio Track
  // ---------------------------------------------------------------------------
  const audioTrack: AudioCue[] = [];
  const cueIds = new Set<string>();

  const addAudioCue = (cue: AudioCue): void => {
    if (cue.frame > duration) return;
    let uniqueId = cue.id;
    let counter = 1;
    while (cueIds.has(uniqueId)) {
      uniqueId = `${cue.id}-${counter++}`;
    }
    cueIds.add(uniqueId);
    audioTrack.push({ ...cue, id: uniqueId });
  };

  // Continuous background ambient beat
  addAudioCue({
    id: 'ambient-beat-main',
    frame: 0,
    asset: 'ambient-beat',
    volume: audOpt.ambientVolume,
    fadeInFrames: 15,
    fadeOutFrames: 30,
  });

  // Schedule event-specific SFX cues
  for (const event of sortedEvents) {
    if (event.type === 'click') {
      addAudioCue({
        id: `sfx-click-${event.frame}`,
        frame: event.frame,
        asset: 'mouse-click',
        volume: audOpt.clickVolume,
      });
    }

    const explicitCue = event.metadata?.audioCue;
    if (typeof explicitCue === 'string') {
      if (explicitCue === 'keyboard-tap') {
        addAudioCue({
          id: `sfx-tap-${event.frame}`,
          frame: event.frame,
          asset: 'keyboard-tap',
          volume: audOpt.tapVolume,
        });
      } else if (explicitCue === 'soft-pop') {
        addAudioCue({
          id: `sfx-pop-${event.frame}`,
          frame: event.frame,
          asset: 'soft-pop',
          volume: audOpt.popVolume,
        });
      } else if (explicitCue === 'chime') {
        addAudioCue({
          id: `sfx-chime-${event.frame}`,
          frame: event.frame,
          asset: 'chime',
          volume: audOpt.chimeVolume,
        });
      }
    }
  }

  // Schedule camera whooshes on significant zoom transitions
  let lastWhooshFrame = -999;
  for (let i = 1; i < cameraTrack.length; i++) {
    const prev = cameraTrack[i - 1];
    const curr = cameraTrack[i];
    const zoomDelta = Math.abs(curr.zoom - prev.zoom);

    if (zoomDelta >= 0.5 && curr.frame - prev.frame >= 10) {
      const whooshFrame = Math.min(duration, prev.frame + 2);
      if (whooshFrame - lastWhooshFrame >= 30) {
        addAudioCue({
          id: `sfx-whoosh-${whooshFrame}`,
          frame: whooshFrame,
          asset: 'camera-whoosh',
          volume: audOpt.whooshVolume,
        });
        lastWhooshFrame = whooshFrame;
      }
    }
  }

  // Concluding success chime if not already present
  const hasOutroChime = audioTrack.some(
    (cue) => cue.asset === 'chime' && cue.frame >= duration - 90
  );
  if (!hasOutroChime) {
    addAudioCue({
      id: 'sfx-chime-outro',
      frame: Math.max(0, duration - 60),
      asset: 'chime',
      volume: audOpt.chimeVolume,
    });
  }

  // Sort audio track chronologically
  audioTrack.sort((a, b) => a.frame - b.frame);

  // ---------------------------------------------------------------------------
  // 4. Build Semantic Scene Nodes
  // ---------------------------------------------------------------------------
  let scenes: SceneNode[];

  if (options?.scenes && options.scenes.length > 0) {
    scenes = options.scenes;
  } else if (options?.generateMultiSceneSequence) {
    // Multi-scene sequence spanning the timeline budget
    const quarter = Math.floor(duration / 4);
    scenes = [
      {
        id: 'scene-1-prompt',
        type: 'synthetic_prompt_box',
        startFrame: 0,
        fromFrame: 0,
        durationInFrames: quarter,
        payload: {
          textToType: 'I want to build a bike renting app with real-time terrain tracking',
          typingSpeed: 2,
          showMicrophone: true,
          submitOnComplete: true,
        },
      },
      {
        id: 'scene-2-architecture',
        type: 'synthetic_code_tree',
        startFrame: quarter,
        fromFrame: quarter,
        durationInFrames: quarter,
        payload: {
          title: 'Base44 Architecture • Fleet Engine',
          files: ['routes/fleet.ts', 'sync/calendar.ts', 'telemetry/geo.ts'],
        },
      },
      {
        id: 'scene-3-hero-action',
        type: 'synthetic_hero_button',
        startFrame: quarter * 2,
        fromFrame: quarter * 2,
        durationInFrames: quarter,
        payload: {
          buttonText: 'Publish',
          variant: 'glow-primary',
          clickFrame: quarter * 2 + Math.floor(quarter / 2),
        },
      },
      {
        id: 'scene-4-closing',
        type: 'brand_closing_cta',
        startFrame: quarter * 3,
        fromFrame: quarter * 3,
        durationInFrames: duration - quarter * 3,
        payload: {
          productName: 'Base44',
          tagline: 'Build it your way',
          showLogo: true,
          buttonText: 'Get Started Free',
        },
      },
    ];
  } else {
    // Default interactive 3D product surface scene spanning full duration
    scenes = [
      {
        id: 'scene-product-3d',
        type: 'product_interaction_3d',
        startFrame: 0,
        fromFrame: 0,
        durationInFrames: duration,
        payload: {
          windowTitle: 'Base44 SaaS Studio — Dynamic Surface',
          eventsCount: sortedEvents.length,
        },
      },
    ];
  }

  return {
    version: '2.0',
    canvas: {
      width,
      height,
      fps,
      durationInFrames: duration,
    },
    artDirection: {
      backdropVariant: options?.artDirection?.backdropVariant ?? 'dark-precision',
      surfaceTheme: options?.artDirection?.surfaceTheme ?? 'dark',
      primaryAccent: options?.artDirection?.primaryAccent ?? '#FF5C35',
    },
    cameraTrack,
    cursorTrack,
    audioTrack,
    scenes,
  };
}
