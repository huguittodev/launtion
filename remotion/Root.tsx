import React from 'react';
import { Composition } from 'remotion';
import { LaunchDemo } from './compositions/LaunchDemo';
import { StudioShowcase } from './compositions/StudioShowcase';

export const Root: React.FC = () => {
  return (
    <>
      {/* Composición Publicitaria Estudio v2 — Motion Kit (Nivel Base44) */}
      <Composition
        id="StudioShowcase"
        component={StudioShowcase}
        durationInFrames={480} // 16 segundos a 30 FPS
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          productName: 'Base44',
          tagline: 'Build it your way',
        }}
      />

      {/* Composición Editorial Legacy */}
      <Composition
        id="LaunchDemo"
        component={LaunchDemo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          categoryText: 'LaunchMotion • Motion Graphics SaaS',
          headline: 'Transforma capturas en historias visuales',
          subtitle:
            'Vídeos promocionales con ritmo, tipografía cinética y fidelidad al producto digital.',
        }}
      />
    </>
  );
};
