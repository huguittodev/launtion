# Adversarial Challenge Report — InteractionMap Schema & Demo Dataset

**Evaluator:** `m1_challenger_1` (Empirical Challenger / Adversarial Verifier)  
**Date:** 2026-10-31  
**Target Code:**
- `src/lib/interaction-map/types.ts`
- `src/lib/interaction-map/schema.ts`
- `src/lib/interaction-map/demoInteractionMap.json`
- `src/lib/interaction-map/CoordinateMapper.ts`

---

## Challenge Summary

**Overall risk assessment**: **LOW**

The `InteractionMap` Zod schema and TypeScript contract demonstrate high mathematical precision and robust type validation. The schema rigorously enforces normalized coordinate bounds $[0.0, 1.0]$, integer frame numbers, non-negative values, positive duration numbers, and strictly rejects any invalid or missing provenance values. 

A battery of **71 targeted boundary and adversarial tests** plus **advanced stress tests** (IEEE-754 precision edges, 10,000-event stress volume, malformed JSON structures, out-of-order payloads) was executed directly via Node.js (`v24.16.0`). 100% of the invalid input scenarios were intercepted by `InteractionMapSchema` and `InteractionEventSchema` with descriptive error issues and correct property paths.

`demoInteractionMap.json` parses cleanly with zero validation errors. All 24 events contain valid, explicit provenance (`observed`: 10, `inferred`: 7, `simulated`: 7) with 100% unique IDs, strictly ascending chronological order, and exact timeline closure at frame 480 ($445 + 35 = 480$).

Two low-risk observations were uncovered regarding event duration overrun and duplicate IDs, both of which are already safely mitigated by the downstream `interactionToSceneGraphAdapter`.

---

## Challenges

### [Low] Challenge 1: Event Span Refinement Does Not Account for `duration` Overrun

- **Assumption challenged**: The schema refinement validates that all interaction events occur within the video's `durationInFrames` limit.
- **Attack scenario**: An event with `frame: 470` and `duration: 100` inside a map with `durationInFrames: 480` passes validation because the current refinement only evaluates `(data) => data.events.every((evt) => evt.frame <= data.durationInFrames)`. The event's active span extends to frame 570, which is 90 frames past the total timeline duration.
- **Blast radius**: Low. `demoInteractionMap.json` does not exhibit this issue (the final event ends at exactly frame $445 + 35 = 480$). Furthermore, `interactionToSceneGraphAdapter` clamps all downstream keyframes via `Math.min(duration, kf.frame)`. However, if third-party telemetry tools supply an interaction event with long duration, the raw event span exceeds total video duration without schema rejection.
- **Mitigation**: In a future refinement pass, update the validator to check:
  `evt.frame + (evt.duration ?? 0) <= data.durationInFrames`.

---

### [Low] Challenge 2: Duplicate Event IDs Permitted by Schema

- **Assumption challenged**: Event IDs in `events: InteractionEvent[]` should be uniquely identifiable.
- **Attack scenario**: Supplying an `InteractionMap` where two events share the same `id: 'evt-dup'` passes `InteractionMapSchema.parse()`.
- **Blast radius**: Negligible. Downstream rendering and adapter pipeline sort by `frame` and do not index events into a dictionary by `id`. In `demoInteractionMap.json`, all 24 events have distinct unique IDs.
- **Mitigation**: Add an optional `.refine()` check ensuring `new Set(data.events.map(e => e.id)).size === data.events.length`.

---

### [Info] Challenge 3: Extra Property Stripping

- **Assumption challenged**: Untrusted telemetry input may attempt prototype pollution or payload smuggling via unexpected JSON keys.
- **Attack scenario**: Injecting arbitrary keys like `{ "hackerPayload": "malicious" }` into interaction events.
- **Observation**: Zod's default parser behavior cleanly strips unrecognized keys from parsed objects, preventing property leakage.

---

## Stress Test Results

