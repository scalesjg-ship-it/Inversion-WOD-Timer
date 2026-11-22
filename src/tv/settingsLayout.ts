import { tvTabBarHeight } from './controls';
import { tvSafeBox, tvScaled } from './layout';

/** Left column of the TV settings master-detail. The rest is the option pane. */
export const SETTINGS_SIDEBAR_FRACTION = 0.3;

export const SETTINGS_TEMPLATE_COLUMNS = 2;
export const SETTINGS_PALETTE_COLUMNS = 2;
export const SETTINGS_PLACEMENT_COLUMNS = 3;
export const SETTINGS_BACKGROUND_COLUMNS = 3;
export const SETTINGS_CLOCK_COLUMNS = 2;

/**
 * Categories already on the TV settings screen: gym name, templates and
 * placement, background and clock, palettes and colors, then the logo link.
 */
export const TV_SETTINGS_CATEGORIES = [
  { id: 'brand', label: 'Brand', testID: 'settings-category-brand' },
  { id: 'look', label: 'Look', testID: 'settings-category-look' },
  { id: 'display', label: 'Display', testID: 'settings-category-display' },
  { id: 'colors', label: 'Colors', testID: 'settings-category-colors' },
  { id: 'logo', label: 'Logo', testID: 'settings-category-logo' },
] as const;

export type SettingsCategoryId = (typeof TV_SETTINGS_CATEGORIES)[number]['id'];

export const SETTINGS_COLOR_IDS = [
  'color-work',
  'color-rest',
  'color-lead',
  'color-warning',
  'color-digits',
  'color-background',
  'color-ui',
] as const;

export function settingsColorToggleId(id: string): string {
  return `${id}-toggle`;
}

export function settingsDetailTestId(id: SettingsCategoryId): string {
  return `settings-detail-${id}`;
}

export interface TvSettingsMetrics {
  sidebarWidth: number;
  row: number;
  title: number;
  label: number;
  header: number;
  body: number;
  gap: number;
  padH: number;
  padV: number;
  viewport: number;
  /** Title plus every sidebar row. Must sit in the safe area under the tab bar. */
  sidebarBlock: number;
}

export interface SettingsRow {
  columns: number;
  ids: string[];
}

export type SettingsPlace =
  | { zone: 'sidebar'; index: number }
  | { zone: 'detail'; index: number; id: string };

export type SettingsNeighbor =
  | { zone: 'sidebar'; index: number }
  | { zone: 'detail'; id: string }
  | { zone: 'tab' }
  | { zone: 'self' };

export type SettingsActionResult =
  | { zone: 'sidebar'; index: number }
  | { zone: 'detail'; id: string }
  | { zone: 'leave' }
  | { zone: 'self' };

function sidebarBlock(title: number, row: number, gap: number, count: number): number {
  return title + gap + count * row + Math.max(0, count - 1) * gap;
}

/** Sizes the sidebar so every category is on screen under the tab bar. */
export function tvSettingsMetrics(width: number, height: number): TvSettingsMetrics {
  const safeWidth = width > 0 ? width : 1920;
  const safeHeight = height > 0 ? height : 1080;
  const safe = tvSafeBox(true, safeWidth, safeHeight);
  const tab = tvTabBarHeight(safeHeight, 0, safeWidth);
  const viewport = Math.max(1, safeHeight - tab - safe.vertical * 2);
  const count = TV_SETTINGS_CATEGORIES.length;
  const gap = Math.max(8, tvScaled(12, safeWidth, safeHeight));
  const title = Math.max(22, tvScaled(40, safeWidth, safeHeight));
  const label = Math.max(20, tvScaled(34, safeWidth, safeHeight));
  const header = Math.max(18, tvScaled(28, safeWidth, safeHeight));
  const body = Math.max(18, tvScaled(26, safeWidth, safeHeight));
  const titleBlock = title + gap;
  const gaps = gap * Math.max(0, count - 1);
  const fit = Math.floor((viewport - titleBlock - gaps) / count);
  const row = Math.max(48, Math.min(tvScaled(88, safeWidth, safeHeight), Math.max(48, fit)));
  const inner = Math.max(1, safeWidth - safe.horizontal * 2);
  const sidebarWidth = Math.max(1, Math.round((inner - gap) * SETTINGS_SIDEBAR_FRACTION));
  return {
    sidebarWidth,
    row,
    title,
    label,
    header,
    body,
    gap,
    padH: safe.horizontal,
    padV: safe.vertical,
    viewport,
    sidebarBlock: sidebarBlock(title, row, gap, count),
  };
}

