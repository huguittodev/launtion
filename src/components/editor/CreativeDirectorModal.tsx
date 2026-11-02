'use client';

/**
 * CreativeDirectorModal.tsx
 *
 * Interactive AI Studio Modal for Phase 4: Creative Director Agent (Gemini).
 * Enables users to enter SaaS product briefs (Name, Tagline, Description, Tone, Accent Color)
 * and generate a broadcast-quality SceneGraph (v2.0) with real-time feedback and deterministic fallback.
 */

import React, { useState, useEffect } from 'react';
import type { SceneGraph } from '../../lib/scene-graph/types';
import type { BrandTone } from '../../lib/ai/brief-schema';

export interface CreativeDirectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (sceneGraph: SceneGraph) => void;
}

const PRESET_COLORS = [
  { label: 'Flame', hex: '#FF5C35' },
  { label: 'Electric Blue', hex: '#3B82F6' },
  { label: 'Emerald', hex: '#10B981' },
  { label: 'Violet', hex: '#8B5CF6' },
  { label: 'Amber', hex: '#F59E0B' },
];

const TONES: Array<{ id: BrandTone; label: string; description: string }> = [
  {
    id: 'tech-precision',
    label: 'Tech Precision',
    description: 'Alta ingeniería, fondo obsidian oscuro y contraste nítido.',
  },
  {
    id: 'punchy-social',
    label: 'Punchy Social',
    description: 'Dinámico, fondo aurora blur y ritmo cinematográfico acelerado.',
  },
  {
    id: 'editorial-clean',
    label: 'Editorial Clean',
    description: 'Minimalista, fondo claro editorial y tipografía refinada.',
  },
];

const LOADING_STEPS = [
  'Analizando propuesta de valor y posicionamiento del SaaS...',
  'Estructurando 5 micro-escenas cinematográficas (480 fotogramas)...',
  'Calculando trayectorias 3D y arcos Bezier del cursor...',
  'Sincronizando diseño acústico y efectos con el limitador...',
];

export const CreativeDirectorModal: React.FC<CreativeDirectorModalProps> = ({
  isOpen,
  onClose,
  onGenerated,
}) => {
  const [productName, setProductName] = useState('PulseMetrics');
  const [tagline, setTagline] = useState('Observabilidad en tiempo real para microservicios');
  const [description, setDescription] = useState(
    'Plataforma de telemetría instantánea y análisis de causa raíz para equipos de alta escala.'
  );
  const [tone, setTone] = useState<BrandTone>('tech-precision');
  const [accentColor, setAccentColor] = useState('#FF5C35');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cycle loading step messages during generation
  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = productName.trim();
    const trimmedDesc = description.trim();

    if (!trimmedName) {
      setErrorMessage('El nombre del producto es obligatorio.');
      return;
    }

    if (trimmedDesc.length < 10) {
      setErrorMessage('La descripción debe contener al menos 10 caracteres.');
      return;
    }

    setLoadingStepIndex(0);
    setIsLoading(true);

    try {
      const res = await fetch('/api/creative-director', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName: trimmedName,
          tagline: tagline.trim() || undefined,
          description: trimmedDesc,
          tone,
          accentColor,
          targetDurationInFrames: 480,
          fps: 30,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(
          data.error ||
            data.message ||
            `Error en la generación (${res.status}). Inténtalo de nuevo.`
        );
        setIsLoading(false);
        return;
      }

      if (data.sceneGraph) {
        onGenerated(data.sceneGraph);
        setIsLoading(false);
        onClose();
      } else {
        setErrorMessage('La respuesta del servidor no incluyó un SceneGraph válido.');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error de red al conectar con el servidor.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none"
      onClick={isLoading ? undefined : onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-[#181716] border border-white/10 p-6 shadow-2xl flex flex-col gap-5 text-white max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#FF5C35] to-[#FF8C35] flex items-center justify-center text-white shadow-lg shadow-[#FF5C35]/25">
              <span className="text-base">✨</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white tracking-tight">
                Director Creativo IA
              </h3>
              <p className="text-xs text-neutral-400">
                Genera guion, ritmo, cámara 3D y audio con Gemini
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Product Name & Tagline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-300">
                Nombre del Producto <span className="text-[#FF5C35]">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={50}
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ej. Base44, PulseMetrics"
                disabled={isLoading}
                className="px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5C35] disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-300">
                Tagline / Subtítulo
              </label>
              <input
                type="text"
                maxLength={100}
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Ej. Telemetría de alta escala"
                disabled={isLoading}
                className="px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5C35] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-neutral-300">
              Descripción o Propuesta de Valor <span className="text-[#FF5C35]">*</span>
            </label>
            <textarea
              required
              rows={3}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe qué problema resuelve el software, para quién es y su mayor beneficio..."
              disabled={isLoading}
              className="px-3 py-2 rounded-lg bg-neutral-900 border border-white/10 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#FF5C35] resize-none disabled:opacity-50"
            />
            <span className="text-[10px] text-neutral-500 self-end">
              {description.length}/500 caracteres (mínimo 10)
            </span>
          </div>

          {/* Tone Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-300">
              Tono Audiovisual
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TONES.map((t) => {
                const isSelected = tone === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    disabled={isLoading}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-[#FF5C35]/15 border-[#FF5C35] text-white shadow-sm'
                        : 'bg-neutral-900 border-white/5 text-neutral-400 hover:text-white hover:border-white/15'
                    }`}
                  >
                    <span className="text-xs font-semibold text-white">
                      {t.label}
                    </span>
                    <span className="text-[10px] text-neutral-400 leading-tight">
                      {t.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Accent Color */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-neutral-300">
              Color de Acento de Marca
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map((preset) => {
                const isSelected = accentColor.toLowerCase() === preset.hex.toLowerCase();
                return (
                  <button
                    key={preset.hex}
                    type="button"
                    onClick={() => setAccentColor(preset.hex)}
                    disabled={isLoading}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      isSelected
                        ? 'border-white bg-white/10 text-white'
                        : 'border-white/10 bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: preset.hex }}
                    />
                    <span>{preset.label}</span>
                  </button>
                );
              })}

              <div className="flex items-center gap-1.5 ml-auto">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  disabled={isLoading}
                  className="w-7 h-7 rounded border border-white/20 bg-transparent cursor-pointer"
                  title="Selector personalizado"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  disabled={isLoading}
                  className="w-20 px-2 py-1 rounded bg-neutral-900 border border-white/10 text-xs font-mono text-white text-center focus:outline-none focus:border-[#FF5C35]"
                />
              </div>
            </div>
          </div>

          {/* Loading Indicator */}
          {isLoading && (
            <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-[#FF5C35]/30 flex items-center gap-3 animate-pulse">
              <div className="w-5 h-5 rounded-full border-2 border-[#FF5C35] border-t-transparent animate-spin shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-white truncate">
                  {LOADING_STEPS[loadingStepIndex]}
                </span>
                <span className="text-[10px] text-neutral-400">
                  Componiendo SceneGraph v2.0 determinista • 480 fotogramas
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-40"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isLoading || !productName.trim() || description.trim().length < 10}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-[#FF5C35] to-[#FF8C35] hover:brightness-110 text-white text-xs font-semibold shadow-lg shadow-[#FF5C35]/25 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Generando...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Generar Anuncio con IA</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
