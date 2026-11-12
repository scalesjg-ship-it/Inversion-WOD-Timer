import { describe, expect, it } from 'vitest';

import {
  TV_FOCUS_SCALE,
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

  it('scales and highlights on TV without changing border width', () => {
    const idle = focusChrome(true, false, '#FF4D2E');
    const focused = focusChrome(true, true, '#FF4D2E');
    expect(idle).toEqual({ transform: [{ scale: 1 }] });
    expect(focused).not.toHaveProperty('borderWidth');
    expect(focused?.transform).toEqual([{ scale: TV_FOCUS_SCALE }]);
    expect(focused?.borderColor).toBe('#FF4D2E');
    expect(focused?.backgroundColor).toBe('rgba(255,77,46,0.3)');
    expect(TV_FOCUS_SCALE).toBeGreaterThan(1);
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
