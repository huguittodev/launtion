'use client';

/**
 * app/page.tsx
 *
 * Vidiaura landing: one input, one attach icon, one button, plus a gallery of
 * trending motion styles to remix. Nothing else.
 */

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { saveDraft } from '@/lib/simple-editor/draft-store';
import {
  ACCEPT_ATTRIBUTE,
  generateVideo,
  validateUpload,
} from '@/lib/simple-editor/generate';
import { STYLE_PRESETS } from '@/lib/simple-editor/simple-edit';
import type { MotionArchetype } from '@/lib/scene-graph/types';

const EXAMPLE_PROMPTS: Record<MotionArchetype, string> = {
  'base44-studio': 'Una app para reservar bicicletas con seguimiento en tiempo real',
  'linear-dark': 'Un gestor de proyectos rápido y minimalista para equipos de producto',
  'bento-grid': 'Un panel de analítica con métricas, informes y alertas en un solo lugar',
  'kinetic-hook': 'Una herramienta de IA que escribe tus emails en segundos',
};

export default function HomePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [style, setStyle] = useState<MotionArchetype>('base44-studio');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = (candidate: File | null) => {
    if (!candidate) return;
    const problem = validateUpload(candidate);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(candidate);
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return;
    setError(null);
    setIsLoading(true);
    try {
      const { graph, media } = await generateVideo({ prompt, file, style });
      saveDraft(graph, media);
      router.push('/editor');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el vídeo.');
      setIsLoading(false);
    }
  };

  const handleRemix = (id: MotionArchetype) => {
    setStyle(id);
    if (!prompt.trim()) setPrompt(EXAMPLE_PROMPTS[id]);
    promptRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-[#1A1A1A]">
      <Header />
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pt-16 pb-20 flex flex-col items-center">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-center leading-[1.05] max-w-3xl">
          Tu SaaS, convertido en un anuncio de cine.
        </h1>
        <p className="mt-5 text-lg text-[#5F5C55] text-center max-w-xl">
          Describe tu producto y adjunta una grabación de pantalla. La IA hace el resto.
        </p>

        <form
          onSubmit={handleCreate}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className="mt-10 w-full max-w-2xl"
        >
          <div className="flex items-center gap-2 rounded-2xl bg-white border border-[#E5E2DC] shadow-lg p-2 pl-4 focus-within:border-[#FF5C35] transition-colors">
            <input
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={500}
              disabled={isLoading}
              placeholder="Describe tu SaaS o qué quieres destacar..."
              aria-label="Describe tu SaaS o qué quieres destacar"
              className="flex-1 min-w-0 bg-transparent outline-none text-base py-3 placeholder:text-[#A19E95]"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              data-testid="file-input"
              onChange={(e) => {
                handleFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              aria-label="Adjuntar grabación o captura"
              title="Adjuntar grabación o captura (.mp4, .webm, .png, .jpg)"
              className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[#5F5C55] hover:bg-[#F0EEE8] transition-colors"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="shrink-0 px-5 h-11 rounded-xl bg-[#181716] hover:bg-[#2A2927] disabled:opacity-60 text-white font-semibold text-sm transition-colors"
            >
              {isLoading ? 'Creando…' : 'Crear Vídeo con IA'}
            </button>
          </div>

          {file && (
            <div className="mt-3 inline-flex items-center gap-2 text-sm bg-white border border-[#E5E2DC] rounded-full pl-3 pr-1 py-1">
              <span className="truncate max-w-[16rem]">{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                aria-label="Quitar archivo"
                className="w-6 h-6 rounded-full hover:bg-[#F0EEE8] text-[#5F5C55]"
              >
                ×
              </button>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>
          )}
          {isLoading && (
            <p className="mt-3 text-sm text-[#5F5C55]">
              Analizando tu producto y montando el guion…
            </p>
          )}
        </form>

        <section className="mt-20 w-full" aria-labelledby="trending-title">
          <h2 id="trending-title" className="text-xl font-semibold mb-5">
            Trending Motion Styles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STYLE_PRESETS.map((preset) => {
              const selected = preset.id === style;
              return (
                <div
                  key={preset.id}
                  className={`rounded-2xl bg-white border p-3 flex flex-col gap-3 transition-shadow hover:shadow-md ${
                    selected ? 'border-[#FF5C35]' : 'border-[#E5E2DC]'
                  }`}
                >
                  <div
                    className="aspect-video rounded-xl flex items-end p-3"
                    style={{
                      background: `linear-gradient(135deg, ${preset.swatch[0]}, ${preset.swatch[0]} 55%, ${preset.swatch[1]})`,
                    }}
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-semibold text-sm">{preset.label}</h3>
                    <p className="text-xs text-[#5F5C55] mt-1">{preset.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemix(preset.id)}
                    className="mt-auto text-xs font-semibold px-3 py-2 rounded-lg border border-[#E5E2DC] hover:bg-[#F0EEE8] transition-colors"
                  >
                    {selected ? 'Seleccionado ✓' : 'Remix with AI'}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
