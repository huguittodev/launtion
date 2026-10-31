'use client';

/**
 * RemotionPlayerPreview.tsx
 *
 * Client-Side Rendered (CSR) wrapper for @remotion/player.
 * Uses next/dynamic with ssr: false to guarantee that WebAudio, Canvas,
 * and ResizeObserver browser APIs are never evaluated during SSR.
 * Integrates PlayerRef hooks, 16:9 aspect-video styling, loading skeleton,
 * and optional interactive 2D focal reticle overlay.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { PlayerRef } from '@remotion/player';
import {
  InteractiveSurfaceDemo,
  type InteractiveSurfaceDemoProps,
} from '../../../remotion/compositions/InteractiveSurfaceDemo';
import { clamp01 } from '../../lib/interaction-map/CoordinateMapper';
import type { CameraKeyframe, SceneGraph } from '../../lib/scene-graph/types';

/**
 * Loading skeleton displayed while Remotion player bundle is initialized.
 */
export const PlayerLoadingSkeleton: React.FC = () => {
  return (
    <div className="w-full h-full rounded-2xl bg-[#141413] border border-neutral-800 flex flex-col items-center justify-center text-neutral-500 animate-pulse relative overflow-hidden select-none">
      <div className="w-14 h-14 rounded-full bg-neutral-800/80 flex items-center justify-center mb-3">
        <svg
          className="w-6 h-6 text-[#FF5C35] ml-0.5"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <span className="text-xs font-medium tracking-wide text-neutral-300">
        Cargando Reproductor de Remotion (v4.0.539)...
      </span>
      <span className="text-[11px] text-neutral-500 mt-1 font-mono">
        Inicializando contexto WebAudio & Canvas 1080p
      </span>
    </div>
  );
};

// Dynamic import with SSR strictly disabled
const DynamicPlayer = dynamic(
  () => import('@remotion/player').then((mod) => mod.Player),
  {
    ssr: false,
    loading: () => <PlayerLoadingSkeleton />,
  }
) as unknown as React.ComponentType<
  React.ComponentProps<typeof import('@remotion/player').Player> & {
    ref?: React.Ref<PlayerRef>;
  }
>;

