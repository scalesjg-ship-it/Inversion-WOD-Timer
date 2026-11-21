/**
 * Version 1 of the Apple Watch ↔ Apple TV timer link.
 * One JSON object per line. The watch listens; the TV connects and is the clock.
 * Swift mirrors these field names in modules/americana-watch-link/ios/WatchWire.swift.
 */

export const WATCH_PROTOCOL_VERSION = 1;
export const WATCH_SERVICE_NAME = 'Americana-Timer';
export const WATCH_MAX_BYTES = 4096;

export const WATCH_PHASES = ['idle', 'getReady', 'work', 'rest', 'finished'] as const;
export type WatchPhase = (typeof WATCH_PHASES)[number];

export const WATCH_COMMANDS = ['start', 'pause', 'resume', 'reset'] as const;
export type WatchCommandName = (typeof WATCH_COMMANDS)[number];

export const WATCH_EVENTS = ['phase', 'round', 'finished'] as const;
export type WatchEventName = (typeof WATCH_EVENTS)[number];

export const WATCH_PRIMARIES = ['start', 'pause', 'resume'] as const;
export type WatchPrimary = (typeof WATCH_PRIMARIES)[number];

export interface WatchState {
  v: 1;
  type: 'state';
  seq: number;
  phase: WatchPhase;
  running: boolean;
  paused: boolean;
  timeText: string;
  phaseText: string;
  roundText: string;
  round: number;
  totalRounds: number;
  primary: WatchPrimary;
  canReset: boolean;
}

export interface WatchEvent {
  v: 1;
  type: 'event';
  seq: number;
  name: WatchEventName;
  phase: WatchPhase;
  round: number;
  totalRounds: number;
}

export interface WatchCommand {
  v: 1;
  type: 'command';
  id: string;
  name: WatchCommandName;
}

export interface WatchAck {
  v: 1;
  type: 'ack';
  id: string;
  ok: boolean;
  action: WatchCommandName | 'ignore';
}

export type WatchMessage = WatchState | WatchEvent | WatchCommand | WatchAck;

const PHASES = new Set<string>(WATCH_PHASES);
const COMMANDS = new Set<string>(WATCH_COMMANDS);
const EVENTS = new Set<string>(WATCH_EVENTS);
const PRIMARIES = new Set<string>(WATCH_PRIMARIES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPhase(value: unknown): value is WatchPhase {
  return typeof value === 'string' && PHASES.has(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

function isShortText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80;
}

function isCommandId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

function commandAction(value: unknown): WatchAck['action'] | null {
  if (value === 'ignore') return 'ignore';
  if (typeof value !== 'string' || !COMMANDS.has(value)) return null;
  if (value === 'start' || value === 'pause' || value === 'resume' || value === 'reset') return value;
  return null;
}

function utf8Size(text: string): number {
  let size = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x7f) size += 1;
    else if (code <= 0x7ff) size += 2;
    else if (code <= 0xffff) size += 3;
    else size += 4;
  }
  return size;
}

export function encodeMessage(message: WatchMessage): string {
  return `${JSON.stringify(message)}\n`;
}

export function decodeMessage(line: string): WatchMessage | null {
  const text = line.endsWith('\n') ? line.slice(0, -1) : line;
  if (text.length === 0) return null;
  if (utf8Size(text) > WATCH_MAX_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.v !== WATCH_PROTOCOL_VERSION) return null;
  switch (parsed.type) {
    case 'state':
      return decodeState(parsed);
    case 'event':
      return decodeEvent(parsed);
    case 'command':
      return decodeCommand(parsed);
    case 'ack':
      return decodeAck(parsed);
    default:
      return null;
  }
}

function decodeState(value: Record<string, unknown>): WatchState | null {
  if (!isCount(value.seq) || !isPhase(value.phase)) return null;
  if (typeof value.running !== 'boolean' || typeof value.paused !== 'boolean') return null;
  if (!isShortText(value.timeText) || !isShortText(value.phaseText) || !isShortText(value.roundText)) return null;
  if (!isCount(value.round) || !isCount(value.totalRounds) || value.totalRounds < 1) return null;
  if (typeof value.primary !== 'string' || !PRIMARIES.has(value.primary)) return null;
  if (typeof value.canReset !== 'boolean') return null;
  return {
    v: 1,
    type: 'state',
    seq: value.seq,
    phase: value.phase,
    running: value.running,
    paused: value.paused,
    timeText: value.timeText,
    phaseText: value.phaseText,
    roundText: value.roundText,
    round: value.round,
    totalRounds: value.totalRounds,
    primary: value.primary as WatchPrimary,
    canReset: value.canReset,
  };
}

function decodeEvent(value: Record<string, unknown>): WatchEvent | null {
  if (!isCount(value.seq) || typeof value.name !== 'string' || !EVENTS.has(value.name)) return null;
  if (!isPhase(value.phase) || !isCount(value.round) || !isCount(value.totalRounds)) return null;
  return {
    v: 1,
    type: 'event',
    seq: value.seq,
    name: value.name as WatchEventName,
    phase: value.phase,
    round: value.round,
    totalRounds: value.totalRounds,
  };
}

function decodeCommand(value: Record<string, unknown>): WatchCommand | null {
  if (!isCommandId(value.id) || typeof value.name !== 'string' || !COMMANDS.has(value.name)) return null;
  return { v: 1, type: 'command', id: value.id, name: value.name as WatchCommandName };
}

function decodeAck(value: Record<string, unknown>): WatchAck | null {
  const action = commandAction(value.action);
  if (!isCommandId(value.id) || typeof value.ok !== 'boolean' || action === null) return null;
  return {
    v: 1,
    type: 'ack',
    id: value.id,
    ok: value.ok,
    action,
  };
}

/** Split a byte stream into complete lines. The tail stays buffered. */
export function takeFrames(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split('\n');
  const rest = parts.pop() ?? '';
  return { lines: parts.filter((line) => line.length > 0), rest };
}
