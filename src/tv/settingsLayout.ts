import { tvTabBarHeight } from './controls';
import { tvSafeBox, tvScale } from './layout';

/**
 * Collapsed TV settings: title, Brand and Display headers, and seven rows
 * (name, two look rows, logo, background, clock, More).
 * More holds colors, the phone logo QR, blur, and reset.
 */
const LOOK_ROWS = 2;
const SINGLE_ROWS = 5;
const HEADERS = 2;
const GAPS = 9;

export interface TvSettingsMetrics {
  row: number;
  header: number;
  title: number;
  gap: number;
  padH: number;
  padV: number;
  viewport: number;
  collapsedHeight: number;
}

function collapsedHeight(title: number, header: number, row: number, gap: number): number {
  return title + HEADERS * header + (LOOK_ROWS + SINGLE_ROWS) * row + GAPS * gap;
}

/** Sizes the closed settings list so it sits in the safe area under the tab bar. */
export function tvSettingsMetrics(width: number, height: number): TvSettingsMetrics {
  const safeWidth = width > 0 ? width : 1920;
  const safeHeight = height > 0 ? height : 1080;
  const scale = tvScale(safeWidth, safeHeight);
  const safe = tvSafeBox(true, safeWidth, safeHeight);
  const tab = tvTabBarHeight(safeHeight, 0, safeWidth);
  const viewport = Math.max(1, safeHeight - tab - safe.vertical * 2);
  let title = Math.max(28, Math.round(40 * scale));
  let header = Math.max(20, Math.round(28 * scale));
  let row = Math.max(40, Math.round(64 * scale));
  let gap = Math.max(4, Math.round(8 * scale));
  while (collapsedHeight(title, header, row, gap) > viewport && (row > 40 || gap > 4 || header > 20 || title > 28)) {
    if (row > 40) row -= 1;
    else if (gap > 4) gap -= 1;
    else if (header > 20) header -= 1;
    else title -= 1;
  }
  return {
    row,
    header,
    title,
    gap,
    padH: safe.horizontal,
    padV: safe.vertical,
    viewport,
    collapsedHeight: collapsedHeight(title, header, row, gap),
  };
}

export interface SettingsGroup {
  id: string;
  columns: number;
  ids: string[];
}

/** Reading order for the closed list, then the color sets inside More. */
export function tvSettingsGroups(templateIds: readonly string[], paletteIds: readonly string[], advanced: boolean): SettingsGroup[] {
  const groups: SettingsGroup[] = [
    { id: 'name', columns: 1, ids: ['brand-name'] },
    { id: 'look', columns: 5, ids: [...templateIds] },
    { id: 'logo', columns: 3, ids: ['placement-watermark', 'placement-fullBleed', 'placement-corner'] },
    { id: 'background', columns: 3, ids: ['background-solid', 'background-vignette', 'background-edge'] },
    { id: 'clock', columns: 2, ids: ['clock-bold', 'clock-regular'] },
    { id: 'more', columns: 1, ids: ['settings-more'] },
  ];
  if (advanced && paletteIds.length > 0) {
    groups.push({ id: 'palettes', columns: 5, ids: [...paletteIds] });
  }
  return groups;
}

export function nextSettingsFocus(
  current: string,
  direction: 'up' | 'down' | 'left' | 'right',
  groups: readonly SettingsGroup[],
): string | null {
  let groupIndex = -1;
  let itemIndex = -1;
  groups.forEach((group, index) => {
    const found = group.ids.indexOf(current);
    if (found >= 0) {
      groupIndex = index;
      itemIndex = found;
    }
  });
  if (groupIndex < 0 || itemIndex < 0) return current;
  const group = groups[groupIndex];
  if (!group) return current;
  const columns = Math.max(1, group.columns);
  if (direction === 'left') return group.ids[Math.max(0, itemIndex - 1)] ?? current;
  if (direction === 'right') return group.ids[Math.min(group.ids.length - 1, itemIndex + 1)] ?? current;
  if (direction === 'down') {
    const below = itemIndex + columns;
    if (below < group.ids.length) return group.ids[below] ?? current;
    return groups[groupIndex + 1]?.ids[0] ?? current;
  }
  const above = itemIndex - columns;
  if (above >= 0) return group.ids[above] ?? current;
  const previous = groups[groupIndex - 1];
  if (!previous || previous.ids.length === 0) return null;
  const lastRow = Math.floor((previous.ids.length - 1) / Math.max(1, previous.columns)) * Math.max(1, previous.columns);
  return previous.ids[Math.min(previous.ids.length - 1, lastRow + (itemIndex % columns))] ?? previous.ids[previous.ids.length - 1] ?? null;
}
