/**
 * types.ts
 * TypeScript type definitions for the Launtion SceneGraph specification.
 */

/**
 * Art direction theme settings for dynamic backdrops and UI surfaces.
 */
export type MotionArchetype =
  | 'base44-studio'
  | 'linear-dark'
  | 'bento-grid'
  | 'kinetic-hook';

export type BackdropVariant = 'dark-precision' | 'light-editorial' | 'aurora-blur' | 'solid';
export type SurfaceTheme = 'light' | 'dark';

export interface ArtDirection {
  backdropVariant: BackdropVariant;
  surfaceTheme: SurfaceTheme;
  primaryAccent: string; // Hex color string (#RGB or #RRGGBB)
  archetype?: MotionArchetype;
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
  | 'ambient-beat'
  | 'transition-whoosh-heavy'
  | 'transition-whoosh-fast'
  | 'sound-riser'
  | 'sub-bass-drop'
  | 'click-switch'
  | 'click-soft'
  | 'mechanical-tap-1'
  | 'mechanical-tap-2'
  | 'mechanical-tap-3'
  | 'mechanical-tap-4'
  | 'pop-clean'
  | 'success-chime';

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
  /** width/height of the embedded recording; lets cursor and camera map onto real pixels. */
  mediaAspect?: number;
  eventsCount?: number;
  cameraRig?: Record<string, unknown>;
  cursor?: Record<string, unknown>;
  textToType?: string;
  promptText?: string;
  buttonText?: string;
  productName?: string;
  tagline?: string;
  title?: string;
  headline?: string;
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

export interface MediaShowcasePayload {
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  headline?: string;
  tagline?: string;
  zoomScale?: number;
  panDirection?: 'none' | 'left' | 'right' | 'up' | 'down';
}

export interface MetricCardItem {
  value: string;
  label: string;
  trend?: string;
  badge?: string;
}

export interface MetricCardsPayload {
  headline?: string;
  subheadline?: string;
  metrics: MetricCardItem[];
}

export interface ChatMessageItem {
  sender: 'user' | 'assistant';
  text: string;
  time?: string;
}

export interface ConversationalMockupPayload {
  headline?: string;
  messages: ChatMessageItem[];
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

export interface MediaShowcaseSceneNode extends BaseSceneNode {
  type: 'media_showcase';
  payload: MediaShowcasePayload;
}

export interface MetricCardsSceneNode extends BaseSceneNode {
  type: 'metric_cards';
  payload: MetricCardsPayload;
}

export interface ConversationalMockupSceneNode extends BaseSceneNode {
  type: 'conversational_mockup';
  payload: ConversationalMockupPayload;
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
  | BrandClosingCtaSceneNode
  | MediaShowcaseSceneNode
  | MetricCardsSceneNode
  | ConversationalMockupSceneNode;

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
