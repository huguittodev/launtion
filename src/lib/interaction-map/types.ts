/**
 * types.ts
 * TypeScript type definitions for the Launtion Telemetry InteractionMap contract.
 */

/**
 * Mandatory event provenance identifying the origin of telemetric interaction data.
 * - 'observed': Direct telemetry recorded from actual user/DOM events (e.g. screen recording/DOM events).
 * - 'inferred': Multimodal AI or heuristic detection from video frames/screenshots.
 * - 'simulated': Synthetically generated storyboard/demo interaction sequence.
 */
export type EventProvenance = 'observed' | 'inferred' | 'simulated';

/**
 * Supported interaction event types in the Launtion telemetry pipeline.
 */
export type InteractionEventType = 'click' | 'hover' | 'focus' | 'scroll';

/**
 * Base resolution for the interaction recording session.
 */
export interface BaseResolution {
  width: number;
  height: number;
}

/**
 * An individual interaction event with normalized coordinates and explicit provenance.
 */
export interface InteractionEvent {
  /** Unique identifier for the interaction event */
  id: string;
  /** Categorized event type */
  type: InteractionEventType;
  /** Frame at which the event occurs (0-indexed) */
  frame: number;
  /** Optional duration of the event in frames (e.g., hover hold, scroll duration) */
  duration?: number;
  /** Horizontal coordinate normalized to [0.0, 1.0] relative to base resolution */
  x: number;
  /** Vertical coordinate normalized to [0.0, 1.0] relative to base resolution */
  y: number;
  /** Optional DOM element identifier or semantic selector target */
  targetId?: string;
  /** Mandatory individual provenance tracking */
  provenance: EventProvenance;
  /** Safe extensible metadata for extra telemetry (e.g. scroll delta, target tag) */
  metadata?: Record<string, unknown>;
}

/**
 * Root InteractionMap contract representing recorded or simulated user interaction telemetry.
 */
export interface InteractionMap {
  /** Schema contract version */
  version: '2.0';
  /** Native resolution in which coordinates were recorded */
  baseResolution: BaseResolution;
  /** Frame rate of the interaction capture */
  fps: number;
  /** Total timeline budget in frames */
  durationInFrames: number;
  /** Array of individual interaction events */
  events: InteractionEvent[];
}
