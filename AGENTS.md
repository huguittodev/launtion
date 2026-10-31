# AGENTS.md — Launtion

Read `PROJECT_SPEC.md` before making implementation decisions. It is the initial source of truth for product scope, architecture, safety and acceptance criteria.

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

## Preferred implementation order (Launtion Engine v2)

1. **Fase 1 — Motion Kit + Dirección de Arte en Remotion:** Primitivas de estudio (`CameraRig3D`, `SmartCursor`, `SyntheticUI`, `KineticTypography`, `IconGridMorph`, fondos dinámicos y motor de audio sincronizado por frame). Validar con una secuencia publicitaria de nivel Base44 en Remotion.
2. **Fase 2 — InteractionMap:** Formato de coordenadas `(x, y, t)`, trayectorias de cursor, disparadores de clics y puntos focales para guiar la cámara 3D y los efectos de sonido.
3. **Fase 3 — Scene Graph Schema (Zod) + Preview y Personalización Visual:** Esquema declarativo completo y UI con `@remotion/player` que permita editar textos, colores, iconos y mover puntos de zoom `(x, y)` en vivo sin errores.
4. **Fase 4 — Creative Director Agent (Gemini):** Generación automática de guion, ritmo, cortes musicales y Scene Graph variado a partir de los datos del producto.
5. **Fase 5 — Input Intelligence:** Análisis multimodal con Gemini sobre vídeos MP4 y capturas subidas para proponer puntos de interés e InteractionMap inicial editable.
6. **Fase 6 — Grabador propio:** Captura directa de vídeo de pantalla + coordenadas reales del ratón y clics en el DOM.
7. **Fase 7 — Render Worker en segundo plano:** Cola de trabajos, aislamiento de procesos, control de recursos y exportación MP4.
8. **Fase 8 — Capa SaaS:** Supabase Auth/RLS, persistencia de proyectos, almacenamiento y pagos.

## Before finishing a task

- Run the relevant lint, typecheck, tests and build.
- Test the affected flow, including error handling and visual output.
- State what changed, what was verified, and any outstanding issue.
- Update `PROJECT_SPEC.md` or the decision log when a long-term technical decision changes.
