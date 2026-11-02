import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import {
  InteractiveSurfaceDemo,
  defaultSceneGraph,
  defaultVerticalSceneGraph,
  type InteractiveSurfaceDemoProps,
} from './compositions/InteractiveSurfaceDemo';
import { LaunchDemo } from './compositions/LaunchDemo';
import { StudioShowcase } from './compositions/StudioShowcase';
import { VidiauraShowcase } from './compositions/VidiauraShowcase';

const calculateInteractiveSurfaceMetadata: CalculateMetadataFunction<InteractiveSurfaceDemoProps> = ({
  props,
}) => {
  const canvas = props.sceneGraph?.canvas;
  return {
    width: canvas?.width ?? 1920,
    height: canvas?.height ?? 1080,
    fps: canvas?.fps ?? 30,
    durationInFrames: canvas?.durationInFrames ?? 480,
    props,
  };
};

const calculateVerticalMetadata: CalculateMetadataFunction<InteractiveSurfaceDemoProps> = ({
  props,
}) => {
  const canvas = props.sceneGraph?.canvas;
  return {
    width: canvas?.width ?? 1080,
    height: canvas?.height ?? 1920,
    fps: canvas?.fps ?? 30,
    durationInFrames: canvas?.durationInFrames ?? 480,
    props,
  };
};

export const Root: React.FC = () => {
  return (
    <>
      {/* Primary Data-Driven Showcase Composition (16:9 Horizontal with dynamic calculateMetadata) */}
      <Composition
        id="InteractiveSurfaceDemo"
        component={InteractiveSurfaceDemo}
        durationInFrames={480} // 16 segundos a 30 FPS
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          sceneGraph: defaultSceneGraph,
        }}
        calculateMetadata={calculateInteractiveSurfaceMetadata}
      />

      {/* Primary Data-Driven Showcase Composition (9:16 Vertical for Mobile Reels) */}
      <Composition
        id="InteractiveSurfaceDemo-Vertical"
        component={InteractiveSurfaceDemo}
        durationInFrames={480} // 16 segundos a 30 FPS
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          sceneGraph: defaultVerticalSceneGraph,
        }}
        calculateMetadata={calculateVerticalMetadata}
      />

      {/* Reference film (M3): 11 shots placed by the deterministic layout engine */}
      <Composition
        id="VidiauraShowcase"
        component={VidiauraShowcase}
        durationInFrames={480}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          productName: 'Vidiaura',
          tagline: 'Motion graphics, on brief.',
          website: 'vidiaura.com',
        }}
      />

      {/* Composición Publicitaria Estudio v2 — Motion Kit (Nivel Base44) */}      <Composition
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

