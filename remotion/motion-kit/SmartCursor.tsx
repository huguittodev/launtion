import React from 'react';
import { Easing, interpolate } from 'remotion';

export interface Point2D {
  x: number; // Porcentaje 0 - 100
  y: number; // Porcentaje 0 - 100
}

export interface SmartCursorProps {
  frame: number;
  start: Point2D;
  target: Point2D;
  startFrame?: number;
  endFrame?: number;
  clickFrame?: number;
  size?: number;
  color?: string;
  showRipple?: boolean;
}

/**
 * SmartCursor:
 * Cursor vectorial de alta definición SVG con micro-animación física de clic,
 * sombra difusa y onda de choque (ripple) sincronizada al fotograma exacto.
 */
export const SmartCursor: React.FC<SmartCursorProps> = ({
  frame,
  start,
  target,
  startFrame = 0,
  endFrame = 30,
  clickFrame,
  size = 32,
  color = '#181716',
  showRipple = true,
}) => {
  // Progresión del cursor hacia el objetivo con curva Bezier fluida
  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const posX = start.x + (target.x - start.x) * progress;
  const posY = start.y + (target.y - start.y) * progress;

  // Animación física del clic (presión y rebote)
  let clickScale = 1;
  let rippleRadius = 0;
  let rippleOpacity = 0;

  if (clickFrame !== undefined && frame >= clickFrame) {
    const clickElapsed = frame - clickFrame;

    // Presión: se encoge hasta 0.84 y luego recupera el tamaño normal
    clickScale = interpolate(
      clickElapsed,
      [0, 2, 7],
      [1, 0.82, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    // Onda de choque / ripple
    if (showRipple) {
      rippleRadius = interpolate(clickElapsed, [0, 16], [4, 46], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });

      rippleOpacity = interpolate(clickElapsed, [0, 14], [0.65, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 999,
      }}
    >
      {/* Onda de choque (Ripple) del clic */}
      {showRipple && rippleOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: `${posX}%`,
            top: `${posY}%`,
            width: rippleRadius * 2,
            height: rippleRadius * 2,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid rgba(255, 92, 53, 0.9)',
            backgroundColor: 'rgba(255, 92, 53, 0.18)',
            opacity: rippleOpacity,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Cursor Vectorial SVG */}
      <div
        style={{
          position: 'absolute',
          left: `${posX}%`,
          top: `${posY}%`,
          transform: `scale(${clickScale}) translate(0, 0)`,
          transformOrigin: 'top left',
          willChange: 'transform, left, top',
          filter:
            'drop-shadow(0 6px 12px rgba(0,0,0,0.32)) drop-shadow(0 1px 3px rgba(0,0,0,0.2))',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Puntero de alta precisión estilo macOS moderno */}
          <path
            d="M3 2L10.5 21L13.8 13.8L21 10.5L3 2Z"
            fill={color}
            stroke="#FFFFFF"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
