## 2026-11-02T13:48:10Z
You are teamwork_worker assigned to implement Milestone 1: Brand Rebranding & Audio Bank Foundations.
Your working directory is: /home/huguittodev/launtion/.agents/teamwork/m1_worker/

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
/home/huguittodev/launtion/.agents/teamwork/ORIGINAL_REQUEST.md

Also read the scope document:
/home/huguittodev/launtion/.agents/teamwork/orchestrator/PROJECT.md

Read the 3 Explorer handoff packages:
1. /home/huguittodev/launtion/.agents/teamwork/m1_explorer_rebrand/handoff.md and /home/huguittodev/launtion/.agents/teamwork/m1_explorer_rebrand/rebrand.patch
2. /home/huguittodev/launtion/.agents/teamwork/m1_explorer_sfx_synth/handoff.md (contains scripts/generate-sfx.ts and SFX_LICENSES.md)
3. /home/huguittodev/launtion/.agents/teamwork/m1_explorer_audio_engine/handoff.md, /home/huguittodev/launtion/.agents/teamwork/m1_explorer_audio_engine/proposed_schema_and_types.patch, /home/huguittodev/launtion/.agents/teamwork/m1_explorer_audio_engine/proposed_AudioTimeline.ts, and /home/huguittodev/launtion/.agents/teamwork/m1_explorer_audio_engine/proposed_audio_expansion.test.ts

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks (Exclusive Write Ownership):
1. Rebrand platform to Vidiaura:
   - Apply rebrand changes to package.json, src/app/layout.tsx, src/components/Header.tsx, src/components/editor/EditorHeader.tsx, src/components/editor/ExportModal.tsx, src/app/api/render/[id]/download/route.ts, src/lib/ai/gemini-adapter.ts, src/lib/input-intelligence/gemini-vision-adapter.ts.
2. SFX Bank WAV Generation:
   - Create scripts/generate-sfx.ts from m1_explorer_sfx_synth/handoff.md.
   - Run `npx tsx scripts/generate-sfx.ts` to emit all 12 WAV files into public/sfx/:
     transition-whoosh-heavy.wav, transition-whoosh-fast.wav, sound-riser.wav, sub-bass-drop.wav, click-switch.wav, click-soft.wav, mechanical-tap-1..4.wav, pop-clean.wav, success-chime.wav.
   - Update public/sfx/SFX_LICENSES.md with all 18 audio assets.
3. Audio Schemas & Input Intelligence:
   - Extend AudioAssetSchema and AudioAsset in src/lib/scene-graph/schema.ts and types.ts.
   - Extend AllowedMimeTypesEnum in src/lib/input-intelligence/schema.ts to include 'video/webm' and 'image/jpg'.
4. AudioTimeline & Procedural Audio Engine:
   - Update remotion/motion-kit/audio/AudioTimeline.ts to integrate SFX_CATALOG with ducking priorities (priority 2 for whooshes, risers, drops, chimes; priority 1 for taps/clicks), round-robin mechanical-tap-1..4 cycling, click alternation, and scene transition whooshes.
5. Unit Tests:
   - Create tests/audio-expansion.test.ts from m1_explorer_audio_engine/proposed_audio_expansion.test.ts.
6. Verification & Quality Gates:
   - Run `npm test` and verify all tests pass (481+ passing, 0 failing).
   - Run `npm run typecheck` and verify 0 errors.
   - Run `npm run lint` and verify 0 errors and 0 warnings.
   - Run `npm run build` and verify Next.js build succeeds.

Update your progress in /home/huguittodev/launtion/.agents/teamwork/m1_worker/progress.md.
Deliver your completion report in /home/huguittodev/launtion/.agents/teamwork/m1_worker/handoff.md documenting all modified files and verified test/build outputs.
When finished, send a completion message to the caller.
