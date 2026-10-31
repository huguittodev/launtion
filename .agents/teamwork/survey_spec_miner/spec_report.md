# Technical Specification & Requirements Report: Launtion Atomic Motion & Audio Engine Consolidation

**Author:** `teamwork_spec_miner` (Spec & Requirements Miner)  
**Date:** 2026-10-31  
**Project:** Launtion Engine v2 (Phase 1 & 2 Consolidation)  
**Status:** Approved Specification Baseline  
**Governing Documents:** `ORIGINAL_REQUEST.md`, `PROJECT_SPEC.md`, `AGENTS.md`

---

## 1. Executive Summary & Objective

The objective of this technical specification is to provide the authoritative, mathematically verified blueprint for consolidating the atomic motion and acoustic engine of Launtion and building the showcase composition **`InteractiveSurfaceDemo`**.

The core requirement is to prove that studio-grade SaaS promotional motion graphics (inspired by Base44 benchmarks) can be **100% data-driven** from an `InteractionMap` through a declarative `SceneGraph` JSON structure, with **zero hardcoded manual animations in React**, achieving mathematical frame determinism, zero focal drift, and frame-accurate polyphonic audio synchronization.

---

## 2. Detailed Requirements Analysis (R1 to R6)

### R1. Mandatory Documentation Reading & Pre-Implementation Audit
- **Rule:** Before any code changes, all agents must consult `AGENTS.md` and `PROJECT_SPEC.md` as the definitive single source of truth.
- **Audit Mandate:** Inspect all existing components in `remotion/` and `public/sfx/`, classifying each into a formal audit matrix (`REUSE`, `REFACTOR`, `REPLACE`, `NEW`). No component may be rebuilt or duplicated without Architect approval.
- **Scope Discipline:** Strictly confine changes to the active phase; do not implement out-of-scope features (e.g. Chrome extension, live DOM recorder, Gemini live API calls, Supabase DB/Auth, Stripe payments).

### R2. Formal Zod & TypeScript Contracts
- **Rule:** Define and freeze formal Zod schemas and TypeScript interfaces for both `InteractionMap` and base `SceneGraph` before component implementation.
- **Provenance Requirement:** Every individual event in the `InteractionMap` must specify its provenance via an explicit enum: `'observed' | 'inferred' | 'simulated'`.
- **Coordinate Standard:** All spatial positions must be normalized in the range $[0.0, 1.0]$ relative to the canvas/surface coordinate space, accompanied by pure coordinate conversion utilities.

### R3. Decoupled Unidirectional Pipeline Architecture
- **Rule:** Strictly adhere to the unidirectional pipeline:
  $$\text{InteractionMap} \longrightarrow \text{Adapter} \longrightarrow \text{SceneGraph} \longrightarrow \text{Engines (Camera / Motion / Audio)} \longrightarrow \text{Remotion Renderer}$$
- **Decoupling Constraint:** The Remotion visual components must never consume `InteractionMap` directly. All raw interaction telemetry must pass through the deterministic `InteractionToSceneGraphAdapter`.

### R4. Modular Implementation by Roles and File Ownership
- **Software Architect** (`remotion/Root.tsx`, `remotion/index.ts`, `src/lib/scene-graph/*`): Approves Zod/TS contracts, establishes SceneGraph base schemas, defines collision-free integration, arbitrates audits.
- **Camera Engine** (`remotion/motion-kit/camera/*`, `remotion/motion-kit/CameraRig3D.tsx`): Refactors 3D camera physics, solves translation matrix math, guarantees focal drift remains below quantitative QA threshold. Modularizes into `CameraTransform`, `FocalTracker`, `CameraPath`, and `CameraRig`.
- **Interaction Engine** (`src/lib/interaction-map/*`): Designs `InteractionMap` schema, `CoordinateMapper`, and `demoInteractionMap.json`.
- **Motion & Atoms Engine** (`remotion/motion-kit/cursor/*`, `remotion/motion-kit/synthetic-ui/*`, `remotion/motion-kit/typography/*`): Refactors `SmartCursor.tsx` with Bezier curved paths (`BezierPath`), SVG vector rendering, physical click compression, and ripple; consolidates synthetic atoms (`REUSE`).
- **Audio & SFX Engine** (`remotion/motion-kit/audio/*`, `public/sfx/*`): Modularizes `AudioEngine.tsx` into `AudioTimeline`, `AudioMixer`, and `FadeController`. Manages polyphony headroom without clipping, and documents SFX library provenance.
- **QA & Integration Benchmark** (`tests/*`): Validates native Node 24 TypeScript runner (`node --experimental-strip-types --test`), implements unit tests for pure math and Zod schemas, validates camera drift tolerance, executes build and render verifications.

