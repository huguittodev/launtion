'use client';

/**
 * src/components/editor/AssetIntelligenceModal.tsx
 *
 * Interactive Studio Modal for Phase 5: Input Intelligence (Multimodal Analysis).
 * Enables users to upload real screenshots (PNG, JPG, WebP) and UI video clips (MP4),
 * inspect detected interactive landmarks (CTAs, inputs, metric cards) with 2D hotspot overlays,
 * and seamlessly load the inferred 3D camera & cursor sequence into the Remotion player.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { SceneGraph } from '../../lib/scene-graph/types';
import type { InputIntelligenceResult, VisualLandmark } from '../../lib/input-intelligence/schema';

export interface AssetIntelligenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySceneGraph: (sceneGraph: SceneGraph, assetDataUri?: string) => void;
}

const ACCEPTED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'video/mp4',
];

const LOADING_STEPS = [
  'Decodificando y optimizando activo multimedia...',
  'Analizando jerarquía visual con Gemini 2.5 Flash Vision...',
  'Extrayendo coordenadas normalizadas y áreas de acción...',
  'Sintetizando InteractionMap inferido y coreografía 3D...',
];

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  cta: {
    bg: 'bg-[#FF5C35]/15',
    border: 'border-[#FF5C35]',
    text: 'text-[#FF5C35]',
    badge: '#FF5C35',
  },
  input: {
    bg: 'bg-blue-500/15',
    border: 'border-blue-500',
    text: 'text-blue-400',
    badge: '#3B82F6',
  },
  card: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    badge: '#10B981',
  },
  metric: {
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    badge: '#10B981',
  },
  navigation: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500',
    text: 'text-amber-400',
    badge: '#F59E0B',
  },
  tab: {
    bg: 'bg-purple-500/15',
    border: 'border-purple-500',
    text: 'text-purple-400',
    badge: '#A855F7',
  },
  other: {
    bg: 'bg-neutral-500/15',
    border: 'border-neutral-500',
    text: 'text-neutral-300',
    badge: '#A3A3A3',
  },
};

export const AssetIntelligenceModal: React.FC<AssetIntelligenceModalProps> = ({
  isOpen,
  onClose,
  onApplySceneGraph,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [targetCtaLabel, setTargetCtaLabel] = useState('');
  const [productTitle, setProductTitle] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<InputIntelligenceResult | null>(null);
  const [selectedLandmarkId, setSelectedLandmarkId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cycle loading step messages during generation
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isLoading]);

  const resetForm = useCallback(() => {
    setSelectedFile(null);
    setPreviewUri(null);
    setErrorMessage(null);
    setAnalysisResult(null);
    setSelectedLandmarkId(null);
    setIsLoading(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const processFile = useCallback((file: File) => {
    setErrorMessage(null);
    setAnalysisResult(null);

    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      setErrorMessage(
        'Formato no soportado. Por favor, sube una imagen (PNG, JPG, WebP) o vídeo (MP4).'
      );
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('El archivo excede el límite de 20 MB.');
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      setPreviewUri(dataUri);
    };
    reader.onerror = () => {
      setErrorMessage('Error al leer el archivo en el navegador.');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleStartAnalysis = async () => {
    if (!previewUri || !selectedFile) {
      setErrorMessage('Por favor, selecciona un archivo primero.');
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setLoadingStepIndex(0);

    try {
      const res = await fetch('/api/input-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileBase64: previewUri,
          mimeType: selectedFile.type,
          filename: selectedFile.name,
          context: {
            title: productTitle.trim() || undefined,
            targetCtaLabel: targetCtaLabel.trim() || undefined,
          },
          targetDurationInFrames: 480,
          fps: 30,
        }),
      });

      const data = (await res.json()) as InputIntelligenceResult & { error?: string };

      if (!res.ok) {
        setErrorMessage(
          data.error || `Error en el análisis (${res.status}). Inténtalo de nuevo.`
        );
        setIsLoading(false);
        return;
      }

      setAnalysisResult(data);
      if (data.landmarks && data.landmarks.length > 0) {
        setSelectedLandmarkId(data.landmarks[0].id);
      }
      setIsLoading(false);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error de red al conectar con el servidor.'
      );
      setIsLoading(false);
    }
  };

  const handleCommitToPlayer = () => {
    if (!analysisResult) return;
    onApplySceneGraph(analysisResult.sceneGraph, previewUri || undefined);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
      onClick={isLoading ? undefined : handleClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-[#181716] border border-white/10 p-6 shadow-2xl flex flex-col gap-5 text-white max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
              <span className="text-base">👁️</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Input Intelligence — Análisis Multimodal
              </h3>
              <p className="text-xs text-neutral-400">
                Sube una captura de tu producto para inferir automáticamente la navegación 3D
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Step 1: File Ingestion Dropzone */}
        {!analysisResult && (
          <div className="flex flex-col gap-4">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-colors ${
                isDragOver
                  ? 'border-[#FF5C35] bg-[#FF5C35]/10'
                  : 'border-white/15 bg-white/5 hover:border-white/30 hover:bg-white/[0.07]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.mp4"
                onChange={handleFileInputChange}
                className="hidden"
              />

              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-2xl">
                📸
              </div>

              {selectedFile ? (
                <div className="flex flex-col items-center">
                  <span className="text-sm font-medium text-white">
                    {selectedFile.name}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type}
                  </span>
                  <span className="text-xs text-[#FF5C35] mt-2 underline">
                    Haz clic para cambiar de archivo
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-white">
                    Arrastra una captura de pantalla o vídeo MP4 aquí
                  </span>
                  <span className="text-xs text-neutral-400">
                    Soporta PNG, JPEG, WebP y MP4 hasta 20 MB
                  </span>
                </div>
              )}
            </div>

            {/* Optional Context Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Nombre del SaaS / Producto (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={60}
                  value={productTitle}
                  onChange={(e) => setProductTitle(e.target.value)}
                  placeholder="Ej. CloudPulse Telemetry"
                  disabled={isLoading}
                  className="px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5C35] disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Botón CTA de Conversión (Opcional)
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={targetCtaLabel}
                  onChange={(e) => setTargetCtaLabel(e.target.value)}
                  placeholder="Ej. Publish, Deploy, Get Started"
                  disabled={isLoading}
                  className="px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5C35] disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="p-4 rounded-xl bg-neutral-900/90 border border-cyan-500/30 flex items-center gap-3 animate-pulse">
            <div className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-white truncate">
                {LOADING_STEPS[loadingStepIndex]}
              </span>
              <span className="text-[10px] text-neutral-400">
                Extrayendo hotspots y sincronizando cámara 3D en 480 fotogramas
              </span>
            </div>
          </div>
        )}

        {/* Step 2: Interactive Landmark Inspection Overlay */}
        {analysisResult && previewUri && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300 font-medium">
                Elementos Detectados ({analysisResult.landmarks.length}) • Origen:{' '}
                <span className="font-mono text-[#FF5C35]">{analysisResult.source}</span>
              </span>
              <button
                type="button"
                onClick={() => setAnalysisResult(null)}
                className="text-neutral-400 hover:text-white underline"
              >
                Subir otro archivo
              </button>
            </div>

            {/* Visual Canvas with Hotspots */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/10 group">
              {/* Media Preview (Image or Video) */}
              {selectedFile?.type === 'video/mp4' ? (
                <video
                  src={previewUri}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewUri}
                  alt="Upload preview"
                  className="w-full h-full object-contain"
                />
              )}

              {/* Landmark Hotspots Overlay */}
              {analysisResult.landmarks.map((landmark: VisualLandmark) => {
                const isSelected = selectedLandmarkId === landmark.id;
                const colors = CATEGORY_COLORS[landmark.category] || CATEGORY_COLORS.other;

                return (
                  <button
                    key={landmark.id}
                    type="button"
                    onClick={() => setSelectedLandmarkId(landmark.id)}
                    style={{
                      left: `${landmark.normalizedCenter.x * 100}%`,
                      top: `${landmark.normalizedCenter.y * 100}%`,
                    }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center justify-center p-1 rounded-full transition-transform cursor-pointer ${
                      isSelected ? 'scale-125 z-20' : 'hover:scale-110 z-10'
                    }`}
                    title={`${landmark.label} (${landmark.category})`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg animate-ping absolute opacity-60"
                      style={{ backgroundColor: colors.badge }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border-2 border-white shadow-md relative"
                      style={{ backgroundColor: colors.badge }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Landmark List Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {analysisResult.landmarks.map((lm: VisualLandmark) => {
                const isSelected = selectedLandmarkId === lm.id;
                const colors = CATEGORY_COLORS[lm.category] || CATEGORY_COLORS.other;

                return (
                  <button
                    key={lm.id}
                    type="button"
                    onClick={() => setSelectedLandmarkId(lm.id)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                      isSelected
                        ? `${colors.bg} ${colors.border} ${colors.text} shadow-sm`
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: colors.badge }}
                    />
                    <span>{lm.label}</span>
                    <span className="font-mono text-[10px] opacity-60">
                      ({(lm.normalizedCenter.x).toFixed(2)}, {(lm.normalizedCenter.y).toFixed(2)})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Summary Notice */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-neutral-300">
              <span className="font-medium text-white">Resumen: </span>
              {analysisResult.summary}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>

          {!analysisResult ? (
            <button
              type="button"
              onClick={handleStartAnalysis}
              disabled={isLoading || !previewUri}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-white text-xs font-semibold shadow-lg shadow-cyan-500/25 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Analizando...</span>
                </>
              ) : (
                <>
                  <span>👁️</span>
                  <span>Analizar con Gemini Vision</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCommitToPlayer}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#FF5C35] hover:bg-[#E04822] text-white text-xs font-semibold shadow-lg shadow-[#FF5C35]/25 transition-all active:scale-95"
            >
              <span>🚀</span>
              <span>Cargar en Reproductor</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
