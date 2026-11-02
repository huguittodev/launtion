'use client';

/**
 * ScreenRecorderModal.tsx
 *
 * Studio modal for native client-side screen recording and DOM mouse tracking.
 * Provides a 5-state capture lifecycle (idle -> preparing -> recording -> review -> error),
 * live video preview stream, real-time telemetry counters, and one-click ingestion
 * into Remotion Player with 100% observed InteractionMap provenance.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { SceneGraph } from '../../lib/scene-graph/types';
import { MouseTracker } from '../../lib/recorder/mouse-tracker';
import { StreamRecorder } from '../../lib/recorder/stream-recorder';
import { adaptObservedSessionToSceneGraph } from '../../lib/recorder/telemetry-synthesizer';
import type {
  CompletedRecordingSession,
  RawRecordingSession,
  RecorderState,
} from '../../lib/recorder/types';

export interface ScreenRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySceneGraph: (sceneGraph: SceneGraph) => void;
}

export const ScreenRecorderModal: React.FC<ScreenRecorderModalProps> = ({
  isOpen,
  onClose,
  onApplySceneGraph,
}) => {
  const [state, setState] = useState<RecorderState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [clicksCount, setClicksCount] = useState(0);
  const [movesCount, setMovesCount] = useState(0);

  // Configuration options
  const [captureAudio, setCaptureAudio] = useState(true);
  const [cursorMode, setCursorMode] = useState<'never' | 'motion' | 'always'>('never');
  const [fps, setFps] = useState<30 | 60>(30);

  // Resulting completed session
  const [completedSession, setCompletedSession] = useState<CompletedRecordingSession | null>(null);

  // Media references
  const streamRecorderRef = useRef<StreamRecorder | null>(null);
  const mouseTrackerRef = useRef<MouseTracker | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);

  const stateRef = useRef<RecorderState>('idle');
  const t0MsRef = useRef<number>(0);
  const fpsRef = useRef<number>(fps);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    fpsRef.current = fps;
  }, [fps]);

  // Cleanup helper
  const cleanupRecordingResources = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mouseTrackerRef.current) {
      mouseTrackerRef.current.stop();
      mouseTrackerRef.current = null;
    }
    if (streamRecorderRef.current) {
      streamRecorderRef.current.stop().catch(() => {});
      streamRecorderRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRecordingResources();
    };
  }, [cleanupRecordingResources]);

  const handleClose = useCallback((applied = false) => {
    if (!applied && completedSession?.videoUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try {
        URL.revokeObjectURL(completedSession.videoUrl);
      } catch {
        // Ignore revoke issues
      }
    }
    cleanupRecordingResources();
    stateRef.current = 'idle';
    setState('idle');
    setErrorMessage(null);
    setElapsedMs(0);
    setClicksCount(0);
    setMovesCount(0);
    setCompletedSession(null);
    onClose();
  }, [cleanupRecordingResources, completedSession, onClose]);

  // Attach live MediaStream to preview video element when recording starts
  const attachStreamToPreview = useCallback((stream: MediaStream) => {
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = stream;
      previewVideoRef.current.play().catch(() => {});
    }
  }, []);

  // Handle stopping recording cleanly
  const handleStopRecording = useCallback(async () => {
    if (stateRef.current !== 'recording') return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    stateRef.current = 'stopping';
    setState('stopping');

    try {
      const mouseEvents = mouseTrackerRef.current ? mouseTrackerRef.current.stop() : [];
      const streamResult = streamRecorderRef.current
        ? await streamRecorderRef.current.stop()
        : {
            videoBlob: new Blob([], { type: 'video/webm' }),
            mimeType: 'video/webm',
            duration_ms: elapsedMs,
            resolution: { width: 1920, height: 1080 },
          };

      const vp = mouseTrackerRef.current
        ? mouseTrackerRef.current.getViewport()
        : { width: streamResult.resolution.width, height: streamResult.resolution.height, devicePixelRatio: 1.0 };

      const duration_ms = Math.max(500, streamResult.duration_ms || elapsedMs);

      const rawSession: RawRecordingSession = {
        id: `rec-session-${Date.now()}`,
        t0_ms: Date.now() - duration_ms,
        tEnd_ms: Date.now(),
        duration_ms,
        viewport: vp,
        fps,
        events: mouseEvents,
        videoBlob: streamResult.videoBlob,
        videoMimeType: streamResult.mimeType,
        stats: {
          totalEvents: mouseEvents.length,
          durationMs: duration_ms,
          resolution: { width: vp.width, height: vp.height },
          recordedAt: new Date().toISOString(),
          clickCount: mouseEvents.filter((e) => e.type === 'click').length,
          moveCount: mouseEvents.filter((e) => e.type === 'move').length,
          effectiveFps: duration_ms > 0 ? (mouseEvents.length / duration_ms) * 1000 : 0,
        },
      };

      // Synthesize observed InteractionMap v2.0 and adapt to SceneGraph
      const synthesized = adaptObservedSessionToSceneGraph(rawSession, {
        fps,
        baseWidth: vp.width,
        baseHeight: vp.height,
      });

      setCompletedSession(synthesized);
      setState('review');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(`Error al procesar la grabación: ${msg}`);
      setState('error');
    }
  }, [elapsedMs, fps]);

  const handleStopRecordingRef = useRef<() => Promise<void>>(handleStopRecording);

  useEffect(() => {
    handleStopRecordingRef.current = handleStopRecording;
  }, [handleStopRecording]);

  // Start recording workflow
  const handleStartRecording = useCallback(async () => {
    setErrorMessage(null);
    stateRef.current = 'preparing';
    setState('preparing');
    setElapsedMs(0);
    setClicksCount(0);
    setMovesCount(0);
    setCompletedSession(null);

    try {
      const recorder = new StreamRecorder({
        fps,
        captureAudio,
        captureCursor: cursorMode,
      });
      streamRecorderRef.current = recorder;

      // Start stream and register browser banner onended callback
      const { stream, t0_ms } = await recorder.start(() => {
        // Auto-stop if user clicks native browser "Stop sharing" banner
        handleStopRecordingRef.current?.();
      });
      t0MsRef.current = t0_ms;

      // Start mouse tracker
      const tracker = new MouseTracker({ throttleMs: 1000 / fps });
      mouseTrackerRef.current = tracker;
      tracker.start(t0_ms);

      stateRef.current = 'recording';
      setState('recording');

      // Connect video stream to preview
      setTimeout(() => attachStreamToPreview(stream), 50);

      // Start timer tick and live telemetry reader
      timerIntervalRef.current = setInterval(() => {
        const now = performance.now();
        const elapsed = Math.max(0, now - t0_ms);
        setElapsedMs(elapsed);

        if (mouseTrackerRef.current) {
          const evts = mouseTrackerRef.current.getEvents();
          setClicksCount(evts.filter((e) => e.type === 'click').length);
          setMovesCount(evts.filter((e) => e.type === 'move').length);
        }
      }, 100);
    } catch (err) {
      cleanupRecordingResources();
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setState('error');
    }
  }, [fps, captureAudio, cursorMode, attachStreamToPreview, cleanupRecordingResources]);

  // Ingest completed session into Remotion Player
  const handleApplyToPlayer = useCallback(() => {
    if (!completedSession) return;
    onApplySceneGraph(completedSession.sceneGraph);
    handleClose(true);
  }, [completedSession, onApplySceneGraph, handleClose]);

  // Reset to record again
  const handleRecordAgain = useCallback(() => {
    if (completedSession?.videoUrl && typeof URL !== 'undefined' && URL.revokeObjectURL) {
      try {
        URL.revokeObjectURL(completedSession.videoUrl);
      } catch {
        // Ignore revoke issues
      }
    }
    setCompletedSession(null);
    setState('idle');
    setErrorMessage(null);
  }, [completedSession]);

  if (!isOpen) return null;

  // Format elapsed timer mm:ss.d
  const totalSeconds = elapsedMs / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = (totalSeconds % 60).toFixed(1);
  const formattedTimer = `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
  const currentFrames = Math.round(totalSeconds * fps);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#141413] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_#EF4444]" />
            <h2 className="text-base font-semibold text-[#FAF9F5] tracking-tight">
              Grabar Pantalla & Telemetría Observada
            </h2>
          </div>
          <button
            type="button"
            onClick={() => handleClose(false)}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* STATE 1: IDLE */}
          {state === 'idle' && (
            <div className="space-y-5">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-xs text-neutral-300 space-y-2">
                <p className="font-semibold text-white text-sm">
                  Captura de pantalla de alta fidelidad con telemetría DOM real
                </p>
                <p>
                  Graba tu aplicación web o SaaS directamente en el navegador. Se registrarán tus
                  clics y movimientos de ratón para sintetizar un{' '}
                  <span className="text-amber-400 font-mono">InteractionMap v2.0</span> con
                  procedencia 100% observada (<code className="text-amber-300">observed</code>).
                </p>
                <p className="text-neutral-400">
                  💡 <strong className="text-neutral-300">Supresión de cursor:</strong> El cursor del
                  sistema se oculta automáticamente para que el cursor 3D vectorial de Remotion lo
                  sustituya sin duplicación visual ni efecto fantasma.
                </p>
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-1.5">
                  <label htmlFor="recorder-fps-select" className="text-xs text-neutral-400 font-medium block">
                    Velocidad (FPS)
                  </label>
                  <select
                    id="recorder-fps-select"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value) as 30 | 60)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF5C35]"
                  >
                    <option value={30}>30 FPS (Recomendado)</option>
                    <option value={60}>60 FPS (Ultra suave)</option>
                  </select>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-xl p-3 space-y-1.5">
                  <label htmlFor="recorder-cursor-mode-select" className="text-xs text-neutral-400 font-medium block">
                    Cursor del sistema
                  </label>
                  <select
                    id="recorder-cursor-mode-select"
                    value={cursorMode}
                    onChange={(e) => setCursorMode(e.target.value as 'never' | 'motion' | 'always')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#FF5C35]"
                  >
                    <option value="never">Ocultar (SmartCursor 3D)</option>
                    <option value="motion">Solo al mover</option>
                    <option value="always">Siempre visible</option>
                  </select>
                </div>

                <div className="bg-black/30 border border-white/10 rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-xs text-neutral-400 font-medium">Audio del sistema</span>
                  <label className="flex items-center gap-2 cursor-pointer mt-1">
                    <input
                      type="checkbox"
                      checked={captureAudio}
                      onChange={(e) => setCaptureAudio(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-[#FF5C35] focus:ring-0"
                    />
                    <span className="text-xs text-neutral-300">Capturar audio</span>
                  </label>
                </div>
              </div>

              {/* Start Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-[#FF5C35] hover:brightness-110 text-white font-medium text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                  <span>Iniciar Grabación de Pantalla</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: PREPARING */}
          {state === 'preparing' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-12 h-12 rounded-full border-2 border-[#FF5C35] border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-white">
                Esperando selección de pantalla o ventana...
              </p>
              <p className="text-xs text-neutral-400 max-w-sm">
                Selecciona la pantalla, ventana de aplicación o pestaña en el diálogo nativo de tu
                navegador para comenzar.
              </p>
              <button
                type="button"
                onClick={() => {
                  cleanupRecordingResources();
                  setState('idle');
                }}
                className="mt-4 px-4 py-1.5 text-xs text-neutral-400 hover:text-white bg-white/5 rounded-lg border border-white/10 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* STATE 3: RECORDING */}
          {state === 'recording' && (
            <div className="space-y-4">
              {/* Live Preview Video */}
              <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-red-500/30 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                <video
                  ref={previewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-contain"
                />

                {/* Floating Recording Indicator Overlay */}
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/10 text-white text-xs font-mono">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                  <span className="font-semibold text-red-400">REC</span>
                  <span>{formattedTimer}</span>
                  <span className="text-neutral-500">({currentFrames}f)</span>
                </div>
              </div>

              {/* Real-time Telemetry Stats */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                    Tiempo Transcurrido
                  </span>
                  <span className="text-sm font-mono font-semibold text-white">
                    {formattedTimer}
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                    Clics Detectados
                  </span>
                  <span className="text-sm font-mono font-semibold text-amber-400">
                    {clicksCount} clics
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                    Movimientos Trackeados
                  </span>
                  <span className="text-sm font-mono font-semibold text-blue-400">
                    {movesCount}
                  </span>
                </div>
              </div>

              {/* Stop Button */}
              <button
                type="button"
                onClick={handleStopRecording}
                className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                <span className="w-3 h-3 bg-white rounded-sm" />
                <span>Detener y Procesar Grabación</span>
              </button>
            </div>
          )}

          {/* STATE 4: STOPPING / PROCESSING */}
          {state === 'stopping' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
              <p className="text-sm font-medium text-white">
                Ensamblando vídeo y sintetizando InteractionMap (v2.0)...
              </p>
              <p className="text-xs text-neutral-400 max-w-sm">
                Asignando coordenadas de focal tracking 3D, arcos de trayectoria Bezier y disparadores
                de audio sincronizados por frame con procedencia 100% observada.
              </p>
            </div>
          )}

          {/* STATE 5: REVIEW */}
          {state === 'review' && completedSession && (
            <div className="space-y-4">
              {/* Recorded Video Playback */}
              <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10">
                <video
                  ref={reviewVideoRef}
                  src={completedSession.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Telemetry Summary Badges */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400 font-medium">Procedencia de Telemetría:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    100% Observed
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                  <div className="bg-black/30 rounded-lg p-2">
                    <span className="text-[10px] text-neutral-400 block">Duración</span>
                    <span className="text-xs font-mono font-medium text-white">
                      {(completedSession.summary.durationMs / 1000).toFixed(1)}s (
                      {completedSession.summary.durationInFrames}f)
                    </span>
                  </div>

                  <div className="bg-black/30 rounded-lg p-2">
                    <span className="text-[10px] text-neutral-400 block">Resolución</span>
                    <span className="text-xs font-mono font-medium text-white">
                      {completedSession.summary.baseResolution.width}×
                      {completedSession.summary.baseResolution.height}
                    </span>
                  </div>

                  <div className="bg-black/30 rounded-lg p-2">
                    <span className="text-[10px] text-neutral-400 block">Clics Reales</span>
                    <span className="text-xs font-mono font-medium text-amber-400">
                      {completedSession.summary.clicksCount}
                    </span>
                  </div>

                  <div className="bg-black/30 rounded-lg p-2">
                    <span className="text-[10px] text-neutral-400 block">Eventos Totales</span>
                    <span className="text-xs font-mono font-medium text-blue-400">
                      {completedSession.summary.eventsCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRecordAgain}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white font-medium text-xs transition-colors"
                >
                  Descartar y Grabar de Nuevo
                </button>

                <button
                  type="button"
                  onClick={handleApplyToPlayer}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#FF5C35] hover:bg-[#E04822] text-white font-medium text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Cargar en Reproductor</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 6: ERROR */}
          {state === 'error' && (
            <div className="py-8 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
                ✕
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Error en la grabación</p>
                <p className="text-xs text-red-300 max-w-md mx-auto">{errorMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setState('idle');
                  setErrorMessage(null);
                }}
                className="px-4 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
