# Original User Request

## Parameters
[skip-interview]
How this run was launched; not part of the task.

## Approved Task Prompt — 2026-10-31T17:38:24Z

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


## Follow-up — 2026-10-31T22:02:50Z

# LAUNTION — EJECUCIÓN AUTÓNOMA CONTINUA MULTI-FASE

## MISIÓN
El usuario ha otorgado autonomía total para ejecutar y completar progresivamente las fases pendientes del roadmap de Launtion definidas en `PROJECT_SPEC.md` y `AGENTS.md`, comenzando de inmediato por la **Fase 3** y continuando de forma ininterrumpida por las siguientes fases hasta el producto final.

## REGLAS DE EJECUCIÓN AUTÓNOMA
1. **Sin pausas de confirmación:** No detenerse a preguntar al usuario entre fases ni tras completar hitos. Al completar un hito, auditarlo, corregir cualquier fallo y avanzar automáticamente al siguiente.
2. **Fuente de verdad:** `PROJECT_SPEC.md` y `AGENTS.md` gobiernan las especificaciones, arquitectura y restricciones.
3. **Distribución por roles Teamwork:** Arquitecto (contratos, interfaces, coordinación), Desarrolladores (código atómico, modular, tipado estricto), Investigadores y Auditores/QA (auditoría forense, pruebas de estrés y regresión).
4. **Resolución autónoma de problemas:** Investigar, decidir e implementar la mejor alternativa técnica sin bloquearse. Solo detenerse si hay un bloqueo externo insalvable o una acción destructiva irreversible.
5. **Calidad inviolable:** Cero errores de TypeScript, cero errores de ESLint, tests unitarios automatizados pasando al 100%, Next.js build exitoso y renderizado MP4 verificado en cada fase.

## ROADMAP DE FASES A EJECUTAR

### FASE 3: PREVIEW INTERACTIVO Y PERSONALIZACIÓN VISUAL (@remotion/player)
- Instalar y coordinar `@remotion/player` en la versión exacta `4.0.539` (coordinada con `remotion`).
- Construir en Next.js (`src/app/editor/` o interfaz interactiva) el reproductor web de `InteractiveSurfaceDemo` / `SceneGraph`.
- Panel de personalización reactivo en vivo:
  - Edición en tiempo real de textos (titulares, subtítulos, botones).
  - Selector de temas y colores (`artDirection`: primario, acento, fondo).
  - Control de cámara y puntos focales `(x, y)` interactivos sobre el preview.
  - Visualización del timeline y estado de reproducción.
- Validación de que cualquier cambio en la UI actualiza el `SceneGraph` de forma determinista y segura sin recargar la página ni romper el reproductor.

### FASE 4: CREATIVE DIRECTOR AGENT (GEMINI)
- Adapter de Gemini en el servidor Next.js (`src/lib/ai/` o ruta de API segura `POST /api/creative-director`).
- Prompting de sistema con Structured Outputs forzado mediante el esquema Zod de `SceneGraph`.
- Transforma datos del SaaS (nombre, descripción, objetivo, tono, lista de recursos) en un `SceneGraph` rico y variado (con narrativa, micro-escenas sintéticas, keyframes de cámara 3D y audio sincronizado).
- Fallback determinista y validación estricta Zod en el servidor.

### FASE 5: INPUT INTELLIGENCE (ANÁLISIS MULTIMODAL)
- Endpoint seguro para análisis multimodal con Gemini de capturas de pantalla y clips de vídeo MP4 subidos.
- Extracción inteligente de coordenadas de botones, áreas de acción y sugerencia inicial del `InteractionMap`.

### FASE 6: GRABADOR PROPIO INTEGRADO
- Módulo web en el navegador con `getDisplayMedia` para capturar vídeo de pantalla y registrar eventos del ratón (coordenadas x, y normalizadas, clics, tiempos t).
- Generación directa del `InteractionMap` con procedencia `observed`.

### FASE 7 & 8: WORKER DE RENDERIZADO AISLADO & CAPA SAAS
- Infraestructura de cola de renderizado asíncrono con `@remotion/renderer`.
- Persistencia, esquemas Supabase y autenticación con RLS.

Comenzar inmediatamente por la Fase 3, verificar todos los criterios de aceptación y continuar sin interrupción.
