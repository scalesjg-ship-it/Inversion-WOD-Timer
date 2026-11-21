import { describe, expect, it, vi } from 'vitest';

import {
  logWatchLink,
  watchButtonVisible,
  watchLinkAfterPickerResult,
  watchLinkMessage,
  watchLinkPhaseFromEvent,
  watchLinkTone,
  type WatchLinkPhase,
} from './linkStatus';

const phases: WatchLinkPhase[] = [
  'idle',
  'looking',
  'connected',
  'unsupported',
  'picker-unavailable',
  'unavailable',
  'cancelled',
  'disconnected',
];

describe('watch link status', () => {
  it('turns native events into a phase and ignores anything else', () => {
    expect(watchLinkPhaseFromEvent('connected')).toBe('connected');
    expect(watchLinkPhaseFromEvent('unsupported')).toBe('unsupported');
    expect(watchLinkPhaseFromEvent('picker-unavailable')).toBe('picker-unavailable');
    expect(watchLinkPhaseFromEvent('unavailable')).toBe('unavailable');
    expect(watchLinkPhaseFromEvent('cancelled')).toBe('cancelled');
    expect(watchLinkPhaseFromEvent('disconnected')).toBe('disconnected');
    expect(watchLinkPhaseFromEvent('stopped')).toBe('idle');
    expect(watchLinkPhaseFromEvent('nope')).toBeNull();
  });

  it('tells an Apple TV HD owner why Watch did nothing', () => {
    expect(watchLinkMessage('unsupported')).toBe('Apple Watch control needs an Apple TV 4K');
    expect(watchButtonVisible('unsupported')).toBe(false);
    expect(watchLinkTone('unsupported')).toBe('alert');
    for (const phase of phases) {
      if (phase === 'unsupported') continue;
      expect(watchButtonVisible(phase)).toBe(true);
    }
  });

  it('has a line for every phase the timer can show', () => {
    expect(watchLinkMessage('idle')).toBeNull();
    expect(watchLinkMessage('looking')).toBe('Looking for Apple Watch…');
    expect(watchLinkMessage('connected')).toBe('Watch connected');
    expect(watchLinkMessage('picker-unavailable')).toBe("Couldn't open the watch picker");
    expect(watchLinkMessage('unavailable')).toBe("Couldn't open the watch picker");
    expect(watchLinkMessage('cancelled')).toBe('Pairing cancelled');
    expect(watchLinkMessage('disconnected')).toBe('Watch disconnected');
  });

  it('lets a specific failure beat a false presentPicker result', () => {
    expect(watchLinkAfterPickerResult('looking', false)).toBe('unsupported');
    expect(watchLinkAfterPickerResult('idle', false)).toBe('unsupported');
    expect(watchLinkAfterPickerResult('unavailable', false)).toBe('unavailable');
    expect(watchLinkAfterPickerResult('cancelled', false)).toBe('cancelled');
    expect(watchLinkAfterPickerResult('looking', true)).toBe('looking');
    expect(watchLinkAfterPickerResult('connected', true)).toBe('connected');
    expect(watchLinkAfterPickerResult('idle', true)).toBe('looking');
  });

  it('logs each phase', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logWatchLink('unsupported', 'isSupported=false');
    expect(spy).toHaveBeenCalledWith('[AmericanaWatchLink] unsupported isSupported=false');
    spy.mockRestore();
  });
});
