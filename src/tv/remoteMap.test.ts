import { describe, expect, it } from 'vitest';

import { mapRemoteEvent, shouldHandleKeyAction, type RemoteContext } from './remoteMap';

const hidden: RemoteContext = { mode: 'countdown', controlsVisible: false, confirmOpen: false };
const rounds: RemoteContext = { mode: 'rounds', controlsVisible: false, confirmOpen: false };
const shown: RemoteContext = { mode: 'countdown', controlsVisible: true, confirmOpen: false };
const confirming: RemoteContext = { mode: 'amrap', controlsVisible: false, confirmOpen: true };

describe('remote key mapping', () => {
  it('ignores key-up so a press does not run twice', () => {
    expect(shouldHandleKeyAction(1)).toBe(false);
    expect(shouldHandleKeyAction(0)).toBe(true);
    expect(shouldHandleKeyAction(-1)).toBe(true);
    expect(shouldHandleKeyAction(undefined)).toBe(true);
  });

  it('starts and pauses from select or play/pause on either remote', () => {
    expect(mapRemoteEvent('select', hidden)).toEqual({ type: 'toggle' });
    expect(mapRemoteEvent('playPause', hidden)).toEqual({ type: 'toggle' });
    expect(mapRemoteEvent('play', hidden)).toEqual({ type: 'toggle' });
    expect(mapRemoteEvent('pause', hidden)).toEqual({ type: 'toggle' });
  });

  it('asks before reset on a long select', () => {
    expect(mapRemoteEvent('longSelect', hidden)).toEqual({ type: 'confirmReset' });
  });

  it('seeks ten seconds with the d-pad or media keys', () => {
    expect(mapRemoteEvent('left', hidden)).toEqual({ type: 'seek', seconds: -10 });
    expect(mapRemoteEvent('right', hidden)).toEqual({ type: 'seek', seconds: 10 });
    expect(mapRemoteEvent('rewind', hidden)).toEqual({ type: 'seek', seconds: -10 });
    expect(mapRemoteEvent('fastForward', hidden)).toEqual({ type: 'seek', seconds: 10 });
    expect(mapRemoteEvent('swipeLeft', { ...hidden, mode: 'amrap' })).toEqual({ type: 'seek', seconds: -10 });
    expect(mapRemoteEvent('swipeRight', { ...hidden, mode: 'forTime' })).toEqual({ type: 'seek', seconds: 10 });
  });

  it('steps rounds for rounds, intervals, and tabata', () => {
    expect(mapRemoteEvent('left', rounds)).toEqual({ type: 'stepRound', direction: -1 });
    expect(mapRemoteEvent('fastForward', { ...rounds, mode: 'tabata' })).toEqual({ type: 'stepRound', direction: 1 });
    expect(mapRemoteEvent('rewind', { ...rounds, mode: 'intervals' })).toEqual({ type: 'stepRound', direction: -1 });
    expect(mapRemoteEvent('right', { ...rounds, mode: 'emom' })).toEqual({ type: 'seek', seconds: 10 });
  });

  it('shows controls with up and leaves the menu with back or menu', () => {
    expect(mapRemoteEvent('up', hidden)).toEqual({ type: 'showControls' });
    expect(mapRemoteEvent('swipeUp', hidden)).toEqual({ type: 'showControls' });
    expect(mapRemoteEvent('back', hidden)).toEqual({ type: 'exit' });
    expect(mapRemoteEvent('menu', hidden)).toEqual({ type: 'exit' });
  });

  it('lets the d-pad move between visible controls instead of seeking', () => {
    expect(mapRemoteEvent('left', shown)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('right', shown)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('select', shown)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('playPause', shown)).toEqual({ type: 'toggle' });
    expect(mapRemoteEvent('down', shown)).toEqual({ type: 'hideControls' });
    expect(mapRemoteEvent('down', hidden)).toEqual({ type: 'ignore' });
  });

  it('closes the reset confirm with back and does not also toggle', () => {
    expect(mapRemoteEvent('back', confirming)).toEqual({ type: 'dismissConfirm' });
    expect(mapRemoteEvent('menu', confirming)).toEqual({ type: 'dismissConfirm' });
    expect(mapRemoteEvent('select', confirming)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('longSelect', confirming)).toEqual({ type: 'ignore' });
  });

  it('does not claim home or microphone keys', () => {
    expect(mapRemoteEvent('home', hidden)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('mic', hidden)).toEqual({ type: 'ignore' });
  });
});
