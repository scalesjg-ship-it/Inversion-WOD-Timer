import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.html',
  '.css',
  '.py',
  '.svg',
  '.txt',
  '.plist',
  '.yml',
  '.yaml',
  '.swift',
  '.kt',
  '.m',
  '.sh',
  '.pro',
  '.podspec',
  '.gradle',
  '.xml',
]);

/** Signing checks the Apple team legal name. That string is not a gym-name default. */
const SIGNING = new Set([
  'scripts/ci-ios-install-signing.sh',
  'scripts/ci-ios-signing.py',
  'scripts/ci-ios-signing.test.py',
  'scripts/ci-tvos-install-signing.sh',
  'scripts/ci-tvos-signing.py',
  'scripts/ci-tvos-signing.test.py',
  '.github/workflows/appletv-signed-testflight.yml',
  '.github/workflows/iphone-signed-testflight.yml',
]);

function textFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.expo') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      textFiles(path, out);
      continue;
    }
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot) : '';
    if (TEXT_EXT.has(ext) || name === 'LICENSE') out.push(path);
  }
  return out;
}

/** Color-set ids and the repository name are not labels on screen. */
function withoutInternalIds(text) {
  return text
    .replaceAll("id: 'inversion-classic'", '')
    .replaceAll("id: 'inversion'", '')
    .replaceAll("paletteId: 'inversion'", '')
    .replaceAll('template-inversion-classic', '')
    .replaceAll('Inversion-WOD-Timer', '');
}

describe('neutral default gym', () => {
  it('names the first-run gym Your Gym and resets to that default', () => {
    const types = readFileSync(join(ROOT, 'src/branding/types.ts'), 'utf8');
    expect(types).toContain("export const DEFAULT_GYM_NAME = 'Your Gym'");
    expect(types).toContain("gymName: DEFAULT_GYM_NAME");
    expect(types).toContain("export const RESET_BRAND_LABEL = 'Reset to default'");
    expect(types).toContain(
      'Restore the default colors and the name ${DEFAULT_GYM_NAME}, and remove the logo from this device?',
    );

    const provider = readFileSync(join(ROOT, 'src/branding/BrandingProvider.tsx'), 'utf8');
    expect(provider).toContain('persist(DEFAULT_BRANDING)');
    const phone = readFileSync(join(ROOT, 'app/(tabs)/brand.tsx'), 'utf8');
    expect(phone).toContain('RESET_BRAND_LABEL');
    expect(phone).toContain('RESET_BRAND_MESSAGE');
    expect(readFileSync(join(ROOT, 'src/components/TvSettings.tsx'), 'utf8')).toContain('RESET_BRAND_LABEL');
  });

  it('keeps the old gym name out of user-visible copy', () => {
    const needle = 'inver' + 'sion';
    const hits = textFiles(ROOT).flatMap((path) => {
      const rel = relative(ROOT, path);
      if (SIGNING.has(rel)) return [];
      const text = withoutInternalIds(readFileSync(path, 'utf8'));
      return text.toLowerCase().includes(needle) ? [rel] : [];
    });
    expect(hits).toEqual([]);
  });
});
