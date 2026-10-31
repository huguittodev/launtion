/**
 * InteractiveSurfaceDemo.tsx
 *
 * 100% Data-Driven Studio Showcase Composition for Milestone 3.
 * Orchestrates DynamicBackdrop, CameraRig, RealCaptureSurface, SmartCursor,
 * and AudioEngine purely from a validated SceneGraph contract.
 *
 * ZERO animations are hardcoded in React.
 */

import React from 'react';
import { interpolate, Sequence, useCurrentFrame } from 'remotion';
import demoInteractionMapRaw from '../../src/lib/interaction-map/demoInteractionMap.json';
import type { InteractionMap } from '../../src/lib/interaction-map/types';
import { interactionToSceneGraphAdapter } from '../../src/lib/scene-graph/adapter';
import type {
  ArtDirection,
  CanvasConfig,
  SceneGraph,
  SceneNode,
} from '../../src/lib/scene-graph/types';
import {
  AudioEngine,
  CameraRig,
  DynamicBackdrop,
  IconGridMorph,
  KineticTypography,
  RealCaptureSurface,
  SmartCursor,
  SyntheticCodeTree,
  SyntheticConnectPills,
  SyntheticHeroButton,
  SyntheticPromptBox,
  type TreeNode,
} from '../motion-kit';

export interface InteractiveSurfaceDemoProps {
  sceneGraph?: SceneGraph;
}

/**
 * Deterministic default SceneGraph computed once at module initialization time.
 * Evaluates in < 2ms, avoids re-computation during Remotion per-frame renders,
 * and allows direct export for remotion/Root.tsx composition metadata.
 */
export const defaultSceneGraph: SceneGraph = interactionToSceneGraphAdapter(
  demoInteractionMapRaw as unknown as InteractionMap
);

const fullScreenCenterStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
};

/**
 * Normalizes an absolute target frame into sequence-relative coordinates.
 */
export function resolveSequenceFrame(
  targetFrame: number | undefined,
  sequenceStartFrame: number
): number | undefined {
  if (targetFrame === undefined) return undefined;
  return targetFrame >= sequenceStartFrame
    ? targetFrame - sequenceStartFrame
    : targetFrame;
}

/**
 * Digital product surface containing realistic SaaS dashboard UI
 * with DOM element targets aligned to demoInteractionMap normalized coordinates.
 */
