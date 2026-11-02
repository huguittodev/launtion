/**
 * telemetry-synthesizer.ts
 *
 * Direct observed telemetry synthesizer for Phase 6.
 * Transforms raw recorded pointer events into a strict InteractionMap v2.0
 * where 100% of telemetry events carry mandatory provenance: 'observed'.
 * Adapts synthesized InteractionMap into an executable Remotion SceneGraph v2.0
 * with synchronized 3D camera focal tracking, vector cursor glide, and SFX cues.
 */

import { CoordinateMapper } from '../interaction-map/CoordinateMapper';
import { InteractionMapSchema } from '../interaction-map/schema';
import { DEFAULT_ACCENT } from '../design/tokens';
import type { InteractionEvent, InteractionMap } from '../interaction-map/types';
import { interactionToSceneGraphAdapter } from '../scene-graph/adapter';
import { SceneGraphSchema } from '../scene-graph/schema';
import type {
  CompletedRecordingSession,
  RawRecordingSession,
  RecordedPointerEvent,
  RecordingSessionMetadata,
  RecordingSessionSummary,
  TelemetrySynthesizerOptions,
} from './types';

/**
 * Transforms raw pointer events into a strict InteractionMap v2.0.
 * Invariant: Every generated event MUST have provenance: 'observed'.
 */
export function synthesizeObservedInteractionMapFromEvents(
  rawEvents: RecordedPointerEvent[],
  durationMs: number,
  options?: TelemetrySynthesizerOptions
): InteractionMap {
  const fps = options?.fps ?? 30;
  const baseWidth = options?.baseWidth ?? 1920;
  const baseHeight = options?.baseHeight ?? 1080;
  const durationInFrames = Math.max(
    30,
    Math.round((Math.max(100, durationMs) / 1000) * fps)
  );

  const sortedRaw = [...rawEvents].sort((a, b) => a.timestampMs - b.timestampMs);
  const events: InteractionEvent[] = [];
  const minDwellMs = options?.minDwellMsForFocus ?? 300;
  const dedupeRadius = options?.deduplicateMoveRadius ?? 0.002;

  let lastX = -1;
  let lastY = -1;
  let lastFrame = -1;

  for (let i = 0; i < sortedRaw.length; i++) {
    const raw = sortedRaw[i];
    const frame = Math.max(
      0,
      Math.min(durationInFrames, Math.round((raw.timestampMs / 1000) * fps))
    );
    const clampedX = CoordinateMapper.clamp01(raw.x);
    const clampedY = CoordinateMapper.clamp01(raw.y);

    if (raw.type === 'click') {
      // Check if user dwelled before clicking to synthesize an observed focus prelude
      const prev = sortedRaw[i - 1];
      if (prev && raw.timestampMs - prev.timestampMs >= minDwellMs) {
        const focusFrame = Math.max(0, frame - Math.round((minDwellMs / 1000) * fps));
        if (focusFrame !== lastFrame) {
          events.push({
            id: `obs-focus-${focusFrame}-${events.length}`,
            type: 'focus',
            frame: focusFrame,
            duration: Math.max(10, frame - focusFrame),
            x: clampedX,
            y: clampedY,
            provenance: 'observed',
            targetId: raw.targetId || undefined,
            metadata: {
              zoomTarget: options?.clickZoom ?? 2.2,
              targetTag: raw.targetTag,
              targetText: raw.targetElement?.textSnippet,
            },
          });
        }
      }

      events.push({
        id: `obs-click-${frame}-${events.length}`,
        type: 'click',
        frame,
        duration: 15,
        x: clampedX,
        y: clampedY,
        provenance: 'observed',
        targetId: raw.targetId || undefined,
        metadata: {
          button: raw.button ?? 0,
          audioCue: 'mouse-click',
          targetTag: raw.targetTag,
          targetText: raw.targetElement?.textSnippet,
          clickRipple: true,
        },
      });

      lastX = clampedX;
      lastY = clampedY;
      lastFrame = frame;
      continue;
    }

    if (raw.type === 'wheel' || raw.type === 'scroll') {
      events.push({
        id: `obs-scroll-${frame}-${events.length}`,
        type: 'scroll',
        frame,
        duration: 10,
        x: clampedX,
        y: clampedY,
        provenance: 'observed',
        targetId: raw.targetId || undefined,
        metadata: {
          deltaY: raw.deltaY ?? 100,
        },
      });
      continue;
    }

    // Process movements and hovers with spatial deduplication
    const dist = Math.hypot(clampedX - lastX, clampedY - lastY);
    if (dist >= dedupeRadius || frame > lastFrame + 15) {
      events.push({
        id: `obs-move-${frame}-${events.length}`,
        type: 'hover',
        frame,
        duration: 5,
        x: clampedX,
        y: clampedY,
        provenance: 'observed',
        targetId: raw.targetId || undefined,
      });

      lastX = clampedX;
      lastY = clampedY;
      lastFrame = frame;
    }
  }

  // Safe fallback holding behavior for idle recording (zero clicks or zero events)
  if (events.length === 0) {
    events.push({
      id: 'obs-initial-overview',
      type: 'focus',
      frame: 0,
      duration: durationInFrames,
      x: 0.5,
      y: 0.5,
      provenance: 'observed',
      metadata: { zoomTarget: options?.overviewZoom ?? 1.0 },
    });
  }

  // Ensure chronological ordering by frame
  events.sort((a, b) => a.frame - b.frame);

  const rawMap: InteractionMap = {
    version: '2.0',
    baseResolution: { width: baseWidth, height: baseHeight },
    fps,
    durationInFrames,
    events,
  };

  return InteractionMapSchema.parse(rawMap);
}

