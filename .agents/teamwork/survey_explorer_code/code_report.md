# Comprehensive Codebase & Component Audit Report
**Launtion Engine v2 — Phase 1 Motion Kit & Data-Driven Pipeline Audit**
**Date:** 2026-10-31  
**Auditor:** Teamwork Explorer (`survey_explorer_code`)  
**Status:** Complete  

---

## 1. Executive Summary & Audit Scope

This audit provides a rigorous, read-only architectural and mathematical assessment of the Launtion repository (`/home/huguittodev/launtion`) in accordance with requirements **R1** and **R4** of `ORIGINAL_REQUEST.md`, `PROJECT_SPEC.md`, and `AGENTS.md`.

### Key Conclusions:
1. **Current Compositions are Monolithic & Hardcoded**: `remotion/compositions/StudioShowcase.tsx` demonstrates outstanding visual aesthetics inspired by Base44 (acid-green reservation card, dark mode security morph, prompt typing), but its sequences, timings, and coordinates are manually wired in React. To achieve requirement R5, it must be superseded by `InteractiveSurfaceDemo.tsx`, driven 100% by data from `demoInteractionMap.json` via a validated `SceneGraph`.
2. **Camera Physics Limitation in `CameraRig3D.tsx`**: The existing camera rig manipulates `transformOrigin: ${currentX}% ${currentY}%` and `scale(currentZoom)` without translation matrix physics. This produces two major mathematical flaws: (a) it fails to translate the target focal point to the viewport center, and (b) interpolating both `transformOrigin` and `scale` over the same interval induces non-linear focal drift.
3. **SmartCursor Trajectory is Spatially Linear**: `remotion/motion-kit/SmartCursor.tsx` interpolates spatially in a straight line between $(x_0, y_0)$ and $(x_1, y_1)$. Natural cursor kinematics require quadratic/cubic Bezier curves with curvature control points.
4. **AudioEngine Polyphony & Crash Vulnerabilities**: `remotion/motion-kit/AudioEngine.tsx` risks throwing runtime errors in Remotion's `interpolate()` when `fadeInFrames + fadeOutFrames > durationInFrames`. Furthermore, overlapping sound cues lack gain staging or ducking, risking acoustic clipping/distortion.
5. **SFX Library Lacks Rights Documentation**: `public/sfx/` contains 6 clean WAV files, but lacks an attribution and licensing manifest (`PROVENANCE.md`) as mandated by `PROJECT_SPEC.md` §12.3 and R4.
6. **Synthetic Atoms are Mature & Reusable**: `KineticTypography.tsx`, `SyntheticPromptBox.tsx`, `SyntheticHeroButton.tsx`, `SyntheticConnectPills.tsx`, and `SyntheticCodeTree.tsx` are well-structured, deterministic, and ready for `REUSE`.
7. **Pipeline Gaps (`NEW`)**: `src/lib/scene-graph/*`, `src/lib/interaction-map/*`, and `tests/*` do not currently exist and must be implemented with formal Zod schemas, TypeScript types, and unit test suites.
8. **Runtime & Test Compatibility**: Node.js runtime is **v24.16.0**. Node 24 natively supports TypeScript type-stripping via `--experimental-strip-types`, permitting `node --test` execution without external test framework dependencies. Existing build (`next build`), typecheck (`tsc --noEmit`), and lint (`eslint`) pass with 0 errors.

---

## 2. Technical Baseline & Environment Verification

### 2.1 Dependencies & Versions (`package.json`)
- **Remotion**: `4.0.539` (`remotion`, `@remotion/cli`) — Exact synchronized versions.
- **Next.js**: `16.4.3` (App Router, Turbopack).
- **React**: `19.3.0` / `react-dom: 19.3.0`.
- **Zod**: `4.5.4` (Available for strict contract validation).
- **TypeScript**: `^5` (Strict mode enabled in `tsconfig.json`).
- **Tailwind CSS**: `^4`.

### 2.2 Native TypeScript Test Runner Strategy
- **Node Version**: `v24.16.0`.
- Verified execution: `node --experimental-strip-types -e "const x: number = 42; console.log(x);"` executes cleanly with exit code `0`.
- **QA Strategy**: The QA team can execute `node --test` with native type-stripping (`node --experimental-strip-types --test tests/**/*.test.ts`) with zero added dependencies, in full compliance with R1/R4/R6.

