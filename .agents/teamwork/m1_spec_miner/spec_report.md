# Milestone 1: Specification Mining Report
**Author:** m1_spec_miner (Milestone 1 Spec Miner)  
**Date:** 2026-10-31  
**Target Milestone:** Milestone 1 — Contracts, Foundations & SFX Rights  
**Repository Working Directory:** `/home/huguittodev/launtion`  
**Reference Sources:** `PROJECT_SPEC.md`, `AGENTS.md`, `.agents/teamwork/ORIGINAL_REQUEST.md`, `.agents/teamwork/orchestrator/PROJECT.md`, `remotion/motion-kit/*`, `public/sfx/*`

---

## 1. Executive Summary

Milestone 1 establishes the foundational data contracts and architecture for Launtion's deterministic motion design engine. The core architectural invariant is the unidirectional pipeline:
$$\text{InteractionMap} \longrightarrow \text{Interaction-to-SceneGraph Adapter} \longrightarrow \text{SceneGraph} \longrightarrow \text{Motion Kit / Remotion Engine} \longrightarrow \text{MP4 Video}$$

This report presents the complete, verified specification, TypeScript interfaces, Zod schemas, validation rules, edge-case analysis, and implementation strategy for:
1. **`InteractionMap` Contract** (`src/lib/interaction-map/types.ts` & `src/lib/interaction-map/schema.ts`), featuring mandatory individual telemetry provenance (`observed` | `inferred` | `simulated`).
2. **`CoordinateMapper` Engine** (`src/lib/interaction-map/CoordinateMapper.ts`), providing pure mathematical transformations between normalized $[0.0, 1.0]$ space and screen pixel coordinates.
3. **`SceneGraph` Contract** (`src/lib/scene-graph/types.ts` & `src/lib/scene-graph/schema.ts`), containing canvas properties, art direction parameters, multi-track keyframe definitions (CameraTrack, CursorTrack, AudioTrack), and an 8-node discriminated union of scene types.
4. **Adapter Architecture** (`src/lib/scene-graph/adapter.ts`), translating telemetry events into continuous camera, cursor, and audio keyframes with zero manual React wiring.
5. **Runtime Validation & Error Prevention Strategy**, guaranteeing zero schema compilation or runtime render crashes.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | InteractionMap | Base Canvas Properties | Defines base canvas dimensions, frame rate, and total duration for telemetric events | `width: number`, `height: number`, `fps: number`, `durationInFrames: number` | Validated `InteractionMap` header object | Rejects negative/zero dimensions, floats for frames/fps, missing version | `PROJECT.md`, `ORIGINAL_REQUEST.md` R2 |
| 2 | InteractionMap | Normalized Event Coordinates | Defines interaction coordinates $x, y \in [0.0, 1.0]$ independent of recording resolution | $x, y \in [0.0, 1.0]$ | Normalized coordinate pair | Rejects $x < 0$, $x > 1$, $y < 0$, $y > 1$, `NaN`, `Infinity` | `PROJECT_SPEC.md` §11.1, `PROJECT.md` |
| 3 | InteractionMap | Mandatory Individual Provenance | Identifies data origin for every event (`observed`, `inferred`, `simulated`) | `provenance: 'observed' \| 'inferred' \| 'simulated'` | Verified event with tracked origin | Rejects missing provenance or invalid strings ('manual', 'recorded', null) | `ORIGINAL_REQUEST.md` R2, dispatch prompt |
| 4 | InteractionMap | Interaction Event Types | Allowlisted interaction actions: `click`, `hover`, `focus`, `scroll` | `type: 'click' \| 'hover' \| 'focus' \| 'scroll'` | Typed interaction event | Rejects unsupported DOM events (e.g. `drag`, `dblclick`, `keypress`) | `PROJECT.md` §Interface Contracts |
| 5 | InteractionMap | Safe Event Metadata | Extensible metadata bag for element identifiers, tags, and roles | `metadata?: Record<string, unknown>` | Structured metadata record | Rejects non-object primitives or prototype pollution vectors | `PROJECT.md`, `AGENTS.md` Rule 2 |
| 6 | CoordinateMapper | Pixel ↔ Normalized Conversion | Pure functions mapping $[0, 1]$ coordinates to $[0, W] \times [0, H]$ pixel space | $x, y \in [0, 1]$, $W, H > 0$ | Pixel coordinates $\{x: \text{px}, y: \text{px}\}$ | Throws or clamps on non-positive resolution; pure mathematical function | `PROJECT.md` Feature 3, `ORIGINAL_REQUEST.md` R4 |
| 7 | CoordinateMapper | Boundary Clamping | Robust clamping of normalized values to $[0.0, 1.0]$ with $\epsilon$ tolerance | Value `v: number` | Clamped value $\min(1, \max(0, v))$ | Handles out-of-bounds float overshoots gracefully | `PROJECT.md` Feature 9 |
| 8 | SceneGraph | Canvas Configuration | Defines export resolution, frame rate, and frame budget for Remotion | `width`, `height`, `fps`, `durationInFrames` | Validated canvas node | Rejects non-integer frames, zero dimensions, mismatch with Remotion Root | `PROJECT.md` §SceneGraph Contract |
| 9 | SceneGraph | Art Direction Schema | Global visual theme configuration: backdrop variant, surface theme, accent color | `backdropVariant`, `surfaceTheme`, `primaryAccent` | Art direction node | Rejects invalid variants, unapproved themes, non-hex color codes | `PROJECT_SPEC.md` §11.2, `PROJECT.md` |
| 10 | SceneGraph | CameraTrack Keyframes | 3D Camera trajectory with optical centering, zoom [0.8, 3.5], 3D rotations, easing | `frame`, `x`, `y`, `zoom`, `rotateX`, `rotateY`, `rotateZ`, `easing` | CameraKeyframe array | Rejects zoom $<0.8$ or $>3.5$, out-of-bounds coordinates, non-integer frames | `PROJECT_SPEC.md` §11.3, `PROJECT.md` |
| 11 | SceneGraph | CursorTrack Keyframes | 2D vector cursor trajectory with Bezier control points and physical click state | `frame`, `x`, `y`, `controlX`, `controlY`, `click` | CursorKeyframe array | Rejects negative frames, missing coordinates; allows control points outside $[0,1]$ for curved arcs | `PROJECT.md` Feature 13, 14, 15 |
| 12 | SceneGraph | AudioTrack Cues | Frame-accurate audio scheduling with volume staging and fade durations | `id`, `frame`, `asset`, `volume`, `fadeInFrames`, `fadeOutFrames` | AudioCue array | Rejects unknown audio assets outside the 6-WAV allowlist, volume outside $[0,1]$ | `PROJECT.md` Feature 7, `public/sfx/` |
| 13 | SceneGraph | Kinetic Typography Scene | Kinetic text reveal with staggered word entrances, accent index, orbital symbols | `words`, `accentWordIndex`, `symbols`, `staggerFrames` | `KineticTypographySceneNode` | Rejects empty word array, negative accent index $> \text{words.length}$ | `remotion/motion-kit/KineticTypography.tsx` |
| 14 | SceneGraph | Synthetic Prompt Box Scene | Isolated prompt typing UI atom with typewriter animation and action buttons | `textToType`, `charsPerFrame`, `typingSpeed`, `showMicrophone`, `submitOnComplete` | `SyntheticPromptBoxSceneNode` | Rejects empty text or strings exceeding 200 characters | `remotion/motion-kit/SyntheticUI/SyntheticPromptBox.tsx` |
| 15 | SceneGraph | Product Interaction 3D Scene | Interactive surface displaying product recording or realistic mock interface | `assetId`, `windowTitle`, `url`, `mockInterface` | `ProductInteraction3DSceneNode` | Rejects unapproved asset IDs or empty window title | `remotion/motion-kit/RealCaptureSurface.tsx`, `StudioShowcase.tsx` |
| 16 | SceneGraph | Icon Grid Morph Scene | Radial wave transition matrix with center 3D elevation and color morphing | `gridSize` (`rows`, `cols`), `initialColor`, `targetColor`, `headline`, `waveStartFrame` | `IconGridMorphSceneNode` | Rejects non-hex colors, rows $>10$, cols $>15$ | `remotion/motion-kit/IconGridMorph.tsx` |
| 17 | SceneGraph | Synthetic Hero Button Scene | Hero action button with elastic entrance, click compression, and glow pulse | `buttonText`, `variant`, `clickFrame` | `SyntheticHeroButtonSceneNode` | Rejects button text exceeding 30 characters | `remotion/motion-kit/SyntheticUI/SyntheticHeroButton.tsx` |
| 18 | SceneGraph | Synthetic Connect Pills Scene | Flowing service integration pill atom with central link and energy pulse | `sourceText`, `targetText` | `SyntheticConnectPillsSceneNode` | Rejects text exceeding 30 characters | `remotion/motion-kit/SyntheticUI/SyntheticConnectPills.tsx` |
| 19 | SceneGraph | Synthetic Code Tree Scene | Hierarchical code file tree with staggered entrance and syntax styling | `title`, `nodes` (or `files`) | `SyntheticCodeTreeSceneNode` | Rejects title exceeding 50 characters | `remotion/motion-kit/SyntheticUI/SyntheticCodeTree.tsx` |
| 20 | SceneGraph | Brand Closing CTA Scene | Closing branding scene with logo, headline, tagline, and call-to-action button | `productName`, `tagline`, `showLogo`, `buttonText` | `BrandClosingCtaSceneNode` | Rejects productName $>50$ chars, tagline $>100$ chars | `StudioShowcase.tsx` lines 481-540 |
| 21 | Adapter | Interaction-to-SceneGraph Adapter | Deterministic pure function translating InteractionMap telemetry into full SceneGraph | `InteractionMap` | Complete validated `SceneGraph` | Throws validation error if input InteractionMap violates schema | `PROJECT.md` Feature 6, `ORIGINAL_REQUEST.md` R3 |

