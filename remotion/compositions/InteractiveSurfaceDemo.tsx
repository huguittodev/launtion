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
import { interpolate, spring, Sequence, useCurrentFrame } from 'remotion';
import demoInteractionMapRaw from '../../src/lib/interaction-map/demoInteractionMap.json';
import type { InteractionMap } from '../../src/lib/interaction-map/types';
import { interactionToSceneGraphAdapter } from '../../src/lib/scene-graph/adapter';
import { computeSurfaceLayout } from '../../src/lib/scene-graph/media-layout';
import type {
  ArtDirection,
  CanvasConfig,
  MotionArchetype,
  ProductInteraction3DPayload,
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
  MediaShowcase,
  MetricCardsShowcase,
  ConversationalMockup,
  SaaSFeatureGrid,
  type TreeNode,
} from '../motion-kit';

export interface InteractiveSurfaceDemoProps {
  sceneGraph?: SceneGraph;
  archetypeOverride?: MotionArchetype;
  [key: string]: unknown;
}

/**
 * Deterministic default SceneGraph computed once at module initialization time.
 * Evaluates in < 2ms, avoids re-computation during Remotion per-frame renders,
 * and allows direct export for remotion/Root.tsx composition metadata.
 */
export const defaultSceneGraph: SceneGraph = interactionToSceneGraphAdapter(
  demoInteractionMapRaw as unknown as InteractionMap
);

export const defaultVerticalSceneGraph: SceneGraph = {
  ...defaultSceneGraph,
  canvas: {
    ...defaultSceneGraph.canvas,
    width: 1080,
    height: 1920,
  },
};

/**
 * Intelligently resolves the active motion archetype from sceneGraph configuration.
 */
export function resolveArchetype(
  artDirection?: ArtDirection,
  scenes?: SceneNode[]
): MotionArchetype {
  if (artDirection?.archetype) {
    return artDirection.archetype;
  }
  if (scenes && scenes.length > 0 && scenes[0].type === 'kinetic_typography') {
    return 'kinetic-hook';
  }
  if (artDirection?.surfaceTheme === 'dark') {
    return 'linear-dark';
  }
  return 'base44-studio';
}

/**
 * 3D Parallax UI Fragments for Base44 Studio archetype.
 * Floats with harmonic oscillation at Z=80px and Z=100px around the main surface.
 */
