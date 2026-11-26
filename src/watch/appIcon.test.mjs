import { describe, expect, it } from 'vitest';

import { inspectWatchIcon } from '../../scripts/check-watch-icon.mjs';

describe('Apple Watch app icon', () => {
  it('is a full-bleed 1024 RGB image in the watchOS single-size slot', () => {
    const icon = inspectWatchIcon();
    expect(icon.errors).toEqual([]);
    expect(icon.ok).toBe(true);
    expect(icon.width).toBe(1024);
    expect(icon.height).toBe(1024);
    expect(icon.colorType).toBe(2);
    expect(icon.hasAlpha).toBe(false);
    expect(icon.box).toEqual({ x: 0, y: 0, width: 1024, height: 1024 });
    expect(icon.fillWidth).toBe(100);
    expect(icon.fillHeight).toBe(100);
    expect(icon.corners).toEqual([
      [12, 13, 16],
      [12, 13, 16],
      [12, 13, 16],
      [12, 13, 16],
    ]);
    expect(icon.edges.every((rgb) => rgb[0] > 200 && rgb[1] < 80)).toBe(true);
  });
});
