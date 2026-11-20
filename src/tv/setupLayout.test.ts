import { describe, expect, it } from 'vitest';

import { TV_FOCUS_SCALE, tvTabBarHeight } from './controls';
import { TV_OVERSCAN, tvFocusGutter } from './layout';
import { stepperFocus, tvRoundsLayout, tvSetupMetrics } from './setupLayout';

describe('TV setup form', () => {
  it('groups each stepper on its value instead of the screen width', () => {
    const hd = tvSetupMetrics(1920, 1080);
    const fire = tvSetupMetrics(960, 540);
    const hd720 = tvSetupMetrics(1280, 720);
    expect(hd.cluster).toBeLessThan(360);
    expect(hd.timeRow).toBeLessThan(1920 * 0.55);
    expect(hd.timeRow).toBeGreaterThan(hd.labelWidth + hd.cluster * 2);
    expect(hd.durationRow).toBeGreaterThan(hd.timeRow);
    expect(hd.durationRow).toBeLessThan(1920 - 192);
    expect(fire.timeRow).toBeLessThan(960 - 96);
    expect(fire.durationRow).toBeLessThan(960 - 96);
    expect(hd720.timeRow).toBeLessThan(1280 - 128);
    expect(hd.labelSize).toBe(fire.labelSize * 2);
    expect(hd.rowGap).toBeGreaterThanOrEqual(Math.ceil(hd.button * (TV_FOCUS_SCALE - 1)));
  });

  it('keeps left and right inside a cluster and joins the neighbor cluster', () => {
    expect(stepperFocus({ dec: 1, inc: 2 }, null, null)).toEqual({
      decLeft: 1,
      decRight: 2,
      incLeft: 1,
      incRight: 2,
    });
    expect(stepperFocus({ dec: 1, inc: 2 }, null, 3).incRight).toBe(3);
    expect(stepperFocus({ dec: 3, inc: 4 }, 2, null).decLeft).toBe(2);
  });
});

describe('TV rounds tab', () => {
  const frames = [
    [1920, 1080],
    [1280, 720],
    [960, 540],
    [3840, 2160],
  ] as const;

  it('fits the cards and the editor inside the safe area without scrolling', () => {
    for (const [width, height] of frames) {
      const layout = tvRoundsLayout(width, height, 4);
      expect(
        layout.scrolls,
        `${width}x${height} content ${layout.contentHeight} view ${layout.viewportHeight} card ${layout.cardHeight} gap ${layout.rowGap}`,
      ).toBe(false);
      expect(layout.contentHeight).toBeLessThanOrEqual(layout.viewportHeight);
      expect(layout.viewportHeight).toBe(height - tvTabBarHeight(height, 0, width));
      expect(layout.columns).toBe(2);
      expect(layout.rows).toBe(2);
      expect(layout.padHorizontal).toBeGreaterThanOrEqual(Math.round(width * TV_OVERSCAN) - 1);
      expect(layout.padBottom).toBeGreaterThanOrEqual(Math.round(height * TV_OVERSCAN) - 1);
      expect(layout.cellWidth * layout.columns).toBeLessThanOrEqual(width - layout.padHorizontal * 2 + 1);
      expect(layout.cardWidth * TV_FOCUS_SCALE).toBeLessThanOrEqual(layout.cellWidth + 1);
      expect(layout.cardHeight * TV_FOCUS_SCALE).toBeLessThanOrEqual(layout.cellHeight + 1);
      expect(layout.gutterX).toBeGreaterThanOrEqual(tvFocusGutter(layout.cellWidth) - 1);
      expect(layout.gutterY).toBeGreaterThanOrEqual(tvFocusGutter(layout.cellHeight) - 1);
      expect(layout.cardHeight).toBeGreaterThanOrEqual(layout.titleFont + layout.detailFont);
      expect(layout.formWidth).toBeLessThanOrEqual(width - layout.padHorizontal * 2);
    }
  });

  it('keeps 1080p cards about a third of a two-row fill', () => {
    const layout = tvRoundsLayout(1920, 1080, 4);
    const scene = layout.viewportHeight - layout.padTop - layout.padBottom - layout.titleLine;
    const oldCell = Math.floor(scene / 2);
    expect(layout.cardHeight).toBeLessThanOrEqual(Math.round(oldCell / 3) + 1);
    expect(layout.cardHeight * 2).toBeLessThan(scene / 2);
  });
});
