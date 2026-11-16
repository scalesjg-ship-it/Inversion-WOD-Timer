import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { stripBackgroundAudioMode } = require('../../plugins/withTvForegroundAudio.js');
const { TVOS_BUILD_NUMBER, applyTvBuildNumber } = require('../../plugins/withTvBuildNumber.js');

const app = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../app.json'), 'utf8'));

describe('tvOS foreground audio', () => {
  it('removes the audio background mode and leaves any other modes', () => {
    const plist = { UIBackgroundModes: ['audio', 'fetch'] };
    stripBackgroundAudioMode(plist);
    expect(plist.UIBackgroundModes).toEqual(['fetch']);
  });

  it('drops the key when audio was the only background mode', () => {
    const plist = { UIBackgroundModes: ['audio'], CFBundleName: 'Americana' };
    stripBackgroundAudioMode(plist);
    expect(plist.UIBackgroundModes).toBeUndefined();
    expect(plist.CFBundleName).toBe('Americana');
  });

  it('leaves a plist that never declared background modes', () => {
    const plist = { CFBundleName: 'Americana' };
    expect(stripBackgroundAudioMode(plist)).toBe(plist);
  });

  it('is registered before expo-audio so the tvOS removal runs last', () => {
    const plugins = app.expo.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
    const strip = plugins.indexOf('./plugins/withTvForegroundAudio');
    const audio = plugins.indexOf('expo-audio');
    expect(strip).toBeGreaterThan(-1);
    expect(audio).toBeGreaterThan(strip);
  });

  it('sets the tvOS build and the Android version code for the next artifacts', () => {
    expect(app.expo.ios.buildNumber).toBe('18');
    expect(app.expo.android.versionCode).toBe(10);
    expect(app.expo.ios.infoPlist.UIBackgroundModes).toEqual(['audio']);
    expect(TVOS_BUILD_NUMBER).toBe('22');
    expect(applyTvBuildNumber({ ios: { buildNumber: '18' } }, {}).ios.buildNumber).toBe('18');
    expect(applyTvBuildNumber({ ios: { buildNumber: '18' } }, { EXPO_TV: '1' }).ios.buildNumber).toBe('22');
    const plugins = app.expo.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
    expect(plugins).toContain('./plugins/withTvBuildNumber');
  });
});
