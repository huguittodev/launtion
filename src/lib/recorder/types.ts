/**
 * types.ts
 *
 * Formal TypeScript contracts for Phase 6: Screen Recorder Module & Observed Telemetry.
 * Defines schemas for raw and observed pointer events, display media stream options,
 * session metadata, and Remotion SceneGraph adapter outputs.
 */

import type { BaseResolution, InteractionMap } from '../interaction-map/types';
import type { SceneGraph } from '../scene-graph/types';

export type RecordedPointerEventType =
  | 'move'
  | 'click'
  | 'mousedown'
  | 'mouseup'
  | 'pointerdown'
  | 'pointerup'
  | 'wheel'
  | 'scroll'
  | 'hover';

export type RawPointerEventType = RecordedPointerEventType;

export interface TargetElementMetadata {
  tagName: string;
  id?: string;
  className?: string;
  textSnippet?: string;
}

export interface RecordedPointerEvent {
  id: string;
  type: RecordedPointerEventType;
  timestampMs: number; // Elapsed milliseconds relative to recording session start (t - t0)
  t_ms: number; // Alias for elapsed milliseconds
  timestamp: number; // Absolute epoch timestamp (performance.timeOrigin + performance.now() or Date.now())
  x: number; // Normalized coordinate [0.0, 1.0]
  y: number; // Normalized coordinate [0.0, 1.0]
  normalizedX?: number; // Alias for normalized x
  normalizedY?: number; // Alias for normalized y
  rawPixelX?: number; // Native screen / client pixel X
  rawPixelY?: number; // Native screen / client pixel Y
  clientX?: number; // Native screen / client pixel X
  clientY?: number; // Native screen / client pixel Y
  button?: number; // Pointer button: 0 (left), 1 (middle), 2 (right)
  targetTag?: string; // HTML tag name of target element
  targetId?: string; // DOM id attribute
  targetElement?: TargetElementMetadata;
  deltaY?: number; // Vertical scroll delta
}

export type RawPointerEvent = RecordedPointerEvent;

export interface RecordingViewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export type CursorCaptureMode = 'never' | 'always' | 'motion';

export interface RecorderConfig {
  fps: number; // Default 30
  maxDurationSeconds: number; // Default 60
  throttleMs: number; // Default 33 (approx 30 FPS throttle)
  captureCursor: CursorCaptureMode; // Default 'never'
  videoBitsPerSecond?: number; // Default 5,000,000 (5 Mbps)
  captureAudio?: boolean; // Default true
  timesliceMs?: number; // Default 500
}

export interface StreamRecorderOptions extends Partial<RecorderConfig> {
  video?: {
    cursor?: CursorCaptureMode;
    displaySurface?: 'browser' | 'window' | 'monitor';
    frameRate?: { ideal?: number; max?: number };
    width?: { ideal?: number; max?: number };
    height?: { ideal?: number; max?: number };
  };
  audio?: boolean;
  mimeTypePreference?: string[];
}

export interface MouseTrackerOptions {
  targetElement?: HTMLElement | Window;
  throttleMs?: number;
  captureElementMetadata?: boolean;
  coordinateReference?: 'viewport' | 'element';
}

export interface TelemetrySynthesizerOptions {
  fps?: number;
  baseWidth?: number;
  baseHeight?: number;
  minDwellMsForFocus?: number;
  clickZoom?: number;
  overviewZoom?: number;
  deduplicateMoveRadius?: number;
  videoDataUri?: string;
}

export type RecordingSessionStatus =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'stopped'
  | 'review'
  | 'completed'
  | 'error';

export type RecorderState = RecordingSessionStatus;

export interface RecordingSessionMetadata {
  totalEvents: number;
  durationMs: number;
  resolution: { width: number; height: number };
  recordedAt: string;
  clickCount?: number;
  moveCount?: number;
  scrollCount?: number;
  effectiveFps?: number;
}

export interface RecordingSessionSummary {
  id: string;
  status: RecordingSessionStatus;
  startedAt: number;
  stoppedAt?: number;
  durationMs: number;
  durationInFrames: number;
  baseResolution: BaseResolution;
  eventsCount: number;
  clicksCount: number;
  movesCount: number;
  scrollsCount?: number;
  effectiveFps: number;
  videoMimeType: string;
  videoBlobSize?: number;
  errorMessage?: string;
}

export interface RawRecordingSession {
  id: string;
  t0_ms: number;
  tEnd_ms: number;
  duration_ms: number;
  viewport: RecordingViewport;
  fps: number;
  events: RecordedPointerEvent[];
  videoBlob?: Blob;
  videoMimeType?: string;
  stats: RecordingSessionMetadata;
}

export interface CompletedRecordingSession {
  id: string;
  videoBlobUrl?: string;
  videoUrl?: string;
  videoBlob?: Blob;
  metadata: RecordingSessionMetadata;
  summary: RecordingSessionSummary;
  events: RecordedPointerEvent[];
  rawEvents: RecordedPointerEvent[];
  interactionMap: InteractionMap;
  sceneGraph: SceneGraph;
}

export type SynthesizedObservedSession = CompletedRecordingSession;

export interface StreamRecorderCallbacks {
  onStatusChange?: (status: RecordingSessionStatus) => void;
  onTimeUpdate?: (elapsedMs: number, currentFrame: number) => void;
  onEventRecorded?: (event: RecordedPointerEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: (session: CompletedRecordingSession) => void;
}
