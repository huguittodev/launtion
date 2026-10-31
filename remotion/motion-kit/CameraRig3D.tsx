import React from 'react';
import { Easing, interpolate } from 'remotion';

export interface CameraState {
  x: number; // Porcentaje 0 - 100 del foco horizontal
  y: number; // Porcentaje 0 - 100 del foco vertical
  zoom: number; // Escala (ej. 1.0 = normal, 2.2 = zoom profundo)
  rotateX?: number; // Inclinación en X (grados, ej. 8)
  rotateY?: number; // Inclinación en Y (grados, ej. -5)
  rotateZ?: number; // Rotación en Z (grados)
}

export interface CameraRig3DProps {
  frame: number;
  initial: CameraState;
  target?: CameraState;
  startFrame?: number;
  transitionFrames?: number;
  perspective?: number; // Perspectiva CSS en px (por defecto 1200)
  easingType?: 'cubic' | 'spring' | 'smooth';
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * CameraRig3D:
 * Primitiva de estudio para mover la cámara con perspectiva 3D real,
 * rotación física e interpolación precisa hacia puntos focales (x, y).
 */
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
  // Si no hay target definido, la cámara se mantiene estática en initial
  const endFrame = startFrame + Math.max(1, transitionFrames);

  const getEasing = () => {
    switch (easingType) {
      case 'smooth':
        return Easing.bezier(0.25, 0.1, 0.25, 1);
      case 'spring':
        return Easing.bezier(0.175, 0.885, 0.32, 1.15); // Suave efecto muelle sin oscilación descontrolada
      case 'cubic':
      default:
        return Easing.out(Easing.cubic);
    }
  };

  const progress = target
    ? interpolate(frame, [startFrame, endFrame], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: getEasing(),
      })
    : 0;

  const currentX = initial.x + ((target?.x ?? initial.x) - initial.x) * progress;
  const currentY = initial.y + ((target?.y ?? initial.y) - initial.y) * progress;
  const currentZoom =
    initial.zoom + ((target?.zoom ?? initial.zoom) - initial.zoom) * progress;

  const currentRotateX =
    (initial.rotateX ?? 0) +
    ((target?.rotateX ?? initial.rotateX ?? 0) - (initial.rotateX ?? 0)) *
      progress;

  const currentRotateY =
    (initial.rotateY ?? 0) +
    ((target?.rotateY ?? initial.rotateY ?? 0) - (initial.rotateY ?? 0)) *
      progress;

  const currentRotateZ =
    (initial.rotateZ ?? 0) +
    ((target?.rotateZ ?? initial.rotateZ ?? 0) - (initial.rotateZ ?? 0)) *
      progress;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        perspective: `${perspective}px`,
        perspectiveOrigin: '50% 50%',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transformOrigin: `${currentX}% ${currentY}%`,
          transform: `scale(${currentZoom}) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg) rotateZ(${currentRotateZ}deg)`,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
};

