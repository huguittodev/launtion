/**
 * CameraRig3D.tsx
 * Backwards-compatible facade for legacy compositions (e.g. StudioShowcase).
 * Delegates rendering and physics directly to the atomic Camera Engine.
 */

import React from 'react';
import { Easing, interpolate } from 'remotion';
import { CameraRig } from './camera/CameraRig';
import type { CameraState } from './camera/CameraPath';

export type { CameraState };
export * from './camera/CameraTransform';
export * from './camera/FocalTracker';
export * from './camera/CameraPath';
export * from './camera/CameraRig';

export interface CameraRig3DProps {
  frame: number;
  initial: CameraState;
  target?: CameraState;
  startFrame?: number;
  transitionFrames?: number;
  perspective?: number;
  easingType?: 'cubic' | 'spring' | 'smooth';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const CameraRig3D: React.FC<CameraRig3DProps> = ({
  frame,
  initial,
  target,
  startFrame = 0,
  transitionFrames = 30,
  perspective = 1200,
  easingType = 'cubic',
  children,
  style,
}) => {
  const endFrame = startFrame + Math.max(1, transitionFrames);

  const getLegacyEasing = () => {
    switch (easingType) {
      case 'smooth':
        return Easing.bezier(0.25, 0.1, 0.25, 1);
      case 'spring':
        return Easing.bezier(0.175, 0.885, 0.32, 1.15);
      case 'cubic':
      default:
        return Easing.out(Easing.cubic);
    }
  };

  const progress = target
    ? interpolate(frame, [startFrame, endFrame], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: getLegacyEasing(),
      })
    : 0;

  // Auto-normalize percentage coordinates [0, 100] -> [0.0, 1.0]
  const initX = initial.x > 1.0 ? initial.x / 100 : initial.x;
  const initY = initial.y > 1.0 ? initial.y / 100 : initial.y;
  const tgtX = target ? (target.x > 1.0 ? target.x / 100 : target.x) : initX;
  const tgtY = target ? (target.y > 1.0 ? target.y / 100 : target.y) : initY;

  const currentX = initX + (tgtX - initX) * progress;
  const currentY = initY + (tgtY - initY) * progress;
  const currentZoom =
    initial.zoom + ((target?.zoom ?? initial.zoom) - initial.zoom) * progress;

  const currentRotateX =
    (initial.rotateX ?? 0) +
    ((target?.rotateX ?? initial.rotateX ?? 0) - (initial.rotateX ?? 0)) * progress;
  const currentRotateY =
    (initial.rotateY ?? 0) +
    ((target?.rotateY ?? initial.rotateY ?? 0) - (initial.rotateY ?? 0)) * progress;
  const currentRotateZ =
    (initial.rotateZ ?? 0) +
    ((target?.rotateZ ?? initial.rotateZ ?? 0) - (initial.rotateZ ?? 0)) * progress;

  const currentState: CameraState = {
    x: currentX,
    y: currentY,
    zoom: currentZoom,
    rotateX: currentRotateX,
    rotateY: currentRotateY,
    rotateZ: currentRotateZ,
  };

  return (
    <CameraRig
      state={currentState}
      frame={frame}
      perspective={perspective}
      style={style}
    >
      {children}
    </CameraRig>
  );
};
