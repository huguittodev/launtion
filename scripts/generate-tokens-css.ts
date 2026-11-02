/**
 * generate-tokens-css.ts
 *
 * Writes the CSS variable bridge between the design tokens and the Next app.
 * Usage:
 *   npx tsx scripts/generate-tokens-css.ts
 *   npx tsx scripts/generate-tokens-css.ts --verify   (exit 1 if stale)
 */

import fs from 'node:fs';
import path from 'node:path';
import { tokensToCss } from '../src/lib/design/tokens';

const OUTPUT_PATH = path.resolve(
  __dirname,
  '..',
  'src',
  'app',
  'tokens.generated.css'
);

function main(): void {
  const verify = process.argv.includes('--verify');
  const expected = tokensToCss();
  const current = fs.existsSync(OUTPUT_PATH)
    ? fs.readFileSync(OUTPUT_PATH, 'utf-8')
    : null;

  if (verify) {
    if (current !== expected) {
      console.error(
        `tokens.generated.css is stale. Run: npm run tokens (${OUTPUT_PATH})`
      );
      process.exit(1);
    }
    console.log('tokens.generated.css is up to date.');
    return;
  }

  if (current === expected) {
    console.log('tokens.generated.css already up to date.');
    return;
  }

  fs.writeFileSync(OUTPUT_PATH, expected, 'utf-8');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
