import { router, usePathname, type Href } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, TVFocusGuideView, useWindowDimensions, View } from 'react-native';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { TvFocusPressable } from '@/src/components/TvFocus';
import { useTvTabFocus } from '@/src/components/TvTabFocus';
import { chrome } from '@/src/theme/chrome';
import { tabBarControlSize } from '@/src/tv/controls';
import { TV_TAB_ROUTES, tvDirectionalProps, tvTabIndex, tvTabLink } from '@/src/tv/tabFocus';

const TABS: { href: Href; title: string; testID: string }[] = TV_TAB_ROUTES.map((tab) => ({
  href: tab.path as Href,
  title: tab.title,
  testID: tab.testID,
}));

/** react-native-web has no focus guide. Television builds export the real one. */
const TabGuide = TVFocusGuideView ?? View;

/**
 * Top tab bar for television. It is a sibling of the screen inside one view,
 * so the focus engine can move between them. Left and Right stay on the bar.
 * Down leaves it. Focusing a tab opens that screen.
 */
export function TvTabBar() {
  const pathname = usePathname();
  const selected = tvTabIndex(pathname);
  const { width, height } = useWindowDimensions();
  const metrics = tabBarControlSize(true, height, width);
  const { branding } = useBranding();
  const tint = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const tabFocus = useTvTabFocus();
  useEffect(() => {
    tabFocus?.reportSelected(selected);
  }, [selected, tabFocus]);

  const open = (index: number) => {
    if (index === selected) return;
    router.navigate(TABS[index].href);
  };

  return (
    <TabGuide
      trapFocusUp
      trapFocusLeft
      trapFocusRight
      collapsable={false}
      testID="tv-tab-bar"
      style={[
        styles.bar,
        {
          gap: metrics.gap,
          paddingHorizontal: metrics.paddingHorizontal,
          paddingTop: metrics.paddingTop,
          paddingBottom: metrics.paddingBottom,
          minHeight: metrics.paddingTop + metrics.barContentHeight + metrics.paddingBottom,
          width: '100%',
        },
      ]}
    >
      {TABS.map((tab, index) => {
        const active = index === selected;
        const color = active ? tint : chrome.muted;
        const link = tvTabLink(index, TABS.length);
        const tags = tabFocus?.tabTags ?? [];
        // Down is explicit only for the screen that registered an entry.
        // The settings sidebar is on the left, under WOD, so a geometric Down
        // from Settings would land in the option pane.
        const entryDown =
          index === selected && tabFocus?.entryTab === index ? tabFocus.entryTag : null;
        const links = tvDirectionalProps(true, {
          left: tags[link.left],
          right: tags[link.right],
          up: tags[link.up],
          down: entryDown,
        });
        return (
          <TvFocusPressable
            key={tab.testID}
            onHost={(node) => tabFocus?.bindTab(index, node)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.title}
            testID={tab.testID}
            focusable
            nextFocusLeft={links.nextFocusLeft}
            nextFocusRight={links.nextFocusRight}
            nextFocusUp={links.nextFocusUp}
            nextFocusDown={links.nextFocusDown}
            onFocus={() => open(index)}
            onPress={() => open(index)}
            style={({ pressed }) => [
              styles.item,
              {
                minHeight: metrics.itemMinHeight,
                opacity: pressed ? 0.82 : 1,
                borderColor: 'transparent',
                backgroundColor: 'transparent',
              },
            ]}
          >
            <Text style={[styles.icon, styles.clear, { color, fontSize: metrics.icon, lineHeight: metrics.icon + 4 }]}>
              {tab.title.slice(0, 1)}
            </Text>
            <Text style={[styles.label, styles.clear, { color, fontSize: metrics.label }]}>{tab.title}</Text>
          </TvFocusPressable>
        );
      })}
    </TabGuide>
  );
}

/** The bar's height, so a preview can reserve the same band the shell does. */
export function tvTabBarBand(width: number, height: number): number {
  const metrics = tabBarControlSize(true, height, width);
  return metrics.paddingTop + metrics.barContentHeight + metrics.paddingBottom;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: chrome.bg,
    borderBottomColor: chrome.line,
    borderBottomWidth: 2,
  },
  item: {
    flex: 1,
    minWidth: 0,
    borderRadius: 24,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: 'transparent',
  },
  icon: {
    fontFamily: 'Oswald',
  },
  label: {
    fontFamily: 'OswaldMedium',
    letterSpacing: 1,
  },
  clear: {
    backgroundColor: 'transparent',
  },
});
