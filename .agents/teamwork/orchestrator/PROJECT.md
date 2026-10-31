# Project: Launtion Atomic Motion & Audio Engine Consolidation

## Architecture
- **Pipeline Data Flow**:
  `demoInteractionMap.json` (Telemetric Interaction Telemetry)
       ↓
  `src/lib/interaction-map/` (`schema.ts`, `CoordinateMapper.ts`)
       ↓
  `src/lib/scene-graph/adapter.ts` (`interactionToSceneGraphAdapter`)
       ↓
  `src/lib/scene-graph/schema.ts` (`SceneGraph` JSON specification)
       ↓
  Remotion Engines:
    - Camera: `remotion/motion-kit/camera/` (`CameraTransform`, `FocalTracker`, `CameraPath`, `CameraRig`)
    - Motion & Cursor: `remotion/motion-kit/cursor/` (`BezierPath`, `CursorPointer`, `SmartCursor`)
    - Atoms: `remotion/motion-kit/synthetic-ui/`, `DynamicBackdrop`, `RealCaptureSurface`, `KineticTypography`
    - Audio: `remotion/motion-kit/audio/` (`FadeController`, `AudioMixer`, `AudioTimeline`, `AudioEngine`)
       ↓
  `remotion/compositions/InteractiveSurfaceDemo.tsx` (100% data-driven Remotion composition)
       ↓
  Remotion CLI Renderer (`npx remotion render ... out/InteractionDemo.mp4`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Pre-implementation Component Audit | Matrix (REUSE, REFACTOR, REPLACE, NEW) mapped across all existing files | M1 | R1 |
| 2 | InteractionMap Zod Schema & Types | Base resolution, FPS, duration, events (click, hover, focus, scroll) with mandatory individual `provenance` ('observed' \| 'inferred' \| 'simulated') | M1 | R2 |
| 3 | CoordinateMapper | Pure conversion functions between normalized [0,1] and pixel coordinates | M1 | R4 |
| 4 | demoInteractionMap.json | Realistic SaaS interaction sequence with diverse events and provenances | M1 | R4, R5 |
| 5 | SceneGraph Zod Schema & Types | Discriminated union of scenes, art direction, and audio track specification | M1 | R2 |
| 6 | Interaction-to-SceneGraph Adapter | Deterministic pure function converting InteractionMap into SceneGraph | M1 | R3 |
| 7 | SFX Licensing & Provenance Document | Commercial rights documentation (`public/sfx/SFX_LICENSES.md`) for 6 WAV assets | M1 | R4, AGENTS.md |
| 8 | CameraTransform | Pure 3D CSS matrix with optical center translation $T = C - P_f$ | M2 | R4 |
| 9 | FocalTracker | Coordinate normalization, bounds clamping, focal centering | M2 | R4 |
| 10 | CameraPath | Continuous multi-keyframe trajectory interpolation with configurable easing | M2 | R4 |
| 11 | CameraRig Component | Orchestrator component applying perspective and decoupled transforms | M2 | R4 |
| 12 | Camera Focal Drift Minimization | Zero analytical drift; sub-pixel drift bounded by $e \le 0.5$ px | M2 | R4, Acceptance |
| 13 | BezierPath | Pure quadratic $B_2(t)$ and cubic $B_3(t)$ parametric Bezier curve math | M2 | R4 |
| 14 | CursorPointer | SVG vector pointer with physical click compression, drop-shadow, ripple | M2 | R4 |
| 15 | SmartCursor Component Refactor | Refactored cursor moving smoothly along Bezier trajectories | M2 | R4 |
| 16 | SyntheticUI & Typography Consolidation | Verify and consolidate mature reusable UI atoms (`REUSE`) | M2 | R1, R4 |
| 17 | FadeController | Monotonic-safe mathematical fade curves with duration clamping | M2 | R4 |
| 18 | AudioMixer | Master gain staging, polyphonic headroom protection, soft limiting | M2 | R4 |
| 19 | AudioTimeline | Frame-accurate deterministic audio cue scheduler | M2 | R4 |
| 20 | AudioEngine Component Refactor | Refactored audio engine wrapping timeline, mixer, and fade controller | M2 | R4 |
| 21 | InteractiveSurfaceDemo Composition | 100% data-driven showcase composition consuming SceneGraph via props | M3 | R5 |
| 22 | Root Composition Registration | Register `InteractiveSurfaceDemo` in `remotion/Root.tsx` | M3 | R4 |
| 23 | Native Node 24 Test Runner | Execute unit tests via `node --no-warnings --test tests/**/*.test.ts` | M4 | R4, Acceptance |
| 24 | Schema & Math Unit Tests | Tests for Zod schemas, CoordinateMapper, CameraTransform, BezierPath | M4 | Acceptance |
| 25 | Camera Drift Automated Benchmark | Test validating focal drift $e \le 0.5$ px across zoom levels | M4 | Acceptance |
| 26 | Audio Sync & Headroom Tests | Tests validating frame-accurate scheduling and polyphonic gain bounds | M4 | Acceptance |
| 27 | Codebase Verification Suite | `npm run typecheck`, `npm run lint`, `npm run build` with 0 errors | M4 | Acceptance |
| 28 | Remotion Video Render | Render `out/InteractionDemo.mp4` with exit code 0 | M4 | Acceptance |
| 29 | Forensic Integrity Audit | Systematic audit for authentic implementation and zero cheating | M4 | Hard Rule |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Contracts, Foundations & SFX Rights | InteractionMap schema/mapper/demo, SceneGraph schema/adapter, SFX_LICENSES.md | none | DONE (Verified: types.ts, schema.ts, CoordinateMapper.ts, demoInteractionMap.json, scene-graph schema/types/adapter.ts, SFX_LICENSES.md) |
| M2 | Atomic Engines Implementation | Camera Engine (CameraTransform, FocalTracker, CameraPath, CameraRig), Cursor Engine (BezierPath, CursorPointer, SmartCursor), Audio Engine (FadeController, AudioMixer, AudioTimeline, AudioEngine) | M1 | PLANNED |
| M3 | Showcase Composition & Integration | InteractiveSurfaceDemo composition driven by SceneGraph, Root.tsx registration | M1, M2 | PLANNED |
| M4 | E2E Testing, Quality Gates & Render | Native Node 24 tests (math, drift, schemas, audio), typecheck, lint, build, Remotion MP4 render, forensic audit | M3 | PLANNED |

## Interface Contracts

### InteractionMap Contract (`src/lib/interaction-map/schema.ts`)
```ts
export type EventProvenance = 'observed' | 'inferred' | 'simulated';

export interface InteractionEvent {
  id: string;
  type: 'click' | 'hover' | 'focus' | 'scroll';
  frame: number;
  duration?: number;
  x: number; // normalized [0.0, 1.0]
  y: number; // normalized [0.0, 1.0]
  targetId?: string;
  provenance: EventProvenance;
  metadata?: Record<string, unknown>;
}

export interface InteractionMap {
  version: '2.0';
  baseResolution: { width: number; height: number };
  fps: number;
  durationInFrames: number;
  events: InteractionEvent[];
}
```

### SceneGraph Contract (`src/lib/scene-graph/schema.ts`)
```ts
export interface CameraKeyframe {
  frame: number;
  x: number; // normalized [0.0, 1.0]
  y: number; // normalized [0.0, 1.0]
  zoom: number; // 1.0 - 3.5
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  easing?: 'linear' | 'ease-in-out' | 'spring';
}

export interface CursorKeyframe {
  frame: number;
  x: number;
  y: number;
  controlX?: number; // Bezier curvature control point
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
```

### Interaction-to-SceneGraph Adapter Contract (`src/lib/scene-graph/adapter.ts`)
```ts
export function interactionToSceneGraphAdapter(interactionMap: InteractionMap): SceneGraph;
```

## Code Layout & Exclusive File Ownership
- **Software Architect**:
  - `src/lib/scene-graph/schema.ts`
  - `src/lib/scene-graph/types.ts`
  - `src/lib/scene-graph/adapter.ts`
  - `remotion/compositions/InteractiveSurfaceDemo.tsx`
  - `remotion/Root.tsx`
- **Interaction Engine**:
  - `src/lib/interaction-map/schema.ts`
  - `src/lib/interaction-map/types.ts`
  - `src/lib/interaction-map/CoordinateMapper.ts`
  - `src/lib/interaction-map/demoInteractionMap.json`
- **Camera Engine**:
  - `remotion/motion-kit/camera/CameraTransform.ts`
  - `remotion/motion-kit/camera/FocalTracker.ts`
  - `remotion/motion-kit/camera/CameraPath.ts`
  - `remotion/motion-kit/camera/CameraRig.tsx`
  - `remotion/motion-kit/CameraRig3D.tsx` (re-export wrapper for backwards compatibility)
- **Motion & Atoms Engine**:
  - `remotion/motion-kit/cursor/BezierPath.ts`
  - `remotion/motion-kit/cursor/CursorPointer.tsx`
  - `remotion/motion-kit/SmartCursor.tsx`
- **Audio & SFX Engine**:
  - `remotion/motion-kit/audio/FadeController.ts`
  - `remotion/motion-kit/audio/AudioMixer.ts`
  - `remotion/motion-kit/audio/AudioTimeline.ts`
  - `remotion/motion-kit/AudioEngine.tsx`
  - `public/sfx/SFX_LICENSES.md`
- **QA & Testing**:
  - `tests/interaction-map.test.ts`
  - `tests/scene-graph.test.ts`
  - `tests/camera-math.test.ts`
  - `tests/bezier-path.test.ts`
  - `tests/audio-engine.test.ts`
  - `tests/integration-pipeline.test.ts`
