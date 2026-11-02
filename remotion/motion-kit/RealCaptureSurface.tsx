import React from 'react';
import { OffthreadVideo, Img } from 'remotion';
import type { MotionArchetype } from '../../src/lib/scene-graph/types';
import { neutral, sceneThemes, signal } from '../../src/lib/design/tokens';

export type MediaType = 'video' | 'image' | null;

/**
 * Resolves media classification ('video' | 'image' | null) from a URL, blob URI, or data URI.
 * Detects:
 * - Video formats: .mp4, .webm, .mov, .m4v, data:video/mp4, data:video/webm, data:video/
 * - Image formats: .png, .jpg, .jpeg, .webp, .svg, .gif, data:image/
 */
export function resolveMediaType(url?: string | null): MediaType {
  if (!url || typeof url !== 'string') {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Data URIs
  if (trimmed.startsWith('data:video/')) {
    return 'video';
  }
  if (trimmed.startsWith('data:image/')) {
    return 'image';
  }

  // 2. Blob URIs with MIME / format indicators
  if (trimmed.startsWith('blob:')) {
    const lower = trimmed.toLowerCase();
    if (lower.includes('video') || lower.endsWith('.mp4') || lower.endsWith('.webm')) {
      return 'video';
    }
    if (
      lower.includes('image') ||
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp')
    ) {
      return 'image';
    }
  }

  // 3. URLs and file paths (strip query strings and hash anchors)
  const cleanUrl = trimmed.split('?')[0].split('#')[0].toLowerCase();

  // Video extensions
  if (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.m4v')
  ) {
    return 'video';
  }

  // Image extensions
  if (
    cleanUrl.endsWith('.png') ||
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg') ||
    cleanUrl.endsWith('.webp') ||
    cleanUrl.endsWith('.svg') ||
    cleanUrl.endsWith('.gif')
  ) {
    return 'image';
  }

  // Fallback regex matching extension before query/hash
  if (/\.(mp4|webm|mov|m4v)($|\?|#)/i.test(trimmed)) {
    return 'video';
  }
  if (/\.(png|jpe?g|webp|svg|gif)($|\?|#)/i.test(trimmed)) {
    return 'image';
  }

  return null;
}

export interface RealCaptureSurfaceProps {
  children?: React.ReactNode;
  mediaUrl?: string | null;
  url?: string | null;
  mediaType?: 'video' | 'image' | null;
  windowTitle?: string;
  showControls?: boolean;
  width?: number | string;
  height?: number | string;
  archetype?: MotionArchetype;
  accentColor?: string;
  style?: React.CSSProperties;
}

/**
 * RealCaptureSurface:
 * Marco de ventana limpio y refinado para capturas o clips de software real
 * con bordes curvos, barra de aplicación y sombra multicapa difusa.
 * Soporta incrustación directa de vídeos (<OffthreadVideo>) e imágenes (<Img>)
 * con soporte para los 4 arquetipos visuales o fallback a componentes interactivos hijos.
 */
export const RealCaptureSurface: React.FC<RealCaptureSurfaceProps> = ({
  children,
  mediaUrl,
  url,
  mediaType,
  windowTitle = 'Dashboard — Analytics & Workflows',
  showControls = true,
  width = 1240,
  height = 'auto',
  archetype = 'base44-studio',
  accentColor = sceneThemes.lightEditorial.accent,
  style,
}) => {
  const targetUrl = mediaUrl || url;
  const resolvedType = mediaType || resolveMediaType(targetUrl);

  const isLinearDark = archetype === 'linear-dark';
  const surfaceBg = isLinearDark
    ? sceneThemes.darkPrecision.surface
    : sceneThemes.lightEditorial.surface;
  const borderColor = isLinearDark
    ? sceneThemes.darkPrecision.border
    : sceneThemes.lightEditorial.border;
  const glowColor = accentColor ?? signal.indigo;
  const shadow = isLinearDark
    ? `0 0 0 1px ${glowColor}4D, 0 0 35px ${glowColor}2E, 0 32px 85px rgba(0, 0, 0, 0.85)`
    : '0 32px 85px -15px rgba(24, 23, 21, 0.14), 0 0 1px rgba(0, 0, 0, 0.12)';
  const headerBg = isLinearDark
    ? sceneThemes.darkPrecision.surfaceRaised
    : sceneThemes.lightEditorial.surfaceRaised;
  const headerBorder = isLinearDark
    ? sceneThemes.darkPrecision.divider
    : neutral.borderAlt;
  const headerText = isLinearDark
    ? sceneThemes.darkPrecision.textSecondary
    : neutral.textSubtle;

  let content = children;
  if (targetUrl && resolvedType) {
    if (resolvedType === 'video') {
      content = (
        <OffthreadVideo
          src={targetUrl}
          volume={0}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      );
    } else if (resolvedType === 'image') {
      content = (
        <Img
          src={targetUrl}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      );
    }
  }

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 20,
        backgroundColor: surfaceBg,
        border: `1px solid ${borderColor}`,
        boxShadow: shadow,
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
            backgroundColor: headerBg,
            borderBottom: `1px solid ${headerBorder}`,
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
                backgroundColor: signal.trafficRed,
              }}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                backgroundColor: signal.trafficAmber,
              }}
            />
            <div
              style={{
                width: 11,
                height: 11,
                borderRadius: '50%',
                backgroundColor: signal.trafficGreen,
              }}
            />
          </div>

          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: headerText,
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
      <div
        style={{
          flex: 1,
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {content}
      </div>
    </div>
  );
};