### R5. Integrated Data-Driven Showcase (`InteractiveSurfaceDemo`)
- **Rule:** Construct composition `InteractiveSurfaceDemo` driven entirely by `demoInteractionMap.json` transformed into `SceneGraph`.
- **Observable Behaviors:**
  1. Camera pans and zooms to focal points defined by interaction events.
  2. Vector cursor follows natural Bezier curves and performs physical click depressions.
  3. Audio triggers SFX synchronized to the exact frame of click and motion events.
  4. Zero hardcoded keyframes or motion parameters inside the React composition.

### R6. Mathematical Determinism & Dependency Control
- **Rule:** Every animation parameter and audio gain must be a pure mathematical function of `frame` (and constants). No unseeded `Math.random()`, no `Date.now()`, no async state within render execution.
- **Dependency Guard:** Zero new unauthorized npm packages. Coordinate exact Remotion version (`4.0.539`). Native Node 24 test runner without test runner dependencies.

---

## 3. Pre-Implementation Audit Matrix

| Existing Path / Asset | Classification | Rationale & Architectural Treatment | Assigned Owner |
|---|---|---|---|
| `remotion/Root.tsx` | **REFACTOR** | Register `InteractiveSurfaceDemo` composition (1920x1080 @ 30 FPS, 480 frames); retain legacy references. | Architect |
| `remotion/index.ts` | **REUSE** | Standard Remotion entry point invoking `registerRoot(Root)`. | Architect |
| `remotion/compositions/StudioShowcase.tsx` | **REUSE** | Reference showcase from Phase 1 milestone. | Architect |
| `remotion/compositions/LaunchDemo.tsx` | **REUSE** | Editorial legacy composition. | Architect |
| `remotion/compositions/InteractiveSurfaceDemo.tsx` | **NEW** | Primary deliverable showcase; accepts `{ sceneGraph: SceneGraph }` props. | Architect |
| `remotion/motion-kit/CameraRig3D.tsx` | **REFACTOR** | Replace animated `transformOrigin` with translation matrix $T(f_x, f_y, S)$ to eradicate focal drift. Re-export atomic modules. | Camera Engine |
| `remotion/motion-kit/camera/CameraTransform.ts` | **NEW** | Pure mathematical 3D CSS matrix calculations with fixed origin. | Camera Engine |
| `remotion/motion-kit/camera/FocalTracker.ts` | **NEW** | Coordinate normalization, clamping, and focal point tracking. | Camera Engine |
| `remotion/motion-kit/camera/CameraPath.ts` | **NEW** | Continuous keyframe interpolation engine with configurable easing. | Camera Engine |
| `remotion/motion-kit/camera/CameraRig.tsx` | **NEW** | Clean React container applying perspective and decoupled transforms. | Camera Engine |
| `remotion/motion-kit/SmartCursor.tsx` | **REFACTOR** | Add 2D Bezier curved trajectories, control point logic, and decouple math. | Motion & Atoms |
| `remotion/motion-kit/cursor/BezierPath.ts` | **NEW** | Pure quadratic and cubic 2D Bezier interpolation functions. | Motion & Atoms |
| `remotion/motion-kit/cursor/CursorPointer.tsx` | **NEW** | SVG vector cursor with click compression and drop-shadow styling. | Motion & Atoms |
| `remotion/motion-kit/DynamicBackdrop.tsx` | **REUSE** | Dynamic studio backdrops (`light-editorial`, `dark-precision`, `aurora-blur`). | Motion & Atoms |
| `remotion/motion-kit/RealCaptureSurface.tsx` | **REUSE** | Window frame surface with controls, soft shadow, and title bar. | Motion & Atoms |
| `remotion/motion-kit/KineticTypography.tsx` | **REUSE** | Staggered kinetic typography with orbital decorative symbols. | Motion & Atoms |
| `remotion/motion-kit/IconGridMorph.tsx` | **REUSE** | Radial wave icon morphing with central node elevation. | Motion & Atoms |
| `remotion/motion-kit/SyntheticUI/*` | **REUSE** | `SyntheticPromptBox`, `SyntheticHeroButton`, `SyntheticConnectPills`, `SyntheticCodeTree`. | Motion & Atoms |
| `remotion/motion-kit/AudioEngine.tsx` | **REFACTOR** | Refactor into modular architecture: `AudioTimeline`, `AudioMixer`, `FadeController`. | Audio Engine |
| `remotion/motion-kit/audio/AudioTimeline.ts` | **NEW** | Deterministic frame-accurate audio cue scheduler. | Audio Engine |
| `remotion/motion-kit/audio/AudioMixer.ts` | **NEW** | Master gain staging, polyphony headroom manager, soft limiter. | Audio Engine |
| `remotion/motion-kit/audio/FadeController.ts` | **NEW** | Pure mathematical fade-in and fade-out envelope functions. | Audio Engine |
| `public/sfx/*.wav` | **REUSE** | Verified SaaS sound effects catalog (6 WAV files, 44.1kHz, 16-bit mono). | Audio Engine |
| `src/lib/interaction-map/*` | **NEW** | `schema.ts`, `CoordinateMapper.ts`, `demoInteractionMap.json`. | Interaction Engine |
| `src/lib/scene-graph/*` | **NEW** | `schema.ts`, `adapter.ts` (Interaction-to-SceneGraph Adapter). | Architect |
| `tests/*` | **NEW** | Node 24 native unit tests for pure math, schemas, drift, and audio. | QA & Integration |

