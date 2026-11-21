import { tvTabBarHeight } from './controls';
import { tvSafeBox } from './layout';

export interface TvHelpColumn {
  rowHeight: number;
  gap: number;
  /** Leftover under the full-width rows for the focused section's text. */
  readingHeight: number;
}

/**
 * Full-width rows stacked under the page title, the same place the WOD cards
 * sit under the tab bar. A narrow column leaves the Help tab (the rightmost
 * tab) with nothing beneath it, so Down stays on the tab.
 */
export function tvHelpColumn(width: number, height: number, count: number, pageSize: number): TvHelpColumn {
  const rows = Math.max(count, 1);
  const screenHeight = height > 0 ? height : 1080;
  const screenWidth = width > 0 ? width : 1920;
  const tab = tvTabBarHeight(screenHeight, 0, screenWidth);
  const safe = tvSafeBox(true, screenWidth, screenHeight);
  const title = Math.max(pageSize, 0);
  const gap = Math.max(4, Math.round(8 * (screenHeight / 1080)));
  const pageBlock = title + gap;
  const budget = screenHeight - tab - safe.vertical * 2 - pageBlock;
  const readingFloor = Math.max(48, Math.round(72 * (screenHeight / 1080)));
  const rowBudget = budget - readingFloor;
  const rowHeight = Math.max(36, Math.min(56, Math.floor((rowBudget - gap * (rows - 1)) / rows)));
  const rowBlock = rows * rowHeight + gap * Math.max(0, rows - 1);
  return { rowHeight, gap, readingHeight: Math.max(0, budget - rowBlock) };
}
