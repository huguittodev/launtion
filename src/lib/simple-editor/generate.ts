/**
 * generate.ts
 *
 * Client-side orchestration for the landing page's single "Crear Vídeo con IA" action.
 * - With an attached recording/screenshot: POST /api/input-intelligence (multimodal).
 * - Text only: POST /api/creative-director (brief built from the description).
 * Both endpoints already fall back to deterministic generation when Gemini is unavailable,
 * and every graph is re-validated here with SceneGraphSchema before use.
 */

import { SceneGraphSchema } from '../scene-graph/schema';
import type { MotionArchetype, SceneGraph } from '../scene-graph/types';
import { applyStyle, applyUserMedia } from './simple-edit';
import type { DraftMedia } from './draft-store';

export const ACCEPTED_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'image/png',
  'image/jpeg',
] as const;
export const ACCEPT_ATTRIBUTE = '.mp4,.webm,.png,.jpg,.jpeg';
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function validateUpload(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return 'Formato no admitido. Usa .mp4, .webm, .png o .jpg.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return 'El archivo supera el máximo de 20 MB.';
  }
  return null;
}

/** Derives a short product name from a free-text description. */
export function deriveProductName(prompt: string): string {
  const cleaned = prompt.replace(/[^\p{L}\p{N}\s-]/gu, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Tu producto';
  return words.slice(0, 2).join(' ').slice(0, 50);
}

export function buildBrief(prompt: string) {
  const text = prompt.trim();
  const description = (text.length >= 10 ? text : `${text || 'Producto SaaS'} — vídeo de lanzamiento`).slice(0, 500);
  return {
    productName: deriveProductName(text),
    description,
    tagline: text.slice(0, 100) || undefined,
    ctaText: 'Empieza gratis',
  };
}

function fileToBase64DataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export interface GenerateInput {
  prompt: string;
  file: File | null;
  style: MotionArchetype;
}

export interface GenerateOutput {
  graph: SceneGraph;
  media: DraftMedia | null;
}

async function postJson(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : 'No se pudo generar el vídeo.';
    throw new Error(message);
  }
  return data;
}

export async function generateVideo(input: GenerateInput): Promise<GenerateOutput> {
  const prompt = input.prompt.trim();
  if (!prompt && !input.file) {
    throw new Error('Describe tu SaaS o adjunta una grabación para empezar.');
  }

  let rawGraph: unknown;
  let media: DraftMedia | null = null;

  if (input.file) {
    const uploadError = validateUpload(input.file);
    if (uploadError) throw new Error(uploadError);
    const dataUri = await fileToBase64DataUri(input.file);
    const data = await postJson('/api/input-intelligence', {
      fileBase64: dataUri,
      mimeType: input.file.type,
      mediaType: input.file.type.startsWith('video/') ? 'video' : 'image',
      filename: input.file.name.slice(0, 150),
      prompt: prompt || undefined,
      productContext: prompt ? { title: deriveProductName(prompt).slice(0, 100) } : undefined,
    });
    rawGraph = data.sceneGraph;
    media = { previewUrl: URL.createObjectURL(input.file), dataUri };
  } else {
    const data = await postJson('/api/creative-director', buildBrief(prompt));
    rawGraph = data.sceneGraph;
  }

  const parsed = SceneGraphSchema.safeParse(rawGraph);
  if (!parsed.success) throw new Error('La IA devolvió un guion no válido. Inténtalo de nuevo.');

  let graph = applyStyle(parsed.data, input.style).graph;
  if (media) graph = applyUserMedia(graph, media.previewUrl).graph;
  return { graph, media };
}

