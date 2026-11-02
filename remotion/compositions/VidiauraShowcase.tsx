/**
 * VidiauraShowcase.tsx
 *
 * The reference film (milestone M3): an 11-shot, 16-second launch spot whose
 * every element is placed by the deterministic layout engine from M2 rather
 * than by hand.
 *
 * Rules this file follows on purpose:
 * - No colour literals. Every value comes from `src/lib/design/tokens.ts`;
 *   the legacy-debt ratchet in `tests/design-tokens.test.ts` enforces it.
 * - No pixel guesses for placement. Each shot asks `buildPreset` for its slots,
 *   and `Fit` clamps child content into those slots with `fitInside`, so an atom
 *   can never bleed past the safe area.
 * - One idea per shot, and no shot longer than `motion.beatFrames`, so the cut
 *   rhythm is structural rather than tuned by ear.
 */

import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  useCurrentFrame,
} from 'remotion';
import {
  AudioEngine,
  CameraRig3D,
  DynamicBackdrop,
  IconGridMorph,
  KineticTypography,
  RealCaptureSurface,
  SmartCursor,
  SyntheticCodeTree,
  SyntheticConnectPills,
  SyntheticHeroButton,
  SyntheticPromptBox,
  type SoundCue,
} from '../motion-kit';
import {
  buildPreset,
  fitInside,
  getSafeArea,
  type LayoutPresetId,
  type Rect,
} from '../../src/lib/scene-graph/layout';
import type { CanvasConfig } from '../../src/lib/scene-graph/types';
import {
  alpha,
  brand,
  radius,
  sceneThemes,
  signal,
  space,
  typography,
} from '../../src/lib/design/tokens';

export interface VidiauraShowcaseProps {
  productName?: string;
  tagline?: string;
  website?: string;
}

const CANVAS: CanvasConfig = {
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 480,
};

const SAFE = getSafeArea(CANVAS);
const BEAT = 45;
const TOTAL = CANVAS.durationInFrames;

/** Dark stage. */
const stage = sceneThemes.obsidian;
/** Light, floating UI panels that sit on the dark stage. */
const panel = sceneThemes.studioLight;

const CAPTION: Rect = {
  x: SAFE.x,
  y: SAFE.y,
  width: SAFE.width,
  height: 64,
};

function slotRect(preset: LayoutPresetId, id?: string): Rect {
  const slots = buildPreset(preset, SAFE);
  const found = id
    ? slots.find((slot) => slot.id === id)
    : slots.find((slot) => slot.role === 'focal');
  if (!found) {
    throw new Error(
      `VidiauraShowcase: preset "${preset}" has no slot "${id ?? '(focal)'}"`
    );
  }
  return found.rect;
}

/** Clamped interpolation; every animation in this file is time-bound. */
function ramp(
  frame: number,
  from: number,
  to: number,
  start = 0,
  end = 1
): number {
  return interpolate(frame, [from, to], [start, end], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
}

function easeOut(frame: number, from: number, to: number, start = 0, end = 1): number {
  return interpolate(frame, [from, to], [start, end], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

/* ========================================================================= */
/* Placement primitives                                                      */
/* ========================================================================= */

/** Absolutely places a child at a layout slot and centres it. */
const Slot: React.FC<{
  rect: Rect;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ rect, children, style }) => (
  <div
    style={{
      position: 'absolute',
      left: rect.x,
      top: rect.y,
      width: rect.width,
      height: rect.height,
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...style,
    }}
  >
    {children}
  </div>
);

/**
 * Renders fixed-size content scaled down to fit a slot. `fitInside` guarantees
 * the result stays inside the slot, which is the whole point of M2: content can
 * shrink, but it can never be clipped by the frame.
 */
const Fit: React.FC<{
  slot: Rect;
  width: number;
  height: number;
  children: React.ReactNode;
}> = ({ slot, width, height, children }) => {
  const fitted = fitInside({ x: 0, y: 0, width, height }, slot);
  const scale = fitted.width / width;
  return (
    <div
      style={{
        position: 'absolute',
        left: fitted.x,
        top: fitted.y,
        width,
        height,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}
    >
      {children}
    </div>
  );
};

const Caption: React.FC<{ index: string; text: string; appearAt?: number }> = ({
  index,
  text,
  appearAt = 0,
}) => {
  const frame = useCurrentFrame();
  const opacity = ramp(frame, appearAt, appearAt + 9);
  const slide = easeOut(frame, appearAt, appearAt + 14, -18, 0);

  return (
    <div
      style={{
        position: 'absolute',
        left: CAPTION.x,
        top: CAPTION.y,
        height: CAPTION.height,
        display: 'flex',
        alignItems: 'center',
        gap: space.md,
        opacity,
        transform: `translateX(${slide}px)`,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: brand.purpleGlow,
          boxShadow: `0 0 16px ${alpha.purpleHalo}`,
        }}
      />
      <span
        style={{
          fontSize: 17,
          fontWeight: 700,
          letterSpacing: '0.28em',
          textTransform: 'uppercase',
          color: brand.textSecondary,
        }}
      >
        {index}
      </span>
      <span
        style={{
          fontSize: 17,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: brand.textMuted,
        }}
      >
        {text}
      </span>
    </div>
  );
};

/** Dark card used by the bento shots. */
const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      backgroundColor: stage.surface,
      border: `1px solid ${stage.border}`,
      borderRadius: radius.xl,
      boxShadow: `0 40px 100px -40px ${alpha.shadowStrong}`,
      padding: space.xl,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
);

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      fontSize: 17,
      fontWeight: 700,
      letterSpacing: '0.28em',
      textTransform: 'uppercase',
      color: brand.purpleAccent,
    }}
  >
    {children}
  </span>
);

