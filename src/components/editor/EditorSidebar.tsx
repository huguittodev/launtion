'use client';

/**
 * EditorSidebar.tsx
 *
 * Tabbed customization sidebar:
 * - Tab 1: Text & Copy (TextCustomizer)
 * - Tab 2: Style & Art Direction (ThemeCustomizer)
 * - Tab 3: Camera & Focals (CameraFocalPicker)
 * - Tab 4: Timeline & Keyframes (Keyframes breakdown & audio track inspect)
 */

import React from 'react';
import { CameraFocalPicker } from './CameraFocalPicker';
import { TextCustomizer } from './TextCustomizer';
import { ThemeCustomizer } from './ThemeCustomizer';
import type {
  BackdropVariant,
  SceneGraph,
  SurfaceTheme,
} from '../../lib/scene-graph/types';

export type EditorTab = 'text' | 'style' | 'camera' | 'timeline';

export interface EditorSidebarProps {
  sceneGraph: SceneGraph;
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  activeKeyframeIndex: number;
  onSelectKeyframe: (index: number) => void;
  onUpdateText: (field: string, value: string | string[], sceneId?: string) => void;
  onUpdateArtDirection: (payload: {
    backdropVariant?: BackdropVariant;
    surfaceTheme?: SurfaceTheme;
    primaryAccent?: string;
  }) => void;
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

export const EditorSidebar: React.FC<EditorSidebarProps> = ({
  sceneGraph,
  activeTab,
  onTabChange,
  activeKeyframeIndex,
  onSelectKeyframe,
  onUpdateText,
  onUpdateArtDirection,
  onUpdateFocal,
  onSeekToFrame,
}) => {
  return (
    <aside className="w-full lg:w-[420px] shrink-0 border-l border-white/10 bg-[#161615] flex flex-col h-full overflow-hidden select-none">
      {/* Sticky Top Tab Headers */}
      <div className="flex border-b border-white/10 bg-[#141413] shrink-0">
        <button
          type="button"
          onClick={() => onTabChange('text')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'text'
              ? 'border-[#FF5C35] text-white bg-white/[0.02]'
              : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <span>✍️</span>
          <span>Textos</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('style')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'style'
              ? 'border-[#FF5C35] text-white bg-white/[0.02]'
              : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <span>🎨</span>
          <span>Estilo</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('camera')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'camera'
              ? 'border-[#FF5C35] text-white bg-white/[0.02]'
              : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <span>🎥</span>
          <span>Cámara</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('timeline')}
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'timeline'
              ? 'border-[#FF5C35] text-white bg-white/[0.02]'
              : 'border-transparent text-neutral-400 hover:text-white hover:bg-white/[0.01]'
          }`}
        >
          <span>⏱️</span>
          <span>Pistas</span>
        </button>
      </div>

      {/* Scrollable Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-neutral-700">
        {activeTab === 'text' && (
          <TextCustomizer
            sceneGraph={sceneGraph}
            onUpdateText={onUpdateText}
          />
        )}

        {activeTab === 'style' && (
          <ThemeCustomizer
            sceneGraph={sceneGraph}
            onUpdateArtDirection={onUpdateArtDirection}
          />
        )}

        {activeTab === 'camera' && (
          <CameraFocalPicker
            sceneGraph={sceneGraph}
            activeKeyframeIndex={activeKeyframeIndex}
            onSelectKeyframe={onSelectKeyframe}
            onUpdateFocal={onUpdateFocal}
            onSeekToFrame={onSeekToFrame}
          />
        )}

        {activeTab === 'timeline' && (
          <div className="flex flex-col gap-6 text-sm">
            <div>
              <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                <span>⏱️</span>
                <span>Desglose de Pistas & Keyframes</span>
              </h3>
              <p className="text-xs text-neutral-400">
                Inspección determinista de nodos de escena, eventos acústicos y fotogramas clave.
              </p>
            </div>

            {/* Scenes Breakdown */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-300">
                Nodos de Escena ({sceneGraph.scenes.length})
              </span>
              <div className="flex flex-col gap-1.5">
                {sceneGraph.scenes.map((s, idx) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-neutral-500">#{idx + 1}</span>
                      <span className="text-white font-medium">{s.type}</span>
                    </div>
                    <span className="text-neutral-400">
                      F{s.startFrame} → F{s.startFrame + s.durationInFrames} ({s.durationInFrames}f)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio Track Breakdown */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-300">
                Pistas de Audio & SFX ({sceneGraph.audioTrack.length})
              </span>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                {sceneGraph.audioTrack.map((cue) => (
                  <div
                    key={cue.id}
                    className="p-2 rounded-lg bg-neutral-900 border border-white/5 flex items-center justify-between text-xs font-mono"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                      <span className="text-neutral-200">{cue.asset}</span>
                    </div>
                    <span className="text-neutral-400">Frame {cue.frame}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Camera Track Keyframes */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-300">
                Keyframes de Cámara ({sceneGraph.cameraTrack.length})
              </span>
              <div className="flex flex-col gap-1.5">
                {sceneGraph.cameraTrack.map((kf, i) => (
                  <button
                    key={`track-kf-${kf.frame}-${i}`}
                    type="button"
                    onClick={() => {
                      onSelectKeyframe(i);
                      onSeekToFrame?.(kf.frame);
                    }}
                    className={`p-2.5 rounded-lg border text-left flex items-center justify-between text-xs font-mono transition-colors ${
                      i === activeKeyframeIndex
                        ? 'bg-[#FF5C35]/15 border-[#FF5C35] text-white'
                        : 'bg-neutral-900 border-white/5 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#FF5C35] font-semibold">KF {i + 1}</span>
                      <span>Frame {kf.frame}</span>
                    </div>
                    <span className="text-neutral-400">
                      ({kf.x.toFixed(2)}, {kf.y.toFixed(2)}) • {kf.zoom}x
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
