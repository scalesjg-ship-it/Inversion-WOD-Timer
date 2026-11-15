import { describe, expect, it } from 'vitest';

import {
  downReachesTab,
  isTvGridExit,
  moveTvFocus,
  tvBridgeDestination,
  tvDirectionalProps,
  tvTabLink,
  type TvFocusModel,
  type TvFocusPlace,
} from './tabFocus';

const screen: TvFocusModel = {
  contentCount: 4,
  tabCount: 3,
  selectedTab: 0,
  rememberedContent: 2,
};

describe('TV tab focus graph', () => {
  it('keeps phone controls free of TV focus props', () => {
    expect(tvDirectionalProps(false, { left: 1, right: 2, down: 3, up: 4 })).toEqual({});
  });

  it('marks a tab focusable and traps the ends of the bar', () => {
    const left = 1;
    const right = 2;
    const self = 3;
    const content = 4;
    expect(tvDirectionalProps(true, { left, right, down: self, up: content })).toEqual({
      focusable: true,
      nextFocusLeft: left,
      nextFocusRight: right,
      nextFocusDown: self,
      nextFocusUp: content,
    });
    expect(tvTabLink(0, 3)).toMatchObject({ focusable: true, left: 0, right: 1, down: 0, up: 'content' });
    expect(tvTabLink(1, 3)).toMatchObject({ left: 0, right: 2, down: 1 });
    expect(tvTabLink(2, 3)).toMatchObject({ left: 1, right: 2, down: 2, up: 'content' });
  });

  it('sends the bridge to the open tab', () => {
    expect(tvBridgeDestination(3, 0)).toBe(0);
    expect(tvBridgeDestination(3, 2)).toBe(2);
    expect(tvBridgeDestination(3, 9)).toBe(2);
    expect(tvBridgeDestination(0, 0)).toBeNull();
  });

  it('treats only the last row of a grid as the exit toward the tab bar', () => {
    expect(isTvGridExit(0, 6, 3)).toBe(false);
    expect(isTvGridExit(2, 6, 3)).toBe(false);
    expect(isTvGridExit(3, 6, 3)).toBe(true);
    expect(isTvGridExit(5, 6, 3)).toBe(true);
    expect(isTvGridExit(0, 4, 2)).toBe(false);
    expect(isTvGridExit(2, 4, 2)).toBe(true);
    expect(isTvGridExit(6, 7, 3)).toBe(true);
    expect(isTvGridExit(5, 7, 3)).toBe(false);
  });

  it('reaches the tab bar by swiping down from every content control', () => {
    for (let index = 0; index < screen.contentCount; index += 1) {
      const start: TvFocusPlace = { zone: 'content', index };
      expect(downReachesTab(start, screen)).toBe(true);
      let place: TvFocusPlace = start;
      for (let step = 0; step < screen.contentCount + 2 && place.zone !== 'tab'; step += 1) {
        place = moveTvFocus(place, 'down', screen);
      }
      expect(place).toEqual({ zone: 'tab', index: screen.selectedTab });
      const last: TvFocusPlace = { zone: 'content', index: screen.contentCount - 1 };
      expect(moveTvFocus(last, 'down', screen)).toEqual({ zone: 'tab', index: screen.selectedTab });
    }
  });

  it('moves left and right across the tabs and keeps Down on the bar', () => {
    let place: TvFocusPlace = { zone: 'tab', index: 0 };
    place = moveTvFocus(place, 'left', screen);
    expect(place).toEqual({ zone: 'tab', index: 0 });
    place = moveTvFocus(place, 'right', screen);
    expect(place).toEqual({ zone: 'tab', index: 1 });
    place = moveTvFocus(place, 'right', screen);
    expect(place).toEqual({ zone: 'tab', index: 2 });
    place = moveTvFocus(place, 'right', screen);
    expect(place).toEqual({ zone: 'tab', index: 2 });
    place = moveTvFocus(place, 'down', screen);
    expect(place).toEqual({ zone: 'tab', index: 2 });
  });

  it('returns Up from any tab to the content control that had focus', () => {
    for (let index = 0; index < screen.tabCount; index += 1) {
      expect(moveTvFocus({ zone: 'tab', index }, 'up', screen)).toEqual({
        zone: 'content',
        index: screen.rememberedContent,
      });
    }
  });

  it('lands on Rounds or Brand when that tab is the open one', () => {
    const rounds = { ...screen, selectedTab: 1 };
    const brand = { ...screen, selectedTab: 2 };
    expect(moveTvFocus({ zone: 'bridge' }, 'down', rounds)).toEqual({ zone: 'tab', index: 1 });
    expect(moveTvFocus({ zone: 'bridge' }, 'down', brand)).toEqual({ zone: 'tab', index: 2 });
  });

  it('walks a WOD grid, a Rounds footer, and a Brand column down to the bar', () => {
    const wod: TvFocusModel = { contentCount: 6, tabCount: 3, selectedTab: 0, rememberedContent: 5 };
    const rounds: TvFocusModel = { contentCount: 8, tabCount: 3, selectedTab: 1, rememberedContent: 7 };
    const brand: TvFocusModel = { contentCount: 12, tabCount: 3, selectedTab: 2, rememberedContent: 4 };
    for (const model of [wod, rounds, brand]) {
      expect(downReachesTab({ zone: 'content', index: 0 }, model)).toBe(true);
      expect(downReachesTab({ zone: 'content', index: model.contentCount - 1 }, model)).toBe(true);
      const tab = moveTvFocus({ zone: 'bridge' }, 'down', model);
      expect(tab).toEqual({ zone: 'tab', index: model.selectedTab });
      expect(moveTvFocus(tab, 'up', model)).toEqual({ zone: 'content', index: model.rememberedContent });
    }
  });
});