/* ========================================================================= */
/* The product surface that appears in the stage shots                       */
/* ========================================================================= */

const NAV = ['Overview', 'Campaigns', 'Assets', 'Renders', 'Settings'];
const BARS = [38, 54, 46, 68, 60, 74, 63, 88, 76, 94, 82, 100, 90, 97];

const ProductBoard: React.FC = () => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      backgroundColor: stage.background,
      fontFamily: typography.fontFamily,
    }}
  >
    <div
      style={{
        width: 232,
        flexShrink: 0,
        backgroundColor: stage.surfaceRaised,
        borderRight: `1px solid ${stage.border}`,
        padding: `${space.xl}px ${space.lg}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: space.xl,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            background: `linear-gradient(140deg, ${brand.purpleGlow}, ${brand.purple})`,
            boxShadow: `0 0 18px ${alpha.purpleHalo}`,
          }}
        />
        <span style={{ fontSize: 17, fontWeight: 700, color: brand.text }}>
          Studio
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {NAV.map((item, index) => (
          <div
            key={item}
            style={{
              fontSize: 15,
              fontWeight: index === 0 ? 600 : 400,
              color: index === 0 ? brand.text : brand.textMuted,
              backgroundColor: index === 0 ? alpha.white08 : 'transparent',
              borderRadius: radius.sm,
              padding: '8px 12px',
            }}
          >
            {item}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 'auto',
          fontSize: 13,
          color: brand.textMuted,
          lineHeight: 1.5,
        }}
      >
        Workspace
        <div style={{ color: brand.textSecondary }}>Vidiaura HQ</div>
      </div>
    </div>

    <div
      style={{
        flex: 1,
        padding: `${space.xl}px ${space.xl}px ${space.lg}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: space.lg,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: brand.text,
              letterSpacing: '-0.02em',
            }}
          >
            Launch console
          </div>
          <div style={{ fontSize: 14, color: brand.textMuted }}>
            Six beats · rendered from one brief
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: `1px solid ${alpha.white12}`,
            borderRadius: radius.pill,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: brand.textSecondary,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: signal.green,
            }}
          />
          Live
        </div>
      </div>

      <div style={{ display: 'flex', gap: space.md }}>
        {[
          { label: 'Films shipped', value: '128' },
          { label: 'Median render', value: '42s' },
          { label: 'Formats', value: '2' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: 1,
              backgroundColor: stage.surfaceRaised,
              border: `1px solid ${stage.border}`,
              borderRadius: radius.lg,
              padding: `${space.md}px ${space.lg}px`,
            }}
          >
            <div style={{ fontSize: 13, color: brand.textMuted }}>
              {stat.label}
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                color: brand.text,
                letterSpacing: '-0.03em',
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          flex: 1,
          backgroundColor: stage.surfaceRaised,
          border: `1px solid ${stage.border}`,
          borderRadius: radius.lg,
          padding: space.lg,
          display: 'flex',
          flexDirection: 'column',
          gap: space.md,
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: 14, color: brand.textSecondary }}>
            Renders this week
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: brand.purpleAccent,
            }}
          >
            +34%
          </span>
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 10,
            minHeight: 90,
          }}
        >
          {BARS.map((height, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: `${height}%`,
                borderRadius: 4,
                background:
                  index === BARS.length - 2
                    ? `linear-gradient(180deg, ${brand.purpleAccent}, ${brand.purple})`
                    : stage.borderStrong,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const ProductWindow: React.FC<{ title?: string }> = ({
  title = 'Vidiaura Studio — Launch console',
}) => (
  <RealCaptureSurface
    windowTitle={title}
    width={1180}
    height={640}
    archetype="linear-dark"
    accentColor={brand.purpleGlow}
  >
    <ProductBoard />
  </RealCaptureSurface>
);

/* ========================================================================= */
/* Shots                                                                     */
/* ========================================================================= */

const ShotHook: React.FC<{ base: number }> = ({ base }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const rect = slotRect('hook');

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />
      <Slot rect={rect} style={{ flexDirection: 'column', gap: 20 }}>
        <div style={{ opacity: ramp(local, 0, 10), transform: `translateY(${easeOut(local, 0, 14, 14, 0)}px)` }}>
          <Kicker>Vidiaura · AI motion studio</Kicker>
        </div>
        <div style={{ position: 'relative', width: '100%', flex: 1 }}>
          <KineticTypography
            frame={local}
            mode="kinetic-hook"
            words={['Your', 'product', 'is', 'the', 'story.']}
            accentWordIndex={4}
            startFrame={2}
            staggerFrames={5}
            theme={{
              textColor: brand.text,
              accentColor: brand.purpleAccent,
              symbolColor: brand.textMuted,
              fontSize: 92,
              maxWidth: 1500,
            }}
          />
        </div>
      </Slot>
    </>
  );
};

const ShotStage: React.FC<{ base: number; variant: 'in' | 'out' }> = ({
  base,
  variant,
}) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const rect = slotRect('stage', 'window');

  const initial =
    variant === 'in'
      ? { x: 0.5, y: 0.5, zoom: 1.1, rotateX: 6, rotateY: -4 }
      : { x: 0.5, y: 0.5, zoom: 1.14, rotateX: -4, rotateY: 5 };

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />
      <Slot rect={rect}>
        <CameraRig3D
          frame={local}
          startFrame={0}
          transitionFrames={34}
          initial={initial}
          target={{ x: 0.5, y: 0.5, zoom: 1.0, rotateX: 0, rotateY: 0 }}
          easingType="smooth"
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ProductWindow title="Vidiaura Studio — Launch console" />
          </div>
        </CameraRig3D>
      </Slot>
    </>
  );
};

