'use client';

/**
 * ExportModal.tsx
 *
 * Studio Reactive Export Modal for Phase 7 Background Render Worker.
 * Handles client-side render job lifecycle:
 * - Idle: SceneGraph review, render settings, and launch button
 * - Queued / Rendering: Real-time progress bar, stage indicator, elapsed time, cancellation
 * - Completed: In-modal video preview player, file size metrics, and direct MP4 download
 * - Failed: Error inspection and retry trigger
 */

import React, { useState, useEffect, useRef } from 'react';
import type { SceneGraph } from '../../lib/scene-graph/types';
import type {
  RenderCodec,
  RenderJobStatus,
  RenderStage,
} from '../../lib/render/types';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneGraph: SceneGraph;
}

interface PollResponse {
  jobId: string;
  status: RenderJobStatus;
  progress: number;
  framesRendered: number;
  totalFrames: number;
  renderedBytes: number;
  currentStage: RenderStage;
  downloadUrl: string | null;
  error: { code: string; message: string; details?: string } | null;
  durationMs: number | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  sceneGraph,
}) => {
  const [modalState, setModalState] = useState<
    'idle' | 'queued' | 'rendering' | 'completed' | 'failed'
  >('idle');

  // Render settings
  const [codec, setCodec] = useState<RenderCodec>('h264');
  const [muted, setMuted] = useState(false);

  // Active job telemetry
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0.0);
  const [framesRendered, setFramesRendered] = useState(0);
  const [totalFrames, setTotalFrames] = useState(sceneGraph.canvas.durationInFrames);
  const [renderedBytes, setRenderedBytes] = useState(0);
  const [currentStage, setCurrentStage] = useState<RenderStage>('bundling');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [renderDurationSec, setRenderDurationSec] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Stop polling and timer helper
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Reset or initialize when modal closes
  const handleClose = () => {
    stopPolling();
    onClose();
  };

  // Duration in seconds for summary
  const durationSec = (sceneGraph.canvas.durationInFrames / sceneGraph.canvas.fps).toFixed(1);

  // Download raw SceneGraph JSON
  const handleDownloadJson = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(sceneGraph, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `vidiaura-scenegraph-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Start background render job
  const handleStartRender = async () => {
    stopPolling();
    setErrorMessage(null);
    setErrorCode(null);
    setProgress(0);
    setFramesRendered(0);
    setTotalFrames(sceneGraph.canvas.durationInFrames);
    setElapsedSeconds(0);
    setModalState('queued');

    // Start elapsed timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    try {
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compositionId: 'InteractiveSurfaceDemo',
          sceneGraph,
          settings: {
            codec,
            muted,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const newJobId = data.jobId as string;
      setJobId(newJobId);

      // Start polling loop
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/render/${newJobId}`);
          if (!pollRes.ok) return;

          const pollData: PollResponse = await pollRes.json();
          setProgress(pollData.progress);
          setFramesRendered(pollData.framesRendered);
          if (pollData.totalFrames > 0) {
            setTotalFrames(pollData.totalFrames);
          }
          setRenderedBytes(pollData.renderedBytes);
          setCurrentStage(pollData.currentStage);

          if (pollData.status === 'rendering') {
            setModalState('rendering');
          } else if (pollData.status === 'completed') {
            stopPolling();
            setModalState('completed');
            setDownloadUrl(pollData.downloadUrl);
            if (pollData.durationMs) {
              setRenderDurationSec(parseFloat((pollData.durationMs / 1000).toFixed(1)));
            }
          } else if (pollData.status === 'failed') {
            stopPolling();
            setModalState('failed');
            setErrorMessage(pollData.error?.message || 'Error en el renderizado');
            setErrorCode(pollData.error?.code || 'RENDER_FAILED');
          } else if (pollData.status === 'cancelled') {
            stopPolling();
            setModalState('idle');
          }
        } catch {
          // Poll network error, will retry next tick
        }
      }, 1000);
    } catch (err: unknown) {
      stopPolling();
      setModalState('failed');
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setErrorCode('ENQUEUE_ERROR');
    }
  };

  // Cancel rendering job
  const handleCancelRender = async () => {
    if (jobId) {
      try {
        await fetch(`/api/render/${jobId}`, { method: 'DELETE' });
      } catch {
        // Ignore
      }
    }
    stopPolling();
    setModalState('idle');
  };

  // Reset to idle for a new render
  const handleReset = () => {
    stopPolling();
    setModalState('idle');
    setJobId(null);
    setDownloadUrl(null);
    setProgress(0);
  };

  if (!isOpen) return null;

  // Stage display label mapping
  const stageLabels: Record<RenderStage, string> = {
    bundling: 'Empaquetando bundle Webpack...',
    rendering_frames: 'Renderizando fotogramas con Chromium...',
    encoding: 'Codificando flujo de vídeo H.264/MP4...',
    muxing: 'Sincronizando pistas de audio SFX...',
    finished: 'Exportación completada exitosamente',
  };

  const progressPercent = Math.round(progress * 100);
  const fileSizeMb = (renderedBytes / (1024 * 1024)).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-fadeIn"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[#181716] border border-white/10 p-6 shadow-2xl flex flex-col gap-5 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FF5C35]/15 border border-[#FF5C35]/30 flex items-center justify-center text-[#FF5C35]">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Exportar Vídeo MP4 de Estudio
              </h3>
              <p className="text-xs text-neutral-400">
                Pipeline de Renderizado Aislado • Remotion Engine v2
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Cerrar modal"
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

        {/* =================================================================== */}
        {/* STATE: IDLE                                                         */}
        {/* =================================================================== */}
        {modalState === 'idle' && (
          <div className="flex flex-col gap-4">
            {/* Settings */}
            <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-white/5 flex flex-col gap-3">
              <span className="text-xs font-medium text-neutral-300">Configuración de Render:</span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="export-codec-select" className="text-[11px] text-neutral-400">Códec de Vídeo</label>
                  <select
                    id="export-codec-select"
                    value={codec}
                    onChange={(e) => setCodec(e.target.value as RenderCodec)}
                    className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF5C35]"
                  >
                    <option value="h264">H.264 (Universal MP4)</option>
                    <option value="prores">Apple ProRes (Alta fidelidad)</option>
                    <option value="vp9">VP9 (Web optimizado)</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer py-1.5 text-neutral-300">
                    <input
                      type="checkbox"
                      checked={muted}
                      onChange={(e) => setMuted(e.target.checked)}
                      className="rounded border-white/20 text-[#FF5C35] focus:ring-[#FF5C35]"
                    />
                    <span className="text-[11px]">Silenciar audio en export</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Architecture note */}
            <div className="p-3 rounded-xl bg-[#FF5C35]/10 border border-[#FF5C35]/20 text-[11px] text-neutral-300 flex items-center gap-2">
              <span className="text-[#FF5C35] text-sm">⚡</span>
              <span>
                Render asíncrono en worker aislado sin bloquear peticiones HTTP (Reglas 8 y 9 de AGENTS.md).
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-1.5"
              >
                <span>Descargar SceneGraph JSON</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={handleStartRender}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#FF5C35] hover:bg-[#E04822] text-white shadow-lg transition-all flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Iniciar Renderizado MP4</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE: QUEUED / RENDERING                                           */}
        {/* =================================================================== */}
        {(modalState === 'queued' || modalState === 'rendering') && (
          <div className="flex flex-col gap-4 py-2">
            {/* Status Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5C35] animate-ping" />
                <span className="text-xs font-semibold text-white">
                  {modalState === 'queued'
                    ? 'En cola de procesamiento...'
                    : `Renderizando: ${progressPercent}%`}
                </span>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                {elapsedSeconds}s transcurridos
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-neutral-900 rounded-full h-3 border border-white/5 overflow-hidden p-0.5">
              <div
                className="bg-gradient-to-r from-[#FF5C35] to-[#FFA07A] h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.max(5, progressPercent)}%` }}
              />
            </div>

            {/* Frame & Stage details */}
            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>{stageLabels[currentStage]}</span>
              <span>
                {framesRendered} / {totalFrames} fotogramas
              </span>
            </div>

            {/* Cancellation Button */}
            <div className="flex items-center justify-end pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={handleCancelRender}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                Cancelar Renderizado
              </button>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE: COMPLETED                                                    */}
        {/* =================================================================== */}
        {modalState === 'completed' && (
          <div className="flex flex-col gap-4">
            {/* Video Preview Player */}
            {downloadUrl && (
              <div className="w-full rounded-xl overflow-hidden bg-black border border-white/10 shadow-lg aspect-video flex items-center justify-center">
                <video
                  src={downloadUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 flex flex-col">
                <span className="text-[10px] text-neutral-500 font-mono">TAMAÑO DEL ARCHIVO</span>
                <span className="text-xs font-semibold font-mono text-[#22C55E] mt-0.5">
                  {fileSizeMb} MB
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 flex flex-col">
                <span className="text-[10px] text-neutral-500 font-mono">TIEMPO DE RENDER</span>
                <span className="text-xs font-semibold font-mono text-white mt-0.5">
                  {renderDurationSec ?? elapsedSeconds}s
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Renderizar de nuevo
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cerrar
                </button>

                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={`vidiaura-render-${jobId}.mp4`}
                    className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#22C55E] hover:bg-[#16A34A] text-white shadow-lg transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span>Descargar Vídeo MP4</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STATE: FAILED                                                       */}
        {/* =================================================================== */}
        {modalState === 'failed' && (
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-red-400">
                <span>⚠️</span>
                <span>Error en el Renderizado ({errorCode || 'RENDER_FAILED'})</span>
              </div>
              <p className="text-[11px] leading-relaxed text-neutral-300">
                {errorMessage || 'Ha ocurrido un error inesperado al procesar el vídeo.'}
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleDownloadJson}
                className="px-3 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
              >
                Descargar JSON
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Cerrar
                </button>

                <button
                  type="button"
                  onClick={handleStartRender}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#FF5C35] hover:bg-[#E04822] text-white shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>Reintentar Render</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
