import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { normalizeConfig } from './engine';
import {
  deletePreset,
  listPresets,
  loadPresets,
  renamePreset,
  savePreset,
  updatePreset,
} from './presetStorage';
import {
  PRESET_DOCUMENT_VERSION,
  PRESET_STORAGE_KEY,
  nextPresetName,
  presetSummary,
  readStoredPresets,
  suggestPresetName,
  type SavedPreset,
} from './presetStore';
import type { TimerConfig, TimerMode } from './types';

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

function config(mode: TimerMode, patch: Partial<TimerConfig> = {}): TimerConfig {
  return normalizeConfig({
    mode,
    leadInSeconds: 10,
    workSeconds: mode === 'forTime' ? 0 : 60,
    restSeconds: 0,
    rounds: 1,
    warningSeconds: 0,
    ...patch,
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('preset store', () => {
  it('saves a preset and lists it only for that mode', async () => {
    const amrap = await savePreset({ name: 'AMRAP 12:00', config: config('amrap', { workSeconds: 12 * 60 }), now: 10 });
    const emom = await savePreset({
      name: 'EMOM 10',
      config: config('emom', { workSeconds: 60, rounds: 10 }),
      now: 20,
    });
    expect(amrap.ok).toBe(true);
    expect(emom.ok).toBe(true);

    const amraps = await listPresets('amrap');
    expect(amraps.map((preset) => preset.name)).toEqual(['AMRAP 12:00']);
    expect(amraps[0]?.mode).toBe('amrap');
    expect(amraps[0]?.config.workSeconds).toBe(12 * 60);

    const emoms = await listPresets('emom');
    expect(emoms.map((preset) => preset.name)).toEqual(['EMOM 10']);
    expect(await listPresets('tabata')).toEqual([]);
  });

  it('lists newest presets first', async () => {
    await savePreset({ name: 'Older', config: config('intervals', { workSeconds: 40, restSeconds: 20, rounds: 8 }), now: 1 });
    await savePreset({ name: 'Newer', config: config('intervals', { workSeconds: 30, restSeconds: 15, rounds: 6 }), now: 2 });
    expect((await listPresets('intervals')).map((preset) => preset.name)).toEqual(['Newer', 'Older']);
  });

  it('renames a preset and rejects an empty or taken name', async () => {
    const saved = await savePreset({ name: 'Boxing rounds', config: config('rounds', { workSeconds: 180, restSeconds: 60, rounds: 3, warningSeconds: 10 }), now: 5 });
    if (!saved.ok) throw new Error('expected save');
    await savePreset({ name: 'Sparring', config: config('rounds', { workSeconds: 300, restSeconds: 60, rounds: 5 }), now: 6 });

    expect(await renamePreset(saved.preset.id, '   ', 7)).toEqual({ ok: false, reason: 'empty-name' });
    expect(await renamePreset(saved.preset.id, 'sparring', 7)).toEqual({ ok: false, reason: 'name-taken' });
    expect(await renamePreset('missing', 'Other', 7)).toEqual({ ok: false, reason: 'missing' });

    const renamed = await renamePreset(saved.preset.id, 'Gym boxing', 8);
    expect(renamed).toMatchObject({ ok: true, preset: { name: 'Gym boxing', updatedAt: 8 } });
    expect((await listPresets('rounds')).map((preset) => preset.name)).toEqual(['Gym boxing', 'Sparring']);
  });

  it('allows the same name in a different mode', async () => {
    await savePreset({ name: 'Morning', config: config('amrap', { workSeconds: 12 * 60 }), now: 1 });
    const countdown = await savePreset({
      name: 'Morning',
      config: config('countdown', { workSeconds: 300, warningMarksSeconds: [60, 10] }),
      now: 2,
    });
    expect(countdown.ok).toBe(true);
    expect(await listPresets('countdown')).toHaveLength(1);
    expect(await listPresets('amrap')).toHaveLength(1);
  });

  it('updates a preset in place and can overwrite the same name', async () => {
    const saved = await savePreset({ name: 'Tabata', config: config('tabata', { workSeconds: 20, restSeconds: 10, rounds: 8 }), now: 3 });
    if (!saved.ok) throw new Error('expected save');

    const blocked = await savePreset({
      name: 'tabata',
      config: config('tabata', { workSeconds: 30, restSeconds: 15, rounds: 6 }),
      now: 4,
    });
    expect(blocked).toEqual({ ok: false, reason: 'name-taken' });
    expect((await listPresets('tabata'))[0]?.config.workSeconds).toBe(20);

    const overwritten = await savePreset({
      name: 'Tabata',
      config: config('tabata', { workSeconds: 30, restSeconds: 15, rounds: 6 }),
      overwrite: true,
      now: 5,
    });
    expect(overwritten).toMatchObject({
      ok: true,
      preset: { id: saved.preset.id, name: 'Tabata', updatedAt: 5, config: { workSeconds: 30, rounds: 6 } },
    });

    const updated = await updatePreset(saved.preset.id, config('tabata', { workSeconds: 40, restSeconds: 20, rounds: 4, leadInSeconds: 5 }), 6);
    expect(updated).toMatchObject({
      ok: true,
      preset: { name: 'Tabata', config: { workSeconds: 40, restSeconds: 20, rounds: 4, leadInSeconds: 5, mode: 'tabata' } },
    });
    expect(await updatePreset('missing', config('tabata'), 7)).toEqual({ ok: false, reason: 'missing' });
    expect(await listPresets('tabata')).toHaveLength(1);
  });

  it('deletes a preset without removing other modes', async () => {
    const countdown = await savePreset({ name: 'Warmup', config: config('countdown', { workSeconds: 180 }), now: 1 });
    const rounds = await savePreset({ name: 'BJJ extra', config: config('rounds', { workSeconds: 360, restSeconds: 60, rounds: 6, warningSeconds: 30 }), now: 2 });
    if (!countdown.ok || !rounds.ok) throw new Error('expected saves');

    await deletePreset(countdown.preset.id);
    await deletePreset(countdown.preset.id);
    expect(await listPresets('countdown')).toEqual([]);
    expect((await listPresets('rounds')).map((preset) => preset.id)).toEqual([rounds.preset.id]);
  });

  it('rejects an empty name and caps the stored length', async () => {
    expect(await savePreset({ name: '   ', config: config('forTime'), now: 1 })).toEqual({ ok: false, reason: 'empty-name' });
    const saved = await savePreset({ name: `  ${'A'.repeat(80)}  `, config: config('forTime', { workSeconds: 12 * 60 }), now: 2 });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.preset.name).toHaveLength(48);
    expect(saved.preset.config).toMatchObject({ mode: 'forTime', workSeconds: 12 * 60, rounds: 1, restSeconds: 0 });
  });
});

describe('preset migration', () => {
  const legacyCountdown = {
    kind: 'countdown',
    id: 'countdown-1',
    name: 'Warmup',
    durationSeconds: 300,
    leadInSeconds: 10,
    warningMarksSeconds: [60, 30, 10, 3, 2, 1],
    builtIn: false,
  };
  const legacyRound = {
    id: 'custom-1',
    name: 'Sparring',
    roundSeconds: 180,
    restSeconds: 60,
    rounds: 5,
    warningSeconds: 10,
    leadInSeconds: 10,
    builtIn: false,
  };

  it('converts a legacy array of countdown and round presets', () => {
    const { presets, migrated } = readStoredPresets([legacyRound, legacyCountdown, { nope: true }, 'bad']);
    expect(migrated).toBe(true);
    expect(presets.map((preset) => preset.mode).sort()).toEqual(['countdown', 'rounds']);
    const countdown = presets.find((preset) => preset.id === 'countdown-1');
    const rounds = presets.find((preset) => preset.id === 'custom-1');
    expect(countdown?.config).toMatchObject({
      mode: 'countdown',
      workSeconds: 300,
      leadInSeconds: 10,
      warningMarksSeconds: [60, 30, 10, 3, 2, 1],
    });
    expect(rounds?.config).toMatchObject({
      mode: 'rounds',
      workSeconds: 180,
      restSeconds: 60,
      rounds: 5,
      warningSeconds: 10,
      leadInSeconds: 10,
    });
    expect(countdown?.name).toBe('Warmup');
    expect(rounds?.name).toBe('Sparring');
  });

  it('persists the migrated document and does not rewrite it again', async () => {
    await AsyncStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify([legacyCountdown, legacyRound]));
    const loaded = await loadPresets();
    expect(loaded).toHaveLength(2);
    const stored = await AsyncStorage.getItem(PRESET_STORAGE_KEY);
    const document = JSON.parse(stored ?? '') as { version: number; presets: SavedPreset[] };
    expect(document.version).toBe(PRESET_DOCUMENT_VERSION);
    expect(document.presets).toHaveLength(2);

    await loadPresets();
    expect(await AsyncStorage.getItem(PRESET_STORAGE_KEY)).toBe(stored);

    const added = await savePreset({ name: 'AMRAP 12:00', config: config('amrap', { workSeconds: 12 * 60 }), now: 50 });
    expect(added.ok).toBe(true);
    expect(await listPresets('countdown')).toHaveLength(1);
    expect(await listPresets('rounds')).toHaveLength(1);
    expect(await listPresets('amrap')).toHaveLength(1);
  });

  it('leaves an unknown document untouched and ignores corrupt JSON', async () => {
    const unknown = JSON.stringify({ version: 1, presets: [{ id: 'keep' }] });
    await AsyncStorage.setItem(PRESET_STORAGE_KEY, unknown);
    expect(await loadPresets()).toEqual([]);
    expect(await AsyncStorage.getItem(PRESET_STORAGE_KEY)).toBe(unknown);

    await AsyncStorage.setItem(PRESET_STORAGE_KEY, '{not json');
    expect(await loadPresets()).toEqual([]);
    expect(await AsyncStorage.getItem(PRESET_STORAGE_KEY)).toBe('{not json');
  });

  it('reads an existing versioned document', async () => {
    const preset: SavedPreset = {
      id: 'preset-existing',
      name: 'For Time 20:00',
      mode: 'forTime',
      config: config('forTime', { workSeconds: 20 * 60 }),
      updatedAt: 9,
    };
    await AsyncStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify({ version: PRESET_DOCUMENT_VERSION, presets: [preset] }),
    );
    expect(await listPresets('forTime')).toEqual([preset]);
    expect(readStoredPresets(null)).toEqual({ presets: [], migrated: false });
  });
});

