import { describe, expect, it } from 'vitest';

import {
  TV_BODY_FONT,
  TV_MENU_FONT,
  TV_SAFE_HORIZONTAL,
  TV_SAFE_VERTICAL,
  TV_SECTION_FONT,
  TV_TITLE_FONT,
  clockAdvanceRatio,
  clockFontSize,
  fitClock,
  isTenFootLayout,
  tvSafeBox,
  tvSafeInset,
} from './layout';

describe('TV layout', () => {
  it('treats 1920x1080 as a ten-foot screen and phones as not', () => {
    expect(isTenFootLayout(1920, 1080, false)).toBe(true);
    expect(isTenFootLayout(390, 844, false)).toBe(false);
    expect(isTenFootLayout(844, 390, false)).toBe(false);
    expect(isTenFootLayout(1280, 720, true)).toBe(true);
  });

  it('insets a real TV by the 1080p overscan box and leaves phones at zero', () => {
    expect(tvSafeBox(true)).toEqual({ horizontal: TV_SAFE_HORIZONTAL, vertical: TV_SAFE_VERTICAL });
    expect(TV_SAFE_HORIZONTAL).toBe(60);
    expect(TV_SAFE_VERTICAL).toBe(90);
    expect(tvSafeBox(false)).toEqual({ horizontal: 0, vertical: 0 });
    expect(TV_MENU_FONT).toBeGreaterThanOrEqual(48);
    expect(TV_MENU_FONT).toBeLessThanOrEqual(60);
    expect(TV_TITLE_FONT).toBeGreaterThan(TV_MENU_FONT);
    expect(TV_SECTION_FONT).toBeGreaterThanOrEqual(28);
    expect(TV_BODY_FONT).toBeGreaterThanOrEqual(24);
  });

  it('lets the TV clock grow until the safe frame stops it', () => {
    const preferred = clockFontSize(1920, 1080, true, true);
    expect(preferred).toBeGreaterThan(clockFontSize(1920, 1080, true));
    const clock = fitClock({
      text: '11:59',
      screenWidth: 1920,
      screenHeight: 1080,
      tenFoot: true,
      fillFrame: true,
      horizontalInset: TV_SAFE_HORIZONTAL * 2,
      verticalInset: TV_SAFE_VERTICAL * 2 + 200,
    });
    expect(clock.fontSize).toBeGreaterThan(400);
    expect(clockAdvanceRatio('11:59') * clock.fontSize).toBeLessThanOrEqual(clock.width + 0.01);
    expect(clock.lineHeight).toBeLessThanOrEqual(1080 - (TV_SAFE_VERTICAL * 2 + 200) + 1);
  });

  it('keeps a huge clock inside a 1080p safe area', () => {
    const size = clockFontSize(1920, 1080, true);
    expect(size).toBeGreaterThan(400);
    expect(size).toBeLessThanOrEqual(520);
    expect(tvSafeInset(true)).toBeGreaterThanOrEqual(48);
    expect(clockFontSize(390, 844, false)).toBeLessThanOrEqual(280);
  });

  it('fits the full clock glyphs on phones, landscape, and TV', () => {
    const samples = ['00:09', '100:00', '00:00:00', '10:00:00'];
    const screens = [
      { width: 320, height: 568, tenFoot: false, horizontalInset: 32, verticalInset: 280 },
      { width: 390, height: 844, tenFoot: false, horizontalInset: 32, verticalInset: 340 },
      { width: 430, height: 932, tenFoot: false, horizontalInset: 32, verticalInset: 360 },
      { width: 844, height: 390, tenFoot: false, horizontalInset: 128, verticalInset: 210 },
      { width: 1920, height: 1080, tenFoot: true, horizontalInset: 160, verticalInset: 420 },
    ];
    for (const screen of screens) {
      for (const text of samples) {
        const clock = fitClock({ text, screenWidth: screen.width, screenHeight: screen.height, ...screen });
        expect(clock.lineHeight).toBeGreaterThanOrEqual(clock.fontSize);
        expect(clockAdvanceRatio(text) * clock.fontSize).toBeLessThanOrEqual(clock.width + 0.01);
        expect(clock.lineHeight).toBeLessThanOrEqual(screen.height - screen.verticalInset + 1);
        expect(clock.fontSize).toBeLessThanOrEqual(clockFontSize(screen.width, screen.height, screen.tenFoot));
      }
    }
  });
});
