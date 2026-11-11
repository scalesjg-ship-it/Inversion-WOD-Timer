import { COUNTDOWN_MAX_SECONDS, sanitizeWarningMarks } from './countdown';
import type {
  Cue,
  EngineState,
  Segment,
  SoundName,
  TimedCue,
  TimerConfig,
  TimerSnapshot,
} from './types';

export type { Cue, EngineState, Segment, SoundName, TimedCue, TimerConfig, TimerSnapshot };
export type { Phase, TimerMode } from './types';

const MAX_ROUNDS = 99;
const MAX_LEAD_IN_SECONDS = 600;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(value);
}

export function normalizeConfig(input: TimerConfig): TimerConfig {
  const leadInSeconds = clamp(safeInt(input.leadInSeconds, 0), 0, MAX_LEAD_IN_SECONDS);
  const rounds = clamp(safeInt(input.rounds, 1), 1, MAX_ROUNDS);

  if (input.mode === 'forTime') {
    return {
      mode: 'forTime',
      leadInSeconds,
      workSeconds: Math.max(0, safeInt(input.workSeconds, 0)),
      restSeconds: 0,
      rounds: 1,
      warningSeconds: 0,
      warningMarksSeconds: [],
    };
  }

  if (input.mode === 'countdown') {
    const workSeconds = Math.min(COUNTDOWN_MAX_SECONDS, Math.max(1, safeInt(input.workSeconds, 60)));
    return {
      mode: 'countdown',
      leadInSeconds,
      workSeconds,
      restSeconds: 0,
      rounds: 1,
      warningSeconds: 0,
      warningMarksSeconds: sanitizeWarningMarks(input.warningMarksSeconds, workSeconds),
    };
  }

  const workSeconds = Math.max(1, safeInt(input.workSeconds, 1));
  const restSeconds =
    input.mode === 'amrap' || input.mode === 'emom' ? 0 : Math.max(0, safeInt(input.restSeconds, 0));
  let warningSeconds = Math.max(0, safeInt(input.warningSeconds, 0));
  if (warningSeconds >= workSeconds) warningSeconds = 0;

  return {
    mode: input.mode,
    leadInSeconds,
    workSeconds,
    restSeconds,
    rounds: input.mode === 'amrap' ? 1 : rounds,
    warningSeconds,
    warningMarksSeconds: [],
  };
}

export function buildSegments(config: TimerConfig): Segment[] {
  const segments: Segment[] = [];
  if (config.leadInSeconds > 0) {
    segments.push({
      phase: 'leadIn',
      durationMs: config.leadInSeconds * 1000,
      round: 0,
    });
  }

  if (config.mode === 'forTime' && config.workSeconds <= 0) {
    segments.push({ phase: 'work', durationMs: Number.POSITIVE_INFINITY, round: 1 });
    return segments;
  }

  const workMs = config.workSeconds * 1000;
  const restMs = config.restSeconds * 1000;
  const warningOffsetMs =
    config.warningSeconds > 0 ? (config.workSeconds - config.warningSeconds) * 1000 : undefined;
  const extraCues = (config.warningMarksSeconds ?? []).flatMap((mark) => {
    if (mark <= 0 || mark >= config.workSeconds) return [];
    return [
      {
        offsetMs: (config.workSeconds - mark) * 1000,
        kind: mark <= 3 ? ('tick' as const) : ('warning' as const),
        remainingMs: mark * 1000,
      },
    ];
  });

  for (let round = 1; round <= config.rounds; round += 1) {
    segments.push({
      phase: 'work',
      durationMs: workMs,
      round,
      warningOffsetMs,
      extraCues: extraCues.length > 0 ? extraCues : undefined,
    });
    if (round < config.rounds && restMs > 0) {
      segments.push({ phase: 'rest', durationMs: restMs, round });
    }
  }
  return segments;
}

export function createInitial(input: TimerConfig): EngineState {
  const config = normalizeConfig(input);
  return {
    config,
    segments: buildSegments(config),
    status: 'idle',
    elapsedBeforeRunMs: 0,
    runStartedAtMs: null,
    completedElapsedMs: null,
  };
}

export function totalDurationMs(segments: Segment[]): number {
  let total = 0;
  for (const segment of segments) {
    if (!Number.isFinite(segment.durationMs)) return Number.POSITIVE_INFINITY;
    total += segment.durationMs;
  }
  return total;
}

export function elapsedMs(state: EngineState, nowMs: number): number {
  if (state.status === 'idle') return 0;
  if (state.status === 'paused' || state.status === 'finished') {
    return state.completedElapsedMs ?? state.elapsedBeforeRunMs;
  }
  const started = state.runStartedAtMs ?? nowMs;
  return state.elapsedBeforeRunMs + Math.max(0, nowMs - started);
}

