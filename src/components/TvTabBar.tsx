import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { TvFocusPressable } from '@/src/components/TvFocus';
import { chrome } from '@/src/theme/chrome';
import { tabBarControlSize } from '@/src/tv/controls';

type TvTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export function TvTabBar({ state, descriptors, emitter, navigateToTab, insets }: TvTabBarProps) {
  const { width, height } = useWindowDimensions();
  const metrics = tabBarControlSize(true, height, width);
  const focusedRoute = state.routes[state.index];
  const focusedOptions = focusedRoute ? descriptors[focusedRoute.key]?.options : undefined;
  const active = colorString(focusedOptions?.tabBarActiveTintColor, chrome.text);
  const inactive = colorString(focusedOptions?.tabBarInactiveTintColor, chrome.muted);

  return (
    <View
      accessibilityRole="tablist"
        style={[
        styles.bar,
        {
          gap: metrics.gap,
          paddingHorizontal: metrics.paddingHorizontal,
          paddingTop: metrics.paddingTop,
          paddingBottom: Math.max(insets.bottom, metrics.paddingBottom),
          minHeight: metrics.paddingTop + metrics.barContentHeight + Math.max(insets.bottom, metrics.paddingBottom),
          width: '100%',
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const selected = index === state.index;
        const options = descriptors[route.key]?.options;
        const title = options?.title ?? route.name;
        const label = typeof title === 'string' ? title : route.name;
        const color = selected ? active : inactive;
        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!selected && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <TvFocusPressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            testID={options?.tabBarButtonTestID}
            onPress={onPress}
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
              {label.slice(0, 1).toUpperCase()}
            </Text>
            <Text style={[styles.label, styles.clear, { color, fontSize: metrics.label }]}>{label}</Text>
          </TvFocusPressable>
        );
      })}
    </View>
  );
}

function colorString(color: unknown, fallback: string): string {
  return typeof color === 'string' ? color : fallback;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: chrome.bg,
    borderTopColor: chrome.line,
    borderTopWidth: 2,
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