---

## 3. Edge Cases Matrix

| # | Feature | Input | Observed / Specified Behavior | Safety / Mitigation Rule |
|---|---------|-------|-------------------------------|--------------------------|
| 1 | InteractionEvent Provenance | `provenance: 'manual'` | Zod validation error: `Invalid enum value. Expected 'observed' \| 'inferred' \| 'simulated', received 'manual'` | Rejects input immediately; prevents unvetted data sources |
| 2 | InteractionEvent Provenance | `provenance: undefined` | Zod validation error: `Required` | Fails parse; provenance cannot be omitted or defaulted |
| 3 | InteractionEvent Coordinates | `x: -0.0001` or `x: 1.0001` | Zod validation error: `Number must be greater than or equal to 0` / `less than or equal to 1` | `z.number().min(0).max(1)` strictly enforces normalized domain |
| 4 | InteractionEvent Coordinates | `x: NaN` or `y: Infinity` | Zod validation error: `Expected number, received nan` | `z.number().finite()` prevents non-finite mathematical traps |
| 5 | InteractionEvent Frame | `frame: 14.5` (non-integer) | Zod validation error: `Expected integer, received float` | `z.number().int().nonnegative()` guarantees frame-rate precision |
| 6 | InteractionEvent Frame Timing | `frame: 500` in a 300-frame video | Refinement error: `All event frames must be <= durationInFrames` | `.refine()` validates temporal containment |
| 7 | InteractionMap Events Ordering | Events out of chronological order | Parser accepts valid schema, but adapter sorts events: `events.sort((a, b) => a.frame - b.frame)` | Adapter guarantees monotonically non-decreasing timeline order |
| 8 | InteractionMap Resolution | `width: 0` or `height: -1080` | Zod validation error: `Number must be greater than 0` | `z.number().int().positive()` prevents zero-division |
| 9 | CameraKeyframe Zoom | `zoom: 0.5` (below min) | Zod validation error: `Number must be greater than or equal to 0.8` | `z.number().min(0.8).max(3.5)` prevents excessive zoom-out or UI break |
| 10 | CameraKeyframe Zoom | `zoom: 8.0` (above max) | Zod validation error: `Number must be less than or equal to 3.5` | `z.number().min(0.8).max(3.5)` prevents excessive raster pixelation |
| 11 | CameraKeyframe Rotations | `rotateX: 120` | Zod validation error: `Number must be less than or equal to 90` | Bounds $[-90, 90]$ prevent inverted viewports or extreme shearing |
| 12 | CursorKeyframe Bezier Control | `controlX: -0.3` | Valid parse: `controlX` is allowed outside $[0, 1]$ | Permits natural parabolic Bezier arcs extending beyond bounding box |
| 13 | AudioCue Asset Allowlist | `asset: 'explosion-sound'` | Zod validation error: `Invalid enum value` | Strictly restricted to the 6 verified WAV assets in `public/sfx/` |
| 14 | AudioCue Volume | `volume: 1.5` | Zod validation error: `Number must be less than or equal to 1` | `z.number().min(0).max(1)` prevents polyphonic clipping and distortion |
| 15 | SceneNode Discriminator | `type: 'unknown_scene'` | Zod validation error: `Invalid discriminator value` | Discriminated union ensures only known Motion Kit atoms are accepted |
| 16 | SceneNode Typography Length | `words: []` | Zod validation error: `Array must contain at least 1 element(s)` | `z.array(z.string().min(1)).min(1)` prevents blank typography scenes |
| 17 | SceneNode Prompt Text Length | `textToType: "a".repeat(500)` | Zod validation error: `String must contain at most 200 character(s)` | Prevents prompt box text overflow beyond canvas margins |
| 18 | SceneNode Color Format | `primaryAccent: "red"` or `"rgb(255,0,0)"` | Zod validation error: `Invalid regex` | Enforces standard `#RRGGBB` hex format for deterministic CSS rendering |
| 19 | CoordinateMapper Inversion | `toNormalized(960, 540, 0, 1080)` | Runtime error: `Canvas width must be greater than 0` | Mathematical guard prevents `Infinity` or `NaN` outputs |
| 20 | Concurrent Sound Overlap | Multiple audio cues at exact same frame | Validated by schema, mixer applies headroom attenuation | `AudioMixer` scales polyphonic cues to prevent digital distortion |

