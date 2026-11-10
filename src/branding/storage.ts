import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeHex } from './color';
import { DEFAULT_BRANDING, type Branding, type LogoPlacement } from './types';

const KEY = 'americana.branding.v1';

function placement(value: unknown): LogoPlacement {
  if (value === 'watermark' || value === 'fullBleed' || value === 'corner') return value;
  return DEFAULT_BRANDING.logoPlacement;
}

export function sanitizeBranding(value: unknown): Branding {
  const raw = value && typeof value === 'object' ? (value as Partial<Branding>) : {};
  const primary = typeof raw.primaryColor === 'string' ? normalizeHex(raw.primaryColor) : null;
  const accent = typeof raw.accentColor === 'string' ? normalizeHex(raw.accentColor) : null;
  const gymName = typeof raw.gymName === 'string' ? raw.gymName.trim().slice(0, 48) : '';
  return {
    gymName: gymName || DEFAULT_BRANDING.gymName,
    primaryColor: primary ?? DEFAULT_BRANDING.primaryColor,
    accentColor: accent ?? DEFAULT_BRANDING.accentColor,
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