### 2.3 Existing Verification Status
- `npm run typecheck`: **0 errors**.
- `npm run lint`: **0 warnings, 0 errors**.
- `npm run build`: **Compiled successfully** (Next.js 16.4.3 Turbopack).

---

## 3. Deep-Dive Component Audit

### 3.1 `CameraRig3D.tsx` (`remotion/motion-kit/CameraRig3D.tsx`)
- **File Length**: 112 lines.
- **Current Responsibilities**: Renders a 3D perspective viewport (`perspective: 1200px`) and interpolates camera state (`x, y, zoom, rotateX, rotateY, rotateZ`) from `initial` to `target`.

#### Critical Mathematical & Physics Defects:
1. **Lack of Translation Matrix & Viewport Centering**:
   Lines 100–103 implement:
   ```tsx
   transformOrigin: `${currentX}% ${currentY}%`,
   transform: `scale(${currentZoom}) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg) rotateZ(${currentRotateZ}deg)`,
   ```
   In CSS 3D transforms, `transform-origin` specifies the stationary pivot point about which scaling and rotations occur. If an element has width $W$ and height $H$, setting `transform-origin: 38% 54%` and `scale(2.2)` causes the point at $(0.38 W, 0.54 H)$ to remain at $(0.38 W, 0.54 H)$ in screen coordinates. It does **not** move $(0.38 W, 0.54 H)$ to the camera center $(0.5 W, 0.5 H)$. In high-end SaaS product videos (Base44 style), when the camera zooms into a focal point, that focal point must glide to the center (or specified framing target) of the viewport.
