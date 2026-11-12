import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.json', '.md', '.html', '.css', '.py', '.svg', '.txt']);

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

describe('product name', () => {
  it('uses Anthem Gym Timer in public copy and keeps americana identifiers', () => {
    const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
    const productName = 'Anthem Gym Timer';
    expect(readFileSync(join(ROOT, 'src/productName.ts'), 'utf8')).toContain(
      `export const PRODUCT_NAME = '${productName}'`,
    );
    expect(app.expo.name).toBe(productName);
    expect(app.expo.slug).toBe('americana');
    expect(app.expo.scheme).toBe('americana');
    expect(app.expo.owner).toBe('scalesgym');
    expect(app.expo.ios.bundleIdentifier).toBe('com.garrettscales.americana');
    expect(app.expo.android.package).toBe('com.garrettscales.americana');
    expect(app.expo.ios.infoPlist.NSPhotoLibraryUsageDescription.startsWith(productName)).toBe(true);
    expect(app.expo.ios.infoPlist.NSLocalNetworkUsageDescription.startsWith(productName)).toBe(true);
    expect(readFileSync(join(ROOT, 'src/timer/presetStore.ts'), 'utf8')).toContain(
      "export const PRESET_STORAGE_KEY = 'americana.presets.v1'",
    );

    const scheduler = readFileSync(join(ROOT, 'src/audio/cueScheduler.ts'), 'utf8');
    expect(scheduler).toContain('return `americana-${sound}`');
    expect(scheduler).toContain('`Anthem Gym Timer ${sound}`');
    expect(readFileSync(join(ROOT, 'app/timer.tsx'), 'utf8')).toContain("'americana-timer'");
    expect(readFileSync(join(ROOT, 'src/branding/storage.ts'), 'utf8')).toContain("'americana.branding.v1'");

    const self = join(ROOT, 'src/productName.test.mjs');
    const hits = textFiles(ROOT).filter((path) => {
      if (path === self) return false;
      const text = readFileSync(path, 'utf8');
      return text.includes('Americana') || text.includes('AMERICANA');
    });
    expect(hits.map((path) => relative(ROOT, path))).toEqual([]);
  });
});
