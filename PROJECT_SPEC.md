# LaunchMotion — Documento maestro de producto y desarrollo

**Versión:** 1.0  
**Fecha:** 29 de octubre de 2026  
**Estado:** Hipótesis de producto / especificación inicial  
**Nombre:** LaunchMotion es un nombre de trabajo. No se ha comprobado la disponibilidad de marca, dominio ni usuario en redes.  
**Idioma inicial:** español para el producto y la documentación; arquitectura preparada para internacionalización.  
**Responsable:** fundador individual.  

> **Cómo utilizar este documento:** debe ser la fuente de verdad inicial para el proyecto. El código, las decisiones técnicas y los prompts de los agentes de programación deben respetar este documento. Cuando se cambie una decisión importante, actualizar la sección correspondiente y el registro de decisiones. La tecnología y sus licencias deben comprobarse de nuevo antes de publicar el producto.

---

## En una página

**Concepto:** convertir capturas y grabaciones reales de un producto digital en vídeos promocionales de nivel estudio mediante motion graphics avanzados (cámara 3D, seguimiento de cursor, átomos de UI sintética y tipografía cinética), música y efectos de sonido sincronizados al fotograma.

**Público inicial:** fundadores de SaaS, indie hackers y pequeños equipos B2B que necesitan vídeos promocionales con calidad de agencia sin el coste ni la complejidad de After Effects.

**MVP:** motor de motion design basado en Scene Graph declarativo + Motion Kit en Remotion, preview interactivo con personalización visual en vivo y exportación MP4.

**Stack base:** Next.js + TypeScript + Tailwind, Remotion, Gemini (multimodal y estructurado), Supabase y un worker Node para los renderizados.

**Prioridad comercial:** validar que el resultado visual es tan profesional como las referencias de mercado (estilo Base44) y conseguir compradores antes de añadir infraestructura compleja.

**Riesgo técnico que debe resolverse pronto:** asegurar fluidez visual de 60/30 FPS en la cámara 3D y sincronización matemática del audio sin errores de render.

**Cómo navegar:** los apartados están numerados; utiliza el panel de navegación por títulos de Word/Docs o busca el título de la sección en el Markdown.

---

## 1. Resumen ejecutivo

LaunchMotion es una plataforma web que convierte recursos reales de un producto digital —capturas de pantalla, grabaciones de pantalla, logotipo, colores y una breve descripción— en vídeos de lanzamiento con motion graphics de alto impacto, preparados para publicar en redes sociales, páginas de producto o Product Hunt.

No es un generador de diapositivas con plantillas rígidas ni un generador cinematográfico generalista. El enfoque consiste en **cerrar la brecha entre los grabadores de pantalla simples (como Screen Studio) y las agencias de motion design caras**:
- La interfaz real del producto es el protagonista, con acercamientos 3D fluidos y seguimiento de cursor de alta nitidez.
- Se intercalan escenas conceptuales de producto generadas a medida (cajas de prompt animadas, botones hero aislados, conexiones de integraciones, matrices de iconos transformándose, árboles de código).
- La IA actúa como **Director Creativo**, determinando el ritmo, la narrativa y el Scene Graph, mientras nuestro motor de **Motion Kit** en Remotion ejecuta la animación de forma determinista, libre de errores y completamente editable por el usuario.

### Hipótesis central

Fundadores de SaaS y equipos de producto necesitan vídeos promocionales con acabado de estudio pero no pueden pagar 3.000€–10.000€ a una agencia ni quieren vídeos planos que parezcan plantillas genéricas. Pagarán por un motor que genere piezas dinámicas, únicas para su producto, con cámara 3D, sonido sincronizado y posibilidad de personalizar elementos en segundos.

Esta hipótesis **aún debe validarse**. Los competidores existentes demuestran que la categoría existe, pero no prueban que este producto concreto tenga demanda suficiente ni que pueda captar clientes a un coste rentable.

### Resultado que debe ofrecer el MVP

En menos de diez minutos, un usuario debería poder subir sus recursos, obtener un guion editable, generar una vista previa y descargar un vídeo promocional de 15–30 segundos con sonido sincronizado.

### Métrica principal

**Vídeos exportados por usuario activado**, complementada con el porcentaje de usuarios que exportan un segundo vídeo y la conversión a pago. No se considerará éxito tener muchas visitas o registros si nadie termina y exporta un vídeo.

---

## 2. Visión, problema y propuesta de valor

### 2.1 Problema

Los fundadores de productos digitales necesitan publicar demostraciones, novedades y anuncios regularmente. Crear una pieza que parezca profesional suele implicar varias tareas: preparar capturas, escribir un guion, organizar escenas, editar, añadir movimiento, sincronizar sonido, adaptar proporciones y exportar. La combinación consume tiempo y requiere conocimientos de edición o motion design.

### 2.2 Propuesta de valor

**“Convierte las capturas de tu producto en vídeos de lanzamiento profesionales, con motion graphics y sonido, sin tener que editar cada escena a mano.”**

La promesa se centra en ahorrar tiempo de edición y producir contenido fiel al producto. No se debe prometer viralidad, aumento de ventas ni calidad equivalente a cualquier vídeo producido por un estudio profesional.

### 2.3 Diferenciación que se quiere probar

- Priorizar interfaces reales aportadas por el usuario; no dejar que el modelo invente pantallas o texto de producto.
- Plantillas de motion graphics diseñadas específicamente para interfaces de software.
- Storyboard que explique una funcionalidad, en lugar de limitarse a aplicar transiciones a imágenes.
- Sonido integrado: música de fondo y efectos sincronizados con la entrada de títulos, cambios de escena y elementos destacados.
- Salidas adaptadas a formatos sociales.
- Flujo breve, predecible y con controles sencillos; no crear un editor de vídeo complejo.

### 2.4 Mensaje que debe evitarse

No posicionar LaunchMotion como “Higgsfield gratuito”, “la mejor IA de vídeo” ni “un vídeo profesional con un clic garantizado”. Son promesas demasiado amplias y difíciles de cumplir. El posicionamiento inicial es: **vídeos de producto para SaaS basados en recursos reales, con buen diseño, movimiento y sonido**.

---

## 3. Usuario objetivo y posicionamiento

### 3.1 Público inicial

**Segmento primario:** fundadores de micro-SaaS, indie hackers, desarrolladores independientes y pequeños equipos B2B que ya tienen un producto funcional y necesitan publicar demos o novedades.

**Segmento secundario:** agencias pequeñas que preparan vídeos de producto para varios clientes. Este segmento puede requerir más control de marca, proyectos y exportaciones; no se prioriza hasta validar el flujo principal.

### 3.2 Usuario adecuado

- Tiene una web o aplicación que mostrar.
- Puede facilitar capturas o una grabación de pantalla.
- Publica en X, LinkedIn, Product Hunt, YouTube Shorts o su propia landing.
- Valora la rapidez y la consistencia por encima de un control manual avanzado.
- No quiere empezar desde una línea de tiempo vacía.

### 3.3 Usuario no prioritario al inicio

- Creadores que necesitan películas cinematográficas generadas desde cero.
- Equipos que exigen un editor profesional multipista y libertad total de edición.
- Empresas con procesos legales, marcas y aprobaciones complejas, hasta que exista una versión madura.
- Usuarios que esperan vídeo generativo de alta fidelidad, avatares o escenas realistas como función central.

### 3.4 Mercado inicial

Lanzamiento inicial en español para reducir fricción de producto y soporte, mientras el contenido de marketing puede probarse en español e inglés. Si la demo y las primeras señales de pago aparecen en el mercado global de indie hackers, añadir inglés será prioritario.

No asumir que X o Reddit producirán ventas automáticamente. El lanzamiento debe combinar contenido demostrativo con conversación real con usuarios potenciales.

### 3.5 Alternativas y competencia

La categoría incluye herramientas de generación de anuncios a partir de URL o imágenes, editores con plantillas, productos de IA de vídeo y editores manuales. Por eso, la diferenciación tiene que comprobarse con pruebas de resultado y disposición a pagar, no solo con una interfaz atractiva.

---

## 4. Principios de producto y no objetivos

### Principios