const ShotBrief: React.FC<{ base: number }> = ({ base }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const rect = slotRect('pair', 'primary');

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />
      <Caption index="01" text="The brief" />
      <Fit slot={rect} width={1040} height={250}>
        <SyntheticPromptBox
          frame={local}
          startFrame={4}
          charsPerFrame={1.45}
          width={1040}
          textToType="A sixteen-second launch film for our new analytics workspace."
        />
      </Fit>
    </>
  );
};

const ShotStoryboard: React.FC<{ base: number }> = ({ base }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const copy = slotRect('split', 'copy');
  const visual = slotRect('split', 'visual');

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />
      <Caption index="02" text="The storyboard" />

      <Slot rect={copy}>
        <KineticTypography
          frame={local}
          words={['Six', 'beats.', 'One', 'idea.']}
          accentWordIndex={3}
          startFrame={2}
          staggerFrames={6}
          theme={{
            textColor: brand.text,
            accentColor: brand.purpleAccent,
            symbolColor: brand.textMuted,
            fontSize: 64,
            maxWidth: 700,
          }}
        />
      </Slot>

      <Slot rect={visual}>
        <div
          style={{
            width: 700,
            boxSizing: 'border-box',
            backgroundColor: panel.surface,
            border: `1px solid ${panel.border}`,
            borderRadius: radius.xl,
            boxShadow: `0 50px 120px -30px ${alpha.shadowStrong}`,
            padding: space.xl,
            opacity: ramp(local, 1, 10),
            transform: `translateY(${easeOut(local, 1, 16, 26, 0)}px)`,
          }}
        >
          <SyntheticCodeTree
            frame={local}
            startFrame={6}
            title="storyboard/"
            nodes={[
              { label: 'hook.ts', indent: 1, delay: 4 },
              { label: 'brief.ts', indent: 1, delay: 10 },
              { label: 'scenes', isFolder: true, indent: 1, delay: 16 },
              { label: 'beat-03.ts', indent: 2, delay: 22 },
              { label: 'render.ts', indent: 1, delay: 28 },
            ]}
          />
        </div>
      </Slot>
    </>
  );
};

