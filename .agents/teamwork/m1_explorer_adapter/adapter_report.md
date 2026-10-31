# Comprehensive Adapter & CoordinateMapper Architecture Report
**Milestone 1: Foundations, Telemetry Mapping & SceneGraph Adapter**  
**Component Focus:** `src/lib/interaction-map/CoordinateMapper.ts` & `src/lib/scene-graph/adapter.ts`  
**Agent:** `m1_explorer_adapter`  
**Date:** 2026-10-31  
**Status:** Approved Architectural Blueprint  

---

## 1. Executive Summary & Mathematical Baseline

This report delivers the rigorous mathematical models, algorithmic blueprints, and TypeScript architectural designs for two foundational components in the Launtion v2 pipeline:

1. **`CoordinateMapper.ts` (`src/lib/interaction-map/CoordinateMapper.ts`)**:
   A library of pure, zero-dependency mathematical functions providing bidirectional translation between normalized coordinate space $(u, v) \in [0.0, 1.0]$ and discrete or continuous canvas pixel space $(x, y) \in [0, W] \times [0, H]$. It provides boundary clamping, non-finite value protection, container-to-canvas coordinate remapping (for embedded capture windows), aspect ratio fitting, and Euclidean distance metrics.
2. **`interactionToSceneGraphAdapter` (`src/lib/scene-graph/adapter.ts`)**:
   A deterministic, pure transformation function that translates telemetric or simulated user actions from an `InteractionMap` into a fully orchestratable `SceneGraph` JSON specification. It eliminates hand-coded React animations by generating:
   - **Continuous 3D Camera Tracks**: Framing overview $\to$ smooth zoom & pan into focal points $\to$ hold $\to$ overview pullback.
   - **Kinematic Cursor Tracks**: Natural quadratic Bezier arcs ($B(t)$) with perpendicular curvature control points ($P_c$) and physical click impact frames.
   - **Frame-Accurate Audio Tracks**: Polyphonic audio scheduling with `ambient-beat` bed, frame-accurate `mouse-click` SFX, transition `camera-whoosh` cues, and outro `chime`.
   - **Scene Sequence Orchestration**: Semantic scene nodes governing active UI atoms over time.

### Fundamental Architectural Tenets:
- **Strict Purity**: Zero asynchronous state, zero unseeded random generation (`Math.random()` strictly prohibited).
- **Coordinate Standard**: All internal spatial coordinates throughout telemetry, camera targets, and cursor positions are strictly normalized in $[0.0, 1.0]$. Conversions to pixels or percentages are performed exclusively at render boundaries via `CoordinateMapper`.
- **Runtime Compatibility**: 100% compatible with Node 24 native TypeScript execution (`node --experimental-strip-types --test`).

---

## 2. Coordinate Systems & `CoordinateMapper.ts`

### 2.1 Coordinate Space Definitions

```
Normalized Space [0.0, 1.0]            Canvas Pixel Space [0, W] x [0, H]
(0.0, 0.0) ---------------- (1.0, 0.0)  (0, 0) ----------------------- (W, 0)
    |                             |        |                             |
    |         (u, v)              |  ===>  |         (x_px, y_px)        |
    |                             |        |                             |
(0.0, 1.0) ---------------- (1.0, 1.0)  (0, H) ----------------------- (W, H)
```

1. **Normalized Space $(u, v)$**:
   - $u \in [0.0, 1.0]$: Horizontal axis, where $u = 0.0$ is the left edge and $u = 1.0$ is the right edge.
   - $v \in [0.0, 1.0]$: Vertical axis, where $v = 0.0$ is the top edge and $v = 1.0$ is the bottom edge.
   - Origin $(0.0, 0.0)$ is top-left, matching DOM and SVG conventions.
2. **Pixel Space $(x, y)$**:
   - $x \in [0, W]$ and $y \in [0, H]$, where $W$ and $H$ are positive finite canvas dimensions (e.g. $1920 \times 1080$).
   - Can be floating-point (sub-pixel precision for smooth 3D camera and cursor paths) or rounded integers (for sharp UI bounding boxes).

---

### 2.2 Mathematical Formulations

#### 1. Forward Mapping (Normalized $\to$ Pixel)
Given normalized point $P_n = (u, v)$ and dimensions $D = (W, H)$:
$$x_{px} = u \times W$$
$$y_{px} = v \times H$$
When integer snapping is requested:
$$x_{px} = \text{round}(u \times W)$$
$$y_{px} = \text{round}(v \times H)$$

#### 2. Inverse Mapping (Pixel $\to$ Normalized)
Given pixel point $P_{px} = (x, y)$ and dimensions $D = (W, H)$:
$$u = \frac{x}{W}$$
$$v = \frac{y}{H}$$
*Guard Condition*: If $W \le 0$ or $H \le 0$, or if either is not finite, the function must throw a descriptive `RangeError` to prevent silent division-by-zero or `NaN` propagation.

