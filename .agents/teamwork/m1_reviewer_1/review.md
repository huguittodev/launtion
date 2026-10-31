# Milestone 1 Code & Interface Review: Interaction Map Foundation

**Reviewer:** `m1_reviewer_1` (Code & Interface Reviewer — Interaction Map)  
**Roles:** Reviewer, Adversarial Critic  
**Date:** 2026-10-31  
**Milestone:** M1 — Contracts, Foundations & SFX Rights  
**Review Targets:**
- `src/lib/interaction-map/types.ts`
- `src/lib/interaction-map/schema.ts`
- `src/lib/interaction-map/CoordinateMapper.ts`
- `src/lib/interaction-map/demoInteractionMap.json`

---

## Executive Summary

**Verdict: APPROVE**

The deliverables for Milestone 1's Interaction Map foundation have been thoroughly reviewed and adversarially stress-tested. The implementation adheres strictly to TypeScript types, implements runtime validation via Zod, provides pure mathematical coordinate transformation functions with defensive boundary handling, and includes an authentic 24-event SaaS telemetry sequence where 100% of events specify an explicit individual provenance (`observed` | `inferred` | `simulated`).

Zero integrity violations, shortcuts, facade implementations, or hardcoded cheating patterns were detected.

---

## 1. Quality & Contract Review

### 1.1 Strict TypeScript Adherence (`src/lib/interaction-map/types.ts`)
- **EventProvenance**: Strictly defined as union `'observed' | 'inferred' | 'simulated'`.
- **InteractionEventType**: Union `'click' | 'hover' | 'focus' | 'scroll'` capturing primary UI telemetry.
- **BaseResolution**: Strongly typed `{ width: number; height: number }`.
- **InteractionEvent**: Contains normalized coordinates $x, y \in [0.0, 1.0]$, 0-indexed `frame`, optional `duration`, optional `targetId`, mandatory `provenance: EventProvenance`, and safe optional `metadata?: Record<string, unknown>`.
- **InteractionMap**: Version `'2.0'`, `baseResolution`, `fps`, `durationInFrames`, and `events: InteractionEvent[]`.
- **Type Compatibility**: Inferred parsed types from `schema.ts` (`InteractionMapParsed`, `InteractionEventParsed`, etc.) were independently tested and proven to be 100% bidirectionally assignable with explicit interfaces in `types.ts`.

### 1.2 Zod Schema Definitions & Validation (`src/lib/interaction-map/schema.ts`)
- `EventProvenanceSchema`: `z.enum(['observed', 'inferred', 'simulated'])`.
- `InteractionEventTypeSchema`: `z.enum(['click', 'hover', 'focus', 'scroll'])`.
- `BaseResolutionSchema`: Enforces `z.number().int().positive()` for both width and height.
- `InteractionEventSchema`:
  - `id`: `z.string().min(1)` (rejects empty string).
  - `frame`: `z.number().int().nonnegative()` (rejects negative numbers and floats).
  - `duration`: `z.number().int().positive().optional()` (rejects 0 or negative values).
  - `x`, `y`: `z.number().min(0.0).max(1.0)` (strictly rejects normalized out-of-bounds coordinates).
  - `targetId`: `z.string().min(1).optional()`.
  - `provenance`: `EventProvenanceSchema` (mandatory).
  - `metadata`: `z.record(z.string(), z.unknown()).optional()`.
- `InteractionMapSchema`:
  - `version`: `z.literal('2.0')` (rejects unversioned or invalid versions).
  - `fps`: `z.number().int().positive()`.
  - `durationInFrames`: `z.number().int().positive()`.
  - `events`: `z.array(InteractionEventSchema)`.
  - `.refine()`: Validates that all events satisfy `evt.frame <= data.durationInFrames`.

### 1.3 Telemetry Data Authenticity (`src/lib/interaction-map/demoInteractionMap.json`)
- **Total Events**: 24.
- **Provenance Distribution**:
  - `observed`: 10 events (41.7%) — realistic mouse movement trajectories, hover triggers, click activations, and code-tree scrolling.
  - `inferred`: 7 events (29.2%) — typing cadence, caret positions, leaf route selection, and success notification focus.
  - `simulated`: 7 events (29.2%) — wide establishing shots, typing focus framing, hero button focal punch impulse, camera pullback wide, cursor rest, and brand hold.
- **Explicit Provenance Verification**: 100% of the 24 events contain an explicit individual `provenance` field. Zero events have missing, undefined, or null provenance.
- **Temporal & Coordinate Compliance**:
  - All frames are strictly ordered from frame 0 to frame 445 (within 480-frame budget).
  - All normalized coordinates are strictly bounded within $[0.0, 1.0]$.
  - All 24 event IDs are unique.
  - All 4 event types (`focus`, `hover`, `click`, `scroll`) are represented.

### 1.4 CoordinateMapper Correctness (`src/lib/interaction-map/CoordinateMapper.ts`)
- **Zero External Dependencies**: Pure TypeScript/ES math without external library dependencies.
- **Defensive Scalar Clamping**: `clamp` safely intercepts non-finite values (`NaN`, `+Infinity`, `-Infinity`) and returns `min`.
- **Bidirectional Conversions**:
  - `toPixels`: Accurately maps unit square $[0.0, 1.0]^2$ to canvas pixels. Supports optional integer rounding via `snapToInteger`. Throws `RangeError` on non-positive or non-finite canvas dimensions.
  - `toNormalized`: Inverts pixel coordinates to normalized space. Clamping is configurable via `clampBounds` (defaults to `true`). Throws `RangeError` on non-positive or non-finite canvas dimensions.
