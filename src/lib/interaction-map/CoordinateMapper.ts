/**
 * CoordinateMapper.ts
 * Pure mathematical functions for bidirectional coordinate conversions,
 * boundary clamping, aspect ratio fitting, and nested viewport mapping.
 */

export interface Point2D {
  x: number;
  y: number;
}

export type NormalizedPoint = Point2D;
export type PixelPoint = Point2D;

export interface Dimensions2D {
  width: number;
  height: number;
}

export type Dimensions = Dimensions2D;

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type NormalizedRect = Rect2D;
export type PixelRect = Rect2D;

export interface FittedBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

/**
 * Clamps a scalar value strictly into [min, max].
 * Non-finite values (NaN, Infinity, -Infinity) resolve safely to min.
 */
export function clamp(value: number, min = 0.0, max = 1.0): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamps a scalar value strictly into [0.0, 1.0].
 */
export function clamp01(value: number): number {
  return clamp(value, 0.0, 1.0);
}

/**
 * Clamps a 2D point to the unit normalized square [0.0, 1.0] x [0.0, 1.0].
 */
export function clampNormalized(point: Point2D): Point2D {
  return {
    x: clamp01(point.x),
    y: clamp01(point.y),
  };
}

/**
 * Clamps a pixel point to canvas dimensions [0, width] x [0, height].
 */
export function clampPixel(point: Point2D, bounds: Dimensions2D): Point2D {
  return {
    x: clamp(point.x, 0, Math.max(0, bounds.width)),
    y: clamp(point.y, 0, Math.max(0, bounds.height)),
  };
}

/**
 * Converts normalized [0.0, 1.0] coordinates to canvas pixel space.
 * Supports continuous sub-pixel coordinates or snapped integer pixels.
 */
export function toPixels(
  normPoint: Point2D,
  dimensions: Dimensions2D,
  snapToInteger = false
): Point2D {
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height)
  ) {
    throw new RangeError(
      `Canvas dimensions must be positive finite numbers: got ${dimensions.width}x${dimensions.height}`
    );
  }

  const clamped = clampNormalized(normPoint);
  const px = clamped.x * dimensions.width;
  const py = clamped.y * dimensions.height;

  return {
    x: snapToInteger ? Math.round(px) : px,
    y: snapToInteger ? Math.round(py) : py,
  };
}

export const normalizedToPixel = toPixels;

/**
 * Converts canvas pixel coordinates to normalized [0.0, 1.0] space.
 */
export function toNormalized(
  pixelPoint: Point2D,
  dimensions: Dimensions2D,
  clampBounds = true
): Point2D {
  if (
    dimensions.width <= 0 ||
    dimensions.height <= 0 ||
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height)
  ) {
    throw new RangeError(
      `Canvas dimensions must be positive finite numbers: got ${dimensions.width}x${dimensions.height}`
    );
  }

  const u = pixelPoint.x / dimensions.width;
  const v = pixelPoint.y / dimensions.height;

  if (clampBounds) {
    return {
      x: clamp01(u),
      y: clamp01(v),
    };
  }

  return { x: u, y: v };
}

export const pixelToNormalized = toNormalized;

/**
 * Computes aspect-ratio preserved fitted bounds (contain mode)
 * for a source resolution placed inside target bounds, centered.
 */
export function fitWithinBounds(
  source: Dimensions2D,
  target: Dimensions2D
): FittedBounds {
  if (
    source.width <= 0 ||
    source.height <= 0 ||
    target.width <= 0 ||
    target.height <= 0 ||
    !Number.isFinite(source.width) ||
    !Number.isFinite(source.height) ||
    !Number.isFinite(target.width) ||
    !Number.isFinite(target.height)
  ) {
    throw new RangeError('All source and target dimensions must be positive finite numbers');
  }

  const scale = Math.min(target.width / source.width, target.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  const x = (target.width - width) / 2;
  const y = (target.height - height) / 2;

  return { x, y, width, height, scale };
}

/**
 * Converts a normalized rectangle to pixel rectangle.
 */
export function normalizedRectToPixel(
  rect: Rect2D,
  canvas: Dimensions2D,
  snapToInteger = false
): Rect2D {
  const origin = toPixels({ x: rect.x, y: rect.y }, canvas, snapToInteger);
  const size = toPixels({ x: rect.width, y: rect.height }, canvas, snapToInteger);
  return {
    x: origin.x,
    y: origin.y,
    width: size.x,
    height: size.y,
  };
}

/**
 * Converts a pixel rectangle to normalized rectangle.
 */
export function pixelRectToNormalized(
  rect: Rect2D,
  canvas: Dimensions2D,
  clampBounds = true
): Rect2D {
  const origin = toNormalized({ x: rect.x, y: rect.y }, canvas, clampBounds);
  const w = rect.width / canvas.width;
  const h = rect.height / canvas.height;
  return {
    x: origin.x,
    y: origin.y,
    width: clampBounds ? clamp01(w) : w,
    height: clampBounds ? clamp01(h) : h,
  };
}

/**
 * Maps a local normalized point inside an embedded container to global canvas normalized coordinates.
 */
export function mapLocalToCanvasNormalized(
  localPoint: Point2D,
  containerRect: Rect2D
): Point2D {
  const clampedLocal = clampNormalized(localPoint);
  return {
    x: clamp01(containerRect.x + clampedLocal.x * containerRect.width),
    y: clamp01(containerRect.y + clampedLocal.y * containerRect.height),
  };
}

/**
 * Maps a global canvas normalized point to container-local normalized coordinates.
 */
export function mapCanvasToLocalNormalized(
  canvasPoint: Point2D,
  containerRect: Rect2D
): Point2D {
  if (containerRect.width <= 0 || containerRect.height <= 0) {
    throw new RangeError('Container rect must have positive width and height');
  }
  const u = (canvasPoint.x - containerRect.x) / containerRect.width;
  const v = (canvasPoint.y - containerRect.y) / containerRect.height;
  return {
    x: clamp01(u),
    y: clamp01(v),
  };
}

/**
 * Calculates Euclidean distance between two points in normalized space.
 */
export function distanceNormalized(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates Euclidean distance between two points in pixel space.
 */
export function distancePixel(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates the center point of a normalized rectangle.
 */
export function getRectCenterNormalized(rect: Rect2D): Point2D {
  return {
    x: clamp01(rect.x + rect.width / 2),
    y: clamp01(rect.y + rect.height / 2),
  };
}

/**
 * CoordinateMapper class providing static methods for OOP convenience.
 */
export class CoordinateMapper {
  public static clamp = clamp;
  public static clamp01 = clamp01;
  public static clampNormalized = clampNormalized;
  public static clampPixel = clampPixel;
  public static toPixels = toPixels;
  public static toNormalized = toNormalized;
  public static fitWithinBounds = fitWithinBounds;
  public static normalizedRectToPixel = normalizedRectToPixel;
  public static pixelRectToNormalized = pixelRectToNormalized;
  public static mapLocalToCanvasNormalized = mapLocalToCanvasNormalized;
  public static mapCanvasToLocalNormalized = mapCanvasToLocalNormalized;
  public static distanceNormalized = distanceNormalized;
  public static distancePixel = distancePixel;
  public static getRectCenterNormalized = getRectCenterNormalized;
}
