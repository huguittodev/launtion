/**
 * CameraRig.tsx
 * Remotion React container applying perspective and computed zero-drift 3D transforms to children.
 */

import React from 'react';
import { useCurrentFrame } from 'remotion';
import type { CameraKeyframe } from '../../../src/lib/scene-graph/types';
import { calculateCameraTransform } from './CameraTransform';
import { evaluateCameraPath, type CameraState } from './CameraPath';

export interface CameraRigProps {
  cameraTrack?: CameraKeyframe[];
  state?: CameraState;
  frame?: number;
  width?: number;
  height?: number;
  perspective?: number;
  style?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
  children: React.ReactNode;
}

export const CameraRig: React.FC<CameraRigProps> = ({
  cameraTrack,
  state,
  frame: propFrame,
  width = 1920,
  height = 1080,
  perspective = 1200,
  style,
  contentStyle,
  children,
}) => {
  const remotionFrame = useCurrentFrame();
  const currentFrame = propFrame ?? remotionFrame;

  // Resolve camera state either from direct state prop or evaluated along keyframe track
  const resolvedState: CameraState = React.useMemo(() => {
    if (state) {
      return state;
    }
    if (cameraTrack && cameraTrack.length > 0) {
      return evaluateCameraPath(cameraTrack, currentFrame);
    }
    return { x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0, rotateY: 0, rotateZ: 0 };
  }, [state, cameraTrack, currentFrame]);

  // Compute zero-drift transformation matrix
  const transformResult = React.useMemo(() => {
    return calculateCameraTransform({
      viewport: { width, height },
      focalPoint: { x: resolvedState.x, y: resolvedState.y },
      zoom: resolvedState.zoom,
      rotation: {
        rotateX: resolvedState.rotateX ?? 0,
        rotateY: resolvedState.rotateY ?? 0,
        rotateZ: resolvedState.rotateZ ?? 0,
      },
      perspective,
    });
  }, [width, height, resolvedState, perspective]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        perspective: `${perspective}px`,
        perspectiveOrigin: transformResult.perspectiveOrigin,
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transformOrigin: transformResult.transformOrigin,
          transform: transformResult.transform,
          willChange: 'transform',
          ...contentStyle,
        }}
      >
        {children}
      </div>
    </div>
  );
};