1. **Calidad por encima de cantidad de funciones.** Una plantilla sobresaliente es mejor que diez mediocres.
2. **Fidelidad visual.** El producto no debe inventar funciones, textos ni interfaz.
3. **Revisión humana.** La IA propone un guion; el usuario puede corregir antes de renderizar.
4. **Previsibilidad.** Una misma entrada y configuración deben producir una composición reproducible, salvo pequeñas diferencias explícitas.
5. **Sonido desde el MVP.** Un vídeo comercial no debe exportarse accidentalmente sin música o sin la pista de efectos configurada.
6. **Costes conocidos.** Antes de renderizar, el sistema debe saber qué límites y coste aproximado aplica al trabajo.
7. **Arquitectura pequeña.** No construir infraestructura de gran escala antes de tener uso real.
8. **No ocultar limitaciones.** Si falla la lectura de una fuente, la IA o el render, mostrar un error recuperable y útil.

### No objetivos del primer MVP

- Competir con modelos generativos de vídeo cinematográfico.
- Generar automáticamente escenas realistas con Veo u otro modelo.
- Raspar páginas web arbitrarias de forma automática.
- Editor de vídeo multipista profesional.
- Publicación directa en todas las redes sociales.
- Gestión de equipos, roles empresariales y aprobación colaborativa.
- Analítica de visualizaciones, retención o conversiones de redes sociales.
- Generación de avatares o clonación de voces.
- Integración con todo tipo de bancos de música.
- Aplicación móvil nativa.

Estas funciones podrán evaluarse después de validar el uso recurrente.

---

## 5. Alcance por fases

Es importante no confundir un prototipo construido en un día con un SaaS listo para producción. El primer día puede producir una demo útil; autenticación, seguridad, cobros, render en segundo plano, límites de uso, cumplimiento y fiabilidad exigen trabajo adicional.

### Fase 0 — Demo visual (objetivo: una jornada de trabajo)

Construir una demo controlada, no un servicio público completo:

- Una página de creación con datos de ejemplo.
- Subida o selección local de unas pocas imágenes/capturas.
- Campo para nombre del producto y descripción.
- Una llamada al modelo para proponer titulares y secuencia de escenas, o un storyboard de ejemplo si no hay API configurada.
- Una composición Remotion de 15–20 segundos, 16:9, con 3–5 escenas.
- Una música preseleccionada y dos o tres efectos con licencias verificadas.
- Preview y render de prueba.

**Criterio de salida:** el vídeo de demostración se ve bien, incluye sonido, es fiel a los recursos y puede mostrarse a usuarios potenciales. No requiere login ni cobros si se utiliza solo para validar la idea.

### Fase 1 — MVP privado

- Autenticación.
- Proyectos guardados.
- Subida de recursos con límites.
- Formulario de marca básico.
- Generación de storyboard estructurado.
- Edición de títulos, textos y orden de escenas.
- Vista previa.
- Render mediante un worker Node independiente.
- Sonido predefinido con música y efectos.
- Exportación MP4.
- Historial de trabajos y errores.
- Límites básicos por usuario.
- Avisos de privacidad, eliminación de proyectos y condiciones de uso.

### Fase 2 — MVP público y monetización

- Onboarding y landing de conversión.
- Plan gratuito con límites definidos o demo sin cuenta.
- Stripe Checkout y control del acceso a exportaciones de pago, si la validación aconseja ese modelo.
- Créditos o límites de render por plan.
- Analítica de activación y exportación.
- Registro de costes por trabajo.
- Política de retención y borrado automatizado.
- Inglés si se confirma demanda internacional.

### Fase 3 — Diferenciación y retención

- Plantillas adicionales con el mismo nivel de calidad.
- Variantes de vídeo horizontal y vertical.
- Importación asistida de una URL con protección SSRF y límites de recursos.
- Voz en off opcional y sincronización de subtítulos.
- Generación de recursos de apoyo con Nano Banana, siempre como opción y no como sustituto de capturas reales.
- Presets de identidad visual reutilizables.
- Duplicación de proyectos y generación de variantes de ganchos.
- API o generación por lotes solo si hay clientes que lo pidan.

### Fuera de alcance hasta validar

Generación de vídeo completo mediante Veo, publicación automática en redes, edición libre de la línea de tiempo, colaboración, marketplace de plantillas y funciones complejas de analítica.

---

## 6. Flujo principal del usuario

1. El usuario entra en la web y entiende qué resultado obtendrá con ejemplos interactivos reales.
2. Inicia un proyecto e introduce el nombre del producto, público objetivo y propuesta de valor.
3. Sube logotipo, colores de marca y recursos reales (capturas de pantalla o clip de vídeo de la app).
4. El sistema analiza los recursos y genera un `InteractionMap` preliminar (detección de clics, zonas de acción o puntos de interés).
5. El agente **Creative Director (Gemini)** genera una propuesta de guion, ritmo y **Scene Graph declarativo** (escenas de interfaz con cámara 3D + escenas conceptuales sintéticas a medida).
6. El usuario visualiza la pieza completa en el reproductor interactivo en tiempo real con música y sonido sincronizado.
7. El usuario puede personalizar cualquier elemento con un clic sobre el preview:
   - Corregir titulares y textos.
   - Ajustar el punto focal del zoom `(x, y)` o la intensidad del zoom arrastrando sobre la pantalla.
   - Modificar colores de acento, iconos o velocidad de transición.
   - Reordenar o regenerar micro-escenas concretas.
8. Pulsa “Generar vídeo”.
9. El render se ejecuta como trabajo en segundo plano en el worker aislado, garantizando 100% de fiabilidad de compilación gracias al Scene Graph validado.
10. Si termina correctamente, el usuario reproduce y descarga el MP4 final a 1080p con audio sincronizado.
11. El proyecto queda guardado y puede duplicarse para generar variantes (ej. formato 9:16 para TikTok/Reels o ganchos alternativos).

### Caminos de error que deben estar diseñados

- Archivo no compatible, demasiado grande o corrupto.
- La IA devuelve JSON de Scene Graph inválido (el validador Zod lo rechaza y fuerza una corrección automática).
- El recurso visual está roto o inaccesible (fallback elegante con placeholder de marca).
- El render falla por memoria, tiempo o codec.
- El usuario cierra la pestaña mientras el render continúa (el estado persiste en la base de datos).
- Se agotan los créditos o se alcanza un límite.
- Se supera el tiempo máximo del trabajo.
- Una pista de audio no se descarga o no tiene permiso para uso comercial.

El sistema debe permitir reintentar sin crear cargos duplicados ni duplicar trabajos sin control.

---

## 7. Requisitos funcionales

### 7.1 Landing page

Debe explicar el resultado, mostrar un vídeo de ejemplo real y ofrecer una llamada a la acción. Evitar frases vacías como “la mejor IA del mundo”.

Secciones recomendadas:

- Hero con el mensaje principal y un ejemplo reproducible.
- Comparación visual de recursos originales frente al vídeo generado.
- Pasos de uso en tres pasos.
- Ejemplos de casos de uso: lanzamiento de una funcionalidad, demo de producto, actualización de versión.
- Explicación de que el usuario revisa el guion antes del render.
- Precios solo cuando exista una hipótesis validada.
- FAQ sobre duración, formatos, sonido, licencia y privacidad.
- CTA para probar o solicitar acceso.

### 7.2 Autenticación y cuenta

Para la versión privada, usar Supabase Auth. Priorizar acceso sencillo mediante email y/o proveedor OAuth si se configura. No guardar contraseñas propias ni gestionar sesiones manualmente.

Requisitos:

- Rutas privadas protegidas en servidor.
- Toda consulta debe autorizar al dueño del recurso.
- Cerrar sesión y recuperación de cuenta probados.
- Nunca exponer claves de servicio de Supabase en el navegador.

### 7.3 Creación de proyecto

Campos mínimos:

- Nombre interno del proyecto.
- Nombre del producto que aparecerá en pantalla.
- Descripción de una frase.
- Público al que se dirige.
- Objetivo: lanzamiento, funcionalidad, demo, actualización.
- CTA.
- Idioma.
- Proporción: 16:9 en demo; 16:9 y 9:16 en MVP público si el coste y la calidad lo permiten.
- Dirección de arte y estilo visual.
- Configuración de sonido y música de fondo.

### 7.4 Carga de recursos

Recursos permitidos inicialmente:

- PNG, JPEG y WebP para imágenes de interfaz.
- MP4 para clips de pantalla, con duración y tamaño limitados.
- SVG para logotipo vectorial.

