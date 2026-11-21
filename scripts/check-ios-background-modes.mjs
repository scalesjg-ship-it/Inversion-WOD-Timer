/**
 * Guard for App Store Guideline 2.5.4.
 *
 * Generates the iPhone native project (expo prebuild --platform ios, EXPO_TV unset)
 * and fails if Info.plist lists `audio` in UIBackgroundModes. tvOS is a different
 * prebuild (EXPO_TV=1) and is not what this check covers.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iosDir = path.join(root, 'ios');
const bundleId = 'com.garrettscales.americana';

function fail(message) {
  console.error(message);
  return 1;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'Pods' || name === 'build') continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function loadPlist() {
  const loaded = require('@expo/plist');
  return typeof loaded.parse === 'function' ? loaded : loaded.default;
}

function backgroundModes(parsed) {
  const modes = parsed.UIBackgroundModes;
  if (modes == null) return [];
  if (!Array.isArray(modes)) {
    throw new Error(`UIBackgroundModes is ${typeof modes}, expected an array`);
  }
  return modes.map((mode) => String(mode));
}

if (existsSync(iosDir)) {
  console.error('Refusing to prebuild: ios/ already exists. Remove it and rerun. Native projects are generated.');
  process.exit(1);
}

const env = { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' };
delete env.EXPO_TV;

const expoBin = path.join(root, 'node_modules', '.bin', 'expo');
const packageJsonPath = path.join(root, 'package.json');
const packageJsonBefore = readFileSync(packageJsonPath);
let code = 0;
let generated = false;

try {
  generated = true;
  const result = spawnSync(expoBin, ['prebuild', '--platform', 'ios', '--no-install'], {
    cwd: root,
    env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    code = result.status ?? 1;
  } else {
    const files = walk(iosDir);
    const pbx = files.filter((file) => file.endsWith(`${path.sep}project.pbxproj`));
    const project = pbx.map((file) => readFileSync(file, 'utf8')).join('\n');
    if (pbx.length === 0) {
      code = fail('expo prebuild did not write an Xcode project');
    } else if (/appletvos|appletvsimulator/.test(project)) {
      code = fail('Prebuild produced a tvOS project. This check is the non-TV iPhone build (EXPO_TV must be unset).');
    } else if (!/iphoneos/.test(project)) {
      code = fail('Prebuild did not produce an iPhone (iphoneos) project.');
    }

    const plist = loadPlist();
    const appPlists = readdirSync(iosDir)
      .map((name) => path.join(iosDir, name, 'Info.plist'))
      .filter((file) => existsSync(file));
    if (code === 0 && appPlists.length === 0) {
      code = fail('expo prebuild did not write ios/<App>/Info.plist.');
    }
    const bundleIds = [...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = "?([^";]+)"?;/g)].map((match) => match[1]);
    if (code === 0 && !bundleIds.includes(bundleId)) {
      code = fail(`iPhone project bundle id is ${JSON.stringify(bundleIds)}, expected ${bundleId}.`);
    }
    for (const file of appPlists) {
      const parsed = plist.parse(readFileSync(file, 'utf8'));
      const modes = backgroundModes(parsed);
      const relative = path.relative(root, file);
      if (modes.includes('audio')) {
        code = fail(`${relative} UIBackgroundModes includes audio: ${JSON.stringify(modes)}`);
      } else if (code === 0) {
        console.log(`OK ${relative} UIBackgroundModes=${JSON.stringify(modes)}`);
      }
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  code = 1;
} finally {
  if (generated) rmSync(iosDir, { recursive: true, force: true });
  // prebuild rewrites the ios/android npm scripts. Put the committed package.json back.
  writeFileSync(packageJsonPath, packageJsonBefore);
}

process.exit(code);
