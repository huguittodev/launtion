/**
 * FocalTracker.ts
 * Coordinate normalization, bounds clamping, and aspect-ratio containment for camera focal tracking.
 */

import { clamp, clamp01 } from '../../../src/lib/interaction-map/CoordinateMapper';
import type { FocalPoint2D, ViewportDimensions } from './CameraTransform';

export interface FocalTrackerOptions {
  containWithinBounds?: boolean;
  edgeMargin?: number; // Normalized safety padding from border (e.g. 0.02)
}

export interface FocalBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Normalizes focal coordinates to [0.0, 1.0].
 * Automatically detects legacy percentage coordinates [0, 100] and maps to [0.0, 1.0].
 * Gracefully falls back to center (0.5, 0.5) for non-finite values.
 */
export function normalizeFocalPoint(point: FocalPoint2D): FocalPoint2D {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return { x: 0.5, y: 0.5 };
  }
  // Auto-detect legacy percentages [0 - 100]
  const nx = point.x > 1.0 ? point.x / 100 : point.x;
  const ny = point.y > 1.0 ? point.y / 100 : point.y;
  return {
    x: clamp01(nx),
    y: clamp01(ny),
  };
}

/**
 * Bounds the focal point so that the visible frame at zoom scale S
 * does not overshoot the canvas borders (preventing empty void margins).
 */
export function clampFocalToZoomBounds(
  point: FocalPoint2D,
  zoom: number,
  edgeMargin = 0.0
): FocalPoint2D {
  const norm = normalizeFocalPoint(point);
  if (zoom <= 1.0) {
    return norm;
  }

  // The visible half-extent at zoom S is (0.5 / S)
  const halfVisibleX = 0.5 / zoom;
  const halfVisibleY = 0.5 / zoom;

  const minX = Math.min(0.5, halfVisibleX + edgeMargin);
  const maxX = Math.max(0.5, 1.0 - halfVisibleX - edgeMargin);
  const minY = Math.min(0.5, halfVisibleY + edgeMargin);
  const maxY = Math.max(0.5, 1.0 - halfVisibleY - edgeMargin);

  return {
    x: clamp(norm.x, minX, maxX),
    y: clamp(norm.y, minY, maxY),
  };
}

/**
 * Calculates the bounding rectangle of the visible region in canvas pixel space at the given focal point and zoom.
 */
export function getFocalVisibleRect(
  focalPoint: FocalPoint2D,
  zoom: number,
  viewport: ViewportDimensions = { width: 1920, height: 1080 }
): FocalBoundingBox {
  const norm = normalizeFocalPoint(focalPoint);
  const safeZoom = Math.max(0.1, zoom);
  const visibleWidth = viewport.width / safeZoom;
  const visibleHeight = viewport.height / safeZoom;

  const centerX = norm.x * viewport.width;
  const centerY = norm.y * viewport.height;

  const left = centerX - visibleWidth / 2;
  const top = centerY - visibleHeight / 2;

  return {
    x: left,
    y: top,
    width: visibleWidth,
    height: visibleHeight,
    left,
    right: left + visibleWidth,
    top,
    bottom: top + visibleHeight,
  };
}
