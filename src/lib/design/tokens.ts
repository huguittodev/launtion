/**
 * tokens.ts
 *
 * Single source of truth for colour, typography, spacing, radii and motion
 * timings. Both the Next app and the Remotion engine must read from here.
 *
 * Rules:
 * - No component, atom or route may declare a colour literal. Add a token.
 * - `brand` is the target Vidiaura (Obsidian & Neon Purple) palette.
 * - `sceneThemes` holds semantic roles for rendered video. The palettes that
 *   shipped before this file existed are preserved verbatim so the refactor is
 *   visually inert; the Obsidian theme is the target for new compositions.
 * - `src/app/tokens.generated.css` is generated from this file. Never edit it
 *   by hand: run `npm run tokens`.
 */

/* ========================================================================= */
/* Raw palettes                                                              */
/* ========================================================================= */

/** Target brand palette: Obsidian & Neon Purple. */
export const brand = {
  obsidian: '#030303',
  surface: '#0a0a0c',
  surfaceRaised: '#121216',
  border: 'rgba(255, 255, 255, 0.06)',
  purple: '#7c3aed',
  purpleGlow: '#a855f7',
  purpleAccent: '#bf7afb',
  success: '#22c55e',
  text: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
} as const;

/** Neutral ramp actually used by the shipped compositions. */
export const neutral = {
  cream: '#F5F2EB',
  paper: '#FAF8F4',
  white: '#FFFFFF',
  shell: '#FBF9F5',
  well: '#F7F5F0',
  disabled: '#E6E2D9',
  border: '#ECE7DE',
  borderAlt: '#EFEAE1',
  borderInput: '#EBE7DE',
  borderStrong: '#D6D2C7',
  divider: '#F3EFE9',
  stone: '#EDEAE2',
  ink: '#181716',
  inkEditorial: '#141413',
  inkWarm: '#191816',
  textSecondary: '#555148',
  textMuted: '#76726A',
  textSubtle: '#8A867E',
  textFaint: '#88847C',
  textTertiary: '#A19E95',
  void: '#0D0D10',
  night: '#121215',
  nightRaised: '#141418',
  nightText: '#8A8F98',
  aubergine: '#16121F',
} as const;

/** Accents and semantic signals. */
export const signal = {
  orange: '#FF5C35',
  red: '#EF4444',
  green: '#22C55E',
  trafficRed: '#E75B4D',
  trafficAmber: '#E7A93D',
  trafficGreen: '#4EBA5C',
  indigo: '#5E6AD2',
  indigoBright: '#7C83FF',
} as const;

/** Translucent strokes and glows. */
export const alpha = {
  white04: 'rgba(255, 255, 255, 0.04)',
  white06: 'rgba(255, 255, 255, 0.06)',
  white08: 'rgba(255, 255, 255, 0.08)',
  white12: 'rgba(255, 255, 255, 0.12)',
  accentGlow: 'rgba(255, 92, 53, 0.28)',
  purpleGlow: 'rgba(168, 85, 247, 0.22)',
  purpleHalo: 'rgba(124, 58, 237, 0.45)',
  shadowSoft: 'rgba(0, 0, 0, 0.28)',
  shadowStrong: 'rgba(0, 0, 0, 0.55)',
} as const;

/** Current app chrome. Flips to `brand.obsidian` / `brand.text` in the repaint. */
export const ui = {
  background: '#fbfbfa',
  foreground: '#1a1a1a',
} as const;

/* ========================================================================= */
/* Semantic scene themes                                                     */
/* ========================================================================= */

export type SceneThemeRole =
  | 'background'
  | 'surface'
  | 'surfaceRaised'
  | 'surfaceSunken'
  | 'border'
  | 'borderStrong'
  | 'divider'
  | 'textPrimary'
  | 'textSecondary'
  | 'textMuted'
  | 'textTertiary'
  | 'accent'
  | 'accentContrast';

export type SceneTheme = Readonly<Record<SceneThemeRole, string>>;