El sistema deberá validar extensión, MIME real, tamaño, dimensiones y duración. No confiar solo en el nombre o el MIME proporcionado por el navegador.

Límites iniciales sugeridos para pruebas, ajustables según costes: hasta 5 recursos visuales, un clip de pantalla corto, máximo de 25 MB por imagen y 100 MB por vídeo. No convertirlos en promesas públicas antes de verificar la infraestructura.

### 7.5 Perfil de marca

Para la primera versión:

- Color principal y secundario.
- Logo.
- Estilo tipográfico escogido entre fuentes incluidas y con licencia adecuada.
- Preferencia de fondo claro editorial o modo oscuro técnico.
- Tono de texto: técnico, directo o aspiracional.

No permitir subir cualquier fuente arbitraria en el primer MVP.

### 7.6 Generación de Scene Graph (Director Creativo)

La IA genera un **Scene Graph declarativo en JSON**, no JSX ni código React ejecutable. El resultado contiene la estructura completa de la pieza:
- Curva narrativa: gancho, problema, solución en interfaz real, valor conceptual, CTA.
- Pista de cámara 3D: keyframes de encuadre, zoom y rotación para cada momento clave.
- Átomos sintéticos de UI: botones aislados, cajas de prompt, conexiones de integraciones, matrices de iconos.
- Pista de audio: disparadores de efectos sonoros (`soundCue`) sincronizados al fotograma de cada clic, pop o cambio de plano.

El usuario debe poder:
- Editar cualquier texto o titular directamente.
- Mover el punto focal del zoom arrastrando sobre la previsualización.
- Cambiar el recurso vinculado a una escena.
- Eliminar, duplicar o reordenar micro-escenas.
- Regenerar una micro-escena específica con la IA sin rehacer todo el vídeo.

### 7.7 Editor visual de personalización de átomos

En lugar de un editor multipista engorroso o un formulario rígido, la interfaz de personalización ofrece edición contextual directa:
- Miniaturas de cada micro-escena en tira inferior interactiva.
- Clic en cualquier elemento del preview para editar sus propiedades (texto, icono, color, zoom level).
- Control de punto de interés visual: marcador arrastrable para definir el centro del zoom 3D.
- Sincronización instantánea con `@remotion/player`.

### 7.8 Motion Kit y Dirección de Arte

En lugar de plantillas fijas repetitivas, el sistema utiliza un **Motion Kit composible** regido por perfiles de dirección de arte:
- **Tech Precision (Dark Mode):** fondos oscuros, gradientes sutiles, fuentes mono/sans, cajas de código y terminales, matrices de seguridad/datos.
- **Editorial Clean (Light Mode):** fondos crema/claros, sombras suaves multicapa, tipografía refinada, ventanas flotantes limpias con acentos vibrantes.
- **Punchy Social (High Energy):** ritmo ultra-rápido (cortes cada 1.5s), tipografía cinética gigante, colores de alto contraste y zooms profundos.

### 7.9 Vista previa

Usar Remotion Player para previsualizar la composición con los mismos datos que se enviarán al render.

- Control de reproducción/pausa.
- Indicador de formato y duración.
- Sonido activo y control de volumen.
- Mensaje de estado cuando los medios aún no estén listos.
- Evitar que el preview y el MP4 renderizado diverjan por utilizar composiciones diferentes.

### 7.10 Render y exportación

- MP4 con H.264 y audio AAC o configuración equivalente compatible con navegadores y redes sociales.
- 30 fps inicialmente.
- 1080p para exportación de pago; preview de menor calidad si ayuda a reducir costes.
- 15–30 segundos para la primera versión.
- Mostrar estados: queued, processing, completed, failed, cancelled.
- Ofrecer descarga solo cuando el archivo final exista y se haya verificado.
- Mostrar errores entendibles y posibilidad de reintentar.
- Guardar duración real, resolución, tamaño, versión de plantilla y coste estimado.

### 7.11 Sonido

El sonido forma parte del producto y no es una función cosmética.

Mínimo del MVP:

- Una o varias pistas musicales preseleccionadas con derechos de uso comercial compatibles.
- Efectos de sonido discretos para entradas de título, transiciones y puntos destacados.
- Mezcla automática con música por debajo de los efectos.
- Fundido de entrada y salida.
- Evitar clipping y cambios bruscos de volumen.
- Opción para silenciar la música y conservar los efectos, o exportar sin sonido si el usuario lo pide explícitamente.

La voz en off debe ser opcional y posterior al primer MVP. No clonar voces de personas reales ni usar música comercial sin autorización.

### 7.12 Historial y proyectos

El usuario puede ver proyectos y renders anteriores, duplicar un proyecto y eliminarlo. Los recursos y renders son privados por defecto.

### 7.13 Cobros

No implementar pagos antes de validar el flujo de vídeo. Cuando se haga:

- Stripe Checkout para pagos.
- Webhooks firmados para marcar pagos y suscripciones.
- No confiar en datos enviados por el cliente para conceder créditos.
- Aplicar límites de exportación y hacer idempotentes los cobros y operaciones.
- Guardar el identificador del cliente de Stripe, no los datos completos de tarjeta.

---

## 8. Experiencia visual y páginas

### 8.1 Dirección visual

SaaS premium, limpio y centrado en el resultado. La interfaz de administración puede utilizar un tema oscuro sofisticado, superficies carbón y acentos violeta/cian, pero el vídeo final debe adaptarse al estilo de marca que elija el usuario.

Principios visuales:

- Tipografía clara y jerarquía fuerte.
- Espacios generosos y pocos elementos simultáneos.
- Microanimaciones rápidas y funcionales, sin comprometer el rendimiento.
- La vista previa del vídeo es el elemento visual principal.
- Formularios cortos y pasos guiados.
- Estados vacíos útiles con un ejemplo.
- No usar efectos de brillo como sustituto de una buena composición.
- Accesibilidad básica: contraste, foco visible, navegación por teclado y etiquetas en controles.

### 8.2 Páginas

- `/` — landing pública.
- `/examples` — ejemplos reales, si hay material suficiente.
- `/pricing` — solo cuando haya oferta validada.
- `/app` — panel del usuario.
- `/app/new` — asistente de nuevo proyecto.
- `/app/projects/[projectId]` — detalle y editor del proyecto.
- `/app/renders/[renderId]` — estado del render y descarga.
- `/settings` — cuenta, uso y preferencias.
- `/privacy`, `/terms` — páginas legales revisadas antes de publicar.

### 8.3 Componentes de interfaz

- `ProjectCard`
- `AssetUploader`
- `BrandSettingsForm`
- `StoryboardSceneList`
- `SceneEditor`
- `VideoPreview`
- `AudioStyleSelector`
- `RenderStatus`
- `ExportPanel`
- `UsageMeter`
- `EmptyState`
- `ErrorState`

No crear un sistema de diseño enorme desde el primer día. Reutilizar componentes de forma consistente.

---

## 9. Stack tecnológico

El stack debe permitir iterar rápido, mantener el producto en TypeScript y separar los renderizados del servidor web.

### Frontend y aplicación

- **Next.js App Router + React + TypeScript.** Páginas, rutas y lógica de servidor.
- **Tailwind CSS.** Sistema de estilos.
- **shadcn/ui + Radix UI**, si encaja con el diseño, para controles accesibles sin encerrar la interfaz en un kit rígido.
- **Lucide React** para iconografía.
- **Remotion Player** para previsualizar composiciones.
- **Zod** para validar formularios y datos JSON.
- **React Hook Form** opcional si los formularios lo justifican.

### Base de datos, autenticación y archivos

- **Supabase Postgres** para persistencia.
- **Supabase Auth** para autenticación.
- **Supabase Storage** para recursos y renders, con buckets privados y políticas RLS.
- Migraciones SQL versionadas en el repositorio.

### IA

- **Google GenAI SDK para JavaScript (`@google/genai`)** como integración inicial con Gemini.
- La API, modelo y parámetros deben estar encapsulados en un módulo interno para poder cambiar modelos sin reescribir las funciones de producto.
- Preferir salida estructurada y validar cada respuesta con Zod.
- Modelo seleccionado mediante variable de entorno; no fijar un nombre de modelo por todo el código.
- No hacer llamadas a Gemini desde el navegador con una API key privada.

