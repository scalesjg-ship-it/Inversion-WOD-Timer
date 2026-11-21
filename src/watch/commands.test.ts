import { describe, expect, it } from 'vitest';

import { backStep } from '../tv/timerTransport';

import { mapWatchCommand, watchControl, type WatchClock } from './commands';

const idle: WatchClock = { phase: 'idle', running: false, paused: false };
const ready: WatchClock = { phase: 'leadIn', running: true, paused: false };
const work: WatchClock = { phase: 'work', running: true, paused: false };
const paused: WatchClock = { phase: 'work', running: false, paused: true };
const rest: WatchClock = { phase: 'rest', running: true, paused: false };
const done: WatchClock = { phase: 'finished', running: false, paused: false };

describe('watch command mapping', () => {
  it('starts an idle or finished clock and ignores start while it is going', () => {
    expect(mapWatchCommand('start', idle)).toBe('start');
    expect(mapWatchCommand('start', done)).toBe('start');
    expect(mapWatchCommand('start', work)).toBe('ignore');
    expect(mapWatchCommand('start', paused)).toBe('ignore');
    expect(mapWatchCommand('start', ready)).toBe('ignore');
  });

  it('pauses only a running clock, the same case as Select', () => {
    expect(mapWatchCommand('pause', work)).toBe('pause');
    expect(mapWatchCommand('pause', rest)).toBe('pause');
    expect(mapWatchCommand('pause', ready)).toBe('pause');
    expect(mapWatchCommand('pause', paused)).toBe('ignore');
    expect(mapWatchCommand('pause', idle)).toBe('ignore');
    expect(mapWatchCommand('pause', done)).toBe('ignore');
  });

  it('resumes only a paused clock', () => {
    expect(mapWatchCommand('resume', paused)).toBe('resume');
    expect(mapWatchCommand('resume', work)).toBe('ignore');
    expect(mapWatchCommand('resume', idle)).toBe('ignore');
    expect(mapWatchCommand('resume', done)).toBe('ignore');
  });

  it('resets any clock that has left idle, including a running one', () => {
    expect(mapWatchCommand('reset', idle)).toBe('ignore');
    expect(mapWatchCommand('reset', work)).toBe('reset');
    expect(mapWatchCommand('reset', paused)).toBe('reset');
    expect(mapWatchCommand('reset', rest)).toBe('reset');
    expect(mapWatchCommand('reset', done)).toBe('reset');
    expect(mapWatchCommand('reset', ready)).toBe('reset');
  });

  it('never arms Back-to-exit', () => {
    const names = ['start', 'pause', 'resume', 'reset'] as const;
    for (const name of names) {
      expect(watchControl(name, work).leaveArmed).toBe(false);
    }
    expect(backStep({ running: true, paused: false, confirming: false, leaveArmed: false })).toBe('pause');
    expect(watchControl('pause', work)).toEqual({ action: 'pause', leaveArmed: false });
  });
});
