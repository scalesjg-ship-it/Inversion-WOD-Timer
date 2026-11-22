import { describe, expect, it } from 'vitest';

import { mapRemoteEvent, type RemoteContext } from './remoteMap';

const hidden: RemoteContext = {
  mode: 'countdown',
  controlsVisible: false,
  confirmOpen: false,
  stableControls: false,
  running: false,
};
const rounds: RemoteContext = {
  mode: 'intervals',
  controlsVisible: false,
  confirmOpen: false,
  stableControls: false,
  running: false,
};
const shown: RemoteContext = {
  mode: 'countdown',
  controlsVisible: true,
  confirmOpen: false,
  stableControls: false,
  running: false,
};
const tv: RemoteContext = {
  mode: 'countdown',
  controlsVisible: true,
  confirmOpen: false,
  stableControls: true,
  running: true,
};
const tvStopped: RemoteContext = { ...tv, running: false };
const confirming: RemoteContext = {
  mode: 'amrap',
  controlsVisible: true,
  confirmOpen: true,
  stableControls: true,
  running: true,
};

describe('remote key mapping', () => {
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

  it('steps rounds on an intervals clock and seeks on EMOM', () => {
    expect(mapRemoteEvent('left', rounds)).toEqual({ type: 'stepRound', direction: -1 });
    expect(mapRemoteEvent('fastForward', rounds)).toEqual({ type: 'stepRound', direction: 1 });
    expect(mapRemoteEvent('rewind', { ...rounds, mode: 'intervals' })).toEqual({ type: 'stepRound', direction: -1 });
    expect(mapRemoteEvent('right', { ...rounds, mode: 'emom' })).toEqual({ type: 'seek', seconds: 10 });
  });

  it('shows controls with up, and sends television back to the live menu handler', () => {
    expect(mapRemoteEvent('up', hidden)).toEqual({ type: 'showControls' });
    expect(mapRemoteEvent('swipeUp', hidden)).toEqual({ type: 'showControls' });
    expect(mapRemoteEvent('up', shown)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('back', tv)).toEqual({ type: 'menu' });
    expect(mapRemoteEvent('menu', tv)).toEqual({ type: 'menu' });
    expect(mapRemoteEvent('select', tv)).toEqual({ type: 'pause', focusResume: true });
    expect(mapRemoteEvent('playPause', tv)).toEqual({ type: 'toggle' });
    expect(mapRemoteEvent('back', tvStopped)).toEqual({ type: 'menu' });
    expect(mapRemoteEvent('menu', tvStopped)).toEqual({ type: 'menu' });
    expect(mapRemoteEvent('select', tvStopped)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('back', hidden)).toEqual({ type: 'exit' });
  });

  it('lets the d-pad move between visible controls instead of seeking', () => {
    expect(mapRemoteEvent('left', shown)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('right', shown)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('select', shown)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('playPause', shown)).toEqual({ type: 'toggle' });
    expect(mapRemoteEvent('play', tv)).toEqual({ type: 'toggle' });
    expect(mapRemoteEvent('pause', tv)).toEqual({ type: 'toggle' });
    expect(mapRemoteEvent('down', shown)).toEqual({ type: 'hideControls' });
    expect(mapRemoteEvent('down', hidden)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('down', tv)).toEqual({ type: 'ignore' });
    expect(mapRemoteEvent('swipeDown', tv)).toEqual({ type: 'ignore' });
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
