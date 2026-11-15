import { describe, expect, it } from 'vitest';

import { TV_FOCUS_SCALE, tvTabBarHeight } from './controls';
import {
  TV_BODY_FONT,
  TV_MENU_FONT,
  TV_OVERSCAN,
  TV_SAFE_HORIZONTAL,
  TV_SAFE_VERTICAL,
  TV_SECTION_FONT,
  TV_TITLE_FONT,
  clockAdvanceRatio,
  clockFontSize,
  fitClock,
  isTenFootLayout,
  tvCardCopy,
  tvClockChrome,
  tvColumnBasis,
  tvFocusGutter,
  tvHomeLayout,
  tvMenuColumns,
  tvMenuSceneHeight,
  tvSafeBox,
  tvSafeInset,
  tvTemplateLabelBox,
} from './layout';

function scene(width: number, height: number) {
  return { width, height: tvMenuSceneHeight(0, height), windowHeight: height };
}

describe('TV layout', () => {
  it('treats 1920x1080 as a ten-foot screen and phones as not', () => {
    expect(isTenFootLayout(1920, 1080, false)).toBe(true);
    expect(isTenFootLayout(390, 844, false)).toBe(false);
    expect(isTenFootLayout(844, 390, false)).toBe(false);
    expect(isTenFootLayout(1280, 720, true)).toBe(true);
  });

  it('insets a real TV by at least 5% and keeps the 1080p HIG floor', () => {
    expect(tvSafeBox(true)).toEqual({
      horizontal: Math.max(Math.round(1920 * TV_OVERSCAN), TV_SAFE_HORIZONTAL),
      vertical: Math.max(Math.round(1080 * TV_OVERSCAN), TV_SAFE_VERTICAL),
    });
    expect(tvSafeBox(true, 1920, 1080)).toEqual({ horizontal: 96, vertical: 80 });
    expect(tvSafeBox(true, 3840, 2160)).toEqual({ horizontal: 192, vertical: 160 });
    expect(tvSafeBox(true, 960, 540)).toEqual({ horizontal: 48, vertical: 40 });
    expect(tvSafeBox(true, 1280, 720).horizontal).toBeGreaterThanOrEqual(Math.round(1280 * TV_OVERSCAN));
    expect(tvSafeBox(false)).toEqual({ horizontal: 0, vertical: 0 });
    expect(TV_MENU_FONT).toBeGreaterThanOrEqual(48);
    expect(TV_MENU_FONT).toBeLessThanOrEqual(60);
    expect(TV_TITLE_FONT).toBeGreaterThan(TV_MENU_FONT);
    expect(TV_SECTION_FONT).toBeGreaterThanOrEqual(28);
    expect(TV_BODY_FONT).toBeGreaterThanOrEqual(29);
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

  it('fits every conditioning card on one screen at Fire TV, Android TV, and tvOS sizes', () => {
    const windows = [
      scene(960, 540),
      scene(1280, 720),
      scene(1920, 1080),
      scene(3840, 2160),
    ];
    const layouts = windows.map((window) => tvHomeLayout(window.width, window.height, 6, { windowHeight: window.windowHeight }));
    const [fire, hd720, hd, uhd] = layouts;
    if (!fire || !hd720 || !hd || !uhd) throw new Error('missing layout');

    for (const [layout, window] of layouts.map((layout, index) => [layout, windows[index]] as const)) {
      if (!window) throw new Error('missing window');
      expect(layout.columns).toBe(3);
      expect(layout.rows).toBe(2);
      expect(layout.visibleRows).toBe(layout.rows);
      expect(layout.scrolls).toBe(false);
      expect(layout.contentHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
      expect(layout.padHorizontal).toBeGreaterThanOrEqual(Math.round(window.width * TV_OVERSCAN) - 1);
      expect(layout.cellWidth * layout.columns).toBeLessThanOrEqual(window.width - layout.padHorizontal * 2 + 1);
      expect(layout.cardWidth * TV_FOCUS_SCALE).toBeLessThanOrEqual(layout.cellWidth + 1);
      const ringInset = (layout.cellWidth - layout.cardWidth * TV_FOCUS_SCALE) / 2;
      expect(layout.padHorizontal + ringInset).toBeGreaterThanOrEqual(Math.round(window.width * TV_OVERSCAN) - 2);
      expect(layout.hintSize).toBeGreaterThanOrEqual(Math.round(TV_BODY_FONT * Math.min(window.width / 1920, window.height / 1080)) - 1);
      expect(tvColumnBasis(layout.columns)).toBe('33.3333%');
    }

    expect(hd.titleSize).toBeGreaterThanOrEqual(28);
    expect(hd.detailSize).toBeGreaterThanOrEqual(18);
    expect(uhd.titleSize).toBeGreaterThanOrEqual(hd.titleSize * 2 - 2);
    expect(uhd.cardHeight).toBeGreaterThan(hd.cardHeight * 1.8);
    expect(fire.scrolls).toBe(false);
    expect(hd720.scrolls).toBe(false);
  });

  it('keeps a focused card inside its cell so it cannot cover the neighbor', () => {
    for (const window of [scene(1920, 1080), scene(3840, 2160), scene(1280, 720), scene(960, 540)]) {
      const layout = tvHomeLayout(window.width, window.height, 6, { windowHeight: window.windowHeight });
      const cellWidth = (window.width - layout.padHorizontal * 2) / layout.columns;
      expect(layout.cardWidth * TV_FOCUS_SCALE).toBeLessThanOrEqual(cellWidth + 1);
      expect(layout.cardHeight * TV_FOCUS_SCALE).toBeLessThanOrEqual(layout.rowHeight + 1);
      expect(layout.gutterX).toBeGreaterThanOrEqual(tvFocusGutter(cellWidth) - 1);
      expect(layout.headerHeight + layout.rowHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
    }
  });

  it('treats a full-window measurement as covered by the tab bar and a shorter scene as already clear', () => {
    expect(tvMenuSceneHeight(0, 1080)).toBe(1080 - tvTabBarHeight(1080));
    expect(tvMenuSceneHeight(1080, 1080)).toBe(1080 - tvTabBarHeight(1080));
    expect(tvMenuSceneHeight(1080 - tvTabBarHeight(1080), 1080)).toBe(1080 - tvTabBarHeight(1080));
    expect(tvMenuSceneHeight(0, 2160)).toBe(2160 - tvTabBarHeight(2160));
  });

  it('fits all four round cards inside the safe area without scrolling', () => {
    for (const window of [scene(1920, 1080), scene(1280, 720), scene(960, 540), scene(3840, 2160)]) {
      const layout = tvHomeLayout(window.width, window.height, 4, {
        windowHeight: window.windowHeight,
        header: 'none',
        insets: false,
        hint: false,
      });
      expect(tvMenuColumns(window.width, 4)).toBe(2);
      expect(layout.columns).toBe(2);
      expect(layout.rows).toBe(2);
      expect(layout.visibleRows).toBe(2);
      expect(layout.scrolls).toBe(false);
      expect(layout.padHorizontal).toBe(0);
      expect(layout.cardWidth * TV_FOCUS_SCALE).toBeLessThanOrEqual(layout.cellWidth + 1);
      expect(layout.cellWidth * layout.columns).toBeLessThanOrEqual(window.width + 1);
    }
  });

  it('shrinks the visible row instead of drawing it past the scene', () => {
    const layout = tvHomeLayout(640, 480, 6);
    expect(layout.headerHeight + layout.rowHeight).toBeLessThanOrEqual(layout.viewportHeight + 1);
    expect(layout.columns).toBeGreaterThanOrEqual(1);
    expect(layout.cardHeight).toBeGreaterThanOrEqual(1);
  });

  it('gives the TV clock a readable gym name and a real logo, larger at 4K', () => {
    const full = tvClockChrome(1080, true);
    const bare = tvClockChrome(1080, false);
    const uhd = tvClockChrome(2160, true);
    expect(full.logo).toBeGreaterThanOrEqual(96);
    expect(full.name).toBeGreaterThanOrEqual(48);
    expect(full.phase).toBeGreaterThanOrEqual(32);
    expect(bare.logo).toBe(0);
    expect(tvClockChrome(720, true).logo).toBeGreaterThanOrEqual(96);
    expect(tvClockChrome(720, true).name).toBeGreaterThanOrEqual(32);
    expect(uhd.name).toBeGreaterThanOrEqual(full.name * 2 - 1);
    expect(uhd.logo).toBeGreaterThan(full.logo);
  });

  it('fits a template label inside a centered card at 1080p and at Fire TV 960x540', () => {
    for (const frame of [
      { width: 1920, height: 1080 },
      { width: 960, height: 540 },
    ]) {
      const box = tvTemplateLabelBox(frame.width, frame.height);
      const inner = box.height - box.border * 2 - box.padY * 2;
      expect(inner).toBe(box.lineHeight);
      expect(box.lineHeight).toBeGreaterThanOrEqual(Math.ceil(box.fontSize * 1.5));
      expect(box.fontSize).toBeGreaterThanOrEqual(1);
      expect(box.height).toBeGreaterThan(box.lineHeight);
    }
    const full = tvTemplateLabelBox(1920, 1080);
    const fire = tvTemplateLabelBox(960, 540);
    expect(full.fontSize).toBe(16);
    expect(full.lineHeight).toBe(24);
    expect(full.height).toBe(24 + full.padY * 2 + full.border * 2);
    expect(fire.fontSize).toBe(8);
    expect(fire.height).toBeLessThan(full.height);
    expect(fire.lineHeight).toBeGreaterThanOrEqual(Math.ceil(fire.fontSize * 1.5));
  });

  it('sizes card copy from the card and the window scale', () => {
    const copy = tvCardCopy(480, 1);
    expect(copy.titleSize).toBeGreaterThanOrEqual(48);
    expect(copy.detailSize).toBeGreaterThanOrEqual(29);
    const fourK = tvCardCopy(960, 2);
    expect(fourK.titleSize).toBeGreaterThanOrEqual(copy.titleSize * 2 - 1);
  });
});