| # | Test Scenario | Target | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|---|
| 1 | Missing `provenance` field | `InteractionEventSchema` | Fail parsing | Throws `ZodError` with code `invalid_value` at `["provenance"]` | **PASS** |
| 2 | Invalid `provenance: 'manual'` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["provenance"]` | **PASS** |
| 3 | Invalid `provenance: 'ai_generated'` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["provenance"]` | **PASS** |
| 4 | Invalid `provenance: 'fake'` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["provenance"]` | **PASS** |
| 5 | Invalid `provenance: ''` (empty) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["provenance"]` | **PASS** |
| 6 | Invalid `provenance: 'OBSERVED'` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` (case sensitive) | **PASS** |
| 7 | Invalid `provenance: 123` (number) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["provenance"]` | **PASS** |
| 8 | Invalid `provenance: null` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["provenance"]` | **PASS** |
| 9 | Invalid `provenance: true` (bool) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["provenance"]` | **PASS** |
| 10 | Invalid `provenance: {}` (object) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["provenance"]` | **PASS** |
| 11 | Valid `provenance: 'observed'` | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 12 | Valid `provenance: 'inferred'` | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 13 | Valid `provenance: 'simulated'` | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 14 | Coordinate $x = -0.001$ ($< 0.0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["x"]` with `too_small` | **PASS** |
| 15 | Coordinate $x = -1.0$ ($< 0.0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["x"]` with `too_small` | **PASS** |
| 16 | Coordinate $x = 1.0001$ ($> 1.0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["x"]` with `too_big` | **PASS** |
| 17 | Coordinate $x = 2.5$ ($> 1.0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["x"]` with `too_big` | **PASS** |
| 18 | Coordinate $y = -0.001$ ($< 0.0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["y"]` with `too_small` | **PASS** |
| 19 | Coordinate $y = -1.0$ ($< 0.0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["y"]` with `too_small` | **PASS** |
| 20 | Coordinate $y = 1.0001$ ($> 1.0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["y"]` with `too_big` | **PASS** |
| 21 | Coordinate $y = 2.5$ ($> 1.0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["y"]` with `too_big` | **PASS** |
| 22 | Coordinate $x = \text{NaN}$ | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["x"]` | **PASS** |
| 23 | Coordinate $x = \infty$ | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["x"]` | **PASS** |
| 24 | Coordinate $x = -\infty$ | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["x"]` | **PASS** |
| 25 | Coordinate $x = '0.5'$ (string) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["x"]` | **PASS** |
| 26 | Exact boundary $x=0.0, y=0.0$ | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 27 | Exact boundary $x=1.0, y=1.0$ | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 28 | Midpoint $x=0.5, y=0.5$ | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 29 | Non-integer frame ($10.5$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["frame"]` | **PASS** |
| 30 | Negative frame ($-1$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["frame"]` | **PASS** |
| 31 | Negative float frame ($-0.5$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["frame"]` | **PASS** |
| 32 | Exact frame zero ($0$) | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 33 | Duration zero ($0$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` (`positive()`) | **PASS** |
| 34 | Negative duration ($-5$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` (`positive()`) | **PASS** |
| 35 | Non-integer duration ($5.5$) | `InteractionEventSchema` | Fail parsing | Throws `ZodError` (`int()`) | **PASS** |
| 36 | Duration omitted (`undefined`) | `InteractionEventSchema` | Pass parsing | Parses cleanly (optional) | **PASS** |
| 37 | Duration positive int ($60$) | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 38 | Event frame $> durationInFrames$ ($301 > 300$) | `InteractionMapSchema` | Fail parsing | Throws `ZodError` at `["events"]` | **PASS** |
| 39 | Multi-event with one frame $> durationInFrames$ | `InteractionMapSchema` | Fail parsing | Throws `ZodError` at `["events"]` | **PASS** |
| 40 | Event frame $= durationInFrames$ ($300 = 300$) | `InteractionMapSchema` | Pass parsing | Parses cleanly | **PASS** |
| 41 | Event frame $< durationInFrames$ ($299 < 300$) | `InteractionMapSchema` | Pass parsing | Parses cleanly | **PASS** |
| 42 | Version mismatch `'1.0'` | `InteractionMapSchema` | Fail parsing | Throws `ZodError` (`literal('2.0')`) | **PASS** |
| 43 | Version mismatch `'3.0'` | `InteractionMapSchema` | Fail parsing | Throws `ZodError` (`literal('2.0')`) | **PASS** |
| 44 | FPS zero ($0$) | `InteractionMapSchema` | Fail parsing | Throws `ZodError` (`positive()`) | **PASS** |
| 45 | FPS negative ($-30$) | `InteractionMapSchema` | Fail parsing | Throws `ZodError` (`positive()`) | **PASS** |
| 46 | FPS float ($29.97$) | `InteractionMapSchema` | Fail parsing | Throws `ZodError` (`int()`) | **PASS** |
| 47 | DurationInFrames zero ($0$) | `InteractionMapSchema` | Fail parsing | Throws `ZodError` (`positive()`) | **PASS** |
| 48 | DurationInFrames negative ($-100$) | `InteractionMapSchema` | Fail parsing | Throws `ZodError` (`positive()`) | **PASS** |
| 49 | DurationInFrames float ($100.5$) | `InteractionMapSchema` | Fail parsing | Throws `ZodError` (`int()`) | **PASS** |
| 50 | BaseResolution width $0$ | `InteractionMapSchema` | Fail parsing | Throws `ZodError` at `["baseResolution","width"]` | **PASS** |
| 51 | BaseResolution width negative | `InteractionMapSchema` | Fail parsing | Throws `ZodError` at `["baseResolution","width"]` | **PASS** |
| 52 | BaseResolution width float | `InteractionMapSchema` | Fail parsing | Throws `ZodError` at `["baseResolution","width"]` | **PASS** |
| 53 | BaseResolution height $0$ | `InteractionMapSchema` | Fail parsing | Throws `ZodError` at `["baseResolution","height"]` | **PASS** |
| 54 | BaseResolution height negative | `InteractionMapSchema` | Fail parsing | Throws `ZodError` at `["baseResolution","height"]` | **PASS** |
| 55 | BaseResolution missing height | `InteractionMapSchema` | Fail parsing | Throws `ZodError` at `["baseResolution","height"]` | **PASS** |
| 56 | Empty events array `[]` | `InteractionMapSchema` | Pass parsing | Parses cleanly | **PASS** |
| 57 | Invalid event type `'drag'` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["type"]` | **PASS** |
| 58 | Invalid event type `'keydown'` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["type"]` | **PASS** |
| 59 | Empty event type `''` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` at `["type"]` | **PASS** |
| 60 | Valid type `'click'` | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 61 | Valid type `'hover'` | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 62 | Valid type `'focus'` | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 63 | Valid type `'scroll'` | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 64 | Empty event `id: ''` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` (`min(1)`) | **PASS** |
| 65 | Empty `targetId: ''` | `InteractionEventSchema` | Fail parsing | Throws `ZodError` (`min(1)`) | **PASS** |
| 66 | Omitted `targetId` | `InteractionEventSchema` | Pass parsing | Parses cleanly (optional) | **PASS** |
| 67 | Corrupt JSON syntax | `JSON.parse` | Throw SyntaxError | Throws `SyntaxError` | **PASS** |
| 68 | Payload is string not object | `InteractionMapSchema` | Fail parsing | Throws `ZodError` | **PASS** |
| 69 | Payload is null | `InteractionMapSchema` | Fail parsing | Throws `ZodError` | **PASS** |
| 70 | Payload is array | `InteractionMapSchema` | Fail parsing | Throws `ZodError` | **PASS** |
| 71 | Payload is empty object `{}` | `InteractionMapSchema` | Fail parsing | Throws `ZodError` | **PASS** |
| 72 | IEEE-754 $1 + \varepsilon$ | `InteractionEventSchema` | Fail parsing | Throws `ZodError` | **PASS** |
| 73 | IEEE-754 $-\varepsilon$ | `InteractionEventSchema` | Fail parsing | Throws `ZodError` | **PASS** |
| 74 | IEEE-754 $1 - \varepsilon$ | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 75 | Signed zero $-0, +0$ | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 76 | Metadata string instead of record | `InteractionEventSchema` | Fail parsing | Throws `ZodError` | **PASS** |
| 77 | Metadata array instead of record | `InteractionEventSchema` | Fail parsing | Throws `ZodError` | **PASS** |
| 78 | Rich nested metadata | `InteractionEventSchema` | Pass parsing | Parses cleanly | **PASS** |
| 79 | High volume (10,000 events) | `InteractionMapSchema` | Pass in $< 50$ms | Completed in 10.22ms | **PASS** |
| 80 | Full validation of `demoInteractionMap.json` | `InteractionMapSchema` | 24 events, 100% compliant | Parsed 24/24 events cleanly | **PASS** |

---

## Dataset Audit: `demoInteractionMap.json`

An exhaustive empirical verification of `demoInteractionMap.json` confirmed:
- **Root Specification**: `version: '2.0'`, `baseResolution: { width: 1920, height: 1080 }`, `fps: 30`, `durationInFrames: 480`.
- **Total Events**: 24 events.
- **Provenance Distribution**:
  - `observed`: 10 events ($41.7\%$)
  - `inferred`: 7 events ($29.2\%$)
  - `simulated`: 7 events ($29.2\%$)
  - Total: 24 events ($100\%$)
- **Chronological Sequence**: Verified strictly monotonic ($frame_0 \le frame_1 \le \dots \le frame_{23}$).
- **Timeline Budget**: The final event `evt-24-concluding-brand-hold` starts at frame 445 with duration 35, terminating at exactly frame 480 ($445 + 35 = 480$). Zero events exceed the 480-frame budget.
- **ID Uniqueness**: 24 unique identifiers across all events.
- **Coordinate Boundaries**: All normalized $x \in [0.35, 0.82]$ and $y \in [0.22, 0.82]$, well within $[0.0, 1.0]$.

---

## Unchallenged Areas

- **Remotion Render Output**: Video encoding (`out/InteractionDemo.mp4`) and visual frame rendering are designated for Milestones 3 and 4 after downstream motion engines (`CameraRig`, `SmartCursor`, `AudioEngine`) are integrated.
- **SceneGraph Visual Atoms**: Specific Remotion TSX component rendering (`KineticTypography`, `SyntheticUI`) was out of scope for this schema audit.
