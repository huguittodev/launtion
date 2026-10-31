import React from 'react';
import { Easing, interpolate } from 'remotion';

export interface SyntheticHeroButtonProps {
  frame: number;
  buttonText: string;
  startFrame?: number;
  clickFrame?: number;
  theme?: {
    backgroundColor?: string;
    textColor?: string;
    glowColor?: string;
    borderRadius?: number;
    fontSize?: number;
  };
  icon?: React.ReactNode;
}

/**
 * SyntheticHeroButton:
 * Botón de acción heroico aislado con resplandor, micro-presión física al clic
 * y diseño publicitario minimalista (estilo Base44 0:42 "Publish").
 */
export const SyntheticHeroButton: React.FC<SyntheticHeroButtonProps> = ({
  frame,
  buttonText,
  startFrame = 0,
  clickFrame,
  theme = {},
  icon,
}) => {
  const {
    backgroundColor = '#181716',
    textColor = '#FFFFFF',
    glowColor = 'rgba(255, 92, 53, 0.28)',
    borderRadius = 22,
    fontSize = 32,
  } = theme;

  const currentElapsed = Math.max(0, frame - startFrame);

  // Entrada con escala elástica
  const scaleEntrance = interpolate(currentElapsed, [0, 18], [0.88, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.175, 0.885, 0.32, 1.15),
  });

  const opacity = interpolate(currentElapsed, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Micro-presión de clic
  let clickScale = 1;
  let clickGlow = 0.5;

  if (clickFrame !== undefined && frame >= clickFrame) {
    const elapsedSinceClick = frame - clickFrame;
    clickScale = interpolate(
      elapsedSinceClick,
      [0, 3, 8],
      [1, 0.93, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
    clickGlow = interpolate(
      elapsedSinceClick,
      [0, 4, 18],
      [0.5, 1, 0.6],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  }

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scaleEntrance * clickScale})`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '20px 54px',
        borderRadius,
        backgroundColor,
        color: textColor,
        fontSize,
        fontWeight: 650,
        letterSpacing: '-0.025em',
        boxShadow: `0 ${20 * clickGlow}px ${50 * clickGlow}px -10px ${glowColor}, 0 0 1px rgba(255,255,255,0.4) inset, 0 10px 24px rgba(0,0,0,0.18)`,
        userSelect: 'none',
        willChange: 'transform',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
      }}
    >
      {icon}
      <span>{buttonText}</span>
    </div>
  );
};
