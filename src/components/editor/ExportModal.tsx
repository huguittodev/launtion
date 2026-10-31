'use client';

/**
 * ExportModal.tsx
 *
 * Studio Export Video Informational Modal:
 * - Details the decoupled Phase 7 background Render Worker architecture
 * - Summarizes validated SceneGraph metadata (1080p, 480f, 30fps)
 * - Offers direct export of the active SceneGraph as JSON
 * - Shows the local Remotion render command for deterministic MP4 generation
 */

import React from 'react';
import type { SceneGraph } from '../../lib/scene-graph/types';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneGraph: SceneGraph;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sceneGraph,
}) => {
  if (!isOpen) return null;

  const durationSec = (sceneGraph.canvas.durationInFrames / sceneGraph.canvas.fps).toFixed(1);

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sceneGraph, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `launtion-scenegraph-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#181716] border border-white/10 p-6 shadow-2xl flex flex-col gap-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF5C35]/15 border border-[#FF5C35]/30 flex items-center justify-center text-[#FF5C35]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Exportar Vídeo MP4 de Estudio
              </h3>
              <p className="text-xs text-neutral-400">
                Pipeline de Renderizado Determinista • Launtion Engine
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* SceneGraph Summary Chips */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 flex flex-col">
            <span className="text-[10px] text-neutral-500 font-mono">RESOLUCIÓN</span>
            <span className="text-xs font-semibold font-mono text-white mt-0.5">
              {sceneGraph.canvas.width}×{sceneGraph.canvas.height}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 flex flex-col">
            <span className="text-[10px] text-neutral-500 font-mono">DURACIÓN</span>
            <span className="text-xs font-semibold font-mono text-white mt-0.5">
              {durationSec}s ({sceneGraph.canvas.durationInFrames}f)
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 flex flex-col">
            <span className="text-[10px] text-neutral-500 font-mono">FPS & AUDIO</span>
            <span className="text-xs font-semibold font-mono text-white mt-0.5">
              {sceneGraph.canvas.fps} FPS • {sceneGraph.audioTrack.length} cues
            </span>
          </div>
        </div>

        {/* Phase 7 Background Worker Architecture Note */}
        <div className="p-4 rounded-xl bg-[#FF5C35]/10 border border-[#FF5C35]/20 text-xs text-neutral-300 flex flex-col gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-[#FF5C35]">
            <span>⚡</span>
            <span>Render Worker en Segundo Plano (Fase 7)</span>
          </div>
          <p className="leading-relaxed text-[11px] text-neutral-300">
            En cumplimiento de la <strong>Regla 8 de AGENTS.md</strong>, la exportación final a MP4 de alta fidelidad se ejecuta en segundo plano aislado mediante <code>@remotion/renderer</code> para no bloquear las solicitudes HTTP del usuario.
          </p>
        </div>

        {/* Local Render Command */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-400">
            Comando de Renderizado Local:
          </span>
          <div className="p-3 rounded-lg bg-black/60 border border-neutral-800 font-mono text-xs text-[#22C55E] flex items-center justify-between select-all">
            <code>npm run render</code>
            <span className="text-[10px] text-neutral-500">out/InteractionDemo.mp4</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            Cerrar
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#FF5C35] hover:bg-[#E04822] text-white shadow-md transition-all flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Descargar SceneGraph JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
