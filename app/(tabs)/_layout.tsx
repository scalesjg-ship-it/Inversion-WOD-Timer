import { Tabs } from 'expo-router';
import { Text, type TextStyle } from 'react-native';

import { useBranding } from '@/src/branding/BrandingProvider';
import { readableDigitColor } from '@/src/branding/color';
import { chrome } from '@/src/theme/chrome';

export default function TabLayout() {
  const { branding } = useBranding();
  const tint = readableDigitColor(branding.uiColor, branding.backgroundColor);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: chrome.muted,
        tabBarStyle: {
          backgroundColor: chrome.bg,
          borderTopColor: chrome.line,
          height: 64,
          paddingTop: 6,
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
}

function TabMark({ color, label }: { color: TextStyle['color']; label: string }) {
  return <Text style={{ color, fontFamily: 'Oswald', fontSize: 16 }}>{label}</Text>;
}
