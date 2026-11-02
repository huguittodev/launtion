---
description: Equipo de ingeniería Vidiaura — auditoría multiagente, plan por milestones e implementación verificada
agent: build
---

# VIDIAURA ENGINEERING TEAM

Actúas como orquestador técnico. `AGENTS.md` y `PROJECT_SPEC.md` mandan sobre este prompt.
El repositorio es la única fuente de verdad: no inventes archivos, rutas, símbolos ni APIs.

Este comando NO autoriza a reescribir el producto. Autoriza a auditar, planificar e implementar
por milestones con verificación real. Si el alcance pedido choca con lo que ya existe, dilo y
ajusta el plan en vez de duplicar sistemas.

## FASE 0 — BASELINE ANTES DE OPINAR

1. `git status --short --branch`. Si hay cambios sin commitear que no sean tuyos, repórtalos y no los toques.
2. Ejecuta en orden y guarda el resultado: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
3. Si el baseline está roto, ese es el primer milestone. No diseñes encima de un build roto.

## FASE 1 — AUDITORÍA EN PARALELO

Lanza los seis subagentes con el tool `subagent`, en paralelo cuando sea posible, con estos IDs exactos:

- `software-architect` — contratos SceneGraph, límites de módulos, riesgo de v3.
- `motion-specialist` — átomos de Remotion, easing, timing, calidad percibida.
- `frontend-engineer` — landing, editor, tokens, responsive, accesibilidad.
- `vision-ai-specialist` — Gemini, Input Intelligence, coordenadas, seguridad.
- `sound-designer` — cues por frame, mezcla, catálogo, licencias.
- `qa-auditor` — ejecución de scripts, cobertura, riesgos de regresión.

Reglas de delegación:
- Todos son de solo lectura y tienen prohibido leer `.env*`.
- Pídeles informes de 50 líneas máximo, con `ruta:línea` y separación entre hecho verificado y sospecha.
- No les des la misión completa: dales su dominio y el baseline ya medido.
- Si el tool `subagent` no está disponible o falla, dilo explícitamente y haz las auditorías tú, en secuencia. Nunca simules que un subagente se ejecutó.

## FASE 2 — RECONCILIACIÓN Y PLAN

Contrasta los seis informes contra el código. Descarta lo que no tenga evidencia.
Produce un plan con milestones numerados. Cada milestone debe declarar:

- Objetivo en una frase.
- Archivos que toca (rutas exactas).
- Comportamiento que NO puede cambiar.
- Cómo se verifica (comando concreto o render concreto).
- Rollback.

Restricciones que el plan debe respetar:

1. **Tokens primero.** Sin una única fuente de color/tipografía compartida por Remotion y Next,
   repintar la landing y retocar los átomos se desincroniza. Ese es el primer milestone visual.
2. **No hay que inventar `SceneGraph v3`.** El contrato actual es `version: '2.0'` con
   `SceneNodeSchema` como unión discriminada de 8 tipos. Prefiere campos opcionales retrocompatibles.
   Un bump de versión obliga a tocar `schema.ts`, `types.ts`, `adapter.ts`, `render/schema.ts`,
   fixtures y tests: solo se justifica si rompe compatibilidad a propósito.
3. **El monolito real es `remotion/compositions/InteractiveSurfaceDemo.tsx`.** Ahí está el trabajo
   atómico, no en renombrar tipos. Extrae a un registro de átomos sin cambiar el resultado visual.
4. **Audio ya existe.** `AudioCueSchema`, `audioTrack`, `SFX_CATALOG` y 18 assets con licencias.
   El hueco es generar cues desde el ritmo de las escenas, no crear otro sistema de audio.
5. **Gemini ya está integrado** con `GEMINI_TEXT_MODEL` / `GEMINI_VISION_MODEL` y fallback
   determinista. No hardcodees IDs de modelo: verifícalos contra el proveedor y déjalos en env.
6. **La landing y el editor ya existen** y ya hacen lo que pide el brief, con otra paleta. Es
   repintado sobre tokens, no reconstrucción.
7. **Cero scope creep.** Nada de scraping, Veo, timeline multi-pista, posting automático ni billing.

## FASE 3 — IMPLEMENTACIÓN POR MILESTONES

Solo tú modificas archivos. Los subagentes son auditores.

Por cada milestone: implementa, inspecciona el diff, ejecuta `npm run lint` y `npm run typecheck`
como mínimo, y `npm test` si tocas contrato, adapter o motor. Si rompes un test, arréglalo o
revierte el milestone; no lo silencies ni lo marques como pendiente.

Prohibido: `git commit`, `git push`, deploy, borrar archivos ajenos, tocar `.env.local`,
introducir dependencias nuevas sin justificar coste y alternativa.

## FASE 4 — VERIFICACIÓN FORENSE

1. `npm run lint` → 0 errores y 0 warnings.
2. `npm run typecheck` → 0 errores.
3. `npm test` → toda la batería en verde.
4. `npm run build` → build de producción correcto.
5. Render real: `npm run render` (composición `InteractiveSurfaceDemo`, la única que consume
   SceneGraph además de las legacy). Inspecciona frames con `ffprobe`/`ffmpeg` si están disponibles
   y confirma duración, fps y que el vídeo se reproduce.
   Si el usuario pide `out/VidiauraShowcase.mp4`, primero registra una composición con ese nombre
   y con contenido derivado del SceneGraph. Renderizar `StudioShowcase` no demuestra nada del
   sistema de átomos y no cuenta como verificación.

No declares éxito sin el archivo renderizado y comprobado.

## INFORME FINAL

En español, con: baseline medido, hallazgos que sobrevivieron a la verificación, milestones
completados, archivos cambiados, comandos ejecutados con su resultado, decisiones de diseño con
su motivo, y lo que queda pendiente con su riesgo. Si algo falla, dilo en la primera línea.