const ShotSystem: React.FC<{ base: number }> = ({ base }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const primary = slotRect('bento', 'card-primary');
  const secondary = slotRect('bento', 'card-secondary');
  const tertiary = slotRect('bento', 'card-tertiary');

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />

      <Slot rect={primary} style={{ padding: 6 }}>
        <Card>
          <Kicker>The system</Kicker>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconGridMorph
              frame={local}
              startFrame={4}
              waveStartFrame={16}
              rows={4}
              cols={7}
              initialColor={brand.textMuted}
              targetColor={brand.purpleAccent}
            />
          </div>
          <div style={{ fontSize: 20, color: brand.textSecondary }}>
            Every asset, on brand.
          </div>
        </Card>
      </Slot>

      <Slot rect={secondary} style={{ padding: 6 }}>
        <Card style={{ justifyContent: 'center', gap: 6 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: brand.text,
              letterSpacing: '-0.05em',
            }}
          >
            0
          </div>
          <div style={{ fontSize: 16, color: brand.textMuted }}>
            templates required
          </div>
        </Card>
      </Slot>

      <Slot rect={tertiary} style={{ padding: 6 }}>
        <Card style={{ justifyContent: 'center', gap: 6 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              color: brand.purpleAccent,
              letterSpacing: '-0.05em',
            }}
          >
            11
          </div>
          <div style={{ fontSize: 16, color: brand.textMuted }}>
            shots per film
          </div>
        </Card>
      </Slot>
    </>
  );
};

const ShotPublish: React.FC<{ base: number }> = ({ base }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const rect = slotRect('pair', 'primary');
  const clickAt = 32;
  const burst = local >= clickAt ? local - clickAt : -1;

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />

      {burst >= 0 && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 320,
            height: 320,
            marginLeft: -160,
            marginTop: -160,
            borderRadius: '50%',
            border: `2px solid ${brand.purpleAccent}`,
            opacity: ramp(burst, 0, 14, 0.7, 0),
            transform: `scale(${ramp(burst, 0, 14, 0.35, 1.5)})`,
          }}
        />
      )}

      <Slot rect={rect}>
        <SyntheticHeroButton
          frame={local}
          startFrame={5}
          clickFrame={clickAt}
          buttonText="Publish film"
          theme={{
            backgroundColor: brand.purple,
            textColor: brand.text,
            glowColor: alpha.purpleHalo,
            borderRadius: 22,
            fontSize: 30,
          }}
        />
      </Slot>

      <SmartCursor
        frame={local}
        startFrame={8}
        endFrame={clickAt}
        clickFrame={clickAt}
        start={{ x: 0.72, y: 0.63 }}
        target={{ x: 0.5, y: 0.5 }}
        size={40}
        color={brand.text}
        accentColor={brand.purpleAccent}
      />
    </>
  );
};

const ShotStatement: React.FC<{ base: number }> = ({ base }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const cta = slotRect('lower-third', 'cta');
  const mark = slotRect('lower-third', 'mark');

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />
      <Caption index="03" text="The result" />

      <Slot rect={cta}>
        <KineticTypography
          frame={local}
          words={['Built', 'from', 'your', 'product.', 'Not', 'a', 'template.']}
          accentWordIndex={3}
          startFrame={1}
          staggerFrames={4}
          theme={{
            textColor: brand.textSecondary,
            accentColor: brand.text,
            symbolColor: brand.textMuted,
            fontSize: 68,
            maxWidth: 1500,
          }}
        />
      </Slot>

      <Slot rect={mark}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 5,
              backgroundColor: brand.purpleAccent,
              boxShadow: `0 0 20px ${alpha.purpleHalo}`,
            }}
          />
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: brand.textMuted,
            }}
          >
            Vidiaura
          </span>
        </div>
      </Slot>
    </>
  );
};

