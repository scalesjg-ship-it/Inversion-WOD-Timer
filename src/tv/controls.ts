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

/** Phone stepper metrics match the existing iPhone stylesheet. TV sizes scale from 1080p. */
export function stepperControlSize(tv: boolean, screenHeight = 1080): StepperMetrics {
  if (!tv) {
    return { button: 52, glyph: 32, value: 32, suffix: 12, gap: 8, radius: 14, valueMinWidth: 56 };
  }
  const scale = Math.max(0.6, screenHeight / 1080);
  return {
    button: Math.round(120 * scale),
    glyph: Math.round(68 * scale),
    value: Math.round(60 * scale),
    suffix: Math.round(24 * scale),
    gap: Math.round(22 * scale),
    radius: Math.round(28 * scale),
    valueMinWidth: Math.round(108 * scale),
  };
}

/**
 * Phone tab metrics match the existing iPhone tab bar.
 * TV metrics are the 1080p sizes times the window height, so a 4K window doubles them.
 * A 720p TV keeps the shorter bar.
 */
export function tabBarControlSize(tv: boolean, screenHeight = 1080): TabBarMetrics {
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
  if (screenHeight < 1000) {
    const scale = screenHeight / 720;
    return {
      label: Math.round(22 * scale),
      icon: Math.round(26 * scale),
      itemMinHeight: Math.round(68 * scale),
      barContentHeight: Math.round(96 * scale),
      gap: Math.round(10 * scale),
      paddingHorizontal: Math.round(24 * scale),
      paddingTop: Math.round(12 * scale),
      paddingBottom: Math.round(12 * scale),
    };
  }
  const scale = screenHeight / 1080;
  return {
    label: Math.round(48 * scale),
    icon: Math.round(56 * scale),
    itemMinHeight: Math.round(132 * scale),
    barContentHeight: Math.round(176 * scale),
    gap: Math.round(28 * scale),
    paddingHorizontal: Math.round(60 * scale),
    paddingTop: Math.round(18 * scale),
    paddingBottom: Math.round(16 * scale),
  };
}

/** Height of the TV tab bar, including its own padding. */
export function tvTabBarHeight(screenHeight: number, bottomInset = 0): number {
  const tab = tabBarControlSize(true, screenHeight);
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
