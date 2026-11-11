import { describe, expect, it } from 'vitest';

import { WATERMARK_OPACITY, WATERMARK_SCALE, watermarkFrame } from './watermark';

describe('watermark placement', () => {
  it('covers most of the shorter side and stays centered in both orientations', () => {
    expect(WATERMARK_SCALE).toBeGreaterThanOrEqual(0.8);
    expect(WATERMARK_SCALE).toBeLessThanOrEqual(0.9);
    expect(WATERMARK_OPACITY).toBeLessThanOrEqual(0.22);

    const portrait = watermarkFrame(390, 844);
    expect(portrait.size).toBeCloseTo(390 * WATERMARK_SCALE);
    expect(portrait.left).toBeCloseTo((390 - portrait.size) / 2);
    expect(portrait.top).toBeCloseTo((844 - portrait.size) / 2);

    const landscape = watermarkFrame(844, 390);
    expect(landscape.size).toBeCloseTo(390 * WATERMARK_SCALE);
    expect(landscape.left).toBeCloseTo((844 - landscape.size) / 2);
    expect(landscape.top).toBeCloseTo((390 - landscape.size) / 2);
  });
});
