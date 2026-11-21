import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { watchLinkEnabled } from './gate';
import { WATCH_SERVICE_NAME } from './protocol';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function source(path) {
  return readFileSync(join(root, path), 'utf8');
}

const swift = [
  'modules/americana-watch-link/ios/WatchWire.swift',
  'modules/americana-watch-link/ios/AmericanaWatchLinkModule.swift',
  'targets/watch/WatchApp.swift',
  'targets/watch/WatchSession.swift',
  'targets/watch/TimerFace.swift',
  'targets/watch/Info.plist',
]
  .map(source)
  .join('\n');

describe('watch privacy and platform gate', () => {
  it('collects no health data', () => {
    expect(swift).not.toMatch(/import\s+HealthKit|HKWorkout|heartRate|NSHealth|com\.apple\.developer\.healthkit|workout-session/i);
  });

  it('advertises the same service name the protocol uses', () => {
    expect(swift).toContain(WATCH_SERVICE_NAME);
    expect(source('targets/watch/Info.plist')).toContain('Advertises');
    expect(source('plugins/withAppleWatch.js')).toContain('Browses');
    expect(source('plugins/withAppleWatch.js')).not.toContain('NSBonjourServices');
  });

  it('runs on Apple TV only', () => {
    expect(watchLinkEnabled({ os: 'ios', tv: true })).toBe(true);
    expect(watchLinkEnabled({ os: 'android', tv: true })).toBe(false);
    expect(watchLinkEnabled({ os: 'ios', tv: false })).toBe(false);
    expect(watchLinkEnabled({ os: 'web', tv: false })).toBe(false);
    const android = source(
      'modules/americana-watch-link/android/src/main/java/expo/modules/americanawatchlink/AmericanaWatchLinkModule.kt',
    );
    expect(android).not.toMatch(/INTERNET|Bluetooth|Health|socket/i);
    expect(android).toContain('return false');
  });
});
