/**
 * Focus graph for the TV tab bar.
 *
 * The bar is the first child of the tab layout, and the open screen is the next
 * child. Expo Router's Slot renders that screen directly, so both live in one
 * UIView under the root stack screen. They are not split by a react-native-screens
 * UIViewController the way `<Tabs>` is.
 *
 * Up from the first content row moves to the bar. Left and Right move along it
 * and stay at the ends. Down from a tab enters the first content control.
 * Down from the last content control stays put: the bar is above, not below.
 */

export type TvFocusDirection = 'up' | 'down' | 'left' | 'right';

export type TvFocusPlace = { zone: 'content'; index: number } | { zone: 'tab'; index: number };

export interface TvTabLink {
  focusable: true;
  /** Index of the tab focused by Left. The first tab stays put. */
  left: number;
  /** Index of the tab focused by Right. The last tab stays put. */
  right: number;
  /** Up from a tab stays on that tab. The bar is already at the top. */
  up: number;
  /** Down from a tab enters the screen. */
  down: 'content';
}

/** Phone controls do not receive TV focus props. Handles are native tags. */
export function tvDirectionalProps(
  tv: boolean,
  links: {
    left?: number | null;
    right?: number | null;
    down?: number | null;
    up?: number | null;
  },
): {
  focusable?: true;
  nextFocusLeft?: number;
  nextFocusRight?: number;
  nextFocusDown?: number;
  nextFocusUp?: number;
} {
  if (!tv) return {};
  return {
    focusable: true,
    ...(links.left != null ? { nextFocusLeft: links.left } : {}),
    ...(links.right != null ? { nextFocusRight: links.right } : {}),
    ...(links.down != null ? { nextFocusDown: links.down } : {}),
    ...(links.up != null ? { nextFocusUp: links.up } : {}),
  };
}

/** One tab's neighbors. Left, Right, and Up stay on the bar. Down is the screen. */
export function tvTabLink(index: number, count: number): TvTabLink {
  const last = Math.max(0, count - 1);
  const safe = clampIndex(index, count);
  return {
    focusable: true,
    left: safe > 0 ? safe - 1 : safe,
    right: safe < last ? safe + 1 : safe,
    up: safe,
    down: 'content',
  };
}

/** WOD, Rounds, Brand, Help. Any other path is the WOD tab. */
export const TV_TAB_ROUTES = [
  { path: '/', title: 'WOD', testID: 'tab-wod' },
  { path: '/rounds', title: 'Rounds', testID: 'tab-rounds' },
  { path: '/brand', title: 'Brand', testID: 'tab-brand' },
  { path: '/help', title: 'Help', testID: 'tab-help' },
] as const;

export function tvTabIndex(pathname: string): number {
  const path = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  const index = TV_TAB_ROUTES.findIndex((tab) => tab.path !== '/' && (path === tab.path || path.endsWith(tab.path)));
  return index < 0 ? 0 : index;
}

/**
 * True for the last row of a wrapping grid.
 * Down from those cells stays in the grid. The tab bar is reached with Up.
 */
export function isTvGridExit(index: number, count: number, columns: number): boolean {
  if (count <= 0 || columns <= 0 || index < 0 || index >= count) return false;
  const lastRow = Math.floor((count - 1) / columns);
  return Math.floor(index / columns) === lastRow;
}

/** True for the first row. Up from those cells enters the tab bar. */
export function isTvGridEntrance(index: number, count: number, columns: number): boolean {
  if (count <= 0 || columns <= 0 || index < 0 || index >= count) return false;
  return Math.floor(index / columns) === 0;
}

export interface TvFocusModel {
  /** Content controls from top to bottom. Up on the first one enters the bar. */
  contentCount: number;
  tabCount: number;
  selectedTab: number;
}

/**
 * One remote move inside the shared tab view.
 * Up from the first control lands on the open tab in the same move.
 */
export function moveTvFocus(place: TvFocusPlace, direction: TvFocusDirection, model: TvFocusModel): TvFocusPlace {
  switch (place.zone) {
    case 'content':
      return moveContent(place.index, direction, model);
    case 'tab':
      return moveTab(place.index, direction, model);
    default: {
      const exhaustive: never = place;
      return exhaustive;
    }
  }
}

/** Repeated Up from any content control reaches a tab, when both exist. */
export function upReachesTab(start: TvFocusPlace, model: TvFocusModel): boolean {
  if (model.tabCount <= 0) return false;
  let place = start;
  const steps = model.contentCount + model.tabCount + 2;
  for (let step = 0; step < steps; step += 1) {
    if (place.zone === 'tab') return true;
    const next = moveTvFocus(place, 'up', model);
    if (samePlace(next, place)) return false;
    place = next;
  }
  return place.zone === 'tab';
}

/** Down from every tab enters content, when the screen has a control. */
export function downReachesContent(model: TvFocusModel): boolean {
  if (model.contentCount <= 0 || model.tabCount <= 0) return false;
  for (let index = 0; index < model.tabCount; index += 1) {
    const next = moveTvFocus({ zone: 'tab', index }, 'down', model);
    if (next.zone !== 'content') return false;
  }
  return true;
}

function moveContent(index: number, direction: TvFocusDirection, model: TvFocusModel): TvFocusPlace {
  const contentCount = Math.max(0, model.contentCount);
  if (contentCount <= 0) return tabPlace(model.selectedTab, model.tabCount);
  const safe = clampIndex(index, contentCount);
  switch (direction) {
    case 'up':
      if (safe > 0) return { zone: 'content', index: safe - 1 };
      return tabPlace(model.selectedTab, model.tabCount);
    case 'down':
      return { zone: 'content', index: safe < contentCount - 1 ? safe + 1 : safe };
    case 'left':
    case 'right':
      return { zone: 'content', index: safe };
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

function moveTab(index: number, direction: TvFocusDirection, model: TvFocusModel): TvFocusPlace {
  const tabCount = Math.max(0, model.tabCount);
  if (tabCount <= 0) return { zone: 'content', index: 0 };
  const link = tvTabLink(index, tabCount);
  switch (direction) {
    case 'left':
      return { zone: 'tab', index: link.left };
    case 'right':
      return { zone: 'tab', index: link.right };
    case 'up':
      return { zone: 'tab', index: link.up };
    case 'down':
      return model.contentCount <= 0 ? { zone: 'tab', index: link.up } : { zone: 'content', index: 0 };
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

function tabPlace(selectedTab: number, tabCount: number): TvFocusPlace {
  if (tabCount <= 0) return { zone: 'content', index: 0 };
  return { zone: 'tab', index: clampIndex(selectedTab, tabCount) };
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  if (index >= count) return count - 1;
  return index;
}

function samePlace(left: TvFocusPlace, right: TvFocusPlace): boolean {
  return left.zone === right.zone && left.index === right.index;
}
