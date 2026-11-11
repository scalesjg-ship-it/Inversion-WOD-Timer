import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeHex } from './color';
import { DEFAULT_BRANDING, type BrandColors, type Branding, type LogoPlacement } from './types';

const KEY = 'americana.branding.v1';

function placement(value: unknown): LogoPlacement {
  if (value === 'watermark' || value === 'fullBleed' || value === 'corner') return value;
  return DEFAULT_BRANDING.logoPlacement;
}

function colorField(value: unknown, fallback: string): string {
  return typeof value === 'string' ? normalizeHex(value) ?? fallback : fallback;
}

export function sanitizeBranding(value: unknown): Branding {
  const raw = value && typeof value === 'object' ? (value as Partial<Branding> & { primaryColor?: string; accentColor?: string }) : {};
  const gymName = typeof raw.gymName === 'string' ? raw.gymName.trim().slice(0, 48) : '';
  const colors: BrandColors = {
    workColor: colorField(raw.workColor ?? raw.primaryColor, DEFAULT_BRANDING.workColor),
    restColor: colorField(raw.restColor ?? raw.accentColor, DEFAULT_BRANDING.restColor),
    leadInColor: colorField(raw.leadInColor, DEFAULT_BRANDING.leadInColor),
    warningColor: colorField(raw.warningColor, DEFAULT_BRANDING.warningColor),
    digitColor: colorField(raw.digitColor, DEFAULT_BRANDING.digitColor),
    backgroundColor: colorField(raw.backgroundColor, DEFAULT_BRANDING.backgroundColor),
    uiColor: colorField(raw.uiColor ?? raw.primaryColor, DEFAULT_BRANDING.uiColor),
  };
  return {
    gymName: gymName || DEFAULT_BRANDING.gymName,
    ...colors,
    logoUri: typeof raw.logoUri === 'string' && raw.logoUri.length > 0 ? raw.logoUri : null,
    logoPlacement: placement(raw.logoPlacement),
    logoBlur: raw.logoBlur !== false,
  };
}

export async function loadBranding(): Promise<Branding> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_BRANDING;
    return sanitizeBranding(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_BRANDING;
  }
}

export async function saveBranding(branding: Branding): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(sanitizeBranding(branding)));
}