---

## 4. InteractionMap Specification

### 4.1 TypeScript Types (`src/lib/interaction-map/types.ts`)

```typescript
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
 * Base resolution for the interaction recording session.
 */
export interface BaseResolution {
  width: number;
  height: number;
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
```

### 4.2 Zod Schema (`src/lib/interaction-map/schema.ts`)

```typescript
import { z } from 'zod';

export const EventProvenanceSchema = z.enum(['observed', 'inferred', 'simulated']);

export const InteractionEventTypeSchema = z.enum(['click', 'hover', 'focus', 'scroll']);

export const BaseResolutionSchema = z.object({
  width: z.number().int().positive({ message: 'Base resolution width must be a positive integer' }),
  height: z.number().int().positive({ message: 'Base resolution height must be a positive integer' }),
});

export const InteractionEventSchema = z.object({
  id: z.string().min(1, { message: 'Event id cannot be empty' }),
  type: InteractionEventTypeSchema,
  frame: z.number().int().nonnegative({ message: 'Frame must be a non-negative integer' }),
  duration: z.number().int().positive({ message: 'Duration must be a positive integer' }).optional(),
  x: z.number().min(0.0).max(1.0, { message: 'Coordinate x must be normalized between 0.0 and 1.0' }),
  y: z.number().min(0.0).max(1.0, { message: 'Coordinate y must be normalized between 0.0 and 1.0' }),
  targetId: z.string().min(1).optional(),
  provenance: EventProvenanceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const InteractionMapSchema = z
  .object({
    version: z.literal('2.0'),
    baseResolution: BaseResolutionSchema,
    fps: z.number().int().positive({ message: 'FPS must be a positive integer' }),
    durationInFrames: z.number().int().positive({ message: 'Duration in frames must be a positive integer' }),
    events: z.array(InteractionEventSchema),
  })
  .refine(
    (data) => data.events.every((evt) => evt.frame <= data.durationInFrames),
    {
      message: 'All interaction events must occur within the durationInFrames limit',
      path: ['events'],
    }
  );

export type InteractionMapParsed = z.infer<typeof InteractionMapSchema>;
export type InteractionEventParsed = z.infer<typeof InteractionEventSchema>;
```

