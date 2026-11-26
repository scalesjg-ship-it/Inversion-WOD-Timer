import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { findNodeHandle, type Pressable } from 'react-native';

/** Native tag `nextFocusUp` accepts. */
export type TvFocusTag = number;

type PressableHost = React.ComponentRef<typeof Pressable>;

interface TvTabFocusApi {
  /** Tag of the open tab. Up from the first content row targets it. */
  upTag: TvFocusTag | null;
  tabTags: (TvFocusTag | null)[];
  selectedTab: number;
  /** Tab that was open before this one. Back from Settings returns here. */
  previousTab: number;
  /**
   * Native tag Down from the open tab should land on.
   * Settings reports its sidebar because that column is left of the Settings tab.
   */
  entryTag: TvFocusTag | null;
  entryTab: number | null;
  bindTab: (index: number, node: PressableHost | null) => void;
  reportSelected: (index: number) => void;
  /** `owner` is the tab index that Down should enter. Null clears it. */
  reportEntry: (owner: number | null, tag: TvFocusTag | null) => void;
  /** Move the remote onto a tab. The tab's focus handler opens that screen. */
  focusTab: (index: number) => boolean;
}

/** `requestTVFocus` exists on TV host components. Phones and tests do not have it. */
export function requestTvFocus(node: unknown): boolean {
  if (!node || typeof node !== 'object' || !('requestTVFocus' in node)) return false;
  const focus = node.requestTVFocus;
  if (typeof focus !== 'function') return false;
  focus.call(node);
  return true;
}

const TvTabFocusContext = createContext<TvTabFocusApi | null>(null);

export function useTvTabFocus(): TvTabFocusApi | null {
  return useContext(TvTabFocusContext);
}

function focusTag(node: PressableHost | null): TvFocusTag | null {
  if (!node) return null;
  try {
    const tag = findNodeHandle(node);
    return typeof tag === 'number' ? tag : null;
  } catch {
    return null;
  }
}

/** Fabric can report the tag a frame after the ref attaches. A second read picks it up. */
function readTag(node: PressableHost | null, apply: (tag: TvFocusTag | null) => void) {
  const tag = focusTag(node);
  apply(tag);
  if (node && tag == null) {
    requestAnimationFrame(() => apply(focusTag(node)));
  }
}

/**
 * Tab buttons and the open screen share one native view, so these tags are
 * destinations the tvOS focus engine can actually move to.
 */
export function TvTabFocusProvider({ children }: { children: ReactNode }) {
  const [tabTags, setTabTags] = useState<(TvFocusTag | null)[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [previousTab, setPreviousTab] = useState(0);
  const [entryTag, setEntryTag] = useState<TvFocusTag | null>(null);
  const [entryTab, setEntryTab] = useState<number | null>(null);
  const selectedRef = useRef(0);
  const hosts = useRef<(PressableHost | null)[]>([]);

  const bindTab = useCallback((index: number, node: PressableHost | null) => {
    hosts.current[index] = node;
    const apply = (tag: TvFocusTag | null) => {
      setTabTags((current) => {
        if (current[index] === tag) return current;
        const next = current.slice();
        while (next.length <= index) next.push(null);
        next[index] = tag;
        return next;
      });
    };
    readTag(node, apply);
  }, []);

  const reportSelected = useCallback((index: number) => {
    if (selectedRef.current !== index) {
      setPreviousTab(selectedRef.current);
      selectedRef.current = index;
    }
    setSelectedTab((current) => (current === index ? current : index));
  }, []);

  const reportEntry = useCallback((owner: number | null, tag: TvFocusTag | null) => {
    const nextOwner = tag == null || owner == null ? null : owner;
    setEntryTag((current) => (current === tag ? current : tag));
    setEntryTab((current) => (current === nextOwner ? current : nextOwner));
  }, []);

  const focusTab = useCallback((index: number) => requestTvFocus(hosts.current[index] ?? null), []);

  const upTag = tabTags[selectedTab] ?? null;
  const api = useMemo<TvTabFocusApi>(
    () => ({
      upTag,
      tabTags,
      selectedTab,
      previousTab,
      entryTag,
      entryTab,
      bindTab,
      reportSelected,
      reportEntry,
      focusTab,
    }),
    [upTag, tabTags, selectedTab, previousTab, entryTag, entryTab, bindTab, reportSelected, reportEntry, focusTab],
  );

  return <TvTabFocusContext.Provider value={api}>{children}</TvTabFocusContext.Provider>;
}
