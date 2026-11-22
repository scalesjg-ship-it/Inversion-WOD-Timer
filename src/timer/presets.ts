import { FINAL_BEEP_SECONDS, WARNING_MARK_CHOICES } from './countdown';
import { normalizeConfig } from './engine';
import type { TimerConfig, TimerMode } from './types';

/** One-tap setups on the Intervals clock. Tabata and the martial-arts rounds live here. */
export interface IntervalPreset {
  id: string;
  name: string;
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  warningSeconds: number;
  leadInSeconds: number;
}

export const INTERVAL_PRESETS: IntervalPreset[] = [
  {
    id: 'tabata',
    name: 'Tabata',
    workSeconds: 20,
    restSeconds: 10,
    rounds: 8,
    warningSeconds: 0,
    leadInSeconds: 10,
  },
  {
    id: 'bjj',
    name: 'BJJ roll',
    workSeconds: 5 * 60,
    restSeconds: 60,
    rounds: 5,
    warningSeconds: 30,
    leadInSeconds: 10,
  },
  {
    id: 'boxing',
    name: 'Boxing',
    workSeconds: 3 * 60,
    restSeconds: 60,
    rounds: 3,
    warningSeconds: 10,
    leadInSeconds: 10,
  },
  {
    id: 'mma',
    name: 'MMA',
    workSeconds: 5 * 60,
    restSeconds: 60,
    rounds: 3,
    warningSeconds: 10,
    leadInSeconds: 10,
  },
  {
    id: 'muay-thai',
    name: 'Muay Thai',
    workSeconds: 3 * 60,
    restSeconds: 60,
    rounds: 5,
    warningSeconds: 10,
    leadInSeconds: 10,
  },
];

export function configFromIntervalPreset(preset: IntervalPreset): TimerConfig {
  return normalizeConfig({
    mode: 'intervals',
    leadInSeconds: preset.leadInSeconds,
    workSeconds: preset.workSeconds,
    restSeconds: preset.restSeconds,
    rounds: preset.rounds,
    warningSeconds: preset.warningSeconds,
  });
}

export function defaultConfig(mode: TimerMode): TimerConfig {
  switch (mode) {
    case 'forTime':
      return normalizeConfig({
        mode,
        leadInSeconds: 10,
        workSeconds: 0,
        restSeconds: 0,
        rounds: 1,
        warningSeconds: 0,
      });
    case 'amrap':
      return normalizeConfig({
        mode,
        leadInSeconds: 10,
        workSeconds: 12 * 60,
        restSeconds: 0,
        rounds: 1,
        warningSeconds: 0,
      });
    case 'emom':
      return normalizeConfig({
        mode,
        leadInSeconds: 10,
        workSeconds: 60,
        restSeconds: 0,
        rounds: 10,
        warningSeconds: 0,
      });
    case 'intervals':
      return normalizeConfig({
        mode,
        leadInSeconds: 10,
        workSeconds: 40,
        restSeconds: 20,
        rounds: 8,
        warningSeconds: 0,
      });
    case 'countdown':
      return normalizeConfig({
        mode,
        leadInSeconds: 10,
        workSeconds: 5 * 60,
        restSeconds: 0,
        rounds: 1,
        warningSeconds: 0,
        warningMarksSeconds: [...WARNING_MARK_CHOICES.map((choice) => choice.seconds), ...FINAL_BEEP_SECONDS],
      });
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}
