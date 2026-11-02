/**
 * gemini-adapter.ts
 *
 * Server-side REST API adapter for Google Gemini 2.5 Flash.
 * Uses native fetch with AbortSignal.timeout(12000).
 * Implements strict Structured Outputs system instructions, defensive response sanitization,
 * Zod validation via SceneGraphSchema, and seamless deterministic fallback.
 *
 * ZERO external AI libraries installed — purely standard web standards.
 */

import { fetchWithRetry } from './fetch-retry';
import { HexColorRegex, SceneGraphSchema } from '../scene-graph/schema';
import type {
  AudioAsset,
  BackdropVariant,
  CameraKeyframe,
  CursorKeyframe,
  SceneGraph,
  SurfaceTheme,
} from '../scene-graph/types';
import { type ProductBrief, type ProductBriefInput, ProductBriefSchema } from './brief-schema';
import { generateDeterministicSceneGraph } from './deterministic-fallback';
import { DEFAULT_ACCENT } from '../design/tokens';

export const CREATIVE_DIRECTOR_SYSTEM_PROMPT = `You are the Executive Creative Director of Vidiaura, an automated video motion graphics studio.
Your task is to transform a SaaS Product Brief into a 100% valid, broadcast-quality, UNIQUE and PROCEDURAL SceneGraph JSON (v2.0) for Remotion.

### INVIOLABLE RULES:
1. OUTPUT JSON ONLY. No markdown code fences, no explanations, no HTML/JS code.
2. Structure must match the SceneGraph v2.0 schema:
{
  "version": "2.0",
  "canvas": { "width": 1920, "height": 1080, "fps": 30, "durationInFrames": 480 },
  "artDirection": {
    "backdropVariant": "dark-precision" | "light-editorial" | "aurora-blur" | "solid",
    "surfaceTheme": "dark" | "light",
    "primaryAccent": "${DEFAULT_ACCENT}",
    "archetype": "base44-studio" | "linear-dark" | "bento-grid" | "kinetic-hook"
  },
  "cameraTrack": [
    // Array of keyframes matching YOUR chosen scene transitions and focal points:
    // { "frame": number, "x": number (0-1), "y": number (0-1), "zoom": number (0.8-3.0), "rotateX": number, "rotateY": number, "rotateZ": number, "easing": "ease-in-out" }
  ],
  "cursorTrack": [
    // Array of keyframes matching YOUR interactive scenes (park at 0.95, 0.95 during non-interactive scenes):
    // { "frame": number, "x": number (0-1), "y": number (0-1), "controlX"?: number, "controlY"?: number, "click"?: boolean }
  ],
  "audioTrack": [
    // Array of synchronized audio cues matching YOUR scenes and beats:
    // { "id": string, "frame": number, "asset": AudioAsset, "volume": number (0-1), "fadeInFrames"?: number, "fadeOutFrames"?: number }
  ],
  "scenes": [
    // 3 to 5 sequential scenes spanning exactly 0 to 480 frames with no gaps.
  ]
}

3. PROCEDURAL SCENE COMPOSITION (Choose 3 to 5 scenes that best tell the product's story):
    - "kinetic_typography": High-energy kinetic hook with punchy words (words: string[], accentWordIndex: number, staggerFrames: number). Best for scene 1 (frame 0 to ~80-100).
    - "metric_cards": 3 KPI performance/growth cards with trends (headline, subheadline, metrics: array of {value, label, trend}). Perfect for analytics, ROI, conversion, or finance.
    - "saas_feature_grid": 2x2 or 3-column feature grid with emojis (headline, features: array of {icon, name, description}). Perfect for all-in-one platforms, tool suites, or productivity apps.
    - "conversational_mockup": Realistic chat bubbles mockup (headline, messages: array of {sender: 'user'|'assistant', text, time}). Perfect for AI assistants, WhatsApp/support automation, bots, or booking apps.
    - "media_showcase": Cinematic screenshot zoom & pan (headline, tagline, zoomScale: 1.1-1.8, panDirection: 'none'|'left'|'right'|'up'|'down'). Perfect for visual SaaS dashboards.
    - "synthetic_prompt_box": AI prompt bar with typing simulation (textToType, typingSpeed).
    - "synthetic_hero_button": Glowing action button with click event (buttonText, clickFrame, variant). Place right before the closing scene.
    - "brand_closing_cta": Final logo, punchline & CTA (productName, tagline, showLogo: true, buttonText). ALWAYS use as the final scene (e.g. frame ~340-480).

4. PROCEDURAL CAMERA DIRECTION RULES (Vary camera dynamically to fit YOUR chosen scenes!):
    - DO NOT use the same camera coordinates for every video! Direct the camera like a real cinematic director.
    - For Scene 1 (Kinetic Hook): Start centered (x: 0.5, y: 0.5) with slow drift or slight 3D angle (zoom: 1.0 to 1.05, rotateX: 3 to 8, rotateY: -4 to 4).
    - For Scene Transitions: Return to zoom 1.0 at scene boundaries (e.g. at the exact startFrame of each scene).
    - For Metric Cards / Feature Grid: Execute a subtle, elegant push-in (zoom: 1.08 to 1.20) or slight pan toward top-left or top-right.
    - For Conversational Mockup: Steady focal hold centered at (x: 0.5, y: 0.52, zoom: 1.05 to 1.15).
    - For Hero Button: Punchy zoom-in focusing directly on the button center (x: 0.50, y: 0.50, zoom: 1.15 to 1.35) during its clickFrame!
    - For Brand Closing: Heroic wide lock at (x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0, rotateY: 0).
    - Always include keyframe at frame 0 and frame 480.

5. PROCEDURAL AUDIO DESIGN RULES (Iman Gadzhi / High-Energy SaaS Style):
    - DO NOT hardcode fixed frame numbers for audio! Place cues dynamically to match the exact startFrame and key events of YOUR scenes.
    - Background Bed: ALWAYS start "ambient-beat" at frame 0 (volume: 0.25 to 0.35, fadeInFrames: 15, fadeOutFrames: 45).
    - Scene Cuts: Place "transition-whoosh-heavy" (for major scene changes) or "transition-whoosh-fast" (for rapid changes) at the boundary (startFrame) of each scene!
    - First Major Reveal: Place "sub-bass-drop" (volume: 0.80 to 0.90) at the start of Scene 2 to give massive cinematic weight to the value proposition.
    - Card/Tile Entrances: Place "pop-clean" or "soft-pop" (volume: 0.55-0.65) where cards or items animate in (e.g. startFrame + 15, + 30).
    - Tension Buildup: Place "sound-riser" (volume: 0.65 to 0.75) 20-30 frames BEFORE the hero button click!
    - Button Click: Place "click-switch" or "mouse-click" (volume: 0.85 to 0.95) at the EXACT clickFrame of the button.
    - Payoff: Place "success-chime" (volume: 0.80) 10-15 frames AFTER the button click.
    - Final Scene: Place "chime" (volume: 0.70) during brand_closing_cta.

6. CURSOR INTERACTION RULES:
    - Park the cursor at (0.95, 0.95) with NO clicks during non-interactive scenes (kinetic_typography, metric_cards, saas_feature_grid, conversational_mockup, media_showcase, brand_closing_cta).
    - ONLY move and click the cursor during interactive scenes (synthetic_hero_button, synthetic_prompt_box).
    - Move cursor from (0.95, 0.95) to (0.50, 0.50) 15-20 frames before clickFrame, set click: true at clickFrame, and retreat to (0.95, 0.95).

7. Allowed audio assets:
    "ambient-beat", "sound-riser", "sub-bass-drop", "transition-whoosh-heavy", "transition-whoosh-fast",
    "camera-whoosh", "click-switch", "click-soft", "mouse-click", "keyboard-tap", "mechanical-tap-1",
    "mechanical-tap-2", "mechanical-tap-3", "mechanical-tap-4", "pop-clean", "soft-pop", "success-chime", "chime".

8. Allowed backdrop variants: "dark-precision", "light-editorial", "aurora-blur", "solid".
9. Allowed surface themes: "light", "dark".
10. Primary accent must be a valid hex color code (e.g. "${DEFAULT_ACCENT}").
11. String limits:
    - prompt textToType <= 200 chars
    - buttonText <= 30 chars
    - productName <= 50 chars
    - tagline <= 100 chars
    - headline <= 60 chars
    - title <= 50 chars
12. All keyframes, cues, and scene start frames MUST be <= 480.
13. TAILOR EVERYTHING TO THE SPECIFIC SAAS PRODUCT: Choose scenes, headlines, copy, camera motion, and audio pacing uniquely for each product!`;