2. **Focal Drift Induced by Dynamic Transform Origin**:
   When `transformOrigin` $(O_x(t), O_y(t))$ and `scale` $S(t)$ both change dynamically across frames $t \in [t_{start}, t_{end}]$, the transformed position of any surface point $P = (P_x, P_y)$ follows:
   $$P'(t) = O(t) + S(t) \cdot (P - O(t)) = (1 - S(t)) \cdot O(t) + S(t) \cdot P$$
   Because both $O(t)$ and $S(t)$ are time-dependent, the velocity $\frac{d P'}{dt}$ contains coupling terms:
   $$\frac{d P'}{dt} = (1 - S(t)) \frac{d O}{dt} - O(t) \frac{d S}{dt} + P \frac{d S}{dt}$$
   This creates an artificial lateral drift ("swimming" or wobbling) of the target area during zoom transitions.
3. **Correct Formulation (Camera Matrix Transform)**:
   The mathematically stable transform to frame focal point $(f_x, f_y)$ at zoom $S$ and rotation $(R_x, R_y, R_z)$ with viewport dimensions $(W, H)$ is:
   $$\text{Translate to Origin: } T_1 = \begin{bmatrix} 1 & 0 & -f_x \\ 0 & 1 & -f_y \\ 0 & 0 & 1 \end{bmatrix}$$
   $$\text{Apply Scale \& Rotations: } M = S \cdot R_z \cdot R_y \cdot R_x$$
   $$\text{Translate to Viewport Anchor: } T_2 = \begin{bmatrix} 1 & 0 & W/2 \\ 0 & 1 & H/2 \\ 0 & 0 & 1 \end{bmatrix}$$
   $$\mathbf{T}_{camera} = T_2 \cdot M \cdot T_1$$
   In CSS transform representation:
   `translate3d(calc(50% - ${fX}px), calc(50% - ${fY}px), 0) scale(${zoom}) rotateX(...) rotateY(...) rotateZ(...)`
   with a fixed `transform-origin: ${fX}px ${fY}px` (or `transform-origin: 0 0` with pure matrix translation).
4. **Monolithic Two-Keyframe Limitation**:
   `CameraRig3D` currently only interpolates between `initial` and `target`. It cannot handle a multi-stage continuous camera sequence (e.g., initial wide overview $\to$ zoom to sidebar $\to$ pan to reservation $\to$ pull back to hero button).
5. **Coordinate Range**:
   Takes percentages `0 - 100` instead of the normalized `0.0 - 1.0` standard defined in R2/R4.

- **Classification**: `REFACTOR` $\to$ Deconstruct into `remotion/motion-kit/camera/`:
  - `CameraTransform.ts` (Pure matrix / CSS transform calculations)
  - `FocalTracker.ts` (Normalized coordinates, bounds clamping, focal drift minimization)
  - `CameraPath.ts` (Continuous multi-keyframe trajectory interpolation)
  - `CameraRig.tsx` (React component orchestrator)

---

### 3.2 `SmartCursor.tsx` (`remotion/motion-kit/SmartCursor.tsx`)
- **File Length**: 142 lines.
- **Current Responsibilities**: Renders an SVG cursor overlay with linear interpolation between `start` and `target`, physical click scale compression, and an expanding shockwave ripple.

#### Critical Kinematic & Rendering Defects:
1. **Purely Linear 2D Spatial Interpolation**:
   Lines 44–45 implement:
   ```tsx
   const posX = start.x + (target.x - start.x) * progress;
   const posY = start.y + (target.y - start.y) * progress;
   ```
   Even though `progress` uses `Easing.bezier(0.22, 1, 0.36, 1)`, that easing only affects velocity along a rigid 1D straight line in screen space. Human mouse movements naturally curve across interfaces in an arc. R4 explicitly requires `BezierPath` with a control point ($P_1$) to form quadratic or cubic Bezier arcs:
   $$B(t) = (1 - t)^2 P_0 + 2(1 - t)t P_1 + t^2 P_2, \quad t \in [0, 1]$$
2. **SVG Hotspot Pointer Misalignment**:
   Lines 114–116 set:
   ```tsx
   left: `${posX}%`,
   top: `${posY}%`,
   transform: `scale(${clickScale}) translate(0, 0)`,
   transformOrigin: 'top left',
   ```
   The SVG cursor path in `viewBox="0 0 24 24"` begins at `M3 2...`. The active tip of the arrow is at $(3, 2)$. Because `transformOrigin` is set to `top left` (which is $(0, 0)$), scaling the cursor down to `0.82` shifts the active pointer tip away from $(posX, posY)$. The SVG wrapper must apply an internal translation offset `translate(-3px, -2px)` so that the tip $(3, 2)$ lands precisely on the focal coordinate.
3. **Hardcoded Styling**:
   Ripple color is hardcoded to `rgba(255, 92, 53, 0.9)` (orange). It should support theming from `artDirection.accentColor`.
4. **Coordinate Normalization**:
   Expects percentages `0 - 100` rather than normalized `0.0 - 1.0`.

- **Classification**: `REFACTOR` $\to$ Deconstruct into `remotion/motion-kit/cursor/`:
  - `BezierPath.ts` (Pure mathematical Bezier trajectory with control point computation)
  - `SvgCursor.tsx` (Vector cursor with exact tip alignment and physical pressure squish)
  - `CursorRipple.tsx` (Configurable radial shockwave)
  - `SmartCursor.tsx` (React orchestrator)

---

### 3.3 `AudioEngine.tsx` (`remotion/motion-kit/AudioEngine.tsx`)
- **File Length**: 85 lines.
- **Current Responsibilities**: Plays background music with fade in/out and maps an array of `SoundCue` objects into Remotion `<Sequence>` and `<Audio>` elements.

#### Critical Sound Architecture Defects:
1. **Non-Monotonic Interpolate Crash Condition**:
   Lines 44–49 implement:
   ```tsx
   const musicVolume = interpolate(
     frame,
     [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
     [0, targetVolume, targetVolume, 0],
     { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
   );
   ```
   If a composition is short (e.g., 60 frames) or `fadeIn` (15) and `fadeOut` (30) overlap, or if `durationInFrames - fadeOut <= fadeIn`, the input range is not strictly monotonically increasing ($x_0 < x_1 < x_2 < x_3$). In Remotion, `interpolate()` will throw an unhandled exception during rendering.
2. **Lack of Headroom Limiting & Polyphony Distortions**:
   Lines 74–77 instantiate `<Audio src={...} volume={cue.volume ?? 0.8} />`. In `StudioShowcase.tsx`:
   - Frame 421: `camera-whoosh` (0.7)
   - Frame 442: `mouse-click` (0.95)
   - Music track: `ambient-beat` (0.32)
   When sound cues overlap with background music and with each other, the instantaneous amplitude sum $\sum A_i$ can reach $0.7 + 0.95 + 0.32 = 1.97$, well above $1.0$ (0 dBFS). Without an `AudioMixer` applying dynamic headroom management or ducking, this causes digital clipping and distortion in AAC/MP4 exports.
3. **Arbitrary Fixed Duration of SFX Sequences**:
   Line 72 sets `durationInFrames={45}` (1.5 seconds) for every sound cue, regardless of whether the WAV file is 100ms (`mouse-click.wav`) or 800ms (`camera-whoosh.wav`).
4. **Missing Provenance Documentation**:
   `public/sfx/` contains 6 files:
   - `ambient-beat.wav` (1,587,644 bytes)
   - `camera-whoosh.wav` (30,912 bytes)
   - `chime.wav` (39,734 bytes)
   - `keyboard-tap.wav` (4,454 bytes)
   - `mouse-click.wav` (7,100 bytes)
   - `soft-pop.wav` (10,628 bytes)
   There is no file documenting their origin, creator, sampling rates, or commercial license. R4 and Acceptance Criteria mandate documented commercial provenance for all audio assets.

- **Classification**: `REFACTOR` $\to$ Deconstruct into `remotion/motion-kit/audio/`:
  - `FadeController.ts` (Monotonic-safe mathematical fade curves with duration clamping)
  - `AudioMixer.ts` (Gain staging, headroom protection, intentional polyphony mixing)
  - `AudioTimeline.ts` (Deterministic frame-level scheduler for SFX cues)
  - `AudioEngine.tsx` (React composition orchestrator)
  - `public/sfx/PROVENANCE.md` (Formal licensing and rights manifest)

---

### 3.4 `SyntheticUI` Components & `KineticTypography`

#### 3.4.1 `KineticTypography.tsx` (`remotion/motion-kit/KineticTypography.tsx`)
- **File Length**: 182 lines.
- **Capabilities**: Staggered word reveal with spring/bezier easing, floating rotating symbols, accent word coloring, responsive font sizing.
- **Minor Issue**: Line 99 contains `transition: 'transform 0.1s linear'`. In Remotion, CSS transitions are inert and should be removed.
- **Classification**: `REUSE` (as mandated by R4).

#### 3.4.2 `SyntheticPromptBox.tsx` (`remotion/motion-kit/SyntheticUI/SyntheticPromptBox.tsx`)
- **File Length**: 210 lines.
- **Capabilities**: Frame-accurate typewriter effect, blinking vertical cursor (`Math.floor(frame / 12) % 2 === 0`), submit button pop upon typing completion, SVG action icons.
- **Classification**: `REUSE` (as mandated by R4).

#### 3.4.3 `SyntheticHeroButton.tsx` (`remotion/motion-kit/SyntheticUI/SyntheticHeroButton.tsx`)
- **File Length**: 102 lines.
- **Capabilities**: Elastic entrance scale, physical click scale compression (`[1, 0.93, 1]`), glow pulse expansion.
- **Classification**: `REUSE` (as mandated by R4).

#### 3.4.4 `SyntheticConnectPills.tsx` (`remotion/motion-kit/SyntheticUI/SyntheticConnectPills.tsx`)
- **File Length**: 156 lines.
- **Capabilities**: Bidirectional slide-in of service pills with connecting link node and beam pulse.
- **Classification**: `REUSE` (as mandated by R4).

#### 3.4.5 `SyntheticCodeTree.tsx` (`remotion/motion-kit/SyntheticUI/SyntheticCodeTree.tsx`)
- **File Length**: 135 lines.
- **Capabilities**: Hierarchical tree layout with folder indicators, staggered slide-in per node.
- **Classification**: `REUSE` (as mandated by R4).

---

### 3.5 Backdrops & Capture Surface

#### 3.5.1 `DynamicBackdrop.tsx` (`remotion/motion-kit/DynamicBackdrop.tsx`)
- **File Length**: 162 lines.
- **Capabilities**: Variants `light-editorial`, `dark-precision`, `aurora-blur`, `solid`. Deterministic wave oscillation using trigonometric functions of `frame`.
- **Classification**: `REUSE`.

#### 3.5.2 `IconGridMorph.tsx` (`remotion/motion-kit/IconGridMorph.tsx`)
- **File Length**: 137 lines.
- **Capabilities**: $M \times N$ matrix of SVG icons undergoing radial wave state transition with center icon 3D elevation.
- **Classification**: `REUSE`.

#### 3.5.3 `RealCaptureSurface.tsx` (`remotion/motion-kit/RealCaptureSurface.tsx`)
- **File Length**: 106 lines.
- **Capabilities**: Polished SaaS application window frame with macOS traffic light controls, subtle border, and deep box shadow.
- **Classification**: `REUSE`.

---

### 3.6 Compositions & Root Registration

#### 3.6.1 `Root.tsx` (`remotion/Root.tsx`)
- **Current State**: Registers `StudioShowcase` and `LaunchDemo`.
- **Modification**: Register the new `InteractiveSurfaceDemo` composition with default props derived from `demoInteractionMap.json`.
- **Classification**: `REFACTOR` (assigned to Software Architect).

#### 3.6.2 `StudioShowcase.tsx` (`remotion/compositions/StudioShowcase.tsx`)
- **Current State**: 546 lines. Manual showcase with hardcoded React sequences.
- **Role in Project**: Visual reference for Base44 fidelity.
- **Classification**: `REPLACE` (superseded by `InteractiveSurfaceDemo.tsx` for R5 compliance).

#### 3.6.3 `InteractiveSurfaceDemo.tsx` (`remotion/compositions/InteractiveSurfaceDemo.tsx`)
- **Current State**: Non-existent.
- **Requirement**: Must consume `demoInteractionMap.json` through `interactionToSceneGraphAdapter` to produce a `SceneGraph`, interpreting all scenes via Remotion Sequences with zero hardcoded animations.
- **Classification**: `NEW` (assigned to Software Architect).

---

### 3.7 Data Contracts & Pipeline Gaps

#### 3.7.1 `InteractionMap` (`src/lib/interaction-map/*`)
- **Current State**: Non-existent.
- **Requirements per R2/R4**:
  - `schema.ts`: Zod schema specifying `baseResolution`, `fps`, `durationInFrames`, and `events` array (`click`, `hover`, `focus`, `scroll`).
  - **Mandatory Provenance**: Every event must have `provenance: 'observed' | 'inferred' | 'simulated'`.
  - `CoordinateMapper.ts`: Pure functions converting between normalized $(u, v) \in [0, 1]$ and pixel coordinates $(x, y) \in [0, W] \times [0, H]$.
  - `demoInteractionMap.json`: Realistic simulated interaction map capturing a typical SaaS flow.
- **Classification**: `NEW` (assigned to Interaction Engine).

#### 3.7.2 `SceneGraph` (`src/lib/scene-graph/*`)
- **Current State**: Non-existent.
- **Requirements per R2/R3/R4**:
  - `schema.ts`: Strict Zod schema for `SceneGraph`, including `artDirection`, `audioTrack`, and typed `scenes` (`product_interaction_3d`, `synthetic_prompt_box`, `kinetic_typography`, `synthetic_hero_button`, etc.).
  - `adapter.ts`: Pure deterministic `interactionToSceneGraphAdapter(interactionMap)` that builds the full SceneGraph.
  - `types.ts`: TypeScript interfaces inferred from Zod.
- **Classification**: `NEW` (assigned to Software Architect).

#### 3.7.3 Unit Test Suite (`tests/*`)
- **Current State**: Non-existent.
- **Requirements per R4 & Acceptance Criteria**:
  - `interaction-map.test.ts`: Zod schema validation & coordinate transformation accuracy.
  - `scene-graph.test.ts`: Zod schema validation & adapter determinism.
  - `camera-math.test.ts`: Matrix transform calculations, viewport centering, and focal drift quantification.
  - `bezier-path.test.ts`: Quadratic/cubic Bezier curve accuracy, arc height, and velocity continuity.
  - `audio-mixer.test.ts`: Monotonic fade curves, gain limiter, polyphony headroom bounds.
- **Classification**: `NEW` (assigned to QA & Integration Benchmark).

---

## 4. Formal Component Audit Matrix (R1)

| # | Component / Module | Current Path | Classification | Existing Capabilities | Bugs / Limitations / Math Issues | Required Modifications | Assigned Role (R4) |
|---|-------------------|--------------|----------------|-----------------------|----------------------------------|------------------------|--------------------|
| 1 | **Root Registration** | `remotion/Root.tsx` | `REFACTOR` | Registers `StudioShowcase` and `LaunchDemo` compositions. | Does not register `InteractiveSurfaceDemo`. | Add `InteractiveSurfaceDemo` composition with schema-validated default props. | Software Architect |
| 2 | **Root Entry** | `remotion/index.ts` | `REUSE` | Calls `registerRoot(Root)`. | None. | Retain as is. | Software Architect |
| 3 | **Studio Showcase** | `remotion/compositions/StudioShowcase.tsx` | `REPLACE` | 480-frame Base44 visual demo. | Hardcoded React animation wiring; violates R3/R5 data-driven architecture. | Superseded by `InteractiveSurfaceDemo.tsx` driven by SceneGraph. | Software Architect |
| 4 | **Editorial Demo** | `remotion/compositions/LaunchDemo.tsx` | `REUSE` | 300-frame editorial text/card demo. | Hardcoded interpolations (legacy). | Retain for backwards compatibility. | Software Architect |
| 5 | **Interactive Surface Demo** | `remotion/compositions/InteractiveSurfaceDemo.tsx` | `NEW` | None (does not exist). | N/A. | Create composition consuming `SceneGraph` generated from `demoInteractionMap.json`. | Software Architect |
| 6 | **Camera Rig** | `remotion/motion-kit/CameraRig3D.tsx` | `REFACTOR` | 3D perspective wrapper with zoom and rotation. | 1. No viewport translation (focal point not centered).<br>2. Dynamic `transformOrigin` causes focal drift.<br>3. Two-keyframe limit. | Decompose into `CameraTransform`, `FocalTracker`, `CameraPath`, and `CameraRig`. | Camera Engine |
| 7 | **Smart Cursor** | `remotion/motion-kit/SmartCursor.tsx` | `REFACTOR` | SVG cursor with linear travel, click squish, ripple. | 1. Linear 1D travel (no Bezier curve).<br>2. Tip hotspot misalignment during scale.<br>3. Hardcoded ripple color. | Decompose into `BezierPath`, `SvgCursor`, `CursorRipple`, and `SmartCursor`. | Motion & Atoms Engine |
| 8 | **Audio Engine** | `remotion/motion-kit/AudioEngine.tsx` | `REFACTOR` | Background music fade + SFX sequences. | 1. `interpolate()` crash if fade exceeds duration.<br>2. Polyphonic clipping without gain staging.<br>3. Hardcoded 45-frame cue durations. | Decompose into `FadeController`, `AudioMixer`, `AudioTimeline`, and `AudioEngine`. | Audio & SFX Engine |
| 9 | **SFX Asset Library** | `public/sfx/*` | `REFACTOR` | 6 clean WAV audio files. | Missing license/provenance documentation. | Create `public/sfx/PROVENANCE.md` with source, licensing, and commercial rights. | Audio & SFX Engine |
| 10 | **Kinetic Typography** | `remotion/motion-kit/KineticTypography.tsx` | `REUSE` | Staggered words, orbit symbols, accent highlight. | Inert CSS `transition` on line 99. | Remove inert CSS transition; wrap for SceneGraph node integration. | Motion & Atoms Engine |
| 11 | **Synthetic Prompt Box** | `remotion/motion-kit/SyntheticUI/SyntheticPromptBox.tsx` | `REUSE` | Frame-by-frame typing, blinking cursor, submit button pop. | None. Clean determinism. | Integrate with SceneGraph node payload. | Motion & Atoms Engine |
| 12 | **Synthetic Hero Button** | `remotion/motion-kit/SyntheticUI/SyntheticHeroButton.tsx` | `REUSE` | Isolated CTA button with elastic entrance, click squish, glow. | None. Clean determinism. | Integrate with SceneGraph node payload. | Motion & Atoms Engine |
| 13 | **Synthetic Connect Pills** | `remotion/motion-kit/SyntheticUI/SyntheticConnectPills.tsx` | `REUSE` | Integration connection pills with beam pulse. | None. Clean determinism. | Integrate with SceneGraph node payload. | Motion & Atoms Engine |
| 14 | **Synthetic Code Tree** | `remotion/motion-kit/SyntheticUI/SyntheticCodeTree.tsx` | `REUSE` | Staggered file tree display with folder indicators. | None. Clean determinism. | Integrate with SceneGraph node payload. | Motion & Atoms Engine |
| 15 | **Dynamic Backdrop** | `remotion/motion-kit/DynamicBackdrop.tsx` | `REUSE` | Animated background gradients and technical dot grids. | None. Clean determinism. | Retain as is. | Motion & Atoms Engine |
| 16 | **Icon Grid Morph** | `remotion/motion-kit/IconGridMorph.tsx` | `REUSE` | Radial wave icon morphing from warning to shield. | None. Clean determinism. | Retain as is. | Motion & Atoms Engine |
| 17 | **Real Capture Surface** | `remotion/motion-kit/RealCaptureSurface.tsx` | `REUSE` | SaaS window container with macOS chrome and deep shadow. | None. Clean determinism. | Retain as UI container for product surface. | Motion & Atoms Engine |
| 18 | **Interaction Map System** | `src/lib/interaction-map/*` | `NEW` | None (does not exist). | N/A. | Implement Zod schema (`provenance` required), `CoordinateMapper`, and `demoInteractionMap.json`. | Interaction Engine |
| 19 | **Scene Graph System** | `src/lib/scene-graph/*` | `NEW` | None (does not exist). | N/A. | Implement Zod schema, TS types, and `interactionToSceneGraphAdapter`. | Software Architect |
| 20 | **QA Test Suite** | `tests/*` | `NEW` | None (does not exist). | N/A. | Implement unit tests for Zod schemas, camera math, Bezier curves, and audio mixer via `node --test`. | QA & Benchmark |

---

## 5. File Boundaries & Exclusive Role Ownership (R4)

To eliminate concurrent edits and merge collisions during Phase 1 execution, file paths are strictly partitioned across 6 specialized roles:

```text
launtion/
├── remotion/
│   ├── Root.tsx                           --> [Software Architect]
│   ├── index.ts                           --> [Software Architect]
│   ├── compositions/
│   │   ├── InteractiveSurfaceDemo.tsx     --> [Software Architect]
│   │   ├── StudioShowcase.tsx             --> [Read-Only Reference]
│   │   └── LaunchDemo.tsx                 --> [Read-Only Reference]
│   └── motion-kit/
│       ├── camera/                        --> [Camera Engine]
│       │   ├── CameraTransform.ts
│       │   ├── FocalTracker.ts
│       │   ├── CameraPath.ts
│       │   └── CameraRig.tsx
│       ├── cursor/                        --> [Motion & Atoms Engine]
│       │   ├── BezierPath.ts
│       │   ├── SvgCursor.tsx
│       │   ├── CursorRipple.tsx
│       │   └── SmartCursor.tsx
│       ├── audio/                         --> [Audio & SFX Engine]
│       │   ├── FadeController.ts
│       │   ├── AudioMixer.ts
│       │   ├── AudioTimeline.ts
│       │   └── AudioEngine.tsx
│       ├── typography/                    --> [Motion & Atoms Engine]
│       │   └── KineticTypography.tsx
│       └── synthetic-ui/                  --> [Motion & Atoms Engine]
│           ├── SyntheticPromptBox.tsx
│           ├── SyntheticHeroButton.tsx
│           ├── SyntheticConnectPills.tsx
│           └── SyntheticCodeTree.tsx
├── src/lib/
│   ├── scene-graph/                       --> [Software Architect]
│   │   ├── schema.ts
│   │   ├── types.ts
│   │   └── adapter.ts
│   └── interaction-map/                   --> [Interaction Engine]
│       ├── schema.ts
│       ├── types.ts
│       ├── CoordinateMapper.ts
│       └── demoInteractionMap.json
├── public/sfx/
│   └── PROVENANCE.md                      --> [Audio & SFX Engine]
└── tests/                                 --> [QA & Integration Benchmark]
    ├── interaction-map.test.ts
    ├── scene-graph.test.ts
    ├── camera-math.test.ts
    ├── bezier-path.test.ts
    └── audio-mixer.test.ts
```

### Detailed Ownership Breakdown:

1. **Software Architect**
   - **Exclusive Paths**:
     - `remotion/Root.tsx`
     - `remotion/index.ts`
     - `remotion/compositions/InteractiveSurfaceDemo.tsx`
     - `src/lib/scene-graph/*` (`schema.ts`, `types.ts`, `adapter.ts`, `index.ts`)
   - **Key Deliverables**: Approves Zod/TS contracts, implements `interactionToSceneGraphAdapter`, orchestrates `InteractiveSurfaceDemo`, conducts code review.

2. **Camera Engine**
   - **Exclusive Paths**:
     - `remotion/motion-kit/camera/*` (`CameraTransform.ts`, `FocalTracker.ts`, `CameraPath.ts`, `CameraRig.tsx`, `index.ts`)
   - **Key Deliverables**: Solves translation physics for focal centering, bounds focal drift within quantitative pixel tolerance, enables multi-keyframe continuous interpolation.

3. **Interaction Engine**
   - **Exclusive Paths**:
     - `src/lib/interaction-map/*` (`schema.ts`, `types.ts`, `CoordinateMapper.ts`, `demoInteractionMap.json`, `index.ts`)
   - **Key Deliverables**: Defines strict Zod schema with mandatory `provenance` field (`observed` | `inferred` | `simulated`), builds `CoordinateMapper` $(0.0-1.0 \leftrightarrow px)$, produces realistic `demoInteractionMap.json`.

4. **Motion & Atoms Engine**
   - **Exclusive Paths**:
     - `remotion/motion-kit/cursor/*` (`BezierPath.ts`, `SvgCursor.tsx`, `CursorRipple.tsx`, `SmartCursor.tsx`, `index.ts`)
     - `remotion/motion-kit/synthetic-ui/*` (Consolidated atoms)
     - `remotion/motion-kit/typography/*` (`KineticTypography.tsx`)
   - **Key Deliverables**: Implements quadratic/cubic Bezier trajectories with control point curvature, aligns vector SVG tip, refactors ripple styling, maintains synthetic UI atoms.

5. **Audio & SFX Engine**
   - **Exclusive Paths**:
     - `remotion/motion-kit/audio/*` (`FadeController.ts`, `AudioMixer.ts`, `AudioTimeline.ts`, `AudioEngine.tsx`, `index.ts`)
     - `public/sfx/PROVENANCE.md`
   - **Key Deliverables**: Builds frame-accurate audio timeline, creates headroom limiter preventing polyphony clipping, guarantees monotonic fade curves, documents commercial rights and provenance for all 6 SFX files.

6. **QA & Integration Benchmark**
   - **Exclusive Paths**:
     - `tests/*` (`*.test.ts`)
   - **Key Deliverables**: Verifies native Node `node --test` runner with `--experimental-strip-types`, writes automated unit tests for schemas, camera drift limits, Bezier curves, and audio gain limits; benchmarks render output.

---

## 6. Next Steps & Recommendations

1. **Architect Approval**: Software Architect reviews and approves this Component Audit Matrix and authorizes the Zod schemas for `InteractionMap` and `SceneGraph`.
2. **Pure Math Isolation**: All mathematical transformation modules (`CameraTransform`, `CoordinateMapper`, `BezierPath`, `FadeController`, `AudioMixer`) must be authored as pure functions testable in Node without React or DOM dependencies.
3. **Focal Drift QA Threshold**: QA must establish and document the maximum permissible focal drift in pixels (e.g., $< 2.0\text{px}$ drift across a $2.2\times$ zoom transition at 1080p).
4. **Zero Manual React Wiring**: The showcase composition `InteractiveSurfaceDemo.tsx` must derive 100% of its timing, camera targets, cursor coordinates, and audio triggers from `demoInteractionMap.json` transformed through `interactionToSceneGraphAdapter`.