### Renderizado

- **Remotion** para definir composiciones, escenas y movimiento.
- **`@remotion/renderer`** para renderizado server-side.
- **`@remotion/media`** o el componente de audio recomendado por la versión fijada para incorporar audio de manera sincronizada.
- Worker Node independiente para el renderizado con Chromium y las dependencias necesarias.
- Mantener todas las dependencias de Remotion en versiones compatibles y coordinadas. Fijar versiones exactas y actualizar de forma controlada.

### Cola y trabajos

Para el primer MVP, tabla Postgres de trabajos más un proceso worker que reclama trabajos de forma segura. Si el volumen lo exige, introducir una cola dedicada como BullMQ y Redis. No añadir Redis antes de necesitarlo.

### Pagos (fase posterior)

- Stripe Checkout y webhooks para pagos y suscripciones.

### Calidad y observabilidad

- ESLint y TypeScript strict.
- Vitest para lógica pura.
- Playwright para los principales flujos de usuario.
- Logs estructurados para generación y render.
- Sentry u otra herramienta de errores cuando se despliegue a usuarios externos.

### Despliegue recomendado

- Frontend Next.js en un servicio compatible con Next.js.
- Worker de render en un servicio que permita procesos Node duraderos, Chromium, FFmpeg/codec requerido, almacenamiento temporal y suficiente memoria.
- Supabase para Postgres, Auth y Storage.

No asumir que el render de vídeo largo encaja en funciones serverless con límites de tiempo. Separar el worker evita que una petición HTTP del usuario permanezca abierta durante todo el render.

---

## 10. Arquitectura propuesta — LaunchMotion Engine

```text
Navegador (Next.js UI)
  ├── 01. Input Layer: Capturas de interfaz, clips MP4, branding (colores, logo, fuentes)
  ├── 02. Preview & Editor: @remotion/player interactivo con edición visual directa de átomos
  └── API cliente segura: endpoints autenticados y URLs firmadas de subida

Backend Next.js (Servidor / Gemini Adapter)
  ├── 02. Product Intelligence: Análisis multimodal de capturas/vídeos con Gemini -> InteractionMap
  ├── 03. Creative Director: Generación de narrativa, ritmo de cortes y estructura -> Scene Graph JSON
  └── 04. Validador Zod: Validación estricta de límites, enums, duraciones y coordenadas 3D

Supabase
  ├── Postgres: perfiles, proyectos, scene_graphs, interaction_maps, render_jobs
  ├── Auth: sesiones y RLS estricto por usuario
  └── Storage privado: recursos del usuario, biblioteca de audio licenciada, renders finales

Worker Node de Render (@remotion/renderer)
  ├── 05. Motion Kit + Remotion:
  │     ├── CameraRig3D: interpolación de perspectiva (rotateX, rotateY, zoom, focal point)
  │     ├── SmartCursor: cursor vectorial independiente y nítido con animación de clic
  │     ├── RealCaptureSurface: marcos de ventana SaaS, sombras difusas, spotlights
  │     ├── SyntheticUI: átomos vectoriales aislados (hero buttons, prompt typers, flow nodes)
  │     ├── IconGridMorph: constelaciones de iconos con transiciones de estado
  │     ├── KineticTypography: tipografía rítmica sincronizada con el tempo
  │     └── AudioEngine: música continua + SFX disparados exactamente en el frame de acción
  └── 06. Output Layer: Exportación MP4 H.264 1080p determinista y subida a Storage
```

### Reglas de arquitectura

- El navegador nunca escribe directamente estados privilegiados ni créditos de pago.
- La IA **nunca** devuelve código React/JS ejecutable ni JSX suelto. Devuelve exclusivamente un `Scene Graph` estructurado en JSON validado con Zod.
- La personalización por parte del usuario modifica campos del `Scene Graph` (textos, coordenadas de foco, colores, iconos), garantizando que el proyecto siempre compile sin errores.
- El worker solo procesa trabajos autorizados y no confía en IDs sin comprobar propiedad del usuario.
- Los renderizados son idempotentes y cuentan con un identificador único para evitar ejecuciones duplicadas.
- El estado del render vive en la base de datos; no depende de que el usuario mantenga abierta la pestaña.
- La composición de Remotion es pura y determinista: recibe un objeto `SceneGraph` y lo traduce a fotogramas idénticos en preview y en el render final.
- Mantener separados el Motion Kit, la lógica de inteligencia artificial y el worker de render.

### Entornos

- **Local:** desarrollo, Remotion Studio y render de prueba.
- **Preview/Staging:** pruebas de integración con Supabase y worker en segundo plano.
- **Producción:** infraestructura aislada, variables de entorno protegidas y límites de cuota activos.

---

## 11. Flujo de IA y Scene Graph

### 11.1 Capas del flujo creativo

El proceso creativo no es una simple llamada a un prompt genérico, sino una cadena estructurada en tres niveles:

1. **Product Intelligence:** Examina los datos y las capturas/vídeos del usuario. Extrae el `InteractionMap`:
   - Momentos clave y coordenadas normalizadas `(x, y)` donde ocurre la acción o donde se sitúan botones clave.
   - Resumen del propósito de cada recurso para no asociarlos a ciegas.
2. **Creative Director:** Define el guion técnico y el tempo del vídeo:
   - Gancho inicial contundente (1.5–3s).
   - Secuencia de demostración en producto real con cámara 3D dinámica siguiendo el `InteractionMap`.
   - Micro-escenas conceptuales de alto impacto (UI sintética, botones hero, matrices de iconos).
   - Cierre con llamada a la acción (CTA) y logotipo.
3. **Validador Zod:** Verifica tipos, límites de caracteres para evitar desbordes visuales, rangos de zoom seguros y disparadores de audio permitidos.

### 11.2 Estructura del Scene Graph

El modelo devuelve un JSON formal regido por el siguiente esquema conceptual:

```json
{
  "version": "2.0",
  "projectTitle": "Base44 Launch Video",
  "targetFps": 30,
  "artDirection": {
    "theme": "tech-precision",
    "primaryColor": "#FF5C35",
    "backgroundColor": "#F4F1EA",
    "surfaceColor": "#FFFFFF",
    "textColor": "#141413",
    "accentColor": "#22C55E",
    "fontFamily": "Inter"
  },
  "audioTrack": {
    "trackId": "ambient-drive-120bpm",
    "volume": 0.35,
    "fadeInFrames": 15,
    "fadeOutFrames": 30
  },
  "scenes": [
    {
      "id": "scene-intro-kinetic",
      "type": "kinetic_typography",
      "durationFrames": 60,
      "payload": {
        "words": ["Build", "apps", "that", "scale"],
        "accentWordIndex": 3,
        "symbols": ["/", "<", ">", "*"]
      },
      "soundCues": [{ "frame": 10, "sound": "soft-pop" }]
    },
    {
      "id": "scene-synthetic-prompt",
      "type": "synthetic_prompt_box",
      "durationFrames": 75,
      "payload": {
        "textToType": "I want to build a bike renting app with real-time terrain tracking",
        "typingSpeed": 2,
        "showMicrophone": true,
        "submitOnComplete": true
      },
      "soundCues": [
        { "frame": 5, "sound": "keyboard-typing" },
        { "frame": 65, "sound": "mouse-click" }
      ]
    },
    {
      "id": "scene-product-3d",
      "type": "product_interaction_3d",
      "durationFrames": 90,
      "payload": {
        "assetId": "asset-screenshot-calendar",
        "cameraRig": {
          "initial": { "x": 50, "y": 50, "zoom": 1.0, "rotateX": 8, "rotateY": -5 },
          "target": { "x": 38, "y": 42, "zoom": 2.2, "rotateX": 0, "rotateY": 0 },
          "transitionFrames": 35,
          "easing": "ease-out-cubic"
        },
        "cursor": {
          "show": true,
          "start": { "x": 70, "y": 80 },
          "target": { "x": 38, "y": 42 },
          "clickFrame": 40
        }
      },
      "soundCues": [
        { "frame": 5, "sound": "camera-whoosh" },
        { "frame": 40, "sound": "mouse-click" }
      ]
    },
    {
      "id": "scene-icon-morph",
      "type": "icon_grid_morph",
      "durationFrames": 75,
      "payload": {
        "gridSize": { "rows": 4, "cols": 7 },
        "initialState": { "icon": "warning-triangle", "color": "#EF4444" },
        "targetState": { "icon": "shield-check", "color": "#22C55E" },
        "waveSpeed": 2.5,
        "centerHighlightedIcon": true
      },
      "soundCues": [{ "frame": 20, "sound": "security-ping" }]
    },
    {
      "id": "scene-hero-button",
      "type": "synthetic_hero_button",
      "durationFrames": 60,
      "payload": {
        "buttonText": "Publish",
        "variant": "glow-primary",
        "cursorClick": true,
        "clickFrame": 28
      },
      "soundCues": [{ "frame": 28, "sound": "mechanical-click" }]
    },
    {
      "id": "scene-cta",
      "type": "brand_closing_cta",
      "durationFrames": 90,
      "payload": {
        "productName": "Base44",
        "tagline": "Build it your way",
        "showLogo": true,
        "buttonText": "Start Free"
      },
      "soundCues": [{ "frame": 15, "sound": "brand-chime" }]
    }
  ]
}
```

