import type { Phase } from '../timer/types';

import type { WatchCommandName } from './protocol';

/**
 * What a watch command does to the clock.
 * Pause, resume, and reset call the same timer functions as the Siri Remote.
 * `leaveArmed` is always false: a wrist pause must not arm Back-to-exit.
 * Hardware Back still uses `backStep` in the TV screen.
 */
export type WatchClockAction = 'start' | 'pause' | 'resume' | 'reset' | 'ignore';

export interface WatchClock {
  phase: Phase;
  running: boolean;
  paused: boolean;
}

export interface WatchControlEffect {
  action: WatchClockAction;
  leaveArmed: false;
}

export function mapWatchCommand(name: WatchCommandName, clock: WatchClock): WatchClockAction {
  switch (name) {
    case 'start':
      if (clock.running || clock.paused) return 'ignore';
      if (clock.phase === 'idle' || clock.phase === 'finished') return 'start';
      return 'ignore';
    case 'pause':
      return clock.running ? 'pause' : 'ignore';
    case 'resume':
      return clock.paused && !clock.running ? 'resume' : 'ignore';
    case 'reset':
      return clock.phase === 'idle' ? 'ignore' : 'reset';
    default: {
      const unexpected: never = name;
      return unexpected;
    }
  }
}

export function watchControl(name: WatchCommandName, clock: WatchClock): WatchControlEffect {
  return { action: mapWatchCommand(name, clock), leaveArmed: false };
}