export function cueTimeline(state: EngineState): TimedCue[] {
  const cues: TimedCue[] = [];
  let cursor = 0;

  for (const segment of state.segments) {
    cues.push({
      atElapsedMs: cursor,
      cue: { type: 'phase', phase: segment.phase, round: segment.round },
    });

    if (segment.phase === 'leadIn') {
      for (const remainingMs of [3000, 2000, 1000]) {
        if (remainingMs >= segment.durationMs) continue;
        const atElapsedMs = cursor + segment.durationMs - remainingMs;
        if (atElapsedMs > cursor) {
          cues.push({ atElapsedMs, cue: { type: 'tick', remainingMs } });
        }
      }
    }

    if (segment.warningOffsetMs != null && Number.isFinite(segment.durationMs)) {
      cues.push({
        atElapsedMs: cursor + segment.warningOffsetMs,
        cue: { type: 'warning', round: segment.round },
      });
    }

    for (const extra of segment.extraCues ?? []) {
      const atElapsedMs = cursor + extra.offsetMs;
      if (extra.kind === 'tick') {
        cues.push({ atElapsedMs, cue: { type: 'tick', remainingMs: extra.remainingMs } });
      } else {
        cues.push({ atElapsedMs, cue: { type: 'warning', round: segment.round } });
      }
    }

    if (segment.phase === 'work' && Number.isFinite(segment.durationMs)) {
      cues.push({
        atElapsedMs: cursor + segment.durationMs,
        cue: { type: 'roundEnd', round: segment.round },
      });
    }

    if (!Number.isFinite(segment.durationMs)) break;
    cursor += segment.durationMs;
  }

  const total = totalDurationMs(state.segments);
  if (Number.isFinite(total)) {
    cues.push({ atElapsedMs: total, cue: { type: 'finished' } });
  }

  return cues;
}

/** Cues with timestamps in (fromExclusiveMs, toInclusiveMs]. */
export function cuesBetween(state: EngineState, fromExclusiveMs: number, toInclusiveMs: number): Cue[] {
  if (!(toInclusiveMs > fromExclusiveMs)) return [];
  const cues: Cue[] = [];
  for (const timed of cueTimeline(state)) {
    if (timed.atElapsedMs > fromExclusiveMs && timed.atElapsedMs <= toInclusiveMs) {
      cues.push(timed.cue);
    }
  }
  return cues;
}

function finishedDisplayMs(config: TimerConfig): number {
  if (config.mode === 'forTime') return Math.max(0, config.workSeconds) * 1000;
  return 0;
}

function warningIsActive(segment: Segment, elapsedInPhaseMs: number, remainingInPhaseMs: number): boolean {
  if (segment.phase !== 'work') return false;
  if (segment.warningOffsetMs != null && elapsedInPhaseMs >= segment.warningOffsetMs) return true;
  const cues = segment.extraCues ?? [];
  if (cues.length === 0 || !Number.isFinite(remainingInPhaseMs)) return false;
  const atLeastTen = cues.filter((cue) => cue.remainingMs >= 10_000);
  const windowMs = atLeastTen.length > 0
    ? Math.min(...atLeastTen.map((cue) => cue.remainingMs))
    : Math.max(...cues.map((cue) => cue.remainingMs));
  return remainingInPhaseMs <= windowMs && remainingInPhaseMs > 0;
}

export function snapshotFromElapsed(state: EngineState, elapsed: number): TimerSnapshot {
  const total = totalDurationMs(state.segments);
  const shell = {
    totalRounds: state.config.rounds,
    running: false,
    paused: false,
  };

  if (elapsed >= total) {
    return {
      ...shell,
      phase: 'finished',
      round: state.config.rounds,
      displayMs: finishedDisplayMs(state.config),
      remainingInPhaseMs: 0,
      elapsedInPhaseMs: 0,
      warningActive: false,
      totalElapsedMs: Number.isFinite(total) ? total : elapsed,
      segmentIndex: state.segments.length,
    };
  }

  let cursor = 0;
  for (let index = 0; index < state.segments.length; index += 1) {
    const segment = state.segments[index];
    if (!segment) continue;
    const end = cursor + segment.durationMs;
    if (elapsed < end || !Number.isFinite(segment.durationMs)) {
      const elapsedInPhaseMs = Math.max(0, elapsed - cursor);
      const remainingInPhaseMs = Number.isFinite(segment.durationMs)
        ? Math.max(0, segment.durationMs - elapsedInPhaseMs)
        : Number.POSITIVE_INFINITY;
      const countUp = state.config.mode === 'forTime' && segment.phase === 'work';
      const warningActive = warningIsActive(segment, elapsedInPhaseMs, remainingInPhaseMs);
      return {
        ...shell,
        phase: segment.phase,
        round: segment.round,
        displayMs: countUp ? elapsedInPhaseMs : remainingInPhaseMs,
        remainingInPhaseMs,
        elapsedInPhaseMs,
        warningActive,
        totalElapsedMs: elapsed,
        segmentIndex: index,
      };
    }
    cursor = end;
  }

  return {
    ...shell,
    phase: 'finished',
    round: state.config.rounds,
    displayMs: finishedDisplayMs(state.config),
    remainingInPhaseMs: 0,
    elapsedInPhaseMs: 0,
    warningActive: false,
    totalElapsedMs: Number.isFinite(total) ? total : elapsed,
    segmentIndex: state.segments.length,
  };
}

