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
  CreativeDirectorModal,
  AssetIntelligenceModal,
  ScreenRecorderModal,
  ProjectSelectorModal,
  RemotionPlayerPreview,
  TimelineControl,
} from '../../../components/editor';
import {
  editorActions,
  editorReducer,
  createInitialEditorState,
} from '../../../lib/editor/editor-state';
import type {
  BackdropVariant,
  SceneGraph,
  SurfaceTheme,
} from '../../../lib/scene-graph/types';

export default function EditorPage() {
  const [state, dispatch] = useReducer(editorReducer, undefined, createInitialEditorState);
  const playerRef = useRef<PlayerRef | null>(null);

  // Cloud project persistence state
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Interactive Surface Demo');
  const [isSaving, setIsSaving] = useState(false);
  const [isProjectSelectorOpen, setIsProjectSelectorOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<EditorTab>('camera');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
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

  const handleLoadAiSceneGraph = useCallback((newGraph: SceneGraph) => {
    dispatch(editorActions.loadSceneGraph(newGraph));
    playerRef.current?.seekTo(0);
  }, []);

  const handleLoadInputSceneGraph = useCallback((newGraph: SceneGraph) => {
    dispatch(editorActions.loadSceneGraph(newGraph));
    playerRef.current?.seekTo(0);
  }, []);

  const handleLoadRecordedSceneGraph = useCallback((newGraph: SceneGraph) => {
    dispatch(editorActions.loadSceneGraph(newGraph));
    playerRef.current?.seekTo(0);
  }, []);

  // Check URL query parameters for ?project=<id> on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const initialProjectId = params.get('project');
    if (initialProjectId) {
      fetch(`/api/projects/${initialProjectId}`)
        .then((res) => {
          if (!res.ok) throw new Error('Project not found');
          return res.json();
        })
        .then((data) => {
          if (data.project) {
            setProjectId(data.project.id);
            setProjectName(data.project.name);
            dispatch(editorActions.loadSceneGraph(data.project.scene_graph));
            playerRef.current?.seekTo(0);
          }
        })
        .catch((err) => {
          console.error('Failed to load project from query param:', err);
        });
    }
  }, []);

  const handleSaveProject = useCallback(async () => {
    setIsSaving(true);
    try {
      const url = projectId ? `/api/projects/${projectId}` : '/api/projects';
      const method = projectId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          sceneGraph: state.sceneGraph,
        }),
      });
      const data = await res.json();
      if (res.ok && data.project) {
        setProjectId(data.project.id);
        setProjectName(data.project.name);
        window.history.replaceState({}, '', `/editor?project=${data.project.id}`);
      }
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, projectName, state.sceneGraph]);

  const handleSelectProject = useCallback(
    (project: { id: string; name: string; scene_graph: SceneGraph }) => {
      setProjectId(project.id);
      setProjectName(project.name);
      dispatch(editorActions.loadSceneGraph(project.scene_graph));
      playerRef.current?.seekTo(0);
      window.history.replaceState({}, '', `/editor?project=${project.id}`);
    },
    []
  );

  const handleNewProject = useCallback(() => {
    setProjectId(null);
    setProjectName('Interactive Surface Demo');
    dispatch(editorActions.resetSceneGraph('default'));
    playerRef.current?.seekTo(0);
    window.history.replaceState({}, '', '/editor');
  }, []);

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
        title={projectName}
        projectName={projectName}
        isSaving={isSaving}
        onSaveProject={handleSaveProject}
        onOpenProjectSelector={() => setIsProjectSelectorOpen(true)}
        onUpdateProjectName={setProjectName}
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
        onOpenAiModal={() => setIsAiModalOpen(true)}
        onOpenInputIntelligenceModal={() => setIsInputModalOpen(true)}
        onOpenScreenRecorderModal={() => setIsRecorderOpen(true)}
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

      {/* 4. Creative Director AI Modal */}
      <CreativeDirectorModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onGenerated={handleLoadAiSceneGraph}
      />

      {/* 5. Input Intelligence Multimodal Modal */}
      <AssetIntelligenceModal
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        onApplySceneGraph={handleLoadInputSceneGraph}
      />

      {/* 6. Screen Recorder Modal */}
      <ScreenRecorderModal
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onApplySceneGraph={handleLoadRecordedSceneGraph}
      />

      {/* 7. Project Selector Modal */}
      <ProjectSelectorModal
        isOpen={isProjectSelectorOpen}
        onClose={() => setIsProjectSelectorOpen(false)}
        currentProjectId={projectId}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
      />
    </div>
  );
}
