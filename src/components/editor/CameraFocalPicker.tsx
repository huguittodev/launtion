'use client';

/**
 * CameraFocalPicker.tsx
 *
 * Interactive 3D Camera & Focal Point Editor:
 * - Interactive 2D miniature pad for spatial (x, y) positioning [0.0, 1.0]
 * - Rule of thirds guidelines & keyframe trajectory markers
 * - Optical zoom factor slider [0.8, 3.5]
 * - Keyframe selector dropdown & timeline alignment
 * - 3D Pitch (rotateX) and Yaw (rotateY) tilt controls
 * - Quick SaaS focal presets (Hero CTA, Prompt Typer, Center, Calendar)
 */

import React, { useRef, useCallback } from 'react';
import { clamp01 } from '../../lib/interaction-map/CoordinateMapper';
import type { SceneGraph } from '../../lib/scene-graph/types';

export interface CameraFocalPickerProps {
  sceneGraph: SceneGraph;
  activeKeyframeIndex: number;
  onSelectKeyframe: (index: number) => void;
  onUpdateFocal: (payload: {
    keyframeIndex?: number;
    x?: number;
    y?: number;
    zoom?: number;
    rotateX?: number;
    rotateY?: number;
    rotateZ?: number;
    easing?: 'linear' | 'ease-in-out' | 'spring';
  }) => void;
  onSeekToFrame?: (frame: number) => void;
}

const FOCAL_PRESETS: Array<{
  name: string;
  x: number;
  y: number;
  zoom: number;
  desc: string;
}> = [
  { name: 'Centro Óptico', x: 0.5, y: 0.5, zoom: 1.0, desc: 'Encuadre neutro 1.0x' },
  { name: 'Prompt Typer', x: 0.5, y: 0.62, zoom: 2.2, desc: 'Caja de texto de IA' },
  { name: 'Botón Hero', x: 0.72, y: 0.34, zoom: 2.4, desc: 'Botón Publish' },
  { name: 'Píldora Sync', x: 0.35, y: 0.45, zoom: 1.8, desc: 'Conector de calendario' },
];

