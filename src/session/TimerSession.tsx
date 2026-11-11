import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { defaultConfig } from '@/src/timer/presets';
import type { TimerConfig } from '@/src/timer/types';

export interface TimerSession {
  config: TimerConfig;
  label: string;
}

interface TimerSessionContextValue {
  session: TimerSession;
  setSession: (session: TimerSession) => void;
}

const TimerSessionContext = createContext<TimerSessionContextValue | null>(null);

const INITIAL_SESSION: TimerSession = {
  config: defaultConfig('amrap'),
  label: 'AMRAP',
};

export function TimerSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<TimerSession>(INITIAL_SESSION);
  const value = useMemo(() => ({ session, setSession }), [session]);
  return <TimerSessionContext.Provider value={value}>{children}</TimerSessionContext.Provider>;
}

export function useTimerSession(): TimerSessionContextValue {
  const value = useContext(TimerSessionContext);
  if (!value) {
    throw new Error('useTimerSession must be used within TimerSessionProvider');
  }
  return value;
}
