# AGENTS.md — Launtion / Vidiaura

`PROJECT_SPEC.md` is the product and architecture source of truth. Read it before changing scope or architecture. Its §21 marks phases 1–8 as `COMPLETADO`; don't rebuild completed subsystems unless the task asks for it.

## Hard rules

1. Implement only the requested phase; don't expand scope proactively.
2. Use strict TypeScript and Zod to validate all untrusted inputs.
3. The AI returns structured Scene Graph JSON (validated with Zod). Never generate or execute raw/untrusted React/JS code from the AI response. The deterministic Remotion engine interprets the Scene Graph using our Motion Kit.
4. Scene atoms, animation presets, camera parameters, fonts, assets and sound cues must come from explicit allowlists and schemas.
5. Keep all AI API keys, service-role keys, Stripe secret keys and server secrets on the server/worker only.
6. Authorize every project, asset, scene graph and render operation by user ownership. Use RLS for Supabase tables and Storage.
7. Coordinate exact versions of all Remotion packages.
8. Do not perform long video renders inside a normal user-facing HTTP request. Enqueue a job and use the render worker.
9. Make render jobs idempotent, time-limited, observable and retry-safe.
10. Add useful errors and never claim success until a build/test/render confirms it.
11. Keep `.env.example` current. Never commit real secrets or user files.
12. Don't add paid APIs, external services or heavy dependencies without explaining why.
13. Do not build URL scraping, Veo video generation, advanced multi-track timeline editing, automated social posting or subscription billing until the phase requirements in `PROJECT_SPEC.md` justify them.
14. Music and sound effects must have documented rights suitable for the intended commercial exports.
15. Test responsive layouts, visual legibility, 3D camera bounds, audio synchronization and error states.

## Repository shape

- Single Next.js 16 App Router app at the repo root. The `apps/` + `packages/` layout in `PROJECT_SPEC.md` §15 is **not** implemented.
- Routes: `/` landing/generation, `/editor` minimalist editor, `/editor/advanced` full studio; route handlers live under `src/app/api/`.
- `src/lib/` is domain logic: `scene-graph/` (contract + InteractionMap adapter), `ai/` and `input-intelligence/` (Gemini + deterministic fallbacks), `render/` (queue/worker/bundler), `supabase/` (clients + persistence), `simple-editor/`, `recorder/`.
- `remotion/` is the deterministic engine: `Root.tsx` registers compositions; `motion-kit/` holds camera, cursor, audio and SyntheticUI primitives.
- `supabase/migrations/*.sql` owns tables, RLS and the private `project-assets` / `rendered-videos` buckets. Storage policies assume the first path segment is `auth.uid()`.
- `tests/` uses Node's built-in test runner. There is no CI config, Jest, Vitest or Playwright.
- `.agents/teamwork/**` contains historical multi-agent handoff notes; ignore it unless the task is about that process.

## Commands

- `npm run dev` — Next dev server (loads `.env.local`).
- `npm test` — full suite from `tests/*.test.ts` (currently ~12s).
- `npx tsx --test tests/<name>.test.ts` — one suite. Route-level tests import the handlers directly and use `NextRequest`; no running server is required.
- `npm run lint` → `npm run typecheck` → `npm test` → `npm run build` — verification order.
- `npm run remotion` — Remotion Studio via `remotion/index.ts`.
- `npm run render` / `npm run render:showcase` / `npm run render:legacy` — MP4s into `out/`.
- `npx tsx scripts/generate-sfx.ts` — regenerate the audio bank; add `--verify` to check existing files.
- `package-lock.json` and `pnpm-lock.yaml` are both committed. Use either manager, but don't regenerate or delete the other lockfile.

## SceneGraph invariants

- `src/lib/scene-graph/schema.ts` (Zod) and `src/lib/scene-graph/types.ts` (TypeScript) are parallel, hand-maintained definitions. Any scene or payload change must update both, plus `remotion/compositions/InteractiveSurfaceDemo.tsx`, fixtures/demo graphs and tests.
- Validate every graph with `SceneGraphSchema.safeParse` before it reaches the player or renderer. `simple-edit.ts` deliberately rejects invalid edits and returns the previous graph.
- Only `InteractiveSurfaceDemo` consumes a `SceneGraph`. `StudioShowcase` and `LaunchDemo` are fixed legacy compositions. `InteractiveSurfaceDemo-Vertical` exists in Remotion Studio, but `src/lib/render/schema.ts` accepts only `InteractiveSurfaceDemo` / `StudioShowcase` / `LaunchDemo`; 9:16 exports go through `InteractiveSurfaceDemo` with a 1080×1920 canvas.
- AI endpoints never emit React/JS. Gemini failures or missing keys return HTTP 200 with a deterministic fallback; check `source` (`gemini` vs `deterministic-fallback`) before assuming the model was used.
- Browser media is memory-only: `draft-store.ts` strips `blob:` / `data:` URLs before `sessionStorage`, and `SimpleEditor` re-embeds the data URI only for export. Don't move large media into persistent storage.
- All `@remotion/*` packages and `remotion` are pinned to exactly `4.0.539`; bump them together.

## Render and persistence gotchas

- `RenderQueue` is an in-memory `Map`, not the `render_jobs` table. Restart, hot reload or a second server instance loses jobs. Files go to `/tmp/launtion-renders`, the bundle cache to `/tmp/launtion-bundle-cache`, and the download route reads local disk.
- Keep renders asynchronous: `POST /api/render` enqueues and returns 202; clients poll `/api/render/:id`.
- With `MOCK_SUPABASE=true` (or no `NEXT_PUBLIC_SUPABASE_URL`), auth returns a fixed mock user and persistence uses the in-memory adapter. Otherwise `.env.local` points at live Supabase. Use mock mode for offline/dev mutations.
- In mock mode, `x-user-id` / `x-user-email` override identity and `Authorization: Bearer invalid` simulates 401. User-scoped routes must rely on Postgres RLS, not the service-role client.
- `.env.local` is gitignored and holds real keys. No `.env.example` exists yet; create/update it when adding variables.
- Add or rename audio end-to-end: `AudioAssetSchema` (`schema.ts`), `AudioAsset` (`types.ts`), `SFX_CATALOG` (`remotion/motion-kit/audio/AudioTimeline.ts`), the WAV in `public/sfx/`, and `public/sfx/SFX_LICENSES.md`.

## Before finishing

- Run the verification order above; render or preview when visual/motion behavior changes.
- Exercise the affected flow, including error handling.
- Report what changed, what was verified, and any outstanding issue.
- Update `PROJECT_SPEC.md` or the decision log when a long-term technical decision changes.

## Branding

The user-facing brand is **Vidiaura**. The repo directory and package metadata still use `launtion` / `vidiaura`, while README and `PROJECT_SPEC.md` say LaunchMotion. Don't mass-rename identifiers or copy as a "cleanup".

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