/**
 * Convenience wrapper over a full RawRecordingSession.
 */
export function synthesizeObservedInteractionMap(
  session: RawRecordingSession,
  options?: TelemetrySynthesizerOptions
): InteractionMap {
  return synthesizeObservedInteractionMapFromEvents(
    session.events,
    session.duration_ms,
    {
      fps: options?.fps ?? session.fps ?? 30,
      baseWidth: options?.baseWidth ?? session.viewport.width ?? 1920,
      baseHeight: options?.baseHeight ?? session.viewport.height ?? 1080,
      ...options,
    }
  );
}

/**
 * Creates summary statistics for a completed session.
 */
export function createRecordingSessionSummary(
  session: RawRecordingSession,
  interactionMap: InteractionMap,
  videoMimeType = 'video/webm'
): RecordingSessionSummary {
  const clicksCount = session.events.filter((e) => e.type === 'click').length;
  const movesCount = session.events.filter((e) => e.type === 'move').length;
  const scrollsCount = session.events.filter((e) => e.type === 'wheel' || e.type === 'scroll').length;
  const effectiveFps =
    session.duration_ms > 0
      ? Number(((session.events.length / session.duration_ms) * 1000).toFixed(2))
      : 0;

  return {
    id: session.id,
    status: 'review',
    startedAt: session.t0_ms,
    stoppedAt: session.tEnd_ms,
    durationMs: session.duration_ms,
    durationInFrames: interactionMap.durationInFrames,
    baseResolution: interactionMap.baseResolution,
    eventsCount: session.events.length,
    clicksCount,
    movesCount,
    scrollsCount,
    effectiveFps,
    videoMimeType,
    videoBlobSize: session.videoBlob?.size,
  };
}

/**
 * Adapts an observed recording session into an executable Remotion SceneGraph v2.0.
 * Injects the recorded screen capture video URL into the 3D product surface scene.
 */
export function adaptObservedSessionToSceneGraph(
  session: RawRecordingSession,
  options?: TelemetrySynthesizerOptions
): CompletedRecordingSession {
  const interactionMap = synthesizeObservedInteractionMap(session, options);

  const sceneGraph = interactionToSceneGraphAdapter(interactionMap, {
    artDirection: {
      backdropVariant: 'dark-precision',
      surfaceTheme: 'dark',
      primaryAccent: DEFAULT_ACCENT,
    },
    camera: {
      overviewZoom: options?.overviewZoom ?? 1.0,
      focusZoom: options?.clickZoom ?? 2.2,
      transitionFrames: 25,
      holdFrames: 30,
    },
  });

  // Resolve video URL if available
  let videoUrl = options?.videoDataUri;
  if (!videoUrl && session.videoBlob) {
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      try {
        videoUrl = URL.createObjectURL(session.videoBlob);
      } catch {
        // Ignore blob URL generation issues in Node.js
      }
    }
  }

  // Inject recorded video asset into product_interaction_3d node
  if (videoUrl) {
    const surfaceScene = sceneGraph.scenes.find((s) => s.type === 'product_interaction_3d');
    if (surfaceScene && surfaceScene.payload) {
      surfaceScene.payload.mockInterface = videoUrl;
      surfaceScene.payload.url = videoUrl;
      surfaceScene.payload.assetId = videoUrl;
      surfaceScene.payload.windowTitle = 'Observed Screen Capture';
    }
  }

  const validatedSceneGraph = SceneGraphSchema.parse(sceneGraph);
  const summary = createRecordingSessionSummary(
    session,
    interactionMap,
    session.videoMimeType || 'video/webm'
  );

  const metadata: RecordingSessionMetadata = {
    totalEvents: session.events.length,
    durationMs: session.duration_ms,
    resolution: {
      width: session.viewport.width,
      height: session.viewport.height,
    },
    recordedAt: new Date(session.t0_ms || Date.now()).toISOString(),
    clickCount: summary.clicksCount,
    moveCount: summary.movesCount,
    scrollCount: summary.scrollsCount,
    effectiveFps: summary.effectiveFps,
  };

  return {
    id: session.id,
    videoBlobUrl: videoUrl,
    videoUrl,
    videoBlob: session.videoBlob,
    metadata,
    summary,
    events: session.events,
    rawEvents: session.events,
    interactionMap,
    sceneGraph: validatedSceneGraph,
  };
}