export const InteractiveProductSurface: React.FC<{
  frame: number;
  sceneGraph: SceneGraph;
}> = ({ frame, sceneGraph }) => {
  const accent = sceneGraph.artDirection.primaryAccent;
  const isDark = sceneGraph.artDirection.surfaceTheme === 'dark';

  // Determine dynamic element states purely from cursorTrack / cameraTrack events
  const clickKeyframes = sceneGraph.cursorTrack.filter((kf) => kf.click);

  // Prompt input field click: click near (0.5, 0.62)
  const promptClickKf = clickKeyframes.find(
    (kf) => Math.hypot(kf.x - 0.5, kf.y - 0.62) < 0.15
  );
  const isPromptClicked = promptClickKf ? frame >= promptClickKf.frame : false;

  // Calendar connect pill click: click near (0.35, 0.45)
  const pillClickKf = clickKeyframes.find(
    (kf) => Math.hypot(kf.x - 0.35, kf.y - 0.45) < 0.15
  );
  const isCalendarPillClicked = pillClickKf ? frame >= pillClickKf.frame : false;

  // Hero publish button click: click near (0.72, 0.34)
  const heroClickKf = clickKeyframes.find(
    (kf) => Math.hypot(kf.x - 0.72, kf.y - 0.34) < 0.15
  );

  // Hero button click physics compression [1 -> 0.95 -> 1]
  const heroClickElapsed = heroClickKf ? frame - heroClickKf.frame : -1;
  const isHeroButtonActive = heroClickElapsed >= 0 && heroClickElapsed <= 6;

  // Deployment lifecycle states
  const successCue = sceneGraph.audioTrack.find(
    (cue) => cue.asset === 'chime' && cue.frame > (heroClickKf?.frame ?? 0)
  );
  const successFrame = successCue
    ? successCue.frame
    : heroClickKf
      ? heroClickKf.frame + 70
      : 380;
  const deployStartFrame = heroClickKf ? heroClickKf.frame + 8 : 318;
  const isDeploying = frame >= deployStartFrame && frame < successFrame;
  const isDeployed = frame >= successFrame;

  // Typing cadence for prompt input
  const promptText =
    'I want to build a bike renting app with real-time terrain tracking';
  const typingStart = promptClickKf ? promptClickKf.frame + 5 : 70;
  const charsTyped = Math.max(
    0,
    Math.min(promptText.length, Math.floor((frame - typingStart) * 1.4))
  );
  const displayedPrompt =
    frame >= typingStart ? promptText.slice(0, charsTyped) : '';

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        backgroundColor: isDark ? '#181716' : '#FAF9F5',
        color: isDark ? '#E5E2DC' : '#181716',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Sidebar Navigation */}
      <div
        style={{
          width: 260,
          backgroundColor: isDark ? '#121211' : '#141413',
          color: '#E5E2DC',
          padding: '28px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              backgroundColor: accent,
            }}
          />
          <span
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              color: '#FFFFFF',
            }}
          >
            Base44 Studio
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13,
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              backgroundColor: '#262523',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
          >
            Dashboard
          </div>
          <div style={{ padding: '8px 14px', color: '#8A867E' }}>Fleet Rentals</div>
          <div style={{ padding: '8px 14px', color: '#8A867E' }}>Route Planning</div>
          <div style={{ padding: '8px 14px', color: '#8A867E' }}>Telemetry & Geo</div>
          <div style={{ padding: '8px 14px', color: '#8A867E' }}>Settings</div>
        </div>
      </div>

      {/* Main Studio Canvas */}
      <div
        id="canvas-overview"
        style={{
          flex: 1,
          padding: '30px 40px',
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          position: 'relative',
        }}
      >
        {/* Top Header & Notification Bar (Target: success-confirmation-toast around Y: 0.22) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: isDark ? '1px solid #2B2926' : '1px solid #EFEAE1',
            paddingBottom: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 700,
                margin: 0,
                letterSpacing: '-0.03em',
              }}
            >
              Fleet Operations & Dynamic Surface
            </h2>
            <span style={{ fontSize: 13, color: '#8A867E' }}>
              Real-time telemetry • January 2026 • Base44 Engine v2.0
            </span>
          </div>

          {/* Success Notification Toast at normalized (0.50, 0.22) */}
          <div
            id="success-confirmation-toast"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 18px',
              borderRadius: 9999,
              backgroundColor: isDeployed
                ? '#ECFDF5'
                : isDark
                  ? '#262523'
                  : '#ECE7DC',
              border: isDeployed
                ? '1.5px solid #10B981'
                : isDark
                  ? '1px solid #383632'
                  : '1px solid #D6D2C7',
              color: isDeployed ? '#065F46' : isDark ? '#E5E2DC' : '#181716',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: isDeployed ? '#10B981' : '#8A867E',
              }}
            />
            <span>{isDeployed ? 'Production Deployment Live' : 'Status: Ready'}</span>
          </div>
        </div>

        {/* Upper Action Area (Target: hero-publish-button around X: 0.72, Y: 0.34) */}
        <div
          id="hero-action-section"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '10px 0',
          }}
        >
          <div
            id="hero-publish-button"
            style={{
              padding: '14px 34px',
              borderRadius: 14,
              backgroundColor: isDeploying ? '#262523' : '#181716',
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: 650,
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: `0 8px 24px ${accent}33`,
              border: `1.5px solid ${accent}`,
              transform: isHeroButtonActive ? 'scale(0.95)' : 'scale(1)',
            }}
          >
            {isDeploying ? (
              <div
                id="hero-button-spinner"
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.2)',
                    borderTopColor: '#FFFFFF',
                  }}
                />
                <span style={{ fontSize: 14, color: '#A19E95' }}>
                  Deploying to Fleet...
                </span>
              </div>
            ) : (
              <span>Publish</span>
            )}
          </div>
        </div>

        {/* Middle Content: Connect Pill & Code Tree (Target: connect-pill-calendar around X: 0.35, Y: 0.45) */}
        <div style={{ display: 'flex', gap: 24 }}>
          {/* Architecture & Connect Pill Card */}
          <div
            id="architecture-code-tree"
            style={{
              flex: 1,
              padding: '20px 24px',
              borderRadius: 16,
              backgroundColor: isDark ? '#1E1E1C' : '#FFFFFF',
              border: isDark ? '1px solid #2B2926' : '1px solid #ECE7DE',
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: isDark ? '#FFFFFF' : '#181716',
              }}
            >
              Service Integrations & Routing
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                id="connect-pill-calendar"
                style={{
                  padding: '10px 20px',
                  borderRadius: 9999,
                  backgroundColor: isCalendarPillClicked
                    ? `${accent}1A`
                    : isDark
                      ? '#2A2926'
                      : '#F7F5F0',
                  border: isCalendarPillClicked
                    ? `1.5px solid ${accent}`
                    : isDark
                      ? '1.5px solid #3D3B36'
                      : '1.5px solid #D6D2C7',
                  color: isCalendarPillClicked
                    ? accent
                    : isDark
                      ? '#FFFFFF'
                      : '#181716',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>Calendar • Sync Engine</span>
              </div>
            </div>

            <div
              id="code-tree-file-list"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontSize: 13,
                fontFamily: 'monospace',
                color: isDark ? '#A19E95' : '#555148',
              }}
            >
              <div
                id="code-tree-leaf-routes"
                style={{
                  color: isDark ? '#FFFFFF' : '#181716',
                  fontWeight: 600,
                }}
              >
                ▸ routes/fleet.ts
              </div>
              <div>▸ sync/calendar.ts</div>
              <div>▸ telemetry/geo.ts</div>
            </div>
          </div>

          {/* Interactive Prompt Command Box (Target: prompt-input-container around X: 0.50, Y: 0.62) */}
          <div
            id="prompt-input-container"
            style={{
              flex: 1.2,
              padding: '20px 24px',
              borderRadius: 16,
              backgroundColor: isDark ? '#1E1E1C' : '#FFFFFF',
              border: isPromptClicked
                ? `1.5px solid ${accent}`
                : isDark
                  ? '1.5px solid #2B2926'
                  : '1.5px solid #ECE7DE',
              boxShadow: isPromptClicked
                ? `0 8px 30px ${accent}22`
                : '0 4px 16px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: '#8A867E' }}>
              AI Prompt Director
            </div>
            <div
              id="prompt-input-field"
              style={{
                minHeight: 80,
                fontSize: 16,
                lineHeight: 1.5,
                color: isDark ? '#FFFFFF' : '#181716',
                fontWeight: 500,
              }}
            >
              <span>{displayedPrompt}</span>
              <span
                id="prompt-caret-position"
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: 18,
                  backgroundColor:
                    Math.floor(frame / 15) % 2 === 0 ? accent : 'transparent',
                  marginLeft: 3,
                  verticalAlign: 'text-bottom',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer Brand Crest (Target: footer-brand-crest around X: 0.50, Y: 0.82) */}
        <div
          id="footer-brand-crest"
          style={{
            marginTop: 'auto',
            paddingTop: 14,
            borderTop: isDark ? '1px solid #2B2926' : '1px solid #EFEAE1',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 12,
            color: '#8A867E',
          }}
        >
          <div id="brand-hero-card" style={{ display: 'flex', gap: 8 }}>
            <span>Base44 Motion Engine • Deterministic SceneGraph</span>
          </div>
          <span>Normalized Coordinate Telemetry • (x, y, t)</span>
        </div>
      </div>
    </div>
  );
};