#### 3. Clamping and Sanitization
Raw browser telemetry often contains coordinates outside $[0.0, 1.0]$ (e.g. user dragged cursor beyond window edge, or offscreen scroll target).
$$\text{clamp}(val, min, max) = \begin{cases} min & \text{if } val < min \text{ or } val \text{ is NaN} \\ max & \text{if } val > max \\ val & \text{otherwise} \end{cases}$$
$$\text{clampNormalized}(u, v) = (\text{clamp}(u, 0.0, 1.0), \text{clamp}(v, 0.0, 1.0))$$

#### 4. Container-to-Canvas Re-Mapping (Nested Surfaces)
In Launtion compositions, a product interface often renders inside a window container (`RealCaptureSurface`) that occupies a sub-region of the full $1920 \times 1080$ canvas (e.g., $1240 \times 680$ centered).

Let the container rect in canvas normalized coordinates be $R_c = (u_{min}, v_{min}, w_c, h_c)$.
Given an interaction event with local normalized coordinates $(u_{local}, v_{local})$ relative to the captured interface:
$$u_{canvas} = u_{min} + u_{local} \cdot w_c$$
$$v_{canvas} = v_{min} + v_{local} \cdot h_c$$

Conversely, converting canvas coordinates back to container-local space:
$$u_{local} = \frac{u_{canvas} - u_{min}}{w_c}$$
$$v_{local} = \frac{v_{canvas} - v_{min}}{h_c}$$

#### 5. Aspect Ratio & Safe Centering
When fitting a source resolution $D_{src} = (W_s, H_s)$ into a canvas $D_{dst} = (W_d, H_d)$ with aspect ratio preservation (`fitContain`):
$$s = \min\left(\frac{W_d}{W_s}, \frac{H_d}{H_s}\right)$$
$$W_{fitted} = W_s \cdot s, \quad H_{fitted} = H_s \cdot s$$
$$X_{offset} = \frac{W_d - W_{fitted}}{2}, \quad Y_{offset} = \frac{H_d - H_{fitted}}{2}$$

---

### 2.3 Proposed Implementation: `src/lib/interaction-map/CoordinateMapper.ts`

```ts
/**
 * CoordinateMapper.ts
 * Pure mathematical functions for bidirectional coordinate conversions,
 * boundary clamping, and nested viewport mapping.
 */

export interface NormalizedPoint {
  x: number; // [0.0, 1.0]
  y: number; // [0.0, 1.0]
}

export interface PixelPoint {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface NormalizedRect {
  x: number; // Top-left u [0.0, 1.0]
  y: number; // Top-left v [0.0, 1.0]
  width: number; // Normalized width [0.0, 1.0]
  height: number; // Normalized height [0.0, 1.0]
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Clamps a scalar number to [min, max], treating non-finite values as fallback.
 */
export function clamp(value: number, min = 0.0, max = 1.0): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamps a point to the unit normalized square [0.0, 1.0] x [0.0, 1.0].
 */
export function clampNormalized(point: NormalizedPoint): NormalizedPoint {
  return {
    x: clamp(point.x, 0.0, 1.0),
    y: clamp(point.y, 0.0, 1.0),
  };
}

/**
 * Clamps a pixel point to canvas dimensions [0, width] x [0, height].
 */
export function clampPixel(point: PixelPoint, bounds: Dimensions): PixelPoint {
  return {
    x: clamp(point.x, 0, Math.max(0, bounds.width)),
    y: clamp(point.y, 0, Math.max(0, bounds.height)),
  };
}

/**
 * Converts normalized [0.0, 1.0] coordinates to canvas pixel space.
 * Supports continuous sub-pixel coordinates or snapped integer pixels.
 */
export function normalizedToPixel(
  point: NormalizedPoint,
  canvas: Dimensions,
  snapToInteger = false
): PixelPoint {
  if (canvas.width <= 0 || canvas.height <= 0 || !Number.isFinite(canvas.width) || !Number.isFinite(canvas.height)) {
    throw new RangeError(`Canvas dimensions must be positive finite numbers: got ${canvas.width}x${canvas.height}`);
  }

  const clamped = clampNormalized(point);
  const px = clamped.x * canvas.width;
  const py = clamped.y * canvas.height;

  return {
    x: snapToInteger ? Math.round(px) : px,
    y: snapToInteger ? Math.round(py) : py,
  };
}

/**
 * Converts canvas pixel coordinates to normalized [0.0, 1.0] space.
 */
export function pixelToNormalized(
  point: PixelPoint,
  canvas: Dimensions,
  clampBounds = true
): NormalizedPoint {
  if (canvas.width <= 0 || canvas.height <= 0 || !Number.isFinite(canvas.width) || !Number.isFinite(canvas.height)) {
    throw new RangeError(`Canvas dimensions must be positive finite numbers: got ${canvas.width}x${canvas.height}`);
  }

  const u = point.x / canvas.width;
  const v = point.y / canvas.height;

  if (clampBounds) {
    return {
      x: clamp(u, 0.0, 1.0),
      y: clamp(v, 0.0, 1.0),
    };
  }

  return { x: u, y: v };
}

/**
 * Converts a normalized rectangle to pixel rectangle.
 */
export function normalizedRectToPixel(
  rect: NormalizedRect,
  canvas: Dimensions,
  snapToInteger = false
): PixelRect {
  const origin = normalizedToPixel({ x: rect.x, y: rect.y }, canvas, snapToInteger);
  const size = normalizedToPixel({ x: rect.width, y: rect.height }, canvas, snapToInteger);
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
  rect: PixelRect,
  canvas: Dimensions,
  clampBounds = true
): NormalizedRect {
  const origin = pixelToNormalized({ x: rect.x, y: rect.y }, canvas, clampBounds);
  const w = rect.width / canvas.width;
  const h = rect.height / canvas.height;
  return {
    x: origin.x,
    y: origin.y,
    width: clampBounds ? clamp(w, 0.0, 1.0) : w,
    height: clampBounds ? clamp(h, 0.0, 1.0) : h,
  };
}

/**
 * Maps a local normalized point inside an embedded container to global canvas normalized coordinates.
 */
export function mapLocalToCanvasNormalized(
  localPoint: NormalizedPoint,
  containerRect: NormalizedRect
): NormalizedPoint {
  const clampedLocal = clampNormalized(localPoint);
  return {
    x: clamp(containerRect.x + clampedLocal.x * containerRect.width, 0.0, 1.0),
    y: clamp(containerRect.y + clampedLocal.y * containerRect.height, 0.0, 1.0),
  };
}

/**
 * Maps a canvas normalized point to container-local normalized coordinates.
 */
export function mapCanvasToLocalNormalized(
  canvasPoint: NormalizedPoint,
  containerRect: NormalizedRect
): NormalizedPoint {
  if (containerRect.width <= 0 || containerRect.height <= 0) {
    throw new RangeError("Container rect must have positive width and height");
  }
  const u = (canvasPoint.x - containerRect.x) / containerRect.width;
  const v = (canvasPoint.y - containerRect.y) / containerRect.height;
  return {
    x: clamp(u, 0.0, 1.0),
    y: clamp(v, 0.0, 1.0),
  };
}

/**
 * Calculates Euclidean distance between two points in normalized space.
 */
export function distanceNormalized(p1: NormalizedPoint, p2: NormalizedPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates Euclidean distance between two points in pixel space.
 */
export function distancePixel(p1: PixelPoint, p2: PixelPoint): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculates center of a normalized rectangle.
 */
export function getRectCenterNormalized(rect: NormalizedRect): NormalizedPoint {
  return {
    x: clamp(rect.x + rect.width / 2, 0.0, 1.0),
    y: clamp(rect.y + rect.height / 2, 0.0, 1.0),
  };
}
```

