/**
 * src/lib/input-intelligence/gemini-vision-adapter.ts
 *
 * Server-side REST API adapter for Google Gemini 2.5 Flash Vision.
 * Consumes multimodal image (PNG, JPG, WebP) and video (MP4) captures
 * via native Node.js fetch with AbortSignal.timeout(15000).
 *
 * Extracts structured UI landmark bounding boxes, normalizes coordinates,
 * synthesizes inferred InteractionMap telemetry, and adapts to Remotion SceneGraph.
 *
 * Guarantees zero unhandled exceptions: engages deterministic fallback on any error,
 * timeout, missing key, or rate limit.
 */

import { CoordinateMapper } from '../interaction-map/CoordinateMapper';
import { cleanModelJsonOutput } from '../ai/gemini-adapter';
import { fetchWithRetry } from '../ai/fetch-retry';
import {
  adaptInferredInteractionToSceneGraph,
  synthesizeInferredInteractionMap,
} from './interaction-synthesizer';
import type {
  AnalyzeMediaOptions,
  DetectedElementCategory,
  InputIntelligencePayload,
  InputIntelligencePayloadInput,
  InputIntelligenceResult,
  SuggestedAction,
  VisualLandmark,
} from './types';
import { generateDeterministicVisualFallback } from './visual-fallback';

export const GEMINI_VISION_SYSTEM_PROMPT = `You are the Computer Vision & UI Telemetry Analyst for Vidiaura Studio.
Your task is to analyze the provided software capture (screenshot or screen recording) and extract key interactive landmarks with precise bounding boxes.

### FOR VIDEOS (screen recordings):
Watch the WHOLE recording. List the 4-10 most important moments in strict chronological order (clicks on buttons, typing in inputs, screen transitions, success states).
For each element add "timeSeconds": the second of the recording at which the user interacts with it (or the element is most visible),
and make "box2d" the bounding box of that element AS IT APPEARS AT THAT MOMENT, relative to the full video frame.
Never reuse one box for different screens. For screenshots omit timeSeconds.

### INVIOLABLE RULES:
1. OUTPUT JSON ONLY. No markdown, no conversational commentary, no code fences.
2. Coordinate system: Bounding box [ymin, xmin, ymax, xmax] as numbers either in [0, 1000] base-1000 integers or [0.0, 1.0] normalized floats.
3. Identify at least 3 and at most 8 prominent interactive targets:
   - Primary conversion CTA button (e.g. 'Deploy', 'Publish', 'Get Started', 'Create', 'Submit', 'Sign Up').
   - Main input/search bar or command palette if present.
   - Top navigation bar or workspace header.
   - Main dashboard metric card or hero visualization.
4. For each element, provide:
   - id: unique string (e.g. "elem-cta-1", "elem-input-2")
   - label: OCR or descriptive text of the element (max 50 chars)
   - category: "cta" | "input" | "card" | "navigation" | "metric" | "tab" | "other"
   - confidence: float between 0.0 and 1.0
   - box2d: [ymin, xmin, ymax, xmax]
   - suggestedAction: "click" | "hover" | "focus" | "scroll"
   - timeSeconds: number (videos only, see above)

JSON Format:
{
  "summary": "Brief description of the UI view",
  "elements": [
    {
      "id": "elem-cta-1",
      "label": "Deploy App",
      "category": "cta",
      "confidence": 0.98,
      "box2d": [620, 750, 680, 910],
      "suggestedAction": "click",
      "timeSeconds": 4.2
    }
  ]
}`;

/**
 * Normalizes raw category strings from model into the allowed taxonomy.
 */
