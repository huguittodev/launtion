'use client';

/**
 * app/editor/page.tsx
 *
 * Launtion Studio — Interactive Preview & Visual Customization (@remotion/player)
 * Hosts the responsive studio workspace:
 * - Dynamic Remotion Player with WebAudio/Canvas isolation
 * - Reactive SceneGraph state reducer with Zod safeParse validation pre-commit
 * - Live Text, Theme, Camera Focal, and Timeline customization panels
 * - Interactive 2D focal target reticle overlay
 * - High-precision timeline transport controls & frame scrubber
 */

import React, { useReducer, useRef, useState, useEffect, useCallback } from 'react';
import type { PlayerRef } from '@remotion/player';
import {
  EditorHeader,
  EditorSidebar,
  type EditorTab,
  ExportModal,
  RemotionPlayerPreview,
  TimelineControl,
} from '../../components/editor';
import {
  editorActions,
  editorReducer,
  createInitialEditorState,
} from '../../lib/editor/editor-state';
import type {
  BackdropVariant,
  SurfaceTheme,
} from '../../lib/scene-graph/types';

export default function EditorPage() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialEditorState);
  const playerRef = useRef<PlayerRef | null>(null);

  const [activeTab, setActiveTab] = useState<EditorTab>('camera');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [showFocalOverlay, setShowFocalOverlay] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Synchronize player transport operations
  const handleTogglePlay = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.toggle();
  }, []);

  const handleSeek = useCallback((frame: number) => {
    dispatch(editorActions.setCurrentFrame(frame));
    playerRef.current?.seekTo(frame);
  }, []);

  const handleFrameUpdate = useCallback((frame: number) => {
    dispatch(editorActions.setCurrentFrame(frame));
  }, []);

  const handlePlayStateChange = useCallback((isPlaying: boolean) => {
    dispatch(editorActions.setPlaying(isPlaying));
  }, []);

  // Focal point update from pad or direct canvas click
  const handleUpdateFocal = useCallback(
    (payload: {
      keyframeIndex?: number;
      x?: number;
      y?: number;
      zoom?: number;
      rotateX?: number;
      rotateY?: number;
      rotateZ?: number;
      easing?: 'linear' | 'ease-in-out' | 'spring';
    }) => {
      dispatch(editorActions.updateCameraFocal(payload));
    },
    []
  );

  const handleUpdateFocalPointFromPreview = useCallback(
    (x: number, y: number) => {
      dispatch(
        editorActions.updateCameraFocal({
          keyframeIndex: state.activeKeyframeIndex,
          x,
          y,
        })
      );
    },
    [state.activeKeyframeIndex]
  );

  const handleSeekToFrame = useCallback((frame: number) => {
    handleSeek(frame);
  }, [handleSeek]);

  // Fullscreen support
  const handleToggleFullscreen = useCallback(() => {
    if (!editorContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      editorContainerRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  // Global keyboard shortcuts (Space to Play/Pause, unless typing in input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, state.currentFrame - (e.shiftKey ? 30 : 1)));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(
          Math.min(
            state.sceneGraph.canvas.durationInFrames - 1,
            state.currentFrame + (e.shiftKey ? 30 : 1)
          )
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleSeek, state.currentFrame, state.sceneGraph.canvas.durationInFrames]);

  const activeKf =
    state.sceneGraph.cameraTrack[state.activeKeyframeIndex] ??
    state.sceneGraph.cameraTrack[0];

  return (
    <div
      ref={editorContainerRef}
      className="h-screen w-screen flex flex-col bg-[#121211] text-[#FAF9F5] overflow-hidden select-none"
    >
      {/* 1. Top Header */}
      <EditorHeader
        durationInFrames={state.sceneGraph.canvas.durationInFrames}
        fps={state.sceneGraph.canvas.fps}
        currentFrame={state.currentFrame}
        isPlaying={state.isPlaying}
        isDirty={state.isDirty}
        validationNotice={state.validationNotice}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        showFocalOverlay={showFocalOverlay}
        onPlayPauseToggle={handleTogglePlay}
        onReset={() => dispatch(editorActions.resetSceneGraph('default'))}
        onExportClick={() => setIsExportOpen(true)}
        onToggleFullscreen={handleToggleFullscreen}
        onUndo={() => dispatch(editorActions.undo())}
        onRedo={() => dispatch(editorActions.redo())}
        onToggleFocalOverlay={() => setShowFocalOverlay((prev) => !prev)}
      />

      {/* 2. Main Workspace (Preview + Timeline / Sidebar) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* Left Section: Video Preview & Timeline Bar */}
        <div className="flex-1 min-w-0 p-4 sm:p-6 flex flex-col items-center justify-between bg-[#0D0D0C] overflow-y-auto">
          {/* 16:9 Aspect Video Preview Container */}
          <div className="w-full max-w-5xl my-auto flex flex-col items-center justify-center">
            <RemotionPlayerPreview
              sceneGraph={state.sceneGraph}
              playerRef={playerRef}
              currentFrame={state.currentFrame}
              isPlaying={state.isPlaying}
              activeKeyframe={activeKf}
              showFocalOverlay={showFocalOverlay}
              onFrameUpdate={handleFrameUpdate}
              onPlayStateChange={handlePlayStateChange}
              onUpdateFocalPoint={handleUpdateFocalPointFromPreview}
            />
          </div>

          {/* Bottom Timeline Controls */}
          <div className="w-full max-w-5xl pt-4 shrink-0">
            <TimelineControl
              sceneGraph={state.sceneGraph}
              currentFrame={state.currentFrame}
              isPlaying={state.isPlaying}
              onSeek={handleSeek}
              onTogglePlay={handleTogglePlay}
            />
          </div>
        </div>

        {/* Right Section: Customization Sidebar Tabs */}
        <EditorSidebar
          sceneGraph={state.sceneGraph}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeKeyframeIndex={state.activeKeyframeIndex}
          onSelectKeyframe={(idx) => dispatch(editorActions.setActiveKeyframe(idx))}
          onUpdateText={(field, value, sceneId) =>
            dispatch(editorActions.updateText(field, value, sceneId))
          }
          onUpdateArtDirection={(payload: {
            backdropVariant?: BackdropVariant;
            surfaceTheme?: SurfaceTheme;
            primaryAccent?: string;
          }) => dispatch(editorActions.updateArtDirection(payload))}
          onUpdateFocal={handleUpdateFocal}
          onSeekToFrame={handleSeekToFrame}
        />
      </div>

      {/* 3. Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        sceneGraph={state.sceneGraph}
      />
    </div>
  );
}
