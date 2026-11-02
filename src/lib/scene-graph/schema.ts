/**
 * schema.ts
 * Strict Zod validation schemas for the SceneGraph contract.
 */

import { z } from 'zod';

export const HexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const BackdropVariantSchema = z.enum([
  'dark-precision',
  'light-editorial',
  'aurora-blur',
  'solid',
]);

export const MotionArchetypeSchema = z.enum([
  'base44-studio',
  'linear-dark',
  'bento-grid',
  'kinetic-hook',
]);
export type MotionArchetypeParsed = z.infer<typeof MotionArchetypeSchema>;

export const SurfaceThemeSchema = z.enum(['light', 'dark']);

export const ArtDirectionSchema = z.object({
  backdropVariant: BackdropVariantSchema,
  surfaceTheme: SurfaceThemeSchema,
  primaryAccent: z
    .string()
    .regex(HexColorRegex, { message: 'primaryAccent must be a valid hex color code (#RGB or #RRGGBB)' }),
  archetype: MotionArchetypeSchema.optional(),
});

export const CanvasConfigSchema = z.object({
  width: z.number().int().positive({ message: 'Canvas width must be a positive integer' }),
  height: z.number().int().positive({ message: 'Canvas height must be a positive integer' }),
  fps: z.number().int().positive({ message: 'Canvas fps must be a positive integer' }),
  durationInFrames: z
    .number()
    .int()
    .positive({ message: 'Canvas durationInFrames must be a positive integer' }),
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
  'transition-whoosh-heavy',
  'transition-whoosh-fast',
  'sound-riser',
  'sub-bass-drop',
  'click-switch',
  'click-soft',
  'mechanical-tap-1',
  'mechanical-tap-2',
  'mechanical-tap-3',
  'mechanical-tap-4',
  'pop-clean',
  'success-chime',
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
/* Scene Node Payloads                                                       */
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
  eventsCount: z.number().int().nonnegative().optional(),
  cameraRig: z.record(z.string(), z.unknown()).optional(),
  cursor: z.record(z.string(), z.unknown()).optional(),
  textToType: z.string().max(200).optional(),
  promptText: z.string().max(200).optional(),
  buttonText: z.string().max(30).optional(),
  productName: z.string().max(50).optional(),
  tagline: z.string().max(100).optional(),
  title: z.string().max(50).optional(),
  headline: z.string().max(60).optional(),
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

const baseSceneFields = {
  id: z.string().min(1),
  startFrame: z.number().int().nonnegative(),
  fromFrame: z.number().int().nonnegative().optional(),
  durationInFrames: z.number().int().positive(),
  soundCues: z.array(AudioCueSchema).optional(),
};

export const SceneNodeSchema = z.discriminatedUnion('type', [
  z.object({
    ...baseSceneFields,
    type: z.literal('kinetic_typography'),
    payload: KineticTypographyPayloadSchema,
  }),
  z.object({
    ...baseSceneFields,
    type: z.literal('synthetic_prompt_box'),
    payload: SyntheticPromptBoxPayloadSchema,
  }),
  z.object({
    ...baseSceneFields,
    type: z.literal('product_interaction_3d'),
    payload: ProductInteraction3DPayloadSchema,
  }),
  z.object({
    ...baseSceneFields,
    type: z.literal('icon_grid_morph'),
    payload: IconGridMorphPayloadSchema,
  }),
  z.object({
    ...baseSceneFields,
    type: z.literal('synthetic_hero_button'),
    payload: SyntheticHeroButtonPayloadSchema,
  }),
  z.object({
    ...baseSceneFields,
    type: z.literal('synthetic_connect_pills'),
    payload: SyntheticConnectPillsPayloadSchema,
  }),
  z.object({
    ...baseSceneFields,
    type: z.literal('synthetic_code_tree'),
    payload: SyntheticCodeTreePayloadSchema,
  }),
  z.object({
    ...baseSceneFields,
    type: z.literal('brand_closing_cta'),
    payload: BrandClosingCtaPayloadSchema,
  }),
]);

export const SceneGraphSchema = z
  .object({
    version: z.literal('2.0'),
    canvas: CanvasConfigSchema,
    artDirection: ArtDirectionSchema,
    cameraTrack: z.array(CameraKeyframeSchema),
    cursorTrack: z.array(CursorKeyframeSchema),
    audioTrack: z.array(AudioCueSchema),
    scenes: z.array(SceneNodeSchema),
  })
  .refine(
    (data) => {
      const maxFrame = data.canvas.durationInFrames;
      const camOk = data.cameraTrack.every((kf) => kf.frame <= maxFrame);
      const curOk = data.cursorTrack.every((kf) => kf.frame <= maxFrame);
      const audOk = data.audioTrack.every((cue) => cue.frame <= maxFrame);
      const scnOk = data.scenes.every((sc) => sc.startFrame <= maxFrame);
      return camOk && curOk && audOk && scnOk;
    },
    {
      message: 'All keyframes, audio cues, and scene start frames must be within canvas.durationInFrames',
      path: ['canvas'],
    }
  );

export type BackdropVariantParsed = z.infer<typeof BackdropVariantSchema>;
export type SurfaceThemeParsed = z.infer<typeof SurfaceThemeSchema>;
export type ArtDirectionParsed = z.infer<typeof ArtDirectionSchema>;
export type CanvasConfigParsed = z.infer<typeof CanvasConfigSchema>;
export type CameraKeyframeParsed = z.infer<typeof CameraKeyframeSchema>;
export type CursorKeyframeParsed = z.infer<typeof CursorKeyframeSchema>;
export type AudioAssetParsed = z.infer<typeof AudioAssetSchema>;
export type AudioCueParsed = z.infer<typeof AudioCueSchema>;
export type SceneNodeParsed = z.infer<typeof SceneNodeSchema>;
export type SceneGraphParsed = z.infer<typeof SceneGraphSchema>;