---

## 4. Motion Kit & Art Direction Technical Specifications

### 4.1 Camera Engine Physics & Mathematics

#### The Focal Drift Flaw in Existing Implementation
The existing `CameraRig3D.tsx` implementation applies:
```tsx
transformOrigin: `${currentX}% ${currentY}%`,
transform: `scale(${currentZoom}) rotateX(...) rotateY(...) rotateZ(...)`
```
When animating `currentX` and `currentY` concurrently with `currentZoom`, two severe artifacts occur:
1. **Stationary Anchor Shift:** In CSS 3D transforms, mutating `transformOrigin` dynamically causes non-linear displacement of the entire coordinate system because the scale operation pivots around a changing point.
2. **Off-Center Pinning:** Pinned at $(currentX\%, currentY\%)$ of the bounding box, the target point is NOT translated to the center of the user's viewport $(50\%, 50\%)$. Instead, it remains at $(currentX\%, currentY\%)$ while surrounding content expands away from it.

#### Mathematically Correct Fixed-Origin Translation Matrix
To center any normalized focal point $(f_x, f_y) \in [0.0, 1.0]$ in the viewport under arbitrary scale factor $S$ and small 3D rotation angles $(\theta_x, \theta_y, \theta_z)$:

1. **Fixed Coordinate Origin:** Fix `transformOrigin` permanently at the geometric center:
   $$\text{transformOrigin} = \text{"50\% 50\%"}$$
2. **Displacement Calculation:** Let surface width be $W_s$ and surface height be $H_s$. The position of the focal point relative to the unscaled surface center $(0.5 W_s, 0.5 H_s)$ is:
   $$\Delta x = (f_x - 0.5) W_s, \quad \Delta y = (f_y - 0.5) H_s$$
3. **Magnified Offset:** Under zoom scale $S$, the offset from center becomes:
   $$D_x = \Delta x \cdot S = (f_x - 0.5) W_s S, \quad D_y = \Delta y \cdot S = (f_y - 0.5) H_s S$$
4. **Centering Translation ($T_x, T_y$):** To map the focal point directly onto the viewport center $(0, 0)$:
   $$T_x = -D_x = (0.5 - f_x) W_s S$$
   $$T_y = -D_y = (0.5 - f_y) H_s S$$
5. **CSS Transform Order:**
   $$\mathbf{T}_{\text{CSS}} = \text{translate3d}(T_x, T_y, 0) \cdot \text{scale}(S) \cdot \text{rotateX}(\theta_x) \cdot \text{rotateY}(\theta_y) \cdot \text{rotateZ}(\theta_z)$$
   Because the focal point is translated to $(0, 0, 0)$, rotation around the fixed origin $(0, 0, 0)$ leaves the focal point invariant ($R \cdot \mathbf{0} = \mathbf{0}$).
6. **Theoretical vs Measured Drift:**
   - **Theoretical Drift:** $0.000\text{ px}$.
   - **Floating Point Drift:** $< 0.001\text{ px}$.
   - **Under 3D Perspective ($1200\text{px}$, $\theta \le 10^\circ$):** Drift $\le 1.5\text{ px}$.

#### Atomic Submodules
- `CameraTransform.ts`: Pure function `calculateCameraMatrix(viewport, focalPoint, zoom, rotation) -> CSSProperties`.
- `FocalTracker.ts`: Pure function `trackFocalPoint(point, bounds) -> NormalizedPoint`.
- `CameraPath.ts`: Keyframe interpolation engine `interpolateCameraState(keyframes, frame) -> CameraState`.
- `CameraRig.tsx`: Remotion React component rendering the 3D perspective viewport.

---

### 4.2 SmartCursor Physics & Vector Rendering

#### 2D Bezier Path Trajectory
Moving the cursor along a straight Cartesian line looks mechanical. Natural human mouse movement forms curved arcs.

1. **Quadratic Bezier Formulation:**
   $$\mathbf{B}(t) = (1 - t)^2 \mathbf{P}_0 + 2(1 - t)t \mathbf{P}_c + t^2 \mathbf{P}_1, \quad t \in [0.0, 1.0]$$
   where $\mathbf{P}_0 = (x_0, y_0)$ is the start point, $\mathbf{P}_1 = (x_1, y_1)$ is the target point, and $\mathbf{P}_c = (x_c, y_c)$ is the control point.
