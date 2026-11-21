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

  it('shows preview faces only from a DEBUG screenshot launch argument', () => {
    const session = source('targets/watch/WatchSession.swift');
    const regions = [...session.matchAll(/#if DEBUG([\s\S]*?)#endif/g)].map((match) => match[1]);
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.some((region) => region.includes('-AmericanaWatchPreview'))).toBe(true);
    expect(regions.some((region) => region.includes('launchPreviewModel'))).toBe(true);
    expect(session.replace(/#if DEBUG[\s\S]*?#endif/g, '')).not.toContain('-AmericanaWatchPreview');
    const face = source('targets/watch/TimerFace.swift');
    expect(face).toContain('enum WatchPreviewFace');
    for (const name of ['waiting', 'getReady', 'work', 'rest', 'finished']) {
      expect(face).toContain(`case ${name}`);
    }
    expect(face).toContain('WatchPreviewFace.getReady.model');
    expect(session).toContain('showsLaunchPreview');
    expect(session).toContain('Waiting for Apple TV');
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