---

## 5. SceneGraph Specification

### 5.1 TypeScript Types (`src/lib/scene-graph/types.ts`)

```typescript
/**
 * Art direction theme settings for dynamic backdrops and UI surfaces.
 */
export type BackdropVariant = 'dark-precision' | 'light-editorial' | 'aurora-blur' | 'solid';
export type SurfaceTheme = 'light' | 'dark';

export interface ArtDirection {
  backdropVariant: BackdropVariant;
  surfaceTheme: SurfaceTheme;
  primaryAccent: string; // Hex color string (e.g. '#FF5C35')
}

/**
 * Canvas dimensions and timeline configuration.
 */
export interface CanvasConfig {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/**
 * Camera track keyframe controlling 3D perspective, zoom, and optical centering.
 */
export interface CameraKeyframe {
  frame: number;
  x: number; // Normalized horizontal focal point [0.0, 1.0]
  y: number; // Normalized vertical focal point [0.0, 1.0]
  zoom: number; // Scale factor bounded between 0.8 and 3.5
  rotateX?: number; // Tilt in degrees [-90, 90]
  rotateY?: number; // Pan in degrees [-90, 90]
  rotateZ?: number; // Roll in degrees [-180, 180]
  easing?: 'linear' | 'ease-in-out' | 'spring';
}

/**
 * Cursor track keyframe controlling vector cursor trajectory and click physics.
 */
export interface CursorKeyframe {
  frame: number;
  x: number; // Normalized coordinate [0.0, 1.0]
  y: number; // Normalized coordinate [0.0, 1.0]
  controlX?: number; // Bezier curvature control point
  controlY?: number; // Bezier curvature control point
  click?: boolean; // Whether click pulse and ripple trigger at this frame
}

/**
 * Allowlisted commercial SFX audio assets.
 */
export type AudioAsset =
  | 'mouse-click'
  | 'camera-whoosh'
  | 'keyboard-tap'
  | 'chime'
  | 'soft-pop'
  | 'ambient-beat';

/**
 * Audio track cue scheduled at a specific frame.
 */
export interface AudioCue {
  id: string;
  frame: number;
  asset: AudioAsset;
  volume?: number; // Normalized gain [0.0, 1.0], default 0.8
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

/* ========================================================================= */
/* Scene Node Payloads (Discriminated Union)                                 */
/* ========================================================================= */

export interface KineticTypographyPayload {
  words: string[];
  accentWordIndex?: number;
  symbols?: string[];
  staggerFrames?: number;
}

export interface SyntheticPromptBoxPayload {
  textToType: string;
  charsPerFrame?: number;
  typingSpeed?: number;
  showMicrophone?: boolean;
  submitOnComplete?: boolean;
}

export interface ProductInteraction3DPayload {
  assetId?: string;
  windowTitle?: string;
  url?: string;
  mockInterface?: string;
}

export interface IconGridMorphPayload {
  rows?: number;
  cols?: number;
  initialColor?: string;
  targetColor?: string;
  headline?: string;
  waveStartFrame?: number;
}

export interface SyntheticHeroButtonPayload {
  buttonText: string;
  variant?: 'glow-primary' | 'outline' | 'minimal';
  clickFrame?: number;
}

export interface SyntheticConnectPillsPayload {
  sourceText: string;
  targetText: string;
}

export interface SyntheticCodeTreePayload {
  title: string;
  files?: string[];
}

export interface BrandClosingCtaPayload {
  productName: string;
  tagline: string;
  showLogo?: boolean;
  buttonText?: string;
}

/* Base Scene Node */
export interface BaseSceneNode {
  id: string;
  startFrame: number;
  durationInFrames: number;
}

export interface KineticTypographySceneNode extends BaseSceneNode {
  type: 'kinetic_typography';
  payload: KineticTypographyPayload;
}

export interface SyntheticPromptBoxSceneNode extends BaseSceneNode {
  type: 'synthetic_prompt_box';
  payload: SyntheticPromptBoxPayload;
}

export interface ProductInteraction3DSceneNode extends BaseSceneNode {
  type: 'product_interaction_3d';
  payload: ProductInteraction3DPayload;
}

export interface IconGridMorphSceneNode extends BaseSceneNode {
  type: 'icon_grid_morph';
  payload: IconGridMorphPayload;
}

export interface SyntheticHeroButtonSceneNode extends BaseSceneNode {
  type: 'synthetic_hero_button';
  payload: SyntheticHeroButtonPayload;
}

export interface SyntheticConnectPillsSceneNode extends BaseSceneNode {
  type: 'synthetic_connect_pills';
  payload: SyntheticConnectPillsPayload;
}

export interface SyntheticCodeTreeSceneNode extends BaseSceneNode {
  type: 'synthetic_code_tree';
  payload: SyntheticCodeTreePayload;
}

export interface BrandClosingCtaSceneNode extends BaseSceneNode {
  type: 'brand_closing_cta';
  payload: BrandClosingCtaPayload;
}

/**
 * Complete discriminated union of scene nodes.
 */
export type SceneNode =
  | KineticTypographySceneNode
  | SyntheticPromptBoxSceneNode
  | ProductInteraction3DSceneNode
  | IconGridMorphSceneNode
  | SyntheticHeroButtonSceneNode
  | SyntheticConnectPillsSceneNode
  | SyntheticCodeTreeSceneNode
  | BrandClosingCtaSceneNode;

/**
 * Root SceneGraph contract driving Remotion composition rendering.
 */
export interface SceneGraph {
  version: '2.0';
  canvas: CanvasConfig;
  artDirection: ArtDirection;
  cameraTrack: CameraKeyframe[];
  cursorTrack: CursorKeyframe[];
  audioTrack: AudioCue[];
  scenes: SceneNode[];
}
```

