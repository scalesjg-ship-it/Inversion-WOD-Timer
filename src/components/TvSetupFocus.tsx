import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { findNodeHandle, Platform, TVFocusGuideView, type Pressable } from 'react-native';

import type { TvFocusTag } from '@/src/components/TvTabFocus';

type Host = React.ComponentRef<typeof Pressable>;

interface TvSetupFocusApi {
  /** Down from the last stepper row. Always Start. */
  down: TvFocusTag | null;
  /** Down from a row that sits under the steppers. */
  bridgeDown: TvFocusTag | null;
  /** Up from Start. The minus button on the last stepper row. */
  lastEntry: TvFocusTag | null;
  /** Up from Save preset. The last stepper row. */
  abovePreset: TvFocusTag | null;
  startTag: TvFocusTag | null;
  startHost: Host | null;
  exitHosts: Host[];
  bindLast: (tag: TvFocusTag | null) => void;
  bindStart: (node: Host | null) => void;
  bindPreset: (node: Host | null) => void;
  bindBridge: (node: Host | null) => void;
  setExitHosts: (hosts: (Host | null)[]) => void;
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

function sameHosts(left: Host[], right: (Host | null)[]): boolean {
  const next = right.filter((host): host is Host => host != null);
  if (left.length !== next.length) return false;
  return left.every((host, index) => host === next[index]);
}

/** Shares native focus targets between the last stepper row and Start. */
export function TvSetupFocus({ children }: { children: ReactNode }) {
  const [lastEntry, setLastEntry] = useState<TvFocusTag | null>(null);
  const [startTag, setStartTag] = useState<TvFocusTag | null>(null);
  const [startHost, setStartHost] = useState<Host | null>(null);
  const [presetTag, setPresetTag] = useState<TvFocusTag | null>(null);
  const [exitHosts, setExitHostsState] = useState<Host[]>([]);

  const bindLast = useCallback((tag: TvFocusTag | null) => {
    setLastEntry((current) => (current === tag ? current : tag));
  }, []);
  const bindStart = useCallback((node: Host | null) => {
    setStartHost(node);
    publishTag(node, setStartTag);
  }, []);
  const bindPreset = useCallback((node: Host | null) => {
    publishTag(node, setPresetTag);
  }, []);
  const bindBridge = useCallback((node: Host | null) => {
    void node;
  }, []);
  const setExitHosts = useCallback((hosts: (Host | null)[]) => {
    setExitHostsState((current) => (sameHosts(current, hosts) ? current : hosts.filter((host): host is Host => host != null)));
  }, []);

  const api = useMemo<TvSetupFocusApi>(
    () => ({
      down: startTag,
      bridgeDown: startTag,
      lastEntry,
      abovePreset: lastEntry ?? presetTag,
      startTag,
      startHost,
      exitHosts,
      bindLast,
      bindStart,
      bindPreset,
      bindBridge,
      setExitHosts,
    }),
    [bindBridge, bindLast, bindPreset, bindStart, exitHosts, lastEntry, presetTag, setExitHosts, startHost, startTag],
  );

  return <TvSetupFocusContext.Provider value={api}>{children}</TvSetupFocusContext.Provider>;
}

const guideStyle = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  height: 12,
};

const EMPTY_HOSTS: Host[] = [];

/** Sits just under the last stepper row. Down from any button in that row lands on Start. */
export function TvDownToStart() {
  const setup = useTvSetupFocus();
  const destination = setup?.startHost ?? null;
  const destinations = useMemo(() => (destination ? [destination] : EMPTY_HOSTS), [destination]);
  if (Platform.isTV !== true || TVFocusGuideView == null || destination == null) return null;
  return (
    <TVFocusGuideView
      destinations={destinations}
      pointerEvents="none"
      style={[guideStyle, { bottom: -12 }]}
    />
  );
}

/** Sits just above Start. Up from Start returns to the last stepper row. */
export function TvUpToRow() {
  const setup = useTvSetupFocus();
  const destinations = setup?.exitHosts ?? EMPTY_HOSTS;
  if (Platform.isTV !== true || TVFocusGuideView == null || destinations.length === 0) return null;
  return (
    <TVFocusGuideView
      destinations={destinations}
      pointerEvents="none"
      style={[guideStyle, { top: -12 }]}
    />
  );
}
