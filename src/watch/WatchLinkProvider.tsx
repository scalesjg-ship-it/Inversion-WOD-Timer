import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { defaultConfig } from '@/src/timer/presets';
import type { TimerConfig, TimerSnapshot } from '@/src/timer/types';

import { watchLinkEnabled } from './gate';
import { useWatchLink, type WatchTimerBinding } from './useWatchLink';

const IDLE_SNAPSHOT: TimerSnapshot = {
  phase: 'idle',
  round: 0,
  totalRounds: 1,
  displayMs: 0,
  remainingInPhaseMs: 0,
  elapsedInPhaseMs: 0,
  warningActive: false,
  running: false,
  paused: false,
  totalElapsedMs: 0,
  segmentIndex: -1,
};

const IDLE_CONFIG: TimerConfig = defaultConfig('forTime');

type WatchLinkValue = ReturnType<typeof useWatchLink> & {
  enabled: boolean;
  bindTimer: (live: WatchTimerBinding | null) => void;
  publishNow: () => void;
};

const WatchLinkContext = createContext<WatchLinkValue | null>(null);

/**
 * The relay stays mounted for the whole Apple TV session.
 * Pairing lives on Settings, and the timer screen only publishes the clock.
 */
export function WatchLinkProvider({ children }: { children: ReactNode }) {
  const enabled = watchLinkEnabled({ os: Platform.OS, tv: Platform.isTV === true });
  const link = useWatchLink({
    enabled,
    snapshot: IDLE_SNAPSHOT,
    config: IDLE_CONFIG,
    onAction: () => undefined,
  });
  const latest = useRef(link);
  useEffect(() => {
    latest.current = link;
  }, [link]);
  const stable = useMemo(
    () => ({
      bindTimer: (live: WatchTimerBinding | null) => latest.current.bindTimer(live),
      publishNow: () => latest.current.publishNow(),
    }),
    [],
  );

  const value = useMemo<WatchLinkValue>(
    () => ({
      ...link,
      enabled,
      bindTimer: stable.bindTimer,
      publishNow: stable.publishNow,
    }),
    [enabled, link, stable],
  );

  return <WatchLinkContext.Provider value={value}>{children}</WatchLinkContext.Provider>;
}

export function useWatchLinkContext(): WatchLinkValue {
  const value = useContext(WatchLinkContext);
  if (!value) {
    throw new Error('useWatchLinkContext must be used within WatchLinkProvider');
  }
  return value;
}