### 11.3 Validación estricta Zod

- Todo `assetId` referenciado debe pertenecer al usuario y al proyecto activo.
- Las coordenadas de cámara `(x, y)` deben estar normalizadas entre 0% y 100%.
- El valor de `zoom` tiene un límite mínimo (0.8x) y máximo seguro (3.5x) para evitar pixelado extremo o cortes de UI.
- Los tipos de micro-escenas permitidos pertenecen a un enum cerrado del Motion Kit.
- Las cadenas de texto tienen topes máximos por átomo (ej. titulares máx. 50 caracteres, botones máx. 25 caracteres) para garantizar legibilidad perfecta.

---

## 12. Motor de vídeo y Motion Kit

### 12.1 Principio de ejecución

La composición en Remotion es una función puramente determinista:

`MotionEngineComposition({ sceneGraph: SceneGraph })`

Nuestra librería interna **Motion Kit** proporciona las primitivas de animación, cámara y sonido, ensamblando los átomos declarados en el Scene Graph mediante secuencias temporales (`<Sequence />`) sincronizadas al frame exacto.

### 12.2 Componentes del Motion Kit

1. **`<CameraRig3D />`**:
   - Transforma cualquier capa (captura o UI sintética) en un espacio tridimensional mediante CSS 3D (`perspective: 1200px`, `transform: translate3d(...) rotateX(...) rotateY(...) scale(...)`).
   - Físicas suaves calculadas mediante `interpolate()` o muelles `spring()` de Remotion con amortiguación ajustada para evitar rebotes molestos.
   - Sigue dinámicamente el foco `(focusX, focusY)` indicado por el Scene Graph o personalizado por el usuario.

2. **`<SmartCursor />`**:
   - Cursor vectorial SVG nítido renderizado en una capa superior independiente (nunca pixelado, incluso a zoom 3.5x).
   - Movimiento curvo natural desde el origen hasta el objetivo mediante curvas Bezier o easing cúbico.
   - Micro-animación física de presión al pulsar (`scale: 0.88` durante 4 frames) coordinada con la onda de choque en el elemento pulsado.

3. **`<RealCaptureSurface />`**:
   - Marco de aplicación pulido (esquinas redondeadas, barra de ventana minimalista opcional con botones de control, sombra multicapa `box-shadow` suave).
   - Capacidad de *spotlight*: viñeteado o difuminado sutil de la interfaz circundante para centrar la mirada en el área del zoom.

4. **`<SyntheticUI />`**:
   - Biblioteca de componentes vectoriales parametrizables inspirados en las mejores referencias de SaaS:
     - `HeroActionButton`: botón en gran formato aislado con estados hover, click y resplandor de acento.
     - `PromptInputBox`: caja de prompt con cursor titilante, escritura animada caracter a caracter y badges interactivos.
     - `ConnectPill`: conectores animados entre dos servicios (ej. `Connect to → Calendar`).
     - `CodeTreeCard`: árbol de archivos o editor de código sintético con sintaxis destacada.

5. **`<IconGridMorph />`**:
   - Matriz geométrica de iconos vectoriales SVG que realizan transiciones coordinadas en onda radial (como alertas pasando a escudos, cruces pasando a checks o métricas elevándose).

6. **`<KineticTypography />`**:
   - Animación de texto palabra por palabra con tipografía cinética (entradas verticales suaves, máscaras de corte, letras saltarinas sincronizadas con glifos de acento).

7. **`<DynamicBackdrops />`**:
   - Fondos vivos con micro-movimiento: gradientes orgánicos con sutil difuminado gaussiano, cuadrículas técnicas punteadas, mallas vectoriales y temas claros/oscuros.

8. **`<AudioEngine />`**:
   - Mezcla determinista de dos canales:
     - Canal 1 (Música de fondo continua): loop o pista autorizada con volumen calibrado (ej. 30–40%) y fade in/out automáticos.
     - Canal 2 (Efectos sincronizados SFX): sonidos breves (clicks de ratón, pops de texto, swooshes de cámara, campanas de éxito) colocados en el `<Sequence from={cue.frame}>` correspondiente al evento visual.

### 12.3 Reglas de calidad visual inviolables

- Textos legibles en pantalla móvil en todas las escenas clave.
- Ningún zoom 3D recorta elementos esenciales ni desborda los márgenes de seguridad para exportaciones 16:9 o 9:16.
- El cursor vectorial siempre aterriza exactamente en el centro del elemento pulsado.
- El efecto de sonido del clic se reproduce en el frame exacto de máxima pulsación del cursor.
- Los cambios de cámara deben tener una justificación narrativa (resaltar una acción, presentar un beneficio o resolver un flujo), evitando movimientos continuos que mareen al espectador.

---

## 13. Modelo de datos

Esquema conceptual mínimo. Los nombres finales pueden adaptarse, pero no se deben implementar tablas sin definir sus relaciones y permisos.

### `profiles`

- `id` UUID, referencia al usuario de Auth.
- `display_name` opcional.
- `created_at`, `updated_at`.

### `projects`

- `id` UUID.
- `user_id` UUID.
- `name`.
- `product_name`.
- `description`.
- `audience`.
- `goal`.
- `cta`.
- `language`.
- `aspect_ratio`.
- `style_preset`.
- `status`.
- `created_at`, `updated_at`, `deleted_at` opcional.

### `brand_profiles`

- `id`, `user_id`, `project_id` opcional.
- `primary_color`, `secondary_color`.
- `logo_asset_id` opcional.
- `font_preset`.
- `background_mode`.
- `tone`.

### `assets`

- `id`, `user_id`, `project_id`.
- `kind` (`image`, `screen_recording`, `logo`, `music`, `sfx`, `render`).
- `storage_path`.
- `original_filename` sanitizado.
- `mime_type`, `size_bytes`, `duration_seconds` opcional.
- `width`, `height` opcionales.
- `license_metadata` para recursos sonoros o de terceros cuando aplique.
- `created_at`, `deleted_at` opcional.

### `storyboards`

- `id`, `project_id`, `user_id`.
- `version`.
- `schema_version`.
- `data_json` validado.
- `model_id` y parámetros no sensibles, si procede.
- `created_at`.

### `render_jobs`

- `id`, `project_id`, `storyboard_id`, `user_id`.
- `status` (`queued`, `processing`, `completed`, `failed`, `cancelled`).
- `progress` opcional solo si el worker puede calcularlo de forma real.
- `idempotency_key`.
- `attempt_count`.
- `render_settings_json`.
- `output_asset_id` opcional.
- `error_code` y `error_message_public`.
- `started_at`, `completed_at`, `created_at`.
- `duration_ms`, `output_size_bytes`, `estimated_cost` opcionales.

### `usage_events`

- `id`, `user_id`, `project_id`, `render_job_id` opcionales.
- `event_type`.
- `quantity`.
- `provider`, `model` opcionales.
- `estimated_cost`.
- `created_at`.

### `subscriptions` (fase de pago)

- `id`, `user_id`.
- `stripe_customer_id`, `stripe_subscription_id`.
- `status`, `plan_id`, `current_period_end`.
- Los datos definitivos de pago se gestionan por Stripe, no por columnas propias de tarjeta.

### Reglas de base de datos

