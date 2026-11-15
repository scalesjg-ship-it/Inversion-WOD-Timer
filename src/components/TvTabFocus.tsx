import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { findNodeHandle, Platform, StyleSheet, TVFocusGuideView, type Pressable, type TextInput } from 'react-native';

import { tvBridgeDestination, tvDirectionalProps, tvTabLink } from '@/src/tv/tabFocus';

/** Native tag `nextFocus*` and focus-guide destinations accept. */
export type TvFocusTag = number;

type PressableHost = React.ComponentRef<typeof Pressable>;
type TextHost = React.ComponentRef<typeof TextInput>;
type FocusHost = PressableHost | TextHost;

type GuideHandle = FocusHost & {
  setDestinations?: (destinations: TvFocusTag[]) => void;
};

interface TvTabFocusApi {
  tabTags: (TvFocusTag | null)[];
  selectedTab: number;
  /** Tag of the guide at the bottom of the screen. Down from the last control targets it. */
  downTag: TvFocusTag | null;
  /** Tag of the guide above the tabs. Up from a tab targets it. */
  upTag: TvFocusTag | null;
  bindTab: (index: number, node: PressableHost | null) => void;
  bindDownBridge: (node: FocusHost | null) => void;
  bindUpGuide: (node: GuideHandle | null) => void;
  reportSelected: (index: number) => void;
  /** Remember the content control Up should restore. Must not set React state. */
  rememberContent: (node: FocusHost | null) => void;
}

const TvTabFocusContext = createContext<TvTabFocusApi | null>(null);

export function useTvTabFocus(): TvTabFocusApi | null {
  return useContext(TvTabFocusContext);
}

function focusTag(node: FocusHost | null): TvFocusTag | null {
  if (!node) return null;
  const tag = findNodeHandle(node);
  return typeof tag === 'number' ? tag : null;
}

/** Fabric can report the tag a frame after the ref attaches. A second read picks it up. */
function readTag(node: FocusHost | null, apply: (tag: TvFocusTag | null) => void) {
  const tag = focusTag(node);
  apply(tag);
  if (node && tag == null) {
    requestAnimationFrame(() => apply(focusTag(node)));
  }
}

export function TvTabFocusProvider({ children }: { children: ReactNode }) {
  const [tabTags, setTabTags] = useState<(TvFocusTag | null)[]>([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [downTag, setDownTag] = useState<TvFocusTag | null>(null);
  const [upTag, setUpTag] = useState<TvFocusTag | null>(null);
  const upGuideRef = useRef<GuideHandle | null>(null);
  const contentTag = useRef<TvFocusTag | null>(null);

  const publishContent = useCallback((tag: TvFocusTag | null) => {
    if (tag == null) return;
    upGuideRef.current?.setDestinations?.([tag]);
  }, []);

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

  const bindDownBridge = useCallback((node: FocusHost | null) => {
    readTag(node, (tag) => setDownTag((current) => (current === tag ? current : tag)));
  }, []);

  const bindUpGuide = useCallback((node: GuideHandle | null) => {
    upGuideRef.current = node;
    readTag(node, (tag) => setUpTag((current) => (current === tag ? current : tag)));
    publishContent(contentTag.current);
  }, [publishContent]);

  const reportSelected = useCallback((index: number) => {
    setSelectedTab((current) => (current === index ? current : index));
  }, []);

  const rememberContent = useCallback((node: FocusHost | null) => {
    const tag = focusTag(node);
    if (tag == null) return;
    contentTag.current = tag;
    // onFocus runs inside the tvOS focus update. Defer the native destination write
    // to the next frame so the focus engine is not mutated while it is moving.
    requestAnimationFrame(() => {
      if (contentTag.current === tag) publishContent(tag);
    });
  }, [publishContent]);

  const api = useMemo<TvTabFocusApi>(
    () => ({
      tabTags,
      selectedTab,
      downTag,
      upTag,
      bindTab,
      bindDownBridge,
      bindUpGuide,
      reportSelected,
      rememberContent,
    }),
    [tabTags, selectedTab, downTag, upTag, bindTab, bindDownBridge, bindUpGuide, reportSelected, rememberContent],
  );

  return <TvTabFocusContext.Provider value={api}>{children}</TvTabFocusContext.Provider>;
}

type GuideViewProps = React.ComponentProps<typeof TVFocusGuideView> & {
  guideRef?: (node: GuideHandle | null) => void;
};

/** The generated TVFocusGuideView type omits `ref`, which the runtime still honors. */
function FocusGuide({ guideRef, ...props }: GuideViewProps) {
  const ViewWithRef = TVFocusGuideView as React.ComponentType<
    React.ComponentProps<typeof TVFocusGuideView> & { ref?: (node: GuideHandle | null) => void }
  >;
  return <ViewWithRef {...props} ref={guideRef} />;
}

/**
 * Sits on the bottom edge of a tab screen. Swipe down from the last control enters this
 * guide, and the guide moves focus to the open tab. Phone screens render nothing.
 */
export function TvTabDownBridge() {
  const focus = useTvTabFocus();
  const tv = Platform.isTV === true;
  if (!tv || !focus) return null;
  const destination = tvBridgeDestination(focus.tabTags.length, focus.selectedTab);
  const target = destination === null ? null : focus.tabTags[destination];
  return (
    <FocusGuide
      guideRef={focus.bindDownBridge}
      destinations={target == null ? undefined : [target]}
      collapsable={false}
      testID="tv-tab-down-bridge"
      style={styles.down}
    />
  );
}

/** Top strip of the tab bar. Up from a tab enters it and returns to the last content control. */
export function TvTabUpGuide({ height }: { height: number }) {
  const focus = useTvTabFocus();
  if (!focus) return null;
  return (
    <FocusGuide
      guideRef={focus.bindUpGuide}
      autoFocus
      collapsable={false}
      testID="tv-tab-up-guide"
      style={[styles.up, { height }]}
    />
  );
}

/** `nextFocus*` props for one tab item. Empty on a phone, and until the neighbor tags exist. */
export function tvTabItemProps(
  tv: boolean,
  index: number,
  tabTags: (TvFocusTag | null)[],
  upTag: TvFocusTag | null,
): ReturnType<typeof tvDirectionalProps> {
  if (!tv || tabTags.length === 0) return {};
  const link = tvTabLink(index, tabTags.length);
  return tvDirectionalProps(true, {
    left: tabTags[link.left],
    right: tabTags[link.right],
    down: tabTags[link.down],
    up: upTag,
  });
}

const styles = StyleSheet.create({
  down: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 36,
  },
  up: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
