import { formatCountdown, formatCountUp, formatSeconds } from './format';
import type { Phase, TimerConfig, TimerMode, TimerSnapshot } from './types';

export function modeTitle(mode: TimerMode): string {
  switch (mode) {
    case 'forTime':
      return 'For Time';
    case 'amrap':
      return 'AMRAP';
    case 'emom':
      return 'EMOM';
    case 'tabata':
      return 'Tabata';
    case 'intervals':
      return 'Intervals';
    case 'rounds':
      return 'Rounds';
    case 'countdown':
      return 'Countdown';
    default: {
      const exhaustive: never = mode;
      return exhaustive;
    }
  }
}

export function phaseLabel(phase: Phase, mode: TimerMode): string {
  switch (phase) {
    case 'idle':
      return modeTitle(mode);
    case 'leadIn':
      return 'Get ready';
    case 'work':
      switch (mode) {
        case 'forTime':
          return 'For time';
        case 'amrap':
          return 'AMRAP';
        case 'emom':
          return 'Work';
        case 'tabata':
          return 'Work';
        case 'intervals':
          return 'Work';
        case 'rounds':
          return 'Work';
        case 'countdown':
          return 'Countdown';
        default: {
          const exhaustive: never = mode;
          return exhaustive;
        }
      }
    case 'rest':
      return 'Rest';
    case 'finished':
      return mode === 'forTime' ? 'Time' : 'Done';
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
}

export function roundLabel(snapshot: TimerSnapshot, config: TimerConfig): string {
  if (config.mode === 'forTime') {
    return config.workSeconds > 0 ? `Cap ${formatSeconds(config.workSeconds)}` : 'No cap';
  }
  if (config.mode === 'amrap') return 'As many as you can';
  if (config.mode === 'countdown') return 'Countdown';
  if (snapshot.phase === 'idle' || snapshot.phase === 'leadIn') {
    const noun = config.rounds === 1 ? 'round' : 'rounds';
    return `${config.rounds} ${noun}`;
  }
  const round = Math.max(snapshot.round, 1);
  return `Round ${round} of ${config.rounds}`;
}

export function formatSnapshot(snapshot: TimerSnapshot, config: TimerConfig): string {
  const countUp =
    config.mode === 'forTime' && snapshot.phase !== 'leadIn' && snapshot.phase !== 'idle';
  if (countUp || (config.mode === 'forTime' && snapshot.phase === 'idle')) {
    return formatCountUp(snapshot.displayMs);
  }
  return formatCountdown(snapshot.displayMs);
}
