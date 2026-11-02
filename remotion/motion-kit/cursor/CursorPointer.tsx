/**
 * CursorPointer.tsx
 * High-fidelity SVG vector cursor with tip hotspot aligned precisely at (0, 0),
 * physical click scale compression, and expanding dynamic ripple shockwave.
 */

import React from 'react';
import { neutral, sceneThemes } from '../../../src/lib/design/tokens';

export interface CursorPointerProps {
  x: number; // Horizontal position (normalized 0-1 or percentage 0-100)
  y: number; // Vertical position (normalized 0-1 or percentage 0-100)
  isNormalized?: boolean; // Default true: x and y in [0, 1]
  clickScale?: number; // Physical click compression scale (e.g. 0.92 during press)
  rippleRadius?: number; // Expanding shockwave radius in pixels
  rippleOpacity?: number; // Shockwave opacity [0, 1]
  size?: number; // Cursor size in pixels (default: 32)
  color?: string; // Fill color (default: neutral.ink)
  accentColor?: string; // Ripple and highlight accent (default: brand accent)
  showRipple?: boolean; // Whether ripple is enabled (default: true)
  showShadow?: boolean; // Whether drop shadows are rendered (default: true)
  style?: React.CSSProperties;
}

export const CursorPointer: React.FC<CursorPointerProps> = ({
  x,
  y,
  isNormalized = true,
  clickScale = 1.0,
  rippleRadius = 0,
  rippleOpacity = 0,
  size = 32,
  color = neutral.ink,
  accentColor = sceneThemes.lightEditorial.accent,
  showRipple = true,
  showShadow = true,
  style,
}) => {
  const posX = isNormalized ? `${x * 100}%` : `${x}%`;
  const posY = isNormalized ? `${y * 100}%` : `${y}%`;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
        ...style,
      }}
    >
      {/* Dynamic Expanding Ripple Shockwave */}
      {showRipple && rippleOpacity > 0 && rippleRadius > 0 && (
        <div
          style={{
            position: 'absolute',
            left: posX,
            top: posY,
            width: rippleRadius * 2,
            height: rippleRadius * 2,
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            border: `2px solid ${accentColor}`,
            backgroundColor: `${accentColor}26`, // ~15% opacity hex
            opacity: rippleOpacity,
            pointerEvents: 'none',
            willChange: 'transform, opacity',
          }}
        />
      )}

      {/* High-Fidelity SVG Vector Cursor */}
      <div
        style={{
          position: 'absolute',
          left: posX,
          top: posY,
          transform: `scale(${clickScale})`,
          transformOrigin: '0 0', // Tip remains pinned at target hotspot during scale compression
          willChange: 'transform, left, top',
          filter: showShadow
            ? 'drop-shadow(0 6px 12px rgba(0, 0, 0, 0.32)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.20))'
            : 'none',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
            macOS precision pointer normalized with tip vertex exactly at (0, 0):
            M 0 0: Tip hotspot
            L 7.5 19: Left bottom barb
            L 10.8 11.8: Inner notch
            L 18 8.5: Right wing
            Z: Close to origin
          */}
          <path
            d="M0 0L7.5 19L10.8 11.8L18 8.5L0 0Z"
            fill={color}
            stroke={neutral.white}
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