function normalizeCategory(raw: unknown): DetectedElementCategory {
  if (typeof raw !== 'string') return 'other';
  const lower = raw.toLowerCase().trim();
  if (/cta|button|primary/i.test(lower)) return 'cta';
  if (/input|search|prompt|field|bar/i.test(lower)) return 'input';
  if (/metric|kpi|stat|chart/i.test(lower)) return 'metric';
  if (/card|hero|container|panel/i.test(lower)) return 'card';
  if (/nav|header|workspace|menu/i.test(lower)) return 'navigation';
  if (/tab|segment/i.test(lower)) return 'tab';
  return 'other';
}

/**
 * Normalizes suggested action string.
 */
function normalizeAction(raw: unknown, category: DetectedElementCategory): SuggestedAction {
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim();
    if (lower === 'click' || lower === 'hover' || lower === 'focus' || lower === 'scroll') {
      return lower;
    }
  }
  if (category === 'cta') return 'click';
  if (category === 'input') return 'focus';
  if (category === 'card' || category === 'metric') return 'hover';
  return 'hover';
}

/**
 * Normalizes 2D bounding boxes:
 * - Detects whether coordinates are base-1000 [0, 1000] or unit floats [0.0, 1.0]
 * - Resolves inverted coordinates (ymin > ymax, xmin > xmax)
 * - Clamps coordinates to [0.0, 1.0]
 * - Computes normalized center point { x, y }
 */
export function normalizeBoundingBox(box: unknown): {
  normalizedBox: [number, number, number, number];
  center: { x: number; y: number };
} {
  const defaultCenter = { x: 0.5, y: 0.5 };
  const defaultBox: [number, number, number, number] = [0.2, 0.2, 0.8, 0.8];

  if (!Array.isArray(box) || box.length < 4) {
    return { normalizedBox: defaultBox, center: defaultCenter };
  }

  const rawY0 = Number(box[0]);
  const rawX0 = Number(box[1]);
  const rawY1 = Number(box[2]);
  const rawX1 = Number(box[3]);

  if (
    !Number.isFinite(rawY0) ||
    !Number.isFinite(rawX0) ||
    !Number.isFinite(rawY1) ||
    !Number.isFinite(rawX1)
  ) {
    return { normalizedBox: defaultBox, center: defaultCenter };
  }

  // Detect base-1000 vs unit floats (threshold > 2.0 ensures slightly out-of-bounds floats are not divided by 1000)
  const isBase1000 = Math.max(rawY0, rawX0, rawY1, rawX1) > 2.0;
  const divisor = isBase1000 ? 1000 : 1;

  const y0 = rawY0 / divisor;
  const x0 = rawX0 / divisor;
  const y1 = rawY1 / divisor;
  const x1 = rawX1 / divisor;

  // Resolve inverted vertices
  const ymin = CoordinateMapper.clamp01(Math.min(y0, y1));
  const xmin = CoordinateMapper.clamp01(Math.min(x0, x1));
  const ymax = CoordinateMapper.clamp01(Math.max(y0, y1));
  const xmax = CoordinateMapper.clamp01(Math.max(x0, x1));

  const centerX = CoordinateMapper.clamp01((xmin + xmax) / 2);
  const centerY = CoordinateMapper.clamp01((ymin + ymax) / 2);

  return {
    normalizedBox: [
      Number(ymin.toFixed(4)),
      Number(xmin.toFixed(4)),
      Number(ymax.toFixed(4)),
      Number(xmax.toFixed(4)),
    ],
    center: {
      x: Number(centerX.toFixed(4)),
      y: Number(centerY.toFixed(4)),
    },
  };
}

/**
 * Strips data URL prefix to obtain raw base64 string.
 */
export function extractRawBase64(data: string): string {
  const parts = data.includes(',') ? data.split(',')[1] : data;
  return parts.replace(/\s+/g, '');
}

/**
 * Builds data URI representation for client preview.
 */
export function ensureDataUri(rawBase64: string, mimeType: string): string {
  if (rawBase64.startsWith('data:')) return rawBase64;
  return `data:${mimeType};base64,${rawBase64}`;
}

