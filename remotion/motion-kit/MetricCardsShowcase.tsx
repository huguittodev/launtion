import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { alpha, neutral, signal } from '../../src/lib/design/tokens';

export interface MetricCardItem {
  value: string;
  label: string;
  trend?: string;
  badge?: string;
}

export interface MetricCardsShowcaseProps {
  headline?: string;
  subheadline?: string;
  metrics: MetricCardItem[];
  accentColor?: string;
  isDark?: boolean;
  frame?: number;
}

/**
 * MetricCardsShowcase:
 * Atomic Remotion component rendering SaaS KPI metrics / results cards
 * with staggered spring entrance physics, animated numeric scale, and gradient sparklines.
 */
export const MetricCardsShowcase: React.FC<MetricCardsShowcaseProps> = ({
  headline = 'Resultados Reales en Producción',
  subheadline,
  metrics,
  accentColor = signal.orange,
  isDark = true,
  frame: frameProp,
}) => {
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frameProp ?? currentFrame;

  const headerSpring = spring({
    frame: f,
    fps,
    config: { damping: 14, stiffness: 90 },
  });

  const cardItems = metrics.length > 0 ? metrics.slice(0, 3) : [
    { value: '+85%', label: 'Aumento en Conversión', trend: '+12% este mes' },
    { value: '10x', label: 'Mayor Velocidad de Flujo', trend: 'Tiempo récord' },
    { value: '99.9%', label: 'Disponibilidad Garantizada', trend: 'SLA Empresarial' },
  ];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        boxSizing: 'border-box',
        gap: 36,
      }}
    >
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          opacity: headerSpring,
          transform: `translateY(${interpolate(headerSpring, [0, 1], [-25, 0])}px)`,
        }}
      >
        <h2
          style={{
            fontSize: 38,
            fontWeight: 800,
            color: isDark ? neutral.white : neutral.ink,
            letterSpacing: '-0.03em',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {headline}
        </h2>
        {subheadline && (
          <span
            style={{
              fontSize: 18,
              color: neutral.textSubtle,
              fontWeight: 500,
              textAlign: 'center',
            }}
          >
            {subheadline}
          </span>
        )}
      </div>

      {/* Grid of Metric Cards */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          width: '100%',
          maxWidth: 1100,
          justifyContent: 'center',
        }}
      >
        {cardItems.map((item, idx) => {
          const cardSpring = spring({
            frame: Math.max(0, f - (6 + idx * 7)),
            fps,
            config: { damping: 12, stiffness: 100 },
          });

          return (
            <div
              key={idx}
              style={{
                flex: 1,
                padding: '28px 24px',
                borderRadius: 20,
                backgroundColor: isDark ? neutral.aubergine : neutral.white,
                border: isDark ? `1px solid ${alpha.white08}` : `1.5px solid ${neutral.border}`,
                boxShadow: isDark
                  ? '0 20px 50px rgba(0,0,0,0.3)'
                  : '0 20px 40px rgba(0,0,0,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                opacity: cardSpring,
                transform: `scale(${interpolate(cardSpring, [0, 1], [0.85, 1])}) translateY(${interpolate(cardSpring, [0, 1], [30, 0])}px)`,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Glow accent pill */}
              <div
                style={{
                  width: 32,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: accentColor,
                  marginBottom: 4,
                }}
              />

              {/* Metric Value */}
              <div
                style={{
                  fontSize: 52,
                  fontWeight: 850,
                  color: isDark ? neutral.white : neutral.ink,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                }}
              >
                {item.value}
              </div>

              {/* Metric Label */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 650,
                  color: isDark ? neutral.stone : neutral.textSecondary,
                }}
              >
                {item.label}
              </div>

              {/* Trend / Subtext */}
              {item.trend && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: signal.green,
                    fontWeight: 600,
                    marginTop: 'auto',
                    paddingTop: 8,
                  }}
                >
                  <span>▲</span>
                  <span>{item.trend}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
