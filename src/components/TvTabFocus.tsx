import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { findNodeHandle, type Pressable } from 'react-native';

/** Native tag `nextFocusUp` accepts. */
export type TvFocusTag = number;

type PressableHost = React.ComponentRef<typeof Pressable>;

interface TvTabFocusApi {
  /** Tag of the open tab. Up from the first content row targets it. */
  upTag: TvFocusTag | null;
  /** Tag of the first control on the open screen. Down from the open tab targets it. */
  entryTag: TvFocusTag | null;
  tabTags: (TvFocusTag | null)[];
  selectedTab: number;
  bindTab: (index: number, node: PressableHost | null) => void;
  bindEntry: (tag: TvFocusTag | null) => void;
  reportSelected: (index: number) => void;
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
  const [entryTag, setEntryTag] = useState<TvFocusTag | null>(null);

  const bindTab = useCallback((index: number, node: PressableHost | null) => {
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
    setSelectedTab((current) => (current === index ? current : index));
  }, []);

  const bindEntry = useCallback((tag: TvFocusTag | null) => {
    setEntryTag((current) => (current === tag ? current : tag));
  }, []);

  const upTag = tabTags[selectedTab] ?? null;
  const api = useMemo<TvTabFocusApi>(
    () => ({
      upTag,
      entryTag,
      tabTags,
      selectedTab,
      bindTab,
      bindEntry,
      reportSelected,
    }),
    [upTag, entryTag, tabTags, selectedTab, bindTab, bindEntry, reportSelected],
  );

  return <TvTabFocusContext.Provider value={api}>{children}</TvTabFocusContext.Provider>;
}