export const CameraFocalPicker: React.FC<CameraFocalPickerProps> = ({
  sceneGraph,
  activeKeyframeIndex,
  onSelectKeyframe,
  onUpdateFocal,
  onSeekToFrame,
}) => {
  const padRef = useRef<HTMLDivElement>(null);
  const track = sceneGraph.cameraTrack;
  const kf = track[activeKeyframeIndex] ?? track[0] ?? {
    frame: 0,
    x: 0.5,
    y: 0.5,
    zoom: 1.0,
    rotateX: 6,
    rotateY: -4,
  };

  const handlePadPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!padRef.current) return;
      const rect = padRef.current.getBoundingClientRect();
      const normX = clamp01((e.clientX - rect.left) / rect.width);
      const normY = clamp01((e.clientY - rect.top) / rect.height);

      onUpdateFocal({
        keyframeIndex: activeKeyframeIndex,
        x: Number(normX.toFixed(3)),
        y: Number(normY.toFixed(3)),
      });
    },
    [activeKeyframeIndex, onUpdateFocal]
  );

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div>
        <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <span>🎥</span>
          <span>Cámara 3D & Puntos Focales</span>
        </h3>
        <p className="text-xs text-neutral-400">
          Ajusta la trayectoria de la cámara cinemática, zoom óptico y rotación de perspectiva.
        </p>
      </div>

      {/* Keyframe Selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-300">
            Keyframe Activo de Cámara
          </label>
          <span className="text-[11px] font-mono text-neutral-400">
            {activeKeyframeIndex + 1} de {track.length}
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {track.map((item, idx) => {
            const isSelected = idx === activeKeyframeIndex;
            return (
              <button
                key={`kf-btn-${item.frame}-${idx}`}
                type="button"
                onClick={() => {
                  onSelectKeyframe(idx);
                  onSeekToFrame?.(item.frame);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-[#FF5C35] text-white border-[#FF5C35] shadow-xs'
                    : 'bg-neutral-900 border-white/10 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
                title={`Ir a Frame ${item.frame} (Zoom: ${item.zoom}x)`}
              >
                <span>F{item.frame}</span>
                <span className="text-[10px] opacity-75 ml-1">
                  ({item.zoom}x)
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive 2D Pad (Miniature Canvas) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-300">
            Pad de Coordenadas Focales (X, Y)
          </label>
          <span className="font-mono text-xs text-[#FF5C35]">
            ({kf.x.toFixed(3)}, {kf.y.toFixed(3)})
          </span>
        </div>

        <div
          ref={padRef}
          onPointerDown={handlePadPointer}
          className="relative w-full aspect-video rounded-xl bg-neutral-950 border border-white/15 overflow-hidden cursor-crosshair shadow-inner select-none"
          title="Haz clic para reubicar el punto focal de la cámara"
        >
          {/* Rule of Thirds Guide Lines */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-white/[0.05]" />
            <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-white/[0.05]" />
            <div className="absolute top-1/3 left-0 right-0 h-[1px] bg-white/[0.05]" />
            <div className="absolute top-2/3 left-0 right-0 h-[1px] bg-white/[0.05]" />
          </div>

          {/* All Keyframe Dots */}
          {track.map((otherKf, idx) => {
            if (idx === activeKeyframeIndex) return null;
            return (
              <div
                key={`pad-kf-${otherKf.frame}-${idx}`}
                className="absolute w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-600 border border-black pointer-events-none"
                style={{
                  left: `${otherKf.x * 100}%`,
                  top: `${otherKf.y * 100}%`,
                }}
              />
            );
          })}

          {/* Active Keyframe Target Handle */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-75"
            style={{
              left: `${kf.x * 100}%`,
              top: `${kf.y * 100}%`,
            }}
          >
            <div className="w-5 h-5 rounded-full border-2 border-[#FF5C35] bg-[#FF5C35]/30 flex items-center justify-center shadow-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>
          </div>

          {/* Helper caption inside pad */}
          <div className="absolute bottom-1.5 right-2 text-[10px] font-mono text-neutral-600 pointer-events-none">
            1920×1080 Normalized (0-1)
          </div>
        </div>
      </div>

      {/* Numerical Sliders (X & Y) */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="focalX" className="text-neutral-400">Coordenada X</label>
            <span className="font-mono text-neutral-300">{kf.x.toFixed(2)}</span>
          </div>
          <input
            id="focalX"
            type="range"
            min={0.0}
            max={1.0}
            step={0.01}
            value={kf.x}
            onChange={(e) =>
              onUpdateFocal({
                keyframeIndex: activeKeyframeIndex,
                x: Number(e.target.value),
              })
            }
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#FF5C35]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="focalY" className="text-neutral-400">Coordenada Y</label>
            <span className="font-mono text-neutral-300">{kf.y.toFixed(2)}</span>
          </div>
          <input
            id="focalY"
            type="range"
            min={0.0}
            max={1.0}
            step={0.01}
            value={kf.y}
            onChange={(e) =>
              onUpdateFocal({
                keyframeIndex: activeKeyframeIndex,
                y: Number(e.target.value),
              })
            }
            className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#FF5C35]"
          />
        </div>
      </div>

      {/* Optical Zoom Slider */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="cameraZoom" className="font-semibold text-neutral-300">
            Aumento / Zoom Óptico
          </label>
          <span className="font-mono text-xs font-semibold text-[#FF5C35]">
            {kf.zoom.toFixed(2)}x
          </span>
        </div>
        <input
          id="cameraZoom"
          type="range"
          min={0.8}
          max={3.5}
          step={0.05}
          value={kf.zoom}
          onChange={(e) =>
            onUpdateFocal({
              keyframeIndex: activeKeyframeIndex,
              zoom: Number(e.target.value),
            })
          }
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#FF5C35]"
        />
        <div className="flex justify-between text-[10px] font-mono text-neutral-500">
          <span>0.8x (Overview)</span>
          <span>2.0x (Medio)</span>
          <span>3.5x (Primer Plano)</span>
        </div>
      </div>

      {/* 3D Perspective Tilt (Pitch & Yaw) */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-3">
        <span className="text-xs font-semibold text-neutral-300">
          Inclinación de Perspectiva 3D
        </span>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <label htmlFor="rotateX">Pitch (X)</label>
              <span className="font-mono text-neutral-300">
                {(kf.rotateX ?? 0).toFixed(0)}°
              </span>
            </div>
            <input
              id="rotateX"
              type="range"
              min={-30}
              max={30}
              step={1}
              value={kf.rotateX ?? 0}
              onChange={(e) =>
                onUpdateFocal({
                  keyframeIndex: activeKeyframeIndex,
                  rotateX: Number(e.target.value),
                })
              }
              className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-[#FF5C35]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <label htmlFor="rotateY">Yaw (Y)</label>
              <span className="font-mono text-neutral-300">
                {(kf.rotateY ?? 0).toFixed(0)}°
              </span>
            </div>
            <input
              id="rotateY"
              type="range"
              min={-30}
              max={30}
              step={1}
              value={kf.rotateY ?? 0}
              onChange={(e) =>
                onUpdateFocal({
                  keyframeIndex: activeKeyframeIndex,
                  rotateY: Number(e.target.value),
                })
              }
              className="w-full h-1.5 bg-neutral-800 rounded appearance-none cursor-pointer accent-[#FF5C35]"
            />
          </div>
        </div>
      </div>

      {/* Focal Target Presets */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-neutral-300">
          Posiciones Rápidas Predeterminadas
        </span>
        <div className="grid grid-cols-2 gap-2">
          {FOCAL_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() =>
                onUpdateFocal({
                  keyframeIndex: activeKeyframeIndex,
                  x: p.x,
                  y: p.y,
                  zoom: p.zoom,
                })
              }
              className="p-2 rounded-lg bg-neutral-900 border border-white/10 hover:border-[#FF5C35]/50 text-left transition-colors"
            >
              <div className="text-xs font-medium text-white">{p.name}</div>
              <div className="text-[10px] text-neutral-500 font-mono">
                ({p.x}, {p.y}) • {p.zoom}x
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
