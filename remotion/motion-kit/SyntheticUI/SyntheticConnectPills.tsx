import React from 'react';
import { Easing, interpolate } from 'remotion';
import { neutral, sceneThemes } from '../../../src/lib/design/tokens';

export interface SyntheticConnectPillsProps {
  frame: number;
  sourceText?: string;
  targetText?: string;
  startFrame?: number;
  theme?: {
    sourceColor?: string;
    targetColor?: string;
    accentColor?: string;
  };
}

/**
 * SyntheticConnectPills:
 * Átomo visual de integración / conexión fluida de servicios (estilo Base44 0:14).
 */
export const SyntheticConnectPills: React.FC<SyntheticConnectPillsProps> = ({
  frame,
  sourceText = 'Connect to',
  targetText = 'Calendar',
  startFrame = 0,
  theme = {},
}) => {
  const {
    sourceColor = neutral.ink,
    targetColor = sceneThemes.lightEditorial.accent,
    accentColor = sceneThemes.lightEditorial.accent,
  } = theme;

  const currentElapsed = Math.max(0, frame - startFrame);

  // Entrada de la pastilla izquierda
  const sourceSlideX = interpolate(currentElapsed, [0, 16], [-60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const sourceOpacity = interpolate(currentElapsed, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Entrada del nodo central de conexión
  const linkScale = interpolate(currentElapsed, [10, 22], [0.4, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.175, 0.885, 0.32, 1.2),
  });

  // Entrada de la pastilla derecha
  const targetSlideX = interpolate(currentElapsed, [14, 28], [60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const targetOpacity = interpolate(currentElapsed, [14, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Haz de energía / resplandor conectando ambas partes (frames 26 a 55)
  const beamPulse = interpolate(currentElapsed, [24, 38, 52], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        userSelect: 'none',
        position: 'relative',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
      }}
    >
      {/* Pastilla izquierda */}
      <div
        style={{
          opacity: sourceOpacity,
          transform: `translateX(${sourceSlideX}px)`,
          padding: '16px 36px',
          borderRadius: 9999,
          border: `1.5px solid ${neutral.ink}`,
          backgroundColor: neutral.white,
          color: sourceColor,
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
        }}
      >
        {sourceText}
      </div>

      {/* Icono de enlace central */}
      <div
        style={{
          transform: `scale(${linkScale})`,
          width: 48,
          height: 48,
          borderRadius: '50%',
          border: `1.5px solid ${neutral.borderStrong}`,
          backgroundColor: neutral.paper,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: neutral.textSecondary,
          boxShadow: `0 0 ${beamPulse * 28}px ${accentColor}`,
          transition: 'box-shadow 0.1s ease',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </div>

      {/* Pastilla derecha */}
      <div
        style={{
          opacity: targetOpacity,
          transform: `translateX(${targetSlideX}px)`,
          padding: '16px 38px',
          borderRadius: 9999,
          border: `1.5px solid ${targetColor}`,
          backgroundColor: neutral.white,
          color: targetColor,
          fontSize: 26,
          fontWeight: 650,
          letterSpacing: '-0.02em',
          boxShadow: `0 8px 28px rgba(255, 92, 53, 0.18)`,
        }}
      >
        {targetText}
      </div>
    </div>
  );
};

