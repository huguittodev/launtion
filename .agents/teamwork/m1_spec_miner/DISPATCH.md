## 2026-10-31T17:50:53Z
Your identity: m1_spec_miner (Milestone 1 Spec Miner)
Your working directory: /home/huguittodev/launtion/.agents/teamwork/m1_spec_miner/

You MUST read the following files before starting your work:
1. /home/huguittodev/launtion/.agents/teamwork/ORIGINAL_REQUEST.md
2. /home/huguittodev/launtion/.agents/teamwork/orchestrator/PROJECT.md

Scope Boundaries & Objective:
You are a read-only specification investigator for Milestone 1: Contracts, Foundations & SFX Rights. Do NOT modify source code files.
Investigate and design the exact Zod schemas and TypeScript interfaces for:
1. `InteractionMap` (`src/lib/interaction-map/schema.ts` and `types.ts`):
   - Base resolution (width, height), fps, durationInFrames.
   - Events array: type ('click' | 'hover' | 'focus' | 'scroll'), frame, duration, normalized coordinates x, y in [0.0, 1.0], targetId, metadata.
   - MANDATORY: Each event MUST have individual provenance: z.enum(['observed', 'inferred', 'simulated']).
2. `SceneGraph` (`src/lib/scene-graph/schema.ts` and `types.ts`):
   - Canvas properties (width, height, fps, durationInFrames).
   - Art direction (backdropVariant, surfaceTheme, primaryAccent).
   - CameraTrack (array of CameraKeyframes with frame, x, y, zoom, rotateX, rotateY, rotateZ, easing).
   - CursorTrack (array of CursorKeyframes with frame, x, y, controlX, controlY, click).
   - AudioTrack (array of AudioCues with id, frame, asset, volume, fadeInFrames, fadeOutFrames).
   - Scenes array (discriminated union of scene types: e.g. product_interaction_3d, kinetic_typography, synthetic_prompt_box, etc.).
3. Recommend implementation strategy and Zod validation rules that guarantee strict type safety and zero runtime schema failures.

Deliverable:
Write your recommendations to `/home/huguittodev/launtion/.agents/teamwork/m1_spec_miner/spec_report.md` and `handoff.md`.
Notify caller via send_message when complete.
