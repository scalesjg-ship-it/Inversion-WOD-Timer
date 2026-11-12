/** Focus scale used on TV. Layout props stay constant so the focus engine is not asked to move mid-update. */
export const TV_FOCUS_SCALE = 1.08;

export interface FocusChrome {
  borderWidth?: number;
  borderColor?: string;
  backgroundColor?: string;
  transform?: { scale: number }[];
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
}

/**
 * Phone focus draws a thicker border. TV focus only scales and tints.
 * `borderWidth` is omitted on TV so the focused view's frame does not change
 * while UIKit is still applying the focus update.
 */
export function focusChrome(tv: boolean, focused: boolean, color: string, tint = true): FocusChrome | null {
  if (!tv) {
    if (!focused) return null;
    return { borderWidth: 6, borderColor: color };
  }
  if (!focused) return { transform: [{ scale: 1 }] };
  const chrome: FocusChrome = {
    borderColor: color,
    transform: [{ scale: TV_FOCUS_SCALE }],
  };
  if (tint) chrome.backgroundColor = tintHex(color, 0.3);
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

/** Phone stepper metrics match the existing iPhone stylesheet. */
export function stepperControlSize(tv: boolean): StepperMetrics {
  if (!tv) {
    return { button: 52, glyph: 32, value: 32, suffix: 12, gap: 8, radius: 14, valueMinWidth: 56 };
  }
  return { button: 112, glyph: 64, value: 48, suffix: 22, gap: 18, radius: 28, valueMinWidth: 96 };
}

/** Phone tab metrics match the existing iPhone tab bar. TV labels are 10-foot size. */
export function tabBarControlSize(tv: boolean): TabBarMetrics {
  if (!tv) {
    return { label: 13, icon: 16, itemMinHeight: 49, barContentHeight: 64, gap: 0, paddingHorizontal: 0 };
  }
  return { label: 40, icon: 52, itemMinHeight: 148, barContentHeight: 196, gap: 28, paddingHorizontal: 36 };
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
