import { describe, expect, it } from 'vitest';

import { tvSafeBox } from './layout';
import { tvAppleTimerFrame, tvTimerMetaBlock, tvTransportLeft } from './timerFrame';

function frame(width: number, height: number, buttonCount: number, linkStatus = false) {
  const safe = tvSafeBox(true, width, height);
  return tvAppleTimerFrame({
    screenWidth: width,
    screenHeight: height,
    safeBottom: safe.vertical,
    safeHorizontal: safe.horizontal,
    buttonCount,
    linkStatus,
    warning: false,
    paused: true,
  });
}

describe('Apple TV transport frame', () => {
  it('centers four buttons, including Watch, inside 1080p and 720p', () => {
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ]) {
      const safe = tvSafeBox(true, size.width, size.height);
      const row = frame(size.width, size.height, 4);
      const left = tvTransportLeft(size.width, safe.horizontal, row.rowWidth);
      const right = left + row.rowWidth;
      expect(row.rowWidth).toBeLessThanOrEqual(size.width - safe.horizontal * 2);
      expect(left).toBeGreaterThanOrEqual(safe.horizontal);
      expect(right).toBeLessThanOrEqual(size.width - safe.horizontal + 0.01);
      expect(row.statusBottom).toBeLessThanOrEqual(row.transportTop);
      expect(row.faceBottom).toBeGreaterThan(safe.vertical);
      expect(row.metaBlock).toBeGreaterThan(0);
    }
  });

  it('keeps the 1080p scale-up size when the row already fits', () => {
    const row = frame(1920, 1080, 4);
    expect(row.button.minWidth).toBe(240);
    expect(row.button.minHeight).toBe(72);
    expect(row.button.fontSize).toBe(32);
    expect(row.button.gap).toBe(24);
    expect(row.rowWidth).toBe(4 * 240 + 3 * 24);
  });

  it('shrinks a row that would leave the safe area', () => {
    const row = frame(700, 400, 4);
    const safe = tvSafeBox(true, 700, 400);
    expect(row.rowWidth).toBeLessThanOrEqual(700 - safe.horizontal * 2);
    expect(row.button.minWidth).toBeLessThan(240);
    expect(tvTransportLeft(700, safe.horizontal, row.rowWidth)).toBeGreaterThanOrEqual(safe.horizontal);
  });

  it('lifts the status block above a link message as well as the buttons', () => {
    const plain = frame(1920, 1080, 4, false);
    const withStatus = frame(1920, 1080, 4, true);
    expect(withStatus.columnHeight).toBeGreaterThan(plain.columnHeight);
    expect(withStatus.statusBottom).toBeLessThanOrEqual(withStatus.transportTop);
    expect(withStatus.faceBottom).toBeGreaterThan(plain.faceBottom);
  });

  it('reserves the paused lines under the clock', () => {
    expect(tvTimerMetaBlock(1, { warning: false, paused: true })).toBe(8 + 64 + 40 + 8 + 34);
    expect(tvTimerMetaBlock(1, { warning: true, paused: true })).toBeGreaterThan(
      tvTimerMetaBlock(1, { warning: false, paused: false }),
    );
  });
});