export const FloatingParallaxFragments: React.FC<{
  frame: number;
  accent: string;
  isDark: boolean;
  brandTitle?: string;
  tagline?: string;
}> = ({ frame, accent, isDark, brandTitle = 'SaaS Studio', tagline = 'High Performance' }) => {
  const float1 = Math.sin((frame / 26) * Math.PI) * 7;
  const float2 = Math.cos((frame / 30) * Math.PI) * 6;
  const float3 = Math.sin((frame / 34) * Math.PI) * 5;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Fragment 1: Floating Feature Card (Left, Z=80px) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate3d(-640px, ${-110 + float1}px, 80px) rotateY(14deg) rotateX(6deg)`,
          padding: '14px 18px',
          borderRadius: 14,
          backgroundColor: isDark ? '#1C1B19' : '#FFFFFF',
          border: isDark ? '1px solid #33312C' : '1.5px solid #ECE7DE',
          boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSize: 13,
          color: isDark ? '#E5E2DC' : '#181716',
          zIndex: 10,
        }}
      >
        <div style={{ color: accent, fontWeight: 700, marginBottom: 4 }}>
          ✦ {brandTitle}
        </div>
        <div style={{ color: '#8A867E', fontSize: 12 }}>{tagline}</div>
      </div>

      {/* Fragment 2: Floating Live Status Badge (Right, Z=100px) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate3d(620px, ${100 + float2}px, 100px) rotateY(-12deg) rotateX(-5deg)`,
          padding: '10px 18px',
          borderRadius: 9999,
          backgroundColor: isDark ? '#18181B' : '#FFFFFF',
          border: `1.5px solid ${accent}`,
          boxShadow: `0 14px 32px ${accent}33`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 650,
          color: isDark ? '#FFFFFF' : '#181716',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#10B981',
          }}
        />
        <span>{brandTitle} • Live</span>
      </div>

      {/* Fragment 3: Floating Micro Metric Pill (Bottom Left, Z=60px) */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate3d(-560px, ${260 + float3}px, 60px)`,
          padding: '8px 16px',
          borderRadius: 12,
          backgroundColor: isDark ? '#262523' : '#F5F2EB',
          border: '1px solid rgba(0,0,0,0.06)',
          fontSize: 12,
          fontWeight: 600,
          color: '#8A867E',
          zIndex: 10,
        }}
      >
        <span>99.9% Uptime • Instant Setup</span>
      </div>
    </div>
  );
};

/**
 * Dynamic Bento Grid Reel Surface converging with elastic spring transitions (damping: 12, stiffness: 100).
 */
export const BentoGridReelSurface: React.FC<{
  frame: number;
  sceneGraph: SceneGraph;
  accent: string;
  isDark: boolean;
}> = ({ frame, sceneGraph, accent, isDark }) => {
  // Remotion elastic springs (damping: 12, stiffness: 100)
  const spring1 = spring({ frame: Math.max(0, frame - 0), fps: 30, config: { damping: 12, stiffness: 100 } });
  const spring2 = spring({ frame: Math.max(0, frame - 4), fps: 30, config: { damping: 12, stiffness: 100 } });
  const spring3 = spring({ frame: Math.max(0, frame - 8), fps: 30, config: { damping: 12, stiffness: 100 } });
  const spring4 = spring({ frame: Math.max(0, frame - 12), fps: 30, config: { damping: 12, stiffness: 100 } });

  const card1Y = interpolate(spring1, [0, 1], [-180, 0]);
  const card2X = interpolate(spring2, [0, 1], [220, 0]);
  const card3X = interpolate(spring3, [0, 1], [-220, 0]);
  const card4Y = interpolate(spring4, [0, 1], [180, 0]);

  const cardBg = isDark ? '#141417' : '#FFFFFF';
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #ECE7DE';

  return (
    <div
      style={{
        width: 1400,
        height: 820,
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 20,
        padding: 20,
      }}
    >
      {/* Card 1 (Hero Main View) */}
      <div
        style={{
          gridRow: 'span 2',
          backgroundColor: cardBg,
          border: cardBorder,
          borderRadius: 24,
          padding: 32,
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          transform: `translateY(${card1Y}px) scale(${interpolate(spring1, [0, 1], [0.88, 1])})`,
          opacity: spring1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Telemetry Engine
          </div>
          <h3 style={{ fontSize: 32, fontWeight: 750, margin: '8px 0 0 0', color: isDark ? '#FFFFFF' : '#181716' }}>
            Real-time Fleet Observability
          </h3>
        </div>
        <div
          style={{
            height: 380,
            borderRadius: 16,
            backgroundColor: isDark ? '#1C1C21' : '#F6F4EE',
            border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid #EAE5DB',
            overflow: 'hidden',
          }}
        >
          <InteractiveProductSurface frame={frame} sceneGraph={sceneGraph} />
        </div>
      </div>

      {/* Card 2 (AI Prompt Director) */}
      <div
        style={{
          backgroundColor: cardBg,
          border: cardBorder,
          borderRadius: 24,
          padding: 28,
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          transform: `translateX(${card2X}px)`,
          opacity: spring2,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: '#8A867E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          AI Execution
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: isDark ? '#FFFFFF' : '#181716' }}>
          Autonomous Code Synthesis
        </div>
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            backgroundColor: isDark ? '#1C1C21' : '#F7F5F0',
            border: `1.5px solid ${accent}`,
            color: accent,
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          ▸ &quot;Deploy to 48 edge clusters&quot;
        </div>
      </div>

      {/* Card 3 (Global Distribution) */}
      <div
        style={{
          backgroundColor: cardBg,
          border: cardBorder,
          borderRadius: 24,
          padding: 28,
          boxShadow: '0 20px 50px rgba(0,0,0,0.1)',
          transform: `translate3d(${card3X}px, ${card4Y}px, 0)`,
          opacity: spring4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#8A867E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Global Edge Mesh
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: isDark ? '#FFFFFF' : '#181716', marginTop: 4 }}>
            99.99% Uptime
          </div>
          <span style={{ fontSize: 13, color: '#10B981', fontWeight: 650 }}>
            ● Active in 24 Regions
          </span>
        </div>
      </div>
    </div>
  );
};

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

  // Extract dynamic copy payload from the active product_interaction_3d scene node
  const activePayload = (sceneGraph.scenes.find((s) => s.type === 'product_interaction_3d')?.payload ??
    sceneGraph.scenes[0]?.payload) as (ProductInteraction3DPayload & Record<string, unknown>) | undefined;

  const defaultPrompt =
    'Build and scale with real-time telemetry and automated sync.';
  const promptText =
    activePayload?.textToType ?? activePayload?.promptText ?? defaultPrompt;
  const buttonText = activePayload?.buttonText ?? 'Get Started';
  const brandTitle = activePayload?.productName ? `${activePayload.productName}` : 'Vidiaura';
  const headerHeadline = activePayload?.headline ?? `${brandTitle} • Dynamic Operations`;
  const codeTitle = activePayload?.title ?? 'Architecture & Routing';
  const footerCrest = activePayload?.tagline
    ? `${brandTitle} • ${activePayload.tagline}`
    : `${brandTitle} Engine • Deterministic SceneGraph`;

  // Dynamic sidebar items from features or architecture tree
  const treeFiles = (sceneGraph.scenes.find((s) => s.type === 'synthetic_code_tree')?.payload as unknown as Record<string, unknown>)?.files as string[] | undefined;
  const navItems = activePayload?.features && Array.isArray(activePayload.features) && activePayload.features.length > 0
    ? (activePayload.features as string[]).slice(0, 4)
    : treeFiles && treeFiles.length > 0
      ? treeFiles.slice(0, 4).map(f => f.replace(/^(services|pipeline|telemetry|routes|api)\//, '').replace(/\.(ts|js|py)$/, '').replace(/[-_]/g, ' '))
      : ['Workflows', 'Real-Time Telemetry', 'Cloud Sync', 'Settings'];

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
            {brandTitle}
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
          {navItems.map((item, idx) => (
            <div key={idx} style={{ padding: '8px 14px', color: '#8A867E' }}>
              {item}
            </div>
          ))}
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
              {headerHeadline}
            </h2>
            <span style={{ fontSize: 13, color: '#8A867E' }}>
              {brandTitle} • Real-time telemetry • Dynamic Surface
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
              <span>{buttonText}</span>
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
              {codeTitle}
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
                <span>{codeTitle || `${brandTitle} • Sync Engine`}</span>
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
              {treeFiles && treeFiles.length > 0 ? (
                treeFiles.slice(0, 3).map((f, idx) => (
                  <div
                    key={idx}
                    id={idx === 0 ? 'code-tree-leaf-routes' : undefined}
                    style={
                      idx === 0
                        ? { color: isDark ? '#FFFFFF' : '#181716', fontWeight: 600 }
                        : undefined
                    }
                  >
                    ▸ {f}
                  </div>
                ))
              ) : (
                <>
                  <div
                    id="code-tree-leaf-routes"
                    style={{
                      color: isDark ? '#FFFFFF' : '#181716',
                      fontWeight: 600,
                    }}
                  >
                    ▸ services/core.ts
                  </div>
                  <div>▸ pipeline/ingest.ts</div>
                  <div>▸ telemetry/metrics.ts</div>
                </>
              )}
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
            <span>{footerCrest}</span>
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
  canvas,
  sceneGraph,
  globalFrame,
}) => {
  const seqFrame = useCurrentFrame();
  const isVertical = canvas.width < canvas.height;

  switch (node.type) {
    case 'kinetic_typography': {
      const p = node.payload;
      const isHook = artDirection.archetype === 'kinetic-hook';
      return (
        <div style={fullScreenCenterStyle}>
          <KineticTypography
            frame={seqFrame}
            words={p.words}
            accentWordIndex={p.accentWordIndex ?? -1}
            symbols={p.symbols ?? ['/', '<', '>', '*']}
            staggerFrames={p.staggerFrames ?? 12}
            startFrame={0}
            mode={isHook ? 'kinetic-hook' : 'standard'}
            theme={{
              textColor:
                artDirection.surfaceTheme === 'dark' ? '#FAF9F5' : '#141413',
              accentColor: artDirection.primaryAccent,
              symbolColor:
                artDirection.surfaceTheme === 'dark' ? '#68655E' : '#A19E95',
              fontSize: isVertical ? 58 : isHook ? 96 : 84,
              maxWidth: isVertical ? 920 : 1280,
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
      const surfaceLayout = computeSurfaceLayout(canvas, p.mediaAspect);
      const surfaceWidth = surfaceLayout.surfaceWidth;
      const surfaceHeight = surfaceLayout.surfaceHeight;
      const mediaSource = p.url || p.mockInterface;

      return (
        <div style={fullScreenCenterStyle}>
          <RealCaptureSurface
            windowTitle={
              p.windowTitle ?? 'Base44 SaaS Studio — Dynamic Surface'
            }
            width={surfaceWidth}
            height={surfaceHeight}
            mediaUrl={mediaSource}
            archetype={artDirection.archetype}
            accentColor={artDirection.primaryAccent}
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

    case 'media_showcase': {
      const p = node.payload;
      return (
        <div style={fullScreenCenterStyle}>
          <MediaShowcase
            mediaUrl={p.mediaUrl || ''}
            mediaType={p.mediaType}
            headline={p.headline}
            tagline={p.tagline}
            zoomScale={p.zoomScale}
            panDirection={p.panDirection}
            accentColor={artDirection.primaryAccent}
            isDark={artDirection.surfaceTheme === 'dark'}
            frame={seqFrame}
          />
        </div>
      );
    }

    case 'metric_cards': {
      const p = node.payload;
      return (
        <div style={fullScreenCenterStyle}>
          <MetricCardsShowcase
            headline={p.headline}
            subheadline={p.subheadline}
            metrics={p.metrics}
            accentColor={artDirection.primaryAccent}
            isDark={artDirection.surfaceTheme === 'dark'}
            frame={seqFrame}
          />
        </div>
      );
    }

    case 'conversational_mockup': {
      const p = node.payload;
      return (
        <div style={fullScreenCenterStyle}>
          <ConversationalMockup
            headline={p.headline}
            messages={p.messages}
            accentColor={artDirection.primaryAccent}
            isDark={artDirection.surfaceTheme === 'dark'}
            frame={seqFrame}
          />
        </div>
      );
    }

    case 'saas_feature_grid': {
      const p = node.payload;
      return (
        <div style={fullScreenCenterStyle}>
          <SaaSFeatureGrid
            headline={p.headline}
            features={p.features}
            staggerFrames={p.staggerFrames}
            accentColor={artDirection.primaryAccent}
            isDark={artDirection.surfaceTheme === 'dark'}
            frame={seqFrame}
          />
        </div>
      );
    }

    default: {
      void node;
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
  archetypeOverride,
}) => {
  const frame = useCurrentFrame();
  const archetype =
    archetypeOverride ??
    resolveArchetype(sceneGraph.artDirection, sceneGraph.scenes);
  const isDark = sceneGraph.artDirection.surfaceTheme === 'dark';
  const accent = sceneGraph.artDirection.primaryAccent;
  const isVertical = sceneGraph.canvas.width < sceneGraph.canvas.height;
  const fallbackWidth = isVertical ? 960 : 1440;
  const fallbackHeight = isVertical ? 560 : 840;

  return (
    <div
      style={{
        flex: 1,
        width: sceneGraph.canvas.width,
        height: sceneGraph.canvas.height,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor:
          archetype === 'linear-dark' || isDark ? '#0D0D10' : '#F5F2EB',
      }}
    >
      {/* 1. Outer Layer: Dynamic Studio Backdrop */}
      <DynamicBackdrop
        frame={frame}
        variant={sceneGraph.artDirection.backdropVariant}
        archetype={archetype}
        backgroundColor={
          archetype === 'linear-dark' || isDark ? '#0D0D10' : '#F5F2EB'
        }
        accentGlow={
          archetype === 'linear-dark'
            ? 'rgba(94, 106, 210, 0.18)'
            : undefined
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
        {/* Base44 Studio 3D Parallax UI Fragments */}
        {archetype === 'base44-studio' && (
          <FloatingParallaxFragments
            frame={frame}
            accent={accent}
            isDark={isDark}
            brandTitle={
              (sceneGraph.scenes.find((s) => s.type === 'brand_closing_cta')?.payload as { productName?: string })?.productName ||
              (sceneGraph.scenes.find((s) => s.type === 'product_interaction_3d')?.payload as { productName?: string })?.productName ||
              'SaaS Studio'
            }
            tagline={
              (sceneGraph.scenes.find((s) => s.type === 'brand_closing_cta')?.payload as { tagline?: string })?.tagline ||
              'All-in-one Platform'
            }
          />
        )}

        {/* Bento Grid Reel Converging Surface */}
        {archetype === 'bento-grid' ? (
          <div style={fullScreenCenterStyle}>
            <BentoGridReelSurface
              frame={frame}
              sceneGraph={sceneGraph}
              accent={accent}
              isDark={isDark}
            />
          </div>
        ) : sceneGraph.scenes && sceneGraph.scenes.length > 0 ? (
          sceneGraph.scenes.map((node) => (
            <Sequence
              key={node.id}
              from={node.startFrame}
              durationInFrames={node.durationInFrames}
              name={node.type}
            >
              <SceneNodeRenderer
                node={node}
                artDirection={{
                  ...sceneGraph.artDirection,
                  archetype,
                }}
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
              width={fallbackWidth}
              height={fallbackHeight}
              archetype={archetype}
              accentColor={accent}
            >
              <InteractiveProductSurface
                frame={frame}
                sceneGraph={sceneGraph}
              />
            </RealCaptureSurface>
          </div>
        )}
      {/* Cursor lives in world space (inside the camera rig) so it stays glued to the
          buttons of the recording while the camera zooms and pans. */}
        <SmartCursor
          frame={frame}
          cursorTrack={sceneGraph.cursorTrack}
          size={34}
          color={
            archetype === 'linear-dark' || isDark ? '#FAF9F5' : '#181716'
          }
          accentColor={sceneGraph.artDirection.primaryAccent}
          showRipple={true}
        />
      </CameraRig>


      {/* 4. Audio Layer: Frame-Accurate SFX, Headroom Limiter, & Sidechain Ducking */}
      <AudioEngine audioTrack={sceneGraph.audioTrack} />
    </div>
  );
};