/**
 * Builds the multimodal request parts. With browser-sampled frames each image is preceded by
 * its exact timestamp, so the model can report reliable `timeSeconds` values.
 */
function buildMediaParts(
  userPrompt: string,
  payload: InputIntelligencePayload | InputIntelligencePayloadInput,
  pureBase64: string
): Array<Record<string, unknown>> {
  const frames = payload.frames;
  if (frames && frames.length > 0) {
    const parts: Array<Record<string, unknown>> = [
      {
        text:
          userPrompt +
          `\nThe recording is provided as ${frames.length} chronological screenshots sampled from the video` +
          (payload.mediaDurationSeconds ? ` (total ${payload.mediaDurationSeconds.toFixed(1)}s)` : '') +
          '. Each screenshot is preceded by its exact timestamp. Use those timestamps for timeSeconds.',
      },
    ];
    for (const f of [...frames].sort((a, b) => a.timeSeconds - b.timeSeconds)) {
      parts.push({ text: `Frame at t=${f.timeSeconds.toFixed(1)}s` });
      parts.push({ inlineData: { mimeType: 'image/jpeg', data: extractRawBase64(f.dataUri) } });
    }
    return parts;
  }
  return [{ text: userPrompt }, { inlineData: { mimeType: payload.mimeType, data: pureBase64 } }];
}

/**
 * Primary multimodal analysis adapter for Gemini 2.5 Flash Vision.
 */
