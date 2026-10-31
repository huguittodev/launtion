import React from 'react';
import { Easing, interpolate } from 'remotion';

export interface SyntheticPromptBoxProps {
  frame: number;
  textToType: string;
  startFrame?: number;
  charsPerFrame?: number;
  width?: number;
  theme?: {
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    accentColor?: string;
  };
}

/**
 * SyntheticPromptBox:
 * Átomo de UI de entrada de prompt aislado, con tipeo carácter por carácter,
 * cursor intermitente y controles de acción interactivos (estilo Base44 0:06).
 */
export const SyntheticPromptBox: React.FC<SyntheticPromptBoxProps> = ({
  frame,
  textToType,
  startFrame = 0,
  charsPerFrame = 0.8,
  width = 820,
  theme = {},
}) => {
  const {
    backgroundColor = '#FFFFFF',
    borderColor = '#EBE7DE',
    textColor = '#191816',
    accentColor = '#FF5C35',
  } = theme;

  const currentElapsed = Math.max(0, frame - startFrame);

  // Animación de entrada suave del contenedor (opacidad + escala)
  const containerOpacity = interpolate(currentElapsed, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const containerScale = interpolate(currentElapsed, [0, 18], [0.94, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Cálculo de texto mecanografiado
  const totalChars = textToType.length;
  const currentChars = Math.min(
    totalChars,
    Math.floor(currentElapsed * charsPerFrame)
  );
  const displayText = textToType.slice(0, currentChars);
  const isTypingComplete = currentChars >= totalChars;

  // Parpadeo del cursor (cada 15 frames)
  const showCursor = Math.floor(frame / 12) % 2 === 0;

  // Animación del botón enviar cuando termina de escribir
  const buttonHighlight = isTypingComplete
    ? interpolate(currentElapsed, [totalChars / charsPerFrame, totalChars / charsPerFrame + 10], [1, 1.05], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  return (
    <div
      style={{
        opacity: containerOpacity,
        transform: `scale(${containerScale})`,
        width,
        borderRadius: 24,
        backgroundColor,
        border: `1.5px solid ${borderColor}`,
        boxShadow:
          '0 24px 60px -12px rgba(24, 23, 21, 0.12), 0 0 1px rgba(0,0,0,0.06)',
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
      }}
    >
      {/* Campo de texto con prompt */}
      <div
        style={{
          fontSize: 24,
          lineHeight: 1.45,
          color: textColor,
          minHeight: 70,
          fontWeight: 450,
          letterSpacing: '-0.015em',
        }}
      >
        <span>{displayText}</span>
        <span
          style={{
            display: 'inline-block',
            width: 3,
            height: 24,
            backgroundColor: showCursor ? accentColor : 'transparent',
            marginLeft: 4,
            verticalAlign: 'middle',
          }}
        />
      </div>

      {/* Barra inferior de acciones */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid #F3EFE9',
          paddingTop: 16,
        }}
      >
        {/* Botón más (+) */}
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: '#F7F5F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#76726A',
            fontSize: 22,
            fontWeight: 400,
          }}
        >
          +
        </div>

        {/* Acciones derechas (micrófono + enviar) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Icono de micrófono */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#8A867E',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>

          {/* Botón enviar con flecha */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: isTypingComplete ? '#181716' : '#E6E2D9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              transform: `scale(${buttonHighlight})`,
              transition: 'background-color 0.2s ease',
              boxShadow: isTypingComplete
                ? '0 6px 16px rgba(0,0,0,0.18)'
                : 'none',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