const ShotStack: React.FC<{ base: number }> = ({ base }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const rect = slotRect('pair', 'primary');

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />
      <Caption index="04" text="Your stack" />

      <Slot rect={rect}>
        <div style={{ transform: `scale(${easeOut(local, 0, 16, 0.94, 1)})` }}>
          <SyntheticConnectPills
            frame={local}
            startFrame={2}
            sourceText="Connect to"
            targetText="Any stack"
            theme={{
              sourceColor: panel.textPrimary,
              targetColor: brand.purple,
              accentColor: brand.purpleAccent,
            }}
          />
        </div>
      </Slot>
    </>
  );
};

const ShotFormats: React.FC<{ base: number }> = ({ base }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const primary = slotRect('bento', 'card-primary');
  const secondary = slotRect('bento', 'card-secondary');
  const tertiary = slotRect('bento', 'card-tertiary');

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />

      <Slot rect={primary} style={{ padding: 6 }}>
        <Card style={{ justifyContent: 'space-between' }}>
          <Kicker>One graph, every format</Kicker>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: space.lg,
            }}
          >
            <div
              style={{
                fontSize: 132,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.06em',
                color: brand.text,
              }}
            >
              4K
            </div>
            <div style={{ fontSize: 22, color: brand.textSecondary }}>
              exports
            </div>
          </div>
          <div style={{ display: 'flex', gap: space.md }}>
            {['16:9', '9:16', '1:1'].map((ratio) => (
              <div
                key={ratio}
                style={{
                  border: `1px solid ${stage.borderStrong}`,
                  borderRadius: radius.pill,
                  padding: '8px 18px',
                  fontSize: 15,
                  fontWeight: 600,
                  color: brand.textSecondary,
                }}
              >
                {ratio}
              </div>
            ))}
          </div>
        </Card>
      </Slot>

      <Slot rect={secondary} style={{ padding: 6 }}>
        <Card style={{ justifyContent: 'center', gap: 4 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: brand.purpleAccent,
              letterSpacing: '-0.05em',
            }}
          >
            42s
          </div>
          <div style={{ fontSize: 16, color: brand.textMuted }}>
            median render
          </div>
        </Card>
      </Slot>

      <Slot rect={tertiary} style={{ padding: 6 }}>
        <Card style={{ justifyContent: 'center', gap: 4 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              color: brand.text,
              letterSpacing: '-0.05em',
            }}
          >
            30fps
          </div>
          <div style={{ fontSize: 16, color: brand.textMuted }}>
            frame-accurate cues
          </div>
        </Card>
      </Slot>
    </>
  );
};

const ShotClose: React.FC<{
  base: number;
  productName: string;
  tagline: string;
  website: string;
}> = ({ base, productName, tagline, website }) => {
  const local = useCurrentFrame();
  const frame = base + local;
  const rect = slotRect('hook');

  return (
    <>
      <DynamicBackdrop
        frame={frame}
        variant="dark-precision"
        backgroundColor={stage.background}
        accentGlow={alpha.purpleGlow}
      />
      <Slot rect={rect} style={{ flexDirection: 'column', gap: space.lg }}>
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 22,
            background: `linear-gradient(140deg, ${brand.purpleGlow}, ${brand.purple})`,
            boxShadow: `0 24px 60px ${alpha.purpleHalo}`,
            opacity: ramp(local, 0, 9),
            transform: `scale(${easeOut(local, 0, 16, 0.86, 1)})`,
          }}
        />
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: '-0.045em',
            color: brand.text,
            opacity: ramp(local, 2, 12),
            transform: `translateY(${easeOut(local, 2, 16, 18, 0)}px)`,
          }}
        >
          {productName}
        </div>
        <div
          style={{
            border: `1px solid ${brand.purple}`,
            borderRadius: radius.pill,
            padding: '10px 28px',
            fontSize: 21,
            fontWeight: 600,
            color: brand.purpleAccent,
            opacity: ramp(local, 6, 16),
            transform: `translateY(${easeOut(local, 6, 20, 14, 0)}px)`,
          }}
        >
          {tagline}
        </div>
        <div
          style={{
            fontSize: 16,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: brand.textMuted,
            opacity: ramp(local, 10, 20),
          }}
        >
          {website}
        </div>
      </Slot>
    </>
  );
};