export const sceneThemes = {
  /** Warm cream + orange. Default for `base44-studio` / `light-editorial`. */
  lightEditorial: {
    background: neutral.cream,
    surface: neutral.white,
    surfaceRaised: neutral.shell,
    surfaceSunken: neutral.well,
    border: neutral.border,
    borderStrong: neutral.borderStrong,
    divider: neutral.divider,
    textPrimary: neutral.inkEditorial,
    textSecondary: neutral.textSecondary,
    textMuted: neutral.textMuted,
    textTertiary: neutral.textTertiary,
    accent: signal.orange,
    accentContrast: neutral.white,
  },
  /** Paper white. Default for `bento-grid`. */
  studioLight: {
    background: neutral.paper,
    surface: neutral.white,
    surfaceRaised: neutral.shell,
    surfaceSunken: neutral.well,
    border: neutral.border,
    borderStrong: neutral.borderStrong,
    divider: neutral.divider,
    textPrimary: neutral.ink,
    textSecondary: neutral.textSecondary,
    textMuted: neutral.textMuted,
    textTertiary: neutral.textTertiary,
    accent: signal.orange,
    accentContrast: neutral.white,
  },
  /** Near-black. Default for `linear-dark` / `dark-precision`. */
  darkPrecision: {
    background: neutral.void,
    surface: neutral.night,
    surfaceRaised: neutral.nightRaised,
    surfaceSunken: neutral.night,
    border: alpha.white08,
    borderStrong: alpha.white12,
    divider: alpha.white06,
    textPrimary: neutral.white,
    textSecondary: neutral.nightText,
    textMuted: neutral.nightText,
    textTertiary: neutral.nightText,
    accent: signal.indigo,
    accentContrast: neutral.white,
  },
  /** Aubergine. Default for `kinetic-hook` / `aurora-blur`. */
  playful: {
    background: neutral.aubergine,
    surface: neutral.aubergine,
    surfaceRaised: neutral.aubergine,
    surfaceSunken: neutral.aubergine,
    border: alpha.white08,
    borderStrong: alpha.white12,
    divider: alpha.white06,
    textPrimary: neutral.white,
    textSecondary: neutral.nightText,
    textMuted: neutral.nightText,
    textTertiary: neutral.nightText,
    accent: signal.orange,
    accentContrast: neutral.white,
  },
  /** Target: Obsidian & Neon Purple. Use for new compositions. */
  obsidian: {
    background: brand.obsidian,
    surface: brand.surface,
    surfaceRaised: brand.surfaceRaised,
    surfaceSunken: brand.obsidian,
    border: brand.border,
    borderStrong: alpha.white12,
    divider: alpha.white04,
    textPrimary: brand.text,
    textSecondary: brand.textSecondary,
    textMuted: brand.textMuted,
    textTertiary: brand.textMuted,
    accent: brand.purpleGlow,
    accentContrast: brand.text,
  },
} as const satisfies Record<string, SceneTheme>;

export type SceneThemeName = keyof typeof sceneThemes;

/** Accent used when a brief provides no valid colour. */
export const DEFAULT_ACCENT = sceneThemes.lightEditorial.accent;

/* ========================================================================= */
/* Typography, spacing, radii, motion                                        */
/* ========================================================================= */

export const typography = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif",
  monoFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  /** Pixel scale for a 1080p canvas. Multiply down for smaller formats. */
  scale: {
    display: 96,
    headline: 84,
    title: 64,
    body: 32,
    caption: 22,
  },
  weight: {
    regular: 400,
    medium: 500,
    bold: 700,
    black: 850,
  },
  tracking: {
    tight: '-0.045em',
    normal: '0em',
    wide: '0.08em',
  },
  leading: {
    tight: 1.05,
    normal: 1.1,
    relaxed: 1.4,
  },
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
  xxxl: 96,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
} as const;

/** Frame counts assume 30 fps. */
export const motion = {
  fps: 30,
  beatFrames: 45,
  duration: {
    micro: 8,
    quick: 14,
    base: 18,
    scene: 30,
  },
} as const;

/* ========================================================================= */
/* CSS variables                                                             */
/* ========================================================================= */

const CSS_VARIABLES: ReadonlyArray<readonly [string, string]> = [
  ['--brand-obsidian', brand.obsidian],
  ['--brand-surface', brand.surface],
  ['--brand-surface-raised', brand.surfaceRaised],
  ['--brand-border', brand.border],
  ['--brand-purple', brand.purple],
  ['--brand-purple-glow', brand.purpleGlow],
  ['--brand-purple-accent', brand.purpleAccent],
  ['--brand-success', brand.success],
  ['--brand-text', brand.text],
  ['--brand-text-secondary', brand.textSecondary],
  ['--brand-text-muted', brand.textMuted],
  ['--ui-background', ui.background],
  ['--ui-foreground', ui.foreground],
  ['--font-sans', typography.fontFamily],
  ['--font-mono', typography.monoFamily],
  ['--radius-sm', `${radius.sm}px`],
  ['--radius-md', `${radius.md}px`],
  ['--radius-lg', `${radius.lg}px`],
  ['--radius-xl', `${radius.xl}px`],
  ['--radius-pill', `${radius.pill}px`],
  ['--space-xs', `${space.xs}px`],
  ['--space-sm', `${space.sm}px`],
  ['--space-md', `${space.md}px`],
  ['--space-lg', `${space.lg}px`],
  ['--space-xl', `${space.xl}px`],
  ['--space-xxl', `${space.xxl}px`],
  ['--motion-fps', `${motion.fps}`],
  ['--motion-beat-frames', `${motion.beatFrames}`],
];

/** Deterministic CSS text. Mirrors `src/app/tokens.generated.css` byte for byte. */
export function tokensToCss(): string {
  const declarations = CSS_VARIABLES.map(
    ([name, value]) => `  ${name}: ${value};`
  ).join('\n');
  return [
    '/*',
    ' * GENERATED FILE — do not edit.',
    ' * Source: src/lib/design/tokens.ts',
    ' * Regenerate: npm run tokens',
    ' */',
    '',
    ':root {',
    declarations,
    '}',
    '',
  ].join('\n');
}
