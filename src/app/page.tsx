import { Header } from '@/components/Header';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#FBFBFA] text-[#1A1A1A]">
      <Header />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-16 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full text-xs font-medium tracking-wide uppercase bg-white border border-[#E5E2DC] text-[#605D56] mb-6">
          Base Técnica Preparada
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#181716] leading-tight mb-4">
          Launtion
        </h1>

        <p className="text-lg sm:text-xl text-[#5F5C55] max-w-2xl leading-relaxed mb-8">
          SaaS para generar vídeos promocionales de productos digitales mediante motion graphics.
          Base técnica funcional que combina Next.js App Router y el motor de composición Remotion.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[#ECE8E1]">
          <div className="p-5 rounded-xl bg-white border border-[#ECE8E1] shadow-xs">
            <h2 className="text-sm font-semibold text-[#181716] mb-1">
              Remotion Studio
            </h2>
            <p className="text-xs text-[#706C64] mb-3">
              Inspecciona y edita la composición LaunchDemo en el estudio interactivo.
            </p>
            <code className="text-xs bg-[#F5F3EF] px-2.5 py-1 rounded text-[#2A2927] font-mono">
              npm run remotion
            </code>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#ECE8E1] shadow-xs">
            <h2 className="text-sm font-semibold text-[#181716] mb-1">
              Renderizado MP4
            </h2>
            <p className="text-xs text-[#706C64] mb-3">
              Renderiza un archivo MP4 real de 1920x1080 a 30 FPS mediante la CLI de Remotion.
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

