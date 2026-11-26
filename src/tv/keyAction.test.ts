import { describe, expect, it } from 'vitest';

import { acceptRemotePress, keyPhase } from './keyAction';

describe('TV key action', () => {
  it('treats a missing action as one press, the way older Apple TV events arrive', () => {
    expect(keyPhase(undefined)).toBe('press');
    expect(keyPhase(-1)).toBe('press');
    expect(keyPhase('-1')).toBe('press');
    const first = acceptRemotePress('playPause', undefined, new Set());
    expect(first.accept).toBe(true);
  });

  it('accepts a lone key-up, which is the play/pause press on Apple TV, Fire TV, and Android TV', () => {
    expect(keyPhase(1)).toBe('up');
    expect(keyPhase('1')).toBe('up');
    const play = acceptRemotePress('playPause', 1, new Set());
    expect(play.accept).toBe(true);
    const menu = acceptRemotePress('menu', '1', play.pendingDown);
    expect(menu.accept).toBe(true);
  });

  it('runs a key-down and ignores the matching key-up', () => {
    const down = acceptRemotePress('playPause', 0, new Set());
    expect(down.accept).toBe(true);
    const up = acceptRemotePress('playPause', 1, down.pendingDown);
    expect(up.accept).toBe(false);
    expect(up.pendingDown.has('playPause')).toBe(false);
  });

  it('does not drop a different key that arrives between a down and its up', () => {
    const left = acceptRemotePress('left', 0, new Set());
    const pause = acceptRemotePress('playPause', 1, left.pendingDown);
    expect(pause.accept).toBe(true);
    const leftUp = acceptRemotePress('left', 1, pause.pendingDown);
    expect(leftUp.accept).toBe(false);
  });
});