### 5.2 Zod Schema (`src/lib/scene-graph/schema.ts`)

```typescript
import { z } from 'zod';

const HexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const BackdropVariantSchema = z.enum([
  'dark-precision',
  'light-editorial',
  'aurora-blur',
  'solid',
]);

export const SurfaceThemeSchema = z.enum(['light', 'dark']);

export const ArtDirectionSchema = z.object({
  backdropVariant: BackdropVariantSchema,
  surfaceTheme: SurfaceThemeSchema,
  primaryAccent: z.string().regex(HexColorRegex, { message: 'primaryAccent must be a valid hex color code (#RGB or #RRGGBB)' }),
});

export const CanvasConfigSchema = z.object({
  width: z.number().int().positive({ message: 'Canvas width must be a positive integer' }),
  height: z.number().int().positive({ message: 'Canvas height must be a positive integer' }),
  fps: z.number().int().positive({ message: 'Canvas fps must be a positive integer' }),
  durationInFrames: z.number().int().positive({ message: 'Canvas durationInFrames must be a positive integer' }),
});

export const CameraKeyframeSchema = z.object({
  frame: z.number().int().nonnegative({ message: 'CameraKeyframe frame must be non-negative' }),
  x: z.number().min(0.0).max(1.0, { message: 'Camera focal x must be normalized [0.0, 1.0]' }),
  y: z.number().min(0.0).max(1.0, { message: 'Camera focal y must be normalized [0.0, 1.0]' }),
  zoom: z.number().min(0.8).max(3.5, { message: 'Zoom factor must be between 0.8 and 3.5' }),
  rotateX: z.number().min(-90).max(90).optional(),
  rotateY: z.number().min(-90).max(90).optional(),
  rotateZ: z.number().min(-180).max(180).optional(),
  easing: z.enum(['linear', 'ease-in-out', 'spring']).optional(),
});

export const CursorKeyframeSchema = z.object({
  frame: z.number().int().nonnegative({ message: 'CursorKeyframe frame must be non-negative' }),
  x: z.number().min(0.0).max(1.0, { message: 'Cursor coordinate x must be normalized [0.0, 1.0]' }),
  y: z.number().min(0.0).max(1.0, { message: 'Cursor coordinate y must be normalized [0.0, 1.0]' }),
  controlX: z.number().optional(), // Permitted to extend outside [0, 1] for curved arcs
  controlY: z.number().optional(),
  click: z.boolean().optional(),
});

export const AudioAssetSchema = z.enum([
  'mouse-click',
  'camera-whoosh',
  'keyboard-tap',
  'chime',
  'soft-pop',
  'ambient-beat',
]);

export const AudioCueSchema = z.object({
  id: z.string().min(1, { message: 'AudioCue id cannot be empty' }),
  frame: z.number().int().nonnegative({ message: 'AudioCue frame must be non-negative' }),
  asset: AudioAssetSchema,
  volume: z.number().min(0.0).max(1.0, { message: 'Volume must be between 0.0 and 1.0' }).optional(),
  fadeInFrames: z.number().int().nonnegative().optional(),
  fadeOutFrames: z.number().int().nonnegative().optional(),
});

/* ========================================================================= */
/* Scene Node Schemas (Discriminated by 'type')                              */
/* ========================================================================= */

export const KineticTypographyPayloadSchema = z.object({
  words: z.array(z.string().min(1)).min(1, { message: 'Typography scene requires at least one word' }),
  accentWordIndex: z.number().int().nonnegative().optional(),
  symbols: z.array(z.string()).optional(),
  staggerFrames: z.number().int().positive().optional(),
});

export const SyntheticPromptBoxPayloadSchema = z.object({
  textToType: z.string().min(1).max(200, { message: 'Prompt box text must not exceed 200 characters' }),
  charsPerFrame: z.number().positive().optional(),
  typingSpeed: z.number().positive().optional(),
  showMicrophone: z.boolean().optional(),
  submitOnComplete: z.boolean().optional(),
});

export const ProductInteraction3DPayloadSchema = z.object({
  assetId: z.string().optional(),
  windowTitle: z.string().max(80).optional(),
  url: z.string().optional(),
  mockInterface: z.string().optional(),
});

export const IconGridMorphPayloadSchema = z.object({
  rows: z.number().int().min(1).max(10).optional(),
  cols: z.number().int().min(1).max(15).optional(),
  initialColor: z.string().regex(HexColorRegex).optional(),
  targetColor: z.string().regex(HexColorRegex).optional(),
  headline: z.string().max(60).optional(),
  waveStartFrame: z.number().int().nonnegative().optional(),
});

export const SyntheticHeroButtonPayloadSchema = z.object({
  buttonText: z.string().min(1).max(30, { message: 'Hero button text must not exceed 30 characters' }),
  variant: z.enum(['glow-primary', 'outline', 'minimal']).optional(),
  clickFrame: z.number().int().nonnegative().optional(),
});

export const SyntheticConnectPillsPayloadSchema = z.object({
  sourceText: z.string().min(1).max(30),
  targetText: z.string().min(1).max(30),
});

export const SyntheticCodeTreePayloadSchema = z.object({
  title: z.string().min(1).max(50),
  files: z.array(z.string()).optional(),
});

export const BrandClosingCtaPayloadSchema = z.object({
  productName: z.string().min(1).max(50),
  tagline: z.string().min(1).max(100),
  showLogo: z.boolean().optional(),
  buttonText: z.string().max(30).optional(),
});

const BaseSceneNodeSchema = {
  id: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
};

export const SceneNodeSchema = z.discriminatedUnion('type', [
  z.object({
    ...BaseSceneNodeSchema,
    type: z.literal('kinetic_typography'),
    payload: KineticTypographyPayloadSchema,
  }),
  z.object({
    ...BaseSceneNodeSchema,
    type: z.literal('synthetic_prompt_box'),
    payload: SyntheticPromptBoxPayloadSchema,
  }),
  z.object({
    ...BaseSceneNodeSchema,
    type: z.literal('product_interaction_3d'),
    payload: ProductInteraction3DPayloadSchema,
  }),
  z.object({
    ...BaseSceneNodeSchema,
    type: z.literal('icon_grid_morph'),
    payload: IconGridMorphPayloadSchema,
  }),
  z.object({
    ...BaseSceneNodeSchema,
    type: z.literal('synthetic_hero_button'),
    payload: SyntheticHeroButtonPayloadSchema,
  }),
  z.object({
    ...BaseSceneNodeSchema,
    type: z.literal('synthetic_connect_pills'),
    payload: SyntheticConnectPillsPayloadSchema,
  }),
  z.object({
    ...BaseSceneNodeSchema,
    type: z.literal('synthetic_code_tree'),
    payload: SyntheticCodeTreePayloadSchema,
  }),
  z.object({
    ...BaseSceneNodeSchema,
    type: z.literal('brand_closing_cta'),
    payload: BrandClosingCtaPayloadSchema,
  }),
]);

export const SceneGraphSchema = z.object({
  version: z.literal('2.0'),
  canvas: CanvasConfigSchema,
  artDirection: ArtDirectionSchema,
  cameraTrack: z.array(CameraKeyframeSchema),
  cursorTrack: z.array(CursorKeyframeSchema),
  audioTrack: z.array(AudioCueSchema),
  scenes: z.array(SceneNodeSchema),
});

export type SceneGraphParsed = z.infer<typeof SceneGraphSchema>;
```

