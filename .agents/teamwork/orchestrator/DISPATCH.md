## 2026-10-31T17:39:34Z
Sender: c3109210-ff28-4ddb-8ee2-5e35f303389e

Actúa como un equipo de ingeniería de software de élite especializado en motores de motion design deterministas, React, Remotion, física matemática, TypeScript estricto y diseño sonoro publicitario para SaaS. Consolidar el núcleo técnico atómico del motor gráfico y acústico de Launtion y demostrar mediante un showcase que una composición publicitaria de nivel estudio puede ser 100% dirigida por datos de un InteractionMap simulado a través de un SceneGraph, sin animaciones cableadas manualmente en React.

Working directory: /home/huguittodev/launtion
Integrity mode: demo
The team must NOT: copy code from existing open-source projects for core logic, delegate execution to unauthorized external tools or run external scripts without approval (legitimate repository commands such as npm run typecheck, npm run lint, npm run build, node --test, and Remotion render commands are explicitly permitted, and Teamwork agents may collaborate)

## Verification Resources
- Archivos y componentes existentes del repositorio en `remotion/`, `public/sfx/`, `PROJECT_SPEC.md` y `AGENTS.md`.
- Entorno de ejecución de tests unitarios: ejecutador nativo de Node.js (`node --test`). QA debe verificar la versión de Node.js y la compatibilidad con TypeScript (aprobando con el Arquitecto cualquier estrategia de precompilación o strip-types antes de la ejecución; sin nuevas dependencias).

## Requirements

### R1. Lectura Obligatoria de Documentación y Auditoría Previa
Antes de modificar cualquier archivo, todos los agentes deben leer obligatoriamente `AGENTS.md` y `PROJECT_SPEC.md`, cumpliendo sus directrices y utilizando `PROJECT_SPEC.md` como la fuente definitiva de verdad para el alcance del producto. Inspeccionar los componentes existentes en `remotion/` y `public/sfx/` antes de escribir código y clasificar cada uno en una matriz formal (`REUSE`, `REFACTOR`, `REPLACE`, `NEW`). Prohibido reconstruir o duplicar componentes existentes sin aprobación del Arquitecto.

### R2. Contratos Formales Zod y TypeScript
Definir y aprobar los esquemas Zod e interfaces TypeScript para `InteractionMap` y la estructura base de `SceneGraph` antes de programar componentes. Cada evento del `InteractionMap` debe incluir obligatoriamente su procedencia individual (`observed` | `inferred` | `simulated`).

### R3. Pipeline Arquitectónico Desacoplado
Respetar estrictamente el flujo unidireccional: `InteractionMap` → `Interaction-to-SceneGraph Adapter` → `SceneGraph` → `Camera / Motion / Audio Engines` → `Remotion Renderer`. La composición final no debe conectar directamente el `InteractionMap` con componentes visuales obviando el `SceneGraph`. Implementar un adaptador determinista para transformar eventos del `InteractionMap` simulado en instrucciones de `SceneGraph`.

