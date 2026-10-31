# BRIEFING — 2026-10-31T17:56:45Z

## Mission
Investigate and design the exact Zod schemas, TypeScript types, and validation rules for InteractionMap and SceneGraph for Milestone 1.

## 🔒 My Identity
- Archetype: Specification Miner
- Roles: Specification Investigator, Zod/TypeScript Contract Architect
- Working directory: /home/huguittodev/launtion/.agents/teamwork/m1_spec_miner/
- Original parent: e050f1ce-2de9-448e-9c52-f601bd890052
- Milestone: Milestone 1: Contracts, Foundations & SFX Rights

## 🔒 Key Constraints
- Read-only specification investigator: do NOT modify source code files.
- Each InteractionEvent MUST have individual provenance: z.enum(['observed', 'inferred', 'simulated']).
- SceneGraph must support discriminated unions of scene types, Art Direction, CameraTrack, CursorTrack, AudioTrack.
- Deliver findings to spec_report.md and handoff.md, notify caller via send_message.

## Current Parent
- Conversation ID: e050f1ce-2de9-448e-9c52-f601bd890052
- Updated: 2026-10-31T17:56:45Z

## Task Summary
- **What to build**: Specification report and complete Zod/TS definitions for `InteractionMap` and `SceneGraph`.
- **Success criteria**: Fully specified, edge-case tested schemas with discriminated unions, normalized coordinate boundaries, duration/fps consistency rules, and zero-failure validation strategy.
- **Interface contracts**: `/home/huguittodev/launtion/.agents/teamwork/orchestrator/PROJECT.md`
- **Code layout**: `src/lib/interaction-map/` and `src/lib/scene-graph/`

## Key Decisions Made
- InteractionMap: strictly enforces individual event provenance `z.enum(['observed', 'inferred', 'simulated'])`.
- InteractionMap: coordinates $x, y$ normalized strictly to $[0.0, 1.0]$. Refined to ensure $event.frame \le durationInFrames$.
- SceneGraph: `scenes` modeled as a `z.discriminatedUnion('type', [...])` covering all 8 Motion Kit primitives (`kinetic_typography`, `synthetic_prompt_box`, `product_interaction_3d`, `icon_grid_morph`, `synthetic_hero_button`, `synthetic_connect_pills`, `synthetic_code_tree`, `brand_closing_cta`).
- SceneGraph: `audioTrack` restricts asset names to the 6 documented WAV assets in `public/sfx/`.
- CoordinateMapper: pure class with `toPixels`, `toNormalized`, and `clamp01`.

## Artifact Index
- /home/huguittodev/launtion/.agents/teamwork/m1_spec_miner/spec_report.md — Comprehensive contract specifications and edge cases.
- /home/huguittodev/launtion/.agents/teamwork/m1_spec_miner/handoff.md — 5-component handoff report.
- /home/huguittodev/launtion/.agents/teamwork/m1_spec_miner/progress.md — Liveness heartbeat.
- /home/huguittodev/launtion/.agents/teamwork/m1_spec_miner/DISPATCH.md — Incoming dispatch message archive.

## Loaded Skills
- None.
