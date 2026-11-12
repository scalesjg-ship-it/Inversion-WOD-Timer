import { Platform } from 'react-native';

/** The system parallax effect fights a JS scale. TV draws its own focus scale instead. */
export function tvParallaxProps(): { tvParallaxProperties?: { enabled: false } } {
  if (Platform.isTV !== true) return {};
  return { tvParallaxProperties: { enabled: false } };
}
