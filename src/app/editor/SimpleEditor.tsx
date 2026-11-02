'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { PlayerRef } from '@remotion/player';
import { ExportModal } from '../../components/editor/ExportModal';
import { RemotionPlayerPreview } from '../../components/editor/RemotionPlayerPreview';
import { defaultSceneGraph } from '../../../remotion/compositions/InteractiveSurfaceDemo';
import { loadDraft, readNotice, takePendingStyle } from '../../lib/simple-editor/draft-store';
import {
  SIMPLE_TEXT_LIMITS,
  STYLE_PRESETS,
  applyAspect,
  applySimpleText,
  applyStyle,
  applyUserMedia,
  getAspectFormat,
  isMotionArchetype,
  readSimpleTexts,
  type AspectFormat,
  type SimpleTexts,
} from '../../lib/simple-editor/simple-edit';
import type { MotionArchetype, SceneGraph } from '../../lib/scene-graph/types';

const TEXT_FIELDS: { key: keyof SimpleTexts; label: string; placeholder: string }[] = [
  { key: 'hook', label: 'Titular del gancho', placeholder: 'Lo primero que verá tu audiencia' },
  { key: 'valueProp', label: 'Propuesta de valor', placeholder: 'Qué hace especial a tu producto' },
  { key: 'cta', label: 'Llamada a la acción', placeholder: 'Empieza gratis' },
  { key: 'productName', label: 'Nombre del producto', placeholder: 'Tu marca' },
];

function initialState(): { graph: SceneGraph; mediaUrl: string | null } {
  const { graph, media } = loadDraft();
  let current: SceneGraph = graph ?? structuredClone(defaultSceneGraph);
  const pending = takePendingStyle();
  if (pending && isMotionArchetype(pending)) current = applyStyle(current, pending).graph;
  const mediaUrl = media?.previewUrl ?? null;
  if (mediaUrl) current = applyUserMedia(current, mediaUrl).graph;
  return { graph: current, mediaUrl };
}

export default function SimpleEditor() {
  const [init] = useState(initialState);
  const [graph, setGraph] = useState<SceneGraph>(init.graph);
  const [texts, setTexts] = useState<SimpleTexts>(() => readSimpleTexts(init.graph));
  const [notice, setNotice] = useState<string | null>(null);
  const [aiNotice] = useState<string | null>(() => readNotice());
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportKey, setExportKey] = useState<number | null>(null);
  const playerRef = useRef<PlayerRef | null>(null);

  const style = graph.artDirection.archetype ?? 'base44-studio';
  const format = getAspectFormat(graph);

  const onText = (key: keyof SimpleTexts, value: string) => {
    setTexts((prev) => ({ ...prev, [key]: value }));
    const result = applySimpleText(graph, key, value);
    setNotice(result.ok ? null : (result.error ?? 'Texto no válido'));
    setGraph(result.graph);
  };

  const onStyle = (id: MotionArchetype) => {
    setGraph((prev) => applyStyle(prev, id).graph);
  };

  const onFormat = (f: AspectFormat) => {
    setGraph((prev) => applyAspect(prev, f).graph);
  };

  const togglePlay = () => playerRef.current?.toggle();

  // The server cannot read a browser blob: URL, so export uses the embedded data URI.
  const exportGraph = useMemo(() => {
    const { media } = loadDraft();
    if (!media?.dataUri || !media.previewUrl) return graph;
    const copy = structuredClone(graph);
    for (const scene of copy.scenes) {
      if (scene.type === 'product_interaction_3d' && scene.payload.url === media.previewUrl) {
        scene.payload.url = media.dataUri;
      }
    }
    return copy;
  }, [graph]);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F5] text-[#1A1A1A]">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-lg">
          Vidiaura
        </Link>
        <Link href="/" className="text-sm text-[#5F5C55] hover:text-[#1A1A1A]">
          ← Nuevo vídeo
        </Link>
      </header>

      {aiNotice && (
        <div role="status" className="mx-6 mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {aiNotice}
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 pb-10 grid grid-cols-1 lg:grid-cols-[1fr_22rem] gap-8 items-start">
        <section className="flex flex-col items-center gap-4">
          <div className="w-full">
            <RemotionPlayerPreview
              sceneGraph={graph}
              playerRef={playerRef}
              onPlayStateChange={setIsPlaying}
            />
          </div>
          <button
            type="button"
            onClick={togglePlay}
            className="px-5 py-2 rounded-full bg-white border border-[#E5E2DC] text-sm font-medium hover:bg-[#F0EEE8] transition-colors"
          >
            {isPlaying ? '⏸ Pausar' : '▶ Reproducir'}
          </button>
        </section>

        <aside className="flex flex-col gap-6 rounded-2xl bg-white border border-[#E5E2DC] p-5">
          <div className="flex flex-col gap-4">
            {TEXT_FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1.5 text-sm font-medium">
                {f.label}
                <input
                  value={texts[f.key]}
                  maxLength={SIMPLE_TEXT_LIMITS[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => onText(f.key, e.target.value)}
                  className="rounded-lg border border-[#E5E2DC] px-3 py-2 font-normal outline-none focus:border-[#FF5C35]"
                />
              </label>
            ))}
            {notice && (
              <p role="alert" className="text-xs text-red-600">
                {notice}
              </p>
            )}
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Estilo</div>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onStyle(p.id)}
                  aria-pressed={style === p.id}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    style === p.id
                      ? 'border-[#FF5C35] bg-[#FFF3EF]'
                      : 'border-[#E5E2DC] hover:bg-[#F0EEE8]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-sm font-medium mb-2">Formato</div>
            <div className="grid grid-cols-2 gap-2">
              {(['16:9', '9:16'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFormat(f)}
                  aria-pressed={format === f}
                  className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                    format === f
                      ? 'border-[#FF5C35] bg-[#FFF3EF]'
                      : 'border-[#E5E2DC] hover:bg-[#F0EEE8]'
                  }`}
                >
                  {f === '16:9' ? '16:9 Horizontal' : '9:16 Vertical'}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExportKey(Date.now())}
            className="w-full py-4 rounded-xl bg-[#181716] hover:bg-[#2A2927] text-white font-semibold text-base transition-colors"
          >
            Descargar Vídeo MP4
          </button>
        </aside>
      </main>

      {exportKey !== null && (
        <ExportModal
          key={exportKey}
          isOpen
          autoStart
          onClose={() => setExportKey(null)}
          sceneGraph={exportGraph}
        />
      )}
    </div>
  );
}
