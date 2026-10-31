## 2026-10-31T17:57:46Z
Your identity: m1_worker (Contracts & Foundations Engineer)
Your working directory: /home/huguittodev/launtion/.agents/teamwork/m1_worker/

You MUST read the following files before starting your work:
1. /home/huguittodev/launtion/.agents/teamwork/ORIGINAL_REQUEST.md
2. /home/huguittodev/launtion/PROJECT_SPEC.md
3. /home/huguittodev/launtion/AGENTS.md
4. /home/huguittodev/launtion/.agents/teamwork/orchestrator/PROJECT.md
5. /home/huguittodev/launtion/.agents/teamwork/m1_spec_miner/spec_report.md
6. /home/huguittodev/launtion/.agents/teamwork/m1_explorer_adapter/adapter_report.md
7. /home/huguittodev/launtion/.agents/teamwork/m1_explorer_demo/demo_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Exclusive File Ownership:
You exclusively own and will create:
- `src/lib/interaction-map/types.ts`
- `src/lib/interaction-map/schema.ts`
- `src/lib/interaction-map/CoordinateMapper.ts`
- `src/lib/interaction-map/demoInteractionMap.json`
- `src/lib/scene-graph/types.ts`
- `src/lib/scene-graph/schema.ts`
- `src/lib/scene-graph/adapter.ts`
- `public/sfx/SFX_LICENSES.md`

Detailed Instructions:
1. Implement `src/lib/interaction-map/types.ts` and `schema.ts`:
   - Use strict Zod and TypeScript.
   - Event types: 'click' | 'hover' | 'focus' | 'scroll'.
   - Mandatory individual event provenance: `z.enum(['observed', 'inferred', 'simulated'])`.
   - Coordinates normalized in [0.0, 1.0].
   - Add schema `.refine()` validating that event frames fall within `durationInFrames`.
2. Implement `src/lib/interaction-map/CoordinateMapper.ts`:
   - Pure mathematical mapping functions: `toPixels`, `toNormalized`, `clamp01`, `fitWithinBounds`.
3. Implement `src/lib/interaction-map/demoInteractionMap.json`:
   - Create the complete 480-frame, 1920x1080 interaction map with all 24 events documented in `demo_report.md` §2.2.
   - Verify every event has an explicit `provenance` ('observed', 'inferred', or 'simulated').
4. Implement `src/lib/scene-graph/types.ts` and `schema.ts`:
   - Canvas settings, artDirection, cameraTrack, cursorTrack, audioTrack, and scenes.
   - Scenes must be a discriminated union of scene types (`kinetic_typography`, `synthetic_prompt_box`, `product_interaction_3d`, `icon_grid_morph`, `synthetic_hero_button`, `synthetic_connect_pills`, `synthetic_code_tree`, `brand_closing_cta`).
5. Implement `src/lib/scene-graph/adapter.ts`:
   - Pure deterministic `interactionToSceneGraphAdapter(interactionMap: InteractionMap): SceneGraph`.
   - Transform interaction events into continuous camera keyframes, cursor Bezier arcs with control points, audio cues for SFX allowlist, and scene sequence nodes.
6. Implement `public/sfx/SFX_LICENSES.md`:
   - Legal commercial clearance document for all 6 existing WAV assets in `public/sfx/` per `demo_report.md` §3.4.
7. Verification Requirements:
   - Run `npm run typecheck` (ensure 0 errors).
   - Run `npm run lint` (ensure 0 errors, 0 warnings).
   - Run a node command validating that `demoInteractionMap.json` passes `InteractionMapSchema.parse()`, is adapted by `interactionToSceneGraphAdapter()`, and the resulting SceneGraph passes `SceneGraphSchema.parse()`.

Deliverables:
- Write `changes.md` and `handoff.md` in `/home/huguittodev/launtion/.agents/teamwork/m1_worker/`.
- Send message upon completion with full build/test verification results.
