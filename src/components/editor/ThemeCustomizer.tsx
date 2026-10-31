'use client';

/**
 * ThemeCustomizer.tsx
 *
 * Art Direction & Style Customizer:
 * - Primary accent color presets & custom hex text input with HexColorRegex validation
 * - Native color picker integration
 * - Surface theme toggle (dark vs light)
 * - Backdrop mesh variant selector (dark-precision, light-editorial, aurora-blur, solid)
 * - Curated 1-click studio theme presets
 */

import React, { useState } from 'react';
import { HexColorRegex } from '../../lib/scene-graph/schema';
import type {
  BackdropVariant,
  SceneGraph,
  SurfaceTheme,
} from '../../lib/scene-graph/types';

export interface ThemeCustomizerProps {
  sceneGraph: SceneGraph;
  onUpdateArtDirection: (payload: {
    backdropVariant?: BackdropVariant;
    surfaceTheme?: SurfaceTheme;
    primaryAccent?: string;
  }) => void;
}

const COLOR_SWATCHES = [
  { name: 'Base44 Flame', hex: '#FF5C35' },
  { name: 'Electric Blue', hex: '#3B82F6' },
  { name: 'Emerald Green', hex: '#22C55E' },
  { name: 'Violet Purple', hex: '#A855F7' },
  { name: 'Amber Gold', hex: '#EAB308' },
  { name: 'Hot Pink', hex: '#EC4899' },
  { name: 'Cyan Neon', hex: '#06B6D4' },
];

const BACKDROP_VARIANTS: Array<{
  id: BackdropVariant;
  name: string;
  desc: string;
}> = [
  {
    id: 'dark-precision',
    name: 'Dark Precision',
    desc: 'Estudio oscuro con gradiente radial y malla de puntos sutil',
  },
  {
    id: 'light-editorial',
    name: 'Light Editorial',
    desc: 'Fondo marfil cálido (#FAF9F5) de alta legibilidad editorial',
  },
  {
    id: 'aurora-blur',
    name: 'Aurora Blur',
    desc: 'Esferas cinemáticas desenfocadas con resplandor cromático',
  },
  {
    id: 'solid',
    name: 'Solid Clean',
    desc: 'Plano monocromático puro con dot grid minimalista',
  },
];