### R4. Implementación Modular por Roles y Propiedad Exclusiva de Archivos
Cada agente implementa o refactoriza exclusivamente sus componentes asignados sin modificaciones concurrentes:
- **Software Architect** (`remotion/Root.tsx`, `remotion/index.ts`, `src/lib/scene-graph/*`): Arbitrar auditoría inicial, aprobar contratos Zod/TS, definir la especificación base de `SceneGraph`, diseñar estrategia de integración sin colisiones y revisar código.
- **Camera Engine** (`remotion/motion-kit/camera/*`): Auditar y refactorizar `CameraRig3D.tsx` resolviendo la física de traslación para mantener el error focal dentro del umbral cuantitativo máximo definido por QA. Estructurar componentes atómicos: `CameraTransform` (cálculo matricial con anclaje arbitrario), `FocalTracker` (coordenadas normalizadas 0.0-1.0), `CameraPath` (interpolación suave continua entre keyframes) y orquestador `CameraRig`.
- **Interaction Engine** (`src/lib/interaction-map/*`): Diseñar esquema formal Zod/TS de `InteractionMap` (resolución base, FPS, duración, eventos `click`, `hover`, `focus`, `scroll` y procedencia individual obligatoria), `CoordinateMapper` (traducción entre normalizado 0-1 y píxeles) y `demoInteractionMap.json`.
- **Motion & Atoms Engine** (`remotion/motion-kit/cursor/*`, `remotion/motion-kit/synthetic-ui/*`, `remotion/motion-kit/typography/*`): Refactorizar `SmartCursor.tsx` añadiendo trayectorias curvas Bezier con punto de control (`BezierPath`), cursor vectorial SVG con clic físico y ripple opcional, y consolidar `SyntheticUI` y `KineticTypography` (clasificar en `REUSE`).
- **Audio & SFX Engine** (`remotion/motion-kit/audio/*`, `public/sfx/*`): Auditar `AudioEngine.tsx` y `public/sfx/`. Crear `AudioTimeline` (planificador determinista por frame), `AudioMixer` (control de ganancia independiente, prevención de distorsión y soporte de polifonía intencionada) y `FadeController` (curvas de entrada y salida reproducibles). Consolidar biblioteca concisa de SFX SaaS con procedencia documentada.
- **QA & Integration Benchmark** (`tests/*`): Verificar la versión de Node.js y la estrategia para ejecutar módulos TypeScript con el test runner nativo (`node --test`), acordando con el Arquitecto cualquier estrategia de precompilación/strip-types sin añadir dependencias no autorizadas. Crear tests unitarios automatizados para esquemas Zod y funciones matemáticas puras, validar estabilidad de cámara asegurando que el error de focal drift no exceda el umbral cuantitativo justificado, ejecutar validaciones de build y supervisar el renderizado final.

### R5. Composición Integrada Guiada por Datos (`InteractiveSurfaceDemo`)
Crear la composición `InteractiveSurfaceDemo` consumiendo `demoInteractionMap.json` a través del adaptador y `SceneGraph`: la cámara viaja y hace zoom a eventos de foco, el cursor recorre arcos Bezier y pulsa en el momento indicado, y el audio reproduce SFX sincronizados al frame exacto del clic y movimiento, con cero animaciones cableadas manualmente en la composición.

### R6. Determinismo Matemático por Frame y Control de Dependencias
Todo cálculo de animación y audio depende exclusivamente del frame actual (sin `Math.random()` sin semilla ni estado asíncrono en render). Las funciones matemáticas de transformación deben ser puras y testeables sin React. No instalar nuevas dependencias ni modificar configuraciones globales (`package.json`, TypeScript, Next.js, Remotion) sin aprobación justificada del Arquitecto. Queda fuera de alcance extensión Chrome, grabador en vivo, llamadas a Gemini, Supabase, autenticación y pasarelas de pago.

## Acceptance Criteria

### Technical Build & Quality Checks
- [ ] `npm run typecheck` ejecuta y finaliza con 0 errores.
- [ ] `npm run lint` ejecuta y finaliza con 0 warnings y 0 errores.
- [ ] `npm run build` ejecuta y compila Next.js exitosamente.
- [ ] Compatibilidad de TypeScript con `node --test` verificada por QA y aprobada por el Arquitecto; tests unitarios para esquemas Zod y funciones matemáticas puras se ejecutan y pasan al 100% sin dependencias no autorizadas.
- [ ] Renderizado Remotion de la composición genera `out/InteractionDemo.mp4` sin errores.

### Visual & Motion Verification
- [ ] El punto focal de la cámara mantiene su estabilidad al hacer zoom, con un error focal medible en píxeles que no supera el umbral cuantitativo máximo definido y justificado por QA según resolución, nivel de zoom y relación de aspecto, verificado mediante tests automatizados.
- [ ] Las transiciones de cámara presentan continuidad e interpolación suave entre keyframes sin saltos abruptos.
- [ ] Las trayectorias de cursor siguen curvas Bezier con arcos de movimiento natural.
- [ ] La composición `InteractiveSurfaceDemo` no contiene animaciones cableadas manualmente en React; el 100% del movimiento, cámara y temporización deriva de `demoInteractionMap.json` a través de `SceneGraph`.

### Audio & Sound Design Verification
- [ ] Los efectos de sonido (SFX) están sincronizados al fotograma exacto del evento correspondiente (clics y transiciones).
- [ ] La reproducción polifónica (ej. solapamiento intencionado de whoosh, beat y clic) se reproduce sin distorsión, clipping ni desfases.
- [ ] Todos los activos SFX utilizados cuentan con procedencia y derechos comerciales documentados.

