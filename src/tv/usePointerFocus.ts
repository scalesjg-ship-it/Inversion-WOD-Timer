import { useState } from 'react';
import { Platform } from 'react-native';

/**
 * Web and phones track focus in React state because Pressable's style callback
 * does not receive `focused` there. On TV that setState runs inside UIKit's
 * focus update and must not happen — the style callback's `focused` flag is enough.
 */
export function usePointerFocus(): {
  focused: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
} {
  const [focused, setFocused] = useState(false);
  if (Platform.isTV === true) return { focused: false };
  return {
    focused,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
