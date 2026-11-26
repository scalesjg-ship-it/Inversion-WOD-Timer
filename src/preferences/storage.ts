import AsyncStorage from '@react-native-async-storage/async-storage';

/** Device preferences. Missing fields stay off so an older install is unchanged. */
export interface AppPreferences {
  voiceCountdown: boolean;
}

export const PREFERENCES_STORAGE_KEY = 'americana.preferences.v1';

export const DEFAULT_PREFERENCES: AppPreferences = {
  voiceCountdown: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizePreferences(value: unknown): AppPreferences {
  const raw = isRecord(value) ? value : {};
  return {
    voiceCountdown: raw.voiceCountdown === true,
  };
}

export async function loadPreferences(): Promise<AppPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    return sanitizePreferences(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(preferences: AppPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(sanitizePreferences(preferences)));
}
