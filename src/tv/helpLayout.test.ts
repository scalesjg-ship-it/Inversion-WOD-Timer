import { describe, expect, it } from 'vitest';

import { tvTabBarHeight } from './controls';
import { tvHelpColumn } from './helpLayout';
import { tvSafeBox, tvScaled } from './layout';

function columnFits(width: number, height: number, count: number) {
  const pageSize = tvScaled(52, width, height);
  const column = tvHelpColumn(width, height, count, pageSize);
  const tab = tvTabBarHeight(height, 0, width);
  const safe = tvSafeBox(true, width, height);
  const used =
    pageSize +
    column.gap +
    count * column.rowHeight +
    (count - 1) * column.gap +
    column.readingHeight;
  const room = height - tab - safe.vertical * 2;
  return { column, used, room };
}

describe('tv help column', () => {
  it('fits ten full-width sections inside the 1080p safe area', () => {
    const fit = columnFits(1920, 1080, 10);
    expect(fit.used).toBeLessThanOrEqual(fit.room);
    expect(fit.column.rowHeight).toBeGreaterThanOrEqual(36);
    expect(fit.column.readingHeight).toBeGreaterThan(0);
  });

  it('fits ten full-width sections inside the 720p safe area', () => {
    const fit = columnFits(1280, 720, 10);
    expect(fit.used).toBeLessThanOrEqual(fit.room);
    expect(fit.column.rowHeight).toBeGreaterThanOrEqual(36);
    expect(fit.column.readingHeight).toBeGreaterThan(0);
  });
});
