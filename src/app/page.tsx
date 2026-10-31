import { Header } from '@/components/Header';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-[#1A1A1A]">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-14 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-white border border-[#E5E2DC] text-[#FF5C35] mb-6 shadow-xs">
          Fase 1 Completada • Motion Kit v2
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#181716] leading-tight mb-4">
          Launtion Motion Engine
        </h1>

        <p className="text-lg sm:text-xl text-[#5F5C55] max-w-2xl leading-relaxed mb-8">
          Motor de motion design publicitario de nivel estudio para SaaS, inspirado en las técnicas
          cinemáticas de Base44: Cámara 3D, cursor inteligente, UI sintética, tipografía cinética y audio sincronizado al frame.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white border border-[#ECE8E1] shadow-xs">
            <div className="text-xs font-bold text-[#FF5C35] mb-1">CÁMARA & CURSOR</div>
            <h3 className="text-sm font-semibold text-[#181716] mb-1">CameraRig3D + SmartCursor</h3>
            <p className="text-xs text-[#706C64]">
              Perspectiva 3D con interpolación hacia puntos focales y cursor vectorial SVG con clic físico.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#ECE8E1] shadow-xs">
            <div className="text-xs font-bold text-[#22C55E] mb-1">ÁTOMOS VECTORIALES</div>
            <h3 className="text-sm font-semibold text-[#181716] mb-1">SyntheticUI & IconMorph</h3>
            <p className="text-xs text-[#706C64]">
              Prompt typer, botones hero aislados, connect pills, árbol de código y matrices de iconos en onda.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#ECE8E1] shadow-xs">
            <div className="text-xs font-bold text-[#3B82F6] mb-1">AUDIO & RITMO</div>
            <h3 className="text-sm font-semibold text-[#181716] mb-1">AudioEngine</h3>
            <p className="text-xs text-[#706C64]">
              Pista continua de beat ambiental y efectos de sonido (clics, swooshes, pops, chimes) al milisegundo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-[#ECE8E1]">
          <div className="p-5 rounded-xl bg-white border border-[#ECE8E1] shadow-xs">
            <h2 className="text-sm font-semibold text-[#181716] mb-1">
              Remotion Studio (Previsualización Interactiva)
            </h2>
            <p className="text-xs text-[#706C64] mb-3">
              Abre el estudio interactivo para ver `StudioShowcase` a 1920x1080 @ 30 FPS en tiempo real.
            </p>
            <code className="text-xs bg-[#F5F3EF] px-2.5 py-1 rounded text-[#2A2927] font-mono">
              npm run remotion
            </code>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#ECE8E1] shadow-xs">
            <h2 className="text-sm font-semibold text-[#181716] mb-1">
              Renderizado MP4 de Estudio
            </h2>
            <p className="text-xs text-[#706C64] mb-3">
              Exporta el vídeo completo de 16 segundos con audio sincronizado a `out/StudioShowcase.mp4`.
            </p>
            <code className="text-xs bg-[#F5F3EF] px-2.5 py-1 rounded text-[#2A2927] font-mono">
              npm run render
            </code>
          </div>
        </div>
      </main>
    </div>
  );
}
