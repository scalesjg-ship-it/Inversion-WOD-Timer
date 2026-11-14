import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import type { TvHomeLayout } from '@/src/tv/layout';

/**
 * One menu cell. Padding is the focus gutter, and the focused cell paints above its neighbors.
 */
export function TvMenuCell({
  basis,
  frame,
  onLayout,
  children,
}: {
  basis: string;
  frame: Pick<TvHomeLayout, 'gutterX' | 'gutterTop' | 'gutterBottom'>;
  onLayout?: (event: LayoutChangeEvent) => void;
  children: (events: { onFocus: () => void; onBlur: () => void }) => ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      onLayout={onLayout}
      style={{
        width: basis,
        maxWidth: basis,
        flexGrow: 0,
        flexShrink: 0,
        paddingHorizontal: frame.gutterX,
        paddingTop: frame.gutterTop,
        paddingBottom: frame.gutterBottom,
        zIndex: focused ? 2 : 0,
        elevation: focused ? 12 : 0,
      }}
    >
      {children({
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
      })}
    </View>
  );
}
