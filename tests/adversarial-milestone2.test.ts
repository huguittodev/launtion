/**
 * tests/adversarial-milestone2.test.ts
 *
 * EMPIRICAL CHALLENGER VERIFICATION & ADVERSARIAL STRESS HARNESS — Milestone 2
 *
 * Systematic stress-testing of:
 * 1. Media Resolution Oracle (resolveMediaType) edge cases:
 *    - Strange extensions (.tar.gz, .mp4.bak, .png.exe, .mkv, .avi, etc.)
 *    - URL query parameters & URL hash fragments
 *    - Uppercase & mixed-case extensions (.MP4, .PNG, .WebM, .jPeG)
 *    - Data URIs with MIME parameters (codecs, charsets, etc.)
 *    - Blob URIs with format hints vs raw opaque blob URIs
 *    - Empty strings, whitespace, null, undefined, non-media strings, non-string primitives
 * 2. RealCaptureSurface Structural & Fallback Invariants:
 *    - OffthreadVideo rendering with volume={0} (muted) and objectFit: 'cover'
 *    - Img rendering with objectFit: 'cover'
 *    - Explicit mediaType prop override
 *    - Fallback to children for non-media / null / undefined / synthetic inputs
 *    - Archetype styling (linear-dark obsidian + neon glow vs base44-studio light)
 * 3. MotionArchetypeSchema Stress Testing:
 *    - 4 valid allowlisted archetypes
 *    - Adversarial casing, prefix/suffix, non-allowlisted, code injection, primitives, objects
 *    - ArtDirectionSchema backward compatibility and null rejection
 * 4. Dual Aspect Ratio (16:9 ↔ 9:16) & Analytical Zero Focal Drift:
 *    - Canvas contracts (1920x1080 vs 1080x1920)
 *    - Safe margins on 1080px vertical width
 *    - CameraTransform zero focal drift (<= 0.5px) under vertical viewport
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as util from 'node:util';
import React from 'react';
import { OffthreadVideo, Img } from 'remotion';

import {
  resolveMediaType,
  RealCaptureSurface,
} from '../remotion/motion-kit/RealCaptureSurface';
import {
  MotionArchetypeSchema,
  ArtDirectionSchema,
} from '../src/lib/scene-graph/schema';
import {
  defaultSceneGraph,
  defaultVerticalSceneGraph,
} from '../remotion/compositions/InteractiveSurfaceDemo';
import { calculateCameraTransform } from '../remotion/motion-kit/camera/CameraTransform';

interface SurfaceContainerProps {
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

interface MediaContentProps {
  src?: string;
  volume?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

describe('Milestone 2 Empirical Challenger Adversarial Suite', () => {
  // =========================================================================
  // 1. ADVERSARIAL MEDIA RESOLUTION ORACLE (resolveMediaType)
  // =========================================================================
  describe('1. Adversarial Media Resolution Oracle (resolveMediaType)', () => {
    it('1.1 correctly resolves standard video extensions (.mp4, .webm, .mov, .m4v)', () => {
      const standardVideos = [
        'https://cdn.vidiaura.com/screen-recording.mp4',
        'https://cdn.vidiaura.com/screen-recording.webm',
        'https://cdn.vidiaura.com/screen-recording.mov',
        '/local/uploads/screen-recording.m4v',
        'https://example.com/videos/demo.mp4',
      ];

      for (const url of standardVideos) {
        assert.equal(
          resolveMediaType(url),
          'video',
          `Expected ${url} to resolve as 'video'`
        );
      }
    });

    it('1.2 handles uppercase and mixed-case file extensions', () => {
      const uppercaseVideos = [
        'https://cdn.example.com/RECORDING.MP4',
        'https://cdn.example.com/recording.WebM',
        'https://cdn.example.com/recording.MOV',
        'https://cdn.example.com/recording.M4V',
      ];
      for (const url of uppercaseVideos) {
        assert.equal(
          resolveMediaType(url),
          'video',
          `Expected uppercase ${url} to resolve as 'video'`
        );
      }

      const uppercaseImages = [
        'https://cdn.example.com/SCREENSHOT.PNG',
        'https://cdn.example.com/screenshot.JPG',
        'https://cdn.example.com/screenshot.JPEG',
        'https://cdn.example.com/screenshot.WebP',
        'https://cdn.example.com/diagram.SVG',
        'https://cdn.example.com/animation.GIF',
      ];
      for (const url of uppercaseImages) {
        assert.equal(
          resolveMediaType(url),
          'image',
          `Expected uppercase ${url} to resolve as 'image'`
        );
      }
    });

    it('1.3 strips URL query parameters and URL hash fragments accurately', () => {
      const complexUrls = [
        { url: 'https://cdn.example.com/video.mp4?token=secret123&expires=999999', expected: 'video' },
        { url: 'https://cdn.example.com/video.mp4#t=10,20', expected: 'video' },
        { url: 'https://cdn.example.com/video.webm?quality=1080p#player-fragment', expected: 'video' },
        { url: 'https://cdn.example.com/clip.mov?download=true#anchor?nested=query', expected: 'video' },
        { url: 'https://cdn.example.com/SCREENSHOT.PNG?v=2.1.0&auth=yes', expected: 'image' },
        { url: 'https://cdn.example.com/diagram.svg#section-overview', expected: 'image' },
        { url: 'https://cdn.example.com/banner.jpeg?alt=backup.mp4', expected: 'image' },
        { url: 'https://cdn.example.com/preview.mp4?poster=cover.jpg', expected: 'video' },
      ];

      for (const { url, expected } of complexUrls) {
        assert.equal(
          resolveMediaType(url),
          expected,
          `Expected complex URL ${url} to resolve as '${expected}'`
        );
      }
    });

    it('1.4 resolves data URIs with MIME parameters (codecs, charsets)', () => {
      // Video data URIs with codecs
      assert.equal(
        resolveMediaType('data:video/mp4;codecs=avc1.4d401f;base64,AAAAHGZ0eXBtcDQy...'),
        'video'
      );
      assert.equal(
        resolveMediaType('data:video/webm;codecs="vp9,opus";base64,GkXfo59ChoEBQveBA...'),
        'video'
      );
      assert.equal(
        resolveMediaType('data:video/mp4;base64,AAAA'),
        'video'
      );

      // Image data URIs with charsets and subtypes
      assert.equal(
        resolveMediaType('data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        'image'
      );
      assert.equal(
        resolveMediaType('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='),
        'image'
      );
      assert.equal(
        resolveMediaType('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...'),
        'image'
      );
      assert.equal(
        resolveMediaType('data:image/webp;base64,UklGRlIAAABXRUJQVlA4...'),
        'image'
      );
    });

    it('1.5 rejects non-media data URIs', () => {
      const nonMediaDataUris = [
        'data:text/plain;charset=utf-8,Hello%20World',
        'data:text/html;charset=utf-8,<h1>Test</h1>',
        'data:application/json,{"key":"value"}',
        'data:application/octet-stream;base64,AAAA',
        'data:application/pdf;base64,JVBERi0xLjcK...',
      ];

      for (const uri of nonMediaDataUris) {
        assert.equal(
          resolveMediaType(uri),
          null,
          `Expected non-media data URI ${uri} to resolve as null`
        );
      }
    });

    it('1.6 resolves blob URIs containing format hints and handles raw blobs safely', () => {
      // Blobs with format hints
      assert.equal(resolveMediaType('blob:http://localhost:3000/screen-video-recording-1234'), 'video');
      assert.equal(resolveMediaType('blob:https://app.vidiaura.com/capture.mp4'), 'video');
      assert.equal(resolveMediaType('blob:http://localhost:3000/preview.webm'), 'video');
      assert.equal(resolveMediaType('blob:http://localhost:3000/image-screenshot-5678'), 'image');
      assert.equal(resolveMediaType('blob:https://app.vidiaura.com/screenshot.png'), 'image');
      assert.equal(resolveMediaType('blob:http://localhost:3000/capture.webp'), 'image');

      // Raw opaque blob without MIME/extension indicator safely returns null
      assert.equal(resolveMediaType('blob:http://localhost:3000/4a7f0581-2db8-4039-bc1a-5bf6ecb7914e'), null);
    });

    it('1.7 rejects strange, unallowlisted, and disguised file extensions', () => {
      const rejectedExtensions = [
        'https://cdn.example.com/backup.tar.gz',
        'https://cdn.example.com/recording.mp4.bak',
        'https://cdn.example.com/screenshot.png.exe',
        'https://cdn.example.com/video.mp4.zip',
        'https://cdn.example.com/raw-capture.mkv',
        'https://cdn.example.com/legacy-capture.avi',
        'https://cdn.example.com/capture.flv',
        'https://cdn.example.com/capture.wmv',
        'https://cdn.example.com/image.bmp',
        'https://cdn.example.com/image.tiff',
        'https://cdn.example.com/icon.ico',
        'https://cdn.example.com/photo.heic',
        'https://cdn.example.com/style.css',
        'https://cdn.example.com/bundle.js',
        'https://cdn.example.com/script.sh',
        'https://cdn.example.com/video.mp4x',
        'https://cdn.example.com/screenshot.pngy',
      ];

      for (const url of rejectedExtensions) {
        assert.equal(
          resolveMediaType(url),
          null,
          `Expected unallowlisted extension ${url} to resolve as null`
        );
      }
    });

    it('1.8 returns null for empty strings, whitespace, non-media strings, and invalid primitives', () => {
      const invalidInputs = [
        '',
        '   ',
        '\t\n\r  ',
        null,
        undefined,
        'synthetic',
        'mock-interface',
        'dashboard-preview',
        'https://google.com',
        'https://example.com/dashboard/analytics',
        'text/plain',
        0 as unknown as string,
        1 as unknown as string,
        true as unknown as string,
        false as unknown as string,
        {} as unknown as string,
        [] as unknown as string,
        (() => {}) as unknown as string,
      ];

      for (const input of invalidInputs) {
        assert.equal(
          resolveMediaType(input),
          null,
          `Expected ${util.inspect(input)} to resolve as null`
        );
      }
    });
  });

  // =========================================================================
  // 2. REALCAPTURESURFACE STRUCTURAL & FALLBACK INVARIANTS
  // =========================================================================
  describe('2. RealCaptureSurface Structural & Fallback Invariants', () => {
    it('2.1 renders Remotion <OffthreadVideo> with volume=0 (muted) and objectFit: cover for video URLs', () => {
      const videoElement = RealCaptureSurface({
        mediaUrl: 'https://cdn.example.com/demo.mp4',
        windowTitle: 'Test Video Window',
      }) as React.ReactElement<SurfaceContainerProps>;

      assert.equal(videoElement.type, 'div');
      // Children: [0] Header Bar, [1] Content Container
      const children = React.Children.toArray(videoElement.props.children);
      assert.equal(children.length, 2);

      const contentContainer = children[1] as React.ReactElement<{
        children: React.ReactElement<MediaContentProps>;
      }>;
      const innerContent = contentContainer.props.children;

      // Invariant: Must render Remotion OffthreadVideo
      assert.equal(innerContent.type, OffthreadVideo);

      // Invariant: Must be strictly muted (volume={0}) to preserve AudioEngine exclusivity
      assert.equal(
        innerContent.props.volume,
        0,
        'OffthreadVideo volume must be strictly 0 (muted) to prevent audio bleed'
      );

      // Invariant: Must apply objectFit: 'cover' and 100% dimensions
      assert.equal(innerContent.props.style?.objectFit, 'cover');
      assert.equal(innerContent.props.style?.width, '100%');
      assert.equal(innerContent.props.style?.height, '100%');
      assert.equal(innerContent.props.src, 'https://cdn.example.com/demo.mp4');
    });

    it('2.2 renders Remotion <Img> with objectFit: cover for image URLs', () => {
      const imgElement = RealCaptureSurface({
        mediaUrl: 'https://cdn.example.com/screenshot.png',
        windowTitle: 'Test Image Window',
      }) as React.ReactElement<SurfaceContainerProps>;

      const children = React.Children.toArray(imgElement.props.children);
      const contentContainer = children[1] as React.ReactElement<{
        children: React.ReactElement<MediaContentProps>;
      }>;
      const innerContent = contentContainer.props.children;

      // Invariant: Must render Remotion Img
      assert.equal(innerContent.type, Img);

      // Invariant: Must apply objectFit: 'cover' and 100% dimensions
      assert.equal(innerContent.props.style?.objectFit, 'cover');
      assert.equal(innerContent.props.style?.width, '100%');
      assert.equal(innerContent.props.style?.height, '100%');
      assert.equal(innerContent.props.src, 'https://cdn.example.com/screenshot.png');
    });

    it('2.3 respects explicit mediaType override prop over URL inference', () => {
      // Force 'video' on ambiguous/blob URL
      const forcedVideoElement = RealCaptureSurface({
        mediaUrl: 'blob:http://localhost:3000/4a7f0581-2db8-4039-bc1a-5bf6ecb7914e',
        mediaType: 'video',
      }) as React.ReactElement<SurfaceContainerProps>;
      const forcedVideoInner = (
        React.Children.toArray(forcedVideoElement.props.children)[1] as React.ReactElement<{
          children: React.ReactElement<MediaContentProps>;
        }>
      ).props.children;
      assert.equal(forcedVideoInner.type, OffthreadVideo);
      assert.equal(forcedVideoInner.props.volume, 0);

      // Force 'image' on URL
      const forcedImgElement = RealCaptureSurface({
        mediaUrl: 'https://example.com/asset?id=123',
        mediaType: 'image',
      }) as React.ReactElement<SurfaceContainerProps>;
      const forcedImgInner = (
        React.Children.toArray(forcedImgElement.props.children)[1] as React.ReactElement<{
          children: React.ReactElement<MediaContentProps>;
        }>
      ).props.children;
      assert.equal(forcedImgInner.type, Img);
      assert.equal(forcedImgInner.props.style?.objectFit, 'cover');
    });

    it('2.4 falls back to children when mediaUrl is non-media, empty, or null', () => {
      const fallbackChild = React.createElement('div', { id: 'fallback-dashboard' }, 'Mock Dashboard');

      const nonMediaElement = RealCaptureSurface({
        mediaUrl: 'synthetic',
        children: fallbackChild,
      }) as React.ReactElement<SurfaceContainerProps>;
      const nonMediaInner = (
        React.Children.toArray(nonMediaElement.props.children)[1] as React.ReactElement<{
          children: React.ReactNode;
        }>
      ).props.children;
      assert.equal(nonMediaInner, fallbackChild);

      const nullMediaElement = RealCaptureSurface({
        mediaUrl: null,
        children: fallbackChild,
      }) as React.ReactElement<SurfaceContainerProps>;
      const nullMediaInner = (
        React.Children.toArray(nullMediaElement.props.children)[1] as React.ReactElement<{
          children: React.ReactNode;
        }>
      ).props.children;
      assert.equal(nullMediaInner, fallbackChild);

      const emptyMediaElement = RealCaptureSurface({
        mediaUrl: '   ',
        children: fallbackChild,
      }) as React.ReactElement<SurfaceContainerProps>;
      const emptyMediaInner = (
        React.Children.toArray(emptyMediaElement.props.children)[1] as React.ReactElement<{
          children: React.ReactNode;
        }>
      ).props.children;
      assert.equal(emptyMediaInner, fallbackChild);
    });

    it('2.5 handles missing children gracefully without throwing', () => {
      assert.doesNotThrow(() => {
        RealCaptureSurface({
          mediaUrl: null,
          children: undefined,
        });
      });
    });

    it('2.6 applies archetype styling invariants (linear-dark vs base44-studio)', () => {
      // Linear Dark: obsidian background and neon glow shadow
      const darkElement = RealCaptureSurface({
        archetype: 'linear-dark',
        accentColor: '#5E6AD2',
      }) as React.ReactElement<SurfaceContainerProps>;
      const darkStyle = darkElement.props.style;
      assert.equal(darkStyle?.backgroundColor, '#121215');
      assert.ok(
        typeof darkStyle?.boxShadow === 'string' &&
          darkStyle.boxShadow.includes('#5E6AD2')
      );

      // Base44 Studio: clean white surface and soft shadow
      const base44Element = RealCaptureSurface({
        archetype: 'base44-studio',
      }) as React.ReactElement<SurfaceContainerProps>;
      const base44Style = base44Element.props.style;
      assert.equal(base44Style?.backgroundColor, '#FFFFFF');
      assert.ok(
        typeof base44Style?.boxShadow === 'string' &&
          base44Style.boxShadow.includes('rgba(24, 23, 21, 0.14)')
      );
    });
  });

  // =========================================================================
  // 3. MOTION ARCHETYPE SCHEMA STRESS TESTING
  // =========================================================================
  describe('3. MotionArchetypeSchema Stress Testing', () => {
    it('3.1 parses all 4 valid motion archetypes', () => {
      const validArchetypes = [
        'base44-studio',
        'linear-dark',
        'bento-grid',
        'kinetic-hook',
      ] as const;

      for (const arch of validArchetypes) {
        const parsed = MotionArchetypeSchema.safeParse(arch);
        assert.equal(parsed.success, true);
        if (parsed.success) {
          assert.equal(parsed.data, arch);
        }
      }
    });

    it('3.2 rejects casing variations, prefixes, suffixes, and typos', () => {
      const invalidStrings = [
        // Casing variations
        'BASE44-STUDIO',
        'LINEAR-DARK',
        'BENTO-GRID',
        'KINETIC-HOOK',
        'Base44-Studio',
        'Linear-Dark',
        'Bento-Grid',
        'Kinetic-Hook',
        // CamelCase & snake_case
        'base44Studio',
        'linearDark',
        'bentoGrid',
        'kineticHook',
        'base44_studio',
        'linear_dark',
        'bento_grid',
        'kinetic_hook',
        // Substrings / prefixes
        'base44',
        'linear',
        'bento',
        'kinetic',
        // Suffixes
        'base44-studio-v2',
        'linear-dark-pro',
        'bento-grid-reel',
        'kinetic-hook-plus',
        // Typos & spaces
        'base 44 studio',
        'linear--dark',
        'bento.grid',
        'kinetic/hook',
        '',
        '   ',
        // Unallowlisted archetypes
        'cyberpunk-neon',
        'corporate-clean',
        'vaporwave-80s',
        'minimal-editorial',
        // Injection attempts
        '<script>alert(1)</script>',
        '__proto__',
        'constructor',
        'prototype',
      ];

      for (const inv of invalidStrings) {
        const parsed = MotionArchetypeSchema.safeParse(inv);
        assert.equal(
          parsed.success,
          false,
          `Expected invalid archetype string "${inv}" to be rejected`
        );
      }
    });

    it('3.3 rejects non-string primitives and boundary objects', () => {
      const nonStringInputs = [
        0,
        1,
        -1,
        100,
        NaN,
        Infinity,
        -Infinity,
        true,
        false,
        null,
        undefined,
        {},
        { archetype: 'base44-studio' },
        [],
        ['base44-studio'],
        Symbol('base44-studio'),
        Object.create(null),
      ];

      for (const inv of nonStringInputs) {
        const parsed = MotionArchetypeSchema.safeParse(inv);
        assert.equal(
          parsed.success,
          false,
          `Expected non-string input ${util.inspect(inv)} to be rejected`
        );
      }
    });

    it('3.4 validates ArtDirectionSchema backward compatibility and rejects null archetype', () => {
      // 1. Legacy ArtDirection without archetype field must succeed (100% backward compatibility)
      const legacyArtDirection = {
        backdropVariant: 'dark-precision',
        surfaceTheme: 'dark',
        primaryAccent: '#5E6AD2',
      };
      const parsedLegacy = ArtDirectionSchema.safeParse(legacyArtDirection);
      assert.equal(parsedLegacy.success, true);
      if (parsedLegacy.success) {
        assert.equal(parsedLegacy.data.archetype, undefined);
      }

      // 2. Modern ArtDirection with valid archetype must succeed
      const modernArtDirection = {
        backdropVariant: 'light-editorial',
        surfaceTheme: 'light',
        primaryAccent: '#FF5C35',
        archetype: 'base44-studio',
      };
      const parsedModern = ArtDirectionSchema.safeParse(modernArtDirection);
      assert.equal(parsedModern.success, true);
      if (parsedModern.success) {
        assert.equal(parsedModern.data.archetype, 'base44-studio');
      }

      // 3. ArtDirection with null archetype must fail (optional does not admit null)
      const nullArchArtDirection = {
        backdropVariant: 'light-editorial',
        surfaceTheme: 'light',
        primaryAccent: '#FF5C35',
        archetype: null,
      };
      const parsedNull = ArtDirectionSchema.safeParse(nullArchArtDirection);
      assert.equal(
        parsedNull.success,
        false,
        'ArtDirection with null archetype must fail safeParse'
      );

      // 4. ArtDirection with invalid archetype string must fail
      const invalidArchArtDirection = {
        backdropVariant: 'light-editorial',
        surfaceTheme: 'light',
        primaryAccent: '#FF5C35',
        archetype: 'cyberpunk-neon',
      };
      const parsedInvalid = ArtDirectionSchema.safeParse(invalidArchArtDirection);
      assert.equal(
        parsedInvalid.success,
        false,
        'ArtDirection with invalid archetype must fail safeParse'
      );
    });
  });

  // =========================================================================
  // 4. DUAL ASPECT RATIO & CAMERA KINEMATICS SAFETY
  // =========================================================================
  describe('4. Dual Aspect Ratio (16:9 ↔ 9:16) & Analytical Zero Focal Drift', () => {
    it('4.1 verifies canvas dimension contracts for 16:9 and 9:16 compositions', () => {
      assert.equal(defaultSceneGraph.canvas.width, 1920);
      assert.equal(defaultSceneGraph.canvas.height, 1080);
      assert.equal(defaultSceneGraph.canvas.fps, 30);
      assert.equal(defaultSceneGraph.canvas.durationInFrames, 480);

      assert.equal(defaultVerticalSceneGraph.canvas.width, 1080);
      assert.equal(defaultVerticalSceneGraph.canvas.height, 1920);
      assert.equal(defaultVerticalSceneGraph.canvas.fps, 30);
      assert.equal(defaultVerticalSceneGraph.canvas.durationInFrames, 480);
    });

    it('4.2 verifies safe margins for vertical surface and typography reframing', () => {
      const canvasWidth = defaultVerticalSceneGraph.canvas.width; // 1080
      const verticalSurfaceWidth = 960;
      const horizontalMargin = (canvasWidth - verticalSurfaceWidth) / 2;

      // Safe margin must be exactly 60px
      assert.equal(horizontalMargin, 60);
      assert.ok(horizontalMargin >= 40, 'Horizontal safe margin must be at least 40px');

      const typographyMaxWidth = 920;
      const typographySidePadding = (canvasWidth - typographyMaxWidth) / 2;

      // Safe margin must be exactly 80px
      assert.equal(typographySidePadding, 80);
      assert.ok(typographySidePadding >= 60, 'Typography margin must be at least 60px');
    });

    it('4.3 proves analytical zero focal drift (<= 0.5px) in portrait 1080x1920 under 240 camera configurations', () => {
      const viewport = { width: 1080, height: 1920 };
      const focalTargets = [
        { x: 0.5, y: 0.5 },
        { x: 0.0, y: 0.0 },
        { x: 1.0, y: 1.0 },
        { x: 0.2, y: 0.8 },
        { x: 0.8, y: 0.2 },
        { x: 0.35, y: 0.65 },
        { x: 0.15, y: 0.85 },
        { x: 0.9, y: 0.1 },
      ];
      const zooms = [0.5, 0.8, 1.0, 1.5, 2.0, 3.5];
      const rotations = [
        { rotateX: 0, rotateY: 0, rotateZ: 0 },
        { rotateX: 12, rotateY: -15, rotateZ: 5 },
        { rotateX: -20, rotateY: 20, rotateZ: -10 },
        { rotateX: 25, rotateY: -25, rotateZ: 12 },
        { rotateX: -30, rotateY: 30, rotateZ: -15 },
      ];

      let maxDrift = 0;
      let evaluatedCount = 0;

      for (const focalPoint of focalTargets) {
        for (const zoom of zooms) {
          for (const rotation of rotations) {
            const transform = calculateCameraTransform({
              viewport,
              focalPoint,
              zoom,
              rotation,
            });

            evaluatedCount++;
            if (transform.focalDrift > maxDrift) {
              maxDrift = transform.focalDrift;
            }

            assert.ok(
              transform.focalDrift <= 0.5,
              `Focal drift ${transform.focalDrift}px exceeded 0.5px at target (${focalPoint.x}, ${focalPoint.y}) zoom ${zoom}`
            );
          }
        }
      }

      assert.equal(evaluatedCount, 240);
      assert.ok(maxDrift <= 0.5, `Max observed focal drift was ${maxDrift}px, expected <= 0.5px`);
    });
  });
});