describe('preset names', () => {
  it('suggests a readable name for each mode', () => {
    expect(suggestPresetName(config('amrap', { workSeconds: 12 * 60 }))).toBe('AMRAP 12:00');
    expect(suggestPresetName(config('forTime'))).toBe('For Time');
    expect(suggestPresetName(config('forTime', { workSeconds: 8 * 60 }))).toBe('For Time 08:00');
    expect(suggestPresetName(config('emom', { workSeconds: 60, rounds: 10 }))).toBe('EMOM 01:00 × 10');
    expect(suggestPresetName(config('tabata', { workSeconds: 20, restSeconds: 10, rounds: 8 }))).toBe(
      'Tabata 00:20/00:10 × 8',
    );
    expect(suggestPresetName(config('intervals', { workSeconds: 40, restSeconds: 20, rounds: 8 }))).toBe(
      'Intervals 00:40/00:20 × 8',
    );
    expect(
      suggestPresetName(config('rounds', { workSeconds: 300, restSeconds: 60, rounds: 5, warningSeconds: 30 })),
    ).toBe('Rounds 05:00/01:00 × 5');
    expect(suggestPresetName(config('countdown', { workSeconds: 90 }))).toBe('Countdown 01:30');
    expect(presetSummary(config('amrap', { workSeconds: 12 * 60 }))).toBe('10s lead-in · 12:00');
  });

  it('adds a numeric suffix when the suggested name is taken', () => {
    const existing: SavedPreset = {
      id: 'preset-1',
      name: 'AMRAP 12:00',
      mode: 'amrap',
      config: config('amrap', { workSeconds: 12 * 60 }),
      updatedAt: 1,
    };
    expect(nextPresetName([existing], config('amrap', { workSeconds: 12 * 60 }))).toBe('AMRAP 12:00 2');
    expect(nextPresetName([existing], config('amrap', { workSeconds: 12 * 60 }), 'BJJ roll')).toBe('BJJ roll');
    expect(nextPresetName([existing], config('countdown', { workSeconds: 12 * 60 }))).toBe('Countdown 12:00');
  });
});
