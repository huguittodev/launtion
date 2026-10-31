import React from 'react';
import { Easing, interpolate } from 'remotion';

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
  };
  staggerFrames?: number;
  startFrame?: number;
}

/**
 * KineticTypography:
 * Primitiva para revelación rítmica palabra a palabra con micro-movimiento,
 * símbolos flotantes orbitales y transiciones de muelle inspiradas en Base44.
 */
export const KineticTypography: React.FC<KineticTypographyProps> = ({
  frame,
  words,
  accentWordIndex = -1,
  symbols = ['/', '<', '>', '*'],
  theme = {},
  staggerFrames = 12,
  startFrame = 0,
}) => {
  const {
    textColor = '#141413',
    accentColor = '#FF5C35',
    symbolColor = '#A19E95',
    fontSize = 84,
  } = theme;

  const currentElapsed = Math.max(0, frame - startFrame);

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
      }}
    >
      {/* Símbolos decorativos cinéticos flotantes */}
      {symbols.map((sym, i) => {
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
          maxWidth: '1280px',
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
            [0.92, 1],
            {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
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
                fontSize,
                fontWeight: 700,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                color: isAccent ? accentColor : textColor,
                fontFamily:
                  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
                textShadow: isAccent
                  ? '0 10px 30px rgba(255, 92, 53, 0.22)'
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