function idleSnapshot(state: EngineState): TimerSnapshot {
  const previewMs = state.config.mode === 'forTime' ? 0 : state.config.workSeconds * 1000;
  return {
    phase: 'idle',
    round: 0,
    totalRounds: state.config.rounds,
    displayMs: previewMs,
    remainingInPhaseMs: previewMs,
    elapsedInPhaseMs: 0,
    warningActive: false,
    running: false,
    paused: false,
    totalElapsedMs: 0,
    segmentIndex: -1,
  };
}

export function project(state: EngineState, nowMs: number): TimerSnapshot {
  if (state.status === 'idle') return idleSnapshot(state);

  if (state.status === 'finished') {
    const total = totalDurationMs(state.segments);
    const elapsed =
      state.completedElapsedMs ?? (Number.isFinite(total) ? total : state.elapsedBeforeRunMs);
    const snap = snapshotFromElapsed(state, elapsed);
    return { ...snap, phase: 'finished', running: false, paused: false, warningActive: false };
  }

  const elapsed = elapsedMs(state, nowMs);
  const snap = snapshotFromElapsed(state, elapsed);
  if (state.status === 'paused') {
    return { ...snap, running: false, paused: snap.phase !== 'finished' };
  }
  if (snap.phase === 'finished') {
    return { ...snap, running: false, paused: false };
  }
  return { ...snap, running: true, paused: false };
}

function markFinished(state: EngineState, elapsed: number, manual: boolean): EngineState {
  const total = totalDurationMs(state.segments);
  const clamped = Math.min(elapsed, Number.isFinite(total) ? total : elapsed);
  return {
    ...state,
    status: 'finished',
    elapsedBeforeRunMs: clamped,
    completedElapsedMs: manual ? clamped : null,
    runStartedAtMs: null,
  };
}

export function start(state: EngineState, nowMs: number): EngineState {
  if (state.status === 'running') return state;
  const base = state.status === 'finished' ? createInitial(state.config) : state;
  return {
    ...base,
    status: 'running',
    runStartedAtMs: nowMs,
    completedElapsedMs: null,
  };
}

export function pause(state: EngineState, nowMs: number): EngineState {
  if (state.status !== 'running') return state;
  const elapsed = elapsedMs(state, nowMs);
  const total = totalDurationMs(state.segments);
  if (Number.isFinite(total) && elapsed >= total) return markFinished(state, total, false);
  return {
    ...state,
    status: 'paused',
    elapsedBeforeRunMs: elapsed,
    runStartedAtMs: null,
  };
}

export function complete(state: EngineState, nowMs: number): EngineState {
  if (state.status !== 'running' && state.status !== 'paused') return state;
  const elapsed = state.status === 'paused' ? state.elapsedBeforeRunMs : elapsedMs(state, nowMs);
  return markFinished(state, elapsed, true);
}

export function reset(state: EngineState): EngineState {
  return createInitial(state.config);
}

export function reconcile(state: EngineState, nowMs: number): EngineState {
  if (state.status !== 'running') return state;
  const elapsed = elapsedMs(state, nowMs);
  const total = totalDurationMs(state.segments);
  if (Number.isFinite(total) && elapsed >= total) return markFinished(state, total, false);
  return state;
}

/**
 * Map a batch of cues that share a moment to the sounds that should play.
 * A round ending into rest is one bell. Back-to-back work (EMOM) is one start beep.
 * The final horn replaces the last round-end bell.
 */
export function soundsForCues(cues: Cue[]): SoundName[] {
  if (cues.length === 0) return [];
  const hasFinished = cues.some((cue) => cue.type === 'finished');
  const hasWarning = cues.some((cue) => cue.type === 'warning');
  const hasTick = cues.some((cue) => cue.type === 'tick');
  const hasLead = cues.some((cue) => cue.type === 'phase' && cue.phase === 'leadIn');
  const hasWork = cues.some((cue) => cue.type === 'phase' && cue.phase === 'work');
  const hasRest = cues.some((cue) => cue.type === 'phase' && cue.phase === 'rest');
  const hasRoundEnd = cues.some((cue) => cue.type === 'roundEnd');

  const sounds: SoundName[] = [];
  if (hasLead || hasTick) sounds.push('tick');
  if (hasWarning) sounds.push('warning');
  if (hasFinished) {
    sounds.push('bell');
    return sounds;
  }
  if (hasRoundEnd && hasWork && !hasRest) {
    sounds.push('start');
    return sounds;
  }
  if (hasRoundEnd || hasRest) sounds.push('bell');
  if (hasWork) sounds.push('start');
  return sounds;
}
