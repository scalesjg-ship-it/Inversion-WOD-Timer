/**
 * Focus graph for the TV tab bar.
 *
 * Expo Router lays each tab in a native screen (`Platform.OS` is `ios` on Apple TV,
 * so react-native-screens stays on) and paints the tab bar as the next sibling.
 * The tvOS focus engine does not walk out of that screen into the sibling, and a
 * vertical ScrollView will not consult `nextFocusDown` while it still has a row
 * below. A focus guide along the bottom of the screen is a target the engine can
 * see, and its destinations are the tab items. A second guide in the bar's top
 * padding sends Up back to the last content control. Left and Right stay on the bar.
 */

export type TvFocusDirection = 'up' | 'down' | 'left' | 'right';

export type TvFocusPlace =
  | { zone: 'content'; index: number }
  | { zone: 'bridge' }
  | { zone: 'tab'; index: number };

export interface TvTabLink {
  focusable: true;
  /** Index of the tab focused by Left. The first tab stays put. */
  left: number;
  /** Index of the tab focused by Right. The last tab stays put. */
  right: number;
  /** Down from a tab stays on that tab. */
  down: number;
  /** Up from a tab returns to content. */
  up: 'content';
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
    ...(links.left ? { nextFocusLeft: links.left } : {}),
    ...(links.right ? { nextFocusRight: links.right } : {}),
    ...(links.down ? { nextFocusDown: links.down } : {}),
    ...(links.up ? { nextFocusUp: links.up } : {}),
  };
}

/** One tab's neighbors. Edges point at themselves so focus does not leave the bar. */
export function tvTabLink(index: number, count: number): TvTabLink {
  const last = Math.max(0, count - 1);
  const safe = clampIndex(index, count);
  return {
    focusable: true,
    left: safe > 0 ? safe - 1 : safe,
    right: safe < last ? safe + 1 : safe,
    down: safe,
    up: 'content',
  };
}

/** The bridge lands on the open tab. An empty bar has nowhere to go. */
export function tvBridgeDestination(count: number, selectedIndex: number): number | null {
  if (count <= 0) return null;
  return clampIndex(selectedIndex, count);
}

/**
 * True for the last row of a wrapping grid. Down from those cells leaves the grid.
 * A later section (presets under the mode grid) means the grid is not the exit.
 */
export function isTvGridExit(index: number, count: number, columns: number): boolean {
  if (count <= 0 || columns <= 0 || index < 0 || index >= count) return false;
  const lastRow = Math.floor((count - 1) / columns);
  return Math.floor(index / columns) === lastRow;
}

export interface TvFocusModel {
  /** Content controls from top to bottom. Down on the last one enters the bridge. */
  contentCount: number;
  tabCount: number;
  selectedTab: number;
  /** Content index Up should restore. Defaults to the first control. */
  rememberedContent: number;
}

/**
 * One remote move.
 * The up guide is not its own stop: Up from a tab restores the remembered control
 * in the same move, which is what the guide's destinations do on device.
 */
export function moveTvFocus(place: TvFocusPlace, direction: TvFocusDirection, model: TvFocusModel): TvFocusPlace {
  const contentCount = Math.max(0, model.contentCount);
  const tabCount = Math.max(0, model.tabCount);
  const remembered = contentCount === 0 ? 0 : clampIndex(model.rememberedContent, contentCount);
  switch (place.zone) {
    case 'content':
      return leaveContent(place.index, direction, contentCount, tabCount, model.selectedTab);
    case 'bridge':
      return moveBridge(direction, contentCount, tabCount, model.selectedTab, remembered);
    case 'tab':
      return moveTab(place.index, direction, tabCount, remembered, contentCount);
    default: {
      const exhaustive: never = place;
      return exhaustive;
    }
  }
}

/** Repeated Down from any content control reaches a tab, when both exist. */
export function downReachesTab(start: TvFocusPlace, model: TvFocusModel): boolean {
  if (model.tabCount <= 0) return false;
  let place = start;
  const steps = model.contentCount + model.tabCount + 2;
  for (let step = 0; step < steps; step += 1) {
    if (place.zone === 'tab') return true;
    const next = moveTvFocus(place, 'down', model);
    if (next.zone === place.zone && next.zone !== 'bridge' && samePlace(next, place)) return false;
    place = next;
  }
  return place.zone === 'tab';
}

function leaveContent(
  index: number,
  direction: TvFocusDirection,
  contentCount: number,
  tabCount: number,
  selectedTab: number,
): TvFocusPlace {
  const next = moveContent(index, direction, contentCount);
  // The bottom guide redirects in the same move, so one Down from the last control lands on the tab.
  if (next.zone !== 'bridge' || direction !== 'down') return next;
  const tab = tvBridgeDestination(tabCount, selectedTab);
  return tab === null ? next : { zone: 'tab', index: tab };
}

function moveContent(index: number, direction: TvFocusDirection, contentCount: number): TvFocusPlace {
  if (contentCount <= 0) return { zone: 'bridge' };
  const safe = clampIndex(index, contentCount);
  switch (direction) {
    case 'down':
      return safe < contentCount - 1 ? { zone: 'content', index: safe + 1 } : { zone: 'bridge' };
    case 'up':
      return { zone: 'content', index: safe > 0 ? safe - 1 : safe };
    case 'left':
    case 'right':
      return { zone: 'content', index: safe };
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

function moveBridge(
  direction: TvFocusDirection,
  contentCount: number,
  tabCount: number,
  selectedTab: number,
  remembered: number,
): TvFocusPlace {
  switch (direction) {
    case 'down': {
      const tab = tvBridgeDestination(tabCount, selectedTab);
      return tab === null ? { zone: 'bridge' } : { zone: 'tab', index: tab };
    }
    case 'up':
      return contentCount === 0 ? { zone: 'bridge' } : { zone: 'content', index: remembered };
    case 'left':
    case 'right':
      return { zone: 'bridge' };
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

function moveTab(
  index: number,
  direction: TvFocusDirection,
  tabCount: number,
  remembered: number,
  contentCount: number,
): TvFocusPlace {
  if (tabCount <= 0) return { zone: 'bridge' };
  const link = tvTabLink(index, tabCount);
  switch (direction) {
    case 'left':
      return { zone: 'tab', index: link.left };
    case 'right':
      return { zone: 'tab', index: link.right };
    case 'down':
      return { zone: 'tab', index: link.down };
    case 'up':
      return contentCount === 0 ? { zone: 'tab', index: link.down } : { zone: 'content', index: remembered };
    default: {
      const exhaustive: never = direction;
      return exhaustive;
    }
  }
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  if (index >= count) return count - 1;
  return index;
}

function samePlace(left: TvFocusPlace, right: TvFocusPlace): boolean {
  if (left.zone !== right.zone) return false;
  if (left.zone === 'bridge' || right.zone === 'bridge') return left.zone === right.zone;
  return left.index === right.index;
}