### Schema & Data Contracts
- [ ] Contratos TypeScript y esquemas Zod para `InteractionMap` y `SceneGraph` están formalmente tipados y validados.
- [ ] Cada evento en `demoInteractionMap.json` especifica explícitamente su campo `provenance` (`observed`, `inferred` o `simulated`).
- [ ] Informe final de QA documenta componentes 100% funcionales, elementos simulados y tareas pendientes para Fase 3.


## 2026-11-02T13:21:22Z
Sender: 8a45be05-a550-4909-8c7a-d4ee23468f5d

Actúa como un equipo de ingeniería de élite de Antigravity (Software Architect, Frontend/UI Designer, AI & Vision Engineer, Sound Design Specialist, Remotion Core Developer, QA & Forensic Auditor). Transformar la arquitectura existente de Launtion en Vidiaura: la plataforma SaaS para crear vídeos publicitarios y de lanzamiento de productos digitales (SaaS) con IA, inspirada en la experiencia de usuario y modelo de AutoAE y con la calidad cinematográfica y diseño sonoro de Base44.

Working directory: /home/huguittodev/launtion
Integrity mode: development

## Reference Material
- Base44 reference video: `/home/huguittodev/.gemini/antigravity/brain/b04c0b6b-e3c2-4c2e-b0ee-ade9a5e6bac8/.user_uploaded/media_1793624149891_e8df0538.mp4`
- Analyzed frames and audio: `out/base44_frames/` and `out/base44_audio.aac`
- AutoAE UX reference: https://autoae.online/ai?browse=saas

## Requirements

### R1. Brand Rebranding to Vidiaura
Renombrar la plataforma a Vidiaura en `package.json`, metadatos, títulos, textos de la interfaz y documentación relevante, asegurando la compatibilidad de los contratos y contratos de datos existentes.

### R2. Single-Entry Landing Page (AutoAE Style)
Rediseñar la página principal (`src/app/page.tsx`) con una interfaz limpia y moderna que elimine el aspecto técnico anterior y disponga de:
- Una barra de entrada central con un input descriptivo ("Describe tu SaaS o qué quieres destacar...").
- Botón/icono para adjuntar archivos multimedia (grabaciones de pantalla o capturas en `.mp4`, `.webm`, `.png`, `.jpg`).
- Botón de acción principal: "Crear Vídeo con IA".
- Galería inferior de estilos en tendencia ("Trending Motion Styles") con los 4 arquetipos (Base44 Studio, Linear Dark, Bento Grid, Kinetic Hook) con botón "Remix with AI" para precargar la configuración con 1 clic.

### R3. Ultra-Minimalist Post-Generation Editor
Rediseñar el editor (`src/app/editor/page.tsx`) ocultando la complejidad técnica (retículas de coordenadas, sliders de cámara y selectores de color hexadecimal):
- Vista centrada en el `<Player>` de Remotion reproduciendo el vídeo en grande.
- Panel lateral con únicamente 3 o 4 textos editables: Titular del gancho (Hook), Propuesta de valor / titular del producto, y Llamada a la acción (CTA).
- Selector rápido de estilo (Base44 Studio, Linear Dark, Bento Grid, Kinetic Hook).
- Selector de formato / relación de aspecto dual (16:9 ↔ 9:16) con re-encuadre automático.
- Botón principal de descarga: "Descargar Vídeo MP4", conectado al Render Worker en segundo plano y descarga automática del archivo resultante.
- Actualización en vivo reactiva e instantánea del reproductor al modificar cualquiera de los textos o selectores.

### R4. Multimodal AI Analysis & SceneGraph Engine
Actualizar los endpoints `/api/creative-director` y `/api/input-intelligence` para:
- Extraer automáticamente el nombre del producto, resumen y paleta de colores de la imagen o vídeo subido (adaptando fondos, bordes de tarjetas 3D y acentos tipográficos a la identidad de la marca).
- Detectar momentos clave de interacción (clics, transiciones, pantallas destacadas).
- Montar automáticamente un storyboard cinematográfico de 5 escenas incrustando la grabación o capturas reales del usuario dentro del marco 3D con zooms dinámicos hacia los elementos clave.

