import { describe, expect, it } from 'vitest';

import { configFromIntervalPreset, INTERVAL_PRESETS } from './presets';

describe('interval presets', () => {
  it('puts Tabata and the martial-arts clocks on one Intervals timer', () => {
    expect(INTERVAL_PRESETS.map((preset) => preset.name)).toEqual([
      'Tabata',
      'BJJ roll',
      'Boxing',
      'MMA',
      'Muay Thai',
    ]);
    expect(configFromIntervalPreset(INTERVAL_PRESETS[0])).toMatchObject({
      mode: 'intervals',
      workSeconds: 20,
      restSeconds: 10,
      rounds: 8,
      warningSeconds: 0,
    });
    expect(configFromIntervalPreset(INTERVAL_PRESETS[1])).toMatchObject({
      mode: 'intervals',
      workSeconds: 300,
      restSeconds: 60,
      rounds: 5,
      warningSeconds: 30,
    });
  });
});
