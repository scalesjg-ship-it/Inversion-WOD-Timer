import type { Branding } from './types';

export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return `#${value.toUpperCase()}`;
}

export function relativeLuminance(hex: string): number {
  const parsed = normalizeHex(hex);
  if (!parsed) return 1;
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(parsed.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const red = channels[0] ?? 0;
  const green = channels[1] ?? 0;
  const blue = channels[2] ?? 0;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Keep the clock readable when a gym picks a color that disappears on black. */
export function digitColor(hex: string): string {
  return relativeLuminance(hex) < 0.18 ? '#F4F7FB' : normalizeHex(hex) ?? '#F4F7FB';
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

const LIGHT_INK = '#F4F7FB';
const DARK_INK = '#07080A';

/** Large clock type stays at least 3:1 against the gym's background. */
export function readableDigitColor(preferred: string, background: string): string {
  const chosen = normalizeHex(preferred) ?? LIGHT_INK;
  if (contrastRatio(chosen, background) >= 3) return chosen;
  return contrastRatio(LIGHT_INK, background) >= contrastRatio(DARK_INK, background) ? LIGHT_INK : DARK_INK;
}

/**
 * Phase titles keep their accent only when it clears the clock's contrast bar
 * and sits on the same side of the background as the digits. A near-black
 * lead-in on a dark gym color otherwise falls through to the clock ink.
 */
export function phaseLabelInk(accent: string, digitColor: string, background: string): string {
  const digits = readableDigitColor(digitColor, background);
  const preferred = normalizeHex(accent);
  if (!preferred || contrastRatio(preferred, background) < 3) return digits;
  const backgroundLuminance = relativeLuminance(background);
  const accentIsLight = relativeLuminance(preferred) > backgroundLuminance;
  const digitsAreLight = relativeLuminance(digits) > backgroundLuminance;
  if (accentIsLight !== digitsAreLight) return digits;
  return preferred;
}

export function inkOn(color: string): string {
  return contrastRatio(DARK_INK, color) >= contrastRatio(LIGHT_INK, color) ? DARK_INK : LIGHT_INK;
}

export function hsvToHex(hue: number, saturation: number, value: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = Math.min(1, Math.max(0, saturation));
  const v = Math.min(1, Math.max(0, value));
  const chroma = v * s;
  const sector = h / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;
  if (sector < 1) {
    red = chroma;
    green = x;
  } else if (sector < 2) {
    red = x;
    green = chroma;
  } else if (sector < 3) {
    green = chroma;
    blue = x;
  } else if (sector < 4) {
    green = x;
    blue = chroma;
  } else if (sector < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }
  const match = v - chroma;
  const channel = (part: number) => Math.round((part + match) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${channel(red)}${channel(green)}${channel(blue)}`;
}

export function hexToHue(hex: string): number {
  const parsed = normalizeHex(hex);
  if (!parsed) return 0;
  const red = Number.parseInt(parsed.slice(1, 3), 16) / 255;
  const green = Number.parseInt(parsed.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(parsed.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue = 0;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return Math.round(((hue * 60) + 360) % 360);
}

export function screenColors(branding: Branding): { digits: string; ui: string; text: string; muted: string } {
  const light = relativeLuminance(branding.backgroundColor) > 0.45;
  return {
    digits: readableDigitColor(branding.digitColor, branding.backgroundColor),
    ui: readableDigitColor(branding.uiColor, branding.backgroundColor),
    text: light ? '#14120F' : '#F4F7FB',
    muted: light ? '#3E4652' : '#93A0B0',
  };
}
