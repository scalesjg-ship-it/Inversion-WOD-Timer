import { describe, expect, it } from 'vitest';

import { contrastRatio, digitColor, hsvToHex, normalizeHex, readableDigitColor, relativeLuminance } from './color';

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

  it('keeps chosen digits when they clear the background, and replaces them when they do not', () => {
    expect(contrastRatio('#FFFFFF', '#07080A')).toBeGreaterThan(3);
    expect(readableDigitColor('#FFFFFF', '#07080A')).toBe('#FFFFFF');
    expect(readableDigitColor('#FF4D2E', '#07080A')).toBe('#FF4D2E');
    expect(readableDigitColor('#FFFFFF', '#FFFFFF')).toBe('#07080A');
    expect(readableDigitColor('#F4F7FB', '#FFFFFF')).toBe('#07080A');
  });

  it('round-trips a hue through hex', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#FF0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00FF00');
    expect(hsvToHex(240, 1, 1)).toBe('#0000FF');
  });
});
