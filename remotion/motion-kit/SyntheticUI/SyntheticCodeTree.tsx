import React from 'react';
import { Easing, interpolate } from 'remotion';

export interface TreeNode {
  label: string;
  isFolder?: boolean;
  indent: number; // 0, 1, 2...
  delay: number; // Frames de desfase para la animación escalonada
}

export interface SyntheticCodeTreeProps {
  frame: number;
  title?: string;
  nodes?: TreeNode[];
  startFrame?: number;
}

const DEFAULT_NODES: TreeNode[] = [
  { label: 'Dashboard', isFolder: false, indent: 1, delay: 6 },
  { label: 'MyRentals', isFolder: false, indent: 1, delay: 14 },
  { label: 'Components', isFolder: true, indent: 2, delay: 22 },
  { label: 'BikeFilters', isFolder: false, indent: 3, delay: 30 },
  { label: 'RouteBuilder', isFolder: false, indent: 3, delay: 36 },
];

/**
 * SyntheticCodeTree:
 * Átomo conceptual que despliega un árbol de archivos de código limpio
 * con animación escalonada y tipografía moderna (estilo Base44 0:10).
 */
export const SyntheticCodeTree: React.FC<SyntheticCodeTreeProps> = ({
  frame,
  title = 'Code Files',
  nodes = DEFAULT_NODES,
  startFrame = 0,
}) => {
  const currentElapsed = Math.max(0, frame - startFrame);

  // Animación del encabezado principal
  const titleOpacity = interpolate(currentElapsed, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleTranslateX = interpolate(currentElapsed, [0, 14], [-20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        userSelect: 'none',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, monospace",
      }}
    >
      {/* Título de raíz */}
      <div
        style={{
          opacity: titleOpacity,
          transform: `translateX(${titleTranslateX}px)`,
          fontSize: 48,
          fontWeight: 650,
          color: '#181716',
          letterSpacing: '-0.03em',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ color: '#88847C', fontSize: 36 }}>▾</span>
        <span>{title}</span>
      </div>

      {/* Nodos hijos escalonados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {nodes.map((node, i) => {
          const nodeElapsed = currentElapsed - node.delay;
          const nodeOpacity = interpolate(nodeElapsed, [0, 10], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const nodeSlide = interpolate(nodeElapsed, [0, 14], [25, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.cubic),
          });

          return (
            <div
              key={i}
              style={{
                opacity: nodeOpacity,
                transform: `translateX(${nodeSlide}px)`,
                marginLeft: node.indent * 42,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontSize: 34,
                fontWeight: node.isFolder ? 600 : 450,
                color: node.isFolder ? '#181716' : '#555148',
                letterSpacing: '-0.02em',
              }}
            >
              {node.isFolder ? (
                <span style={{ color: '#88847C', fontSize: 24 }}>▾</span>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#88847C"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              )}
              <span>{node.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