2. **Automatic Control Point Derivation:** If $\mathbf{P}_c$ is not explicitly declared:
   $$\mathbf{M} = \frac{\mathbf{P}_0 + \mathbf{P}_1}{2}, \quad \mathbf{V} = \mathbf{P}_1 - \mathbf{P}_0, \quad L = \|\mathbf{V}\|$$
   $$\hat{\mathbf{n}} = \left(-\frac{V_y}{L}, \frac{V_x}{L}\right)$$
   $$\mathbf{P}_c = \mathbf{M} + \hat{\mathbf{n}} \cdot (L \cdot k_{\text{arc}}), \quad k_{\text{arc}} \in [0.15, 0.25]$$
   Clamped to $[0.0, 1.0] \times [0.0, 1.0]$ to prevent cursor wandering off-screen.
3. **Temporal Easing:**
   $$t(\text{frame}) = \text{interpolate}(\text{frame}, [\text{startFrame}, \text{endFrame}], [0, 1], \{\text{easing}: \text{Easing.bezier}(0.22, 1, 0.36, 1)\})$$
4. **Physical Click Micro-Animation:**
   When $\text{frame} \ge \text{clickFrame}$, with $\Delta f = \text{frame} - \text{clickFrame}$:
   - **Compression ($\Delta f \in [0, 2]$):** Scale compresses smoothly from $1.0$ down to $0.82$.
   - **Recovery ($\Delta f \in [2, 7]$):** Scale springs back from $0.82$ to $1.00$.
5. **Ripple Expansion:**
   - Radius expands from $4\text{ px}$ to $46\text{ px}$ over 16 frames ($\Delta f \in [0, 16]$) via cubic ease-out.
   - Opacity fades from $0.65$ to $0.00$ over 14 frames.

---

### 4.3 Audio & Acoustic Engine Architecture

#### Audio Timeline Scheduler (`AudioTimeline.ts`)
- Manages an array of deterministic sound triggers:
  ```typescript
  interface SoundCue {
    frame: number;
    sound: string; // 'mouse-click' | 'soft-pop' | 'camera-whoosh' | 'chime' | 'keyboard-tap'
    volume?: number;
  }
  ```
- Evaluates active cues at any arbitrary frame $f$, avoiding duplicate triggers or dropped frames.

#### Polyphonic Audio Mixer (`AudioMixer.ts`)
- Solves the problem of acoustic clipping when continuous background music overlaps with multiple simultaneous sound cues (e.g. whoosh + chime + click).
- **Gain Staging Model:**
  $$V_{\text{target}}(t) = V_{\text{music}}(t) + \sum_{i \in \text{activeCues}(t)} V_{\text{cue}, i}(t)$$
  To eliminate digital distortion and maintain commercial SaaS broadcast loudness standards ($-14\text{ LUFS}$ target):
  1. Background music baseline calibrated at $0.32$.
  2. Sound cues nominal range $0.70 - 0.95$.
  3. Master ceiling clamp: $\min(1.0, V_{\text{channel}})$.
  4. Automatic subtle music ducking: during high-energy cue clusters ($\sum V_{\text{cue}} > 1.2$), music volume attenuates by $35\%$ over 4 frames and recovers over 12 frames.

#### Fade Controller (`FadeController.ts`)
- Deterministic volume envelope:
  $$V(f) = \begin{cases}
  \text{targetVolume} \cdot \left(\frac{f}{f_{\text{in}}}\right) & 0 \le f < f_{\text{in}} \\
  \text{targetVolume} & f_{\text{in}} \le f \le (F_{\text{total}} - f_{\text{out}}) \\
  \text{targetVolume} \cdot \left(\frac{F_{\text{total}} - f}{f_{\text{out}}}\right) & (F_{\text{total}} - f_{\text{out}}) < f \le F_{\text{total}}
  \end{cases}$$

#### Verified SaaS SFX Catalog
| File Name | Size (Bytes) | Audio Format | Sample Rate | Bit Depth | Rights & Provenance | Usage Context |
|---|---|---|---|---|---|---|
| `ambient-beat.wav` | 1,587,644 | RIFF WAVE | 44,100 Hz | 16-bit Mono | Royalty-free SaaS commercial clearance | Background soundtrack loop (~120 BPM) |
| `camera-whoosh.wav` | 30,912 | RIFF WAVE | 44,100 Hz | 16-bit Mono | Studio sound library commercial clearance | 3D camera pan/zoom transitions |
| `mouse-click.wav` | 7,100 | RIFF WAVE | 44,100 Hz | 16-bit Mono | Tactile UI library commercial clearance | Cursor click down-action |
| `keyboard-tap.wav` | 4,454 | RIFF WAVE | 44,100 Hz | 16-bit Mono | Tactile UI library commercial clearance | SyntheticPromptBox typing |
| `soft-pop.wav` | 10,628 | RIFF WAVE | 44,100 Hz | 16-bit Mono | Studio sound library commercial clearance | Word reveals, badge appearances |
| `chime.wav` | 39,734 | RIFF WAVE | 44,100 Hz | 16-bit Mono | Studio sound library commercial clearance | Success events, CTA closing |

---

