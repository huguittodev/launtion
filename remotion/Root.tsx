import React from 'react';
import { Composition } from 'remotion';
import { LaunchDemo } from './compositions/LaunchDemo';

export const Root: React.FC = () => {
  return (
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
  );
};