---

## 6. CoordinateMapper Architecture (`src/lib/interaction-map/CoordinateMapper.ts`)

`CoordinateMapper` provides deterministic coordinate space transformations:
- **Forward transformation** (normalized to pixels):
  $$P_{\text{pixel}} = (x \cdot W, \, y \cdot H)$$
- **Inverse transformation** (pixels to normalized):
  $$P_{\text{norm}} = \left(\frac{x_{\text{pixel}}}{W}, \, \frac{y_{\text{pixel}}}{H}\right)$$
- **Clamping**:
  $$\text{clamp}_{01}(v) = \min(1.0, \max(0.0, v))$$

### Implementation Interface

```typescript
export interface Point2D {
  x: number;
  y: number;
}

export interface Dimensions2D {
  width: number;
  height: number;
}

export class CoordinateMapper {
  /**
   * Converts a normalized point [0.0, 1.0] to pixel coordinates.
   */
  public static toPixels(normPoint: Point2D, dimensions: Dimensions2D): Point2D {
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error(`Dimensions must be positive. Received width=${dimensions.width}, height=${dimensions.height}`);
    }
    return {
      x: normPoint.x * dimensions.width,
      y: normPoint.y * dimensions.height,
    };
  }

  /**
   * Converts pixel coordinates to a normalized point [0.0, 1.0].
   */
  public static toNormalized(pixelPoint: Point2D, dimensions: Dimensions2D): Point2D {
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error(`Dimensions must be positive. Received width=${dimensions.width}, height=${dimensions.height}`);
    }
    return {
      x: pixelPoint.x / dimensions.width,
      y: pixelPoint.y / dimensions.height,
    };
  }

  /**
   * Clamps a number strictly into [0.0, 1.0].
   */
  public static clamp01(val: number): number {
    if (Number.isNaN(val)) return 0;
    return Math.max(0, Math.min(1, val));
  }
}
```

