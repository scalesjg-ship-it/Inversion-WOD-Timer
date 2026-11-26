import { describe, expect, it } from 'vitest';

import { claimPress } from './pressClaim';

describe('duplicate remote press', () => {
  it('accepts the first select and drops the button delivery of that same press', () => {
    const first = claimPress('select', 1_000, null);
    const second = claimPress('select', 1_040, first.claim);
    expect(first.accept).toBe(true);
    expect(second.accept).toBe(false);
    expect(second.claim).toBe(first.claim);
  });

  it('accepts a later select, and a menu that arrives during the select window', () => {
    const select = claimPress('select', 1_000, null);
    const menu = claimPress('menu', 1_080, select.claim);
    const again = claimPress('select', 1_600, menu.claim);
    expect(menu.accept).toBe(true);
    expect(again.accept).toBe(true);
  });

  it('keeps play/pause independent of select', () => {
    const select = claimPress('select', 1_000, null);
    const play = claimPress('playPause', 1_020, select.claim);
    expect(play.accept).toBe(true);
  });
});
