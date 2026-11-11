import { describe, expect, it } from 'vitest';

import { addCountdownSeconds, joinDuration, splitDuration } from './countdown';
import { formatCountdown, formatCountUp } from './format';
import {
  complete,
  createInitial,
  cuesBetween,
  elapsedMs,
  normalizeConfig,
  pause,
  project,
  reconcile,
  soundsForCues,
  start,
  totalDurationMs,
} from './engine';
import { notificationPlan, selectUpcoming } from './notificationPlan';
import type { Cue, TimerConfig } from './types';

function roundsConfig(overrides: Partial<TimerConfig> = {}): TimerConfig {
  return normalizeConfig({
    mode: 'rounds',
    leadInSeconds: 10,
    workSeconds: 60,
    restSeconds: 20,
    rounds: 2,
    warningSeconds: 10,
    ...overrides,
  });
}

function cuesWhileRunning(config: TimerConfig, stepMs = 100): Cue[] {
  const state = start(createInitial(config), 0);
  const total = totalDurationMs(state.segments);
  const seen: Cue[] = [];
  let last = -1;
  const end = Number.isFinite(total) ? total : 5 * 60 * 1000;
  for (let elapsed = 0; elapsed <= end; elapsed += stepMs) {
    seen.push(...cuesBetween(state, last, elapsed));
    last = elapsed;
  }
  if (last < end) seen.push(...cuesBetween(state, last, end));
  return seen;
}

describe('normalizeConfig', () => {
  it('clamps invalid durations and drops a warning that would fire immediately', () => {
    const config = normalizeConfig({
      mode: 'rounds',
      leadInSeconds: -4,
      workSeconds: 30,
      restSeconds: -5,
      rounds: 0,
      warningSeconds: 30,
    });
    expect(config.leadInSeconds).toBe(0);
    expect(config.rounds).toBe(1);
    expect(config.restSeconds).toBe(0);
    expect(config.warningSeconds).toBe(0);
  });

  it('forces AMRAP and For Time onto a single work segment', () => {
    expect(normalizeConfig({
      mode: 'amrap',
      leadInSeconds: 10,
      workSeconds: 120,
      restSeconds: 15,
      rounds: 4,
      warningSeconds: 5,
    }).rounds).toBe(1);
    const forTime = normalizeConfig({
      mode: 'forTime',
      leadInSeconds: 10,
      workSeconds: 90,
      restSeconds: 15,
      rounds: 3,
      warningSeconds: 10,
    });
    expect(forTime.restSeconds).toBe(0);
    expect(forTime.rounds).toBe(1);
    expect(forTime.warningSeconds).toBe(0);
  });
});

