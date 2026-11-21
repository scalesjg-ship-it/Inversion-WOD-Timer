import { describe, expect, it } from 'vitest';

import { modeTitle } from '../timer/labels';
import type { TimerMode } from '../timer/types';

import { HELP_MODE_LINES, helpNeighbors, helpPlatform, helpSections, helpVersionLine } from './copy';

const MODES: TimerMode[] = ['forTime', 'amrap', 'emom', 'tabata', 'intervals', 'rounds', 'countdown'];

describe('help copy', () => {
  it('picks a platform from the runtime', () => {
    expect(helpPlatform({ os: 'ios', tv: true })).toBe('appletv');
    expect(helpPlatform({ os: 'android', tv: true })).toBe('androidtv');
    expect(helpPlatform({ os: 'ios', tv: false })).toBe('phone');
    expect(helpPlatform({ os: 'android', tv: false })).toBe('phone');
  });

  it('tells Apple TV and iPhone that Watch needs an Apple TV 4K, and not this Fire TV', () => {
    const apple = helpSections('appletv').find((section) => section.id === 'help-watch');
    const phone = helpSections('phone').find((section) => section.id === 'help-watch');
    const android = helpSections('androidtv').find((section) => section.id === 'help-watch');
    expect(apple?.body).toContain('Apple TV 4K');
    expect(apple?.body).toContain('Apple TV HD');
    expect(apple?.body).toContain('tvOS 16');
    expect(apple?.body).toContain('same Wi-Fi');
    expect(apple?.body).toContain('iCloud');
    expect(apple?.body).toContain('press Watch');
    expect(apple?.body).toContain('start, pause, resume, and reset');
    expect(apple?.body).toContain('taps your wrist');
    expect(phone?.body).toContain('Apple TV 4K');
    expect(phone?.body).toContain('Apple TV HD');
    expect(android?.body).toContain('Apple TV 4K');
    expect(android?.body).not.toContain('press Watch');
  });

  it('matches Back on a running timer and the phone clock tap', () => {
    const remote = helpSections('appletv').find((section) => section.id === 'help-remote');
    expect(remote?.body).toContain('Select pauses or resumes');
    expect(remote?.body).toContain('Back on a running timer pauses it and stays');
    expect(remote?.body).toContain('Back again leaves');
    expect(remote?.body).toContain('If Select already paused the timer, the first Back stays');
    expect(helpSections('androidtv').find((section) => section.id === 'help-remote')?.body).toBe(remote?.body);
    const phone = helpSections('phone').find((section) => section.id === 'help-remote');
    expect(phone?.body).toContain('Tap the clock to pause or resume');
    expect(phone?.body).toContain('Back leaves the timer');
  });

  it('describes the QR logo on TV and the photo picker on the phone', () => {
    const tv = helpSections('appletv').find((section) => section.id === 'help-logo');
    expect(tv?.body).toContain('QR code');
    expect(tv?.body).toContain('same Wi-Fi');
    expect(tv?.body).toContain('not sent to a server');
    const phone = helpSections('phone').find((section) => section.id === 'help-logo');
    expect(phone?.body).toContain('Photo library');
    expect(phone?.body).toContain('Files');
    expect(phone?.body).toContain('QR code');
  });

  it('describes save, load, update, rename, and delete', () => {
    const presets = helpSections('appletv').find((section) => section.id === 'help-presets');
    expect(presets?.body).toContain('Save preset');
    expect(presets?.body).toContain('load');
    expect(presets?.body).toContain('Update');
    expect(presets?.body).toContain('Rename');
    expect(presets?.body).toContain('Delete');
    expect(presets?.body).toContain('cannot share a name');
  });

  it('has one line for every timer mode', () => {
    for (const mode of MODES) {
      expect(HELP_MODE_LINES[mode].length).toBeGreaterThan(10);
      const section = helpSections('phone').find((item) => item.id === `help-mode-${mode}`);
      expect(section?.title).toBe(modeTitle(mode));
      expect(section?.body).toBe(HELP_MODE_LINES[mode]);
    }
    const ids = helpSections('appletv').map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('chains focus from the tab bar through every section', () => {
    const ids = [...helpSections('appletv').map((section) => section.id), 'help-version'];
    const links = helpNeighbors(ids);
    expect(links[0]).toEqual({ id: 'help-watch', up: null, down: 'help-remote' });
    expect(links[links.length - 1]).toEqual({ id: 'help-version', up: 'help-mode-countdown', down: 'help-version' });
    let cursor = links[0]?.id;
    const seen: string[] = [];
    while (cursor && !seen.includes(cursor)) {
      seen.push(cursor);
      const next = links.find((link) => link.id === cursor);
      const down = next?.down;
      if (!down || down === cursor) break;
      cursor = down;
    }
    expect(seen).toEqual(ids);
  });

  it('prints the installed version and build', () => {
    expect(helpVersionLine('1.0.1', '25')).toBe('Version 1.0.1 (25)');
    expect(helpVersionLine('1.0.0', '')).toBe('Version 1.0.0');
    expect(helpVersionLine(null, null)).toBe('Version 1.0.0');
  });
});
