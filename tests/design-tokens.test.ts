/**
 * design-tokens.test.ts
 *
 * Guards the single source of truth for colours and the generated CSS bridge.
 *
 * Two zones:
 * - Enforced: `src/lib/**` and `remotion/motion-kit/**` may not contain colour
 *   literals. This is every frame the AI can render.
 * - Ratcheted: legacy compositions and the advanced studio UI still hold
 *   literals. `LEGACY_LITERAL_COUNTS` freezes the debt per file. Lower the
 *   number when you clean a file; never raise it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  alpha,
  brand,
  DEFAULT_ACCENT,
  neutral,
  sceneThemes,
  signal,
  tokensToCss,
  ui,
} from '../src/lib/design/tokens';
import { HexColorRegex } from '../src/lib/scene-graph/schema';

const ROOT = path.resolve(__dirname, '..');
const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/g;

const ENFORCED_DIRECTORIES = ['src/lib', 'remotion/motion-kit'];
const ENFORCED_ALLOWLIST = new Set([normalize('src/lib/design/tokens.ts')]);

/** Literal colours still living in legacy surfaces. Only ever decrease. */
const LEGACY_LITERAL_COUNTS: Record<string, number> = {
  'remotion/compositions/InteractiveSurfaceDemo.tsx': 124,
  'remotion/compositions/LaunchDemo.tsx': 27,
  'remotion/compositions/StudioShowcase.tsx': 40,
  'src/app/editor/SimpleEditor.tsx': 19,
  'src/app/editor/advanced/page.tsx': 3,
  'src/app/editor/page.tsx': 2,
  'src/app/page.tsx': 19,
  'src/app/tokens.generated.css': 12,
  'src/components/editor/AssetIntelligenceModal.tsx': 20,
  'src/components/editor/CameraFocalPicker.tsx': 12,
  'src/components/editor/CreativeDirectorModal.tsx': 23,
  'src/components/editor/EditorHeader.tsx': 17,
  'src/components/editor/EditorSidebar.tsx': 10,
  'src/components/editor/ExportModal.tsx': 20,
  'src/components/editor/ProjectSelectorModal.tsx': 13,
  'src/components/editor/RemotionPlayerPreview.tsx': 8,
  'src/components/editor/ScreenRecorderModal.tsx': 10,
  'src/components/editor/TextCustomizer.tsx': 7,
  'src/components/editor/ThemeCustomizer.tsx': 34,
  'src/components/editor/TimelineControl.tsx': 7,
};

const LEGACY_DIRECTORIES = ['remotion/compositions', 'src/components', 'src/app'];

function normalize(p: string): string {
  return p.split(path.sep).join('/');
}

function collectFiles(directory: string, extensions: string[]): string[] {
  const absolute = path.resolve(ROOT, directory);
  if (!fs.existsSync(absolute)) return [];

  const found: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = normalize(path.join(directory, entry.name));
    if (entry.isDirectory()) {
      found.push(...collectFiles(relative, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      found.push(relative);
    }
  }
  return found;
}

function countLiterals(relativePath: string): number {
  const source = fs.readFileSync(path.resolve(ROOT, relativePath), 'utf-8');
  return source.match(HEX_LITERAL)?.length ?? 0;
}

describe('design tokens', () => {
  test('1. every colour token is a valid hex or rgba value', () => {
    const rgba = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (0|1|0?\.\d+)\)$/;
    const palettes: Record<string, string> = {
      ...brand,
      ...neutral,
      ...signal,
      ...alpha,
      ...ui,
    };

    for (const [name, value] of Object.entries(palettes)) {
      assert.ok(
        HexColorRegex.test(value) || rgba.test(value),
        `Token "${name}" is not a valid colour: ${value}`
      );
    }
  });

  test('2. every scene theme fills every semantic role', () => {
    const roles = Object.keys(sceneThemes.obsidian).sort();
    assert.deepEqual(roles, [
      'accent',
      'accentContrast',
      'background',
      'border',
      'borderStrong',
      'divider',
      'surface',
      'surfaceRaised',
      'surfaceSunken',
      'textMuted',
      'textPrimary',
      'textSecondary',
      'textTertiary',
    ]);

    for (const [name, theme] of Object.entries(sceneThemes)) {
      for (const role of roles) {
        assert.ok(
          typeof (theme as Record<string, string>)[role] === 'string',
          `Theme "${name}" is missing role "${role}"`
        );
      }
    }
  });

  test('3. the default accent is a valid hex that the SceneGraph schema accepts', () => {
    assert.equal(DEFAULT_ACCENT, sceneThemes.lightEditorial.accent);
    assert.ok(HexColorRegex.test(DEFAULT_ACCENT), DEFAULT_ACCENT);
  });

  test('4. tokens.generated.css is byte-identical to tokensToCss()', () => {
    const generated = fs.readFileSync(
      path.resolve(ROOT, 'src/app/tokens.generated.css'),
      'utf-8'
    );
    assert.equal(
      generated,
      tokensToCss(),
      'tokens.generated.css is stale. Run: npm run tokens'
    );
  });

  test('5. no colour literals in the enforced zones', () => {
    const offenders: string[] = [];

    for (const directory of ENFORCED_DIRECTORIES) {
      for (const file of collectFiles(directory, ['.ts', '.tsx'])) {
        if (ENFORCED_ALLOWLIST.has(file)) continue;
        const count = countLiterals(file);
        if (count > 0) offenders.push(`${file} (${count})`);
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `Colour literals must live in src/lib/design/tokens.ts. Offenders: ${offenders.join(', ')}`
    );
  });

  test('6. globals.css consumes variables instead of colour literals', () => {
    const css = fs.readFileSync(path.resolve(ROOT, 'src/app/globals.css'), 'utf-8');
    assert.equal(css.match(HEX_LITERAL)?.length ?? 0, 0);
    assert.match(css, /@import "\.\/tokens\.generated\.css";/);
    assert.match(css, /var\(--ui-background\)/);
  });

  test('7. legacy debt is frozen: no new literals, no silent growth', () => {
    const actual: Record<string, number> = {};

    for (const directory of LEGACY_DIRECTORIES) {
      for (const file of collectFiles(directory, ['.ts', '.tsx', '.css'])) {
        const count = countLiterals(file);
        if (count > 0) actual[file] = count;
      }
    }

    for (const [file, expected] of Object.entries(LEGACY_LITERAL_COUNTS)) {
      assert.ok(
        fs.existsSync(path.resolve(ROOT, file)),
        `Ratchet entry points at a missing file: ${file}`
      );
      assert.equal(
        actual[file] ?? 0,
        expected,
        `${file}: expected ${expected} colour literals. If you cleaned it, lower the ratchet; do not add new ones.`
      );
    }

    const unexpected = Object.keys(actual).filter(
      (file) => !(file in LEGACY_LITERAL_COUNTS)
    );
    assert.deepEqual(
      unexpected,
      [],
      `New files with colour literals must use tokens instead: ${unexpected.join(', ')}`
    );
  });
});
