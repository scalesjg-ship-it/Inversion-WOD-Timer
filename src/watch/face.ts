import { formatSnapshot, roundLabel } from '../timer/labels';
import type { Phase, TimerConfig, TimerSnapshot } from '../timer/types';

import type { WatchEvent, WatchEventName, WatchPhase, WatchPrimary, WatchState } from './protocol';

export function watchPhase(phase: Phase): WatchPhase {
  switch (phase) {
    case 'idle':
      return 'idle';
    case 'leadIn':
      return 'getReady';
    case 'work':
      return 'work';
    case 'rest':
      return 'rest';
    case 'finished':
      return 'finished';
    default: {
      const unexpected: never = phase;
      return unexpected;
    }
  }
}

/** Labels the wrist shows. WORK, REST, and GET READY match the phase names on the TV. */
export function watchPhaseText(phase: Phase): string {
  switch (phase) {
    case 'idle':
      return 'READY';
    case 'leadIn':
      return 'GET READY';
    case 'work':
      return 'WORK';
    case 'rest':
      return 'REST';
    case 'finished':
      return 'DONE';
    default: {
      const unexpected: never = phase;
      return unexpected;
    }
  }
}

export function watchPrimary(snapshot: TimerSnapshot): WatchPrimary {
  if (snapshot.running) return 'pause';
  if (snapshot.paused) return 'resume';
  return 'start';
}

export function watchPrimaryTitle(primary: WatchPrimary): string {
  switch (primary) {
    case 'start':
      return 'Start';
    case 'pause':
      return 'Pause';
    case 'resume':
      return 'Resume';
    default: {
      const unexpected: never = primary;
      return unexpected;
    }
  }
}

function clip(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) return '—';
  return trimmed.length > 80 ? trimmed.slice(0, 80) : trimmed;
}

export function buildWatchState(
  snapshot: TimerSnapshot,
  config: TimerConfig,
  seq: number,
): WatchState {
  const primary = watchPrimary(snapshot);
  return {
    v: 1,
    type: 'state',
    seq,
    phase: watchPhase(snapshot.phase),
    running: snapshot.running,
    paused: snapshot.paused,
    timeText: clip(formatSnapshot(snapshot, config)),
    phaseText: watchPhaseText(snapshot.phase),
    roundText: clip(roundLabel(snapshot, config)),
    round: Math.max(0, snapshot.round),
    totalRounds: Math.max(1, snapshot.totalRounds),
    primary,
    canReset: snapshot.phase !== 'idle',
  };
}

/**
 * One haptic per change. Finishing is its own event so the watch does not
 * also tap for the phase that ended.
 */
export function watchEvents(
  previous: Pick<TimerSnapshot, 'phase' | 'round'> | null,
  next: TimerSnapshot,
  seq: number,
): WatchEvent[] {
  if (!previous) return [];
  let name: WatchEventName | null = null;
  if (next.phase === 'finished' && previous.phase !== 'finished') name = 'finished';
  else if (next.phase !== previous.phase) name = 'phase';
  else if (next.round !== previous.round) name = 'round';
  if (!name) return [];
  return [
    {
      v: 1,
      type: 'event',
      seq,
      name,
      phase: watchPhase(next.phase),
      round: Math.max(0, next.round),
      totalRounds: Math.max(1, next.totalRounds),
    },
  ];
}
