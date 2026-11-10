import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RoundPreset } from './presets';

const KEY = 'americana.presets.v1';

function isPreset(value: unknown): value is RoundPreset {
  if (!value || typeof value !== 'object') return false;
  const preset = value as Partial<RoundPreset>;
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

export async function loadCustomPresets(): Promise<RoundPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPreset).map((preset) => ({ ...preset, builtIn: false }));
  } catch {
    return [];
  }
}

export async function saveCustomPresets(presets: RoundPreset[]): Promise<void> {
  const custom = presets
    .filter((preset) => !preset.builtIn)
    .map((preset) => ({ ...preset, builtIn: false }));
  await AsyncStorage.setItem(KEY, JSON.stringify(custom));
}
