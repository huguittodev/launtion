import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';

export interface LaunchDemoProps {
  categoryText?: string;
  headline?: string;
  subtitle?: string;
}

/**
 * Escena de título editorial animado determinista.
 */
const EditorialHeader: React.FC<{
  categoryText: string;
  headline: string;
  subtitle: string;
  frame: number;
}> = ({ categoryText, headline, subtitle, frame }) => {
  // Animación del tag superior (frames 10 a 40)
  const tagOpacity = interpolate(frame, [10, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tagTranslateY = interpolate(frame, [10, 35], [18, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animación del título principal centrado (frames 20 a 55)
  const titleOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleTranslateY = interpolate(frame, [20, 50], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animación de la segunda aparición de texto (subtítulo) (frames 55 a 90)
  const subtitleOpacity = interpolate(frame, [55, 85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const subtitleTranslateY = interpolate(frame, [55, 85], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        zIndex: 2,
      }}
    >
      <div
        style={{
          opacity: tagOpacity,
          transform: `translateY(${tagTranslateY}px)`,
          padding: '6px 18px',
          borderRadius: 9999,
          border: '1px solid #E5E1D8',
          backgroundColor: '#FFFFFF',
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#555148',
          marginBottom: 24,
          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
        }}
      >
        {categoryText}
      </div>

      <h1
        style={{
          opacity: titleOpacity,
          transform: `translateY(${titleTranslateY}px)`,
          fontSize: 66,
          fontWeight: 700,
          letterSpacing: '-0.035em',
          margin: '0 0 16px 0',
          maxWidth: 1240,
          color: '#181715',
          lineHeight: 1.15,
        }}
      >
        {headline}
      </h1>

      <p
        style={{
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleTranslateY}px)`,
          fontSize: 26,
          fontWeight: 400,
          color: '#635F57',
          margin: 0,
          maxWidth: 860,
          lineHeight: 1.5,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
};

/**
 * Composición gráfica animada: Tarjeta de UI editorial interactiva.
 */
const GraphicCard: React.FC<{ frame: number }> = ({ frame }) => {
  // Aparición suave de la tarjeta (frames 85 a 130)
  const cardOpacity = interpolate(frame, [85, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardTranslateY = interpolate(frame, [85, 125], [45, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardScale = interpolate(frame, [85, 125], [0.93, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Progreso determinista de generación (frames 125 a 240)
  const progressPercent = interpolate(frame, [125, 235], [12, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Micro-pulso determinista suave usando frame (sin Math.random)
  const subtleScale = interpolate(
    Math.sin((frame / 30) * Math.PI),
    [-1, 1],
    [0.99, 1.01]
  );

  return (
    <div
      style={{
        opacity: cardOpacity,
        transform: `translateY(${cardTranslateY}px) scale(${cardScale * subtleScale})`,
        width: 840,
        marginTop: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        border: '1px solid #EBE7DF',
        boxShadow:
          '0 30px 70px -15px rgba(24, 23, 21, 0.08), 0 0 1px rgba(0,0,0,0.08)',
        padding: 34,
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        zIndex: 2,
      }}
    >
      {/* Barra superior de ventana */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #F0ECE4',
          paddingBottom: 16,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#E75B4D',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#E7A93D',
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#4EBA5C',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#8C887E',
            letterSpacing: '0.04em',
          }}
        >
          LaunchDemo.remotion — 1920x1080 @ 30 FPS
        </span>
        <div
          style={{
            fontSize: 12,
            padding: '4px 10px',
            backgroundColor: '#EEF6F0',
            color: '#246635',
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          ACTIVO
        </div>
      </div>

      {/* Contenido interactivo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 15,
            fontWeight: 600,
            color: '#3B3833',
          }}
        >
          <span>Sintetizando storyboard determinista</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>

        <div
          style={{
            width: '100%',
            height: 10,
            backgroundColor: '#F3EFEA',
            borderRadius: 9999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: '#1C1B19',
              borderRadius: 9999,
            }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginTop: 8,
          }}
        >
          {[
            { label: 'Captura UI', threshold: 30 },
            { label: 'Motion Graphics', threshold: 65 },
            { label: 'Composición 1080p', threshold: 95 },
          ].map((item) => {
            const isActive = progressPercent >= item.threshold;
            return (
              <div
                key={item.label}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  backgroundColor: isActive ? '#F6F5F1' : '#FAFAF8',
                  border: `1px solid ${isActive ? '#D8D4CC' : '#EFECE6'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: isActive ? '#191816' : '#C5C1B8',
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#1C1B19' : '#8A867E',
                  }}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Composición principal LaunchDemo:
 * - 1920x1080, 30 FPS, duración 10s (300 frames).
 * - Fondo claro con cuadrícula editorial.
 * - Tipografía editorial serif/sans refinada.
 * - Animaciones deterministas con useCurrentFrame e interpolate.
 */
export const LaunchDemo: React.FC<LaunchDemoProps> = ({
  categoryText = 'LaunchMotion • Motion Graphics SaaS',
  headline = 'Transforma capturas en historias visuales',
  subtitle = 'Vídeos promocionales con ritmo, tipografía cinética y fidelidad al producto digital.',
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: '#FAF9F5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Playfair Display', Georgia, serif",
        color: '#181716',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Fondo con textura sutil editorial */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.055) 1px, transparent 0)',
          backgroundSize: '40px 40px',
          opacity: 0.8,
        }}
      />

      <EditorialHeader
        categoryText={categoryText}
        headline={headline}
        subtitle={subtitle}
        frame={frame}
      />

      <GraphicCard frame={frame} />
    </div>
  );
};

