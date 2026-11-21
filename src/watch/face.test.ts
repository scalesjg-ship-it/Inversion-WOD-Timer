import { describe, expect, it } from 'vitest';

import type { TimerConfig, TimerSnapshot } from '../timer/types';

import { buildWatchState, watchEvents, watchPhaseText } from './face';
import { decodeMessage } from './protocol';

const config: TimerConfig = {
  mode: 'tabata',
  leadInSeconds: 10,
  workSeconds: 20,
  restSeconds: 10,
  rounds: 8,
  warningSeconds: 3,
};

function snap(patch: Partial<TimerSnapshot>): TimerSnapshot {
  return {
    phase: 'work',
    round: 3,
    totalRounds: 8,
    displayMs: 42_000,
    remainingInPhaseMs: 42_000,
    elapsedInPhaseMs: 0,
    warningActive: false,
    running: true,
    paused: false,
    totalElapsedMs: 0,
    segmentIndex: 1,
    ...patch,
  };
}

describe('watch face', () => {
  it('names the phases the wrist shows', () => {
    expect(watchPhaseText('leadIn')).toBe('GET READY');
    expect(watchPhaseText('work')).toBe('WORK');
    expect(watchPhaseText('rest')).toBe('REST');
    expect(watchPhaseText('finished')).toBe('DONE');
    expect(watchPhaseText('idle')).toBe('READY');
  });

  it('builds a state snapshot the protocol accepts', () => {
    const message = buildWatchState(snap({}), config, 1);
    expect(decodeMessage(JSON.stringify(message))).toEqual(message);
    expect(message.phaseText).toBe('WORK');
    expect(message.timeText).toBe('00:42');
    expect(message.roundText).toBe('Round 3 of 8');
    expect(message.primary).toBe('pause');
    expect(message.canReset).toBe(true);
  });

  it('emits one event for a phase change, a round change, or the finish', () => {
    const work = snap({});
    const rest = snap({ phase: 'rest', displayMs: 10_000 });
    const nextRound = snap({ round: 4 });
    const finished = snap({ phase: 'finished', running: false, round: 8 });
    expect(watchEvents(null, work, 1)).toEqual([]);
    expect(watchEvents(work, rest, 2)[0]?.name).toBe('phase');
    expect(watchEvents(work, nextRound, 3)[0]?.name).toBe('round');
    expect(watchEvents(work, finished, 4)).toEqual([
      { v: 1, type: 'event', seq: 4, name: 'finished', phase: 'finished', round: 8, totalRounds: 8 },
    ]);
    expect(watchEvents(work, work, 5)).toEqual([]);
  });
});
