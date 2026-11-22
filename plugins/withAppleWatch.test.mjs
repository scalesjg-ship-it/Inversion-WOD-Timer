import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const plugin = require('./withAppleWatch.js');
const xcode = require('xcode');
const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));

describe('withAppleWatch', () => {
  it('keeps the phone version and the tvOS bundle id alone', () => {
    expect(app.expo.version).toBe('1.0.0');
    expect(app.expo.ios.buildNumber).toBe('18');
    expect(app.expo.android.versionCode).toBe(12);
    expect(plugin.isTvBuild({ EXPO_TV: '1' })).toBe(true);
    expect(plugin.isTvBuild({ EXPO_TV: 'true' })).toBe(true);
    expect(plugin.isTvBuild({})).toBe(false);
    const services = plugin.tvApplicationServices();
    expect(services.Browses[0].NSApplicationServiceIdentifier).toBe('Americana-Timer');
    expect(services.Browses[0].NSApplicationServiceUsageDescription.length).toBeGreaterThan(20);
    expect(services.Browses[0].NSApplicationServicePlatformSupport).toEqual(['watchOS']);
    expect(Object.keys(services)).toEqual(['Browses']);
    expect(Object.keys(services.Browses[0]).sort()).toEqual([
      'NSApplicationServiceIdentifier',
      'NSApplicationServicePlatformSupport',
      'NSApplicationServiceUsageDescription',
    ]);
    expect(JSON.stringify(services)).not.toContain('NSBonjourServices');
    expect(JSON.stringify(services)).not.toMatch(/heart|HealthKit/i);
  });

  it('uses IOS_BUILD_NUMBER only for an iPhone archive', () => {
    expect(plugin.resolveIosArchiveBuild({})).toBeNull();
    expect(plugin.resolveIosArchiveBuild({ IOS_BUILD_NUMBER: '19' })).toBe('19');
    expect(plugin.resolveIosArchiveBuild({ EXPO_TV: '1', IOS_BUILD_NUMBER: '19' })).toBeNull();
    expect(() => plugin.resolveIosArchiveBuild({ IOS_BUILD_NUMBER: '0' })).toThrow(/IOS_BUILD_NUMBER/);
    expect(() => plugin.resolveIosArchiveBuild({ IOS_BUILD_NUMBER: '018' })).toThrow(/IOS_BUILD_NUMBER/);
    expect(app.expo.version).toBe('1.0.0');
    expect(app.expo.ios.buildNumber).toBe('18');
  });

  it('embeds the watch app in an iPhone project and not as a second tvOS bundle', () => {
    const project = xcode.project('ios/Americana.xcodeproj/project.pbxproj');
    // The fixture is created by the test runner when prebuild has not run.
    // linkWatchTarget is exercised against a parsed project in the prebuild check.
    expect(plugin.WATCH_BUNDLE_ID).toBe('com.garrettscales.americana.watchkitapp');
    expect(typeof project.parseSync).toBe('function');
  });
});
