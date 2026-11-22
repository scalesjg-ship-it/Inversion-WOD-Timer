import { describe, expect, it } from 'vitest';

import { tvSafeBox } from './layout';
import {
  SETTINGS_SIDEBAR_FRACTION,
  settingsAction,
  settingsBackTab,
  settingsCategoryRows,
  settingsDetailTestId,
  settingsNeighbor,
  TV_SETTINGS_CATEGORIES,
  tvSettingsMetrics,
  type SettingsPlace,
} from './settingsLayout';

const templates = Array.from({ length: 10 }, (_, index) => `template-${index}`);
const palettes = Array.from({ length: 10 }, (_, index) => `palette-${index}`);

function rows() {
  return settingsCategoryRows(templates, palettes);
}

describe('TV settings layout', () => {
  it('keeps a 30% sidebar and every category inside the safe area', () => {
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 960, height: 540 },
    ]) {
      const metrics = tvSettingsMetrics(size.width, size.height);
      const safe = tvSafeBox(true, size.width, size.height);
      const inner = size.width - safe.horizontal * 2;
      expect(metrics.sidebarBlock).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.padH).toBeGreaterThanOrEqual(safe.horizontal);
      expect(metrics.padV).toBeGreaterThanOrEqual(safe.vertical);
      expect(metrics.row).toBeGreaterThanOrEqual(48);
      expect(metrics.sidebarWidth / (inner - metrics.gap)).toBeCloseTo(SETTINGS_SIDEBAR_FRACTION, 2);
      expect(metrics.label).toBeGreaterThanOrEqual(20);
    }
  });

  it('names the categories that already exist on the settings screen', () => {
    expect(TV_SETTINGS_CATEGORIES.map((category) => category.label)).toEqual([
      'Brand',
      'Look',
      'Display',
      'Colors',
      'Logo',
      'Sound',
    ]);
    expect(settingsDetailTestId('brand')).toBe('settings-detail-brand');
    expect(settingsDetailTestId('logo')).toBe('settings-detail-logo');
  });

  it('walks the sidebar, enters the option pane, and returns to the tab', () => {
    const categories = rows();
    let place: SettingsPlace = { zone: 'sidebar', index: 0 };
    expect(settingsNeighbor(place, 'up', categories)).toEqual({ zone: 'tab' });
    expect(settingsNeighbor(place, 'left', categories)).toEqual({ zone: 'self' });

    for (let index = 1; index < TV_SETTINGS_CATEGORIES.length; index += 1) {
      const next = settingsNeighbor(place, 'down', categories);
      expect(next).toEqual({ zone: 'sidebar', index });
      place = { zone: 'sidebar', index };
    }
    expect(settingsNeighbor(place, 'down', categories)).toEqual({ zone: 'self' });

    const entered = settingsNeighbor(place, 'right', categories);
    expect(entered).toEqual({ zone: 'detail', id: 'voice-countdown' });
    expect(settingsAction(place, 'select', categories)).toEqual({ zone: 'detail', id: 'voice-countdown' });
    if (entered.zone !== 'detail') return;
    const option: SettingsPlace = { zone: 'detail', index: place.index, id: entered.id };
    expect(settingsNeighbor(option, 'left', categories)).toEqual({ zone: 'sidebar', index: place.index });
    expect(settingsAction(option, 'back', categories)).toEqual({ zone: 'sidebar', index: place.index });
    expect(settingsAction(place, 'back', categories)).toEqual({ zone: 'leave' });

    let cursor: SettingsPlace = { zone: 'sidebar', index: TV_SETTINGS_CATEGORIES.length - 1 };
    for (let step = 0; step < TV_SETTINGS_CATEGORIES.length; step += 1) {
      const next = settingsNeighbor(cursor, 'up', categories);
      if (next.zone === 'tab') {
        expect(step).toBe(TV_SETTINGS_CATEGORIES.length - 1);
        return;
      }
      expect(next).toEqual({ zone: 'sidebar', index: TV_SETTINGS_CATEGORIES.length - 2 - step });
      if (next.zone === 'sidebar') cursor = { zone: 'sidebar', index: next.index };
    }
    throw new Error('Up from the sidebar did not reach the tab');
  });

  it('moves inside a category and sends the leftmost option back to the sidebar', () => {
    const categories = rows();
    const look = TV_SETTINGS_CATEGORIES.findIndex((category) => category.id === 'look');
    const first: SettingsPlace = { zone: 'detail', index: look, id: 'template-0' };
    expect(settingsNeighbor(first, 'left', categories)).toEqual({ zone: 'sidebar', index: look });
    expect(settingsNeighbor(first, 'right', categories)).toEqual({ zone: 'detail', id: 'template-1' });
    expect(settingsNeighbor(first, 'down', categories)).toEqual({ zone: 'detail', id: 'template-2' });
    expect(settingsNeighbor({ zone: 'detail', index: look, id: 'template-1' }, 'left', categories)).toEqual({
      zone: 'detail',
      id: 'template-0',
    });
    expect(settingsNeighbor({ zone: 'detail', index: look, id: 'template-8' }, 'down', categories)).toEqual({
      zone: 'detail',
      id: 'placement-watermark',
    });
    expect(settingsNeighbor({ zone: 'detail', index: look, id: 'placement-watermark' }, 'left', categories)).toEqual({
      zone: 'sidebar',
      index: look,
    });
    expect(settingsNeighbor({ zone: 'detail', index: look, id: 'placement-corner' }, 'right', categories)).toEqual({
      zone: 'self',
    });
    expect(settingsNeighbor({ zone: 'detail', index: look, id: 'template-0' }, 'up', categories)).toEqual({
      zone: 'self',
    });

    const colors = TV_SETTINGS_CATEGORIES.findIndex((category) => category.id === 'colors');
    expect(settingsNeighbor({ zone: 'sidebar', index: colors }, 'right', categories)).toEqual({
      zone: 'detail',
      id: 'palette-0',
    });
    expect(settingsNeighbor({ zone: 'detail', index: colors, id: 'color-work-toggle' }, 'left', categories)).toEqual({
      zone: 'sidebar',
      index: colors,
    });
    expect(settingsNeighbor({ zone: 'detail', index: colors, id: 'color-work-toggle' }, 'down', categories)).toEqual({
      zone: 'detail',
      id: 'color-rest-toggle',
    });

    const sound = TV_SETTINGS_CATEGORIES.findIndex((category) => category.id === 'sound');
    const logo = TV_SETTINGS_CATEGORIES.findIndex((category) => category.id === 'logo');
    expect(settingsNeighbor({ zone: 'sidebar', index: logo }, 'right', categories)).toEqual({
      zone: 'detail',
      id: 'logo-entry',
    });
    expect(settingsNeighbor({ zone: 'sidebar', index: sound }, 'down', categories)).toEqual({ zone: 'self' });
    expect(settingsNeighbor({ zone: 'detail', index: sound, id: 'voice-countdown' }, 'left', categories)).toEqual({
      zone: 'sidebar',
      index: sound,
    });
    expect(settingsNeighbor({ zone: 'detail', index: sound, id: 'voice-countdown' }, 'right', categories)).toEqual({
      zone: 'self',
    });
    expect(settingsNeighbor({ zone: 'detail', index: sound, id: 'voice-countdown' }, 'up', categories)).toEqual({
      zone: 'self',
    });
    expect(settingsNeighbor({ zone: 'detail', index: sound, id: 'voice-countdown' }, 'down', categories)).toEqual({
      zone: 'self',
    });
    expect(settingsAction({ zone: 'detail', index: sound, id: 'voice-countdown' }, 'back', categories)).toEqual({
      zone: 'sidebar',
      index: sound,
    });
  });

  it('returns to the previous tab, and to WOD when there is no previous tab', () => {
    expect(settingsBackTab(1, 0, 3)).toBe(0);
    expect(settingsBackTab(1, 2, 3)).toBe(2);
    expect(settingsBackTab(1, 1, 3)).toBe(0);
    expect(settingsBackTab(0, 0, 3)).toBe(0);
  });
});
