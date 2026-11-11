import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { clearScheduledCues, syncScheduledCues } from '@/src/audio/cueScheduler';
import { playCueBatch } from '@/src/audio/sounds';

import {
  complete,
  createInitial,
  cuesBetween,
  elapsedMs,
  pause,
  project,
  reconcile,
  reset,
  seekBy,
  start,
  stepRound,
} from './engine';
import type { EngineState, TimerConfig, TimerSnapshot } from './types';

interface UseTimerOptions {
  autoStart?: boolean;
  gymName: string;
}

export function useTimer(config: TimerConfig, options: UseTimerOptions) {
  const [state, setState] = useState<EngineState>(() => createInitial(config));
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  const lastElapsedRef = useRef(-1);
  const gymNameRef = useRef(options.gymName);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    gymNameRef.current = options.gymName;
  }, [options.gymName]);

  const publish = useCallback((next: EngineState, wall: number) => {
    stateRef.current = next;
    setState(next);
    setNow(wall);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const wall = Date.now();
      const current = stateRef.current;
      if (current.status !== 'running') return;
      setNow(wall);
      const next = reconcile(current, wall);
      const elapsed = elapsedMs(next, wall);
      if (AppState.currentState === 'active') {
        const cues = cuesBetween(current, lastElapsedRef.current, elapsed);
        if (cues.length > 0) void playCueBatch(cues);
      }
      lastElapsedRef.current = elapsed;
      if (next.status !== current.status) {
        stateRef.current = next;
        setState(next);
        if (next.status === 'finished') void clearScheduledCues();
      }
    }, 80);
    return () => clearInterval(id);
  }, []);

  const startTimer = useCallback(() => {
    const wall = Date.now();
    const next = start(stateRef.current, wall);
    lastElapsedRef.current = 0;
    publish(next, wall);
    if (AppState.currentState === 'active') {
      void playCueBatch(cuesBetween(next, -1, 0));
    }
    void syncScheduledCues(next, wall, gymNameRef.current);
  }, [publish]);

  const pauseTimer = useCallback(() => {
    const wall = Date.now();
    const next = pause(stateRef.current, wall);
    lastElapsedRef.current = elapsedMs(next, wall);
    publish(next, wall);
    void clearScheduledCues();
  }, [publish]);

  const resetTimer = useCallback(() => {
    const next = reset(stateRef.current);
    lastElapsedRef.current = -1;
    publish(next, Date.now());
    void clearScheduledCues();
  }, [publish]);

  const completeTimer = useCallback(() => {
    const wall = Date.now();
    const next = complete(stateRef.current, wall);
    lastElapsedRef.current = elapsedMs(next, wall);
    publish(next, wall);
    void clearScheduledCues();
  }, [publish]);

  const moveClock = useCallback((next: EngineState, wall: number) => {
    lastElapsedRef.current = elapsedMs(next, wall);
    publish(next, wall);
    if (next.status === 'running') void syncScheduledCues(next, wall, gymNameRef.current);
    else void clearScheduledCues();
  }, [publish]);

  const seekTimer = useCallback((seconds: number) => {
    const wall = Date.now();
    moveClock(seekBy(stateRef.current, seconds * 1000, wall), wall);
  }, [moveClock]);

  const stepRoundTimer = useCallback((direction: -1 | 1) => {
    const wall = Date.now();
    moveClock(stepRound(stateRef.current, direction, wall), wall);
  }, [moveClock]);

  const toggle = useCallback(() => {
    if (stateRef.current.status === 'running') pauseTimer();
    else startTimer();
  }, [pauseTimer, startTimer]);

  useEffect(() => {
    if (!options.autoStart) return undefined;
    startTimer();
    return () => {
      void clearScheduledCues();
    };
  }, [options.autoStart, startTimer]);

  const snapshot: TimerSnapshot = project(state, now);
  return {
    snapshot,
    startTimer,
    pauseTimer,
    resetTimer,
    completeTimer,
    toggle,
    seekTimer,
    stepRoundTimer,
    config: state.config,
  };
}