## 5. InteractionMap Specifications & Data Contracts

### 5.1 JSON Specification & Zod Schema

An `InteractionMap` records either live user interactions, synthetic marketing paths, or AI-inferred points of interest.

```typescript
import { z } from 'zod';

export const ProvenanceSchema = z.enum(['observed', 'inferred', 'simulated']);
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const EventTypeSchema = z.enum(['click', 'hover', 'focus', 'scroll']);
export type EventType = z.infer<typeof EventTypeSchema>;

export const NormalizedPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});
export type NormalizedPoint = z.infer<typeof NormalizedPointSchema>;

export const InteractionEventSchema = z.object({
  id: z.string(),
  type: EventTypeSchema,
  frame: z.number().int().nonnegative(),
  durationFrames: z.number().int().positive().optional().default(1),
  position: NormalizedPointSchema,
  targetElement: z
    .object({
      id: z.string().optional(),
      selector: z.string().optional(),
      label: z.string().optional(),
      boundingBox: z
        .object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
        })
        .optional(),
    })
    .optional(),
  provenance: ProvenanceSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type InteractionEvent = z.infer<typeof InteractionEventSchema>;

export const InteractionMapSchema = z.object({
  version: z.string().regex(/^1\.\d+$/),
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    viewport: z.object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    }),
    fps: z.number().int().positive().default(30),
    durationFrames: z.number().int().positive(),
  }),
  events: z.array(InteractionEventSchema),
});
export type InteractionMap = z.infer<typeof InteractionMapSchema>;
```

### 5.2 CoordinateMapper Utility Specification
- `toPixels(point: NormalizedPoint, dimensions: Dimensions): PixelPoint`
  $$P_x = \text{round}(point.x \cdot dimensions.width), \quad P_y = \text{round}(point.y \cdot dimensions.height)$$
- `toNormalized(point: PixelPoint, dimensions: Dimensions): NormalizedPoint`
  $$N_x = \text{clamp}\left(\frac{point.x}{dimensions.width}, 0, 1\right), \quad N_y = \text{clamp}\left(\frac{point.y}{dimensions.height}, 0, 1\right)$$
- `clampNormalized(point: { x: number; y: number }): NormalizedPoint`
  Clamps both dimensions to $[0.0, 1.0]$.

### 5.3 `demoInteractionMap.json` Design
- Captures a realistic SaaS workflow on the Bike Rental Operations interface:
  - Event 1 (`frame: 10`): Initial viewport overview (`type: 'focus'`, `position: { x: 0.5, y: 0.5 }`, `provenance: 'simulated'`).
  - Event 2 (`frame: 175`): Cursor travels towards the reservation item (`type: 'hover'`, `position: { x: 0.70, y: 0.75 }` to `{ x: 0.38, y: 0.54 }`, `provenance: 'simulated'`).
  - Event 3 (`frame: 175`): Camera zoom transition focuses on reservation card (`type: 'focus'`, `position: { x: 0.38, y: 0.54 }`, `provenance: 'simulated'`).
  - Event 4 (`frame: 225`): User clicks reservation (`type: 'click'`, `position: { x: 0.38, y: 0.54 }`, `provenance: 'simulated'`).
  - Event 5 (`frame: 442`): CTA button click (`type: 'click'`, `position: { x: 0.50, y: 0.50 }`, `provenance: 'simulated'`).

---

## 6. SceneGraph Specifications & Base Contracts

### 6.1 SceneGraph JSON Specification & Zod Schema

The `SceneGraph` represents the validated, deterministic composition instructions consumed directly by the Remotion rendering components.

