import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { findNodeHandle, type Pressable } from 'react-native';

import type { TvFocusTag } from '@/src/components/TvTabFocus';
import { firstFocusTag } from '@/src/tv/setupFocus';

type Host = React.ComponentRef<typeof Pressable>;

interface TvSetupFocusApi {
  /** Down from the last stepper row. */
  down: TvFocusTag | null;
  /** Down from the warning-chip row. */
  bridgeDown: TvFocusTag | null;
  /** Up from Start. The minus button on the last stepper row. */
  lastEntry: TvFocusTag | null;
  /** Up from Save preset. Warning chips when they sit above it, otherwise the stepper row. */
  abovePreset: TvFocusTag | null;
  startTag: TvFocusTag | null;
  bindLast: (tag: TvFocusTag | null) => void;
  bindStart: (node: Host | null) => void;
  bindPreset: (node: Host | null) => void;
  bindBridge: (node: Host | null) => void;
}

const TvSetupFocusContext = createContext<TvSetupFocusApi | null>(null);

export function useTvSetupFocus(): TvSetupFocusApi | null {
  return useContext(TvSetupFocusContext);
}

function readTag(node: Host | null): TvFocusTag | null {
  if (!node) return null;
  try {
    const tag = findNodeHandle(node);
    return typeof tag === 'number' ? tag : null;
  } catch {
    return null;
  }
}

function publishTag(
  node: Host | null,
  setter: (updater: (current: TvFocusTag | null) => TvFocusTag | null) => void,
) {
  const apply = (tag: TvFocusTag | null) => {
    setter((current) => (current === tag ? current : tag));
  };
  const tag = readTag(node);
  apply(tag);
  if (node && tag == null) requestAnimationFrame(() => apply(readTag(node)));
}

/** Shares native focus tags between the last stepper row, the shelf, and Start. */
export function TvSetupFocus({ children }: { children: ReactNode }) {
  const [lastEntry, setLastEntry] = useState<TvFocusTag | null>(null);
  const [startTag, setStartTag] = useState<TvFocusTag | null>(null);
  const [presetTag, setPresetTag] = useState<TvFocusTag | null>(null);
  const [bridgeTag, setBridgeTag] = useState<TvFocusTag | null>(null);

  const bindLast = useCallback((tag: TvFocusTag | null) => {
    setLastEntry((current) => (current === tag ? current : tag));
  }, []);
  const bindStart = useCallback((node: Host | null) => {
    publishTag(node, setStartTag);
  }, []);
  const bindPreset = useCallback((node: Host | null) => {
    publishTag(node, setPresetTag);
  }, []);
  const bindBridge = useCallback((node: Host | null) => {
    publishTag(node, setBridgeTag);
  }, []);

  const api = useMemo<TvSetupFocusApi>(
    () => ({
      down: firstFocusTag([bridgeTag, presetTag, startTag]),
      bridgeDown: firstFocusTag([presetTag, startTag]),
      lastEntry,
      abovePreset: bridgeTag ?? lastEntry,
      startTag,
      bindLast,
      bindStart,
      bindPreset,
      bindBridge,
    }),
    [bindBridge, bindLast, bindPreset, bindStart, bridgeTag, lastEntry, presetTag, startTag],
  );

  return <TvSetupFocusContext.Provider value={api}>{children}</TvSetupFocusContext.Provider>;
}
