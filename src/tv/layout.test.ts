import { describe, expect, it } from 'vitest';

import { clockFontSize, isTenFootLayout, tvSafeInset } from './layout';

describe('TV layout', () => {
  it('treats 1920x1080 as a ten-foot screen and phones as not', () => {
    expect(isTenFootLayout(1920, 1080, false)).toBe(true);
    expect(isTenFootLayout(390, 844, false)).toBe(false);
    expect(isTenFootLayout(844, 390, false)).toBe(false);
    expect(isTenFootLayout(1280, 720, true)).toBe(true);
  });

  it('keeps a huge clock inside a 1080p safe area', () => {
    const size = clockFontSize(1920, 1080, true);
    expect(size).toBeGreaterThan(400);
    expect(size).toBeLessThanOrEqual(520);
    expect(tvSafeInset(true)).toBeGreaterThanOrEqual(48);
    expect(clockFontSize(390, 844, false)).toBeLessThanOrEqual(280);
  });
});