```typescript
import { z } from 'zod';

export const ArtDirectionSchema = z.object({
  theme: z.enum(['tech-precision', 'light-editorial', 'aurora-blur', 'punchy-social']),
  primaryColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  backgroundColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  surfaceColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  textColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  accentColor: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  fontFamily: z.string().optional().default('Inter'),
});

export const SoundCueSchema = z.object({
  frame: z.number().int().nonnegative(),
  sound: z.string(),
  volume: z.number().min(0).max(1).optional().default(0.8),
});

export const AudioTrackSchema = z.object({
  src: z.string(),
  volume: z.number().min(0).max(1).default(0.32),
  fadeInFrames: z.number().int().nonnegative().default(15),
  fadeOutFrames: z.number().int().nonnegative().default(30),
});

export const CameraKeyframeSchema = z.object({
  frame: z.number().int().nonnegative(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zoom: z.number().min(0.8).max(3.5),
  rotateX: z.number().min(-30).max(30).optional().default(0),
  rotateY: z.number().min(-30).max(30).optional().default(0),
  rotateZ: z.number().min(-30).max(30).optional().default(0),
  easing: z.enum(['cubic', 'spring', 'smooth']).optional().default('smooth'),
});

export const CursorPathSchema = z.object({
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().nonnegative(),
  clickFrame: z.number().int().nonnegative().optional(),
  start: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
  target: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
  controlPoint: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
  size: z.number().positive().optional().default(36),
  showRipple: z.boolean().optional().default(true),
});

// Discriminated Scene Union
export const KineticTypographySceneSchema = z.object({
  id: z.string(),
  type: z.literal('kinetic_typography'),
  durationFrames: z.number().int().positive(),
  payload: z.object({
    words: z.array(z.string()).min(1).max(12),
    accentWordIndex: z.number().int().optional().default(-1),
    symbols: z.array(z.string()).optional(),
  }),
  soundCues: z.array(SoundCueSchema).optional().default([]),
});

export const SyntheticPromptSceneSchema = z.object({
  id: z.string(),
  type: z.literal('synthetic_prompt_box'),
  durationFrames: z.number().int().positive(),
  payload: z.object({
    textToType: z.string().max(120),
    charsPerFrame: z.number().positive().optional().default(0.88),
  }),
  soundCues: z.array(SoundCueSchema).optional().default([]),
});

export const ProductInteraction3DSceneSchema = z.object({
  id: z.string(),
  type: z.literal('product_interaction_3d'),
  durationFrames: z.number().int().positive(),
  payload: z.object({
    surfaceTitle: z.string().optional().default('Bike Rental Operations — Base44'),
    cameraRig: z.object({
      keyframes: z.array(CameraKeyframeSchema).min(1),
    }),
    cursor: CursorPathSchema.optional(),
  }),
  soundCues: z.array(SoundCueSchema).optional().default([]),
});

export const SyntheticHeroButtonSceneSchema = z.object({
  id: z.string(),
  type: z.literal('synthetic_hero_button'),
  durationFrames: z.number().int().positive(),
  payload: z.object({
    buttonText: z.string().max(30),
    clickFrame: z.number().int().optional(),
  }),
  soundCues: z.array(SoundCueSchema).optional().default([]),
});

export const BrandClosingCTASceneSchema = z.object({
  id: z.string(),
  type: z.literal('brand_closing_cta'),
  durationFrames: z.number().int().positive(),
  payload: z.object({
    productName: z.string().max(50),
    tagline: z.string().max(80),
    buttonText: z.string().optional().default('Start Free'),
  }),
  soundCues: z.array(SoundCueSchema).optional().default([]),
});

export const SceneSchema = z.discriminatedUnion('type', [
  KineticTypographySceneSchema,
  SyntheticPromptSceneSchema,
  ProductInteraction3DSceneSchema,
  SyntheticHeroButtonSceneSchema,
  BrandClosingCTASceneSchema,
]);
export type Scene = z.infer<typeof SceneSchema>;

export const SceneGraphSchema = z.object({
  version: z.literal('2.0'),
  projectTitle: z.string(),
  fps: z.number().int().positive().default(30),
  durationInFrames: z.number().int().positive(),
  resolution: z.object({
    width: z.number().int().positive().default(1920),
    height: z.number().int().positive().default(1080),
  }),
  artDirection: ArtDirectionSchema,
  audioTrack: AudioTrackSchema,
  globalSoundCues: z.array(SoundCueSchema).optional().default([]),
  scenes: z.array(SceneSchema),
});
export type SceneGraph = z.infer<typeof SceneGraphSchema>;
```

---

## 7. Unidirectional Pipeline Architecture

### 7.1 Component Pipeline

```
 ┌─────────────────────────────────────────────────────────┐
 │                   InteractionMap                        │
 │  (events: click, hover, focus, scroll; provenance)      │
 └──────────────────────────┬──────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │          InteractionToSceneGraphAdapter                 │
 │  (Pure TS transformer: maps telemetry to scene atoms)   │
 └──────────────────────────┬──────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │                     SceneGraph                          │
 │  (Validated Zod JSON: scenes, camera, cursor, audio)    │
 └──────────────────────────┬──────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │            InteractiveSurfaceDemo (Remotion)            │
 │  ├── CameraRig3D (CameraTransform, FocalTracker, Path)  │
 │  ├── SmartCursor (BezierPath, Vector SVG, Ripple)       │
 │  ├── AudioEngine (AudioTimeline, Mixer, FadeController) │
 │  └── RealCaptureSurface + SyntheticUI + Atoms           │
 └──────────────────────────┬──────────────────────────────┘
                            │
                            ▼
 ┌─────────────────────────────────────────────────────────┐
 │             Remotion Server-Side Renderer               │
 │           Exports out/InteractionDemo.mp4               │
 └─────────────────────────────────────────────────────────┘
```

### 7.2 Adapter Transformation Rules
1. **Focus Event Mapping:** Translates `type: 'focus'` into `CameraKeyframeSchema` instances with target focal coordinates $(x \times 100, y \times 100)$ and calculated zoom level.
2. **Hover / Movement Mapping:** Translates consecutive positions into `CursorPathSchema` with quadratic Bezier control points.
3. **Click Event Mapping:**
   - Adds `clickFrame` to the cursor path for tactile compression.
   - Injects a `SoundCueSchema` with `sound: 'mouse-click'` at the exact identical frame.