export async function analyzeMediaWithGeminiVision(
  payload: InputIntelligencePayload | InputIntelligencePayloadInput,
  options?: AnalyzeMediaOptions
): Promise<InputIntelligenceResult> {
  const startTime = Date.now();

  const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options?.model ?? process.env.GEMINI_VISION_MODEL ?? 'gemini-3.5-flash';
  const timeoutMs = options?.timeoutMs ?? 90000;
  const fetchFn = options?.fetchFn ?? globalThis.fetch;

  const rawData = payload.fileBase64 || payload.base64Data || payload.fileData || '';
  const pureBase64 = extractRawBase64(rawData);
  const dataUri = ensureDataUri(pureBase64, payload.mimeType);
  const filename = payload.filename || payload.fileName || 'capture';
  const productContext = payload.productContext || payload.context;

  // 1. If API key is missing, execute deterministic fallback immediately
  if (!apiKey || apiKey.trim() === '') {
    return generateDeterministicVisualFallback({
      reason: 'NO_API_KEY_CONFIGURED',
      productContext,
      assetDataUri: dataUri,
      assetFilename: filename,
      mimeType: payload.mimeType,
      targetDurationInFrames: payload.targetDurationInFrames,
      fps: payload.fps,
    });
  }

  // 2. Perform native HTTP fetch to Gemini REST endpoint
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  try {
    const userPrompt = JSON.stringify({
      task: 'Extract interactive UI landmarks and bounding boxes for video choreography',
      filename,
      mimeType: payload.mimeType,
      userContext: productContext ?? null,
      additionalNotes: payload.prompt ?? null,
    });

    const response = await (options?.fetchFn !== undefined
      ? (init: RequestInit) => fetchFn(endpoint, { ...init, signal: AbortSignal.timeout(timeoutMs) })
      : (init: RequestInit) => fetchWithRetry(fetchFn, endpoint, { ...init, timeoutMs }))({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: buildMediaParts(userPrompt, payload, pureBase64),
          },
        ],
        systemInstruction: {
          parts: [{ text: GEMINI_VISION_SYSTEM_PROMPT }],
        },
        generationConfig: {
          temperature: 0.2,
          topP: 0.85,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return generateDeterministicVisualFallback({
        reason: `GEMINI_HTTP_${response.status}: ${errorText.slice(0, 100)}`,
        productContext,
        assetDataUri: dataUri,
        assetFilename: filename,
        mimeType: payload.mimeType,
        targetDurationInFrames: payload.targetDurationInFrames,
        fps: payload.fps,
      });
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
      return generateDeterministicVisualFallback({
        reason: 'EMPTY_GEMINI_OUTPUT',
        productContext,
        assetDataUri: dataUri,
        assetFilename: filename,
        mimeType: payload.mimeType,
        targetDurationInFrames: payload.targetDurationInFrames,
        fps: payload.fps,
      });
    }

    // 3. Clean, parse, and normalize detected landmarks
    const cleanedJson = cleanModelJsonOutput(rawOutputText);
    const parsedData = JSON.parse(cleanedJson) as {
      summary?: string;
      elements?: Array<Record<string, unknown>>;
    };

    const rawElements = Array.isArray(parsedData.elements) ? parsedData.elements : [];
    const landmarks: VisualLandmark[] = rawElements.map((elem, idx): VisualLandmark => {
      const id = typeof elem.id === 'string' && elem.id.length > 0 ? elem.id : `detected-elem-${idx + 1}`;
      const label =
        typeof elem.label === 'string' && elem.label.trim().length > 0
          ? elem.label.trim()
          : `UI Element ${idx + 1}`;
      const category = normalizeCategory(elem.category || elem.type);
      const { normalizedBox, center } = normalizeBoundingBox(elem.box2d);
      const confidence =
        typeof elem.confidence === 'number' && Number.isFinite(elem.confidence)
          ? CoordinateMapper.clamp01(elem.confidence)
          : 0.95;
      const suggestedAction = normalizeAction(elem.suggestedAction, category);
      const targetZoom = category === 'cta' ? 2.35 : category === 'card' || category === 'metric' ? 2.1 : 1.5;

      const rawTime = typeof elem.timeSeconds === 'number' ? elem.timeSeconds : Number(elem.timeSeconds);
      const timeSeconds =
        payload.mediaType === 'video' || payload.mimeType.startsWith('video/')
          ? Number.isFinite(rawTime) && rawTime >= 0
            ? rawTime
            : undefined
          : undefined;

      return {
        id,
        label,
        category,
        type: category,
        box2d: normalizedBox,
        normalizedCenter: center,
        confidence,
        suggestedAction,
        targetZoom,
        ...(timeSeconds !== undefined ? { timeSeconds } : {}),
      };
    });

    // If zero elements detected, fall back to canonical landmarks
    const finalLandmarks =
      landmarks.length >= 2
        ? landmarks
        : generateDeterministicVisualFallback({ productContext }).landmarks;

    // 4. Synthesize Inferred InteractionMap and SceneGraph
    const interactionMap = synthesizeInferredInteractionMap(finalLandmarks, {
      fps: payload.fps ?? 30,
      durationInFrames: payload.targetDurationInFrames ?? 480,
      baseWidth: 1920,
      baseHeight: 1080,
      productContext,
      mediaAspect: payload.mediaAspect,
      mediaDurationSeconds: payload.mediaDurationSeconds,
    });

    const sceneGraph = adaptInferredInteractionToSceneGraph(interactionMap, {
      assetDataUri: dataUri,
      assetFilename: filename,
      mediaAspect: payload.mediaAspect,
    });

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      source: 'gemini-vision',
      model,
      latencyMs,
      summary:
        parsedData.summary ||
        `Análisis multimodal completado con ${finalLandmarks.length} elementos interactivos detectados.`,
      landmarks: finalLandmarks,
      detectedElements: finalLandmarks,
      interactionMap,
      sceneGraph,
      asset: {
        filename,
        mimeType: payload.mimeType,
        dataUri,
      },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'UNKNOWN_ERROR';
    return generateDeterministicVisualFallback({
      reason: errorMsg,
      productContext,
      assetDataUri: dataUri,
      assetFilename: filename,
      mimeType: payload.mimeType,
      targetDurationInFrames: payload.targetDurationInFrames,
      fps: payload.fps,
    });
  }
}