- Índices en `user_id`, `project_id`, `status` y fechas usadas en las consultas.
- Claves foráneas y borrados deliberados.
- RLS obligatoria en tablas accesibles desde el cliente.
- Los usuarios solo acceden a sus proyectos, assets, storyboards y renders.
- Los recursos de servicio se procesan desde servidor/worker con autenticación y comprobación de propiedad.
- No permitir acceso público por defecto a recursos subidos o vídeos generados.

---

## 14. API y trabajos en segundo plano

Rutas orientativas; revisar la convención de Next.js elegida antes de implementarlas.

- `POST /api/projects` — crear proyecto.
- `GET /api/projects` — listar proyectos del usuario.
- `GET /api/projects/:id` — obtener proyecto autorizado.
- `PATCH /api/projects/:id` — editar campos del proyecto.
- `POST /api/projects/:id/assets` — iniciar carga/registrar recurso.
- `DELETE /api/assets/:id` — borrar recurso autorizado.
- `POST /api/projects/:id/storyboard` — generar storyboard.
- `PATCH /api/storyboards/:id` — guardar versión editada y validada.
- `POST /api/projects/:id/renders` — crear un trabajo idempotente.
- `GET /api/renders/:id` — estado del render.
- `POST /api/renders/:id/cancel` — cancelar si todavía es posible.
- `POST /api/webhooks/stripe` — webhooks en fase de cobro.

### Estados del render

`queued → processing → completed` o `queued/processing → failed`. `cancelled` solo cuando la cancelación se ha confirmado.

Los cambios de estado deben ser transaccionales. Usar heartbeat o bloqueo temporal para que dos workers no procesen el mismo trabajo. Reintentar únicamente errores transitorios y limitar los intentos.

### Seguridad de endpoints

- Verificar sesión en servidor.
- Autorizar el recurso por `user_id`.
- Validar entrada y tamaño de petición.
- Aplicar rate limit en endpoints costosos.
- Evitar exponer stack traces al cliente.
- Añadir clave de idempotencia para los renderizados.
- No aceptar rutas de archivo locales enviadas por el usuario.

---

## 15. Organización del repositorio

Estructura propuesta para un único repositorio TypeScript con aplicación y worker separados por paquetes/directorios. Ajustar según la herramienta de desarrollo y el estado real del repo.

```text
launchmotion/
├── AGENTS.md
├── README.md
├── PROJECT_SPEC.md
├── package.json
├── pnpm-workspace.yaml                 # si se usa monorepo
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (marketing)/
│   │   │   ├── (app)/
│   │   │   └── api/
│   │   ├── components/
│   │   ├── features/
│   │   │   ├── projects/
│   │   │   ├── storyboard/
│   │   │   ├── assets/
│   │   │   └── renders/
│   │   ├── lib/
│   │   │   ├── auth/
│   │   │   ├── supabase/
│   │   │   ├── ai/
│   │   │   ├── validation/
│   │   │   └── server/
│   │   └── tests/
│   └── render-worker/
│       ├── src/
│       │   ├── worker.ts
│       │   ├── queue/
│       │   ├── renderer/
│       │   └── storage/
│       └── tests/
├── packages/
│   ├── video-compositions/
│   │   ├── src/
│   │   │   ├── Root.tsx
│   │   │   ├── schemas/
│   │   │   ├── scenes/
│   │   │   ├── transitions/
│   │   │   ├── audio/
│   │   │   └── presets/
│   ├── shared-types/
│   └── config/
├── supabase/
│   └── migrations/
├── public/
│   ├── demo-assets/
│   └── audio/
└── docs/
    ├── decisions.md
    ├── launch-checklist.md
    └── test-cases.md
```

No es obligatorio crear todos los directorios desde el primer día. Evitar carpetas vacías y no implementar una arquitectura de monorepo completa sin necesidad. Sin embargo, separar el worker de render de la interfaz debe ser una decisión temprana de diseño.

---

## 16. Variables de entorno

Nombres orientativos; nunca incluir secretos reales en este documento ni en el repositorio.

```dotenv
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Supabase (public project URL/key can be client-side as documented)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini: server-side only
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=

# Worker / job processing
DATABASE_URL=
WORKER_CONCURRENCY=1
TEMP_RENDER_DIR=
RENDER_OUTPUT_BUCKET=render-outputs
ASSET_BUCKET=project-assets

# Billing - phase 2
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Observability - optional
SENTRY_DSN=
```

Reglas:

- Añadir `.env.local` y otros ficheros secretos a `.gitignore`.
- Mantener `.env.example` con nombres y valores vacíos.
- No utilizar prefijo `NEXT_PUBLIC_` en claves privadas.
- Separar secretos de staging y producción.
- Rotar una clave si aparece en un commit o captura.
- No imprimir variables de entorno en logs.

---

## 17. Seguridad, privacidad y cumplimiento

Esta sección es una lista de ingeniería, no asesoramiento jurídico. Antes de cobrar o procesar recursos de usuarios reales, revisar las obligaciones aplicables al servicio y sus proveedores.

### 17.1 Archivos del usuario

- Validar tipo real, tamaño, dimensiones, duración y codec.
- Tratar todos los archivos subidos como contenido no confiable.
- No ejecutar archivos ni código procedente de los usuarios.
- Analizar los riesgos de archivos malformados y límites de memoria/CPU.
- Guardar recursos en buckets privados.
- Proporcionar borrado de proyectos y archivos.
- Definir una política de retención; no conservar indefinidamente por defecto.
- Limpiar temporales incluso cuando el render falle.

### 17.2 Autorización

- RLS en tablas y Storage.
- Comprobación de propiedad en servidor y worker.
- URLs firmadas con expiración para descargas.
- No utilizar IDs impredecibles como único control de seguridad.
- No confiar en que ocultar un botón impide la operación.

### 17.3 SSRF y entrada de URL

La URL de una web no forma parte del MVP obligatorio. Si se añade importación automática:

- Bloquear IP privadas, loopback, link-local y endpoints de metadatos.
- Restringir protocolos a HTTP/HTTPS.
- Revalidar el destino después de redirecciones y de cada resolución DNS.
- Limitar redirecciones, bytes transferidos, tiempo y tipos de contenido.
- No ejecutar JavaScript arbitrario ni descargar recursos ilimitados.
- Preferir una función de captura aislada y sin credenciales.

### 17.4 Datos y privacidad

- Publicar una política de privacidad clara.
- Definir finalidad, base jurídica, proveedores y plazos de retención.
- Facilitar eliminación y exportación cuando corresponda.
- Evitar incluir datos personales innecesarios en prompts.
- Revisar las condiciones de tratamiento y retención de los proveedores de IA.
- Evitar almacenar contenido completo en logs.
- Evaluar transferencias internacionales y acuerdos con proveedores.

### 17.5 Propiedad intelectual

El usuario debe confirmar que tiene derechos para utilizar sus capturas, logotipos, grabaciones, voz y música aportados. Incluir mecanismo de reporte y retirada de contenido cuando proceda. Mantener documentación de licencias de las pistas incluidas en la aplicación.

### 17.6 Voz y contenido sintético

La voz en off es posterior al MVP. Si se incorpora, identificar de forma transparente el uso de voz sintética cuando sea pertinente, obtener derechos sobre la voz utilizada y no permitir clonaciones no autorizadas de personas reales.

### 17.7 Costes y abuso

- Límites de peticiones por usuario/IP.
- Límite de tamaño y duración de los vídeos.
- Cuotas diarias o mensuales.
- No permitir renders ilimitados en un plan gratuito sin calcular coste.
- Timeout y límite de memoria para cada trabajo.
- Cancelación y reintentos controlados.

---

## 18. Licencias y costes

### 18.1 Advertencia importante sobre Remotion

No asumir que Remotion es gratuito para cualquier SaaS. Su página oficial de licencias distingue una licencia gratuita para personas/empresas elegibles de un plan **Remotion for Automators** destinado, entre otros casos, a herramientas de creación automática de vídeo. La página consultada el 29 de octubre de 2026 indica un precio de 0,01 USD por render y un mínimo de 100 USD al mes para ese plan. Las condiciones pueden cambiar y la elegibilidad depende del caso concreto.

**Acción obligatoria antes del desarrollo comercial:** revisar la página de licencia y confirmar por escrito o con la documentación vigente qué licencia aplica al producto y al tamaño del equipo. Esta decisión afecta directamente a la economía del negocio.