export interface RemotionPlayerPreviewProps {
  sceneGraph: SceneGraph;
  playerRef: React.RefObject<PlayerRef | null>;
  currentFrame?: number;
  isPlaying?: boolean;
  activeKeyframe?: CameraKeyframe;
  showFocalOverlay?: boolean;
  onFrameUpdate?: (frame: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onUpdateFocalPoint?: (x: number, y: number) => void;
}

const subscribeEmpty = () => () => {};

export const RemotionPlayerPreview: React.FC<RemotionPlayerPreviewProps> = ({
  sceneGraph,
  playerRef,
  activeKeyframe,
  showFocalOverlay = false,
  onFrameUpdate,
  onPlayStateChange,
  onUpdateFocalPoint,
}) => {
  const isMounted = React.useSyncExternalStore(
    subscribeEmpty,
    () => true,
    () => false
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDraggingFocal, setIsDraggingFocal] = useState(false);

  // Synchronize PlayerRef event listeners for frame updates & play/pause status
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const handleFrame = (e: { detail: { frame: number } }) => {
      onFrameUpdate?.(Math.round(e.detail.frame));
    };
    const handlePlay = () => onPlayStateChange?.(true);
    const handlePause = () => onPlayStateChange?.(false);
    const handleEnded = () => onPlayStateChange?.(false);

    player.addEventListener('timeupdate', handleFrame);
    player.addEventListener('frameupdate', handleFrame);
    player.addEventListener('play', handlePlay);
    player.addEventListener('pause', handlePause);
    player.addEventListener('ended', handleEnded);

    return () => {
      player.removeEventListener('timeupdate', handleFrame);
      player.removeEventListener('frameupdate', handleFrame);
      player.removeEventListener('play', handlePlay);
      player.removeEventListener('pause', handlePause);
      player.removeEventListener('ended', handleEnded);
    };
  }, [playerRef, onFrameUpdate, onPlayStateChange, isMounted]);

  // Handle pointer down on overlay to interactively set focal point (x, y)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onUpdateFocalPoint || !containerRef.current) return;
      setIsDraggingFocal(true);

      const rect = containerRef.current.getBoundingClientRect();
      const normX = clamp01((e.clientX - rect.left) / rect.width);
      const normY = clamp01((e.clientY - rect.top) / rect.height);
      onUpdateFocalPoint(Number(normX.toFixed(3)), Number(normY.toFixed(3)));
    },
    [onUpdateFocalPoint]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingFocal || !onUpdateFocalPoint || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const normX = clamp01((e.clientX - rect.left) / rect.width);
      const normY = clamp01((e.clientY - rect.top) / rect.height);
      onUpdateFocalPoint(Number(normX.toFixed(3)), Number(normY.toFixed(3)));
    },
    [isDraggingFocal, onUpdateFocalPoint]
  );

  const handlePointerUp = useCallback(() => {
    setIsDraggingFocal(false);
  }, []);

  // Determine current active focal point to display reticle
  const kf = activeKeyframe ?? sceneGraph.cameraTrack[0];
  const zoom = kf?.zoom ?? 1.0;
  const focalX = kf?.x ?? 0.5;
  const focalY = kf?.y ?? 0.5;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video rounded-2xl overflow-hidden bg-[#121211] shadow-2xl border border-neutral-800/80 flex items-center justify-center select-none group"
      onPointerMove={showFocalOverlay ? handlePointerMove : undefined}
      onPointerUp={showFocalOverlay ? handlePointerUp : undefined}
      onPointerLeave={showFocalOverlay ? handlePointerUp : undefined}
    >
      {!isMounted ? (
        <PlayerLoadingSkeleton />
      ) : (
        <DynamicPlayer
          ref={playerRef as React.Ref<PlayerRef>}
          component={InteractiveSurfaceDemo}
          inputProps={{ sceneGraph } as InteractiveSurfaceDemoProps}
          durationInFrames={sceneGraph.canvas.durationInFrames}
          fps={sceneGraph.canvas.fps}
          compositionWidth={sceneGraph.canvas.width}
          compositionHeight={sceneGraph.canvas.height}
          style={{ width: '100%', height: '100%' }}
          controls={false}
          loop={true}
          autoPlay={false}
          clickToPlay={false}
          spaceKeyToPlayOrPause={false}
          acknowledgeRemotionLicense={true}
        />
      )}

      {/* Interactive Camera Focal Reticle Overlay */}
      {showFocalOverlay && isMounted && (
        <div
          className="absolute inset-0 z-20 cursor-crosshair bg-black/10 transition-colors hover:bg-black/20"
          onPointerDown={handlePointerDown}
        >
          {/* Visible Framing Boundary Box based on zoom */}
          <div
            className="absolute border border-dashed border-[#FF5C35]/60 rounded-lg pointer-events-none transition-all duration-75"
            style={{
              left: `${Math.max(0, (focalX - 0.5 / zoom) * 100)}%`,
              top: `${Math.max(0, (focalY - 0.5 / zoom) * 100)}%`,
              width: `${Math.min(100, (1 / zoom) * 100)}%`,
              height: `${Math.min(100, (1 / zoom) * 100)}%`,
            }}
          />

          {/* Focal Target Crosshair Reticle */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75"
            style={{
              left: `${focalX * 100}%`,
              top: `${focalY * 100}%`,
            }}
          >
            {/* Outer Ring */}
            <div className="w-8 h-8 rounded-full border-2 border-[#FF5C35] bg-[#FF5C35]/20 flex items-center justify-center shadow-lg animate-pulse">
              {/* Center Dot */}
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>

            {/* Coordinates Badge */}
            <div className="absolute top-9 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] whitespace-nowrap border border-white/10 shadow-md">
              X: {focalX.toFixed(3)} • Y: {focalY.toFixed(3)} ({zoom.toFixed(1)}x)
            </div>
          </div>

          {/* Helper Badge */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-md text-[#FAF9F5] text-xs font-mono border border-white/10 flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-[#FF5C35] animate-ping" />
            <span>Focal Overlay Activo • Haz clic o arrastra para mover el objetivo 3D</span>
          </div>
        </div>
      )}
    </div>
  );
};
