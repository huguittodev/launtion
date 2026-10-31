import React from 'react';
import { interpolate } from 'remotion';

export type BackdropVariant =
  | 'light-editorial'
  | 'dark-precision'
  | 'aurora-blur'
  | 'solid';

export interface DynamicBackdropProps {
  frame: number;
  variant?: BackdropVariant;
  backgroundColor?: string;
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
  backgroundColor,
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

  if (variant === 'dark-precision') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: backgroundColor ?? '#121211',
          overflow: 'hidden',
          zIndex: 0,
        }}
      >
        {dotGrid && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0)',
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
          backgroundColor: backgroundColor ?? '#FAF8F4',
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

  // 'light-editorial' por defecto
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: backgroundColor ?? '#F4F1EA',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {dotGrid && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.045) 1px, transparent 0)',
            backgroundSize: '40px 40px',
            opacity: 0.85,
          }}
        />
      )}
    </div>
  );
};