---

## 7. Interaction-to-SceneGraph Adapter Architecture

### 7.1 Pipeline Contract
`src/lib/scene-graph/adapter.ts`:
```typescript
import { InteractionMap } from '../interaction-map/types';
import { SceneGraph } from './types';

export function interactionToSceneGraphAdapter(interactionMap: InteractionMap): SceneGraph;
```

### 7.2 Transformation Logic
1. **Canvas Mapping:** Matches canvas resolution, FPS, and duration directly from `interactionMap.baseResolution`, `fps`, and `durationInFrames`.
2. **Camera Track Synthesis:**
   - Starts at frame 0 with an overview keyframe $(x=0.5, y=0.5, \text{zoom}=1.0, \text{rotateX}=8, \text{rotateY}=-6)$.
   - For every `focus` event in `interactionMap.events`:
     - Inserts a transition keyframe moving to $(event.x, event.y)$ with $\text{zoom}=2.2$ and `easing='spring'`.
     - After the focus duration expires, gently pulls back or transitions to the next interaction point.
3. **Cursor Track Synthesis:**
   - Interpolates smooth Bezier trajectories between consecutive `hover` and `click` events.
   - For every `click` event:
     - Sets `click: true` on the exact target frame $(event.x, event.y)$.
     - Generates Bezier control point $(controlX, controlY)$ based on displacement vector to create a natural curved arc rather than a robotic straight line.
