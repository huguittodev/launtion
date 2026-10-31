import React from 'react';
import { Easing, interpolate } from 'remotion';

export interface IconGridMorphProps {
  frame: number;
  rows?: number;
  cols?: number;
  startFrame?: number;
  initialColor?: string;
  targetColor?: string;
  waveStartFrame?: number;
}

/**
 * IconGridMorph:
 * Matriz geométrica de iconos con transición de estado en onda radial
 * y elevación 3D del nodo central (estilo Base44 0:39: alerta -> escudo).
 */
export const IconGridMorph: React.FC<IconGridMorphProps> = ({
  frame,
  rows = 4,
  cols = 7,
  startFrame = 0,
  initialColor = '#EF4444',
  targetColor = '#22C55E',
  waveStartFrame = 15,
}) => {
  const currentElapsed = Math.max(0, frame - startFrame);

  // Centro geométrico de la matriz
  const centerRow = (rows - 1) / 2;
  const centerCol = (cols - 1) / 2;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: '40px 54px',
        alignItems: 'center',
        justifyItems: 'center',
        userSelect: 'none',
      }}
    >
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          // Distancia euclídea al centro
          const dist = Math.sqrt(
            Math.pow(r - centerRow, 2) + Math.pow(c - centerCol, 2)
          );
          const isCenter =
            Math.abs(r - centerRow) < 0.6 && Math.abs(c - centerCol) < 0.6;

          // Desfase de la onda radial
          const iconWaveTrigger = waveStartFrame + dist * 5;

          // Transición de morphing en este icono
          const morphProgress = interpolate(
            currentElapsed,
            [iconWaveTrigger, iconWaveTrigger + 10],
            [0, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            }
          );

          // Escala durante la transformación (pop elástico)
          const popScale = interpolate(
            morphProgress,
            [0, 0.5, 1],
            [1, 1.25, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          // Elevación especial del icono central
          const centerZoom = isCenter
            ? interpolate(
                currentElapsed,
                [waveStartFrame + 20, waveStartFrame + 38],
                [1, 1.8],
                {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                  easing: Easing.bezier(0.175, 0.885, 0.32, 1.2),
                }
              )
            : 1;

          // Interpolación de color
          const isMorphed = morphProgress > 0.5;
          const currentColor = isMorphed ? targetColor : initialColor;

          return (
            <div
              key={`${r}-${c}`}
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${popScale * centerZoom})`,
                transition: 'transform 0.05s linear',
                filter: isCenter && isMorphed
                  ? `drop-shadow(0 0 20px ${targetColor})`
                  : 'none',
                zIndex: isCenter ? 10 : 1,
              }}
            >
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke={currentColor}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isMorphed ? (
                  // Escudo de seguridad (Shield Check)
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                ) : (
                  // Triángulo de alerta
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                )}
              </svg>
            </div>
          );
        })
      )}
    </div>
  );
};