- **Aspect Ratio Containment (`fitWithinBounds`)**:
  - Implements exact aspect-ratio preserving contain algorithm ($scale = \min(W_t / W_s, H_t / H_s)$).
  - Validated across pillarboxing (4:3 into 16:9), letterboxing (21:9 into 16:9), and vertical video (9:16 into 16:9), with exact centering coordinates $((W_t - W_s \cdot s)/2, (H_t - H_s \cdot s)/2)$.
- **Nested Coordinate Translations**:
  - `mapLocalToCanvasNormalized`: Maps container-local normalized coordinates to canvas normalized coordinates.
  - `mapCanvasToLocalNormalized`: Inverts canvas normalized coordinates back to container-local coordinates. Mathematical inverse property confirmed via round-trip precision testing ($|x_{orig} - x_{roundtrip}| < 10^{-12}$).
- **Euclidean Metrics & Centering**:
  - `distanceNormalized`, `distancePixel`: Validated against 3-4-5 right triangle Pythagorean metrics.
  - `getRectCenterNormalized`: Accurately computes midpoint $(x + w/2, y + h/2)$ clamped to unit bounds.

---

## 2. Adversarial Review & Stress-Testing

### Challenge 1: Remotion 0-Indexed Frame Bound (`durationInFrames`)
- **Observation**: `InteractionMapSchema.refine` checks `evt.frame <= data.durationInFrames`.
- **Attack Scenario**: In Remotion compositions, valid frame indices for a composition of length $N$ run from $0$ to $N - 1$. If an event is scheduled at `evt.frame === data.durationInFrames` (e.g. frame 480 for a 480-frame composition), Remotion never evaluates frame 480 during rendering.
- **Blast Radius**: Low for current demo data (the maximum frame in `demoInteractionMap.json` is 445 $\le 479$). However, future interaction maps might specify an event at frame 480 that would be skipped at render time.
- **Mitigation Recommendation**: In Phase 3 / downstream adapter or schema update, consider tightening the refine check to `evt.frame < data.durationInFrames` (or clamping target frame indices to `durationInFrames - 1`).

### Challenge 2: Rect Dimensions Exceeding Unit Canvas in `normalizedRectToPixel`
- **Observation**: In `normalizedRectToPixel`:
  ```ts
  const size = toPixels({ x: rect.width, y: rect.height }, canvas, snapToInteger);
  ```
- **Attack Scenario**: `toPixels` clamps its input into $[0.0, 1.0]$ via `clampNormalized`. If an embedded surface or container is larger than the viewport (e.g., a zoomed UI element with normalized width 1.4), `toPixels` clamps `rect.width` to 1.0, truncating the computed pixel size to `canvas.width`.
- **Blast Radius**: Minor for standard viewports where all elements fit within the canvas ($width \le 1.0$).
- **Mitigation Recommendation**: In `normalizedRectToPixel`, consider computing dimensions directly as `rect.width * canvas.width` (or offering an unconstrained parameter to `toPixels`) rather than passing dimensions through coordinate position clamping.

### Challenge 3: Parameter Symmetry in Container Rect Validation
- **Observation**: `mapCanvasToLocalNormalized` validates `containerRect.width <= 0 || containerRect.height <= 0` and throws `RangeError`. Conversely, `mapLocalToCanvasNormalized` does not explicitly throw on zero or negative container dimensions (though its output is clamped to $[0.0, 1.0]$ by `clamp01`).
- **Blast Radius**: Negligible in normal operation; defensive clamping prevents NaN or fatal crashes.
- **Mitigation Recommendation**: Standardize defensive dimension validation across both local-to-canvas and canvas-to-local functions for consistent developer feedback.

---

## 3. Integrity Audit Findings

Systematic check for integrity violations:
1. **Hardcoded test results or expected outputs embedded in source code**: **None**. Source code contains genuine mathematical logic and type definitions.
2. **Dummy or facade implementations**: **None**. All methods in `CoordinateMapper.ts` and `schema.ts` perform real analytical calculations and validation.
3. **Shortcuts bypassing the task**: **None**. Full Zod schemas, TypeScript types, CoordinateMapper functions, and 24-event demo telemetry data are implemented from scratch.
4. **Fabricated verification outputs**: **None**. Independent script executions confirmed exact outputs, hashes, event counts, and build statuses.
5. **Self-certifying work without genuine independent verification**: **None**. All claims were independently tested and reproduced.

**Integrity Finding**: `NO INTEGRITY VIOLATIONS DETECTED`

---

## 4. Verified Claims Matrix

| Claim | Source / Requirement | Verification Method | Result |
|---|---|---|---|
| `npm run typecheck` exits 0 with 0 errors | Dispatch Req 1, Acceptance | Executed `npm run typecheck` (`tsc --noEmit`) | **PASS** (0 errors) |
| `npm run lint` exits 0 with 0 errors / 0 warnings | Dispatch Req 1, Acceptance | Executed `npm run lint` (`eslint`) | **PASS** (0 warnings, 0 errors) |
| `npm run build` compiles successfully | Acceptance | Executed `npm run build` (Next.js Turbopack) | **PASS** (compiled in 261ms) |
| Mandatory provenance in `demoInteractionMap.json` | Dispatch Req 3, R2 | Executed Node inspection script across all 24 events | **PASS** (24/24 events explicit: 10 observed, 7 inferred, 7 simulated) |
| Strict Zod schema boundaries | Dispatch Req 2, R2 | Adversarial test script testing out-of-range, NaN, type mismatch | **PASS** (all edge cases rejected as expected) |
| Bidirectional type assignability | Dispatch Req 2 | TypeScript compiler type-level assignability tests | **PASS** (100% assignable) |
| CoordinateMapper mathematical correctness | Dispatch Req 4, R4 | Round-trip tests, aspect ratio containment tests, Euclidean distance | **PASS** (error $< 10^{-12}$) |
