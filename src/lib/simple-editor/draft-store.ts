/**
 * draft-store.ts
 *
 * Hands the generated SceneGraph from the landing page to the editor.
 * The graph itself goes to sessionStorage (so a reload keeps the edit). The user's media
 * is kept only in memory (blob URL for preview + data URI for server export) because it
 * can be far larger than the sessionStorage quota.
 */

import { SceneGraphSchema } from '../scene-graph/schema';
import type { MotionArchetype, SceneGraph } from '../scene-graph/types';

const KEY = 'vidiaura:draft:v1';

export interface DraftMedia {
  previewUrl: string;
  dataUri?: string;
}

let memoryMedia: DraftMedia | null = null;

export function saveDraft(graph: SceneGraph, media: DraftMedia | null): void {
  memoryMedia = media;
  if (typeof window === 'undefined') return;
  try {
    // Never persist blob/data URIs in storage.
    const clean = structuredClone(graph);
    for (const scene of clean.scenes) {
      if (scene.type === 'product_interaction_3d' && scene.payload.url) {
        if (/^(blob:|data:)/.test(scene.payload.url)) delete scene.payload.url;
      }
    }
    window.sessionStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    // Storage may be unavailable (private mode / quota): editor falls back to default.
  }
}

export function loadDraft(): { graph: SceneGraph | null; media: DraftMedia | null } {
  if (typeof window === 'undefined') return { graph: null, media: null };
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return { graph: null, media: memoryMedia };
    const parsed = SceneGraphSchema.safeParse(JSON.parse(raw));
    return { graph: parsed.success ? parsed.data : null, media: memoryMedia };
  } catch {
    return { graph: null, media: memoryMedia };
  }
}

const STYLE_KEY = 'vidiaura:style:v1';

export function savePendingStyle(style: MotionArchetype): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STYLE_KEY, style);
  } catch {
    /* ignore */
  }
}

export function takePendingStyle(): MotionArchetype | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.sessionStorage.getItem(STYLE_KEY);
    window.sessionStorage.removeItem(STYLE_KEY);
    return v as MotionArchetype | null;
  } catch {
    return null;
  }
}


const NOTICE_KEY = 'vidiaura:notice:v1';

export function saveNotice(message: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (message) window.sessionStorage.setItem(NOTICE_KEY, message);
    else window.sessionStorage.removeItem(NOTICE_KEY);
  } catch {
    /* ignore */
  }
}

export function readNotice(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(NOTICE_KEY);
  } catch {
    return null;
  }
}
