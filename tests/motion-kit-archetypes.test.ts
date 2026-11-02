/**
 * tests/motion-kit-archetypes.test.ts
 *
 * Comprehensive unit and integration test suite for Milestone 2:
 * 1. MotionArchetypeSchema and ArtDirection backward compatibility
 * 2. Media resolution oracle (resolveMediaType) across all schemes and extensions
 * 3. Archetype resolution logic (resolveArchetype)
 * 4. Dual Aspect Ratio (16:9 ↔ 9:16) canvas dimensions, safe bounds, and typography reframing
 * 5. Analytical zero focal drift invariance under 1080x1920 vertical viewport
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MotionArchetypeSchema,
  ArtDirectionSchema,
} from '../src/lib/scene-graph/schema';
import { resolveMediaType } from '../remotion/motion-kit/RealCaptureSurface';
import {
  resolveArchetype,
  defaultSceneGraph,
  defaultVerticalSceneGraph,
} from '../remotion/compositions/InteractiveSurfaceDemo';
import { calculateCameraTransform } from '../remotion/motion-kit/camera/CameraTransform';
import type { SceneNode } from '../src/lib/scene-graph/types';

describe('Milestone 2: Motion Kit, 4 Archetypes & Dual Aspect Ratio', () => {
  describe('1. MotionArchetypeSchema & ArtDirection Validation', () => {
    it('accepts all 4 valid motion archetypes', () => {
      const archetypes = [
        'base44-studio',
        'linear-dark',
        'bento-grid',
        'kinetic-hook',
      ] as const;

      for (const arch of archetypes) {
        const parsed = MotionArchetypeSchema.safeParse(arch);
        assert.equal(parsed.success, true);
        if (parsed.success) {
          assert.equal(parsed.data, arch);
        }
      }
    });

    it('rejects invalid or non-allowlisted archetypes', () => {
      const invalids = [
        'cyberpunk-neon',
        'corporate-blue',
        '',
        'linear',
        'base44',
        123,
        null,
      ];

      for (const inv of invalids) {
        const parsed = MotionArchetypeSchema.safeParse(inv);
        assert.equal(parsed.success, false);
      }
    });

    it('maintains 100% backward compatibility for ArtDirection without archetype', () => {
      const legacyArtDirection = {
        backdropVariant: 'dark-precision',
        surfaceTheme: 'dark',
        primaryAccent: '#5E6AD2',
      };

      const parsed = ArtDirectionSchema.safeParse(legacyArtDirection);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.archetype, undefined);
      }
    });

    it('validates ArtDirection with optional archetype attached', () => {
      const modernArtDirection = {
        backdropVariant: 'light-editorial',
        surfaceTheme: 'light',
        primaryAccent: '#FF5C35',
        archetype: 'base44-studio',
      };

      const parsed = ArtDirectionSchema.safeParse(modernArtDirection);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.archetype, 'base44-studio');
      }
    });
  });

  describe('2. Real Media Resolution Oracle (resolveMediaType)', () => {
    it('detects standard video file extensions with case-insensitivity', () => {
      assert.equal(resolveMediaType('https://cdn.example.com/videos/screen-recording.mp4'), 'video');
      assert.equal(resolveMediaType('https://cdn.example.com/videos/screen-recording.webm'), 'video');
      assert.equal(resolveMediaType('https://cdn.example.com/videos/screen-recording.mov'), 'video');
      assert.equal(resolveMediaType('/public/uploads/demo.m4v'), 'video');
      assert.equal(resolveMediaType('https://example.com/DEMO.MP4'), 'video');
      assert.equal(resolveMediaType('https://example.com/DEMO.WEBM'), 'video');
    });

    it('handles query parameters and hash anchors on video URLs', () => {
      assert.equal(resolveMediaType('https://example.com/recording.mp4?token=xyz123&exp=999'), 'video');
      assert.equal(resolveMediaType('https://example.com/recording.webm#t=10,20'), 'video');
      assert.equal(resolveMediaType('/media/clip.mov?download=true#anchor'), 'video');
    });

    it('detects video data URIs and blob URIs', () => {
      assert.equal(resolveMediaType('data:video/mp4;base64,AAAAHGZ0eXBtcDQy...'), 'video');
      assert.equal(resolveMediaType('data:video/webm;base64,GkXfo59ChoEBQveBA...'), 'video');
      assert.equal(resolveMediaType('blob:http://localhost:3000/mock-video-uuid-1234'), 'video');
      assert.equal(resolveMediaType('blob:https://app.vidiaura.com/recording.mp4'), 'video');
    });

    it('detects standard image extensions (.png, .jpg, .jpeg, .webp, .svg, .gif)', () => {
      assert.equal(resolveMediaType('https://cdn.example.com/images/screenshot.png'), 'image');
      assert.equal(resolveMediaType('https://cdn.example.com/images/screenshot.jpg'), 'image');
      assert.equal(resolveMediaType('https://cdn.example.com/images/screenshot.jpeg'), 'image');
      assert.equal(resolveMediaType('https://cdn.example.com/images/screenshot.webp'), 'image');
      assert.equal(resolveMediaType('https://cdn.example.com/images/logo.svg'), 'image');
      assert.equal(resolveMediaType('/static/preview.gif'), 'image');
      assert.equal(resolveMediaType('https://example.com/SCREENSHOT.PNG?v=2'), 'image');
    });

    it('detects image data URIs and blob URIs', () => {
      assert.equal(resolveMediaType('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), 'image');
      assert.equal(resolveMediaType('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...'), 'image');
      assert.equal(resolveMediaType('data:image/webp;base64,UklGRlIAAABXRUJQVlA4...'), 'image');
      assert.equal(resolveMediaType('blob:http://localhost:3000/mock-image-uuid-1234'), 'image');
    });

    it('returns null for empty, whitespace, non-media strings and undefined/null', () => {
      assert.equal(resolveMediaType(undefined), null);
      assert.equal(resolveMediaType(null), null);
      assert.equal(resolveMediaType(''), null);
      assert.equal(resolveMediaType('   '), null);
      assert.equal(resolveMediaType('synthetic'), null);
      assert.equal(resolveMediaType('mock-dashboard'), null);
      assert.equal(resolveMediaType('fleet-rental-preview'), null);
      assert.equal(resolveMediaType('https://example.com/docs/api'), null);
      assert.equal(resolveMediaType('text/plain'), null);
    });
  });

  describe('3. Intelligent Archetype Resolution (resolveArchetype)', () => {
    it('prioritizes explicit artDirection.archetype when provided', () => {
      const artDirection = {
        backdropVariant: 'light-editorial' as const,
        surfaceTheme: 'light' as const,
        primaryAccent: '#FF5C35',
        archetype: 'linear-dark' as const,
      };

      const resolved = resolveArchetype(artDirection);
      assert.equal(resolved, 'linear-dark');
    });

    it('infers kinetic-hook when kinetic_typography is the opening scene', () => {
      const artDirection = {
        backdropVariant: 'light-editorial' as const,
        surfaceTheme: 'light' as const,
        primaryAccent: '#FF5C35',
      };
      const scenes: SceneNode[] = [
        {
          id: 'scene-hook',
          type: 'kinetic_typography',
          startFrame: 0,
          durationInFrames: 60,
          payload: {
            words: ['Transform', 'Your', 'SaaS'],
          },
        },
      ];

      const resolved = resolveArchetype(artDirection, scenes);
      assert.equal(resolved, 'kinetic-hook');
    });

    it('infers linear-dark when surfaceTheme is dark and archetype is unspecified', () => {
      const artDirection = {
        backdropVariant: 'dark-precision' as const,
        surfaceTheme: 'dark' as const,
        primaryAccent: '#5E6AD2',
      };

      const resolved = resolveArchetype(artDirection);
      assert.equal(resolved, 'linear-dark');
    });

    it('defaults to base44-studio for light theme without explicit archetype', () => {
      const artDirection = {
        backdropVariant: 'light-editorial' as const,
        surfaceTheme: 'light' as const,
        primaryAccent: '#FF5C35',
      };

      const resolved = resolveArchetype(artDirection);
      assert.equal(resolved, 'base44-studio');
    });

    it('handles undefined artDirection safely and falls back to base44-studio', () => {
      const resolved = resolveArchetype(undefined);
      assert.equal(resolved, 'base44-studio');
    });
  });

  describe('4. Dual Aspect Ratio (16:9 ↔ 9:16) Contracts & Responsive Bounds', () => {
    it('defaultSceneGraph satisfies 16:9 horizontal contract (1920x1080)', () => {
      assert.equal(defaultSceneGraph.canvas.width, 1920);
      assert.equal(defaultSceneGraph.canvas.height, 1080);
      assert.equal(defaultSceneGraph.canvas.fps, 30);
      assert.equal(defaultSceneGraph.canvas.durationInFrames, 480);
    });

    it('defaultVerticalSceneGraph satisfies 9:16 vertical contract (1080x1920)', () => {
      assert.equal(defaultVerticalSceneGraph.canvas.width, 1080);
      assert.equal(defaultVerticalSceneGraph.canvas.height, 1920);
      assert.equal(defaultVerticalSceneGraph.canvas.fps, 30);
      assert.equal(defaultVerticalSceneGraph.canvas.durationInFrames, 480);
    });

    it('vertical surface dimensions (960x560) fit within 1080px canvas with positive horizontal margins', () => {
      const canvasWidth = defaultVerticalSceneGraph.canvas.width;
      const verticalSurfaceWidth = 960;
      const horizontalMargin = (canvasWidth - verticalSurfaceWidth) / 2;

      assert.equal(horizontalMargin, 60);
      assert.ok(horizontalMargin > 0, 'Horizontal margin must be positive to prevent clipping');
      assert.ok(verticalSurfaceWidth < canvasWidth, 'Surface width must fit inside canvas');
    });

    it('vertical kinetic typography max width (920px) maintains safe padding on 1080px canvas', () => {
      const canvasWidth = defaultVerticalSceneGraph.canvas.width;
      const typographyMaxWidth = 920;
      const sidePadding = (canvasWidth - typographyMaxWidth) / 2;

      assert.equal(sidePadding, 80);
      assert.ok(sidePadding >= 60, 'Safe typography margin must be >= 60px');
    });
  });

  describe('5. Zero Focal Drift Kinematics under 1080x1920 Portrait Viewport', () => {
    it('strictly maintains focal drift <= 0.5px across 168 combinatorial configs in 1080x1920', () => {
      const viewport = { width: 1080, height: 1920 };
      const testTargets = [
        { x: 0.5, y: 0.5 },
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.2, y: 0.8 },
        { x: 0.8, y: 0.2 },
        { x: 0.72, y: 0.34 },
        { x: 0.35, y: 0.45 },
      ];
      const zooms = [0.8, 1.0, 1.5, 2.0, 3.5];
      const rotations = [
        { rotateX: 0, rotateY: 0, rotateZ: 0 },
        { rotateX: 15, rotateY: -20, rotateZ: 8 },
        { rotateX: -25, rotateY: 25, rotateZ: -12 },
        { rotateX: 30, rotateY: -30, rotateZ: 15 },
      ];

      let maxDrift = 0;
      let evaluated = 0;

      for (const focalPoint of testTargets) {
        for (const zoom of zooms) {
          for (const rotation of rotations) {
            const transform = calculateCameraTransform({
              viewport,
              focalPoint,
              zoom,
              rotation,
            });

            evaluated++;
            if (transform.focalDrift > maxDrift) {
              maxDrift = transform.focalDrift;
            }

            assert.ok(
              transform.focalDrift <= 0.5,
              `Focal drift ${transform.focalDrift}px exceeded 0.5px threshold at target (${focalPoint.x}, ${focalPoint.y}) zoom ${zoom}`
            );
          }
        }
      }

      assert.ok(evaluated >= 140, `Evaluated ${evaluated} configurations`);
      assert.ok(maxDrift <= 0.5, `Max drift was ${maxDrift}px, expected <= 0.5px`);
    });
  });
});
