import { Slot, Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { TvTabBar } from '@/src/components/TvTabBar';
import { TvTabFocusProvider } from '@/src/components/TvTabFocus';
import { chrome } from '@/src/theme/chrome';
import { phoneTabBarFrame } from '@/src/tv/controls';

export default function TabLayout() {
  const { branding } = useBranding();
  const tint = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const insets = useSafeAreaInsets();
  const tv = Platform.isTV === true;

  if (tv) {
    return (
      <TvTabFocusProvider>
        <View style={styles.tv} collapsable={false}>
          <TvTabBar />
          <View style={styles.tvScreen} collapsable={false}>
            <Slot />
          </View>
        </View>
      </TvTabFocusProvider>
    );
  }

  // A numeric tab bar height replaces the navigator default, which is the
  // only height that already includes the bottom inset. Add the inset on
  // iPhone and Android so the letter and label stay in the 64pt band above
  // the home indicator or system navigation bar. Inset 0 keeps that band.
  // The tab scenes are laid out above the bar, so scroll content is not
  // covered and does not need a second copy of this height.
  const tabBar = phoneTabBarFrame(insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: chrome.muted,
        tabBarStyle: {
          backgroundColor: chrome.bg,
          borderTopColor: chrome.line,
          height: tabBar.height,
          paddingTop: tabBar.paddingTop,
          paddingBottom: tabBar.paddingBottom,
        },
        tabBarItemStyle: {
          justifyContent: 'center',
        },
        tabBarLabelStyle: {
          fontFamily: 'OswaldMedium',
          fontSize: 13,
          lineHeight: 18,
          letterSpacing: 0.6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'WOD',
          tabBarButtonTestID: 'tab-wod',
          tabBarIcon: ({ color }) => <TabMark color={color} label="W" />,
        }}
      />
      <Tabs.Screen
        name="brand"
        options={{
          title: 'Brand',
          tabBarButtonTestID: 'tab-brand',
          tabBarIcon: ({ color }) => <TabMark color={color} label="B" />,
        }}
      />
      <Tabs.Screen
        name="help"
        options={{
          title: 'Help',
          tabBarButtonTestID: 'tab-help',
          tabBarIcon: ({ color }) => <TabMark color={color} label="H" />,
        }}
      />
    </Tabs>
  );
}

function TabMark({ color, label }: { color: TextStyle['color']; label: string }) {
  return <Text style={{ color, fontFamily: 'Oswald', fontSize: 16, lineHeight: 20 }}>{label}</Text>;
}

const styles = StyleSheet.create({
  tv: { flex: 1, backgroundColor: chrome.bg },
  tvScreen: { flex: 1 },
});
