import React from 'react';
import { Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export interface SoundCue {
  frame: number;
  sound: string; // ej: 'mouse-click', 'soft-pop', 'camera-whoosh', 'chime', 'keyboard-tap'
  volume?: number;
}

export interface BackgroundMusicConfig {
  src?: string;
  volume?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;
}

export interface AudioEngineProps {
  soundCues?: SoundCue[];
  music?: BackgroundMusicConfig;
  enabled?: boolean;
}

/**
 * AudioEngine:
 * Motor de mezcla de sonido determinista:
 * 1. Pista musical continua con fundidos suaves (fade in / fade out).
 * 2. Efectos sonoros (SFX) disparados en el fotograma exacto del evento visual.
 */
export const AudioEngine: React.FC<AudioEngineProps> = ({
  soundCues = [],
  music,
  enabled = true,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (!enabled) return null;

  // Cálculo de volumen musical con fade in / fade out determinista
  const targetVolume = music?.volume ?? 0.35;
  const fadeIn = music?.fadeInFrames ?? 15;
  const fadeOut = music?.fadeOutFrames ?? 30;

  const musicVolume = interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
    [0, targetVolume, targetVolume, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <>
      {/* Pista continua de fondo */}
      {music?.src && (
        <Audio
          src={staticFile(music.src)}
          volume={musicVolume}
        />
      )}

      {/* Efectos de sonido sincronizados por fotograma */}
      {soundCues.map((cue, index) => {
        // Formateo seguro de ruta a sfx
        const soundPath = cue.sound.endsWith('.wav') || cue.sound.endsWith('.mp3')
          ? cue.sound
          : `sfx/${cue.sound}.wav`;

        return (
          <Sequence
            key={`${cue.frame}-${cue.sound}-${index}`}
            from={cue.frame}
            durationInFrames={45}
          >
            <Audio
              src={staticFile(soundPath)}
              volume={cue.volume ?? 0.8}
            />
          </Sequence>
        );
      })}
    </>
  );
};