export const ThemeCustomizer: React.FC<ThemeCustomizerProps> = ({
  sceneGraph,
  onUpdateArtDirection,
}) => {
  const currentAccent = sceneGraph.artDirection.primaryAccent;
  const currentTheme = sceneGraph.artDirection.surfaceTheme;
  const currentBackdrop = sceneGraph.artDirection.backdropVariant;

  const [hexInput, setHexInput] = useState(currentAccent);
  const [hexError, setHexError] = useState<string | null>(null);

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (HexColorRegex.test(val)) {
      setHexError(null);
      onUpdateArtDirection({ primaryAccent: val });
    } else {
      setHexError('Debe ser un código hex válido (ej. #FF5C35 o #FFF)');
    }
  };

  const handleApplyPreset = (
    accent: string,
    theme: SurfaceTheme,
    backdrop: BackdropVariant
  ) => {
    setHexInput(accent);
    setHexError(null);
    onUpdateArtDirection({
      primaryAccent: accent,
      surfaceTheme: theme,
      backdropVariant: backdrop,
    });
  };

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <span>🎨</span>
          <span>Dirección de Arte & Estilo</span>
        </h3>
        <p className="text-xs text-neutral-400">
          Controla la atmósfera visual, colores de resplandor y contraste cromático.
        </p>
      </div>

      {/* 1-Click Studio Style Presets */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-neutral-300">
          Presets Rápidos de Estudio
        </span>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleApplyPreset('#FF5C35', 'dark', 'dark-precision')}
            className="p-2.5 rounded-lg bg-neutral-900 border border-white/10 hover:border-[#FF5C35]/50 text-left transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-[#FF5C35]" />
              <span className="text-xs font-medium text-white group-hover:text-[#FF5C35]">
                Tech Precision
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 block">
              Dark • Flame #FF5C35
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('#FF5C35', 'light', 'light-editorial')}
            className="p-2.5 rounded-lg bg-neutral-900 border border-white/10 hover:border-[#FF5C35]/50 text-left transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-[#FF5C35]" />
              <span className="text-xs font-medium text-white group-hover:text-[#FF5C35]">
                Light Editorial
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 block">
              Light • Marfil Editorial
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('#A855F7', 'dark', 'aurora-blur')}
            className="p-2.5 rounded-lg bg-neutral-900 border border-white/10 hover:border-[#A855F7]/50 text-left transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-[#A855F7]" />
              <span className="text-xs font-medium text-white group-hover:text-[#A855F7]">
                Cyber Aurora
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 block">
              Dark • Violet Glow
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleApplyPreset('#22C55E', 'light', 'solid')}
            className="p-2.5 rounded-lg bg-neutral-900 border border-white/10 hover:border-[#22C55E]/50 text-left transition-all group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full bg-[#22C55E]" />
              <span className="text-xs font-medium text-white group-hover:text-[#22C55E]">
                Emerald Clean
              </span>
            </div>
            <span className="text-[10px] text-neutral-500 block">
              Light • Solid Mint
            </span>
          </button>
        </div>
      </div>

      {/* Surface Theme Toggle */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-neutral-300">
          Tema de Superficie (UI Theme)
        </label>
        <div className="grid grid-cols-2 gap-2 bg-neutral-900 p-1 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => onUpdateArtDirection({ surfaceTheme: 'dark' })}
            className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              currentTheme === 'dark'
                ? 'bg-[#1E1E1C] text-white shadow-xs border border-white/10'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>🌙</span>
            <span>Modo Oscuro</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateArtDirection({ surfaceTheme: 'light' })}
            className={`py-2 px-3 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-all ${
              currentTheme === 'light'
                ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <span>☀️</span>
            <span>Modo Claro</span>
          </button>
        </div>
      </div>

      {/* Primary Accent Color & Swatches */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-300">
            Color de Acento Principal
          </label>
          <span className="font-mono text-xs text-neutral-400">
            {currentAccent}
          </span>
        </div>

        {/* Color Swatches */}
        <div className="flex flex-wrap gap-2">
          {COLOR_SWATCHES.map((swatch) => {
            const isSelected = currentAccent.toLowerCase() === swatch.hex.toLowerCase();
            return (
              <button
                key={swatch.hex}
                type="button"
                onClick={() => {
                  setHexInput(swatch.hex);
                  setHexError(null);
                  onUpdateArtDirection({ primaryAccent: swatch.hex });
                }}
                className={`w-7 h-7 rounded-full transition-transform relative ${
                  isSelected ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-black' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: swatch.hex }}
                title={`${swatch.name} (${swatch.hex})`}
              />
            );
          })}
        </div>

        {/* Custom Hex Input + Native Color Picker */}
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={HexColorRegex.test(currentAccent) ? currentAccent : '#FF5C35'}
            onChange={(e) => handleHexChange(e.target.value)}
            className="w-9 h-9 rounded-lg bg-neutral-900 border border-white/10 cursor-pointer p-0.5 shrink-0"
            title="Seleccionar color con cuentagotas nativo"
          />

          <div className="flex-1 flex flex-col">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-white font-mono text-xs placeholder-neutral-600 focus:outline-none focus:border-[#FF5C35]"
              placeholder="#FF5C35"
              maxLength={7}
            />
          </div>
        </div>

        {hexError && (
          <span className="text-[11px] text-amber-400 font-mono">
            ⚠️ {hexError}
          </span>
        )}
      </div>

      {/* Backdrop Variant Selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-neutral-300">
          Variante de Fondo Dinámico (Backdrop)
        </label>
        <div className="flex flex-col gap-2">
          {BACKDROP_VARIANTS.map((v) => {
            const isSelected = currentBackdrop === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onUpdateArtDirection({ backdropVariant: v.id })}
                className={`p-3 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'bg-neutral-900 border-[#FF5C35] text-white shadow-xs'
                    : 'bg-white/[0.02] border-white/5 text-neutral-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white">
                    {v.name}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF5C35]/20 text-[#FF5C35] font-mono">
                      Activo
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-neutral-500 block leading-tight">
                  {v.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
