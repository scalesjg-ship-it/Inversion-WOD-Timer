import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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

import { type TvFocusTag } from '@/src/components/TvTabFocus';
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
  focusDown = null,
  focusUp = null,
  focusLeft = null,
  focusRight = null,
  onHost,
  focusable,
  ...rest
}: Omit<PressableProps, 'style' | 'children' | 'focusable'> & {
  accent?: string;
  dim?: boolean;
  scale?: boolean;
  style?: StyleProp<ViewStyle> | FocusStyle;
  children?: ReactNode;
  /** TV only. Native tag focused by Down. */
  focusDown?: TvFocusTag | null;
  /** TV only. Native tag focused by Up. The first row points this at the open tab. */
  focusUp?: TvFocusTag | null;
  /** TV only. Native tag focused by Left. */
  focusLeft?: TvFocusTag | null;
  /** TV only. Native tag focused by Right. */
  focusRight?: TvFocusTag | null;
  /** Fired when the native host mounts. Stable: not called again on render. */
  onHost?: (node: React.ComponentRef<typeof Pressable> | null) => void;
  focusable?: boolean;
}) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const pointer = usePointerFocus();
  const onHostRef = useRef(onHost);
  useEffect(() => {
    onHostRef.current = onHost;
  }, [onHost]);
  const setHost = useCallback((node: React.ComponentRef<typeof Pressable> | null) => {
    onHostRef.current?.(node);
  }, []);
  const options: FocusOptions = {
    dim,
    scale,
    tint: false,
    borderWidth: tv ? tvScaled(TV_FOCUS_BORDER, width, height) : undefined,
  };
  const locked = focusable === false;
  const linked = tv && !locked && (focusDown != null || focusUp != null || focusLeft != null || focusRight != null);
  return (
    <Pressable
      {...rest}
      {...(tv && !locked && focusDown != null ? { nextFocusDown: focusDown } : {})}
      {...(tv && !locked && focusUp != null ? { nextFocusUp: focusUp } : {})}
      {...(tv && !locked && focusLeft != null ? { nextFocusLeft: focusLeft } : {})}
      {...(tv && !locked && focusRight != null ? { nextFocusRight: focusRight } : {})}
      {...(linked || focusable === true ? { focusable: true as const } : {})}
      {...(locked ? { focusable: false as const } : {})}
      {...(tv ? tvParallaxProps() : {})}
      ref={setHost}
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
  focusUp = null,
  ...rest
}: TextInputProps & { accent?: string; focusUp?: TvFocusTag | null }) {
  const tv = Platform.isTV === true;
  const { width, height } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      {...(tv && focusUp != null ? { nextFocusUp: focusUp, focusable: true as const } : {})}
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
