import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CountdownPreset, RoundPreset } from './presets';

const KEY = 'americana.presets.v1';

function isRoundPreset(value: unknown): value is RoundPreset {
  if (!value || typeof value !== 'object') return false;
  const preset = value as Partial<RoundPreset> & { kind?: string };
  if (preset.kind === 'countdown') return false;
  return (
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.roundSeconds === 'number' &&
    typeof preset.restSeconds === 'number' &&
    typeof preset.rounds === 'number' &&
    typeof preset.warningSeconds === 'number' &&
    typeof preset.leadInSeconds === 'number'
  );
}

function isCountdownPreset(value: unknown): value is CountdownPreset {
  if (!value || typeof value !== 'object') return false;
  const preset = value as Partial<CountdownPreset>;
  return (
    preset.kind === 'countdown' &&
    typeof preset.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.durationSeconds === 'number' &&
    typeof preset.leadInSeconds === 'number' &&
    Array.isArray(preset.warningMarksSeconds) &&
    preset.warningMarksSeconds.every((mark) => typeof mark === 'number')
  );
}

async function loadAll(): Promise<unknown[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(entries: unknown[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(entries));
}

export async function loadCustomPresets(): Promise<RoundPreset[]> {
  const all = await loadAll();
  return all.filter(isRoundPreset).map((preset) => ({ ...preset, builtIn: false }));
}

export async function loadCountdownPresets(): Promise<CountdownPreset[]> {
  const all = await loadAll();
  return all.filter(isCountdownPreset).map((preset) => ({ ...preset, builtIn: false, kind: 'countdown' }));
}

export async function saveCustomPresets(presets: RoundPreset[]): Promise<void> {
  const all = await loadAll();
  const countdowns = all.filter(isCountdownPreset);
  const rounds = presets
    .filter((preset) => !preset.builtIn)
    .map((preset) => ({ ...preset, builtIn: false }));
  await writeAll([...rounds, ...countdowns]);
}

export async function saveCountdownPresets(presets: CountdownPreset[]): Promise<void> {
  const all = await loadAll();
  const rounds = all.filter(isRoundPreset);
  const countdowns = presets
    .filter((preset) => !preset.builtIn)
    .map((preset) => ({ ...preset, builtIn: false, kind: 'countdown' as const }));
  await writeAll([...rounds, ...countdowns]);
}
