## 2026-11-02T14:18:37Z

You are teamwork_worker assigned to implement Milestone 2: Motion Kit, 4 Archetypes & Dual Aspect Ratio.
Your working directory is: /home/huguittodev/launtion/.agents/teamwork/m2_worker/

MANDATORY FIRST STEP: Read ORIGINAL_REQUEST.md at:
/home/huguittodev/launtion/.agents/teamwork/ORIGINAL_REQUEST.md

Also read the scope document:
/home/huguittodev/launtion/.agents/teamwork/orchestrator/PROJECT.md

Read the 3 Explorer handoff packages:
1. /home/huguittodev/launtion/.agents/teamwork/m2_explorer_media/handoff.md (and proposed_RealCaptureSurface.tsx, proposed_InteractiveSurfaceDemo_diff.patch, test_plan.ts)
2. /home/huguittodev/launtion/.agents/teamwork/m2_explorer_archetypes/handoff.md (detailed unified diffs for 4 archetypes, KineticTypography, DynamicBackdrop, InteractiveSurfaceDemo)
3. /home/huguittodev/launtion/.agents/teamwork/m2_explorer_aspect_ratio/handoff.md (calculateMetadata in Root.tsx, InteractiveSurfaceDemo-Vertical composition, responsive reframing, RemotionPlayerPreview dynamic container)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks (Exclusive Write Ownership):
1. Schema & Types:
   - Add `MotionArchetypeSchema = z.enum(['base44-studio', 'linear-dark', 'bento-grid', 'kinetic-hook'])` and `archetype: MotionArchetypeSchema.optional()` in `src/lib/scene-graph/schema.ts` and `types.ts`.
2. Real Media Embedding in 3D Surface:
   - Update `remotion/motion-kit/RealCaptureSurface.tsx` to detect `sourceUrl` (or `mediaUrl`) via `resolveMediaType`. When video is present, render Remotion's `<OffthreadVideo>` with `volume={0}` (muted so AudioEngine controls the audio mix) and `objectFit: 'cover'`. When image is present, render Remotion's `<Img>` with `objectFit: 'cover'`. When mock/synthetic, render `children` (e.g. `<InteractiveProductSurface>`).
3. 4 Motion Graphics Archetypes:
   - Implement the visual styles and motion physics in `remotion/compositions/InteractiveSurfaceDemo.tsx`, `remotion/motion-kit/DynamicBackdrop.tsx`, and `remotion/motion-kit/KineticTypography.tsx`:
     - Base44 Studio: warm cream `#F5F2EB` backdrop, 3D parallax UI fragments with Z offsets, bold grotesque typography with soft product zoom.
     - Linear Dark: obsidian `#0D0D10` backdrop, subtle neon glow borders (`rgba(94,106,210,0.3)` or `primaryAccent`), dark precision surfaces, Bento micro-animations.
     - Bento Grid Reel: dynamic grid of feature cards converging at center with elastic spring transitions (`damping: 12, stiffness: 100`).
     - Kinetic Hook: giant animated typography word-by-word with blur (`filter: blur(...)`) and letter tracking before revealing the 3D app surface.
4. Dual Aspect Ratio (16:9 ↔ 9:16) & Dynamic Resolution:
   - In `remotion/Root.tsx`: add `calculateMetadata` to `InteractiveSurfaceDemo` to dynamically inherit `width`, `height`, `durationInFrames`, and `fps` from `props.sceneGraph.canvas`. Register explicit `InteractiveSurfaceDemo-Vertical` composition with `width: 1080, height: 1920, fps: 30, durationInFrames: 480`.
   - In `remotion/compositions/InteractiveSurfaceDemo.tsx`: detect `isVertical = sceneGraph.canvas.width < sceneGraph.canvas.height`. Adapt `RealCaptureSurface` dimensions (960x560 vs 1440x840) and `KineticTypography` font size (58px / 920px max width vs 84px / 1280px) to prevent horizontal clipping.
   - In `src/components/editor/RemotionPlayerPreview.tsx`: dynamic container aspect ratio (`isVertical ? 'aspect-[9/16] max-h-[78vh] mx-auto' : 'w-full aspect-[16/9]'`).
5. Unit & Integration Tests:
   - Create `tests/motion-kit-archetypes.test.ts` to test schema validation, archetype resolution, media type detection, and vertical aspect ratio bounds.
6. Verification & Quality Gates:
   - Run `npm test` and verify all tests pass (503+ passing, 0 failing).
   - Run `npm run typecheck` and verify 0 errors.
   - Run `npm run lint` and verify 0 errors, 0 warnings.
   - Run `npm run build` and verify clean Next.js Turbopack build.
   - Run `npm run render` and verify Remotion exports valid MP4.

Update your progress in /home/huguittodev/launtion/.agents/teamwork/m2_worker/progress.md.
Deliver your completion report in /home/huguittodev/launtion/.agents/teamwork/m2_worker/handoff.md.
When finished, send a completion message to the caller.
