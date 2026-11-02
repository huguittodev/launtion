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
Your task is to transform a SaaS Product Brief into a 100% valid, broadcast-quality SceneGraph JSON (v2.0) for Remotion.

### INVIOLABLE RULES:
1. OUTPUT JSON ONLY. No markdown code fences (no \`\`\`json), no explanations, no HTML/JS code.
2. Structure must match the exact SceneGraph v2.0 schema below:
{
  "version": "2.0",
  "canvas": { "width": 1920, "height": 1080, "fps": 30, "durationInFrames": 480 },
  "artDirection": {
    "backdropVariant": "dark-precision",
    "surfaceTheme": "dark",
    "primaryAccent": "${DEFAULT_ACCENT}",
    "archetype": "base44-studio"
  },
  "cameraTrack": [
    { "frame": 0, "x": 0.5, "y": 0.5, "zoom": 1.0, "rotateX": 6.0, "rotateY": -4.0, "rotateZ": 0, "easing": "ease-in-out" },
    { "frame": 80, "x": 0.5, "y": 0.5, "zoom": 1.0, "rotateX": 0.0, "rotateY": 0.0, "rotateZ": 0, "easing": "ease-in-out" },
    { "frame": 120, "x": 0.50, "y": 0.62, "zoom": 2.1, "rotateX": 3.0, "rotateY": -2.0, "rotateZ": 0, "easing": "ease-in-out" },
    { "frame": 155, "x": 0.72, "y": 0.34, "zoom": 2.3, "rotateX": -2.0, "rotateY": 2.0, "rotateZ": 0, "easing": "ease-in-out" },
    { "frame": 210, "x": 0.5, "y": 0.5, "zoom": 1.05, "rotateX": 4.0, "rotateY": -3.0, "rotateZ": 0, "easing": "ease-in-out" },
    { "frame": 240, "x": 0.5, "y": 0.5, "zoom": 1.0, "rotateX": 0.0, "rotateY": 0.0, "rotateZ": 0, "easing": "ease-in-out" },
    { "frame": 330, "x": 0.5, "y": 0.5, "zoom": 1.15, "rotateX": 0.0, "rotateY": 0.0, "rotateZ": 0, "easing": "ease-in-out" },
    { "frame": 400, "x": 0.5, "y": 0.5, "zoom": 1.0, "rotateX": 0.0, "rotateY": 0.0, "rotateZ": 0, "easing": "ease-in-out" },
    { "frame": 480, "x": 0.5, "y": 0.5, "zoom": 1.0, "rotateX": 0.0, "rotateY": 0.0, "rotateZ": 0, "easing": "ease-in-out" }
  ],
  "cursorTrack": [
    { "frame": 0, "x": 0.85, "y": 0.85 },
    { "frame": 65, "x": 0.70, "y": 0.65, "controlX": 0.78, "controlY": 0.80, "click": true },
    { "frame": 110, "x": 0.30, "y": 0.75 },
    { "frame": 150, "x": 0.72, "y": 0.34, "controlX": 0.55, "controlY": 0.42, "click": true },
    { "frame": 200, "x": 0.88, "y": 0.85, "controlX": 0.82, "controlY": 0.60 },
    { "frame": 365, "x": 0.50, "y": 0.50, "controlX": 0.65, "controlY": 0.60, "click": true },
    { "frame": 420, "x": 0.90, "y": 0.90 },
    { "frame": 480, "x": 0.90, "y": 0.90 }
  ],
  "audioTrack": [
    { "id": "cue-ambient-main", "frame": 0, "asset": "ambient-beat", "volume": 0.35, "fadeInFrames": 15, "fadeOutFrames": 45 },
    { "id": "cue-keyboard-tap", "frame": 10, "asset": "keyboard-tap", "volume": 0.45 },
    { "id": "cue-click-prompt", "frame": 65, "asset": "mouse-click", "volume": 0.85 },
    { "id": "cue-whoosh-surface", "frame": 90, "asset": "camera-whoosh", "volume": 0.45 },
    { "id": "cue-whoosh-focus", "frame": 120, "asset": "camera-whoosh", "volume": 0.40 },
    { "id": "cue-click-action", "frame": 150, "asset": "mouse-click", "volume": 0.85 },
    { "id": "cue-chime-action", "frame": 190, "asset": "chime", "volume": 0.75 },
    { "id": "cue-whoosh-tree", "frame": 240, "asset": "camera-whoosh", "volume": 0.45 },
    { "id": "cue-pop-nodes", "frame": 260, "asset": "soft-pop", "volume": 0.55 },
    { "id": "cue-whoosh-hero", "frame": 330, "asset": "camera-whoosh", "volume": 0.45 },
    { "id": "cue-click-hero", "frame": 365, "asset": "mouse-click", "volume": 0.85 },
    { "id": "cue-chime-closing", "frame": 400, "asset": "chime", "volume": 0.70 }
  ],
  "scenes": [
    {
      "id": "scene-1-hook",
      "type": "kinetic_typography",
      "startFrame": 0,
      "fromFrame": 0,
      "durationInFrames": 90,
      "payload": {
        "words": ["Scale", "Your", "SaaS", "Instantly"],
        "accentWordIndex": 2,
        "staggerFrames": 10
      }
    },
    {
      "id": "scene-2-features",
      "type": "metric_cards",
      "startFrame": 90,
      "fromFrame": 90,
      "durationInFrames": 150,
      "payload": {
        "headline": "Measurable Results in Production",
        "subheadline": "Built for modern high-performance teams",
        "metrics": [
          { "value": "+85%", "label": "Growth Rate", "trend": "+12% this month" },
          { "value": "10x", "label": "Faster Workflow", "trend": "Instant sync" },
          { "value": "99.9%", "label": "Guaranteed SLA", "trend": "Zero downtime" }
        ]
      }
    },
    {
      "id": "scene-3-hero-cta",
      "type": "synthetic_hero_button",
      "startFrame": 240,
      "fromFrame": 240,
      "durationInFrames": 100,
      "payload": {
        "buttonText": "Start Free Trial",
        "variant": "glow-primary",
        "clickFrame": 280
      }
    },
    {
      "id": "scene-4-brand-closing",
      "type": "brand_closing_cta",
      "startFrame": 340,
      "fromFrame": 340,
      "durationInFrames": 140,
      "payload": {
        "productName": "Product Name",
        "tagline": "Product memorable closing tagline",
        "showLogo": true,
        "buttonText": "Get Started Free"
      }
    }
  ]
}
3. Supported scene types:
    - "kinetic_typography": Punchy words hook.
    - "metric_cards": KPI results cards (metrics: array of {value, label, trend}).
    - "conversational_mockup": WhatsApp/Chat demo (messages: array of {sender: 'user'|'assistant', text, time}).
    - "media_showcase": User image/video screenshot with cinematic zoom (headline, tagline, zoomScale).
    - "synthetic_prompt_box": AI prompt command box (textToType, typingSpeed).
    - "synthetic_hero_button": Glowing action button with click (buttonText, clickFrame).
    - "brand_closing_cta": Final logo & brand punchline.
4. Procedural Variety Rule:
    - If the product is about WhatsApp, appointments, bookings, chat, or support -> use conversational_mockup.
    - If it's about metrics, growth, finance, performance, or sales -> use metric_cards.
    - NEVER use synthetic_code_tree for non-developer products!
5. All keyframes, cues, and scene start frames MUST be <= 480.
6. Allowed audio assets: "ambient-beat", "mouse-click", "camera-whoosh", "keyboard-tap", "soft-pop", "chime".
7. Allowed backdrop variants: "dark-precision", "light-editorial", "aurora-blur", "solid".
8. Allowed surface themes: "light", "dark".
9. Primary accent must be a valid hex color code (e.g. "${DEFAULT_ACCENT}").
10. String limits:
    - prompt textToType <= 200 chars
    - buttonText <= 30 chars
    - productName <= 50 chars
    - tagline <= 100 chars
    - headline <= 60 chars
    - title <= 50 chars
11. Tailor all headlines, descriptions, button texts and scene copy specifically to the user's SaaS brief!`;

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
  'mouse-click',
  'camera-whoosh',
  'keyboard-tap',
  'chime',
  'soft-pop',
  'ambient-beat',
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
    // Synthesize biomechanical cursor keyframes if missing
    candidate.cursorTrack = [
      { frame: 0, x: 0.85, y: 0.85 },
      { frame: 65, x: 0.70, y: 0.65, controlX: 0.78, controlY: 0.80, click: true },
      { frame: 110, x: 0.30, y: 0.75 },
      { frame: 150, x: 0.72, y: 0.34, controlX: 0.55, controlY: 0.42, click: true },
      { frame: 200, x: 0.88, y: 0.85, controlX: 0.82, controlY: 0.60 },
      { frame: 365, x: 0.50, y: 0.50, controlX: 0.65, controlY: 0.60, click: true },
      { frame: 420, x: 0.90, y: 0.90 },
      { frame: duration, x: 0.90, y: 0.90 },
    ];
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
    // Default synchronized audio track
    candidate.audioTrack = [
      { id: 'cue-ambient-main', frame: 0, asset: 'ambient-beat', volume: 0.35, fadeInFrames: 15, fadeOutFrames: 45 },
      { id: 'cue-keyboard-tap', frame: 10, asset: 'keyboard-tap', volume: 0.45 },
      { id: 'cue-click-prompt', frame: 65, asset: 'mouse-click', volume: 0.85 },
      { id: 'cue-whoosh-surface', frame: 90, asset: 'camera-whoosh', volume: 0.45 },
      { id: 'cue-whoosh-focus', frame: 120, asset: 'camera-whoosh', volume: 0.40 },
      { id: 'cue-click-action', frame: 150, asset: 'mouse-click', volume: 0.85 },
      { id: 'cue-chime-action', frame: 190, asset: 'chime', volume: 0.75 },
      { id: 'cue-whoosh-tree', frame: 240, asset: 'camera-whoosh', volume: 0.45 },
      { id: 'cue-pop-nodes', frame: 260, asset: 'soft-pop', volume: 0.55 },
      { id: 'cue-whoosh-hero', frame: 330, asset: 'camera-whoosh', volume: 0.45 },
      { id: 'cue-click-hero', frame: 365, asset: 'mouse-click', volume: 0.85 },
      { id: 'cue-chime-closing', frame: 400, asset: 'chime', volume: 0.70 },
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

      // Map content -> payload if payload is missing
      const rawPayload = (sc.payload as Record<string, unknown>) || (sc.content as Record<string, unknown>) || {};
      const payload: Record<string, unknown> = { ...rawPayload };

      // Ensure string limits
      if (typeof payload.textToType === 'string') payload.textToType = payload.textToType.slice(0, 200);
      if (typeof payload.buttonText === 'string') payload.buttonText = payload.buttonText.slice(0, 30);
      if (typeof payload.productName === 'string') payload.productName = payload.productName.slice(0, 50);
      if (typeof payload.tagline === 'string') payload.tagline = payload.tagline.slice(0, 100);
      if (typeof payload.headline === 'string') payload.headline = payload.headline.slice(0, 60);
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
      if (type === 'synthetic_hero_button' && !payload.buttonText) {
        payload.buttonText = (brief.ctaText || 'Get Started Free').slice(0, 30);
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
        }
      }
      if (type === 'conversational_mockup') {
        if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
          payload.messages = [
            { sender: 'user', text: `¿Cómo funciona ${brief.productName}?`, time: '10:00' },
            { sender: 'assistant', text: `¡Hola! ${brief.productName} automatiza todo en segundos.`, time: '10:00' },
          ];
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
  const model = options?.model ?? process.env.GEMINI_TEXT_MODEL ?? 'gemini-3.5-flash';
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
          temperature: 0.25,
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
