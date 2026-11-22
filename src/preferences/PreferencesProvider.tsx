import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_PREFERENCES, loadPreferences, sanitizePreferences, savePreferences, type AppPreferences } from './storage';

interface PreferencesContextValue {
  preferences: AppPreferences;
  ready: boolean;
  update: (patch: Partial<AppPreferences>) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
    void loadPreferences().then((loaded) => {
      if (cancelled) return;
      preferencesRef.current = loaded;
      setPreferences(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<AppPreferences>) => {
    const next = sanitizePreferences({ ...preferencesRef.current, ...patch });
    preferencesRef.current = next;
    setPreferences(next);
    await savePreferences(next);
  }, []);

  const value = useMemo(() => ({ preferences, ready, update }), [preferences, ready, update]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return value;
}