### 18.2 Costes a medir por vídeo

- Licencia de Remotion aplicable.
- Tiempo de CPU y memoria del worker.
- Almacenamiento de recursos y MP4.
- Transferencia de descarga.
- Peticiones y tokens del modelo de texto.
- Generación opcional de imágenes.
- Música/efectos con licencias comerciales.
- Monitoreo, base de datos y otros servicios.
- Soporte y re-renderizados fallidos.

No fijar precio únicamente mirando el coste de tokens. El renderizado y el almacenamiento pueden ser significativos.

### 18.3 Registro de costes

Por cada render registrar, cuando sea factible:

- Proveedor/modelo de IA y uso facturable.
- Tiempo del worker.
- Tamaño y duración del archivo.
- Reintentos.
- Coste estimado por componente.

Los cálculos iniciales pueden ser aproximados, pero deben distinguir una estimación de un dato real.

---

## 19. Monetización e hipótesis de precio

No definir planes finales hasta entrevistar o probar con usuarios. Hay dos vías iniciales:

### Opción A: servicio piloto

Crear vídeos personalizados para fundadores, manualmente usando el prototipo. Es una vía rápida para probar si alguien pagaría por el resultado antes de automatizar todo el flujo.

### Opción B: SaaS de autoservicio

- Plan gratuito de prueba con límites estrictos o una demo sin cuenta.
- Paquete de créditos o suscripción mensual.
- Vídeos sin marca de agua y formatos adicionales en el plan de pago.
- Límite visible de créditos antes de iniciar el render.

Los precios de prueba, por ejemplo 9–19 € por un pack de vídeos o una cuota mensual de entrada, deben considerarse hipótesis comerciales. No son recomendaciones de precio definitivas ni datos del mercado.

### Principios de precios

- Cobrar por resultado útil, no por el número de prompts.
- Asegurar margen después de render, modelos, almacenamiento y licencia.
- No vender renders ilimitados antes de conocer el coste medio y el peor caso.
- No ofrecer generación de vídeo generativo costosa en el plan gratuito.
- Mostrar los límites de forma transparente.

---

## 20. Lanzamiento y marketing

### 20.1 Canales

**X:** demo de producto, antes/después, decisiones técnicas, pequeños vídeos y aprendizajes de construcción. Objetivo: llegar a fundadores y desarrolladores.

**Reddit:** investigar problemas reales, compartir una demo solo donde las reglas lo permitan y solicitar feedback concreto. No publicar spam repetitivo ni mensajes automatizados.

**@soyhugomora:** contar el proceso de construir y validar el micro-SaaS, mostrar errores y resultados reales y explicar qué aprende el fundador. No inventar ventas ni métricas.

**LinkedIn:** opcional en la primera semana; reutilizar las mejores demos y aprendizajes para fundadores y profesionales B2B.

### 20.2 Secuencia de contenidos inicial

1. “Estoy probando convertir una grabación de pantalla en un vídeo de producto con motion graphics”.
2. Demo visual original → resultado.
3. Cómo se generan los zooms, títulos y efectos de sonido.
4. Qué sale mal: texto ilegible, movimiento excesivo o sonido desincronizado.
5. Pedir a 5–10 fundadores que prueben el flujo.
6. Publicar cambios basados en feedback real.
7. Ofrecer un piloto de pago a quienes hayan demostrado necesidad.

### 20.3 Mensaje comercial

“Convierte capturas o grabaciones de tu SaaS en vídeos de lanzamiento con motion graphics, música y efectos sincronizados. Revisa el guion y exporta sin aprender edición de vídeo”.

### 20.4 Métrica de marketing

Medir no solo impresiones y likes, sino:

- Visitas a la landing desde cada canal.
- Personas que comienzan un proyecto.
- Porcentaje que obtiene preview.
- Porcentaje que exporta.
- Usuarios que vuelven a generar otro vídeo.
- Conversión a pago.
- Coste por usuario activado, aunque el tráfico sea orgánico.

---

## 21. Plan de construcción — LaunchMotion Engine v2

El desarrollo sigue un orden estricto de 8 fases para garantizar calidad visual excepcional antes de añadir capas de backend y persistencia:

### Fase 1 — Motion Kit + Dirección de Arte en Remotion [COMPLETADO - Gate PASS]
Construir las primitivas de estudio en Remotion: `<CameraRig3D>`, `<SmartCursor>`, `<SyntheticUI>`, `<KineticTypography>`, `<IconGridMorph>`, fondos dinámicos y `<AudioEngine>` con sincronización al fotograma.
*Criterio de salida:* Composición de demostración interactiva en Remotion Studio inspirada en las técnicas publicitarias del vídeo de Base44 con calidad visual sobresaliente.

### Fase 2 — InteractionMap [COMPLETADO - Gate PASS]
Especificación y utilidades del formato `InteractionMap`: registro de coordenadas normalizadas `(x, y)`, tiempo `t`, trayectorias de cursor, disparadores de clics y zonas de foco para guiar la cámara 3D y los efectos de sonido.

### Fase 3 — Scene Graph Schema (Zod) + Preview y Personalización Visual [COMPLETADO - Gate PASS]
Definición formal del esquema Zod del Scene Graph. Montar en Next.js la interfaz con `@remotion/player` y panel contextual que permita editar textos, colores, iconos y mover puntos de zoom `(x, y)` directamente sobre el preview en tiempo real sin errores de compilación.

### Fase 4 — Creative Director Agent (Gemini) [COMPLETADO - Gate PASS]
Endpoint de servidor con el agente Creative Director: recibe datos del SaaS y recursos, y genera un Scene Graph balanceado (gancho, demo de producto 3D, escenas sintéticas y CTA) con ritmo y cortes musicales.

### Fase 5 — Input Intelligence (Análisis Multimodal) [COMPLETADO - Gate PASS]
Integración de Gemini Multimodal para analizar capturas o clips de vídeo subidos por el usuario, detectando acciones y sugiriendo el `InteractionMap` inicial editable.

### Fase 6 — Grabador propio integrado [COMPLETADO - Gate PASS]
Herramienta de grabación directa de pantalla en el navegador que registre el vídeo limpio y el stream exacto de eventos del ratón (coordenadas, clics y metadatos básicos del DOM).

### Fase 7 — Render Worker en segundo plano [COMPLETADO - Gate PASS]
Worker Node independiente con cola de trabajos, aislamiento de procesos, control de recursos (Chromium + `@remotion/renderer`) y exportación MP4 H.264.

### Fase 8 — Capa SaaS [COMPLETADO - Gate PASS]
Autenticación y RLS con Supabase, almacenamiento privado de proyectos y exportaciones, límites de uso y pasarela de pago.

---

## 22. Criterios de aceptación y pruebas

### Producto

- Un usuario puede crear un proyecto con nombre, descripción y CTA.
- Puede subir recursos permitidos y recibe errores claros para archivos inválidos.
- La IA genera storyboard válido o el usuario puede usar una plantilla de ejemplo si la IA está desconectada.
- Los textos se pueden editar antes del render.
- El usuario puede previsualizar todas las escenas.
- La composición incluye música y efectos, salvo que el usuario desactive el sonido.
- El archivo descargado se reproduce correctamente y tiene la duración esperada.
- El proyecto se conserva tras refrescar la página.
- Un usuario no puede ver los archivos de otro.

### Calidad visual

- No hay títulos fuera de los límites seguros.
- Los textos clave son legibles a tamaño de pantalla móvil.
- No hay elementos tapados por el logo o por subtítulos.
- Los cambios de escena son intencionados y no aleatorios.
- Los zooms no recortan el elemento relevante.
- El audio está sincronizado y no tiene clipping evidente.
- Música y efectos tienen licencias registradas.
- El vídeo no contiene marca de agua accidental ni artefactos de debug.

### Fiabilidad

- Un trabajo fallido muestra un error entendible.
- Reintentar no crea cobros ni créditos duplicados.
- Cerrar la pestaña no cancela un render válido.
- El worker libera temporales en éxito y en error.
- Un trabajo no puede quedarse en `processing` indefinidamente sin detección.
- Los límites de tiempo, memoria y tamaño están configurados.

### Pruebas automatizadas sugeridas

