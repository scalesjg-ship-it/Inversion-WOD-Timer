export type TimerMode = 'forTime' | 'amrap' | 'emom' | 'tabata' | 'intervals' | 'rounds';

export type Phase = 'idle' | 'leadIn' | 'work' | 'rest' | 'finished';

export type EngineStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerConfig {
  mode: TimerMode;
  leadInSeconds: number;
  /** Work length in seconds. For Time uses this as the cap; 0 means no cap. AMRAP uses it as the total time. EMOM uses it as the interval. */
  workSeconds: number;
  restSeconds: number;
  rounds: number;
  /** Seconds before the end of a work segment to fire the warning. 0 disables it. */
  warningSeconds: number;
}

export interface Segment {
  phase: 'leadIn' | 'work' | 'rest';
  durationMs: number;
  round: number;
  /** Offset from the start of the segment when the warning cue fires. */
  warningOffsetMs?: number;
}

export type Cue =
  | { type: 'phase'; phase: 'leadIn' | 'work' | 'rest'; round: number }
  | { type: 'tick'; remainingMs: number }
  | { type: 'warning'; round: number }
  | { type: 'roundEnd'; round: number }
  | { type: 'finished' };

export interface EngineState {
  config: TimerConfig;
  segments: Segment[];
  status: EngineStatus;
  /** Timer-time already accumulated before the current running stretch. */
  elapsedBeforeRunMs: number;
  /** Wall clock when the current running stretch began. */
  runStartedAtMs: number | null;
  /** Set when the athlete stops a count-up clock before a cap. */
  completedElapsedMs: number | null;
}

export interface TimerSnapshot {
  phase: Phase;
  round: number;
  totalRounds: number;
  displayMs: number;
  remainingInPhaseMs: number;
  elapsedInPhaseMs: number;
  warningActive: boolean;
  running: boolean;
  paused: boolean;
  totalElapsedMs: number;
  segmentIndex: number;
}

export type SoundName = 'tick' | 'warning' | 'start' | 'bell';

export interface TimedCue {
  atElapsedMs: number;
  cue: Cue;
}
