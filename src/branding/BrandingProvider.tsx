import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { loadBranding, sanitizeBranding, saveBranding } from './storage';
import { DEFAULT_BRANDING, type Branding } from './types';

interface BrandingContextValue {
  branding: Branding;
  ready: boolean;
  update: (patch: Partial<Branding>) => Promise<void>;
  reset: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [ready, setReady] = useState(false);
  const brandingRef = useRef(branding);

  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

  useEffect(() => {
    let cancelled = false;
    void loadBranding().then((loaded) => {
      if (cancelled) return;
      brandingRef.current = loaded;
      setBranding(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: Branding) => {
    const clean = sanitizeBranding(next);
    brandingRef.current = clean;
    setBranding(clean);
    await saveBranding(clean);
  }, []);

  const update = useCallback(
    async (patch: Partial<Branding>) => {
      await persist({ ...brandingRef.current, ...patch });
    },
    [persist],
  );

  const reset = useCallback(async () => {
    await persist(DEFAULT_BRANDING);
  }, [persist]);

  const value = useMemo(
    () => ({ branding, ready, update, reset }),
    [branding, ready, update, reset],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextValue {
  const value = useContext(BrandingContext);
  if (!value) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return value;
}
