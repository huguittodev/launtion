import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { alpha, neutral, signal } from '../../src/lib/design/tokens';

export interface SaaSFeatureItem {
  icon: string;
  name: string;
  description: string;
}

export interface SaaSFeatureGridProps {
  headline: string;
  features: SaaSFeatureItem[];
  staggerFrames?: number;
  accentColor?: string;
  isDark?: boolean;
  frame?: number;
}

const DEFAULT_FEATURES: SaaSFeatureItem[] = [
  { icon: '⚡', name: 'Instant Setup', description: 'Live in under 5 minutes, no configuration needed' },
  { icon: '🔒', name: 'Enterprise Security', description: 'SOC2 compliant and end-to-end encrypted by default' },
  { icon: '📊', name: 'Real-time Analytics', description: 'Track every metric that matters, live' },
  { icon: '🤖', name: 'AI-Powered', description: 'Intelligent automation built directly into your workflow' },
];

/**
 * SaaSFeatureGrid:
 * Atomic Remotion component rendering a 2×2 (or up to 6) feature grid.
 * Each tile (emoji icon + name + description) animates in with staggered spring physics.
 * Common in Iman Gadzhi-style SaaS marketing videos.
 * Uses design tokens exclusively — no hex literals.
 */
export const SaaSFeatureGrid: React.FC<SaaSFeatureGridProps> = ({
  headline,
  features,
  staggerFrames = 10,
  accentColor = signal.orange,
  isDark = true,
  frame: frameProp,
}) => {
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frameProp ?? currentFrame;

  const items = features.length >= 2 ? features.slice(0, 6) : DEFAULT_FEATURES;
  const cols = items.length <= 4 ? 2 : 3;

  // Header spring
  const headerProgress = spring({
    frame: f,
    fps,
    config: { damping: 16, stiffness: 100 },
  });

  const bg = isDark ? neutral.void : neutral.cream;
  const textPrimary = isDark ? neutral.white : neutral.ink;
  const textSecondary = isDark ? neutral.nightText : neutral.textSecondary;
  const cardBg = isDark ? neutral.aubergine : neutral.white;
  const cardBorder = isDark ? alpha.white08 : neutral.border;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 80px',
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
      }}
    >
      {/* Headline */}
      <h2
        style={{
          color: textPrimary,
          fontSize: 52,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: 48,
          textAlign: 'center',
          opacity: headerProgress,
          transform: `translateY(${interpolate(headerProgress, [0, 1], [24, 0])}px)`,
        }}
      >
        {headline}
      </h2>

      {/* Feature Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 24,
          width: '100%',
          maxWidth: 1200,
        }}
      >
        {items.map((feature, idx) => {
          const tileDelay = idx * staggerFrames;
          const tileProgress = spring({
            frame: Math.max(0, f - 10 - tileDelay),
            fps,
            config: { damping: 15, stiffness: 95 },
          });

          return (
            <div
              key={idx}
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                borderRadius: 20,
                padding: '36px 32px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: tileProgress,
                transform: `translateY(${interpolate(tileProgress, [0, 1], [32, 0])}px) scale(${interpolate(tileProgress, [0, 1], [0.94, 1])})`,
                boxShadow: isDark
                  ? `0 4px 24px ${alpha.shadowStrong}`
                  : `0 4px 24px ${alpha.shadowSoft}`,
              }}
            >
              {/* Icon */}
              <div
                style={{
                  fontSize: 42,
                  lineHeight: 1,
                  marginBottom: 4,
                }}
              >
                {feature.icon}
              </div>

              {/* Accent line */}
              <div
                style={{
                  width: 36,
                  height: 3,
                  borderRadius: 2,
                  background: accentColor,
                  opacity: tileProgress,
                }}
              />

              {/* Feature name */}
              <div
                style={{
                  color: textPrimary,
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.2,
                }}
              >
                {feature.name}
              </div>

              {/* Description */}
              <div
                style={{
                  color: textSecondary,
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: 1.5,
                }}
              >
                {feature.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

