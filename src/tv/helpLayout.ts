import { tvTabBarHeight } from './controls';
import { tvSafeBox } from './layout';

export interface TvHelpColumn {
  rowHeight: number;
  gap: number;
}

/**
 * One short row per Help section, sized so the title column fits under the tab
 * bar and inside the safe area. The reading pane sits beside the list, so it
 * does not add height.
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
  const available = screenHeight - tab - safe.vertical * 2 - pageBlock;
  const rowHeight = Math.max(36, Math.min(56, Math.floor((available - gap * (rows - 1)) / rows)));
  return { rowHeight, gap };
}