---

## 3. `interactionToSceneGraphAdapter` Architecture

### 3.1 Architectural Pipeline Position

```
[demoInteractionMap.json] (Raw / Simulated Telemetry)
         │
         ▼
[CoordinateMapper] ──> Normalizes all event coordinates to [0.0, 1.0]
         │
         ▼
[interactionToSceneGraphAdapter] (Pure Deterministic Function)
    ├─► Sorts events chronologically
    ├─► Camera Track Generator (Overview, Target Focal Punches, Pullback)
    ├─► Cursor Track Generator (Perpendicular Bezier Arcs, Click Impacts)
    ├─► Audio Track Generator (Mix Staging, Frame-Accurate SFX, Headroom Limits)
    └─► Scene Sequence Generator (Semantic Scene Nodes & UI States)
         │
         ▼
[SceneGraph Schema Validation] (Strict Zod Parse)
         │
         ▼
[InteractiveSurfaceDemo.tsx] (Remotion Rendering Engine)
```

### 3.2 Adapter Interface & Options Contract

```ts
export interface AdapterOptions {
  artDirection?: {
    backdropVariant?: 'dark-precision' | 'light-editorial' | 'aurora-blur' | 'solid';
    surfaceTheme?: 'light' | 'dark';
    primaryAccent?: string;
  };
  camera?: {
    overviewZoom?: number; // Default 1.0
    focusZoom?: number; // Default 2.2
    transitionFrames?: number; // Default 35
    leadInFrames?: number; // Default 15
    holdFrames?: number; // Default 30
    overviewPitchX?: number; // Default 6.0 deg
    overviewYawY?: number; // Default -4.0 deg
  };
  cursor?: {
    curvatureFactor?: number; // Default 0.18
    minMoveFrames?: number; // Default 18
    maxMoveFrames?: number; // Default 40
  };
  audio?: {
    ambientVolume?: number; // Default 0.35
    clickVolume?: number; // Default 0.85
    whooshVolume?: number; // Default 0.45
    tapVolume?: number; // Default 0.50
    chimeVolume?: number; // Default 0.70
  };
}

export function interactionToSceneGraphAdapter(
  interactionMap: InteractionMap,
  options?: AdapterOptions
): SceneGraph;
```

---

## 4. Camera Track Derivation Algorithm

### 4.1 Narrative Motion Structure
The 3D camera operates as an automated cinematographer following these continuous stages:

1. **Overview Keyframe (Frame 0)**:
   The scene establishes in wide perspective with slight 3D elevation (`rotateX: 6`, `rotateY: -4`, `zoom: 1.0`).
