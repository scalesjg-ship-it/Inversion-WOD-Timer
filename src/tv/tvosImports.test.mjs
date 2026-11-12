import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Two ways a package takes down an Apple TV screen the moment Expo Router loads it:
 *
 * 1. Its podspec leaves out tvOS, and its JS calls `requireNativeModule` (not the
 *    optional variant). Importing it throws "Cannot find native module".
 * 2. Its JS constructs `new NativeEventEmitter(NativeModules.X)` at module scope.
 *    On Apple TV `Platform.OS` is still `ios`, so a missing native class throws
 *    "`new NativeEventEmitter()` requires a non-null argument." Expo's production
 *    handler rewrites that to "a native module that doesn't exist", which is the
 *    Brand-tab boundary. `react-native-tcp-socket` does this: its podspec lists
 *    tvOS, but `SecPKCS12Import` is not in the tvOS SDK, so the class is absent.
 *
 * Such packages must be loaded with `await import()` after a presence check,
 * never with a top-level `import`.
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

/**
 * True when the package builds `new NativeEventEmitter(someNativeModule)` while
 * the module is still being evaluated. An object-literal stub is not that.
 */
function eventEmitterAtLoad(pkg) {
  const dir = join(ROOT, 'node_modules', pkg);
  const files = [...jsFiles(join(dir, 'src')), ...jsFiles(join(dir, 'build'))];
  return files.some((file) =>
    /^const \w+ = new NativeEventEmitter\([A-Za-z_$][\w$]*\);/m.test(readFileSync(file, 'utf8')),
  );
}

/** True when importing the package on Apple TV throws before any app code runs. */
function crashesWhenImportedOnAppleTv(pkg) {
  return throwsOnTvos(pkg) || eventEmitterAtLoad(pkg);
}

/** True when a missing tvOS pod plus requireNativeModule throws on import. */
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
    expect(throwsOnTvos('expo-image')).toBe(false);
    expect(throwsOnTvos('expo-image-manipulator')).toBe(false);
    expect(throwsOnTvos('expo-file-system')).toBe(false);
    expect(throwsOnTvos('expo-network')).toBe(false);
    expect(eventEmitterAtLoad('react-native-tcp-socket')).toBe(true);
  });

  it.skipIf(!installed)('never imports an Apple-TV-crashing native package at the top of a file', () => {
    const offenders = [];
    for (const dir of SOURCE_DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        for (const specifier of valueImports(readFileSync(file, 'utf8'))) {
          const pkg = packageName(specifier);
          if (pkg && crashesWhenImportedOnAppleTv(pkg)) offenders.push(`${relative(ROOT, file)} imports ${specifier}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
