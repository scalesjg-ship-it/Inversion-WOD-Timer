import { Tabs } from 'expo-router';
import { Platform, Text, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { TvTabBar } from '@/src/components/TvTabBar';
import { TvTabFocusProvider } from '@/src/components/TvTabFocus';
import { chrome } from '@/src/theme/chrome';

const TAB_BAR_CONTENT_HEIGHT = 64;

export default function TabLayout() {
  const { branding } = useBranding();
  const tint = readableDigitColor(branding.uiColor, branding.backgroundColor);
  const insets = useSafeAreaInsets();

  const tv = Platform.isTV === true;
  // Android phone draws edge-to-edge. The fixed 64pt bar would sit under the
  // navigation bar. iOS and TV keep the existing bar.
  const androidPhone = Platform.OS === 'android' && !tv;

  const navigator = (
    <Tabs
      {...(tv ? { tabBar: (props) => <TvTabBar {...props} /> } : {})}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: chrome.muted,
        tabBarStyle: {
          backgroundColor: chrome.bg,
          borderTopColor: chrome.line,
          height: androidPhone ? TAB_BAR_CONTENT_HEIGHT + insets.bottom : TAB_BAR_CONTENT_HEIGHT,
          paddingTop: 6,
          ...(androidPhone ? { paddingBottom: insets.bottom } : null),
        },
        tabBarLabelStyle: {
          fontFamily: 'OswaldMedium',
          fontSize: 13,
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
        name="rounds"
        options={{
          title: 'Rounds',
          tabBarButtonTestID: 'tab-rounds',
          tabBarIcon: ({ color }) => <TabMark color={color} label="R" />,
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
    </Tabs>
  );

  // The phone tab bar is the default one. Only the TV bar needs the focus bridge.
  if (!tv) return navigator;
  return <TvTabFocusProvider>{navigator}</TvTabFocusProvider>;
}

function TabMark({ color, label }: { color: TextStyle['color']; label: string }) {
  return <Text style={{ color, fontFamily: 'Oswald', fontSize: 16 }}>{label}</Text>;
}