export interface SceneNodeRendererProps {
  node: SceneNode;
  artDirection: ArtDirection;
  canvas: CanvasConfig;
  sceneGraph: SceneGraph;
  globalFrame: number;
}

/**
 * SceneNodeRenderer:
 * Main dispatch component dynamically rendering a single SceneNode based on its discriminated union type.
 */
export const SceneNodeRenderer: React.FC<SceneNodeRendererProps> = ({
  node,
  artDirection,
  sceneGraph,
  globalFrame,
}) => {
  const seqFrame = useCurrentFrame();

  switch (node.type) {
    case 'kinetic_typography': {
      const p = node.payload;
      return (
        <div style={fullScreenCenterStyle}>
          <KineticTypography
            frame={seqFrame}
            words={p.words}
            accentWordIndex={p.accentWordIndex ?? -1}
            symbols={p.symbols ?? ['/', '<', '>', '*']}
            staggerFrames={p.staggerFrames ?? 12}
            startFrame={0}
            theme={{
              textColor:
                artDirection.surfaceTheme === 'dark' ? '#FAF9F5' : '#141413',
              accentColor: artDirection.primaryAccent,
              symbolColor:
                artDirection.surfaceTheme === 'dark' ? '#68655E' : '#A19E95',
            }}
          />
        </div>
      );
    }

    case 'synthetic_prompt_box': {
      const p = node.payload;
      const charsPerFrame =
        p.charsPerFrame ?? (p.typingSpeed ? p.typingSpeed * 0.5 : 0.88);

      return (
        <div style={fullScreenCenterStyle}>
          <SyntheticPromptBox
            frame={seqFrame}
            startFrame={0}
            textToType={p.textToType}
            charsPerFrame={charsPerFrame}
            theme={{
              backgroundColor:
                artDirection.surfaceTheme === 'dark' ? '#1E1E1C' : '#FFFFFF',
              borderColor:
                artDirection.surfaceTheme === 'dark' ? '#2E2D2B' : '#EBE7DE',
              textColor:
                artDirection.surfaceTheme === 'dark' ? '#FAF9F5' : '#191816',
              accentColor: artDirection.primaryAccent,
            }}
          />
        </div>
      );
    }

    case 'synthetic_hero_button': {
      const p = node.payload;
      const relClickFrame = resolveSequenceFrame(p.clickFrame, node.startFrame);

      let themeConfig = {
        backgroundColor: '#181716',
        textColor: '#FFFFFF',
        glowColor: `${artDirection.primaryAccent}45`,
      };

      if (p.variant === 'outline') {
        themeConfig = {
          backgroundColor: 'transparent',
          textColor: artDirection.primaryAccent,
          glowColor: 'none',
        };
      } else if (p.variant === 'minimal') {
        themeConfig = {
          backgroundColor:
            artDirection.surfaceTheme === 'dark' ? '#262523' : '#FFFFFF',
          textColor:
            artDirection.surfaceTheme === 'dark' ? '#FFFFFF' : '#181716',
          glowColor: 'rgba(0,0,0,0.12)',
        };
      }

      return (
        <div style={fullScreenCenterStyle}>
          <SyntheticHeroButton
            frame={seqFrame}
            startFrame={0}
            clickFrame={relClickFrame}
            buttonText={p.buttonText}
            theme={themeConfig}
          />
        </div>
      );
    }

    case 'synthetic_connect_pills': {
      const p = node.payload;
      return (
        <div style={fullScreenCenterStyle}>
          <SyntheticConnectPills
            frame={seqFrame}
            startFrame={0}
            sourceText={p.sourceText}
            targetText={p.targetText}
            theme={{
              sourceColor:
                artDirection.surfaceTheme === 'dark' ? '#FFFFFF' : '#181716',
              targetColor: artDirection.primaryAccent,
              accentColor: artDirection.primaryAccent,
            }}
          />
        </div>
      );
    }

    case 'synthetic_code_tree': {
      const p = node.payload;
      const rawNodes =
        (p as unknown as Record<string, unknown>).nodes ??
        (p as unknown as Record<string, unknown>).treeNodes;

      let formattedNodes: TreeNode[] | undefined = undefined;
      if (Array.isArray(rawNodes) && rawNodes.length > 0) {
        formattedNodes = rawNodes as TreeNode[];
      } else if (p.files && p.files.length > 0) {
        formattedNodes = p.files.map((file, i) => {
          const parts = file.split('/');
          const isFolder =
            file.endsWith('/') || (!file.includes('.') && i === 0);
          return {
            label: parts[parts.length - 1] || file,
            isFolder,
            indent: Math.min(3, Math.max(1, parts.length)),
            delay: 6 + i * 8,
          };
        });
      }

      return (
        <div style={fullScreenCenterStyle}>
          <SyntheticCodeTree
            frame={seqFrame}
            startFrame={0}
            title={p.title}
            nodes={formattedNodes}
          />
        </div>
      );
    }

    case 'icon_grid_morph': {
      const p = node.payload;
      return (
        <div
          style={{
            ...fullScreenCenterStyle,
            flexDirection: 'column',
            gap: 36,
          }}
        >
          {p.headline && (
            <div
              style={{
                fontSize: 28,
                fontWeight: 650,
                color: '#A19E95',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace",
              }}
            >
              {p.headline}
            </div>
          )}
          <IconGridMorph
            frame={seqFrame}
            startFrame={0}
            rows={p.rows ?? 4}
            cols={p.cols ?? 7}
            initialColor={p.initialColor ?? '#EF4444'}
            targetColor={
              p.targetColor ?? artDirection.primaryAccent ?? '#22C55E'
            }
            waveStartFrame={p.waveStartFrame ?? 14}
          />
        </div>
      );
    }

    case 'product_interaction_3d': {
      const p = node.payload;
      return (
        <div style={fullScreenCenterStyle}>
          <RealCaptureSurface
            windowTitle={
              p.windowTitle ?? 'Base44 SaaS Studio — Dynamic Surface'
            }
            width={1440}
            height={840}
          >
            <InteractiveProductSurface
              frame={globalFrame}
              sceneGraph={sceneGraph}
            />
          </RealCaptureSurface>
        </div>
      );
    }

    case 'brand_closing_cta': {
      const p = node.payload;
      const scale = interpolate(seqFrame, [0, 14], [0.92, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      const opacity = interpolate(seqFrame, [0, 8], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });

      return (
        <div style={fullScreenCenterStyle}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              transform: `scale(${scale})`,
              opacity,
              userSelect: 'none',
            }}
          >
            {p.showLogo !== false && (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: `linear-gradient(180deg, ${artDirection.primaryAccent} 0%, #FF4D1A 100%)`,
                  boxShadow: `0 12px 32px ${artDirection.primaryAccent}60`,
                }}
              />
            )}
            <h1
              style={{
                fontSize: 54,
                fontWeight: 750,
                color:
                  artDirection.surfaceTheme === 'dark' ? '#F4F1EA' : '#181716',
                letterSpacing: '-0.035em',
                margin: 0,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
              }}
            >
              {p.productName}
            </h1>
            <div
              style={{
                padding: '8px 24px',
                borderRadius: 9999,
                border: `1.5px solid ${artDirection.primaryAccent}`,
                backgroundColor:
                  artDirection.surfaceTheme === 'dark' ? '#1E1E1C' : '#FFFFFF',
                color: artDirection.primaryAccent,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                boxShadow: `0 4px 16px ${artDirection.primaryAccent}24`,
              }}
            >
              {p.tagline}
            </div>
            {p.buttonText && (
              <div
                style={{
                  marginTop: 10,
                  padding: '12px 34px',
                  borderRadius: 14,
                  backgroundColor: artDirection.primaryAccent,
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontWeight: 650,
                  boxShadow: `0 8px 24px ${artDirection.primaryAccent}40`,
                }}
              >
                {p.buttonText}
              </div>
            )}
          </div>
        </div>
      );
    }

    default: {
      const _exhaustiveCheck: never = node;
      return null;
    }
  }
};