describe('clock formatting', () => {
  it('holds a countdown second until it has fully elapsed', () => {
    expect(formatCountdown(10_000)).toBe('00:10');
    expect(formatCountdown(9_001)).toBe('00:10');
    expect(formatCountdown(9_000)).toBe('00:09');
    expect(formatCountdown(1)).toBe('00:01');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('counts up by flooring elapsed time', () => {
    expect(formatCountUp(0)).toBe('00:00');
    expect(formatCountUp(999)).toBe('00:00');
    expect(formatCountUp(90_000)).toBe('01:30');
    expect(formatCountUp(3_600_000)).toBe('1:00:00');
  });
});

describe('segment timeline', () => {
  it('counts a 10 second lead-in down to the first work segment on the boundary', () => {
    const state = start(createInitial(roundsConfig()), 0);
    const justBefore = project(state, 9_999);
    const atBoundary = project(state, 10_000);
    expect(justBefore.phase).toBe('leadIn');
    expect(justBefore.displayMs).toBe(1);
    expect(atBoundary.phase).toBe('work');
    expect(atBoundary.round).toBe(1);
    expect(atBoundary.displayMs).toBe(60_000);
  });

  it('runs work, rest, work, and skips rest after the last round', () => {
    const state = createInitial(roundsConfig({ leadInSeconds: 0, workSeconds: 20, restSeconds: 10, rounds: 3, warningSeconds: 0 }));
    expect(state.segments.map((segment) => segment.phase)).toEqual(['work', 'rest', 'work', 'rest', 'work']);
    const running = start(state, 0);
    expect(project(running, 19_999).phase).toBe('work');
    expect(project(running, 20_000).phase).toBe('rest');
    expect(project(running, 30_000).phase).toBe('work');
    expect(project(running, 30_000).round).toBe(2);
    expect(project(running, 79_999).phase).toBe('work');
    expect(project(running, 79_999).round).toBe(3);
    expect(project(running, 80_000).phase).toBe('finished');
    expect(totalDurationMs(state.segments)).toBe(80_000);
  });

  it('builds classic Tabata as eight work segments and seven rests', () => {
    const state = createInitial({
      mode: 'tabata',
      leadInSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      rounds: 8,
      warningSeconds: 0,
    });
    expect(state.segments.filter((segment) => segment.phase === 'work')).toHaveLength(8);
    expect(state.segments.filter((segment) => segment.phase === 'rest')).toHaveLength(7);
    expect(state.segments.at(-1)?.phase).toBe('work');
    expect(totalDurationMs(state.segments)).toBe(240_000);
  });

  it('places EMOM intervals back to back', () => {
    const state = createInitial({
      mode: 'emom',
      leadInSeconds: 0,
      workSeconds: 60,
      restSeconds: 30,
      rounds: 4,
      warningSeconds: 0,
    });
    expect(state.segments.map((segment) => segment.phase)).toEqual(['work', 'work', 'work', 'work']);
    expect(totalDurationMs(state.segments)).toBe(240_000);
    const running = start(state, 5_000);
    expect(project(running, 5_000 + 60_000).round).toBe(2);
    expect(project(running, 5_000 + 240_000).phase).toBe('finished');
  });
});

describe('warnings', () => {
  it('fires the warning once, on the timer, ten seconds before the round ends', () => {
    const config = roundsConfig({ leadInSeconds: 10, workSeconds: 60, warningSeconds: 10, rounds: 2, restSeconds: 20 });
    const seen = cuesWhileRunning(config);
    const warnings = seen.filter((cue) => cue.type === 'warning');
    expect(warnings).toEqual([
      { type: 'warning', round: 1 },
      { type: 'warning', round: 2 },
    ]);

    const state = start(createInitial(config), 0);
    const warningAt = 10_000 + 50_000;
    expect(project(state, warningAt - 1).warningActive).toBe(false);
    expect(project(state, warningAt).warningActive).toBe(true);
    expect(project(state, warningAt).phase).toBe('work');
    expect(project(state, 10_000 + 60_000).phase).toBe('rest');
    expect(project(state, 10_000 + 60_000).warningActive).toBe(false);
  });

  it('does not emit a warning when the option is off', () => {
    const seen = cuesWhileRunning(roundsConfig({ warningSeconds: 0, leadInSeconds: 0, rounds: 1, restSeconds: 0 }));
    expect(seen.some((cue) => cue.type === 'warning')).toBe(false);
  });
});

describe('pause and accuracy', () => {
  it('freezes the clock across a long wall-clock gap and resumes from that instant', () => {
    let state = start(createInitial(roundsConfig({ leadInSeconds: 0, workSeconds: 60, warningSeconds: 10 })), 1_000);
    state = pause(state, 1_000 + 20_000);
    expect(project(state, 1_000 + 3_600_000).totalElapsedMs).toBe(20_000);
    expect(project(state, 1_000 + 3_600_000).displayMs).toBe(40_000);
    expect(elapsedMs(state, 9_999_999)).toBe(20_000);

    state = start(state, 1_000 + 20_000 + 3_600_000);
    const tenSecondsLater = 1_000 + 20_000 + 3_600_000 + 10_000;
    expect(project(state, tenSecondsLater).totalElapsedMs).toBe(30_000);
    expect(project(state, tenSecondsLater).displayMs).toBe(30_000);
  });

  it('keeps the warning aligned to timer time after a pause', () => {
    let state = start(
      createInitial(roundsConfig({ leadInSeconds: 0, workSeconds: 60, restSeconds: 0, rounds: 1, warningSeconds: 10 })),
      1_000,
    );
    state = pause(state, 21_000);
    const resumeAt = 21_000 + 3_600_000;
    state = start(state, resumeAt);
    const warningWall = resumeAt + 30_000;
    expect(cuesBetween(state, 20_000, 49_999).some((cue) => cue.type === 'warning')).toBe(false);
    expect(cuesBetween(state, 49_999, 50_000)).toContainEqual({ type: 'warning', round: 1 });
    const snap = project(state, warningWall);
    expect(snap.warningActive).toBe(true);
    expect(snap.remainingInPhaseMs).toBe(10_000);
  });
});

describe('mode clocks', () => {
  it('counts AMRAP down and finishes on the cap', () => {
    const state = start(
      createInitial({ mode: 'amrap', leadInSeconds: 10, workSeconds: 12 * 60, restSeconds: 0, rounds: 1, warningSeconds: 0 }),
      0,
    );
    expect(project(state, 10_000).displayMs).toBe(720_000);
    expect(project(state, 10_000 + 60_000).displayMs).toBe(660_000);
    const done = reconcile(state, 10_000 + 720_000);
    expect(done.status).toBe('finished');
    expect(project(done, 10_000 + 720_000).phase).toBe('finished');
    expect(project(done, 10_000 + 720_000).displayMs).toBe(0);
  });

  it('counts For Time up and stops at the cap', () => {
    const state = start(
      createInitial({ mode: 'forTime', leadInSeconds: 10, workSeconds: 90, restSeconds: 0, rounds: 1, warningSeconds: 0 }),
      0,
    );
    expect(project(state, 10_000).displayMs).toBe(0);
    expect(project(state, 10_000 + 45_000).displayMs).toBe(45_000);
    const done = reconcile(state, 10_000 + 90_000);
    expect(project(done, 0).phase).toBe('finished');
    expect(project(done, 0).displayMs).toBe(90_000);
  });

  it('lets an uncapped For Time run and records a manual finish', () => {
    let state = start(
      createInitial({ mode: 'forTime', leadInSeconds: 0, workSeconds: 0, restSeconds: 0, rounds: 1, warningSeconds: 0 }),
      0,
    );
    expect(project(state, 2 * 3_600_000).phase).toBe('work');
    expect(project(state, 2 * 3_600_000).displayMs).toBe(2 * 3_600_000);
    expect(reconcile(state, 2 * 3_600_000).status).toBe('running');
    state = complete(state, 125_000);
    expect(project(state, 999_999).phase).toBe('finished');
    expect(project(state, 999_999).displayMs).toBe(125_000);
  });
});

describe('cue sounds', () => {
  it('plays a get-ready tick, 3-2-1, then the start horn', () => {
    const state = createInitial(roundsConfig({ leadInSeconds: 10, workSeconds: 30, restSeconds: 0, rounds: 1, warningSeconds: 0 }));
    expect(soundsForCues(cuesBetween(state, -1, 0))).toEqual(['tick']);
    expect(cuesBetween(state, 0, 7_000)).toContainEqual({ type: 'tick', remainingMs: 3000 });
    expect(cuesBetween(state, 7_000, 8_000)).toContainEqual({ type: 'tick', remainingMs: 2000 });
    expect(cuesBetween(state, 8_000, 9_000)).toContainEqual({ type: 'tick', remainingMs: 1000 });
    expect(soundsForCues(cuesBetween(state, 9_000, 10_000))).toEqual(['start']);
  });

  it('uses one bell when work ends and rest begins', () => {
    const state = createInitial(roundsConfig({ leadInSeconds: 0, workSeconds: 20, restSeconds: 10, rounds: 2, warningSeconds: 0 }));
    expect(soundsForCues(cuesBetween(state, 0, 20_000))).toEqual(['bell']);
    expect(soundsForCues(cuesBetween(state, 20_000, 30_000))).toEqual(['start']);
  });

  it('uses one start beep on an EMOM boundary and a bell at the end', () => {
    const state = createInitial({
      mode: 'emom',
      leadInSeconds: 0,
      workSeconds: 60,
      restSeconds: 0,
      rounds: 2,
      warningSeconds: 0,
    });
    expect(soundsForCues(cuesBetween(state, 0, 60_000))).toEqual(['start']);
    expect(soundsForCues(cuesBetween(state, 60_000, 120_000))).toEqual(['bell']);
  });

  it('orders a warning ahead of the final bell when a jump crosses both', () => {
    const state = createInitial(roundsConfig({ leadInSeconds: 0, workSeconds: 60, restSeconds: 0, rounds: 1, warningSeconds: 10 }));
    expect(soundsForCues(cuesBetween(state, 0, 60_000))).toEqual(['warning', 'bell']);
  });
});

describe('notification plan', () => {
  it('schedules the warning and the horns and skips cues that already passed', () => {
    const state = start(
      createInitial(roundsConfig({ leadInSeconds: 10, workSeconds: 60, restSeconds: 0, rounds: 1, warningSeconds: 10 })),
      5_000,
    );
    const plan = notificationPlan(state, 'CrossFit Inversion');
    expect(plan[0]).toMatchObject({ atElapsedMs: 0, sound: 'tick', title: 'Get ready', body: 'CrossFit Inversion' });
    expect(plan.some((item) => item.sound === 'warning' && item.atElapsedMs === 60_000)).toBe(true);
    expect(plan.at(-1)).toMatchObject({ sound: 'bell', title: 'Done' });

    const upcoming = selectUpcoming(plan, state, 5_000 + 12_000, 60);
    expect(upcoming.every((entry) => entry.item.atElapsedMs > 12_000)).toBe(true);
    const first = upcoming[0];
    expect(first).toBeDefined();
    if (first) expect(first.fireAtMs).toBe(5_000 + first.item.atElapsedMs);
  });

  it('caps the number of pending cues', () => {
    const state = start(
      createInitial({ mode: 'emom', leadInSeconds: 0, workSeconds: 60, restSeconds: 0, rounds: 40, warningSeconds: 0 }),
      0,
    );
    const plan = notificationPlan(state, 'Gym');
    expect(plan.length).toBeGreaterThan(10);
    expect(selectUpcoming(plan, state, 0, 8)).toHaveLength(8);
    expect(selectUpcoming(plan, pause(state, 1_000), 1_000, 8)).toHaveLength(0);
  });
});

describe('custom countdown', () => {
  const countdown = {
    mode: 'countdown' as const,
    leadInSeconds: 0,
    workSeconds: 90,
    restSeconds: 0,
    rounds: 1,
    warningSeconds: 0,
    warningMarksSeconds: [60, 30, 10, 3, 2, 1],
  };

  it('beeps at 1:00, 0:30, 0:10 and ticks the last three seconds, each once', () => {
    const seen = cuesWhileRunning(countdown);
    expect(seen.filter((cue) => cue.type === 'warning')).toEqual([
      { type: 'warning', round: 1 },
      { type: 'warning', round: 1 },
      { type: 'warning', round: 1 },
    ]);
    expect(seen.filter((cue) => cue.type === 'tick')).toEqual([
      { type: 'tick', remainingMs: 3000 },
      { type: 'tick', remainingMs: 2000 },
      { type: 'tick', remainingMs: 1000 },
    ]);

    const state = createInitial(countdown);
    expect(cuesBetween(state, 29_999, 30_000)).toContainEqual({ type: 'warning', round: 1 });
    expect(cuesBetween(state, 59_999, 60_000)).toContainEqual({ type: 'warning', round: 1 });
    expect(cuesBetween(state, 79_999, 80_000)).toContainEqual({ type: 'warning', round: 1 });
    expect(cuesBetween(state, 86_999, 87_000)).toContainEqual({ type: 'tick', remainingMs: 3000 });

    const running = start(state, 0);
    expect(project(running, 79_000).warningActive).toBe(false);
    expect(project(running, 80_000).warningActive).toBe(true);
    expect(project(running, 80_000).displayMs).toBe(10_000);
    expect(reconcile(running, 90_000).status).toBe('finished');
  });

  it('accepts a zero lead-in and a custom lead-in', () => {
    const immediate = start(createInitial(countdown), 0);
    expect(project(immediate, 0).phase).toBe('work');
    const lead = start(createInitial({ ...countdown, leadInSeconds: 5, workSeconds: 30, warningMarksSeconds: [] }), 0);
    expect(project(lead, 4_999).phase).toBe('leadIn');
    expect(project(lead, 4_999).displayMs).toBe(1);
    expect(project(lead, 5_000).phase).toBe('work');
    expect(project(lead, 5_000).displayMs).toBe(30_000);
  });

  it('drops warning marks that are longer than the countdown', () => {
    const config = normalizeConfig({
      ...countdown,
      workSeconds: 20,
      warningMarksSeconds: [60, 10, 3, 2, 1, 0, -4],
    });
    expect(config.warningMarksSeconds).toEqual([10, 3, 2, 1]);
    expect(config.rounds).toBe(1);
    expect(config.restSeconds).toBe(0);
  });

  it('keeps warning alignment after a pause', () => {
    let state = start(createInitial(countdown), 1_000);
    state = pause(state, 1_000 + 20_000);
    state = start(state, 1_000 + 20_000 + 3_600_000);
    expect(cuesBetween(state, 20_000, 29_999).some((cue) => cue.type === 'warning')).toBe(false);
    expect(cuesBetween(state, 29_999, 30_000)).toContainEqual({ type: 'warning', round: 1 });
  });
});

describe('countdown duration edits', () => {
  it('adds quick increments and splits hours, minutes, and seconds', () => {
    expect(addCountdownSeconds(5, 30)).toBe(35);
    expect(addCountdownSeconds(50, 60)).toBe(110);
    expect(addCountdownSeconds(10, 5 * 60)).toBe(310);
    expect(addCountdownSeconds(2, -30)).toBe(1);
    expect(splitDuration(joinDuration(1, 2, 3))).toEqual({ hours: 1, minutes: 2, seconds: 3 });
  });
});