4. **Audio Track Synthesis:**
   - Frame 0: schedules `ambient-beat` with volume 0.32, `fadeInFrames=15`, `fadeOutFrames=30`.
   - On camera movements: schedules `camera-whoosh` (volume 0.7).
   - On every `click` event: schedules `mouse-click` at the exact click frame (volume 0.95).
   - On focus/completion: schedules `chime` or `soft-pop`.
5. **Scene Sequence Assembly:**
   - Constructs the scene nodes (`kinetic_typography` $\to$ `synthetic_prompt_box` $\to$ `product_interaction_3d` $\to$ `icon_grid_morph` $\to$ `synthetic_hero_button` $\to$ `brand_closing_cta`), ensuring the `product_interaction_3d` scene spans the exact frames where user interaction events occur.

---

## 8. Implementation Strategy for Zero Runtime Failures

To guarantee strict type safety and zero runtime crashes:

1. **Strict Two-Tier Validation:**
   - Tier 1: Zod schema parsing on ingestion (`safeParse`). If validation fails, provide detailed, actionable error formatting.
   - Tier 2: Static TypeScript compilation with strict flags (`noImplicitAny: true`, `strictNullChecks: true`, `exactOptionalPropertyTypes: false`).
2. **Deterministic Fallbacks:**
   - For non-critical optional fields (e.g. `easing`, `rotateX`, `volume`), specify explicit fallback defaults in the adapter and Remotion components.
3. **Audio Headroom Protection:**
   - Validate that volume cues are bounded $[0.0, 1.0]$. The AudioMixer will clamp and soft-limit overlapping polyphony to prevent clipping.
4. **Frame Bounds Enforcement:**
   - Zod `.refine()` ensures no keyframe or audio cue has `frame > durationInFrames`.
5. **No Executable Code:**
   - Complying with `AGENTS.md` Hard Rule 3: The SceneGraph JSON is purely declarative data; never parse strings as executable JavaScript.