function filled(row: SettingsRow): boolean {
  return row.ids.length > 0;
}

/** Option rows for one category. Column counts match the pane's wrap. */
export function settingsDetailRows(
  category: SettingsCategoryId,
  input: { templateIds: readonly string[]; paletteIds: readonly string[] },
): SettingsRow[] {
  switch (category) {
    case 'brand':
      return [{ columns: 1, ids: ['brand-name'] }];
    case 'look':
      return [
        { columns: SETTINGS_TEMPLATE_COLUMNS, ids: [...input.templateIds] },
        {
          columns: SETTINGS_PLACEMENT_COLUMNS,
          ids: ['placement-watermark', 'placement-fullBleed', 'placement-corner'],
        },
      ].filter(filled);
    case 'display':
      return [
        {
          columns: SETTINGS_BACKGROUND_COLUMNS,
          ids: ['background-solid', 'background-vignette', 'background-edge'],
        },
        { columns: SETTINGS_CLOCK_COLUMNS, ids: ['clock-bold', 'clock-regular'] },
      ];
    case 'colors':
      return [
        { columns: SETTINGS_PALETTE_COLUMNS, ids: [...input.paletteIds] },
        { columns: 1, ids: SETTINGS_COLOR_IDS.map((id) => settingsColorToggleId(id)) },
      ].filter(filled);
    case 'logo':
      return [
        { columns: 1, ids: ['logo-entry'] },
        { columns: 2, ids: ['logo-url', 'logo-url-load'] },
        { columns: 1, ids: ['logo-blur'] },
        { columns: 1, ids: ['reset-brand'] },
      ];
    default: {
      const unexpected: never = category;
      return unexpected;
    }
  }
}

export function settingsCategoryRows(
  templateIds: readonly string[],
  paletteIds: readonly string[],
): SettingsRow[][] {
  return TV_SETTINGS_CATEGORIES.map((category) =>
    settingsDetailRows(category.id, { templateIds, paletteIds }),
  );
}

function firstId(rows: readonly SettingsRow[]): string | null {
  for (const row of rows) {
    if (row.ids[0]) return row.ids[0];
  }
  return null;
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  if (index >= count) return count - 1;
  return index;
}

type DetailStep = { kind: 'item'; id: string } | { kind: 'out'; edge: 'left' | 'right' | 'up' | 'down' };

