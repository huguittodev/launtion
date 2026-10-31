/**
 * types.ts
 * TypeScript type definitions for the Launtion SceneGraph specification.
 */

/**
 * Art direction theme settings for dynamic backdrops and UI surfaces.
 */
export type BackdropVariant = 'dark-precision' | 'light-editorial' | 'aurora-blur' | 'solid';
export type SurfaceTheme = 'light' | 'dark';

export interface ArtDirection {
  backdropVariant: BackdropVariant;
  surfaceTheme: SurfaceTheme;
  primaryAccent: string; // Hex color string (#RGB or #RRGGBB)
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
  click?: boolean; // Whether click pulse triggers at this frame
}

/**
 * Allowlisted commercial SFX audio assets in public/sfx/.
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
  eventsCount?: number;
  cameraRig?: Record<string, unknown>;
  cursor?: Record<string, unknown>;
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
  fromFrame?: number;
  durationInFrames: number;
  soundCues?: AudioCue[];
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
 * Discriminated union of all supported scene types.
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
