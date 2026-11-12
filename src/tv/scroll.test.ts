import { describe, expect, it } from 'vitest';

import { scrollOffsetForFocus } from './scroll';

describe('scroll into focus', () => {
  it('leaves the offset alone when the row is already on screen', () => {
    expect(scrollOffsetForFocus(40, 80, 400, 0)).toBe(0);
  });

  it('scrolls up to a row above the viewport and down to one below it', () => {
    expect(scrollOffsetForFocus(20, 80, 400, 100)).toBe(20);
    expect(scrollOffsetForFocus(500, 100, 400, 0)).toBe(200);
  });

  it('does not scroll when the viewport is unknown', () => {
    expect(scrollOffsetForFocus(500, 100, 0, 40)).toBe(40);
  });
});