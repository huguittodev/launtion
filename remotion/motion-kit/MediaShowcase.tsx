import React from 'react';
import { Img, Video, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { alpha, neutral, signal } from '../../src/lib/design/tokens';

export interface MediaShowcaseProps {
  mediaUrl: string;
  mediaType?: 'image' | 'video';
  headline?: string;
  tagline?: string;
  zoomScale?: number;
  panDirection?: 'none' | 'left' | 'right' | 'up' | 'down';
  accentColor?: string;
  isDark?: boolean;
  frame?: number;
}

/**
 * MediaShowcase:
 * Atomic Remotion component rendering user screenshots or video recordings
 * with cinematic camera motion (Ken Burns zoom & smooth pan), 3D window frame,
 * dynamic drop shadow, and floating accent badges.
 */
export const MediaShowcase: React.FC<MediaShowcaseProps> = ({
  mediaUrl,
  mediaType = 'image',
  headline,
  tagline,
  zoomScale = 1.15,
  panDirection = 'none',
  accentColor = signal.orange,
  isDark = true,
  frame: frameProp,
}) => {
  const currentFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frameProp ?? currentFrame;

  // Window entrance spring
  const enterSpring = spring({
    frame: f,
    fps,
    config: { damping: 14, stiffness: 85 },
  });

  // Smooth cinematic Ken Burns zoom: 1.0 -> zoomScale over 120 frames
  const zoom = interpolate(f, [0, 120], [1.0, zoomScale], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Smooth panning
  const panX = interpolate(
    f,
    [0, 120],
    [0, panDirection === 'left' ? -25 : panDirection === 'right' ? 25 : 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const panY = interpolate(
    f,
    [0, 120],
    [0, panDirection === 'up' ? -20 : panDirection === 'down' ? 20 : 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Floating badge entrance with delay
  const badgeSpring = spring({
    frame: Math.max(0, f - 18),
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const isVideo =
    mediaType === 'video' ||
    mediaUrl.endsWith('.mp4') ||
    mediaUrl.endsWith('.webm') ||
    mediaUrl.startsWith('data:video/');

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: 40,
        boxSizing: 'border-box',
      }}
    >
      {/* Top Headline if provided */}
      {headline && (
        <div
          style={{
            marginBottom: 24,
            fontSize: 32,
            fontWeight: 750,
            color: isDark ? neutral.white : neutral.ink,
            letterSpacing: '-0.02em',
            textAlign: 'center',
            opacity: enterSpring,
            transform: `translateY(${interpolate(enterSpring, [0, 1], [-20, 0])}px)`,
          }}
        >
          {headline}
        </div>
      )}

      {/* Modern Mac-style / Studio Frame Container */}
      <div
        style={{
          width: '88%',
          maxWidth: 1200,
          aspectRatio: '16 / 9.5',
          borderRadius: 20,
          backgroundColor: isDark ? neutral.nightRaised : neutral.white,
          border: isDark ? `1px solid ${alpha.white12}` : `1px solid ${neutral.border}`,
          boxShadow: `0 30px 90px rgba(0,0,0,0.35), 0 0 40px ${accentColor}18`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: enterSpring,
          transform: `scale(${interpolate(enterSpring, [0, 1], [0.92, 1])})`,
          position: 'relative',
        }}
      >
        {/* Window Title Bar with macOS dots */}
        <div
          style={{
            height: 38,
            backgroundColor: isDark ? neutral.night : neutral.well,
            borderBottom: isDark ? `1px solid ${alpha.white06}` : `1px solid ${neutral.borderAlt}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            gap: 8,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: signal.trafficRed }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: signal.trafficAmber }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: signal.trafficGreen }} />
          <span
            style={{
              marginLeft: 'auto',
              marginRight: 'auto',
              fontSize: 12,
              fontWeight: 500,
              color: neutral.textSubtle,
            }}
          >
            {tagline ?? 'Product Interface Preview'}
          </span>
        </div>

        {/* Media Canvas Area with cinematic transform */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: isDark ? neutral.void : neutral.shell,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isVideo ? (
              <Video
                src={mediaUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            ) : (
              <Img
                src={mediaUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
          </div>

          {/* Floating Feature Spotlight Badge */}
          {tagline && (
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                right: 28,
                padding: '10px 20px',
                borderRadius: 9999,
                backgroundColor: isDark ? 'rgba(20, 20, 24, 0.88)' : 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(12px)',
                border: `1.5px solid ${accentColor}`,
                boxShadow: `0 12px 30px ${accentColor}30`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: isDark ? neutral.white : neutral.ink,
                fontSize: 14,
                fontWeight: 650,
                opacity: badgeSpring,
                transform: `translateY(${interpolate(badgeSpring, [0, 1], [15, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: accentColor,
                }}
              />
              <span>{tagline}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
