import { describe, expect, it } from 'vitest';

import {
  TV_FOCUS_BORDER,
  TV_FOCUS_RING,
  TV_FOCUS_SCALE,
  TV_UNFOCUSED_OPACITY,
  allowsDeviceHaptics,
  allowsSystemNotifications,
  focusChrome,
  stepperControlSize,
  tabBarControlSize,
} from './controls';

describe('TV focus chrome', () => {
  it('keeps the iPhone focus ring as a thicker border', () => {
    expect(focusChrome(false, false, '#FF4D2E')).toBeNull();
    expect(focusChrome(false, true, '#FF4D2E')).toEqual({ borderWidth: 6, borderColor: '#FF4D2E' });
  });

  it('draws a constant thick ring, scales, glows, and dims idle controls on TV', () => {
    const idle = focusChrome(true, false, '#FF4D2E');
    const focused = focusChrome(true, true, '#FF4D2E');
    expect(idle?.borderWidth).toBe(TV_FOCUS_BORDER);
    expect(focused?.borderWidth).toBe(TV_FOCUS_BORDER);
    expect(idle?.borderWidth).toBe(focused?.borderWidth);
    expect(idle).not.toHaveProperty('borderColor');
    expect(focused?.borderColor).toBe(TV_FOCUS_RING);
    expect(focused?.transform).toEqual([{ scale: TV_FOCUS_SCALE }]);
    expect(idle?.transform).toEqual([{ scale: 1 }]);
    expect(TV_FOCUS_SCALE).toBeGreaterThanOrEqual(1.15);
    expect(TV_FOCUS_SCALE).toBeLessThanOrEqual(1.2);
    expect(focused?.shadowOpacity).toBeGreaterThan(0.5);
    expect(focused?.shadowRadius).toBeGreaterThanOrEqual(12);
    expect(idle?.opacity).toBe(TV_UNFOCUSED_OPACITY);
    expect(focused?.opacity).toBe(1);
    expect(TV_UNFOCUSED_OPACITY).toBeLessThan(0.75);
    expect(focused).not.toHaveProperty('backgroundColor');
  });

  it('keeps a text field at scale 1 so the caret does not jump', () => {
    const idle = focusChrome(true, false, '#F5C518', { scale: false });
    const focused = focusChrome(true, true, '#F5C518', { scale: false });
    expect(idle).not.toHaveProperty('transform');
    expect(focused).not.toHaveProperty('transform');
    expect(focused?.borderWidth).toBe(idle?.borderWidth);
  });
});

describe('TV control sizes', () => {
  it('leaves the iPhone stepper and tab bar measurements alone', () => {
    expect(stepperControlSize(false)).toMatchObject({ button: 52, glyph: 32, value: 32, suffix: 12, gap: 8 });
    expect(tabBarControlSize(false)).toMatchObject({ label: 13, icon: 16, barContentHeight: 64 });
  });

  it('makes TV steppers easy to focus and tab labels 10-foot readable', () => {
    const step = stepperControlSize(true);
    const tab = tabBarControlSize(true);
    expect(step.button).toBeGreaterThanOrEqual(96);
    expect(step.glyph).toBeGreaterThanOrEqual(48);
    expect(tab.label).toBeGreaterThanOrEqual(40);
    expect(tab.icon).toBeGreaterThanOrEqual(40);
    expect(tab.itemMinHeight).toBeGreaterThanOrEqual(120);
    expect(tab.barContentHeight).toBeGreaterThanOrEqual(160);
  });
});

describe('TV platform guards', () => {
  it('never enables haptics on TV, including when the OS string is ios', () => {
    expect(allowsDeviceHaptics(true)).toBe(false);
    expect(allowsDeviceHaptics(false)).toBe(true);
    expect(allowsSystemNotifications(true, 'ios')).toBe(false);
    expect(allowsSystemNotifications(false, 'ios')).toBe(true);
    expect(allowsSystemNotifications(false, 'android')).toBe(true);
    expect(allowsSystemNotifications(false, 'web')).toBe(false);
  });
});