function stepDetail(rows: readonly SettingsRow[], id: string, direction: 'up' | 'down' | 'left' | 'right'): DetailStep {
  let groupIndex = -1;
  let itemIndex = -1;
  rows.forEach((group, index) => {
    const found = group.ids.indexOf(id);
    if (found >= 0) {
      groupIndex = index;
      itemIndex = found;
    }
  });
  if (groupIndex < 0 || itemIndex < 0) return { kind: 'out', edge: direction };
  const group = rows[groupIndex];
  if (!group) return { kind: 'out', edge: direction };
  const columns = Math.max(1, group.columns);
  if (direction === 'left') {
    if (itemIndex % columns === 0) return { kind: 'out', edge: 'left' };
    return { kind: 'item', id: group.ids[itemIndex - 1] ?? id };
  }
  if (direction === 'right') {
    const next = itemIndex + 1;
    if (next >= group.ids.length || Math.floor(next / columns) !== Math.floor(itemIndex / columns)) {
      return { kind: 'out', edge: 'right' };
    }
    return { kind: 'item', id: group.ids[next] ?? id };
  }
  if (direction === 'down') {
    const below = itemIndex + columns;
    if (below < group.ids.length) return { kind: 'item', id: group.ids[below] ?? id };
    const nextGroup = rows[groupIndex + 1];
    if (!nextGroup || nextGroup.ids.length === 0) return { kind: 'out', edge: 'down' };
    const column = Math.min(itemIndex % columns, Math.max(1, nextGroup.columns) - 1, nextGroup.ids.length - 1);
    return { kind: 'item', id: nextGroup.ids[column] ?? nextGroup.ids[0] };
  }
  const above = itemIndex - columns;
  if (above >= 0) return { kind: 'item', id: group.ids[above] ?? id };
  const previous = rows[groupIndex - 1];
  if (!previous || previous.ids.length === 0) return { kind: 'out', edge: 'up' };
  const prevColumns = Math.max(1, previous.columns);
  const lastRowStart = Math.floor((previous.ids.length - 1) / prevColumns) * prevColumns;
  const column = Math.min(itemIndex % columns, prevColumns - 1, previous.ids.length - 1 - lastRowStart);
  return { kind: 'item', id: previous.ids[lastRowStart + column] ?? previous.ids[previous.ids.length - 1] };
}

/**
 * One D-pad move. Up from the first sidebar row is the open tab, because the
 * sidebar sits on the left and is not under the Settings tab. Left from the
 * leftmost option returns to that category. Right from a category enters its
 * first option.
 */
export function settingsNeighbor(
  place: SettingsPlace,
  direction: 'up' | 'down' | 'left' | 'right',
  categories: readonly SettingsRow[][],
): SettingsNeighbor {
  const count = categories.length;
  if (place.zone === 'sidebar') {
    const index = clampIndex(place.index, count);
    switch (direction) {
      case 'up':
        return index > 0 ? { zone: 'sidebar', index: index - 1 } : { zone: 'tab' };
      case 'down':
        return index < count - 1 ? { zone: 'sidebar', index: index + 1 } : { zone: 'self' };
      case 'left':
        return { zone: 'self' };
      case 'right': {
        const id = firstId(categories[index] ?? []);
        return id ? { zone: 'detail', id } : { zone: 'self' };
      }
      default: {
        const unexpected: never = direction;
        return unexpected;
      }
    }
  }
  const index = clampIndex(place.index, count);
  const step = stepDetail(categories[index] ?? [], place.id, direction);
  if (step.kind === 'item') return { zone: 'detail', id: step.id };
  switch (step.edge) {
    case 'left':
      return { zone: 'sidebar', index };
    case 'right':
    case 'up':
    case 'down':
      return { zone: 'self' };
    default: {
      const unexpected: never = step.edge;
      return unexpected;
    }
  }
}

/** Select enters the open category. Back from an option returns to the sidebar. Back from the sidebar leaves. */
export function settingsAction(
  place: SettingsPlace,
  action: 'select' | 'back',
  categories: readonly SettingsRow[][],
): SettingsActionResult {
  const index = clampIndex(place.index, categories.length);
  switch (action) {
    case 'back':
      return place.zone === 'detail' ? { zone: 'sidebar', index } : { zone: 'leave' };
    case 'select': {
      if (place.zone === 'detail') return { zone: 'self' };
      const id = firstId(categories[index] ?? []);
      return id ? { zone: 'detail', id } : { zone: 'self' };
    }
    default: {
      const unexpected: never = action;
      return unexpected;
    }
  }
}

/**
 * Back from the sidebar opens the tab the viewer came from.
 * A missing history step moves to WOD instead of leaving the app.
 */
export function settingsBackTab(selected: number, previous: number, count: number): number {
  if (count <= 1) return 0;
  if (previous !== selected && previous >= 0 && previous < count) return previous;
  return selected > 0 ? selected - 1 : 0;
}
