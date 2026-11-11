import { normalizeConfig } from './engine';
import { formatSeconds } from './format';
import type { TimerConfig, TimerMode } from './types';

/** Saved timer setup. `mode` matches `config.mode`. */
export interface SavedPreset {
  id: string;
  name: string;
  mode: TimerMode;
  config: TimerConfig;
  updatedAt: number;
}

export type PresetFailure = 'missing' | 'empty-name' | 'name-taken';

export type PresetResult = { ok: true; preset: SavedPreset } | { ok: false; reason: PresetFailure };

export const PRESET_STORAGE_KEY = 'americana.presets.v1';
export const PRESET_DOCUMENT_VERSION = 2;

const TIMER_MODES: readonly TimerMode[] = [
  'forTime',
  'amrap',
  'emom',
  'tabata',
  'intervals',
  'rounds',
  'countdown',
];

const NAME_MAX = 48;

export function normalizePresetName(name: string): string {
  return name.trim().slice(0, NAME_MAX);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimerMode(value: unknown): value is TimerMode {
  return typeof value === 'string' && (TIMER_MODES as readonly string[]).includes(value);
}

function sameName(left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function numberField(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((mark): mark is number => typeof mark === 'number' && Number.isFinite(mark));
}

export function suggestPresetName(config: TimerConfig): string {
  const normalized = normalizeConfig(config);
  switch (normalized.mode) {
    case 'forTime':
      return normalized.workSeconds > 0 ? `For Time ${formatSeconds(normalized.workSeconds)}` : 'For Time';
    case 'amrap':
      return `AMRAP ${formatSeconds(normalized.workSeconds)}`;
    case 'emom':
      return `EMOM ${formatSeconds(normalized.workSeconds)} × ${normalized.rounds}`;
    case 'tabata':
      return `Tabata ${formatSeconds(normalized.workSeconds)}/${formatSeconds(normalized.restSeconds)} × ${normalized.rounds}`;
    case 'intervals':
      return `Intervals ${formatSeconds(normalized.workSeconds)}/${formatSeconds(normalized.restSeconds)} × ${normalized.rounds}`;
    case 'rounds':
      return `Rounds ${formatSeconds(normalized.workSeconds)}/${formatSeconds(normalized.restSeconds)} × ${normalized.rounds}`;
    case 'countdown':
      return `Countdown ${formatSeconds(normalized.workSeconds)}`;
    default: {
      const exhaustive: never = normalized.mode;
      return exhaustive;
    }
  }
}

export function presetSummary(config: TimerConfig): string {
  const normalized = normalizeConfig(config);
  const lead = normalized.leadInSeconds > 0 ? `${normalized.leadInSeconds}s lead-in` : 'No lead-in';
  switch (normalized.mode) {
    case 'forTime':
      return normalized.workSeconds > 0
        ? `${lead} · cap ${formatSeconds(normalized.workSeconds)}`
        : `${lead} · count up`;
    case 'amrap':
      return `${lead} · ${formatSeconds(normalized.workSeconds)}`;
    case 'emom':
      return `${lead} · every ${formatSeconds(normalized.workSeconds)} · ${normalized.rounds} rounds`;
    case 'tabata':
    case 'intervals':
      return `${lead} · ${formatSeconds(normalized.workSeconds)} on / ${formatSeconds(normalized.restSeconds)} off · ${normalized.rounds} rounds`;
    case 'rounds': {
      const warn = normalized.warningSeconds > 0 ? ` · warn ${normalized.warningSeconds}s` : '';
      return `${lead} · ${formatSeconds(normalized.workSeconds)} on / ${formatSeconds(normalized.restSeconds)} off · ${normalized.rounds} rounds${warn}`;
    }
    case 'countdown':
      return `${lead} · ${formatSeconds(normalized.workSeconds)}`;
    default: {
      const exhaustive: never = normalized.mode;
      return exhaustive;
    }
  }
}

export function nextPresetName(presets: readonly SavedPreset[], config: TimerConfig, hint?: string): string {
  const normalized = normalizeConfig(config);
  const preferred = hint ? normalizePresetName(hint) : '';
  const base = preferred || suggestPresetName(normalized);
  const taken = new Set(
    presets.filter((preset) => preset.mode === normalized.mode).map((preset) => preset.name.toLocaleLowerCase()),
  );
  if (!taken.has(base.toLocaleLowerCase())) return base;
  let suffix = 2;
  while (suffix < 1000) {
    const stamp = ` ${suffix}`;
    const candidate = `${base.slice(0, NAME_MAX - stamp.length)}${stamp}`;
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
    suffix += 1;
  }
  return base.slice(0, NAME_MAX);
}

function sortPresets(presets: readonly SavedPreset[]): SavedPreset[] {
  return [...presets].sort(
    (left, right) =>
      right.updatedAt - left.updatedAt ||
      left.name.localeCompare(right.name) ||
      left.id.localeCompare(right.id),
  );
}

function createPresetId(now: number): string {
  return `preset-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function configFromParts(
  mode: TimerMode,
  fields: {
    leadInSeconds: number;
    workSeconds: number;
    restSeconds: number;
    rounds: number;
    warningSeconds: number;
    warningMarksSeconds?: number[];
  },
): TimerConfig {
  return normalizeConfig({ mode, ...fields });
}

function sanitizeSaved(value: unknown, index: number): SavedPreset | null {
  if (!isRecord(value) || !isTimerMode(value.mode)) return null;
  if (typeof value.id !== 'string' || value.id.length === 0 || typeof value.name !== 'string') return null;
  const name = normalizePresetName(value.name);
  if (!name || !isRecord(value.config) || !isTimerMode(value.config.mode) || value.config.mode !== value.mode) {
    return null;
  }
  const config = configFromParts(value.mode, {
    leadInSeconds: numberField(value.config.leadInSeconds) ?? 0,
    workSeconds: numberField(value.config.workSeconds) ?? 0,
    restSeconds: numberField(value.config.restSeconds) ?? 0,
    rounds: numberField(value.config.rounds) ?? 1,
    warningSeconds: numberField(value.config.warningSeconds) ?? 0,
    warningMarksSeconds: numberArray(value.config.warningMarksSeconds),
  });
  const updatedAt =
    typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : (index + 1) * 1000;
  return { id: value.id, name, mode: config.mode, config, updatedAt };
}

function legacyCountdown(value: Record<string, unknown>, index: number): SavedPreset | null {
  if (value.kind !== 'countdown') return null;
  if (typeof value.id !== 'string' || value.id.length === 0 || typeof value.name !== 'string') return null;
  const name = normalizePresetName(value.name);
  const durationSeconds = numberField(value.durationSeconds);
  const leadInSeconds = numberField(value.leadInSeconds);
  if (!name || durationSeconds === null || leadInSeconds === null || !Array.isArray(value.warningMarksSeconds)) {
    return null;
  }
  if (!value.warningMarksSeconds.every((mark) => typeof mark === 'number' && Number.isFinite(mark))) return null;
  return {
    id: value.id,
    name,
    mode: 'countdown',
    config: configFromParts('countdown', {
      leadInSeconds,
      workSeconds: durationSeconds,
      restSeconds: 0,
      rounds: 1,
      warningSeconds: 0,
      warningMarksSeconds: value.warningMarksSeconds.filter((mark): mark is number => typeof mark === 'number'),
    }),
    updatedAt: (index + 1) * 1000,
  };
}

function legacyRound(value: Record<string, unknown>, index: number): SavedPreset | null {
  if (value.kind === 'countdown' || value.mode != null || value.config != null) return null;
  if (typeof value.id !== 'string' || value.id.length === 0 || typeof value.name !== 'string') return null;
  const name = normalizePresetName(value.name);
  const roundSeconds = numberField(value.roundSeconds);
  const restSeconds = numberField(value.restSeconds);
  const rounds = numberField(value.rounds);
  const warningSeconds = numberField(value.warningSeconds);
  const leadInSeconds = numberField(value.leadInSeconds);
  if (
    !name ||
    roundSeconds === null ||
    restSeconds === null ||
    rounds === null ||
    warningSeconds === null ||
    leadInSeconds === null
  ) {
    return null;
  }
  return {
    id: value.id,
    name,
    mode: 'rounds',
    config: configFromParts('rounds', {
      leadInSeconds,
      workSeconds: roundSeconds,
      restSeconds,
      rounds,
      warningSeconds,
    }),
    updatedAt: (index + 1) * 1000,
  };
}

function migrateItem(value: unknown, index: number): SavedPreset | null {
  const saved = sanitizeSaved(value, index);
  if (saved) return saved;
  if (!isRecord(value)) return null;
  return legacyCountdown(value, index) ?? legacyRound(value, index);
}

function collect(items: readonly unknown[]): SavedPreset[] {
  const seen = new Set<string>();
  const presets: SavedPreset[] = [];
  items.forEach((item, index) => {
    const preset = migrateItem(item, index);
    if (!preset || seen.has(preset.id)) return;
    seen.add(preset.id);
    presets.push(preset);
  });
  return sortPresets(presets);
}

export function readStoredPresets(parsed: unknown): { presets: SavedPreset[]; migrated: boolean } {
  if (parsed == null) return { presets: [], migrated: false };
  if (Array.isArray(parsed)) return { presets: collect(parsed), migrated: true };
  if (!isRecord(parsed) || parsed.version !== PRESET_DOCUMENT_VERSION || !Array.isArray(parsed.presets)) {
    return { presets: [], migrated: false };
  }
  const presets = collect(parsed.presets);
  const migrated = JSON.stringify(presets) !== JSON.stringify(parsed.presets);
  return { presets, migrated };
}

export function serializePresetDocument(presets: readonly SavedPreset[]): string {
  return JSON.stringify({
    version: PRESET_DOCUMENT_VERSION,
    presets: sortPresets(presets),
  });
}

export function presetByName(presets: readonly SavedPreset[], mode: TimerMode, name: string): SavedPreset | undefined {
  const normalized = normalizePresetName(name);
  return presets.find((preset) => preset.mode === mode && sameName(preset.name, normalized));
}

export function applySave(
  presets: readonly SavedPreset[],
  input: { name: string; config: TimerConfig; overwrite?: boolean; now?: number },
): { presets: SavedPreset[]; result: PresetResult } {
  const name = normalizePresetName(input.name);
  if (!name) return { presets: [...presets], result: { ok: false, reason: 'empty-name' } };
  const config = normalizeConfig(input.config);
  const now = input.now ?? Date.now();
  const existing = presetByName(presets, config.mode, name);
  if (existing && !input.overwrite) {
    return { presets: [...presets], result: { ok: false, reason: 'name-taken' } };
  }
  if (existing) {
    const preset: SavedPreset = { ...existing, name, config, updatedAt: now };
    return {
      presets: presets.map((item) => (item.id === existing.id ? preset : item)),
      result: { ok: true, preset },
    };
  }
  const preset: SavedPreset = {
    id: createPresetId(now),
    name,
    mode: config.mode,
    config,
    updatedAt: now,
  };
  return { presets: [...presets, preset], result: { ok: true, preset } };
}

export function applyRename(
  presets: readonly SavedPreset[],
  id: string,
  name: string,
  now = Date.now(),
): { presets: SavedPreset[]; result: PresetResult } {
  const nextName = normalizePresetName(name);
  if (!nextName) return { presets: [...presets], result: { ok: false, reason: 'empty-name' } };
  const current = presets.find((preset) => preset.id === id);
  if (!current) return { presets: [...presets], result: { ok: false, reason: 'missing' } };
  const conflict = presets.find(
    (preset) => preset.id !== id && preset.mode === current.mode && sameName(preset.name, nextName),
  );
  if (conflict) return { presets: [...presets], result: { ok: false, reason: 'name-taken' } };
  const preset: SavedPreset = { ...current, name: nextName, updatedAt: now };
  return {
    presets: presets.map((item) => (item.id === id ? preset : item)),
    result: { ok: true, preset },
  };
}

export function applyUpdate(
  presets: readonly SavedPreset[],
  id: string,
  config: TimerConfig,
  now = Date.now(),
): { presets: SavedPreset[]; result: PresetResult } {
  const current = presets.find((preset) => preset.id === id);
  if (!current) return { presets: [...presets], result: { ok: false, reason: 'missing' } };
  const normalized = normalizeConfig({ ...config, mode: current.mode });
  const preset: SavedPreset = { ...current, config: normalized, updatedAt: now };
  return {
    presets: presets.map((item) => (item.id === id ? preset : item)),
    result: { ok: true, preset },
  };
}

export function applyDelete(presets: readonly SavedPreset[], id: string): SavedPreset[] {
  return presets.filter((preset) => preset.id !== id);
}

export function listMode(presets: readonly SavedPreset[], mode: TimerMode): SavedPreset[] {
  return sortPresets(presets.filter((preset) => preset.mode === mode));
}
