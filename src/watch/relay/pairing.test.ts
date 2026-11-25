import { describe, expect, it } from 'vitest';

import {
  PAIRING_CODE_MESSAGE,
  PAIRING_NETWORK_MESSAGE,
  PAIRING_SERVER_MESSAGE,
  PAIRING_TTL_MS,
  classifyPairingFault,
  createHandshake,
  digitsFromBytes,
  formatPairingCode,
  handshakeChannel,
  isPairingCode,
  isPairingCodeCurrent,
  normalizePairingCode,
  parseHandshake,
  parsePairingRecord,
  relayBackoffMs,
  sessionChannel,
} from './pairing';

function sequence(bytes: number[]): (count: number) => Uint8Array {
  let index = 0;
  return (count: number) => {
    const out = new Uint8Array(count);
    for (let i = 0; i < count; i += 1) {
      out[i] = bytes[index % bytes.length] ?? 0;
      index += 1;
    }
    return out;
  };
}

describe('pairing codes', () => {
  it('builds a 6-digit code and skips biased bytes', () => {
    expect(digitsFromBytes(Uint8Array.from([250, 255, 251, 9, 10, 21, 0, 5, 3]), 6)).toBe('901053');
    expect(digitsFromBytes(Uint8Array.from([250, 251]), 6)).toBeNull();
    expect(isPairingCode('123456')).toBe(true);
    expect(isPairingCode('12345')).toBe(false);
    expect(isPairingCode('1234567')).toBe(false);
    expect(isPairingCode('12a456')).toBe(false);
  });

  it('expires a code after 10 minutes', () => {
    const now = 1_700_000_000_000;
    const random = sequence([4, 8, 15, 16, 23, 42, 7, 9, 1, 2, 3, 11]);
    const session = createHandshake(now, random);
    expect(session).not.toBeNull();
    expect(session?.code).toMatch(/^\d{6}$/);
    expect(session?.expiresAt).toBe(now + PAIRING_TTL_MS);
    expect(isPairingCodeCurrent(session?.expiresAt ?? 0, now + PAIRING_TTL_MS - 1)).toBe(true);
    expect(isPairingCodeCurrent(session?.expiresAt ?? 0, now + PAIRING_TTL_MS)).toBe(false);
    expect(handshakeChannel(session?.code ?? '')).toBe(`americana-pair-${session?.code}`);
    expect(sessionChannel(session?.pairingId ?? '')).toBe(`americana-session-${session?.pairingId}`);
    expect(session?.pairingId).toMatch(/^[0-9a-f]{32}$/);
    expect(session?.secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a stored pairing that is not the long id and secret', () => {
    const good = {
      pairingId: 'ab'.repeat(16),
      secret: 'cd'.repeat(32),
      pairedAt: 10,
    };
    expect(parsePairingRecord(good)).toEqual(good);
    expect(parsePairingRecord({ ...good, pairingId: 'short' })).toBeNull();
    expect(parsePairingRecord({ ...good, secret: 'CD'.repeat(32) })).toBeNull();
    expect(parsePairingRecord(null)).toBeNull();
  });

  it('accepts hello, offer, and accept and drops anything else', () => {
    const nonce = 'a1'.repeat(16);
    const pairingId = 'b2'.repeat(16);
    const secret = 'c3'.repeat(32);
    expect(parseHandshake({ v: 1, kind: 'hello', nonce })).toEqual({ v: 1, kind: 'hello', nonce });
    expect(parseHandshake({ v: 1, kind: 'offer', pairingId, secret })).toEqual({
      v: 1,
      kind: 'offer',
      pairingId,
      secret,
    });
    expect(parseHandshake({ v: 1, kind: 'accept', pairingId, nonce })).toEqual({
      v: 1,
      kind: 'accept',
      pairingId,
      nonce,
    });
    expect(parseHandshake({ v: 1, kind: 'hello', nonce: 'nope' })).toBeNull();
    expect(parseHandshake({ v: 2, kind: 'hello', nonce })).toBeNull();
    expect(parseHandshake({ v: 1, kind: 'command', nonce })).toBeNull();
  });

  it('treats the space in 814 947 as display formatting and still pairs that code', () => {
    expect(normalizePairingCode('814 947')).toBe('814947');
    expect(normalizePairingCode('814947')).toBe('814947');
    expect(formatPairingCode('814947')).toBe('814 947');
    expect(handshakeChannel('814 947')).toBe('americana-pair-814947');
    expect(handshakeChannel('814947')).toBe(handshakeChannel('814 947'));
    expect(normalizePairingCode('81494')).toBeNull();
  });

  it('blames a missing offer on the code, and a socket failure on the network', () => {
    expect(classifyPairingFault({ type: 'send-before-open' })).toEqual({ blame: 'none', message: null });
    expect(classifyPairingFault({ type: 'transport' })).toEqual({
      blame: 'network',
      message: PAIRING_NETWORK_MESSAGE,
    });
    expect(classifyPairingFault({ type: 'join-rejected', reason: 'PrivateOnly: public channels are disabled' })).toEqual({
      blame: 'server',
      message: PAIRING_SERVER_MESSAGE,
    });
    expect(classifyPairingFault({ type: 'no-offer' })).toEqual({
      blame: 'code',
      message: PAIRING_CODE_MESSAGE,
    });
    expect(PAIRING_CODE_MESSAGE).not.toContain('internet');
    expect(PAIRING_NETWORK_MESSAGE).not.toContain('wrong');
  });

  it('backs off and then holds at 15 seconds', () => {
    expect(relayBackoffMs(1)).toBe(500);
    expect(relayBackoffMs(2)).toBe(1000);
    expect(relayBackoffMs(3)).toBe(2000);
    expect(relayBackoffMs(6)).toBe(15_000);
    expect(relayBackoffMs(12)).toBe(15_000);
  });
});
