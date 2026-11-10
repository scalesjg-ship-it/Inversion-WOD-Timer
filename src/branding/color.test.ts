import { describe, expect, it } from 'vitest';

import { digitColor, normalizeHex, relativeLuminance } from './color';

describe('brand colors', () => {
  it('accepts six-digit hex with or without a hash', () => {
    expect(normalizeHex('#ff4d2e')).toBe('#FF4D2E');
    expect(normalizeHex('3ddc97')).toBe('#3DDC97');
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('replaces a near-black brand color so the clock stays readable', () => {
    expect(relativeLuminance('#101216')).toBeLessThan(0.18);
    expect(digitColor('#101216')).toBe('#F4F7FB');
    expect(digitColor('#FF4D2E')).toBe('#FF4D2E');
    expect(digitColor('#3DDC97')).toBe('#3DDC97');
  });
});