- Unit tests de esquemas Zod y normalización de storyboard.
- Tests de autorización para proyectos y assets.
- Test de que el render job es idempotente.
- Playwright: alta/login → proyecto → recursos → storyboard → preview.
- Test de render con datos fijos y recursos de test.
- Regresión visual de una composición conocida cuando sea viable.

---

## 23. Métricas y experimentos

### Métricas iniciales

- `project_created`.
- `asset_upload_completed`.
- `storyboard_generated`.
- `preview_played`.
- `render_requested`.
- `render_completed`.
- `render_failed`.
- `export_downloaded`.
- `second_project_created`.
- `checkout_started` y `payment_succeeded` cuando exista pago.

No registrar contenido privado de los usuarios como propiedad de los eventos de analítica.

### Preguntas que validar

1. ¿Los fundadores necesitan vídeos de producto de forma recurrente?
2. ¿Les basta el motion graphics basado en capturas o esperan generación de vídeo realista?
3. ¿La calidad es suficientemente buena sin edición manual?
4. ¿Prefieren 16:9, 9:16 o ambos?
5. ¿Qué pesa más: música, voz en off, branding, velocidad o precio?
6. ¿Qué frecuencia de uso puede justificar una suscripción?
7. ¿Pagarían por un vídeo individual antes de suscribirse?
8. ¿La licencia y coste de Remotion hacen viable el margen esperado?

### Regla de decisión

No escalar a más plantillas ni a vídeo generativo hasta tener evidencia de uso repetido o pago. Elogios, likes y registros gratuitos son señales débiles; las exportaciones completas y compras son señales más fuertes.

---

## 24. Riesgos y mitigaciones

- **Competencia amplia.** Impacto: diferenciación baja. Mitigación: enfocar en demos de SaaS y fidelidad de interfaz; probar con usuarios reales.
- **Calidad visual mediocre.** Impacto: baja conversión. Mitigación: una plantilla excelente, revisión manual de ejemplos y criterios visuales claros.
- **Remotion/licencia cara para automatización.** Impacto: economía inviable. Mitigación: revisar licencia antes del lanzamiento y calcular coste por exportación.
- **Render lento o inestable.** Impacto: mala experiencia. Mitigación: worker independiente, límites y trabajos asíncronos.
- **Costes de IA y render.** Impacto: pérdidas. Mitigación: límites, logging de coste, cuotas y precios con margen.
- **Storyboards irrelevantes.** Impacto: producto parece genérico. Mitigación: contexto específico, salida estructurada y edición humana.
- **Capturas ilegibles.** Impacto: resultado de mala calidad. Mitigación: resolución mínima, previews y límites de zoom/crop.
- **Música sin derechos.** Impacto: riesgo legal. Mitigación: librería pequeña y licencias documentadas.
- **Archivos maliciosos.** Impacto: riesgo de seguridad. Mitigación: validación de formato, aislamiento y límites de recursos.
- **SSRF por URLs.** Impacto: riesgo de seguridad. Mitigación: no incluir scraping en el MVP; protegerlo si se implementa después.
- **Dependencia de una API.** Impacto: fallos o cambios de precio. Mitigación: adaptador de proveedor, variables de modelo y fallback controlado.
- **Marketing orgánico sin ventas.** Impacto: tiempo perdido. Mitigación: probar compra con usuarios concretos y ofrecer servicio piloto.
- **Alcance excesivo.** Impacto: retrasos. Mitigación: bloquear funciones fuera del MVP y medir cada fase.

---

## 25. Registro de decisiones técnicas

- **ADR-001 — Next.js App Router + TypeScript.** Motivo: velocidad de desarrollo y stack conocido. Revisar si la aplicación exige separar frontend y API.
- **ADR-002 — Remotion para las composiciones.** Motivo: vídeo basado en React y control de escenas. Revisar tras verificar licencia y calidad del render.
- **ADR-003 — Arquitectura Scene Graph + Motion Kit (v2).** La IA devuelve exclusivamente un Scene Graph declarativo en JSON validado con Zod, nunca código React/JS libre. El motor Remotion interpreta ese JSON usando primitivas visuales de estudio (`CameraRig3D`, `SmartCursor`, `SyntheticUI`, `KineticTypography`, `IconGridMorph`). Motivo: previene fallos de compilación, elimina vectores de ejecución de código no confiable y permite al usuario personalizar cualquier elemento (textos, puntos de zoom 3D, colores, iconos) con un clic en tiempo real.
- **ADR-004 — Supabase para Auth, Postgres y Storage.** Motivo: reducir infraestructura inicial. Revisar al subir volumen o aparecer requisitos especiales.
- **ADR-005 — Worker Node separado para render.** Motivo: evitar bloqueos y límites HTTP del frontend. Medir costes y rendimiento en staging.
- **ADR-006 — Sonido con recursos autorizados y presets.** Motivo: calidad consistente y coste predecible. Revisar tras feedback de usuarios.
- **ADR-007 — No incluir Veo en el MVP.** Motivo: limitar costes y complejidad. Revisar solo tras validar demanda por vídeo generativo.
- **ADR-008 — No importar URLs arbitrarias en la primera versión.** Motivo: evitar SSRF y complejidad. Diseñar captura aislada si los usuarios lo piden.

---

## 26. Instrucciones para agentes de programación

Estas reglas deben copiarse también al archivo `AGENTS.md` del repositorio.

1. Leer `PROJECT_SPEC.md` antes de implementar una funcionalidad.
2. No generar más alcance del solicitado; construir por fases.
3. Antes de modificar la arquitectura, explicar la decisión y su impacto.
4. TypeScript strict; evitar `any` salvo excepción documentada.
5. Validar entradas de usuario con Zod en el servidor.
6. No generar ni ejecutar código de React/JS procedente del modelo. La IA genera Scene Graphs estructurados en JSON.
7. La IA compone escenas usando exclusivamente los átomos, presets y parámetros autorizados en el esquema Zod del Motion Kit.
8. Nunca exponer `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, claves de Stripe ni secretos en el cliente.
9. Toda consulta de datos debe comprobar propiedad; crear y probar RLS.
10. Todos los paquetes de Remotion deben mantener versiones coordinadas.
11. No ejecutar renders pesados dentro de una petición HTTP larga; usar el worker.
12. Los cambios que afecten a storyboard deben mantener compatibilidad con `schema_version`.
13. Cada estado del render debe tener una transición válida y un error recuperable.
14. No añadir servicios externos, SDKs o dependencias grandes sin justificación.
15. No crear componentes visuales de relleno; priorizar consistencia y accesibilidad.
16. No marcar como terminado algo sin comprobar build, lint y tests pertinentes.
17. No afirmar que una funcionalidad funciona si no se ha ejecutado una prueba que lo demuestre.
18. Mantener `.env.example` actualizado y nunca subir secretos.
19. Documentar cómo ejecutar localmente el frontend y el worker.
20. Si un requisito contradice esta especificación, señalarlo y proponer la menor modificación necesaria.

### Orden recomendado de implementación

1. Composición Remotion de demo con datos fijos.
2. Diseño de una plantilla de alta calidad.
3. Audio sincronizado.
4. UI mínima para configurar props.
5. Storyboard con esquema validado.
6. Preview y exportación.
7. Persistencia y Auth.
8. Worker y cola.
9. Seguridad y tests.
10. Cobros y planes tras validar la demanda.

---

## 27. Referencias oficiales

Las siguientes páginas se consultaron como punto de partida el **29 de octubre de 2026**. Deben revisarse de nuevo antes de implementar porque versiones, precios, límites y licencias cambian.

- [Next.js App Router](https://nextjs.org/docs/app)
- [Instalación de Next.js](https://nextjs.org/docs/app/getting-started/installation)
- [Remotion — componentes](https://www.remotion.dev/docs/components)
- [Remotion — audio](https://www.remotion.dev/docs/media/audio)
- [Remotion — renderer](https://www.remotion.dev/docs/renderer)
- [Remotion — licencias y precios](https://www.remotion.dev/docs/license/pricing)
- [Gemini API — Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview)
- [Gemini API — generación de imágenes (Nano Banana)](https://ai.google.dev/gemini-api/docs/image-generation)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Storage — control de acceso](https://supabase.com/docs/guides/storage/security/access-control)
- [Stripe Billing — suscripciones](https://docs.stripe.com/billing/subscriptions/overview)
