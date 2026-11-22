/**
 * Pairing for the Apple TV HD relay.
 * The 6-digit code only names the first channel. After the watch accepts,
 * both sides move to a long random channel and keep one shared secret.
 */

import { hexEncode } from './crypto';

export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_TTL_MS = 10 * 60 * 1000;
export const HANDSHAKE_PREFIX = 'americana-pair-';
export const SESSION_PREFIX = 'americana-session-';
export const PAIRING_STORAGE_KEY = 'americana.watch.relay.v1';
export const PAIRING_ID_HEX = 32;
export const PAIRING_SECRET_HEX = 64;
export const PAIRING_NONCE_HEX = 32;

const CODE_PATTERN = /^\d{6}$/;
const ID_PATTERN = /^[0-9a-f]{32}$/;
const SECRET_PATTERN = /^[0-9a-f]{64}$/;

export interface WatchPairing {
  pairingId: string;
  secret: string;
  pairedAt: number;
}

export interface HandshakeSession {
  code: string;
  pairingId: string;
  secret: string;
  expiresAt: number;
  watchNonce: string | null;
}

export interface HelloMessage {
  v: 1;
  kind: 'hello';
  nonce: string;
}

export interface OfferMessage {
  v: 1;
  kind: 'offer';
  pairingId: string;
  secret: string;
}

export interface AcceptMessage {
  v: 1;
  kind: 'accept';
  pairingId: string;
  nonce: string;
}

export type HandshakeMessage = HelloMessage | OfferMessage | AcceptMessage;

export function handshakeChannel(code: string): string {
  return `${HANDSHAKE_PREFIX}${code}`;
}

export function sessionChannel(pairingId: string): string {
  return `${SESSION_PREFIX}${pairingId}`;
}

/** Decimal digits from unbiased bytes. 250 and above are skipped so modulo 10 is flat. */
export function digitsFromBytes(bytes: Uint8Array, length: number): string | null {
  let out = '';
  for (const byte of bytes) {
    if (byte >= 250) continue;
    out += String(byte % 10);
    if (out.length === length) return out;
  }
  return null;
}

export function isPairingCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

export function isPairingCodeCurrent(expiresAt: number, now: number): boolean {
  return Number.isFinite(expiresAt) && Number.isFinite(now) && now < expiresAt;
}

export function createHandshake(now: number, randomBytes: (count: number) => Uint8Array): HandshakeSession | null {
  const code = digitsFromBytes(randomBytes(32), PAIRING_CODE_LENGTH);
  const pairingId = hexEncode(randomBytes(16));
  const secret = hexEncode(randomBytes(32));
  if (!code || !ID_PATTERN.test(pairingId) || !SECRET_PATTERN.test(secret)) return null;
  return {
    code,
    pairingId,
    secret,
    expiresAt: now + PAIRING_TTL_MS,
    watchNonce: null,
  };
}

export function parsePairingRecord(value: unknown): WatchPairing | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.pairingId !== 'string' || !ID_PATTERN.test(record.pairingId)) return null;
  if (typeof record.secret !== 'string' || !SECRET_PATTERN.test(record.secret)) return null;
  if (typeof record.pairedAt !== 'number' || !Number.isFinite(record.pairedAt)) return null;
  return { pairingId: record.pairingId, secret: record.secret, pairedAt: record.pairedAt };
}

function isHex(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[0-9a-f]+$/.test(value);
}

export function parseHandshake(value: unknown): HandshakeMessage | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.v !== 1) return null;
  switch (record.kind) {
    case 'hello':
      if (!isHex(record.nonce, PAIRING_NONCE_HEX)) return null;
      return { v: 1, kind: 'hello', nonce: record.nonce };
    case 'offer':
      if (!isHex(record.pairingId, PAIRING_ID_HEX) || !isHex(record.secret, PAIRING_SECRET_HEX)) return null;
      return { v: 1, kind: 'offer', pairingId: record.pairingId, secret: record.secret };
    case 'accept':
      if (!isHex(record.pairingId, PAIRING_ID_HEX) || !isHex(record.nonce, PAIRING_NONCE_HEX)) return null;
      return { v: 1, kind: 'accept', pairingId: record.pairingId, nonce: record.nonce };
    default:
      return null;
  }
}

export function offerMessage(session: HandshakeSession): OfferMessage {
  return { v: 1, kind: 'offer', pairingId: session.pairingId, secret: session.secret };
}

export function helloMessage(nonce: string): HelloMessage {
  return { v: 1, kind: 'hello', nonce };
}

export function acceptMessage(pairingId: string, nonce: string): AcceptMessage {
  return { v: 1, kind: 'accept', pairingId, nonce };
}

/** First retry waits 500ms, then doubles, and stays at 15s. */
export function relayBackoffMs(attempt: number): number {
  const exp = Math.min(Math.max(attempt, 1) - 1, 5);
  return Math.min(15_000, 500 * 2 ** exp);
}