4. **Transition Mapping:** When camera shifts focal targets across scenes, injects `sound: 'camera-whoosh'`.
5. **Brand CTA Closing:** Inserts `sound: 'chime'` at the appearance of brand closure.

---

## 8. Acceptance Criteria & Quality Benchmarks

### 8.1 Technical Quality Gates
- `npm run typecheck`: Must pass with 0 errors (`tsc --noEmit`).
- `npm run lint`: Must pass with 0 warnings and 0 errors (`eslint`).
- `npm run build`: Must compile Next.js application successfully without errors.
- Unit Tests: Native Node 24 test runner (`node --experimental-strip-types --test tests/**/*.test.ts`) must achieve 100% pass rate with zero external test libraries.
- Video Export: Remotion render command generates `out/InteractionDemo.mp4` at $1920 \times 1080$, $30\text{ FPS}$, duration $480\text{ frames}$ (16 seconds).

### 8.2 Camera Stability & Focal Drift Quantitative Threshold
- **Benchmark Definition:** Error distance $\delta = \sqrt{(P_{\text{observed}, x} - P_{\text{expected}, x})^2 + (P_{\text{observed}, y} - P_{\text{expected}, y})^2}$ measured in pixels at the viewport center during zoom.
- **Quantitative Thresholds:**
  - **Pure 2D Zoom ($1.0\times \to 2.2\times$):** Drift $\delta \le \mathbf{0.05\text{ px}}$.
  - **3D Perspective Zoom with Tilt ($\le 8^\circ$ rotateX/rotateY, $1200\text{px}$ perspective):** Drift $\delta \le \mathbf{2.00\text{ px}}$.
  - Any drift exceeding $2.00\text{ px}$ constitutes a QA failure.

### 8.3 Audio Polyphony & Sync Benchmarks
- **Frame-Accurate Synchronization:**
  $$|f_{\text{audio}} - f_{\text{click}}| = \mathbf{0\text{ frames}}$$
  The mouse click SFX must start in the exact same frame index where cursor reaches maximum click depression.
- **Polyphony Dynamic Range:** Master audio signal during polyphonic overlap (beat + whoosh + click + chime) must never exceed $0\text{ dBFS}$ (gain $\le 1.0$) to guarantee zero clipping distortion.

---

## 9. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Pipeline | Interaction-to-SceneGraph Adapter | Deterministic pure TS compiler translating `InteractionMap` into `SceneGraph` | `InteractionMap` JSON, config options | Validated `SceneGraph` JSON | Throws `ZodError` on malformed input | R3, ADR-003 |
| 2 | Data Contracts | Event Provenance Tagging | Mandatory tracking of event origin (`'observed' \| 'inferred' \| 'simulated'`) | Raw interaction events | Tagged `InteractionEvent` | Rejected by Zod if missing or invalid string | R2, Prompt |
| 3 | Data Contracts | Normalized Point System | Universal coordinate system bounded to $[0.0, 1.0]$ for cross-resolution invariance | Floating-point coordinates | `{ x: number, y: number }` | Zod validation rejects numbers $< 0$ or $> 1$ | R2, ADR-003 |
| 4 | Data Contracts | CoordinateMapper | Pure utility converting normalized coordinates to and from screen pixel space | Point, dimensions `{ w, h }` | Mapped pixel or normalized point | Clamps out-of-range coordinates cleanly | R4, Spec |
| 5 | Camera Engine | Fixed-Origin Translation Matrix | Translation formula $T_x = (0.5 - f_x) W_s S$ eliminating focal point drift | Viewport size, focal $(x,y)$, zoom $S$ | CSS 3D transform string | Zero drift ($< 0.05$ px in 2D) | R4, Code Audit |
| 6 | Camera Engine | CameraPath Interpolator | Continuous multi-keyframe interpolator with Bezier easing curves | Array of `CameraKeyframe`, frame $t$ | Interpolated `CameraState` | Clamps frame to keyframe boundaries | R4, Code Audit |
| 7 | Camera Engine | FocalTracker | Keeps track of normalized focus targets and prevents abrupt jumps | Target coordinate, current state | Smoothed focal point | Clamps to valid surface boundaries | R4, Code Audit |
| 8 | Motion & Atoms | BezierPath Trajectory | Quadratic/cubic 2D curved mouse paths with automatic arc control point | Start, Target, optional ControlPoint, $t$ | Position $(x, y)$ | Falls back to linear if points coincide | R4, Prompt |
| 9 | Motion & Atoms | Physical Click Compression | Micro-compression of cursor SVG with recovery spring and drop-shadow | Frame, clickFrame | Scale factor $[0.82, 1.0]$ | Invariant scale if no clickFrame defined | R4, Code Audit |
| 10 | Motion & Atoms | Expanding Click Ripple | Expanding translucent shockwave ring synchronized with clickFrame | Frame, clickFrame, color | Radius and opacity CSS styles | Zero opacity before clickFrame | R4, Code Audit |
| 11 | Audio Engine | AudioTimeline Scheduler | Frame-accurate audio cue schedule evaluator | Frame, array of SoundCues | Active audio cues for Remotion | Skips cues outside video bounds | R4, Code Audit |
| 12 | Audio Engine | Polyphonic AudioMixer | Gain headroom staging and ducking to prevent digital distortion | Background music, active cues, frame | Master gains per channel | Clamps total amplitude to $\le 1.0$ | R4, R5, Spec |
| 13 | Audio Engine | FadeController | Pure mathematical fade-in and fade-out volume envelopes | Frame, totalFrames, fadeIn, fadeOut | Instantaneous gain $[0.0, 1.0]$ | Handles zero or inverted fade bounds gracefully | R4, Spec |
| 14 | Audio Engine | SaaS SFX Asset Library | 6 verified 44.1kHz 16-bit mono WAV sound effects with documented clearance | SFX cue identifier | Valid audio asset path | Throws if audio asset missing | R4, Code Audit |
| 15 | Composition | InteractiveSurfaceDemo | Fully data-driven showcase composition consuming `SceneGraph` | `{ sceneGraph: SceneGraph }` | Remotion video frame tree | Error boundary on corrupted SceneGraph | R5, Root.tsx |
| 16 | QA & Benchmark | Native TS Node Test Runner | Fast TypeScript test execution via `node --experimental-strip-types --test` | TypeScript test suites | TAP / spec test results | Fails process with non-zero exit code on assertion failure | R4, QA Mandate |
| 17 | QA & Benchmark | Automated Drift Validator | Pure math test asserting focal point drift $\delta \le 2.0$ px across zoom range | Zoom levels $1.0 - 3.5$, angles $0 - 10^\circ$ | Quantitative pixel drift | Fails test if $\delta > \text{threshold}$ | Acceptance Criteria |
| 18 | QA & Benchmark | Remotion MP4 Verification | Server-side render producing `out/InteractionDemo.mp4` | Composition ID, config | Valid MP4 H.264 video file | Remotion CLI exits with non-zero on failure | Acceptance Criteria |

