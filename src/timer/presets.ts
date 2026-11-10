import { normalizeConfig } from './engine';
import type { TimerConfig, TimerMode } from './types';

export interface RoundPreset {
  id: string;
  name: string;
  roundSeconds: number;
  restSeconds: number;
  rounds: number;
  warningSeconds: number;
  leadInSeconds: number;
  builtIn: boolean;
}

export const BUILTIN_PRESETS: RoundPreset[] = [
  {
    id: 'bjj',
    name: 'BJJ roll',
    roundSeconds: 5 * 60,
    restSeconds: 60,
    rounds: 5,
    warningSeconds: 30,
    leadInSeconds: 10,
    builtIn: true,
  },
  {
    id: 'boxing',
    name: 'Boxing',
    roundSeconds: 3 * 60,
    restSeconds: 60,
    rounds: 3,
    warningSeconds: 10,
    leadInSeconds: 10,
    builtIn: true,
  },
  {
    id: 'mma',
    name: 'MMA',
    roundSeconds: 5 * 60,
    restSeconds: 60,
    rounds: 3,
    warningSeconds: 10,
    leadInSeconds: 10,
    builtIn: true,
  },
  {
    id: 'muay-thai',
    name: 'Muay Thai',
    roundSeconds: 3 * 60,
    restSeconds: 60,
    rounds: 5,
    warningSeconds: 10,
    leadInSeconds: 10,
    builtIn: true,
  },
];

export function configFromPreset(preset: RoundPreset): TimerConfig {
  return normalizeConfig({
    mode: 'rounds',
    leadInSeconds: preset.leadInSeconds,
    workSeconds: preset.roundSeconds,
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
    case 'tabata':
      return normalizeConfig({
        mode,
        leadInSeconds: 10,
        workSeconds: 20,
        restSeconds: 10,
        rounds: 8,
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
    case 'rounds':
      return configFromPreset(BUILTIN_PRESETS[0]);
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}
