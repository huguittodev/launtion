import React from 'react';
import { Easing, interpolate } from 'remotion';
import { sceneThemes } from '../../src/lib/design/tokens';

export interface KineticTypographyProps {
  frame: number;
  words: string[];
  accentWordIndex?: number;
  symbols?: string[];
  theme?: {
    textColor?: string;
    accentColor?: string;
    symbolColor?: string;
    fontSize?: number;
    letterSpacing?: string;
    maxWidth?: number | string;
  };
  staggerFrames?: number;
  startFrame?: number;
  mode?: 'standard' | 'kinetic-hook';
  exitFrame?: number;
}

/**
 * KineticTypography:
 * Primitiva para revelación rítmica palabra a palabra con micro-movimiento,
 * desenfoque óptico gradual (blur), tracking dinámico de caracteres
 * y transiciones de revelación cinematográficas hacia la superficie 3D.
 */
export const KineticTypography: React.FC<KineticTypographyProps> = ({
  frame,
  words,
  accentWordIndex = -1,
  symbols = ['/', '<', '>', '*'],
  theme = {},
  staggerFrames = 12,
  startFrame = 0,
  mode = 'standard',
  exitFrame,
}) => {
  const isHookMode = mode === 'kinetic-hook';
  const {
    textColor = sceneThemes.lightEditorial.textPrimary,
    accentColor = sceneThemes.lightEditorial.accent,
    symbolColor = sceneThemes.lightEditorial.textTertiary,
    fontSize = isHookMode ? 96 : 84,
    maxWidth = 1280,
  } = theme;

  const currentElapsed = Math.max(0, frame - startFrame);

  // Exit / Reveal transition to 3D app surface
  const isExiting = exitFrame !== undefined && currentElapsed >= exitFrame;
  const exitProgress = isExiting
    ? interpolate(currentElapsed, [exitFrame, exitFrame + 14], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.in(Easing.cubic),
      })
    : 0;

  const containerScale = interpolate(exitProgress, [0, 1], [1, 1.25]);
  const containerOpacity = interpolate(exitProgress, [0, 1], [1, 0]);
  const containerBlur = interpolate(exitProgress, [0, 1], [0, 16]);

  // Símbolos orbitales animados con sutil rotación continua
  const symbolRot = (frame * 1.5) % 360;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        position: 'relative',
        userSelect: 'none',
        transform: `scale(${containerScale})`,
        opacity: containerOpacity,
        filter: containerBlur > 0.1 ? `blur(${containerBlur}px)` : 'none',
      }}
    >
      {/* Símbolos decorativos cinéticos flotantes */}
      {!isHookMode &&
        symbols.map((sym, i) => {
          const symDelay = i * 6;
          const symOpacity = interpolate(
            currentElapsed,
            [symDelay, symDelay + 15],
            [0, 0.7],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );
          const symScale = interpolate(
            currentElapsed,
            [symDelay, symDelay + 20],
            [0.6, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            }
          );

          // Disposición geométrica alrededor del texto
          const offsets = [
            { top: '32%', left: '24%' },
            { top: '34%', right: '24%' },
            { bottom: '34%', left: '27%' },
            { bottom: '32%', right: '26%' },
          ];
          const pos = offsets[i % offsets.length];

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                ...pos,
                opacity: symOpacity,
                transform: `scale(${symScale}) rotate(${i % 2 === 0 ? symbolRot : -symbolRot}deg)`,
                fontSize: 38,
                fontWeight: 500,
                fontFamily: 'monospace',
                color: i === 1 ? accentColor : symbolColor,
                transition: 'transform 0.1s linear',
              }}
            >
              {sym}
            </div>
          );
        })}

      {/* Contenedor de palabras */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '22px',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          textAlign: 'center',
        }}
      >
        {words.map((word, index) => {
          const wordStart = index * staggerFrames;

          // Animación de aparición (opacidad + desplazamiento Y suave)
          const opacity = interpolate(
            currentElapsed,
            [wordStart, wordStart + 14],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
          );

          const translateY = interpolate(
            currentElapsed,
            [wordStart, wordStart + 18],
            [40, 0],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }
          );

          const scale = interpolate(
            currentElapsed,
            [wordStart, wordStart + 18],
            [isHookMode ? 1.15 : 0.92, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            }
          );

          // Optical blur word-by-word reveal (Kinetic Hook)
          const wordBlur = interpolate(
            currentElapsed,
            [wordStart, wordStart + 14],
            [isHookMode ? 18 : 0, 0],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            }
          );

          // Dynamic letter tracking snap (Kinetic Hook)
          const letterTrackingEm = interpolate(
            currentElapsed,
            [wordStart, wordStart + 18],
            [isHookMode ? 0.08 : -0.04, -0.045],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }
          );

          const isAccent = index === accentWordIndex;

          return (
            <span
              key={index}
              style={{
                display: 'inline-block',
                opacity,
                transform: `translateY(${translateY}px) scale(${scale})`,
                filter: wordBlur > 0.2 ? `blur(${wordBlur}px)` : 'none',
                letterSpacing: theme.letterSpacing ?? `${letterTrackingEm}em`,
                fontSize,
                fontWeight: isHookMode ? 850 : 700,
                lineHeight: 1.1,
                color: isAccent ? accentColor : textColor,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
                textShadow: isAccent
                  ? `0 10px 35px ${accentColor}44`
                  : 'none',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
};

