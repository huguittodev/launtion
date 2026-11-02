/**
 * media-layout.ts
 *
 * Single source of truth for where the user's recording sits on the canvas.
 * The Remotion composition sizes the 3D surface with `computeSurfaceLayout`, and the
 * InteractionMap synthesizer converts coordinates detected inside the media
 * (normalized to the media frame) into canvas-normalized coordinates with
 * `mediaToCanvasNormalized`. Using one function for both keeps the cursor and camera
 * glued to the real buttons of the recording.
 */

export const SURFACE_HEADER_HEIGHT = 44;

export interface CanvasSize {
  width: number;
  height: number;
}

export interface SurfaceLayout {
  /** Outer window (header + content), in canvas pixels. */
  surfaceWidth: number;
  surfaceHeight: number;
  surfaceX: number;
  surfaceY: number;
  /** Media area (below the header), in canvas pixels. */
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
}

const MIN_ASPECT = 0.3;
const MAX_ASPECT = 4;

export function sanitizeAspect(aspect: number | undefined | null): number | undefined {
  if (typeof aspect !== 'number' || !Number.isFinite(aspect) || aspect <= 0) return undefined;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
}

export function computeSurfaceLayout(canvas: CanvasSize, mediaAspect?: number | null): SurfaceLayout {
  const isVertical = canvas.width < canvas.height;
  const maxWidth = isVertical ? 960 : 1440;
  const maxHeight = isVertical ? 1300 : 840;
  const aspect = sanitizeAspect(mediaAspect);

  let contentWidth: number;
  let contentHeight: number;
  if (aspect) {
    const availHeight = maxHeight - SURFACE_HEADER_HEIGHT;
    contentWidth = Math.min(maxWidth, availHeight * aspect);
    contentHeight = contentWidth / aspect;
  } else {
    // Legacy default (no known media aspect): 1440x840 window, 960x560 in vertical.
    contentWidth = maxWidth;
    contentHeight = (isVertical ? 560 : 840) - SURFACE_HEADER_HEIGHT;
  }

  contentWidth = Math.round(contentWidth);
  contentHeight = Math.round(contentHeight);
  const surfaceWidth = contentWidth;
  const surfaceHeight = contentHeight + SURFACE_HEADER_HEIGHT;
  const surfaceX = (canvas.width - surfaceWidth) / 2;
  const surfaceY = (canvas.height - surfaceHeight) / 2;

  return {
    surfaceWidth,
    surfaceHeight,
    surfaceX,
    surfaceY,
    contentX: surfaceX,
    contentY: surfaceY + SURFACE_HEADER_HEIGHT,
    contentWidth,
    contentHeight,
  };
}

/** Converts a point normalized to the media frame into canvas-normalized coordinates. */
export function mediaToCanvasNormalized(
  layout: SurfaceLayout,
  canvas: CanvasSize,
  nx: number,
  ny: number
): { x: number; y: number } {
  const cx = Math.min(1, Math.max(0, nx));
  const cy = Math.min(1, Math.max(0, ny));
  return {
    x: (layout.contentX + cx * layout.contentWidth) / canvas.width,
    y: (layout.contentY + cy * layout.contentHeight) / canvas.height,
  };
}

/**
 * Re-expresses a canvas-normalized point after the canvas changes shape (e.g. 16:9 -> 9:16),
 * keeping it on the same pixel of the recording. Unclamped so overview points survive.
 */
export function remapCanvasPoint(
  from: CanvasSize,
  to: CanvasSize,
  mediaAspect: number | undefined | null,
  point: { x: number; y: number }
): { x: number; y: number } {
  const a = computeSurfaceLayout(from, mediaAspect);
  const b = computeSurfaceLayout(to, mediaAspect);
  const mx = (point.x * from.width - a.contentX) / a.contentWidth;
  const my = (point.y * from.height - a.contentY) / a.contentHeight;
  return {
    x: (b.contentX + mx * b.contentWidth) / to.width,
    y: (b.contentY + my * b.contentHeight) / to.height,
  };
}
