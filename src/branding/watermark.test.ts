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

  it('stays inside asymmetric safe-area insets and on the screen center', () => {
    const phone = watermarkFrame(390, 844, { top: 59, right: 0, bottom: 34, left: 0 });
    expect(phone.top).toBeGreaterThanOrEqual(59);
    expect(phone.top + phone.size).toBeLessThanOrEqual(844 - 34);
    expect(phone.left).toBeGreaterThanOrEqual(0);
    expect(phone.left + phone.size).toBeLessThanOrEqual(390);
    expect(phone.left).toBeCloseTo((390 - phone.size) / 2);
    expect(phone.top).toBeCloseTo((844 - phone.size) / 2);

    const clamped = watermarkFrame(400, 200, { top: 40, right: 40, bottom: 40, left: 90 });
    expect(clamped.size).toBeLessThanOrEqual(200 - 80);
    expect(clamped.size).toBeLessThanOrEqual(400 - 180);
    expect(clamped.left).toBeCloseTo((400 - clamped.size) / 2);
    expect(clamped.top).toBeCloseTo((200 - clamped.size) / 2);
    expect(clamped.left).toBeGreaterThanOrEqual(90);
    expect(clamped.left + clamped.size).toBeLessThanOrEqual(400 - 40);
    expect(clamped.top).toBeGreaterThanOrEqual(40);
    expect(clamped.top + clamped.size).toBeLessThanOrEqual(200 - 40);

    const landscape = watermarkFrame(844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
    expect(landscape.left).toBeGreaterThanOrEqual(47);
    expect(landscape.left + landscape.size).toBeLessThanOrEqual(844 - 47);
    expect(landscape.top).toBeGreaterThanOrEqual(21);
    expect(landscape.top + landscape.size).toBeLessThanOrEqual(390 - 21);
    expect(landscape.left).toBeCloseTo((844 - landscape.size) / 2);
  });
});
