# Project: Vidiaura — AI SaaS Video Ad & Launch Platform

## Architecture
Vidiaura transforms screen recordings, screenshots, and simple product prompts into cinematic SaaS promotional and launch videos with Base44-grade motion graphics and AutoAE-grade minimalist UX.

```
                    [ AutoAE-Style Single-Entry Landing Page ]
                               (src/app/page.tsx)
                     /                                  \
  [ Prompt + Media Attachment ]                 [ 1-Click Remix Style ]
                │                                          │
                ▼                                          ▼
   [ Multimodal AI Engine ]                   [ SceneGraph v2.0 State ]
(/api/input-intelligence & creative-director)             │
                │                                          ▼
                └──────────────────────────────► [ Ultra-Minimalist Editor ]
                                                   (src/app/editor/page.tsx)
                                                  - 3-4 Essential Texts
                                                  - 4 Curated Archetypes
                                                  - 16:9 ↔ 9:16 Aspect Switcher
                                                  - Real-time Remotion <Player>
                                                           │
                                                           ▼
                                                [ Remotion Motion Kit ]
                                                  - RealCaptureSurface (<Video>/<Img>)
                                                  - CameraRig3D (Zero Focal Drift)
                                                  - 4 Motion Archetypes
                                                  - Procedural Audio Mixer (Ducking)
                                                           │
                                                           ▼
                                                [ Background Render Worker ]
                                                  (MP4 Export & Auto-Download)
```

## Feature Inventory
Every feature identified during the Survey phase mapped to its assigned milestone.
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Vidiaura Package Identity | Rename package name to `vidiaura` in `package.json` | M1 | Survey R1 |
| 2 | Vidiaura HTML Metadata | Global title and metadata in `src/app/layout.tsx` | M1 | Survey R1 |
| 3 | App Headers & Navigation Branding | Vidiaura branding in `Header.tsx` and `EditorHeader.tsx` | M1 | Survey R1 |
| 4 | AI System Prompt Identity | Executive Creative Director & Vision Analyst rebranded to Vidiaura | M1 | Survey R1 |
| 5 | Export Download Filename | MP4 and JSON export filenames prefixed with `vidiaura-` | M1 | Survey R1 |
| 6 | Schema Backward Compatibility | Invariant guaranteeing `SceneGraphSchema` and contracts remain compatible | M1 | Survey R1 |
| 7 | Expanded AudioAsset Schema | Zod enum admitting all 18 sound assets while preserving legacy assets | M1 | Survey R6 |
| 8 | 12-Piece SaaS SFX Bank | Professional CC0/synthesized sound effects in `public/sfx/` | M1 | Survey R6 |
| 9 | Procedural Keystroke Alternation | Round-robin alternation across `mechanical-tap-1..4` | M1 | Survey R6 |
| 10 | Procedural Click Alternation | Alternation between `click-soft`, `click-switch`, and `mouse-click` | M1 | Survey R6 |
| 11 | Scene Transition SFX Triggers | Automatic transition whooshes on scene boundaries | M1 | Survey R6 |
| 12 | Dynamic Sidechain Ducking | Dynamic attenuation of background music during priority 2 SFX | M1 | Survey R6 |
| 13 | C^1 Soft-Knee Headroom Limiter | Polyphonic volume bounded <= 0.95 (0 digital clipping) | M1 | Survey R6 |
| 14 | Expanded Media MIME Types | Support `.webm` (`video/webm`) and `.jpg` (`image/jpg`) in schemas | M1 | Survey R4 |
| 15 | Real Media 3D Surface Embedding | Render uploaded video (`<Video>`) or image (`<Img>`) in `RealCaptureSurface` | M2 | Survey R5 |
| 16 | Base44 Studio Archetype | Warm cream `#F5F2EB`, 3D parallax UI fragments, bold grotesque typography | M2 | Survey R5 |
| 17 | Linear Dark Archetype | Obsidian `#0D0D10`, subtle neon glow (`0 0 25px`), Bento micro-animations | M2 | Survey R5 |
| 18 | Bento Grid Reel Archetype | Dynamic grid of feature cards converging with elastic springs | M2 | Survey R5 |
| 19 | Kinetic Hook Archetype | Giant animated typography word-by-word with blur and letter tracking | M2 | Survey R5 |
| 20 | Zero-Drift Camera Rig | Analytical 3D transformation guaranteeing focal drift <= 0.5px | M2 | Survey R5 |
| 21 | Dual Aspect Ratio Auto-Reframing | Camera and surface bounds adapting to 16:9 and 9:16 viewports | M2 | Survey R5 |
| 22 | Dynamic Composition Metadata | Remotion `Root.tsx` `calculateMetadata` and vertical composition | M2 | Survey R5 |
| 23 | Central Prompt Input Bar | AutoAE-style input bar ("Describe tu SaaS o qué quieres destacar...") | M3 | Survey R2 |
| 24 | Media Attachment Button | File selector for `.mp4`, `.webm`, `.png`, `.jpg` with preview badge | M3 | Survey R2 |
| 25 | Media Size Guardrail | Client and server validation for 20MB payload limit | M3 | Survey R2 |
| 26 | Primary Action "Crear Vídeo con IA" | Initiates generation and transitions smoothly to editor | M3 | Survey R2 |
| 27 | Trending Motion Styles Gallery | Visual gallery showcasing the 4 archetypes with video/style badges | M3 | Survey R2 |
| 28 | 1-Click "Remix with AI" | Pre-populates prompt and archetype style with 1 click | M3 | Survey R2 |
| 29 | Centered Remotion Player | Full-size Remotion `<Player>` previewing composition cleanly | M3 | Survey R3 |
| 30 | 3-4 Key Editable Texts | Minimalist side panel for Hook, Product Title, Value Prop, CTA | M3 | Survey R3 |
| 31 | Quick Style Archetype Selector | 1-click tile selector switching between the 4 archetypes | M3 | Survey R3 |
| 32 | Dual Aspect Ratio Switcher UI | Toggle between 16:9 Horizontal and 9:16 Vertical with live player update | M3 | Survey R3 |
| 33 | 1-Click "Descargar Vídeo MP4" | Direct export action launching background worker with auto-download | M3 | Survey R3 |
| 34 | Reactive Live Preview | Instant update of Remotion player on any change without reload | M3 | Survey R3 |
| 35 | Technical Controls Encapsulation | Removes coordinate reticles, sliders, and hex pickers from UI | M3 | Survey R3 |
| 36 | Multimodal Landmark Extraction | Vision AI extracting interactive UI landmarks and coordinates | M4 | Survey R4 |
| 37 | Brand & Identity Extraction | Extracting product name, summary, and brand color palette from media | M4 | Survey R4 |
| 38 | Interaction Moment Detection | Identifying clicks, input foci, and primary feature inspect moments | M4 | Survey R4 |
| 39 | 5-Scene Storyboard Assembly | Assembling 480-frame narrative embedding real media in 3D frame | M4 | Survey R4 |
| 40 | Quality Gate Verification | Full test suite (471+), typecheck, lint, Next.js build, MP4 render | M4 | Survey QA |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Brand Rebranding & Audio Bank Foundations | Package renaming, metadata, titles, 12+ SFX WAV synthesis, AudioAsset schema expansion, procedural audio alternation & sidechain ducking, MIME types | none | DONE |
| M2 | Motion Kit, 4 Archetypes & Dual Aspect Ratio | `RealCaptureSurface` media embedding (`<Video>`/`<Img>`), 4 style archetypes, 16:9 ↔ 9:16 auto-reframing, `calculateMetadata` in `Root.tsx` | M1 | IN_PROGRESS |
| M3 | AutoAE Landing Page & Ultra-Minimalist Editor | Redesign `src/app/page.tsx` (AutoAE style) & `src/app/editor/page.tsx` (clean player, 3-4 texts, quick style/ratio selectors, MP4 auto-download) | M1, M2 | PLANNED |
| M4 | Multimodal AI Pipeline & E2E Quality Gates | `/api/creative-director` & `/api/input-intelligence` brand/media extraction & 5-scene assembly; full QA gates (npm test, typecheck, lint, build, render) | M1, M2, M3 | PLANNED |

