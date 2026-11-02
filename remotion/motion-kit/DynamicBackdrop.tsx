import React from 'react';
import { interpolate } from 'remotion';
import type { MotionArchetype } from '../../src/lib/scene-graph/types';
import { neutral, sceneThemes } from '../../src/lib/design/tokens';

export type { MotionArchetype };

export type BackdropVariant =
  | 'light-editorial'
  | 'dark-precision'
  | 'aurora-blur'
  | 'solid';

export interface DynamicBackdropProps {
  frame: number;
  variant?: BackdropVariant;
  archetype?: MotionArchetype;
  backgroundColor?: string;
  accentGlow?: string;
  dotGrid?: boolean;
}

/**
 * DynamicBackdrop:
 * Fondos dinámicos de alto nivel de estudio con micro-movimiento orgánico,
 * gradientes aurora y mallas técnicas (estilo Base44).
 */
export const DynamicBackdrop: React.FC<DynamicBackdropProps> = ({
  frame,
  variant = 'light-editorial',
  archetype,
  backgroundColor,
  accentGlow,
  dotGrid = true,
}) => {
  // Movimiento ondulante continuo y determinista para gradientes vivos
  const orb1X = interpolate(
    Math.sin((frame / 60) * Math.PI),
    [-1, 1],
    [15, 30]
  );
  const orb1Y = interpolate(
    Math.cos((frame / 60) * Math.PI),
    [-1, 1],
    [20, 35]
  );

  const orb2X = interpolate(
    Math.sin((frame / 45) * Math.PI),
    [-1, 1],
    [65, 80]
  );
  const orb2Y = interpolate(
    Math.cos((frame / 45) * Math.PI),
    [-1, 1],
    [60, 75]
  );

  if (variant === 'dark-precision' || archetype === 'linear-dark') {
    const darkBg = backgroundColor ?? sceneThemes.darkPrecision.background;
    const glow = accentGlow ?? 'rgba(94, 106, 210, 0.16)';
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: darkBg,
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        {/* Subtle Neon Radial Illumination for Linear Dark */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 38%, ${glow} 0%, rgba(13, 13, 16, 0) 65%)`,
            pointerEvents: 'none',
          }}
        />
        {dotGrid && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)',
              backgroundSize: '36px 36px',
            }}
          />
        )}
      </div>
    );
  }

  if (variant === 'aurora-blur') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: backgroundColor ?? neutral.paper,
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        {/* Orbe 1: Naranja / Ámbar vivo */}
        <div
          style={{
            position: 'absolute',
            left: `${orb1X}%`,
            top: `${orb1Y}%`,
            width: 720,
            height: 720,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255, 140, 66, 0.45) 0%, rgba(255, 92, 53, 0) 70%)',
            filter: 'blur(90px)',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* Orbe 2: Rosa / Violeta suave */}
        <div
          style={{
            position: 'absolute',
            left: `${orb2X}%`,
            top: `${orb2Y}%`,
            width: 800,
            height: 800,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(255, 180, 210, 0.45) 0%, rgba(220, 120, 255, 0) 70%)',
            filter: 'blur(100px)',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {dotGrid && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 0)',
              backgroundSize: '36px 36px',
            }}
          />
        )}
      </div>
    );
  }

  // 'light-editorial' o 'base44-studio' por defecto (Warm Cream)
  const creamBg = backgroundColor ?? sceneThemes.lightEditorial.background;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: creamBg,
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {/* Ambient warm lighting vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.4) 0%, rgba(245, 242, 235, 0) 70%)',
          pointerEvents: 'none',
        }}
      />
      {dotGrid && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(24, 23, 21, 0.045) 1px, transparent 0)',
            backgroundSize: '36px 36px',
            opacity: 0.9,
          }}
        />
      )}
    </div>
  );
};

