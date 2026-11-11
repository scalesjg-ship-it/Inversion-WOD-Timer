import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TimerConfig, TimerMode } from './types';
import {
  PRESET_STORAGE_KEY,
  applyDelete,
  applyRename,
  applySave,
  applyUpdate,
  listMode,
  readStoredPresets,
  serializePresetDocument,
  type PresetResult,
  type SavedPreset,
} from './presetStore';

export type { PresetResult, SavedPreset };
export { PRESET_STORAGE_KEY, nextPresetName, presetSummary, suggestPresetName } from './presetStore';

/**
 * Presets stay on this device under `americana.presets.v1`.
 * A legacy array of countdown and round presets is rewritten as `{ version: 2, presets }`.
 */
export async function loadPresets(): Promise<SavedPreset[]> {
  let parsed: unknown;
  try {
    const raw = await AsyncStorage.getItem(PRESET_STORAGE_KEY);
    if (raw == null) return [];
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const { presets, migrated } = readStoredPresets(parsed);
  if (migrated) await AsyncStorage.setItem(PRESET_STORAGE_KEY, serializePresetDocument(presets));
  return presets;
}

async function writePresets(presets: readonly SavedPreset[]): Promise<void> {
  await AsyncStorage.setItem(PRESET_STORAGE_KEY, serializePresetDocument(presets));
}

export async function listPresets(mode: TimerMode): Promise<SavedPreset[]> {
  return listMode(await loadPresets(), mode);
}

export async function savePreset(input: {
  name: string;
  config: TimerConfig;
  overwrite?: boolean;
  now?: number;
}): Promise<PresetResult> {
  const current = await loadPresets();
  const next = applySave(current, input);
  if (next.result.ok) await writePresets(next.presets);
  return next.result;
}

export async function renamePreset(id: string, name: string, now = Date.now()): Promise<PresetResult> {
  const current = await loadPresets();
  const next = applyRename(current, id, name, now);
  if (next.result.ok) await writePresets(next.presets);
  return next.result;
}

export async function updatePreset(id: string, config: TimerConfig, now = Date.now()): Promise<PresetResult> {
  const current = await loadPresets();
  const next = applyUpdate(current, id, config, now);
  if (next.result.ok) await writePresets(next.presets);
  return next.result;
}

export async function deletePreset(id: string): Promise<void> {
  const current = await loadPresets();
  if (!current.some((preset) => preset.id === id)) return;
  await writePresets(applyDelete(current, id));
}
