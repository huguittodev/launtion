import React from 'react';

export interface RealCaptureSurfaceProps {
  children?: React.ReactNode;
  windowTitle?: string;
  showControls?: boolean;
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}

/**
 * RealCaptureSurface:
 * Marco de ventana limpio y refinado para capturas o clips de software real
 * con bordes curvos, barra de aplicación y sombra multicapa difusa.
 */
export const RealCaptureSurface: React.FC<RealCaptureSurfaceProps> = ({
  children,
  windowTitle = 'Dashboard — Analytics & Workflows',
  showControls = true,
  width = 1240,
  height = 'auto',
  style,
}) => {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        border: '1px solid #ECE7DE',
        boxShadow:
          '0 32px 85px -15px rgba(24, 23, 21, 0.14), 0 0 1px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* Barra de título minimalista */}
      {showControls && (
        <div
          style={{
            height: 44,
            backgroundColor: '#FBF9F5',
            borderBottom: '1px solid #EFEAE1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 18px',
            userSelect: 'none',
          }}
        >
          {/* Puntos de control macOS */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                backgroundColor: '#E75B4D',
              }}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                backgroundColor: '#E7A93D',
              }}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                backgroundColor: '#4EBA5C',
              }}
            />
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: '#8A867E',
              letterSpacing: '0.02em',
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            {windowTitle}
          </span>

          <div style={{ width: 40 }} />
        </div>
      )}

      {/* Contenido de interfaz */}
      <div style={{ flex: 1, position: 'relative' }}>{children}</div>
    </div>
  );
};

