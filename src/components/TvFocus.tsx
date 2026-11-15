import { useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  TextInput,
  useWindowDimensions,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { focusChrome, TV_FOCUS_BORDER, TV_FOCUS_RING, type FocusOptions } from '@/src/tv/controls';
import { tvScaled } from '@/src/tv/layout';
import { tvParallaxProps } from '@/src/tv/pressable';
import { usePointerFocus } from '@/src/tv/usePointerFocus';

type FocusStyle = (state: { pressed: boolean; focused: boolean }) => StyleProp<ViewStyle>;

/**
 * Pressable with one TV focus treatment: yellow ring, scale, glow, and dimmed neighbors.
 * On a phone this is a normal pressable plus the existing keyboard focus border.
 */
export function TvFocusPressable({
  accent = TV_FOCUS_RING,
  dim = true,
  scale = true,
  style,
  onFocus,
  onBlur,
  children,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  accent?: string;
  dim?: boolean;
  scale?: boolean;
  style?: StyleProp<ViewStyle> | FocusStyle;
  children?: ReactNode;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const pointer = usePointerFocus();
  const options: FocusOptions = {
    dim,
    scale,
    tint: false,
    borderWidth: tv ? tvScaled(TV_FOCUS_BORDER, width, height) : undefined,
  };
  return (
    <Pressable
      {...rest}
      {...(tv ? tvParallaxProps() : {})}
      onFocus={(event) => {
        pointer.onFocus?.();
        onFocus?.(event);
      }}
      onBlur={(event) => {
        pointer.onBlur?.();
        onBlur?.(event);
      }}
      style={(state) => {
        const focused = Boolean(state.focused) || pointer.focused;
        const base = typeof style === 'function' ? style({ pressed: state.pressed, focused }) : style;
        // Transparent first so a TV theme fill cannot paint a band behind the label.
        // A caller background, such as a card surface, still wins because it comes next.
        return [{ backgroundColor: 'transparent' }, base, focusChrome(tv, focused, tv ? TV_FOCUS_RING : accent, options)];
      }}
    >
      {children}
    </Pressable>
  );
}

/** Text field that takes the same TV ring without scaling the caret. */
export function TvTextField({
  accent = TV_FOCUS_RING,
  style,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { accent?: string }) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      onFocus={(event) => {
        if (tv) setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (tv) setFocused(false);
        onBlur?.(event);
      }}
      style={[
        style,
        focusChrome(tv, focused, accent, {
          scale: false,
          tint: false,
          borderWidth: tv ? tvScaled(TV_FOCUS_BORDER, width, height) : undefined,
        }),
      ]}
    />
  );
}
