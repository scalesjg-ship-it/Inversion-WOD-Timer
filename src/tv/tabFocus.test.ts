import { describe, expect, it } from 'vitest';

import {
  downReachesContent,
  isTvGridEntrance,
  isTvGridExit,
  moveTvFocus,
  tvDirectionalProps,
  tvTabIndex,
  tvTabLink,
  upReachesTab,
  type TvFocusModel,
  type TvFocusPlace,
} from './tabFocus';

const screen: TvFocusModel = {
  contentCount: 4,
  tabCount: 3,
  selectedTab: 0,
};

describe('TV tab focus graph', () => {
  it('keeps phone controls free of TV focus props', () => {
    expect(tvDirectionalProps(false, { left: 1, right: 2, down: 3, up: 4 })).toEqual({});
  });

  it('marks a tab focusable and traps the ends of the bar', () => {
    const left = 1;
    const right = 2;
    const self = 3;
    expect(tvDirectionalProps(true, { left, right, up: self })).toEqual({
      focusable: true,
      nextFocusLeft: left,
      nextFocusRight: right,
      nextFocusUp: self,
    });
    expect(tvDirectionalProps(true, { left: 0, up: 0 })).toEqual({
      focusable: true,
      nextFocusLeft: 0,
      nextFocusUp: 0,
    });
    expect(tvTabLink(0, 3)).toMatchObject({ focusable: true, left: 0, right: 1, up: 0, down: 'content' });
    expect(tvTabLink(1, 3)).toMatchObject({ left: 0, right: 2, up: 1, down: 'content' });
    expect(tvTabLink(2, 3)).toMatchObject({ left: 1, right: 2, up: 2, down: 'content' });
  });

  it('maps the three routes onto the bar', () => {
    expect(tvTabIndex('/')).toBe(0);
    expect(tvTabIndex('/rounds')).toBe(1);
    expect(tvTabIndex('/brand')).toBe(2);
    expect(tvTabIndex('/brand/')).toBe(2);
    expect(tvTabIndex('/setup')).toBe(0);
  });

  it('treats the first row as the way up to the tab bar', () => {
    expect(isTvGridEntrance(0, 6, 3)).toBe(true);
    expect(isTvGridEntrance(2, 6, 3)).toBe(true);
    expect(isTvGridEntrance(3, 6, 3)).toBe(false);
    expect(isTvGridExit(0, 6, 3)).toBe(false);
    expect(isTvGridExit(3, 6, 3)).toBe(true);
    expect(isTvGridExit(5, 6, 3)).toBe(true);
    expect(isTvGridEntrance(0, 4, 2)).toBe(true);
    expect(isTvGridEntrance(2, 4, 2)).toBe(false);
  });

  it('reaches the tab bar by pressing up from every content control', () => {
    for (let index = 0; index < screen.contentCount; index += 1) {
      const start: TvFocusPlace = { zone: 'content', index };
      expect(upReachesTab(start, screen)).toBe(true);
      expect(moveTvFocus({ zone: 'content', index: 0 }, 'up', screen)).toEqual({
        zone: 'tab',
        index: screen.selectedTab,
      });
    }
    const rounds = { ...screen, selectedTab: 1 };
    const brand = { ...screen, selectedTab: 2 };
    expect(moveTvFocus({ zone: 'content', index: 0 }, 'up', rounds)).toEqual({ zone: 'tab', index: 1 });
    expect(moveTvFocus({ zone: 'content', index: 0 }, 'up', brand)).toEqual({ zone: 'tab', index: 2 });
  });

  it('moves left and right across the tabs and keeps Up on the bar', () => {
    let place: TvFocusPlace = { zone: 'tab', index: 0 };
    place = moveTvFocus(place, 'left', screen);
    expect(place).toEqual({ zone: 'tab', index: 0 });
    place = moveTvFocus(place, 'right', screen);
    expect(place).toEqual({ zone: 'tab', index: 1 });
    place = moveTvFocus(place, 'right', screen);
    expect(place).toEqual({ zone: 'tab', index: 2 });
    place = moveTvFocus(place, 'right', screen);
    expect(place).toEqual({ zone: 'tab', index: 2 });
    place = moveTvFocus(place, 'up', screen);
    expect(place).toEqual({ zone: 'tab', index: 2 });
  });

  it('enters the screen with Down from any tab and does not leave the bottom row downward', () => {
    expect(downReachesContent(screen)).toBe(true);
    for (let index = 0; index < screen.tabCount; index += 1) {
      expect(moveTvFocus({ zone: 'tab', index }, 'down', screen)).toEqual({ zone: 'content', index: 0 });
    }
    const last: TvFocusPlace = { zone: 'content', index: screen.contentCount - 1 };
    expect(moveTvFocus(last, 'down', screen)).toEqual(last);
    expect(moveTvFocus({ zone: 'content', index: 1 }, 'up', screen)).toEqual({ zone: 'content', index: 0 });
  });

  it('walks a WOD grid, a Rounds column, and a Brand column up to the bar', () => {
    const wod: TvFocusModel = { contentCount: 6, tabCount: 3, selectedTab: 0 };
    const rounds: TvFocusModel = { contentCount: 8, tabCount: 3, selectedTab: 1 };
    const brand: TvFocusModel = { contentCount: 12, tabCount: 3, selectedTab: 2 };
    for (const model of [wod, rounds, brand]) {
      expect(upReachesTab({ zone: 'content', index: 0 }, model)).toBe(true);
      expect(upReachesTab({ zone: 'content', index: model.contentCount - 1 }, model)).toBe(true);
      expect(downReachesContent(model)).toBe(true);
      const tab = moveTvFocus({ zone: 'content', index: 0 }, 'up', model);
      expect(tab).toEqual({ zone: 'tab', index: model.selectedTab });
      expect(moveTvFocus(tab, 'down', model)).toEqual({ zone: 'content', index: 0 });
    }
  });
});
