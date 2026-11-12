import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * A package whose podspec leaves out tvOS is not compiled into the Apple TV app.
 * If its JS calls `requireNativeModule` (not the optional variant), importing it
 * throws "Cannot find native module", and a release build closes on the spot.
 * Expo Router loads a screen's file the first time it is shown, so the crash
 * lands when that screen opens: Start opens the timer, the Brand tab opens Brand.
 *
 * Such packages must be loaded with `await import()` behind a TV check, never
 * with a top-level `import`.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE_DIRS = ['app', 'src'];

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.web\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

function packageName(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('@/')) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** Static value imports and re-exports. `import type` is erased and is safe. */
function valueImports(source) {
  const found = [];
  const pattern = /^\s*(import|export)\s+(?!type\s)[^'";]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;
  for (const match of source.matchAll(pattern)) {
    const specifier = match[2] ?? match[3];
    if (specifier) found.push(specifier);
  }
  return found;
}

function podspecs(dir, depth) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name.endsWith('.podspec')) out.push(path);
    else if (depth > 0 && name !== 'node_modules' && statSync(path).isDirectory()) out.push(...podspecs(path, depth - 1));
  }
  return out;
}

function jsFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...jsFiles(path));
    else if (name.endsWith('.js') && !/\.(web|android)\.js$/.test(name)) out.push(path);
  }
  return out;
}

const verdicts = new Map();

/** True when importing the package on Apple TV throws. */
function throwsOnTvos(pkg) {
  const cached = verdicts.get(pkg);
  if (cached !== undefined) return cached;
  const dir = join(ROOT, 'node_modules', pkg);
  const specs = podspecs(dir, 1);
  const buildsForTvos = specs.length === 0 || specs.some((spec) => /tvos/.test(readFileSync(spec, 'utf8')));
  const hardRequire =
    !buildsForTvos &&
    jsFiles(join(dir, 'build')).some((file) => /\brequireNativeModule\(/.test(readFileSync(file, 'utf8')));
  verdicts.set(pkg, hardRequire);
  return hardRequire;
}

describe('Apple TV imports', () => {
  const installed = existsSync(join(ROOT, 'node_modules', 'expo-notifications'));

  it.skipIf(!installed)('flags the packages that crashed the Apple TV build', () => {
    expect(throwsOnTvos('expo-notifications')).toBe(true);
    expect(throwsOnTvos('expo-image-picker')).toBe(true);
    expect(throwsOnTvos('expo-document-picker')).toBe(true);
    expect(throwsOnTvos('expo-haptics')).toBe(false);
    expect(throwsOnTvos('expo-audio')).toBe(false);
  });

  it.skipIf(!installed)('never imports an iOS-only native package at the top of a file', () => {
    const offenders = [];
    for (const dir of SOURCE_DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        for (const specifier of valueImports(readFileSync(file, 'utf8'))) {
          const pkg = packageName(specifier);
          if (pkg && throwsOnTvos(pkg)) offenders.push(`${relative(ROOT, file)} imports ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
