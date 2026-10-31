'use client';

/**
 * TimelineControl.tsx
 *
 * Studio transport and playback scrubber:
 * - Play / Pause toggle
 * - Frame-by-frame and second-by-second micro stepping
 * - Continuous high-precision range scrubber
 * - Deterministic timecode (MM:SS.FF) & frame indicators
 * - Visual scene indicator identifying active scene at current frame
 */

import React, { useCallback } from 'react';
import type { SceneGraph } from '../../lib/scene-graph/types';

export interface TimelineControlProps {
  sceneGraph: SceneGraph;
  currentFrame: number;
  isPlaying: boolean;
  onSeek: (frame: number) => void;
  onTogglePlay: () => void;
}

export const TimelineControl: React.FC<TimelineControlProps> = ({
  sceneGraph,
  currentFrame,
  isPlaying,
  onSeek,
  onTogglePlay,
}) => {
  const duration = sceneGraph.canvas.durationInFrames;
  const fps = sceneGraph.canvas.fps;

  // Format timecode into MM:SS.ff
  const formatTimecode = useCallback((frame: number) => {
    const totalSeconds = frame / fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const subFrames = frame % fps;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(minutes)}:${pad(seconds)}.${pad(subFrames)}`;
  }, [fps]);

  // Identify active scene at current frame
  const activeScene = sceneGraph.scenes.find((s) => {
    const start = s.startFrame;
    const end = start + s.durationInFrames;
    return currentFrame >= start && currentFrame < end;
  }) ?? sceneGraph.scenes[0];

  const handleStep = useCallback((delta: number) => {
    const target = Math.max(0, Math.min(duration - 1, currentFrame + delta));
    onSeek(target);
  }, [currentFrame, duration, onSeek]);

  return (
    <div className="w-full bg-[#181716] border border-white/10 rounded-xl p-3 select-none">
      {/* Upper Bar: Controls, Scrubber, Timecode */}
      <div className="flex flex-col gap-2">
        {/* Scrubber Range with Keyframe / Scene Markers */}
        <div className="relative flex items-center group">
          <input
            type="range"
            min={0}
            max={duration - 1}
            value={currentFrame}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-[#FF5C35] focus:outline-none focus:ring-1 focus:ring-[#FF5C35]"
            title={`Arrastra para saltar a cualquier fotograma (0-${duration - 1})`}
          />

          {/* Keyframe Markers on track */}
          <div className="absolute inset-x-0 top-0 h-2 pointer-events-none overflow-hidden">
            {sceneGraph.cameraTrack.map((kf, i) => {
              const leftPercent = (kf.frame / duration) * 100;
              return (
                <div
                  key={`kf-${kf.frame}-${i}`}
                  className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 -translate-x-1/2 rotate-45 bg-amber-400 border border-black/40 shadow-xs"
                  style={{ left: `${leftPercent}%` }}
                  title={`Cámara Keyframe: Frame ${kf.frame} (${kf.zoom}x)`}
                />
              );
            })}
          </div>
        </div>

        {/* Lower Transport Row */}
        <div className="flex items-center justify-between gap-3 text-xs">
          {/* Left Transport Buttons */}
          <div className="flex items-center gap-1">
            {/* Jump to start */}
            <button
              type="button"
              onClick={() => onSeek(0)}
              className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Ir al inicio (Frame 0)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>

            {/* Step -1s */}
            <button
              type="button"
              onClick={() => handleStep(-fps)}
              className="px-2 py-1 rounded text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Retroceder 1 segundo (-30 frames)"
            >
              -1s
            </button>

            {/* Step -1f */}
            <button
              type="button"
              onClick={() => handleStep(-1)}
              className="px-2 py-1 rounded text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Retroceder 1 frame"
            >
              -1f
            </button>

            {/* Play / Pause Toggle */}
            <button
              type="button"
              onClick={onTogglePlay}
              className="w-8 h-8 rounded-full bg-[#FF5C35] hover:bg-[#E04822] text-white flex items-center justify-center shadow-md transition-all active:scale-95 mx-1"
              title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}
            >
              {isPlaying ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Step +1f */}
            <button
              type="button"
              onClick={() => handleStep(1)}
              className="px-2 py-1 rounded text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Avanzar 1 frame"
            >
              +1f
            </button>

            {/* Step +1s */}
            <button
              type="button"
              onClick={() => handleStep(fps)}
              className="px-2 py-1 rounded text-[11px] font-mono text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Avanzar 1 segundo (+30 frames)"
            >
              +1s
            </button>
          </div>

          {/* Active Scene Indicator */}
          {activeScene && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 text-neutral-300 font-mono text-[11px] border border-white/5 truncate max-w-[240px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C35]" />
              <span className="truncate">{activeScene.type}</span>
            </div>
          )}

          {/* Right: Timecode Display */}
          <div className="flex items-center gap-2 font-mono text-neutral-300">
            <span className="text-[#FAF9F5] font-semibold">
              {formatTimecode(currentFrame)}
            </span>
            <span className="text-neutral-500">/</span>
            <span className="text-neutral-500">
              {formatTimecode(duration)}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-neutral-400 ml-1">
              F{currentFrame}/{duration}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