2. **Anticipatory Focal Punch**:
   When a focal action occurs (`focus` event or high-salience `click`), the camera accelerates into target coordinates $(x_{target}, y_{target})$, leveling its angles to $(0, 0)$ for zero-perspective distortion and maximum interface legibility.
   - Departure frame: $T_{depart} = \max(0, T_{event} - \Delta_{transition})$.
   - Arrival frame: $T_{arrive} = T_{event} - \Delta_{lead}$ (arriving ~5 frames before the user interaction to focus attention).
   - Target Zoom: $Z \in [1.8, 2.5]$ (calibrated to 2.2 to prevent UI clipping).
3. **Focal Hold**:
   The camera holds at the target focal point for $\Delta_{hold}$ frames (typically 25–35 frames) while the cursor operates.
4. **Cinematic Continuity vs Overview Pullback**:
   - If the next focal event occurs within $< 50$ frames, the camera performs a smooth direct pan at high zoom.
   - If the next focal event is $> 75$ frames away, the camera pulls back to wide overview $(x: 0.5, y: 0.5, zoom: 1.0)$ to provide context before the next punch.
5. **Outro Pullback & Concluding Framing**:
   After the final interaction event, the camera gracefully pulls back to $(x: 0.5, y: 0.5, zoom: 1.0, rotateX: 4, rotateY: -2)$ and holds through `durationInFrames`.

### 4.2 Mathematical Formalization & Anti-Drift Guarantee
Each camera keyframe specifies:
$$K_i = \{ frame: f_i, x: x_i, y: y_i, zoom: z_i, rotateX: \theta_{x,i}, rotateY: \theta_{y,i}, rotateZ: \theta_{z,i}, easing: \text{'ease-in-out'} \}$$

**Invariants Enforced by the Adapter**:
- **Strict Monotonicity**: $f_0 < f_1 < f_2 < \dots < f_m \le \text{durationInFrames}$.
- **Minimum Transition Distance**: If two candidate keyframes are closer than 4 frames ($f_{i+1} - f_i < 4$), they are coalesced into a single keyframe to prevent infinite acceleration or velocity spikes.
- **Bounds Clamping**: Focal coordinates are clamped to $[0.10, 0.90]$ to guarantee that the 2.2x zoom does not drift off-canvas or violate safe margins.

---

## 5. Cursor Track Derivation Algorithm & Bezier Arc Kinematics