### R5. Motion Kit, 4 Archetypes & Dual Aspect Ratio
Actualizar la composición `InteractiveSurfaceDemo.tsx` y el Motion Kit en Remotion para:
- Soportar el marco 3D reproduciendo el vídeo o captura real del usuario con zoom enfocado en el contenido.
- Implementar los 4 arquetipos de estilo:
  - Base44 Studio: Fondo crema cálido (`#F5F2EB`), fragmentos de UI en 3D parallax, tipografía bold y zoom suave al marco del producto.
  - Linear Dark: Fondo obsidiana (`#0D0D10`), bordes con resplandor neón sutil, micro-animaciones tipo Bento y tipografía ultra-clean.
  - Bento Grid Reel: Retícula dinámica de funcionalidades que convergen en el centro con transiciones elásticas.
  - Kinetic Hook: Palabras gigantes animadas (palabra por palabra con blur/tracking) antes de revelar la app en 3D.
- Soportar alternancia entre formato horizontal (16:9, 1920x1080) y vertical (9:16, 1080x1920) re-encuadrando la cámara 3D automáticamente sin desconfiguraciones ni deriva focal.

### R6. Professional Sound Design & Procedural Audio Mixer
- Ampliar `public/sfx/` con un banco completo de efectos de sonido profesionales para SaaS (CC0 / sintetizados sin derechos): `transition-whoosh-heavy.wav`, `transition-whoosh-fast.wav`, `sound-riser.wav`, `sub-bass-drop.wav`, `click-switch.wav`, `click-soft.wav`, `mechanical-tap-1..4.wav`, `pop-clean.wav`, y `success-chime.wav`.
- Actualizar `AudioMixer.ts` y `AudioEngine.tsx` para alternar proceduralmente entre variantes de clics y tecleo, disparar transiciones según escena, y aplicar sidechain ducking automático (atenuación sutil de la música ambiental ante efectos clave).

## Acceptance Criteria

### UI / UX Simplicity
- [ ] La landing page (`src/app/page.tsx`) presenta una barra de entrada central limpia con input de texto, adjunción de archivos multimedia (.mp4, .webm, .png, .jpg), botón "Crear Vídeo con IA" y galería de estilos con acción Remix.
- [ ] El editor (`src/app/editor/page.tsx`) muestra el `<Player>` de Remotion y un panel lateral con exactamente 3-4 campos de texto editables (Hook, Propuesta de valor, CTA), selectores de estilo y relación de aspecto, y el botón de descarga MP4, sin controles técnicos ni retículas expuestas.
- [ ] La edición de los campos de texto o selectores en el editor actualiza la previsualización del reproductor en vivo sin recargas ni errores de React.

### Motion Graphics & 3D Camera
- [ ] La composición Remotion soporta y renderiza visualmente los 4 arquetipos de estilo (Base44 Studio, Linear Dark, Bento Grid, Kinetic Hook).
- [ ] La cámara 3D y el marco reproducen e incrustan la grabación o captura real aportada por el usuario con zoom hacia los puntos focales.
- [ ] El switcher de relación de aspecto alterna instantáneamente entre 16:9 (1920x1080) y 9:16 (1080x1920) re-encuadrando la cámara 3D dentro de los límites visuales seguros.

### Audio Synchronization & Sound Design
- [ ] Los 10+ archivos de sonido requeridos (`transition-whoosh-heavy.wav`, `transition-whoosh-fast.wav`, `sound-riser.wav`, `sub-bass-drop.wav`, `click-switch.wav`, `click-soft.wav`, `mechanical-tap-1..4.wav`, `pop-clean.wav`, `success-chime.wav`) existen en `public/sfx/` y cuentan con derechos CC0 o síntesis limpia.
- [ ] El motor de audio alterna proceduralmente entre variantes de clics/taps y aplica sidechain ducking sobre la pista de fondo cuando se disparan efectos clave.

### Verification & Quality Assurance
- [ ] `npm test` pasa al 100% (manteniendo los 471 tests existentes y pasando cualquier nuevo test añadido).
- [ ] `npm run typecheck` completa con 0 errores de TypeScript.
- [ ] `npm run lint` completa con 0 errores y advertencias de ESLint.
- [ ] `npm run build` completa con éxito generando la build de producción de Next.js.
- [ ] `npm run render` ejecuta el Render Worker y exporta con éxito un vídeo MP4 reproducible.