/**
 * Builds the user prompt describing the SaaS product brief.
 */
export function buildCreativeDirectorUserPrompt(brief: ProductBrief): string {
  return JSON.stringify({
    task: 'Generate SceneGraph v2.0 for SaaS video',
    productName: brief.productName,
    description: brief.description,
    tagline: brief.tagline ?? null,
    targetAudience: brief.targetAudience ?? 'Modern Software Teams',
    goal: brief.goal ?? 'launch',
    tone: brief.tone ?? 'tech-precision',
    primaryColor: brief.primaryColor || brief.accentColor || DEFAULT_ACCENT,
    features: brief.features ?? [],
    ctaText: brief.ctaText ?? 'Get Started Free',
    durationInFrames: 480,
    fps: 30,
  });
}

/**
 * Cleans markdown formatting, code fences, or surrounding text from model output.
 */
export function cleanModelJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

const ALLOWED_AUDIO_ASSETS: readonly AudioAsset[] = [
  'ambient-beat',
  'mouse-click',
  'camera-whoosh',
  'keyboard-tap',
  'soft-pop',
  'chime',
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
];

const ALLOWED_BACKDROPS: readonly BackdropVariant[] = [
  'dark-precision',
  'light-editorial',
  'aurora-blur',
  'solid',
];

