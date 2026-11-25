/**
 * Signed wrapper around one watch-protocol JSON object.
 * `body` is that object without the trailing newline.
 */

import { hmacHex, macEqual } from './crypto';
import { WATCH_MAX_BYTES } from '../protocol';

export const RELAY_SKEW_MS = 60_000;

export interface RelayEnvelope {
  v: 1;
  type: 'relay';
  seq: number;
  ts: number;
  body: string;
  mac: string;
}

export function relayCanonical(seq: number, ts: number, body: string): string {
  return `1.${seq}.${ts}.${body}`;
}

export function sealRelay(secretHex: string, body: string, seq: number, ts: number): RelayEnvelope | null {
  if (!Number.isInteger(seq) || seq < 1 || !Number.isInteger(ts)) return null;
  if (body.length === 0 || utf8Size(body) > WATCH_MAX_BYTES || body.includes('\n')) return null;
  const mac = hmacHex(secretHex, relayCanonical(seq, ts, body));
  if (!mac) return null;
  return { v: 1, type: 'relay', seq, ts, body, mac };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

/**
 * Returns the watch-protocol body when the MAC, clock, and replay cache agree.
 * `seen` maps a MAC to the time it was accepted. Entries older than the skew window drop out.
 */
export function openRelay(
  secretHex: string,
  payload: unknown,
  now: number,
  seen: Map<string, number>,
): string | null {
  if (!isRecord(payload)) return null;
  if (payload.v !== 1 || payload.type !== 'relay') return null;
  if (typeof payload.seq !== 'number' || !Number.isInteger(payload.seq) || payload.seq < 1) return null;
  if (typeof payload.ts !== 'number' || !Number.isInteger(payload.ts)) return null;
  if (typeof payload.body !== 'string' || typeof payload.mac !== 'string') return null;
  if (Math.abs(now - payload.ts) > RELAY_SKEW_MS) return null;
  if (payload.body.length === 0 || utf8Size(payload.body) > WATCH_MAX_BYTES) return null;
  const expected = hmacHex(secretHex, relayCanonical(payload.seq, payload.ts, payload.body));
  if (!expected || !macEqual(expected, payload.mac)) return null;
  pruneSeen(seen, now);
  if (seen.has(payload.mac)) return null;
  seen.set(payload.mac, now);
  return payload.body;
}

function pruneSeen(seen: Map<string, number>, now: number): void {
  for (const [mac, ts] of seen) {
    if (now - ts > RELAY_SKEW_MS) seen.delete(mac);
  }
}