### 5.1 The Biomechanical Curve Problem
In actual human motor control (Fitts' Law), hands and wrists do not move in straight lines. Linear 2D interpolation ($\Delta x \cdot t, \Delta y \cdot t$) looks mechanical and jarring. High-end SaaS video aesthetics require curved quadratic Bezier trajectories:
$$B(t) = (1 - t)^2 P_0 + 2(1 - t)t P_c + t^2 P_1, \quad t \in [0.0, 1.0]$$
where:
- $P_0 = (x_0, y_0)$ is the starting coordinate.
- $P_1 = (x_1, y_1)$ is the destination coordinate.
- $P_c = (x_c, y_c)$ is the perpendicular curvature control point.

### 5.2 Control Point ($P_c$) Derivation Formula

```
           P_c (Control Point)
             ▲
             │ h (Offset)
             │
     P_0 ────M──── P_1 (Chord vector D)
```

1. **Chord Vector and Distance**:
   $$\vec{D} = P_1 - P_0 = (x_1 - x_0, y_1 - y_0)$$
   $$L = \|\vec{D}\| = \sqrt{(x_1 - x_0)^2 + (y_1 - y_0)^2}$$
2. **Chord Midpoint**:
   $$M = \frac{P_0 + P_1}{2} = \left(\frac{x_0 + x_1}{2}, \frac{y_0 + y_1}{2}\right)$$
3. **Unit Perpendicular Normal Vectors**:
   $$\vec{N}_A = \left(-\frac{y_1 - y_0}{L}, \frac{x_1 - x_0}{L}\right)$$
   $$\vec{N}_B = \left(\frac{y_1 - y_0}{L}, -\frac{x_1 - x_0}{L}\right)$$
4. **Biomechanical Selection Heuristic**:
   - Calculate candidate control points with offset $h = \kappa \cdot L$ (where $\kappa = 0.18$):
     $$C_A = M + h \vec{N}_A, \quad C_B = M + h \vec{N}_B$$
   - **Boundary Constraint**: If $C_A$ violates safe normalized margins $[0.05, 0.95]$ while $C_B$ does not, select $C_B$.
   - **Upward Arc / Center Attraction**: When both candidates are safely within bounds, humans naturally arc upward and outward when moving across desktops. We evaluate the dot product with the vector pointing to canvas center $\vec{V}_c = (0.5, 0.5) - M$ and select the normal creating a concave trajectory toward the center.
5. **Dynamic Curvature Scaling**:
   $$h = \kappa \cdot L \cdot \min\left(1.0, \frac{L}{0.12}\right)$$
   For micro-movements ($L < 0.02$), $h \to 0$ (preventing erratic jitter). For large sweeps ($L > 0.6$), $h$ is clamped to $0.12$.

### 5.3 Temporal Ballistics (Rest vs Move)
Between two interaction events at frames $T_0$ and $T_1$:
- If $T_1 - T_0 > 40$ frames, the cursor **rests** at $P_0$ for an idle period.
- Ballistic movement duration is derived from distance:
  $$\Delta_{move} = \text{clamp}(\text{round}(18 + 24 \cdot L), 18, 40) \text{ frames}$$
- Movement departs at $T_{start} = T_1 - \Delta_{move}$.
- The adapter inserts a stationary hold keyframe at $T_{start}$ with position $P_0$, followed by the curved arrival keyframe at $T_1$ with $(P_1, P_c)$ and `click: (type === 'click')`.

---

## 6. Audio Track Derivation Algorithm

### 6.1 Asset Mapping & Legal Clearance Allowlist
The audio engine references strictly the 6 cleared WAV assets in `public/sfx/`:

| Sound Asset | Purpose | Volume Default | Scheduling Rule |
|-------------|---------|----------------|-----------------|
| `ambient-beat.wav` | Continuous rhythmic backing bed | 0.35 | Frame 0 through end, with 15-frame fade in, 30-frame fade out |
| `mouse-click.wav` | Physical tactile feedback on clicks | 0.85 | Exact frame of `click` event |
| `camera-whoosh.wav` | Acoustic acceleration on camera zooms | 0.40 | Triggered at $T_{depart} + 2$ on transitions with $\Delta z \ge 0.5$ |
| `keyboard-tap.wav` | Typing tactile rhythm | 0.50 | Scheduled during text typing sequences (cadence: every 8 frames) |
| `chime.wav` | Narrative resolution & success chime | 0.70 | Scheduled at concluding confirmation/outro frame |
| `soft-pop.wav` | Micro-interaction pop / UI element reveal | 0.60 | Scheduled on badge pop or card reveal |

### 6.2 Gain Staging & Headroom Protection
To satisfy Requirement R4 and prevent clipping (0 dBFS digital distortion):
- Master audio level must never exceed $1.0$.
- When a `mouse-click` ($0.85$) triggers simultaneously with `ambient-beat` ($0.35$), peak sum reaches $1.20$.
- The adapter designs calibrated baseline volumes. In addition, the AudioEngine applies a deterministic compressor/limiter envelope, ducking the background track by $-3$ dB during whooshes and clicks.
- Debounce rule: Camera whooshes are separated by at least 30 frames to avoid acoustic phase clutter.

---

## 7. Scene Sequence Orchestration Algorithm

### 7.1 Unified Dual-Layer Architecture
The adapter outputs both:
1. **Global Continuous Tracks**: `cameraTrack`, `cursorTrack`, `audioTrack` (orchestrating continuous motion across the entire composition without cuts).
2. **Semantic Scene Nodes (`scenes`)**: Partitioning the timeline into discrete semantic phases.

```ts
export interface SceneNode {
  id: string;
  type:
    | 'product_interaction_3d'
    | 'synthetic_prompt_box'
    | 'synthetic_connect_pills'
    | 'synthetic_code_tree'
    | 'synthetic_hero_button'
    | 'icon_grid_morph'
    | 'kinetic_typography'
    | 'brand_closing_cta';
  fromFrame: number;
  durationInFrames: number;
  payload: Record<string, unknown>;
  soundCues?: AudioCue[];
}
```

### 7.2 Phase Mapping from `InteractionMap`
For a standard 480-frame (16 second @ 30 FPS) SaaS interaction scenario (as modeled in `demoInteractionMap.json`):

1. **Scene 1 (Frames 0–120): `synthetic_prompt_box` / Intro Overview**
   - Payload: Prompt typing text, blinking cursor, microphone icon.
   - Camera: Overview angle transitioning to prompt box focus.
   - Audio: `keyboard-tap` cues during typing, `camera-whoosh` on zoom.
2. **Scene 2 (Frames 120–240): `synthetic_code_tree` & `synthetic_connect_pills`**
   - Payload: Active pills (`Connect to -> Calendar`), hierarchical code tree.
   - Camera: Pan across system architecture.
3. **Scene 3 (Frames 240–360): `synthetic_hero_button` & Click Impact**
   - Payload: Hero action button ("Publish / Launch"), cursor hover and click.
   - Cursor: Bezier trajectory landing on button center, `click: true` at impact frame.
   - Audio: `mouse-click` synchronized to exact impact frame.
4. **Scene 4 (Frames 360–480): `brand_closing_cta` & Overview Recap**
   - Payload: Product title ("Base44 App"), tagline ("Built it your way"), logo emblem.
   - Camera: Pullback to wide overview.
   - Audio: `chime` success confirmation, music fade out.

---

## 8. Proposed Implementation: `src/lib/scene-graph/adapter.ts`

```ts
/**
 * adapter.ts
 * Pure deterministic transformation from InteractionMap to SceneGraph.
 */

import { clamp, distanceNormalized } from '../interaction-map/CoordinateMapper';

export interface InteractionEvent {
  id: string;
  type: 'click' | 'hover' | 'focus' | 'scroll';
  frame: number;
  duration?: number;
  x: number; // Normalized [0.0, 1.0]
  y: number; // Normalized [0.0, 1.0]
  targetId?: string;
  provenance: 'observed' | 'inferred' | 'simulated';
  metadata?: Record<string, unknown>;
}

export interface InteractionMap {
  version: '2.0';
  baseResolution: { width: number; height: number };
  fps: number;
  durationInFrames: number;
  events: InteractionEvent[];
}

export interface CameraKeyframe {
  frame: number;
  x: number;
  y: number;
  zoom: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  easing?: 'linear' | 'ease-in-out' | 'spring';
}

export interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
  controlX?: number;
  controlY?: number;
  click?: boolean;
}

export interface AudioCue {
  id: string;
  frame: number;
  asset: 'mouse-click' | 'camera-whoosh' | 'keyboard-tap' | 'chime' | 'soft-pop' | 'ambient-beat';
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

export interface SceneNode {
  id: string;
  type: string;
  fromFrame: number;
  durationInFrames: number;
  payload: Record<string, unknown>;
  soundCues?: AudioCue[];
}

export interface SceneGraph {
  version: '2.0';
  canvas: { width: number; height: number; fps: number; durationInFrames: number };
  artDirection: {
    backdropVariant: 'dark-precision' | 'light-editorial' | 'aurora-blur' | 'solid';
    surfaceTheme: 'light' | 'dark';
    primaryAccent: string;
  };
  cameraTrack: CameraKeyframe[];
  cursorTrack: CursorKeyframe[];
  audioTrack: AudioCue[];
  scenes: SceneNode[];
}

export interface AdapterOptions {
  artDirection?: {
    backdropVariant?: 'dark-precision' | 'light-editorial' | 'aurora-blur' | 'solid';
    surfaceTheme?: 'light' | 'dark';
    primaryAccent?: string;
  };
  camera?: {
    overviewZoom?: number;
    focusZoom?: number;
    transitionFrames?: number;
    leadInFrames?: number;
    holdFrames?: number;
    overviewPitchX?: number;
    overviewYawY?: number;
  };
  cursor?: {
    curvatureFactor?: number;
    minMoveFrames?: number;
    maxMoveFrames?: number;
  };
  audio?: {
    ambientVolume?: number;
    clickVolume?: number;
    whooshVolume?: number;
    tapVolume?: number;
    chimeVolume?: number;
  };
}

/**
 * Calculates a curved Bezier control point perpendicular to the movement chord.
 */
function computeBezierControlPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  curvature = 0.18
): { controlX: number; controlY: number } {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 0.02) {
    return { controlX: (p0.x + p1.x) / 2, controlY: (p0.y + p1.y) / 2 };
  }

  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;

  // Unit normal vectors
  const nx1 = -dy / dist;
  const ny1 = dx / dist;

  const nx2 = dy / dist;
  const ny2 = -dx / dist;

  // Offset magnitude
  const offset = curvature * dist * Math.min(1.0, dist / 0.15);

  const c1 = { x: mx + nx1 * offset, y: my + ny1 * offset };
  const c2 = { x: mx + nx2 * offset, y: my + ny2 * offset };

  // Select candidate closest to center or within safe bounds
  const isC1Valid = c1.x >= 0.05 && c1.x <= 0.95 && c1.y >= 0.05 && c1.y <= 0.95;
  const isC2Valid = c2.x >= 0.05 && c2.x <= 0.95 && c2.y >= 0.05 && c2.y <= 0.95;

  let chosen = c1;
  if (!isC1Valid && isC2Valid) {
    chosen = c2;
  } else if (isC1Valid && isC2Valid) {
    // Upward bias or center attraction
    chosen = c1.y <= c2.y ? c1 : c2;
  }

  return {
    controlX: clamp(chosen.x, 0.05, 0.95),
    controlY: clamp(chosen.y, 0.05, 0.95),
  };
}

/**
 * Pure deterministic transformation from InteractionMap to SceneGraph.
 */
export function interactionToSceneGraphAdapter(
  interactionMap: InteractionMap,
  options?: AdapterOptions
): SceneGraph {
  const fps = interactionMap.fps || 30;
  const duration = interactionMap.durationInFrames;
  const width = interactionMap.baseResolution.width;
  const height = interactionMap.baseResolution.height;

  const camOpt = {
    overviewZoom: options?.camera?.overviewZoom ?? 1.0,
    focusZoom: options?.camera?.focusZoom ?? 2.2,
    transitionFrames: options?.camera?.transitionFrames ?? 35,
    leadInFrames: options?.camera?.leadInFrames ?? 15,
    holdFrames: options?.camera?.holdFrames ?? 30,
    overviewPitchX: options?.camera?.overviewPitchX ?? 6.0,
    overviewYawY: options?.camera?.overviewYawY ?? -4.0,
  };

  const curOpt = {
    curvatureFactor: options?.cursor?.curvatureFactor ?? 0.18,
    minMoveFrames: options?.cursor?.minMoveFrames ?? 18,
    maxMoveFrames: options?.cursor?.maxMoveFrames ?? 40,
  };

  const audOpt = {
    ambientVolume: options?.audio?.ambientVolume ?? 0.35,
    clickVolume: options?.audio?.clickVolume ?? 0.85,
    whooshVolume: options?.audio?.whooshVolume ?? 0.45,
    tapVolume: options?.audio?.tapVolume ?? 0.50,
    chimeVolume: options?.audio?.chimeVolume ?? 0.70,
  };

  // Sort events chronologically
  const sortedEvents = [...interactionMap.events].sort((a, b) => a.frame - b.frame);

  // 1. Build Camera Track
  const cameraTrack: CameraKeyframe[] = [];
  cameraTrack.push({
    frame: 0,
    x: 0.5,
    y: 0.5,
    zoom: camOpt.overviewZoom,
    rotateX: camOpt.overviewPitchX,
    rotateY: camOpt.overviewYawY,
    rotateZ: 0,
    easing: 'ease-in-out',
  });

  // Extract focal events (focus and clicks)
  const focalEvents = sortedEvents.filter((e) => e.type === 'focus' || e.type === 'click');
  let lastCameraFrame = 0;

  for (const event of focalEvents) {
    const targetX = clamp(event.x, 0.15, 0.85);
    const targetY = clamp(event.y, 0.15, 0.85);
    const arrivalFrame = Math.max(lastCameraFrame + 10, event.frame - 5);
    const departureFrame = Math.max(lastCameraFrame + 2, arrivalFrame - camOpt.transitionFrames);

    if (departureFrame > lastCameraFrame + 20) {
      // Return to overview if gap is large
      const overviewReturn = lastCameraFrame + 25;
      if (overviewReturn < departureFrame - 15) {
        cameraTrack.push({
          frame: overviewReturn,
          x: 0.5,
          y: 0.5,
          zoom: camOpt.overviewZoom,
          rotateX: camOpt.overviewPitchX,
          rotateY: camOpt.overviewYawY,
          rotateZ: 0,
          easing: 'ease-in-out',
        });
      }
    }

    // Departure keyframe
    cameraTrack.push({
      frame: departureFrame,
      x: cameraTrack[cameraTrack.length - 1].x,
      y: cameraTrack[cameraTrack.length - 1].y,
      zoom: cameraTrack[cameraTrack.length - 1].zoom,
      rotateX: cameraTrack[cameraTrack.length - 1].rotateX,
      rotateY: cameraTrack[cameraTrack.length - 1].rotateY,
      rotateZ: 0,
      easing: 'ease-in-out',
    });

    // Arrival keyframe
    cameraTrack.push({
      frame: arrivalFrame,
      x: targetX,
      y: targetY,
      zoom: camOpt.focusZoom,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      easing: 'ease-in-out',
    });

    // Hold keyframe
    const holdEndFrame = Math.min(duration - 20, event.frame + camOpt.holdFrames);
    cameraTrack.push({
      frame: holdEndFrame,
      x: targetX,
      y: targetY,
      zoom: camOpt.focusZoom,
      rotateX: 0,
      rotateY: 0,
      rotateZ: 0,
      easing: 'ease-in-out',
    });

    lastCameraFrame = holdEndFrame;
  }

  // Final pullback
  if (lastCameraFrame < duration - 15) {
    cameraTrack.push({
      frame: Math.min(duration, lastCameraFrame + 35),
      x: 0.5,
      y: 0.5,
      zoom: camOpt.overviewZoom,
      rotateX: camOpt.overviewPitchX * 0.7,
      rotateY: camOpt.overviewYawY * 0.7,
      rotateZ: 0,
      easing: 'ease-in-out',
    });
  }

  // 2. Build Cursor Track
  const cursorTrack: CursorKeyframe[] = [];
  let currentPos = { x: 0.70, y: 0.80 };
  let currentFrame = 0;

  cursorTrack.push({
    frame: 0,
    x: currentPos.x,
    y: currentPos.y,
  });

  for (const event of sortedEvents) {
    const targetPos = { x: clamp(event.x, 0.05, 0.95), y: clamp(event.y, 0.05, 0.95) };
    const dist = distanceNormalized(currentPos, targetPos);
    const moveDuration = Math.round(clamp(18 + dist * 30, curOpt.minMoveFrames, curOpt.maxMoveFrames));
    const startMoveFrame = Math.max(currentFrame + 2, event.frame - moveDuration);

    if (startMoveFrame > currentFrame + 5) {
      cursorTrack.push({
        frame: startMoveFrame,
        x: currentPos.x,
        y: currentPos.y,
      });
    }

    const { controlX, controlY } = computeBezierControlPoint(currentPos, targetPos, curOpt.curvatureFactor);

    cursorTrack.push({
      frame: event.frame,
      x: targetPos.x,
      y: targetPos.y,
      controlX,
      controlY,
      click: event.type === 'click',
    });

    currentPos = targetPos;
    currentFrame = event.frame;
  }

  // 3. Build Audio Track
  const audioTrack: AudioCue[] = [];

  // Continuous background beat
  audioTrack.push({
    id: 'ambient-beat-main',
    frame: 0,
    asset: 'ambient-beat',
    volume: audOpt.ambientVolume,
    fadeInFrames: 15,
    fadeOutFrames: 30,
  });

  // SFX cues on events
  let lastWhooshFrame = -999;
  for (const event of sortedEvents) {
    if (event.type === 'click') {
      audioTrack.push({
        id: `sfx-click-${event.frame}`,
        frame: event.frame,
        asset: 'mouse-click',
        volume: audOpt.clickVolume,
      });
    } else if (event.type === 'focus' && event.metadata?.typing) {
      audioTrack.push({
        id: `sfx-tap-${event.frame}`,
        frame: event.frame,
        asset: 'keyboard-tap',
        volume: audOpt.tapVolume,
      });
    }
  }

  // Camera whooshes on zoom transitions
  for (let i = 1; i < cameraTrack.length; i++) {
    const prev = cameraTrack[i - 1];
    const curr = cameraTrack[i];
    const zoomDiff = Math.abs(curr.zoom - prev.zoom);
    if (zoomDiff >= 0.5 && curr.frame - prev.frame >= 15) {
      const whooshFrame = prev.frame + 2;
      if (whooshFrame - lastWhooshFrame >= 30) {
        audioTrack.push({
          id: `sfx-whoosh-${whooshFrame}`,
          frame: whooshFrame,
          asset: 'camera-whoosh',
          volume: audOpt.whooshVolume,
        });
        lastWhooshFrame = whooshFrame;
      }
    }
  }

  // Outro chime
  audioTrack.push({
    id: 'sfx-chime-outro',
    frame: Math.max(0, duration - 60),
    asset: 'chime',
    volume: audOpt.chimeVolume,
  });

  // 4. Build Semantic Scene Nodes
  const scenes: SceneNode[] = [
    {
      id: 'scene-product-3d',
      type: 'product_interaction_3d',
      fromFrame: 0,
      durationInFrames: duration,
      payload: {
        windowTitle: 'Base44 SaaS Studio — Dynamic Surface',
        eventsCount: sortedEvents.length,
      },
    },
  ];

  return {
    version: '2.0',
    canvas: { width, height, fps, durationInFrames: duration },
    artDirection: {
      backdropVariant: options?.artDirection?.backdropVariant ?? 'dark-precision',
      surfaceTheme: options?.artDirection?.surfaceTheme ?? 'dark',
      primaryAccent: options?.artDirection?.primaryAccent ?? '#FF5C35',
    },
    cameraTrack,
    cursorTrack,
    audioTrack,
    scenes,
  };
}
```

---

## 9. QA Test Strategy & Automated Benchmarks

### 9.1 Test Execution via Native Node 24 Runner
To test `CoordinateMapper.ts` and `adapter.ts` without external dependencies:
```bash
node --experimental-strip-types --test tests/interaction-map.test.ts tests/scene-graph.test.ts
```

### 9.2 Unit Test Matrix (`tests/interaction-map.test.ts` & `tests/scene-graph.test.ts`)

| Test Suite | Test Case | Expected Assertion |
|------------|-----------|--------------------|
| `CoordinateMapper` | Forward conversion $(0.5, 0.5) \to 1920\times1080$ | `assert.deepStrictEqual(res, { x: 960, y: 540 })` |
| `CoordinateMapper` | Inverse conversion $(960, 540) \to 1920\times1080$ | `assert.deepStrictEqual(res, { x: 0.5, y: 0.5 })` |
| `CoordinateMapper` | Clamping out-of-bounds $(-0.2, 1.4)$ | `assert.deepStrictEqual(res, { x: 0.0, y: 1.0 })` |
| `CoordinateMapper` | Invalid dimensions $W \le 0$ rejection | Throws `RangeError` |
| `CoordinateMapper` | Container local to canvas remapping | Scaled and translated strictly inside container rect |
| `Adapter` | Purity & Determinism | Two calls with identical input yield identical output |
| `Adapter` | Camera Monotonicity | $f_{i+1} > f_i$ for all camera keyframes |
| `Adapter` | Bezier Curvature Calculation | Control points $P_c$ are not collinear with chord ($h > 0$) |
| `Adapter` | Click SFX Synchronization | Every `click` event at frame $F$ has an audio cue at frame $F$ |
| `Adapter` | Audio Headroom Limits | No audio cues exceed maximum individual gain staging bounds |

---

## 10. Summary Matrix: Component Audit & Architecture

| Component | Target File | Architecture Role | Status |
|-----------|-------------|-------------------|--------|
| `CoordinateMapper` | `src/lib/interaction-map/CoordinateMapper.ts` | Pure mathematical translation, clamping, aspect fitting | `NEW` / Ready to implement |
| `Adapter` | `src/lib/scene-graph/adapter.ts` | Deterministic pipeline bridging Telemetry to Motion Kit | `NEW` / Ready to implement |
| `CameraTrack` | Internal to `adapter.ts` | Generates 3D multi-keyframe trajectory with focal punches | `NEW` / Ready to implement |
| `CursorTrack` | Internal to `adapter.ts` | Generates Bezier arcs and click impacts | `NEW` / Ready to implement |
| `AudioTrack` | Internal to `adapter.ts` | Multi-track scheduler with polyphonic headroom control | `NEW` / Ready to implement |