---

## 10. Edge Cases

| # | Feature | Input / Scenario | Observed / Required Behavior |
|---|---|---|---|
| 1 | `CoordinateMapper` | Coordinate values outside $[0.0, 1.0]$ (e.g. $x = -0.2$, $y = 1.4$) | `clampNormalized` constrains to exactly $0.0$ and $1.0$; pixel conversion never yields negative canvas positions. |
| 2 | `CameraTransform` | Maximum zoom ($3.5\times$) at boundary focal point ($x = 1.0, y = 1.0$) | Surface translates by $(0.5 - 1.0) W_s (3.5) = -1.75 W_s$; focal point aligns with center without canvas wrapping glitches. |
| 3 | `CameraTransform` | Zero transition frames ($transitionFrames = 0$) | Clamped to $\min(1, transitionFrames)$ to prevent divide-by-zero ($0/0 = \text{NaN}$) in interpolation math. |
| 4 | `BezierPath` | Collinear start and end points ($P_0 = P_1$) | Norm $L = 0$; perpendicular calculation detects $L < 10^{-6}$ and skips arc displacement, returning $P_0$. |
| 5 | `BezierPath` | Arc control point lands outside $[0.0, 1.0]$ | Control point is clamped to screen bounds so cursor does not disappear off-screen. |
| 6 | `SmartCursor` | `clickFrame` occurs after `endFrame` | Click micro-compression occurs at target resting position, maintaining visual stability. |
| 7 | `AudioMixer` | Triple overlapping sound cues simultaneously at frame $f$ | Gains are staged via dynamic headroom limiter; sum never exceeds $1.0$, preventing clipping. |
| 8 | `FadeController` | $fadeInFrames + fadeOutFrames > durationInFrames$ | Fade curves are proportionally normalized so volume ascends and descends without crossover discontinuity. |
| 9 | `SceneGraphSchema` | Negative duration or duration exceeding max frames ($> 3600$) | Zod rejects with validation error specifying invalid `durationFrames`. |
| 10 | `InteractionMapSchema` | Event with invalid provenance (e.g. `'guessed'`) | Zod parser throws schema validation error stating `'guessed'` is not in enum `['observed', 'inferred', 'simulated']`. |
| 11 | `InteractiveSurfaceDemo` | SceneGraph with empty scenes array (`scenes: []`) | Zod `.min(1)` on scenes array flags invalid input; fallback component renders brand placeholder. |
| 12 | Remotion Render | Audio cue specified with `.wav` suffix vs raw name (`'mouse-click'` vs `'mouse-click.wav'`) | Path resolution helper normalizes both formats into `sfx/${name}.wav` without double extension. |
