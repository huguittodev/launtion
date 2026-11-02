/**
 * deterministic-fallback.ts
 *
 * High-performance deterministic algorithmic template synthesizer for Phase 4.
 * Generates a 100% valid SceneGraph (v2.0) across 480 frames (16.0s @ 30 FPS)
 * divided into 5 studio-grade commercial beats, complete with 3D camera keyframes,
 * Bezier cursor track, and frame-accurate SFX audio cues.
 *
 * Pure algorithmic execution (< 3ms) requiring zero external network requests or API keys.
 */

import { HexColorRegex, SceneGraphSchema } from '../scene-graph/schema';
import { DEFAULT_ACCENT } from '../design/tokens';
import type {
  AudioCue,
  BackdropVariant,
  CameraKeyframe,
  CursorKeyframe,
  SceneGraph,
  SceneNode,
  SurfaceTheme,
} from '../scene-graph/types';
import { type ProductBrief, type ProductBriefInput, ProductBriefSchema } from './brief-schema';

/**
 * Synthesizes a broadcast-quality SceneGraph from a validated ProductBrief.
 */
export function generateDeterministicSceneGraph(rawBrief: ProductBrief | ProductBriefInput): SceneGraph {
  const brief = ProductBriefSchema.parse(rawBrief);
  const fps = brief.fps ?? 30;
  const durationInFrames = brief.targetDurationInFrames ?? 480;
  const width = brief.resolution?.width ?? 1920;
  const height = brief.resolution?.height ?? 1080;

  // 1. Resolve Art Direction & Tone
  let backdropVariant: BackdropVariant = 'dark-precision';
  let surfaceTheme: SurfaceTheme = 'dark';

  if (brief.tone === 'editorial-clean' || brief.tone === 'minimal-editorial') {
    backdropVariant = 'light-editorial';
    surfaceTheme = 'light';
  } else if (brief.tone === 'punchy-social' || brief.tone === 'modern-punchy') {
    backdropVariant = 'aurora-blur';
    surfaceTheme = 'dark';
  } else {
    // tech-precision, technical-precision, minimal
    backdropVariant = 'dark-precision';
    surfaceTheme = 'dark';
  }

  // Explicit overrides from brief take precedence
  if (brief.backdropVariant) {
    backdropVariant = brief.backdropVariant;
  }
  if (brief.surfaceTheme) {
    surfaceTheme = brief.surfaceTheme;
  }

  // Accent color resolution with strict regex check
  const candidateAccent = brief.accentColor || brief.primaryColor || DEFAULT_ACCENT;
  const primaryAccent = HexColorRegex.test(candidateAccent) ? candidateAccent : DEFAULT_ACCENT;

  // 2. Synthesize Content Strings
  const productName = brief.productName.trim().slice(0, 50);
  const rawTagline = brief.tagline?.trim() || brief.description.slice(0, 90).trim();
  const tagline = (rawTagline.length > 0 ? rawTagline : 'High-performance cloud motion studio').slice(0, 100);
  const ctaText = (brief.ctaText?.trim() || 'Get Started Free').slice(0, 30);

  const promptText = `Deploy ${productName} with real-time sync and automated telemetry.`.slice(0, 190);

  const featureFiles =
    brief.features && brief.features.length > 0
      ? brief.features.map(
          (f) => `services/${f.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20)}.ts`
        )
      : [
          'services/core.ts',
          'pipeline/ingest.ts',
          'telemetry/metrics.ts',
          'security/guard.ts',
        ];

  // 3. 5-Scene Sequence (F0–F480)
  // Beat 1: Hook (F0–F90)
  // Beat 2: Core Surface (F90–F240)
  // Beat 3: Architecture / Integration (F240–F330)
  // Beat 4: Hero Action (F330–F400)
  // Beat 5: Brand Closing (F400–F480)
  const scenes: SceneNode[] = [
    {
      id: 'scene-1-hook-prompt',
      type: 'synthetic_prompt_box',
      startFrame: 0,
      fromFrame: 0,
      durationInFrames: 90,
      payload: {
        textToType: promptText,
        typingSpeed: 1.5,
        charsPerFrame: 1.2,
        showMicrophone: true,
        submitOnComplete: true,
      },
    },
    {
      id: 'scene-2-product-discovery',
      type: 'product_interaction_3d',
      startFrame: 90,
      fromFrame: 90,
      durationInFrames: 150,
      payload: {
        productName,
        windowTitle: `${productName} Cloud Studio — Dynamic Surface`.slice(0, 80),
        headline: (brief.features?.[0] || `${productName} Core Engine`).slice(0, 60),
        buttonText: ctaText,
        title: (brief.features?.[1] || 'Service Routing & Telemetry').slice(0, 50),
        textToType: promptText,
        tagline,
      },
    },
    {
      id: 'scene-3-integration-tree',
      type: 'synthetic_code_tree',
      startFrame: 240,
      fromFrame: 240,
      durationInFrames: 90,
      payload: {
        title: `${productName} Architecture • Core Engine`.slice(0, 50),
        files: featureFiles,
      },
    },
    {
      id: 'scene-4-hero-cta',
      type: 'synthetic_hero_button',
      startFrame: 330,
      fromFrame: 330,
      durationInFrames: 70,
      payload: {
        buttonText: ctaText,
        variant: 'glow-primary',
        clickFrame: 365,
      },
    },
    {
      id: 'scene-5-brand-closing',
      type: 'brand_closing_cta',
      startFrame: 400,
      fromFrame: 400,
      durationInFrames: 80,
      payload: {
        productName,
        tagline,
        showLogo: true,
        buttonText: ctaText,
      },
    },
  ];

  // 4. Dynamic 3D Camera Track (Zero optical drift)
  const cameraTrack: CameraKeyframe[] = [
    { frame: 0, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 6.0, rotateY: -4.0, rotateZ: 0, easing: 'ease-in-out' },
    { frame: 80, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
    { frame: 120, x: 0.50, y: 0.62, zoom: 2.1, rotateX: 3.0, rotateY: -2.0, rotateZ: 0, easing: 'ease-in-out' },
    { frame: 155, x: 0.72, y: 0.34, zoom: 2.3, rotateX: -2.0, rotateY: 2.0, rotateZ: 0, easing: 'ease-in-out' },
    { frame: 210, x: 0.5, y: 0.5, zoom: 1.05, rotateX: 4.0, rotateY: -3.0, rotateZ: 0, easing: 'ease-in-out' },
    { frame: 240, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
    { frame: 330, x: 0.5, y: 0.5, zoom: 1.15, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
    { frame: 400, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
    { frame: durationInFrames, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
  ];

  // 5. Biomechanical Cursor Track with Bezier Arcs
  const cursorTrack: CursorKeyframe[] = [
    { frame: 0, x: 0.85, y: 0.85 },
    { frame: 65, x: 0.70, y: 0.65, controlX: 0.78, controlY: 0.80, click: true },
    { frame: 110, x: 0.30, y: 0.75 },
    { frame: 150, x: 0.72, y: 0.34, controlX: 0.55, controlY: 0.42, click: true },
    { frame: 200, x: 0.88, y: 0.85, controlX: 0.82, controlY: 0.60 },
    { frame: 365, x: 0.50, y: 0.50, controlX: 0.65, controlY: 0.60, click: true },
    { frame: 420, x: 0.90, y: 0.90 },
    { frame: durationInFrames, x: 0.90, y: 0.90 },
  ];

  // 6. Synchronized Cinematic Audio Track (Iman Gadzhi SaaS high-energy style)
  const audioTrack: AudioCue[] = [
    { id: 'cue-ambient-main', frame: 0, asset: 'ambient-beat', volume: 0.28, fadeInFrames: 15, fadeOutFrames: 45 },
    { id: 'cue-keyboard-tap', frame: 10, asset: 'keyboard-tap', volume: 0.45 },
    { id: 'cue-click-prompt', frame: 65, asset: 'mouse-click', volume: 0.85 },
    { id: 'cue-riser-1', frame: 70, asset: 'sound-riser', volume: 0.65 },
    { id: 'cue-impact-surface', frame: 90, asset: 'sub-bass-drop', volume: 0.82 },
    { id: 'cue-whoosh-surface', frame: 90, asset: 'transition-whoosh-heavy', volume: 0.72 },
    { id: 'cue-click-deploy', frame: 150, asset: 'mouse-click', volume: 0.85 },
    { id: 'cue-chime-deploy', frame: 190, asset: 'chime', volume: 0.75 },
    { id: 'cue-pop-nodes', frame: 250, asset: 'pop-clean', volume: 0.60 },
    { id: 'cue-trans-hero', frame: 328, asset: 'transition-whoosh-heavy', volume: 0.68 },
    { id: 'cue-riser-cta', frame: 340, asset: 'sound-riser', volume: 0.70 },
    { id: 'cue-click-hero', frame: 365, asset: 'mouse-click', volume: 0.88 },
    { id: 'cue-success', frame: 380, asset: 'success-chime', volume: 0.82 },
    { id: 'cue-trans-closing', frame: 398, asset: 'transition-whoosh-heavy', volume: 0.75 },
    { id: 'cue-chime-closing', frame: 420, asset: 'chime', volume: 0.70, fadeOutFrames: 30 },
  ];

  const graph: SceneGraph = {
    version: '2.0',
    canvas: {
      width,
      height,
      fps,
      durationInFrames,
    },
    artDirection: {
      backdropVariant,
      surfaceTheme,
      primaryAccent,
    },
    cameraTrack,
    cursorTrack,
    audioTrack,
    scenes,
  };

  // Strictly enforce SceneGraphSchema validation before returning
  return SceneGraphSchema.parse(graph);
}
