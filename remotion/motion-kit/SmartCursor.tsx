/**
 * SmartCursor.tsx
 * Studio-grade cursor component consuming multi-keyframe Bezier cursor tracks
 * with natural human movement arcs, physical click scale compression ([1, 0.92, 1]),
 * and dynamic shockwave ripple, delegating vector rendering to CursorPointer.
 *
 * Fully backwards-compatible with legacy two-point props (start, target, startFrame, endFrame, clickFrame).
 */

import React from 'react';
import { Easing, interpolate } from 'remotion';
import { interpolateCursorTrack, type Point2D } from './cursor/BezierPath';
import { CursorPointer } from './cursor/CursorPointer';
import type { CursorKeyframe } from '../../src/lib/scene-graph/types';

export * from './cursor/BezierPath';
export * from './cursor/CursorPointer';
export type { Point2D };

export interface SmartCursorProps {
  frame: number;

  // SceneGraph Track-Driven Mode (Milestone 2 & 3)
  cursorTrack?: CursorKeyframe[];
  track?: CursorKeyframe[]; // Convenience alias

  // Legacy Two-Point Mode (Backwards Compatibility)
  start?: Point2D;
  target?: Point2D;
  startFrame?: number;
  endFrame?: number;
  clickFrame?: number;

  // Presentation & Styling
  size?: number;
  color?: string;
  accentColor?: string;
  showRipple?: boolean;
}

export const SmartCursor: React.FC<SmartCursorProps> = ({
  frame,
  cursorTrack,
  track,
  start,
  target,
  startFrame = 0,
  endFrame = 30,
  clickFrame,
  size = 32,
  color = '#181716',
  accentColor = '#FF5C35',
  showRipple = true,
}) => {
  // Resolve keyframe track
  const effectiveTrack: CursorKeyframe[] = React.useMemo(() => {
    if (cursorTrack && cursorTrack.length > 0) return cursorTrack;
    if (track && track.length > 0) return track;

    // Build synthetic track from legacy props
    if (start && target) {
      // If coordinates are given in 0-100 percentage range, normalize to 0-1
      const isStartPct = start.x > 1.0 || start.y > 1.0;
      const normStart = isStartPct
        ? { x: start.x / 100, y: start.y / 100 }
        : { x: start.x, y: start.y };

      const isTargetPct = target.x > 1.0 || target.y > 1.0;
      const normTarget = isTargetPct
        ? { x: target.x / 100, y: target.y / 100 }
        : { x: target.x, y: target.y };

      const mx = (normStart.x + normTarget.x) / 2;
      const my = (normStart.y + normTarget.y) / 2;
      const dx = normTarget.x - normStart.x;
      const dy = normTarget.y - normStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Biomechanical upward curve
      const nx = -dy / (dist || 1);
      const ny = dx / (dist || 1);
      const offset = 0.18 * dist;
      const c1 = { x: mx + nx * offset, y: my + ny * offset };
      const c2 = { x: mx - nx * offset, y: my - ny * offset };
      const chosen = c1.y <= c2.y ? c1 : c2;

      return [
        { frame: startFrame, x: normStart.x, y: normStart.y },
        {
          frame: endFrame,
          x: normTarget.x,
          y: normTarget.y,
          controlX: chosen.x,
          controlY: chosen.y,
          click: clickFrame !== undefined,
        },
      ];
    }

    return [{ frame: 0, x: 0.5, y: 0.5 }];
  }, [cursorTrack, track, start, target, startFrame, endFrame, clickFrame]);

  // Interpolate state along Bezier path
  const state = interpolateCursorTrack(effectiveTrack, frame);

  // Click physics: scale compression [1, 0.92, 1]
  let clickScale = 1.0;
  let rippleRadius = 0;
  let rippleOpacity = 0;

  if (state.isClickActive && state.clickElapsed >= 0) {
    const elapsed = state.clickElapsed;

    // Physical compression: [1, 0.92, 1] over 6 frames
    clickScale = interpolate(elapsed, [0, 2, 6], [1.0, 0.92, 1.0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    if (showRipple) {
      // Dynamic expanding ripple
      rippleRadius = interpolate(elapsed, [0, 16], [4, 46], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      });

      rippleOpacity = interpolate(elapsed, [0, 14], [0.70, 0.0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }

  return (
    <CursorPointer
      x={state.x}
      y={state.y}
      isNormalized={true}
      clickScale={clickScale}
      rippleRadius={rippleRadius}
      rippleOpacity={rippleOpacity}
      size={size}
      color={color}
      accentColor={accentColor}
      showRipple={showRipple}
    />
  );
};