const ALLOWED_SURFACES: readonly SurfaceTheme[] = ['light', 'dark'];

/**
 * Sanitizes loose LLM structures before Zod validation.
 * Normalizes common minor model hallucination defects.
 */
export function sanitizeAiSceneGraph(raw: unknown, brief: ProductBrief): unknown {
  if (!raw || typeof raw !== 'object') {
    return raw;
  }

  const candidate = { ...(raw as Record<string, unknown>) };

  // 1. Force version 2.0
  candidate.version = '2.0';

  // 2. Canvas
  const duration = typeof brief.targetDurationInFrames === 'number' ? brief.targetDurationInFrames : 480;
  const fps = typeof brief.fps === 'number' ? brief.fps : 30;
  const width = brief.resolution?.width ?? 1920;
  const height = brief.resolution?.height ?? 1080;

  if (candidate.canvas && typeof candidate.canvas === 'object') {
    candidate.canvas = {
      width,
      height,
      fps,
      durationInFrames: duration,
    };
  }

  // 3. Art Direction
  const rawArt = (candidate.artDirection as Record<string, unknown>) || (candidate.theme as Record<string, unknown>) || {};
  let backdropVariant = rawArt.backdropVariant as BackdropVariant;
  if (!ALLOWED_BACKDROPS.includes(backdropVariant)) {
    backdropVariant = 'dark-precision';
  }

  let surfaceTheme = rawArt.surfaceTheme as SurfaceTheme;
  if (!ALLOWED_SURFACES.includes(surfaceTheme)) {
    surfaceTheme = 'dark';
  }

  let primaryAccent = String(rawArt.primaryAccent || brief.accentColor || brief.primaryColor || DEFAULT_ACCENT);
  if (!HexColorRegex.test(primaryAccent)) {
    primaryAccent = DEFAULT_ACCENT;
  }

  const archetype = typeof rawArt.archetype === 'string' ? rawArt.archetype : 'base44-studio';

  candidate.artDirection = {
    backdropVariant,
    surfaceTheme,
    primaryAccent,
    archetype,
  };

  // 4. Camera Track
  if (Array.isArray(candidate.cameraTrack) && candidate.cameraTrack.length > 0) {
    candidate.cameraTrack = candidate.cameraTrack.map((kf: Record<string, unknown>, i: number): CameraKeyframe => {
      const rawFrame = typeof kf.frame === 'number' ? kf.frame : i * 60;
      const frame = Math.max(0, Math.min(duration, Math.round(rawFrame)));

      const rawX = typeof kf.x === 'number' ? kf.x : 0.5;
      const x = Math.max(0, Math.min(1, rawX));

      const rawY = typeof kf.y === 'number' ? kf.y : 0.5;
      const y = Math.max(0, Math.min(1, rawY));

      const rawZoom = typeof kf.zoom === 'number' ? kf.zoom : 1.0;
      const zoom = Math.max(0.8, Math.min(3.5, rawZoom));

      const item: CameraKeyframe = {
        frame,
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
        zoom: Number(zoom.toFixed(2)),
      };

      if (typeof kf.rotateX === 'number') {
        item.rotateX = Math.max(-90, Math.min(90, kf.rotateX));
      }
      if (typeof kf.rotateY === 'number') {
        item.rotateY = Math.max(-90, Math.min(90, kf.rotateY));
      }
      if (typeof kf.rotateZ === 'number') {
        item.rotateZ = Math.max(-180, Math.min(180, kf.rotateZ));
      }
      if (kf.easing === 'linear' || kf.easing === 'ease-in-out' || kf.easing === 'spring') {
        item.easing = kf.easing;
      }
      return item;
    });
  } else {
    // Synthesize standard 3D camera keyframes if missing
    candidate.cameraTrack = [
      { frame: 0, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 6.0, rotateY: -4.0, rotateZ: 0, easing: 'ease-in-out' },
      { frame: 80, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
      { frame: 120, x: 0.50, y: 0.62, zoom: 2.1, rotateX: 3.0, rotateY: -2.0, rotateZ: 0, easing: 'ease-in-out' },
      { frame: 155, x: 0.72, y: 0.34, zoom: 2.3, rotateX: -2.0, rotateY: 2.0, rotateZ: 0, easing: 'ease-in-out' },
      { frame: 210, x: 0.5, y: 0.5, zoom: 1.05, rotateX: 4.0, rotateY: -3.0, rotateZ: 0, easing: 'ease-in-out' },
      { frame: 240, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
      { frame: 330, x: 0.5, y: 0.5, zoom: 1.15, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
      { frame: 400, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
      { frame: duration, x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0.0, rotateY: 0.0, rotateZ: 0, easing: 'ease-in-out' },
    ];
  }

  // 5. Cursor Track
  if (Array.isArray(candidate.cursorTrack) && candidate.cursorTrack.length > 0) {
    candidate.cursorTrack = candidate.cursorTrack.map((ck: Record<string, unknown>, i: number): CursorKeyframe => {
      const rawFrame = typeof ck.frame === 'number' ? ck.frame : i * 60;
      const frame = Math.max(0, Math.min(duration, Math.round(rawFrame)));

      const rawX = typeof ck.x === 'number' ? ck.x : 0.5;
      const x = Math.max(0, Math.min(1, rawX));

      const rawY = typeof ck.y === 'number' ? ck.y : 0.5;
      const y = Math.max(0, Math.min(1, rawY));

      const item: CursorKeyframe = {
        frame,
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
      };

      if (typeof ck.controlX === 'number') item.controlX = ck.controlX;
      if (typeof ck.controlY === 'number') item.controlY = ck.controlY;
      if (typeof ck.click === 'boolean') item.click = ck.click;

      return item;
    });
  } else {
    // Missing cursorTrack: synthesize scene-aware track based on candidate.scenes
    const INTERACTIVE_TYPES = new Set([
      'synthetic_hero_button',
      'synthetic_prompt_box',
      'synthetic_connect_pills',
      'product_interaction_3d',
    ]);
    const rawScenes = Array.isArray(candidate.scenes) ? (candidate.scenes as Record<string, unknown>[]) : [];
    const interactiveScenes = rawScenes.filter((s) => INTERACTIVE_TYPES.has(String(s.type)));

    if (interactiveScenes.length === 0) {
      candidate.cursorTrack = [
        { frame: 0, x: 0.95, y: 0.95 },
        { frame: duration, x: 0.95, y: 0.95 },
      ];
    } else {
      const kfs: CursorKeyframe[] = [{ frame: 0, x: 0.95, y: 0.95 }];
      for (const sc of interactiveScenes) {
        const sStart = typeof sc.startFrame === 'number' ? sc.startFrame : 0;
        const sDur = typeof sc.durationInFrames === 'number' ? sc.durationInFrames : 90;
        const payload = (sc.payload as Record<string, unknown>) || {};

        let targetX = 0.50;
        let targetY = 0.50;
        let clickFrame = sStart + Math.min(40, Math.floor(sDur / 2));

        if (sc.type === 'synthetic_hero_button') {
          targetX = 0.50;
          targetY = 0.50;
          if (typeof payload.clickFrame === 'number') {
            clickFrame = Math.max(sStart, Math.min(sStart + sDur - 5, payload.clickFrame));
          }
        } else if (sc.type === 'synthetic_prompt_box') {
          targetX = 0.50;
          targetY = 0.55;
          clickFrame = sStart + 25;
        }

        const moveStart = Math.max(0, clickFrame - 20);
        const retreatEnd = Math.min(duration, clickFrame + 25);

        kfs.push({ frame: moveStart, x: 0.95, y: 0.95 });
        kfs.push({
          frame: clickFrame,
          x: targetX,
          y: targetY,
          controlX: 0.72,
          controlY: 0.75,
          click: true,
        });
        kfs.push({ frame: retreatEnd, x: 0.95, y: 0.95 });
      }
      kfs.push({ frame: duration, x: 0.95, y: 0.95 });
      candidate.cursorTrack = kfs.sort((a, b) => a.frame - b.frame);
    }
  }

  // 6. Audio Track (Support top-level audioTrack or nested audio.cues / audio.tracks)
  const rawAudioTrack = Array.isArray(candidate.audioTrack)
    ? candidate.audioTrack
    : (candidate.audio as Record<string, unknown>)?.cues && Array.isArray((candidate.audio as Record<string, unknown>).cues)
      ? ((candidate.audio as Record<string, unknown>).cues as unknown[])
      : (candidate.audio as Record<string, unknown>)?.tracks && Array.isArray((candidate.audio as Record<string, unknown>).tracks)
        ? ((candidate.audio as Record<string, unknown>).tracks as unknown[])
        : null;

  if (Array.isArray(rawAudioTrack) && rawAudioTrack.length > 0) {
    candidate.audioTrack = rawAudioTrack
      .map((cueRaw: unknown, idx: number) => {
        const cue = (cueRaw as Record<string, unknown>) || {};
        const rawFrame = typeof cue.frame === 'number' ? cue.frame : typeof cue.startFrame === 'number' ? cue.startFrame : 0;
        const frame = Math.max(0, Math.min(duration, Math.round(rawFrame)));

        let asset = cue.asset as AudioAsset;
        if (!ALLOWED_AUDIO_ASSETS.includes(asset)) {
          asset = 'soft-pop';
        }

        const id = typeof cue.id === 'string' && cue.id.trim().length > 0 ? cue.id : `cue-${idx}`;
        const rawVol = typeof cue.volume === 'number' ? cue.volume : 0.8;
        const volume = Math.max(0, Math.min(1, rawVol));

        return {
          id,
          frame,
          asset,
          volume,
          fadeInFrames: typeof cue.fadeInFrames === 'number' ? Math.max(0, cue.fadeInFrames) : undefined,
          fadeOutFrames: typeof cue.fadeOutFrames === 'number' ? Math.max(0, cue.fadeOutFrames) : undefined,
        };
      })
      .filter(Boolean);
  } else {
    // Default synchronized cinematic audio track (Iman Gadzhi SaaS high-energy style)
    candidate.audioTrack = [
      { id: 'cue-ambient-main', frame: 0, asset: 'ambient-beat', volume: 0.28, fadeInFrames: 15, fadeOutFrames: 45 },
      { id: 'cue-riser-1', frame: 55, asset: 'sound-riser', volume: 0.65 },
      { id: 'cue-impact-1', frame: 88, asset: 'sub-bass-drop', volume: 0.82 },
      { id: 'cue-trans-1', frame: 88, asset: 'transition-whoosh-heavy', volume: 0.72 },
      { id: 'cue-pop-1', frame: 110, asset: 'pop-clean', volume: 0.65 },
      { id: 'cue-pop-2', frame: 128, asset: 'pop-clean', volume: 0.62 },
      { id: 'cue-pop-3', frame: 146, asset: 'pop-clean', volume: 0.60 },
      { id: 'cue-trans-2', frame: 238, asset: 'transition-whoosh-heavy', volume: 0.68 },
      { id: 'cue-riser-cta', frame: 250, asset: 'sound-riser', volume: 0.70 },
      { id: 'cue-click-hero', frame: 280, asset: 'click-switch', volume: 0.88 },
      { id: 'cue-success', frame: 295, asset: 'success-chime', volume: 0.82 },
      { id: 'cue-trans-closing', frame: 338, asset: 'transition-whoosh-heavy', volume: 0.75 },
      { id: 'cue-chime-end', frame: 410, asset: 'chime', volume: 0.70, fadeOutFrames: 30 },
    ];
  }

  // 7. Scenes
  if (Array.isArray(candidate.scenes) && candidate.scenes.length > 0) {
    candidate.scenes = candidate.scenes.map((sc: Record<string, unknown>, idx: number) => {
      const id = typeof sc.id === 'string' && sc.id.trim().length > 0 ? sc.id : `scene-${idx + 1}`;
      const rawStart = typeof sc.startFrame === 'number' ? sc.startFrame : idx * 90;
      const startFrame = Math.max(0, Math.min(duration, Math.round(rawStart)));
      const rawDur = typeof sc.durationInFrames === 'number' ? sc.durationInFrames : 90;
      const durationInFrames = Math.max(1, Math.min(duration - startFrame, rawDur));

      // Map props/content/data -> payload if payload is missing or empty
      const rawPayload =
        (sc.payload as Record<string, unknown>) ||
        (sc.props as Record<string, unknown>) ||
        (sc.properties as Record<string, unknown>) ||
        (sc.content as Record<string, unknown>) ||
        (sc.data as Record<string, unknown>) ||
        {};
      const payload: Record<string, unknown> = { ...rawPayload };

      // Fallback for fields placed directly on sc node instead of inside payload
      const rootPayloadKeys = ['messages', 'metrics', 'features', 'words', 'headline', 'buttonText', 'tagline', 'productName', 'textToType', 'title'];
      for (const key of rootPayloadKeys) {
        if (payload[key] === undefined && sc[key] !== undefined) {
          payload[key] = sc[key];
        }
      }

      // Ensure string limits
      if (typeof payload.textToType === 'string') payload.textToType = payload.textToType.slice(0, 200);
      if (typeof payload.buttonText === 'string') payload.buttonText = payload.buttonText.slice(0, 30);
      if (typeof payload.productName === 'string') payload.productName = payload.productName.slice(0, 50);
      if (typeof payload.tagline === 'string') payload.tagline = payload.tagline.slice(0, 100);
      if (typeof payload.headline === 'string') payload.headline = payload.headline.slice(0, 80);
      if (typeof payload.title === 'string') payload.title = payload.title.slice(0, 50);

      // Supply required fields based on scene type if missing
      const type = typeof sc.type === 'string' ? sc.type : 'product_interaction_3d';
      if (type === 'synthetic_prompt_box' && !payload.textToType) {
        payload.textToType = `Deploy ${brief.productName} in seconds.`;
      }
      if (type === 'product_interaction_3d') {
        if (!payload.productName) payload.productName = brief.productName.slice(0, 50);
        if (!payload.headline) payload.headline = (brief.features?.[0] || 'Core Workflow').slice(0, 60);
        if (!payload.buttonText) payload.buttonText = (brief.ctaText || 'Get Started').slice(0, 30);
      }
      if (type === 'kinetic_typography') {
        if (typeof payload.words === 'string') {
          payload.words = (payload.words as string).trim().split(/\s+/).filter(Boolean);
        } else if (!Array.isArray(payload.words) || (payload.words as unknown[]).length === 0) {
          const rawText = (typeof payload.text === 'string' ? payload.text : '') ||
                          (typeof payload.headline === 'string' ? payload.headline : '') ||
                          (brief.tagline || brief.productName);
          const splitWords = rawText.trim().split(/\s+/).filter(Boolean);
          payload.words = splitWords.length > 0 ? splitWords : ['NEXT-GEN', brief.productName.toUpperCase(), 'LIVE'];
        }
      }
      if (type === 'synthetic_hero_button') {
        if (!payload.buttonText) {
          payload.buttonText = (brief.ctaText || 'Get Started Free').slice(0, 30);
        }
        if (payload.variant && !['glow-primary', 'outline', 'minimal'].includes(payload.variant as string)) {
          payload.variant = 'glow-primary';
        }
      }
      if (type === 'brand_closing_cta') {
        if (!payload.productName) payload.productName = brief.productName.slice(0, 50);
        if (!payload.tagline) payload.tagline = (brief.tagline || brief.description).slice(0, 100);
      }
      if (type === 'metric_cards') {
        if (!Array.isArray(payload.metrics) || payload.metrics.length === 0) {
          payload.metrics = [
            { value: '+85%', label: 'Mayor Eficiencia', trend: 'Medido en producción' },
            { value: '10x', label: 'Ahorro de Tiempo', trend: 'Automatización total' },
            { value: '99.9%', label: 'Disponibilidad', trend: 'SLA garantizado' },
          ];
        } else {
          payload.metrics = payload.metrics.map((m: unknown, mIdx: number) => {
            const item = (m as Record<string, unknown>) || {};
            return {
              value: typeof item.value === 'string' && item.value.trim().length > 0 ? item.value.slice(0, 20) : `+${(mIdx + 1) * 25}%`,
              label: typeof item.label === 'string' && item.label.trim().length > 0 ? item.label.slice(0, 60) : 'Performance',
              ...(typeof item.trend === 'string' ? { trend: item.trend.slice(0, 40) } : {}),
              ...(typeof item.badge === 'string' ? { badge: item.badge.slice(0, 30) } : {}),
            };
          });
        }
      }
      if (type === 'saas_feature_grid') {
        if (!payload.headline) payload.headline = `${brief.productName} Features`;
        if (!Array.isArray(payload.features) || payload.features.length < 2) {
          payload.features = [
            { icon: '⚡', name: 'Instant Setup', description: 'Live in under 5 minutes' },
            { icon: '🔒', name: 'Enterprise Security', description: 'End-to-end encrypted' },
            { icon: '📊', name: 'Real-time Analytics', description: 'Track every metric that matters' },
            { icon: '🤖', name: 'AI Automation', description: 'Automate tasks intelligently' },
          ];
        } else {
          payload.features = payload.features.slice(0, 6).map((f: unknown, fIdx: number) => {
            const item = (f as Record<string, unknown>) || {};
            return {
              icon: typeof item.icon === 'string' && item.icon.trim().length > 0 ? item.icon.slice(0, 10) : '✨',
              name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name.slice(0, 40) : `Feature ${fIdx + 1}`,
              description: typeof item.description === 'string' && item.description.trim().length > 0 ? item.description.slice(0, 120) : 'Streamlined workflow',
            };
          });
        }
      }
      if (type === 'conversational_mockup') {
        if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
          payload.messages = [
            { sender: 'user', text: `¿Cómo funciona ${brief.productName}?`, time: '10:00' },
            { sender: 'assistant', text: `¡Hola! ${brief.productName} automatiza todo en segundos.`, time: '10:00' },
          ];
        } else {
          payload.messages = payload.messages.map((m: unknown, mIdx: number) => {
            const msg = (m as Record<string, unknown>) || {};
            const sender = msg.sender === 'user' ? 'user' : 'assistant';
            const text = typeof msg.text === 'string' && msg.text.trim().length > 0
              ? msg.text.slice(0, 250)
              : (mIdx % 2 === 0 ? 'How does it work?' : 'Everything is automated.');
            return {
              sender,
              text,
              ...(typeof msg.time === 'string' ? { time: msg.time.slice(0, 10) } : {}),
            };
          });
        }
      }
      if (type === 'media_showcase') {
        if (!payload.headline) payload.headline = brief.productName.slice(0, 80);
        if (!payload.tagline) payload.tagline = (brief.tagline || brief.description).slice(0, 100);
      }

      return {
        ...sc,
        id,
        type,
        startFrame,
        fromFrame: startFrame,
        durationInFrames,
        payload,
      };
    });
  }

  return candidate;
}

export interface GenerateSceneGraphResult {
  source: 'gemini' | 'deterministic-fallback';
  sceneGraph: SceneGraph;
  model?: string;
  reason?: string;
  latencyMs?: number;
}

export interface GenerateSceneGraphOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
}

/** Injected fetch (tests) is called once; the real network gets retries on transient errors. */
function callGemini(
  fetchFn: typeof fetch,
  injected: boolean,
  endpoint: string,
  timeoutMs: number,
  init: RequestInit
): Promise<Response> {
  if (injected) return fetchFn(endpoint, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  return fetchWithRetry(fetchFn, endpoint, { ...init, timeoutMs });
}

/**
 * Main adapter function for Creative Director generation.
 * Calls Gemini REST endpoint with timeout guard, validates structured JSON with Zod,
 * and automatically falls back to deterministic synthesizer on any failure.
 */
export async function generateCreativeDirectorSceneGraph(
  rawBrief: ProductBrief | ProductBriefInput,
  options?: GenerateSceneGraphOptions
): Promise<GenerateSceneGraphResult> {
  const startTime = Date.now();
  const brief = ProductBriefSchema.parse(rawBrief);
  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options?.model ?? process.env.GEMINI_TEXT_MODEL ?? 'gemini-3-flash-preview';
  const timeoutMs = options?.timeoutMs ?? 30000;
  const fetchFn = options?.fetchFn ?? globalThis.fetch;

  // 1. If no API key is provided, execute deterministic fallback immediately
  if (!apiKey || apiKey.trim() === '') {
    const fallbackGraph = generateDeterministicSceneGraph(brief);
    return {
      source: 'deterministic-fallback',
      reason: 'NO_API_KEY_CONFIGURED',
      sceneGraph: fallbackGraph,
      latencyMs: Date.now() - startTime,
    };
  }

  // 2. Perform native HTTP fetch to Gemini REST endpoint with timeout guard
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const response = await callGemini(fetchFn, options?.fetchFn !== undefined, endpoint, timeoutMs, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildCreativeDirectorUserPrompt(brief) }],
          },
        ],
        systemInstruction: {
          parts: [{ text: CREATIVE_DIRECTOR_SYSTEM_PROMPT }],
        },
        generationConfig: {
          temperature: 0.70,
          topP: 0.85,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return {
        source: 'deterministic-fallback',
        reason: `GEMINI_HTTP_${response.status}: ${errorText.slice(0, 100)}`,
        sceneGraph: generateDeterministicSceneGraph(brief),
        latencyMs: Date.now() - startTime,
      };
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const parts = data.candidates?.[0]?.content?.parts;
    const rawOutputText = parts?.find((p) => typeof p.text === 'string' && p.text.trim().length > 0)?.text ?? parts?.[0]?.text;
    if (!rawOutputText) {
      return {
        source: 'deterministic-fallback',
        reason: 'EMPTY_GEMINI_OUTPUT',
        sceneGraph: generateDeterministicSceneGraph(brief),
        latencyMs: Date.now() - startTime,
      };
    }

    // 3. Clean, Sanitize, and Validate SceneGraph against SceneGraphSchema
    const cleanedJson = cleanModelJsonOutput(rawOutputText);
    const parsedRaw = JSON.parse(cleanedJson);
    const sanitized = sanitizeAiSceneGraph(parsedRaw, brief);
    const validation = SceneGraphSchema.safeParse(sanitized);

    if (validation.success) {
      return {
        source: 'gemini',
        model,
        sceneGraph: validation.data,
        latencyMs: Date.now() - startTime,
      };
    }

    // If validation fails despite sanitization, fall back
    return {
      source: 'deterministic-fallback',
      reason: `SCHEMA_VALIDATION_FAILED: ${validation.error.issues[0]?.message ?? 'Invalid structure'}`,
      sceneGraph: generateDeterministicSceneGraph(brief),
      latencyMs: Date.now() - startTime,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
    return {
      source: 'deterministic-fallback',
      reason: errorMsg,
      sceneGraph: generateDeterministicSceneGraph(brief),
      latencyMs: Date.now() - startTime,
    };
  }
}
