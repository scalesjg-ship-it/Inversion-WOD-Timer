import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_PREFERENCES, PREFERENCES_STORAGE_KEY, loadPreferences, sanitizePreferences, savePreferences } from './storage';

vi.mock('@react-native-async-storage/async-storage', () => {
  const memory = new Map<string, string>();
  return {
    default: {
      getItem: async (key: string) => memory.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: async (key: string) => {
        memory.delete(key);
      },
      clear: async () => {
        memory.clear();
      },
    },
  };
});

describe('voice countdown preference', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('stays off when nothing is stored', async () => {
    expect(sanitizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
    expect(sanitizePreferences({ voiceCountdown: 'yes' })).toEqual({ voiceCountdown: false });
    expect(await loadPreferences()).toEqual({ voiceCountdown: false });
  });

  it('saves an explicit on and reads it back', async () => {
    await savePreferences({ voiceCountdown: true });
    expect(await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY)).toContain('"voiceCountdown":true');
    expect(await loadPreferences()).toEqual({ voiceCountdown: true });
    await savePreferences({ voiceCountdown: false });
    expect(await loadPreferences()).toEqual({ voiceCountdown: false });
  });
});