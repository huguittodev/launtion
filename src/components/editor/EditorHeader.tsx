'use client';

/**
 * EditorHeader.tsx
 *
 * Studio navigation header containing:
 * - Back link to landing page
 * - Project title and technical metadata chips (1080p, 30fps, 480f)
 * - Real-time Zod SceneGraph status badge
 * - Focal overlay toggle button
 * - Undo / Redo controls
 * - Reset to Defaults action
 * - Fullscreen toggle
 * - Export Video trigger
 */

import React from 'react';
import Link from 'next/link';

export interface EditorHeaderProps {
  title?: string;
  projectName?: string;
  isSaving?: boolean;
  onSaveProject?: () => void;
  onOpenProjectSelector?: () => void;
  onUpdateProjectName?: (name: string) => void;
  durationInFrames: number;
  fps: number;
  currentFrame: number;
  isPlaying: boolean;
  isDirty: boolean;
  validationNotice: string | null;
  canUndo?: boolean;
  canRedo?: boolean;
  showFocalOverlay?: boolean;
  onPlayPauseToggle: () => void;
  onReset: () => void;
  onExportClick: () => void;
  onToggleFullscreen?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleFocalOverlay?: () => void;
  onOpenAiModal?: () => void;
  onOpenInputIntelligenceModal?: () => void;
  onOpenScreenRecorderModal?: () => void;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  title = 'Interactive Surface Demo',
  projectName,
  isSaving = false,
  onSaveProject,
  onOpenProjectSelector,
  onUpdateProjectName,
  durationInFrames,
  fps,
  currentFrame,
  isPlaying,
  isDirty,
  validationNotice,
  canUndo = false,
  canRedo = false,
  showFocalOverlay = false,
  onPlayPauseToggle,
  onReset,
  onExportClick,
  onToggleFullscreen,
  onUndo,
  onRedo,
  onToggleFocalOverlay,
  onOpenAiModal,
  onOpenInputIntelligenceModal,
  onOpenScreenRecorderModal,
}) => {
  const durationSec = (durationInFrames / fps).toFixed(1);
  const currentSec = (currentFrame / fps).toFixed(2);
  const displayTitle = projectName || title;

  return (
    <header className="h-14 border-b border-white/10 bg-[#141413] px-5 flex items-center justify-between select-none z-30 shrink-0">
      {/* Left: Back Link & Project Metadata */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5 py-1 px-2 rounded-md hover:bg-white/5"
          title="Volver a la página principal"
        >
          <span>←</span>
          <span>Inicio</span>
        </Link>

        <div className="h-4 w-[1px] bg-white/10" />

        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C35] shadow-[0_0_8px_#FF5C35]" />
          <span className="font-semibold text-sm text-[#FAF9F5] tracking-tight">
            Vidiaura Studio
          </span>
          <span className="text-xs text-neutral-500 hidden sm:inline">•</span>
          {onUpdateProjectName ? (
            <input
              type="text"
              value={displayTitle}
              onChange={(e) => onUpdateProjectName(e.target.value)}
              className="bg-transparent border-b border-white/10 hover:border-white/30 focus:border-[#FF5C35] focus:outline-none text-xs text-neutral-300 focus:text-white px-1.5 py-0.5 rounded transition-colors max-w-[170px] truncate"
              placeholder="Nombre del proyecto..."
              title="Haz clic para editar el nombre del proyecto"
            />
          ) : (
            <span className="text-xs text-neutral-400 hidden sm:inline max-w-[170px] truncate">
              {displayTitle}
            </span>
          )}
          {isDirty && (
            <span className="text-[10px] text-amber-400 font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
              Modificado
            </span>
          )}
        </div>

        {/* Metadata Chips */}
        <div className="hidden md:flex items-center gap-1.5 ml-1">
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-neutral-300 border border-white/5">
            1920×1080
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-neutral-300 border border-white/5">
            {fps} FPS
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-neutral-300 border border-white/5">
            {durationSec}s ({durationInFrames}f)
          </span>
        </div>
      </div>

      {/* Center: Validation Status & Frame Badge */}
      <div className="flex items-center gap-2">
        {validationNotice ? (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono"
            title={validationNotice}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
            <span className="max-w-[200px] truncate">{validationNotice}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>SceneGraph v2.0 Válido</span>
          </div>
        )}

        <div className="text-xs font-mono text-neutral-400 px-2 py-1 bg-white/5 rounded hidden lg:block">
          {currentSec}s • F{currentFrame}
        </div>
      </div>

      {/* Right: Studio Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Play / Pause Toggle Button */}
        <button
          type="button"
          onClick={onPlayPauseToggle}
          className="p-1.5 rounded-lg text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
        >
          {isPlaying ? (
            <svg className="w-3.5 h-3.5 text-[#FF5C35]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 ml-0.5 text-neutral-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Focal Overlay Toggle */}
        {onToggleFocalOverlay && (
          <button
            type="button"
            onClick={onToggleFocalOverlay}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              showFocalOverlay
                ? 'bg-[#FF5C35]/20 text-[#FF5C35] border-[#FF5C35]/50'
                : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10'
            }`}
            title="Activar o desactivar retícula interactiva de cámara sobre el vídeo"
          >
            <span>🎯</span>
            <span className="hidden sm:inline">Retícula</span>
          </button>
        )}

        {/* Undo / Redo */}
        <div className="flex items-center bg-white/5 rounded-lg border border-white/10 p-0.5">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 rounded text-neutral-300 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-300 transition-colors"
            title="Deshacer (Undo)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2m0 0l-4-4m4 4l4-4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 rounded text-neutral-300 hover:text-white disabled:opacity-30 disabled:hover:text-neutral-300 transition-colors"
            title="Rehacer (Redo)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Reset to Defaults */}
        <button
          type="button"
          onClick={onReset}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          title="Restaurar SceneGraph a valores iniciales"
        >
          Resetear
        </button>

        {/* Fullscreen */}
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1.5 rounded-lg text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            title="Pantalla Completa"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        )}

        {/* Proyectos Modal Button */}
        {onOpenProjectSelector && (
          <button
            type="button"
            onClick={onOpenProjectSelector}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium border border-white/10 transition-colors"
            title="Abrir o gestionar mis proyectos en la nube"
          >
            <span>📁</span>
            <span className="hidden sm:inline">Proyectos</span>
          </button>
        )}

        {/* Guardar Proyecto Button */}
        {onSaveProject && (
          <button
            type="button"
            onClick={onSaveProject}
            disabled={isSaving}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isDirty
                ? 'bg-[#FF5C35]/15 text-[#FF5C35] border-[#FF5C35]/40 hover:bg-[#FF5C35]/25 shadow-sm'
                : 'bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white border-white/10'
            } disabled:opacity-50`}
            title={isDirty ? 'Hay cambios sin guardar' : 'Guardar proyecto en la nube'}
          >
            {isSaving ? (
              <span className="w-2.5 h-2.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <span>💾</span>
            )}
            <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
          </button>
        )}

        {/* Grabar Pantalla Button */}
        {onOpenScreenRecorderModal && (
          <button
            type="button"
            onClick={onOpenScreenRecorderModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium border border-white/10 transition-colors"
            title="Grabar pantalla y registrar eventos del ratón en vivo"
          >
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="hidden sm:inline">Grabar Pantalla</span>
          </button>
        )}

        {/* Analizar Captura / Vídeo Button */}
        {onOpenInputIntelligenceModal && (
          <button
            type="button"
            onClick={onOpenInputIntelligenceModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white text-xs font-medium border border-white/10 transition-colors"
            title="Analizar captura de pantalla o vídeo MP4 con IA"
          >
            <span>👁️</span>
            <span className="hidden sm:inline">Analizar Captura / Vídeo</span>
          </button>
        )}

        {/* Generar con IA Button */}
        {onOpenAiModal && (
          <button
            type="button"
            onClick={onOpenAiModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FF5C35] to-[#FF8C35] hover:brightness-110 text-white text-xs font-semibold shadow-md transition-all active:scale-95 border border-white/10"
            title="Generar nueva narrativa y composición mediante el Director Creativo de IA"
          >
            <span>✨</span>
            <span className="hidden sm:inline">Generar con IA</span>
          </button>
        )}

        {/* Export Video Trigger */}
        <button
          type="button"
          onClick={onExportClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF5C35] hover:bg-[#E04822] text-white text-xs font-semibold shadow-md transition-all active:scale-95"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Exportar</span>
        </button>
      </div>
    </header>
  );
};
