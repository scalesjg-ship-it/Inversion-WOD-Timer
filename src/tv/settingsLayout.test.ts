import { describe, expect, it } from 'vitest';

import { tvSafeBox } from './layout';
import { nextSettingsFocus, tvSettingsGroups, tvSettingsMetrics } from './settingsLayout';

const templates = Array.from({ length: 10 }, (_, index) => `template-${index}`);
const palettes = Array.from({ length: 10 }, (_, index) => `palette-${index}`);

describe('TV settings layout', () => {
  it('fits the closed list inside the safe area at 1080p and 720p', () => {
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
    ]) {
      const metrics = tvSettingsMetrics(size.width, size.height);
      const safe = tvSafeBox(true, size.width, size.height);
      expect(metrics.collapsedHeight).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.padH).toBeGreaterThanOrEqual(safe.horizontal);
      expect(metrics.padV).toBeGreaterThanOrEqual(safe.vertical);
      expect(metrics.row).toBeGreaterThanOrEqual(40);
    }
  });

  it('walks focus down the closed rows and into color sets when More is open', () => {
    const closed = tvSettingsGroups(templates, palettes, false);
    expect(nextSettingsFocus('brand-name', 'up', closed)).toBeNull();
    expect(nextSettingsFocus('brand-name', 'down', closed)).toBe('template-0');
    expect(nextSettingsFocus('template-0', 'down', closed)).toBe('template-5');
    expect(nextSettingsFocus('template-5', 'down', closed)).toBe('placement-watermark');
    expect(nextSettingsFocus('placement-corner', 'right', closed)).toBe('placement-corner');
    expect(nextSettingsFocus('clock-regular', 'down', closed)).toBe('settings-more');
    expect(nextSettingsFocus('settings-more', 'down', closed)).toBe('settings-more');

    const open = tvSettingsGroups(templates, palettes, true);
    expect(nextSettingsFocus('settings-more', 'down', open)).toBe('palette-0');
    expect(nextSettingsFocus('palette-0', 'up', open)).toBe('settings-more');
  });
});