## Interface Contracts
### AudioAsset Contract
- `AudioAssetSchema`: admits all 18 audio asset keys (`mouse-click`, `camera-whoosh`, `keyboard-tap`, `chime`, `soft-pop`, `ambient-beat`, `transition-whoosh-heavy`, `transition-whoosh-fast`, `sound-riser`, `sub-bass-drop`, `click-switch`, `click-soft`, `mechanical-tap-1..4`, `pop-clean`, `success-chime`).
- Audio files located in `public/sfx/`, 16-bit 44.1kHz mono WAV, CC0 provenance.

### SceneGraph & Canvas Contract
- `canvas.width` and `canvas.height`: supports both `1920x1080` (16:9) and `1080x1920` (9:16).
- `artDirection.backdropVariant`: supports `'light-editorial'`, `'dark-precision'`, `'solid'`, `'aurora-blur'`.
- `node.payload`: supports `url` and `mockInterface` holding user video or image URLs/data-URIs.

### Editor Reducer Action Contract
- `UPDATE_TEXT`: `{ key: string, value: string }`
- `UPDATE_ART_DIRECTION`: `{ primaryAccent?: string, backdropVariant?: BackdropVariant, surfaceTheme?: SurfaceTheme }`
- `SET_ASPECT_RATIO`: `{ aspectRatio: '16:9' | '9:16' }`
- `LOAD_SCENE_GRAPH`: `{ sceneGraph: SceneGraph }`

## Code Layout & Exclusive File Ownership
- **Milestone 1**:
  - `package.json`
  - `src/app/layout.tsx`
  - `src/components/Header.tsx`
  - `src/app/api/render/[id]/download/route.ts`
  - `public/sfx/*`
  - `src/lib/scene-graph/schema.ts`
  - `src/lib/scene-graph/types.ts`
  - `src/lib/input-intelligence/schema.ts`
  - `remotion/motion-kit/audio/*`
- **Milestone 2**:
  - `remotion/Root.tsx`
  - `remotion/compositions/InteractiveSurfaceDemo.tsx`
  - `remotion/motion-kit/synthetic-ui/RealCaptureSurface.tsx`
  - `remotion/motion-kit/typography/KineticTypography.tsx`
  - `remotion/motion-kit/camera/CameraRig3D.tsx`
  - `remotion/motion-kit/camera/CameraRig.tsx`
  - `src/components/editor/RemotionPlayerPreview.tsx`
- **Milestone 3**:
  - `src/app/page.tsx`
  - `src/app/editor/page.tsx`
  - `src/components/editor/EditorHeader.tsx`
  - `src/components/editor/EditorSidebar.tsx`
  - `src/lib/editor/editor-state.ts`
- **Milestone 4**:
  - `src/app/api/creative-director/route.ts`
  - `src/app/api/input-intelligence/route.ts`
  - `src/lib/ai/*`
  - `src/lib/input-intelligence/*`
  - `tests/*`
