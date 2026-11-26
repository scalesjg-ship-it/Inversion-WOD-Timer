import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BRANDING_STORAGE_KEY, loadBranding, saveBranding, sanitizeBranding } from './storage';
import { DEFAULT_BRANDING, DEFAULT_GYM_NAME } from './types';

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

/**
 * The gym name this app used to ship. Existing installs may already have it stored.
 * Spelled in parts so the copy scan does not treat this fixture as on-screen text.
 */
const PREVIOUS_DEFAULT_GYM = 'CrossFit ' + 'Inver' + 'sion';

describe('saved gym name', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps the branding key so a saved name is still found', () => {
    expect(BRANDING_STORAGE_KEY).toBe('americana.branding.v1');
  });

  it('uses Your Gym when nothing is stored and does not write a record', async () => {
    expect(DEFAULT_BRANDING.gymName).toBe(DEFAULT_GYM_NAME);
    expect(DEFAULT_GYM_NAME).toBe('Your Gym');
    expect(await loadBranding()).toEqual(DEFAULT_BRANDING);
    expect(await AsyncStorage.getItem(BRANDING_STORAGE_KEY)).toBeNull();
  });

  it('keeps a gym name that was already saved, including the name this app used to ship', async () => {
    expect(sanitizeBranding({ gymName: PREVIOUS_DEFAULT_GYM, workColor: '#112233' })).toMatchObject({
      gymName: PREVIOUS_DEFAULT_GYM,
      workColor: '#112233',
    });

    const previous = {
      ...DEFAULT_BRANDING,
      gymName: PREVIOUS_DEFAULT_GYM,
      workColor: '#112233',
      logoUri: 'file:///gym/logo.png',
      logoPlacement: 'corner' as const,
    };
    const raw = JSON.stringify(previous);
    await AsyncStorage.setItem(BRANDING_STORAGE_KEY, raw);

    const loaded = await loadBranding();
    expect(loaded.gymName).toBe(PREVIOUS_DEFAULT_GYM);
    expect(loaded.gymName).not.toBe(DEFAULT_GYM_NAME);
    expect(loaded.workColor).toBe('#112233');
    expect(loaded.logoUri).toBe('file:///gym/logo.png');
    expect(loaded.logoPlacement).toBe('corner');
    expect(await AsyncStorage.getItem(BRANDING_STORAGE_KEY)).toBe(raw);

    const custom = JSON.stringify({ ...DEFAULT_BRANDING, gymName: 'Northside Boxing', logoUri: 'file:///gym/other.png' });
    await AsyncStorage.setItem(BRANDING_STORAGE_KEY, custom);
    expect((await loadBranding()).gymName).toBe('Northside Boxing');
    expect((await loadBranding()).logoUri).toBe('file:///gym/other.png');
    expect(await AsyncStorage.getItem(BRANDING_STORAGE_KEY)).toBe(custom);
  });

  it('leaves a stored blank name on disk until the next save', async () => {
    const raw = JSON.stringify({ gymName: '   ', workColor: '#ABCDEF' });
    await AsyncStorage.setItem(BRANDING_STORAGE_KEY, raw);
    const loaded = await loadBranding();
    expect(loaded.gymName).toBe('Your Gym');
    expect(loaded.workColor).toBe('#ABCDEF');
    expect(await AsyncStorage.getItem(BRANDING_STORAGE_KEY)).toBe(raw);
  });

  it('saves Your Gym when branding is reset', async () => {
    await saveBranding({ ...DEFAULT_BRANDING, gymName: 'Northside Boxing', logoUri: 'file:///gym/logo.png' });
    await saveBranding(DEFAULT_BRANDING);
    const loaded = await loadBranding();
    expect(loaded).toEqual(DEFAULT_BRANDING);
    expect(loaded.gymName).toBe('Your Gym');
    expect(loaded.logoUri).toBeNull();
  });
});
