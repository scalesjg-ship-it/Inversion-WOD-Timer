import { describe, expect, it } from 'vitest';

import { firstFocusTag, nextSetupVertical, type SetupFocusChain } from './setupFocus';

const tabata: SetupFocusChain = {
  lastRow: ['min-dec', 'min-inc', 'sec-dec', 'sec-inc'],
  bridge: null,
  preset: 'save-preset',
  start: 'start',
};

describe('setup vertical focus', () => {
  it('moves Down from every last-row control straight to Start', () => {
    for (const control of tabata.lastRow) {
      expect(nextSetupVertical(control, 'down', tabata)).toBe('start');
    }
    expect(nextSetupVertical('min-dec', 'up', tabata)).toBe('min-dec');
  });

  it('returns Up from Start to the first control of the last stepper row', () => {
    expect(nextSetupVertical('start', 'up', tabata)).toBe('min-dec');
    expect(nextSetupVertical('start', 'down', tabata)).toBe('start');
    expect(nextSetupVertical('save-preset', 'up', tabata)).toBe('min-dec');
    expect(nextSetupVertical('save-preset', 'down', tabata)).toBe('start');
  });

  it('still lands on Start when the preset row is missing', () => {
    const chain: SetupFocusChain = { ...tabata, preset: null };
    for (const control of chain.lastRow) {
      expect(nextSetupVertical(control, 'down', chain)).toBe('start');
    }
    expect(nextSetupVertical('start', 'up', chain)).toBe('min-dec');
  });

  it('sends the last stepper row to Start even when warning chips sit below it', () => {
    const chain: SetupFocusChain = { ...tabata, bridge: 'warning' };
    expect(nextSetupVertical('min-dec', 'down', chain)).toBe('start');
    expect(nextSetupVertical('sec-inc', 'down', chain)).toBe('start');
    expect(nextSetupVertical('warning', 'down', chain)).toBe('start');
    expect(nextSetupVertical('warning', 'up', chain)).toBe('min-dec');
    expect(nextSetupVertical('start', 'up', chain)).toBe('min-dec');
  });

  it('skips rows that are not mounted', () => {
    expect(firstFocusTag([null, null, 4])).toBe(4);
    expect(firstFocusTag([null, 2, 4])).toBe(2);
    expect(firstFocusTag([null, null])).toBeNull();
  });
});
