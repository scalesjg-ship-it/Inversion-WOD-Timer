import { describe, expect, it, vi } from 'vitest';

import {
  displayedWatchPhase,
  logWatchLink,
  watchButtonVisible,
  watchLinkAfterPickerResult,
  watchLinkMessage,
  watchLinkPhaseFromEvent,
  watchLinkTone,
  watchPairOfferVisible,
  watchUnpairVisible,
  type WatchLinkPhase,
} from './linkStatus';

const phases: WatchLinkPhase[] = [
  'idle',
  'looking',
  'connected',
  'pairing',
  'reconnecting',
  'picker-unavailable',
  'unavailable',
  'cancelled',
  'disconnected',
];

describe('watch link status', () => {
  it('turns native events into a phase and ignores anything else', () => {
    expect(watchLinkPhaseFromEvent('connected')).toBe('connected');
    expect(watchLinkPhaseFromEvent('unsupported')).toBe('pairing');
    expect(watchLinkPhaseFromEvent('pairing')).toBe('pairing');
    expect(watchLinkPhaseFromEvent('reconnecting')).toBe('reconnecting');
    expect(watchLinkPhaseFromEvent('picker-unavailable')).toBe('picker-unavailable');
    expect(watchLinkPhaseFromEvent('unavailable')).toBe('unavailable');
    expect(watchLinkPhaseFromEvent('cancelled')).toBe('cancelled');
    expect(watchLinkPhaseFromEvent('disconnected')).toBe('disconnected');
    expect(watchLinkPhaseFromEvent('stopped')).toBe('idle');
    expect(watchLinkPhaseFromEvent('nope')).toBeNull();
  });

  it('keeps Watch on screen for Apple TV HD and explains code pairing', () => {
    expect(watchLinkMessage('pairing')).toBe('Enter this code on your Apple Watch. Both need internet.');
    expect(watchLinkMessage('pairing')).not.toContain('4K');
    expect(watchLinkMessage('pairing', false)).toContain('internet');
    expect(watchLinkMessage('pairing', false)).toContain('not on this TV yet');
    expect(watchLinkMessage('reconnecting')).toBe('Reconnecting to Apple Watch…');
    for (const phase of phases) {
      expect(watchButtonVisible(phase)).toBe(true);
      expect(watchLinkMessage(phase) ?? '').not.toContain('needs an Apple TV 4K');
    }
  });

  it('offers Pair with code after the 4K picker, and Unpair once a relay pairing is saved', () => {
    expect(watchPairOfferVisible('looking', false)).toBe(true);
    expect(watchPairOfferVisible('cancelled', false)).toBe(true);
    expect(watchPairOfferVisible('disconnected', false)).toBe(true);
    expect(watchPairOfferVisible('idle', false)).toBe(false);
    expect(watchPairOfferVisible('connected', false)).toBe(false);
    expect(watchPairOfferVisible('pairing', false)).toBe(false);
    expect(watchPairOfferVisible('cancelled', true)).toBe(false);
    expect(watchUnpairVisible(true)).toBe(true);
    expect(watchUnpairVisible(false)).toBe(false);
  });

  it('has a line for every phase the timer can show', () => {
    expect(watchLinkMessage('idle')).toBeNull();
    expect(watchLinkMessage('looking')).toBe('Looking for Apple Watch…');
    expect(watchLinkMessage('connected')).toBe('Watch connected');
    expect(watchLinkMessage('picker-unavailable')).toBe("Couldn't open the watch picker");
    expect(watchLinkMessage('unavailable')).toBe("Couldn't open the watch picker");
    expect(watchLinkMessage('cancelled')).toBe('Pairing cancelled');
    expect(watchLinkMessage('disconnected')).toBe('Watch disconnected');
    expect(watchLinkTone('pairing')).toBe('neutral');
    expect(watchLinkTone('cancelled')).toBe('alert');
    expect(watchLinkTone('connected')).toBe('neutral');
  });

  it('lets a failed picker become code pairing, and a specific failure stay', () => {
    expect(watchLinkAfterPickerResult('looking', false)).toBe('pairing');
    expect(watchLinkAfterPickerResult('idle', false)).toBe('pairing');
    expect(watchLinkAfterPickerResult('unavailable', false)).toBe('unavailable');
    expect(watchLinkAfterPickerResult('cancelled', false)).toBe('cancelled');
    expect(watchLinkAfterPickerResult('looking', true)).toBe('looking');
    expect(watchLinkAfterPickerResult('connected', true)).toBe('connected');
    expect(watchLinkAfterPickerResult('idle', true)).toBe('looking');
  });

  it('prefers a live code, then whichever transport is connected', () => {
    expect(displayedWatchPhase('idle', { phase: 'pairing', code: '123456' })).toBe('pairing');
    expect(displayedWatchPhase('looking', { phase: 'connected', code: null })).toBe('connected');
    expect(displayedWatchPhase('connected', { phase: 'reconnecting', code: null })).toBe('connected');
    expect(displayedWatchPhase('idle', { phase: 'reconnecting', code: null })).toBe('reconnecting');
    expect(displayedWatchPhase('idle', { phase: 'joining', code: null })).toBe('reconnecting');
    expect(displayedWatchPhase('cancelled', { phase: 'off', code: null })).toBe('cancelled');
  });

  it('logs each phase', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    logWatchLink('pairing', 'code');
    expect(spy).toHaveBeenCalledWith('[AmericanaWatchLink] pairing code');
    spy.mockRestore();
  });
});
