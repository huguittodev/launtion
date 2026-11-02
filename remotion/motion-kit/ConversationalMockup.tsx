import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { alpha, neutral, signal } from '../../src/lib/design/tokens';

export interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  time?: string;
}

export interface ConversationalMockupProps {
  headline?: string;
  messages: ChatMessage[];
  accentColor?: string;
  isDark?: boolean;
  frame?: number;
}

/**
 * ConversationalMockup:
 * Atomic Remotion component rendering mobile or desktop conversational threads (WhatsApp/AI agent)
 * with animated sequential speech bubbles, typing indicators, and delivery checkmarks.
 */
export const ConversationalMockup: React.FC<ConversationalMockupProps> = ({
  headline = 'Automatización Instantánea por WhatsApp',
  messages,
  accentColor = signal.green,
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

  const chatMessages: ChatMessage[] = messages.length > 0 ? messages.slice(0, 3) : [
    { sender: 'user', text: 'Hola, ¿tienen disponibilidad para mañana a las 11:00?', time: '10:42' },
    { sender: 'assistant', text: '¡Hola! Sí, confirmado tu hueco a las 11:00 con el especialista.', time: '10:42' },
    { sender: 'user', text: '¡Genial, muchas gracias!', time: '10:43' },
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
        gap: 30,
      }}
    >
      {/* Title */}
      {headline && (
        <h2
          style={{
            fontSize: 34,
            fontWeight: 800,
            color: isDark ? neutral.white : neutral.ink,
            letterSpacing: '-0.02em',
            margin: 0,
            textAlign: 'center',
            opacity: headerSpring,
            transform: `translateY(${interpolate(headerSpring, [0, 1], [-20, 0])}px)`,
          }}
        >
          {headline}
        </h2>
      )}

      {/* Chat Container Phone / Card */}
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          borderRadius: 24,
          backgroundColor: isDark ? neutral.nightRaised : neutral.white,
          border: isDark ? `1px solid ${alpha.white08}` : `1px solid ${neutral.border}`,
          boxShadow: isDark
            ? '0 25px 60px rgba(0,0,0,0.4), 0 0 40px rgba(34, 197, 94, 0.12)'
            : '0 20px 50px rgba(0,0,0,0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Chat Header */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: isDark ? neutral.night : neutral.well,
            borderBottom: isDark ? `1px solid ${alpha.white06}` : `1px solid ${neutral.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              backgroundColor: accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: neutral.white,
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            ✓
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: isDark ? neutral.white : neutral.ink }}>
              Asistente Inteligente
            </span>
            <span style={{ fontSize: 12, color: signal.green, fontWeight: 600 }}>
              ● En línea • Respuesta instantánea
            </span>
          </div>
        </div>

        {/* Message Bubbles Area */}
        <div
          style={{
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            minHeight: 220,
            backgroundColor: isDark ? neutral.void : neutral.shell,
          }}
        >
          {chatMessages.map((msg, idx) => {
            const isUser = msg.sender === 'user';
            const msgSpring = spring({
              frame: Math.max(0, f - (8 + idx * 16)),
              fps,
              config: { damping: 13, stiffness: 110 },
            });

            return (
              <div
                key={idx}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  padding: '12px 18px',
                  borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  backgroundColor: isUser
                    ? accentColor
                    : isDark
                      ? neutral.aubergine
                      : neutral.white,
                  color: isUser ? neutral.white : isDark ? neutral.paper : neutral.ink,
                  fontSize: 15,
                  lineHeight: 1.45,
                  fontWeight: 500,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  opacity: msgSpring,
                  transform: `scale(${interpolate(msgSpring, [0, 1], [0.8, 1])}) translateY(${interpolate(msgSpring, [0, 1], [20, 0])}px)`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span>{msg.text}</span>
                {msg.time && (
                  <span
                    style={{
                      fontSize: 11,
                      color: isUser ? alpha.white08 : neutral.textSubtle,
                      alignSelf: 'flex-end',
                    }}
                  >
                    {msg.time} {isUser && '✓✓'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