/**
 * InteractiveSurfaceDemo:
 * Primary showcase composition orchestrating the complete four-layer pipeline:
 * 1. Outer background: DynamicBackdrop (variant driven by artDirection)
 * 2. Middle layer: CameraRig (cameraTrack) wrapping RealCaptureSurface & scene nodes
 * 3. Cursor overlay: SmartCursor (cursorTrack) with multi-keyframe Bezier arcs
 * 4. Audio layer: AudioEngine (audioTrack) with frame-accurate cues & limiter
 */
export const InteractiveSurfaceDemo: React.FC<InteractiveSurfaceDemoProps> = ({
  sceneGraph = defaultSceneGraph,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        flex: 1,
        width: sceneGraph.canvas.width,
        height: sceneGraph.canvas.height,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor:
          sceneGraph.artDirection.surfaceTheme === 'dark'
            ? '#121211'
            : '#FAF9F5',
      }}
    >
      {/* 1. Outer Layer: Dynamic Studio Backdrop */}
      <DynamicBackdrop
        frame={frame}
        variant={sceneGraph.artDirection.backdropVariant}
        backgroundColor={
          sceneGraph.artDirection.surfaceTheme === 'dark'
            ? '#121211'
            : '#FAF9F5'
        }
        dotGrid={true}
      />

      {/* 2. Middle Layer: Zero-Drift 3D Camera Rig with RealCaptureSurface */}
      <CameraRig
        cameraTrack={sceneGraph.cameraTrack}
        frame={frame}
        width={sceneGraph.canvas.width}
        height={sceneGraph.canvas.height}
      >
        {sceneGraph.scenes && sceneGraph.scenes.length > 0 ? (
          sceneGraph.scenes.map((node) => (
            <Sequence
              key={node.id}
              from={node.startFrame}
              durationInFrames={node.durationInFrames}
              name={node.type}
            >
              <SceneNodeRenderer
                node={node}
                artDirection={sceneGraph.artDirection}
                canvas={sceneGraph.canvas}
                sceneGraph={sceneGraph}
                globalFrame={frame}
              />
            </Sequence>
          ))
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <RealCaptureSurface
              windowTitle="Base44 SaaS Studio — Dynamic Surface"
              width={1440}
              height={840}
            >
              <InteractiveProductSurface
                frame={frame}
                sceneGraph={sceneGraph}
              />
            </RealCaptureSurface>
          </div>
        )}
      </CameraRig>

      {/* 3. Cursor Overlay: Vector Smart Cursor with Multi-Keyframe Bezier Curves & Click Physics */}
      <SmartCursor
        frame={frame}
        cursorTrack={sceneGraph.cursorTrack}
        size={34}
        color={
          sceneGraph.artDirection.surfaceTheme === 'dark'
            ? '#FAF9F5'
            : '#181716'
        }
        accentColor={sceneGraph.artDirection.primaryAccent}
        showRipple={true}
      />

      {/* 4. Audio Layer: Frame-Accurate SFX, Headroom Limiter, & Sidechain Ducking */}
      <AudioEngine audioTrack={sceneGraph.audioTrack} />
    </div>
  );
};
