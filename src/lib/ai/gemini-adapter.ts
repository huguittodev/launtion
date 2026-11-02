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

export const CREATIVE_DIRECTOR_SYSTEM_PROMPT = `You are the Executive Creative Director of Vidiaura, an automated video motion graphics studio.
Your task is to transform a SaaS Product Brief into a 100% valid, broadcast-quality SceneGraph JSON (v2.0) for Remotion.

### INVIOLABLE RULES:
1. OUTPUT JSON ONLY. No markdown triple-backticks (no \`\`\`json), no explanations, no HTML/JS code.
2. Comply strictly with SceneGraph specification v2.0.
3. Canvas config: width=1920, height=1080, fps=30, durationInFrames=480 (16 seconds).
4. Every keyframe frame, audioCue frame, and scene startFrame MUST be <= 480.
5. Allowed audio assets: "ambient-beat", "mouse-click", "camera-whoosh", "keyboard-tap", "soft-pop", "chime".
6. Allowed backdrop variants: "dark-precision", "light-editorial", "aurora-blur", "solid".
7. Allowed surface themes: "light", "dark".
8. Primary accent must be a valid hex color code (e.g. "#FF5C35").
9. Zoom values must be between 0.8 and 3.5. Hero inspection zooms must be 1.8 to 2.4.
10. String limits:
    - prompt textToType <= 200 chars
    - buttonText <= 30 chars
    - productName <= 50 chars
    - tagline <= 100 chars
    - headline <= 60 chars
    - title <= 50 chars
11. 5-Scene Narrative Pacing (480 frames total):
    - Scene 1 (frames 0 to 90, duration 90): "synthetic_prompt_box" (Hook typing value proposition)
    - Scene 2 (frames 90 to 240, duration 150): "product_interaction_3d" (Core surface demo)
    - Scene 3 (frames 240 to 330, duration 90): "synthetic_code_tree" (Architecture & integrations)
    - Scene 4 (frames 330 to 400, duration 70): "synthetic_hero_button" (Hero action button)
    - Scene 5 (frames 400 to 480, duration 80): "brand_closing_cta" (Brand closing with logo and CTA)
12. Synchronize mouse-click SFX exactly to the frame of cursor clicks.`;

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
    primaryColor: brief.primaryColor || brief.accentColor || '#FF5C35',
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

  candidate.canvas = {
    width,
    height,
    fps,
    durationInFrames: duration,
  };

  // 3. Art Direction
  const rawArt = (candidate.artDirection as Record<string, unknown>) || {};
  let backdropVariant = rawArt.backdropVariant as BackdropVariant;
  if (!ALLOWED_BACKDROPS.includes(backdropVariant)) {
    backdropVariant = 'dark-precision';
  }

  let surfaceTheme = rawArt.surfaceTheme as SurfaceTheme;
  if (!ALLOWED_SURFACES.includes(surfaceTheme)) {
    surfaceTheme = 'dark';
  }

  let primaryAccent = String(rawArt.primaryAccent || brief.accentColor || brief.primaryColor || '#FF5C35');
  if (!HexColorRegex.test(primaryAccent)) {
    primaryAccent = '#FF5C35';
  }

  candidate.artDirection = {
    backdropVariant,
    surfaceTheme,
    primaryAccent,
  };

  // 4. Camera Track
  if (Array.isArray(candidate.cameraTrack)) {
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
  }

  // 5. Cursor Track
  if (Array.isArray(candidate.cursorTrack)) {
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
  }

  // 6. Audio Track
  if (Array.isArray(candidate.audioTrack)) {
    candidate.audioTrack = candidate.audioTrack
      .map((cue: Record<string, unknown>, idx: number) => {
        const rawFrame = typeof cue.frame === 'number' ? cue.frame : 0;
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
  }

  // 7. Scenes
  if (Array.isArray(candidate.scenes)) {
    candidate.scenes = candidate.scenes.map((sc: Record<string, unknown>, idx: number) => {
      const id = typeof sc.id === 'string' && sc.id.trim().length > 0 ? sc.id : `scene-${idx + 1}`;
      const rawStart = typeof sc.startFrame === 'number' ? sc.startFrame : 0;
      const startFrame = Math.max(0, Math.min(duration, Math.round(rawStart)));
      const rawDur = typeof sc.durationInFrames === 'number' ? sc.durationInFrames : 60;
      const durationInFrames = Math.max(1, Math.min(duration - startFrame, rawDur));

      return {
        ...sc,
        id,
        startFrame,
        fromFrame: startFrame,
        durationInFrames,
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
  const model = options?.model ?? process.env.GEMINI_TEXT_MODEL ?? 'gemini-2.5-flash';
  const timeoutMs = options?.timeoutMs ?? 12000;
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
    const response = await fetchFn(endpoint, {
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
      signal: AbortSignal.timeout(timeoutMs),
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

    const rawOutputText = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
