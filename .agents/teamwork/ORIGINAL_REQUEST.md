# Original User Request

## Initial Request — 2026-11-02T13:20:29Z

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
