/** Focus scale used on TV. The same border width is drawn focused and idle so the frame does not resize mid-update. */
export const TV_FOCUS_SCALE = 1.15;

/** Bright ring that stays readable on a dark gym background from across the room. */
export const TV_FOCUS_RING = '#F5C518';

/** Thick enough to read on 720p and 1080p. Kept constant so focus does not change layout. */
export const TV_FOCUS_BORDER = 5;

/** Idle TV controls step back so the focused one is obvious. */
export const TV_UNFOCUSED_OPACITY = 0.62;

export interface FocusChrome {
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;
  transform?: { scale: number }[];
  opacity?: number;
  shadowColor?: string;
  shadowOpacity?: number;
  shadowRadius?: number;
  shadowOffset?: { width: number; height: number };
  elevation?: number;
}

export interface FocusOptions {
  /** Retained for callers. TV focus uses a ring and glow instead of a fill. */
  tint?: boolean;
  /** Dim the control when it is not focused. */
  dim?: boolean;
  /** Scale the control up when focused. Off for text fields. */
  scale?: boolean;
  /**
   * TV ring thickness. Idle and focused must use the same value.
   * Defaults to the 1080p ring; callers pass a window-scaled width at 4K.
   */
  borderWidth?: number;
}

export interface StepperMetrics {
  button: number;
  glyph: number;
  value: number;
  suffix: number;
  gap: number;
  radius: number;
  valueMinWidth: number;
}

export interface TabBarMetrics {
  label: number;
  icon: number;
  itemMinHeight: number;
  barContentHeight: number;
  gap: number;
  paddingHorizontal: number;
  paddingTop: number;
  paddingBottom: number;
}

function readFocusOptions(tintOrOptions: boolean | FocusOptions | undefined): {
  dim: boolean;
  scale: boolean;
  borderWidth?: number;
} {
  if (typeof tintOrOptions === 'object') {
    return {
      dim: tintOrOptions.dim !== false,
      scale: tintOrOptions.scale !== false,
      borderWidth: tintOrOptions.borderWidth,
    };
  }
  return { dim: true, scale: true };
}

/**
 * Phone focus draws a thicker border and otherwise leaves the control alone.
 * TV focus keeps `borderWidth` constant and changes color, scale, opacity, and glow.
 * Changing border width during a tvOS focus update resizes the frame and quits the app.
 */
export function focusChrome(
  tv: boolean,
  focused: boolean,
  color: string,
  tintOrOptions: boolean | FocusOptions = true,
): FocusChrome | null {
  const options = readFocusOptions(tintOrOptions);
  if (!tv) {
    if (!focused) return null;
    return { borderWidth: 6, borderColor: color };
  }
  const borderWidth = options.borderWidth ?? TV_FOCUS_BORDER;
  const chrome: FocusChrome = {
    borderWidth,
    shadowOffset: { width: 0, height: 0 },
  };
  if (options.scale) chrome.transform = [{ scale: focused ? TV_FOCUS_SCALE : 1 }];
  if (options.dim) chrome.opacity = focused ? 1 : TV_UNFOCUSED_OPACITY;
  if (!focused) {
    chrome.shadowOpacity = 0;
    chrome.elevation = 0;
    return chrome;
  }
  chrome.borderColor = TV_FOCUS_RING;
  chrome.shadowColor = TV_FOCUS_RING;
  chrome.shadowOpacity = 0.9;
  chrome.shadowRadius = Math.round(16 * (borderWidth / TV_FOCUS_BORDER));
  chrome.elevation = 12;
  return chrome;
}

export function tintHex(color: string, alpha: number): string {
  const hex = color.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return `rgba(244,247,251,${alpha})`;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}

/** Phone stepper metrics match the existing iPhone stylesheet. TV sizes scale from 1080p. Compact rows fit a whole setup on one screen. */
export function stepperControlSize(tv: boolean, screenHeight = 1080, compact = false): StepperMetrics {
  if (!tv) {
    return { button: 52, glyph: 32, value: 32, suffix: 12, gap: 8, radius: 14, valueMinWidth: 56 };
  }
  const scale = Math.max(0.6, screenHeight / 1080);
  const buttonBasis = compact ? 56 : 96;
  const glyphBasis = compact ? 36 : 68;
  const valueBasis = compact ? 32 : 60;
  const suffixBasis = compact ? 14 : 24;
  const gapBasis = compact ? 8 : 22;
  const radiusBasis = compact ? 14 : 28;
  const valueWidthBasis = compact ? 48 : 108;
  return {
    button: Math.round(buttonBasis * scale),
    glyph: Math.round(glyphBasis * scale),
    value: Math.round(valueBasis * scale),
    suffix: Math.round(suffixBasis * scale),
    gap: Math.round(gapBasis * scale),
    radius: Math.round(radiusBasis * scale),
    valueMinWidth: Math.round(valueWidthBasis * scale),
  };
}

/**
 * Phone tab metrics match the existing iPhone tab bar.
 * TV metrics scale from 1080p with the window height, and the side inset is 5% of the width
 * so a 960-wide Fire TV window still clears overscan. A 4K window doubles the type.
 */
export function tabBarControlSize(tv: boolean, screenHeight = 1080, screenWidth = 0): TabBarMetrics {
  if (!tv) {
    return {
      label: 13,
      icon: 16,
      itemMinHeight: 49,
      barContentHeight: 64,
      gap: 0,
      paddingHorizontal: 0,
      paddingTop: 6,
      paddingBottom: 0,
    };
  }
  const height = screenHeight > 0 ? screenHeight : 1080;
  const width = screenWidth > 0 ? screenWidth : Math.round(height * (16 / 9));
  const scale = height / 1080;
  const paddingHorizontal = Math.max(Math.round(width * 0.05), Math.round(60 * (width / 1920)));
  return {
    label: Math.max(16, Math.round(40 * scale)),
    icon: Math.max(18, Math.round(44 * scale)),
    itemMinHeight: Math.max(48, Math.round(104 * scale)),
    barContentHeight: Math.max(64, Math.round(132 * scale)),
    gap: Math.max(8, Math.round(16 * scale)),
    paddingHorizontal,
    paddingTop: Math.max(6, Math.round(12 * scale)),
    paddingBottom: Math.max(6, Math.round(10 * scale)),
  };
}

/** Height of the TV tab bar, including its own padding. */
export function tvTabBarHeight(screenHeight: number, bottomInset = 0, screenWidth = 0): number {
  const tab = tabBarControlSize(true, screenHeight, screenWidth);
  return tab.paddingTop + tab.barContentHeight + Math.max(bottomInset, tab.paddingBottom);
}

/** Apple TV and Android TV have no Taptic Engine or vibration motor for this app. */
export function allowsDeviceHaptics(tv: boolean): boolean {
  return !tv;
}

/**
 * `Platform.OS` is `ios` on Apple TV, so an iOS check is not a TV check.
 * Notifications are not part of the Expo TV surface.
 */
export function allowsSystemNotifications(tv: boolean, os: string): boolean {
  return !tv && os !== 'web';
}