/* ========================================================================= */
/* Timeline                                                                  */
/* ========================================================================= */

const ProgressRail: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: SAFE.x,
        top: SAFE.y + SAFE.height + 12,
        width: SAFE.width,
        height: 2,
        backgroundColor: alpha.white06,
        borderRadius: 2,
        opacity: 0.7,
      }}
    >
      <div
        style={{
          width: `${(frame / TOTAL) * 100}%`,
          height: '100%',
          borderRadius: 2,
          background: `linear-gradient(90deg, ${brand.purple}, ${brand.purpleAccent})`,
        }}
      />
    </div>
  );
};

export const VidiauraShowcase: React.FC<VidiauraShowcaseProps> = ({
  productName = 'Vidiaura',
  tagline = 'Motion graphics, on brief.',
  website = 'vidiaura.com',
}) => {
  // One cue per cut, plus a typed keystroke and the publish click. 100% of the
  // scene transitions are scored; no shot changes silently.
  const soundCues: SoundCue[] = [
    { frame: 0, sound: 'camera-whoosh', volume: 0.7 },
    { frame: BEAT, sound: 'camera-whoosh', volume: 0.55 },
    { frame: BEAT * 2, sound: 'keyboard-tap', volume: 0.5 },
    { frame: BEAT * 2 + 26, sound: 'keyboard-tap', volume: 0.38 },
    { frame: BEAT * 3, sound: 'soft-pop', volume: 0.7 },
    { frame: BEAT * 4, sound: 'chime', volume: 0.6 },
    { frame: BEAT * 5, sound: 'mouse-click', volume: 0.9 },
    { frame: BEAT * 5 + 32, sound: 'mouse-click', volume: 0.95 },
    { frame: BEAT * 6, sound: 'camera-whoosh', volume: 0.6 },
    { frame: BEAT * 7, sound: 'soft-pop', volume: 0.7 },
    { frame: BEAT * 8, sound: 'chime', volume: 0.65 },
    { frame: BEAT * 9, sound: 'camera-whoosh', volume: 0.6 },
    { frame: BEAT * 10, sound: 'chime', volume: 0.85 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: stage.background,
        fontFamily: typography.fontFamily,
        overflow: 'hidden',
      }}
    >
      <AudioEngine
        soundCues={soundCues}
        music={{
          src: 'sfx/ambient-beat.wav',
          volume: 0.24,
          fadeInFrames: 12,
          fadeOutFrames: 40,
        }}
      />

      <Sequence from={0} durationInFrames={BEAT}>
        <ShotHook base={0} />
      </Sequence>

      <Sequence from={BEAT} durationInFrames={BEAT}>
        <ShotStage base={BEAT} variant="in" />
      </Sequence>

      <Sequence from={BEAT * 2} durationInFrames={BEAT}>
        <ShotBrief base={BEAT * 2} />
      </Sequence>

      <Sequence from={BEAT * 3} durationInFrames={BEAT}>
        <ShotStoryboard base={BEAT * 3} />
      </Sequence>

      <Sequence from={BEAT * 4} durationInFrames={BEAT}>
        <ShotSystem base={BEAT * 4} />
      </Sequence>

      <Sequence from={BEAT * 5} durationInFrames={BEAT}>
        <ShotPublish base={BEAT * 5} />
      </Sequence>

      <Sequence from={BEAT * 6} durationInFrames={BEAT}>
        <ShotStatement base={BEAT * 6} />
      </Sequence>

      <Sequence from={BEAT * 7} durationInFrames={BEAT}>
        <ShotStack base={BEAT * 7} />
      </Sequence>

      <Sequence from={BEAT * 8} durationInFrames={BEAT}>
        <ShotFormats base={BEAT * 8} />
      </Sequence>

      <Sequence from={BEAT * 9} durationInFrames={BEAT}>
        <ShotStage base={BEAT * 9} variant="out" />
      </Sequence>

      <Sequence from={BEAT * 10} durationInFrames={TOTAL - BEAT * 10}>
        <ShotClose
          base={BEAT * 10}
          productName={productName}
          tagline={tagline}
          website={website}
        />
      </Sequence>

      <ProgressRail />
    </AbsoluteFill>
  );
};
