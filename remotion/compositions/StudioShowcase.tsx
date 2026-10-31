import React from 'react';
import { interpolate, Sequence, useCurrentFrame } from 'remotion';
import {
  AudioEngine,
  CameraRig3D,
  DynamicBackdrop,
  IconGridMorph,
  KineticTypography,
  RealCaptureSurface,
  SmartCursor,
  SoundCue,
  SyntheticCodeTree,
  SyntheticConnectPills,
  SyntheticHeroButton,
  SyntheticPromptBox,
} from '../motion-kit';

export interface StudioShowcaseProps {
  productName?: string;
  tagline?: string;
}

/**
 * Escena 3 Mock: Interfaz de SaaS realista (Calendario de Alquileres de Bicicletas)
 * con métricas, sidebar y reservas interactivas (inspirado en Base44 0:17).
 */
const MockSaaSInterface: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        width: 1240,
        height: 680,
        backgroundColor: '#FAF9F5',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
      }}
    >
      {/* Sidebar izquierda */}
      <div
        style={{
          width: 240,
          backgroundColor: '#141413',
          color: '#E5E2DC',
          padding: '24px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: '#FF5C35',
            }}
          />
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Base44 App
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              backgroundColor: '#262523',
              color: '#FFFFFF',
              fontWeight: 600,
            }}
          >
            Dashboard
          </div>
          <div style={{ padding: '8px 12px', color: '#8A867E' }}>Fleet Rentals</div>
          <div style={{ padding: '8px 12px', color: '#8A867E' }}>Route Planning</div>
          <div style={{ padding: '8px 12px', color: '#8A867E' }}>Analytics</div>
          <div style={{ padding: '8px 12px', color: '#8A867E' }}>Settings</div>
        </div>
      </div>

      {/* Contenido principal del dashboard */}
      <div
        style={{
          flex: 1,
          padding: '28px 34px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Encabezado */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #EFEAE1',
            paddingBottom: 16,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#181716',
                margin: 0,
                letterSpacing: '-0.03em',
              }}
            >
              Bike Rental Status
            </h2>
            <span style={{ fontSize: 13, color: '#8A867E' }}>
              Track and plan bike rentals • January 2026
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              backgroundColor: '#ECE7DC',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: '#181716',
            }}
          >
            Today: Jan 26
          </div>
        </div>

        {/* Cuadrícula de calendario y tarjetas de reserva */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 12,
            marginTop: 8,
          }}
        >
          {['22 Mon', '23 Tue', '24 Wed', '25 Thu', '26 Fri', '27 Sat', '28 Sun'].map(
            (day, i) => (
              <div
                key={day}
                style={{
                  padding: '10px 8px',
                  backgroundColor: i === 4 ? '#FFFFFF' : '#F6F4EE',
                  borderRadius: 12,
                  border: i === 4 ? '1.5px solid #FF5C35' : '1px solid #EAE5DB',
                  fontSize: 13,
                  fontWeight: 600,
                  color: i === 4 ? '#FF5C35' : '#555148',
                  textAlign: 'center',
                }}
              >
                {day}
              </div>
            )
          )}
        </div>

        {/* Filas de reservas activas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
          {/* Bloque 1: Objetivo focal del zoom */}
          <div
            id="focal-target-reservation"
            style={{
              padding: '16px 20px',
              borderRadius: 14,
              backgroundColor: '#B7F538', // Verde ácido / lima vibrante estilo Base44
              border: '1.5px solid #9FD929',
              boxShadow: '0 8px 24px rgba(183, 245, 56, 0.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              maxWidth: 420,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#163300',
                  letterSpacing: '-0.02em',
                }}
              >
                James Wilson • Waterfront
              </div>
              <div style={{ fontSize: 12, color: '#275204', fontWeight: 500 }}>
                Tue 23 - Wed 24 • #RR-5634
              </div>
            </div>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                backgroundColor: '#275204',
              }}
            />
          </div>

          {/* Bloque 2 */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 14,
              backgroundColor: '#FFE3A8',
              border: '1px solid #EED08E',
              maxWidth: 380,
              marginLeft: 120,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#5C3800' }}>
              Marcus Johnson • Fort Baker
            </div>
            <div style={{ fontSize: 12, color: '#7D5106' }}>
              Jan 23 - Jan 25 • Summit Rider
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * StudioShowcase:
 * Composición publicitaria completa de nivel Base44 (16s @ 30 FPS = 480 frames),
 * ensamblando todas las primitivas del Motion Kit con sincronización matemática.
 */
export const StudioShowcase: React.FC<StudioShowcaseProps> = ({
  productName = 'Base44',
  tagline = 'Build it your way',
}) => {
  const frame = useCurrentFrame();

  // Registro de disparadores de sonido al fotograma exacto
  const soundCues: SoundCue[] = [
    { frame: 1, sound: 'camera-whoosh', volume: 0.6 },
    { frame: 18, sound: 'soft-pop', volume: 0.7 },
    { frame: 42, sound: 'soft-pop', volume: 0.7 },
    { frame: 76, sound: 'camera-whoosh', volume: 0.6 },
    { frame: 95, sound: 'keyboard-tap', volume: 0.5 },
    { frame: 120, sound: 'keyboard-tap', volume: 0.5 },
    { frame: 148, sound: 'mouse-click', volume: 0.9 },
    { frame: 166, sound: 'camera-whoosh', volume: 0.7 },
    { frame: 225, sound: 'mouse-click', volume: 0.95 },
    { frame: 271, sound: 'chime', volume: 0.75 },
    { frame: 310, sound: 'soft-pop', volume: 0.7 },
    { frame: 346, sound: 'camera-whoosh', volume: 0.8 },
    { frame: 372, sound: 'chime', volume: 0.85 },
    { frame: 421, sound: 'camera-whoosh', volume: 0.7 },
    { frame: 442, sound: 'mouse-click', volume: 0.95 },
    { frame: 456, sound: 'chime', volume: 0.9 },
  ];

  return (
    <div
      style={{
        flex: 1,
        width: 1920,
        height: 1080,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#F4F1EA',
      }}
    >
      {/* Motor de Audio Sincronizado */}
      <AudioEngine
        soundCues={soundCues}
        music={{
          src: 'sfx/ambient-beat.wav',
          volume: 0.32,
          fadeInFrames: 15,
          fadeOutFrames: 30,
        }}
      />

      {/* ========================================================================= */}
      {/* ESCENA 1: Kinetic Typography Intro (Frames 0 a 75)                        */}
      {/* ========================================================================= */}
      <Sequence from={0} durationInFrames={75}>
        <DynamicBackdrop frame={frame} variant="light-editorial" />
        <KineticTypography
          frame={frame}
          words={['Build', 'apps', 'that', 'scale']}
          accentWordIndex={3}
          symbols={['/', '<', '>', '*']}
          startFrame={5}
          staggerFrames={12}
        />
      </Sequence>

      {/* ========================================================================= */}
      {/* ESCENA 2: Synthetic Prompt Box con Aurora Blur (Frames 75 a 165)          */}
      {/* ========================================================================= */}
      <Sequence from={75} durationInFrames={90}>
        <DynamicBackdrop frame={frame} variant="aurora-blur" />
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
          }}
        >
          <SyntheticPromptBox
            frame={frame}
            startFrame={76}
            textToType="I want to build a bike renting app with real-time terrain tracking"
            charsPerFrame={0.88}
          />
        </div>
      </Sequence>

      {/* ========================================================================= */}
      {/* ESCENA 3: 3D Product CameraRig + SmartCursor en UI Real (Frames 165 a 270) */}
      {/* ========================================================================= */}
      <Sequence from={165} durationInFrames={105}>
        <DynamicBackdrop frame={frame} variant="light-editorial" />

        {/* Cámara 3D con interpolación hacia el bloque verde de reserva */}
        <CameraRig3D
          frame={frame}
          startFrame={166}
          transitionFrames={40}
          initial={{ x: 50, y: 50, zoom: 1.0, rotateX: 8, rotateY: -6 }}
          target={{ x: 38, y: 54, zoom: 2.2, rotateX: 0, rotateY: 0 }}
          easingType="smooth"
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RealCaptureSurface windowTitle="Bike Rental Operations — Base44">
              <MockSaaSInterface />
            </RealCaptureSurface>
          </div>
        </CameraRig3D>

        {/* Cursor Inteligente vectorizado que viaja y hace clic en la reserva */}
        <SmartCursor
          frame={frame}
          startFrame={175}
          endFrame={225}
          clickFrame={225}
          start={{ x: 70, y: 75 }}
          target={{ x: 38, y: 54 }}
          size={36}
          showRipple={true}
        />
      </Sequence>

      {/* ========================================================================= */}
      {/* ESCENA 4: Connect Pills & Code Tree (Frames 270 a 345)                    */}
      {/* ========================================================================= */}
      <Sequence from={270} durationInFrames={75}>
        <DynamicBackdrop frame={frame} variant="light-editorial" />
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            gap: 80,
          }}
        >
          <SyntheticConnectPills
            frame={frame}
            startFrame={271}
            sourceText="Connect to"
            targetText="Calendar"
          />

          <SyntheticCodeTree
            frame={frame}
            startFrame={285}
            title="Code Files"
          />
        </div>
      </Sequence>

      {/* ========================================================================= */}
      {/* ESCENA 5: Icon Grid Morph en Modo Oscuro Técnico (Frames 345 a 420)       */}
      {/* ========================================================================= */}
      <Sequence from={345} durationInFrames={75}>
        <DynamicBackdrop frame={frame} variant="dark-precision" />
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            gap: 36,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 650,
              color: '#A19E95',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace",
            }}
          >
            Security Built-In • Safe Every Step
          </div>

          <IconGridMorph
            frame={frame}
            startFrame={346}
            waveStartFrame={14}
            rows={4}
            cols={7}
            initialColor="#EF4444"
            targetColor="#22C55E"
          />
        </div>
      </Sequence>

      {/* ========================================================================= */}
      {/* ESCENA 6: Synthetic Hero Button + Brand Closing CTA (Frames 420 a 480)   */}
      {/* ========================================================================= */}
      <Sequence from={420} durationInFrames={60}>
        <DynamicBackdrop frame={frame} variant="light-editorial" />
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2,
            gap: 28,
          }}
        >
          {/* Frames 420 a 448: Botón Hero aislado con clic */}
          {frame < 448 && (
            <div style={{ position: 'relative' }}>
              <SyntheticHeroButton
                frame={frame}
                startFrame={421}
                clickFrame={442}
                buttonText="Publish"
              />
              <SmartCursor
                frame={frame}
                startFrame={424}
                endFrame={442}
                clickFrame={442}
                start={{ x: 62, y: 64 }}
                target={{ x: 50, y: 50 }}
                size={34}
              />
            </div>
          )}

          {/* Frames 448 a 480: Cierre de marca y llamada a la acción */}
          {frame >= 448 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                transform: `scale(${interpolate(frame - 448, [0, 14], [0.92, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                })})`,
                opacity: interpolate(frame - 448, [0, 8], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {/* Logotipo sol naciente geométrico */}
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'linear-gradient(180deg, #FF7A45 0%, #FF4D1A 100%)',
                  boxShadow: '0 12px 32px rgba(255, 92, 53, 0.38)',
                }}
              />

              <h1
                style={{
                  fontSize: 54,
                  fontWeight: 750,
                  color: '#181716',
                  letterSpacing: '-0.035em',
                  margin: 0,
                  fontFamily:
                    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
                }}
              >
                {productName}
              </h1>

              <div
                style={{
                  padding: '8px 24px',
                  borderRadius: 9999,
                  border: '1.5px solid #FF5C35',
                  backgroundColor: '#FFFFFF',
                  color: '#FF5C35',
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  boxShadow: '0 4px 16px rgba(255, 92, 53, 0.14)',
                }}
              >
                {tagline}
              </div>
            </div>
          )}
        </div>
      </Sequence>
    </div>
  );
};

