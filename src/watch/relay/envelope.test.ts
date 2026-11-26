import { describe, expect, it } from 'vitest';

import { mapWatchCommand } from '../commands';
import { decodeMessage, type WatchCommand } from '../protocol';

import { hexEncode, hmacHex, hmacSha256, sha256, utf8Bytes } from './crypto';
import { RELAY_SKEW_MS, openRelay, relayCanonical, sealRelay } from './envelope';

const SECRET = '11'.repeat(32);

describe('relay signatures', () => {
  it('matches the SHA-256 and HMAC test vectors', () => {
    expect(hexEncode(sha256(utf8Bytes('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const key = Uint8Array.from({ length: 20 }, () => 0x0b);
    const mac = hmacSha256(key, utf8Bytes('Hi There'));
    expect(hexEncode(mac)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });

  it('signs the canonical string and rejects a forged or stale message', () => {
    const body = '{"v":1,"type":"command","id":"cmd-1","name":"pause"}';
    const sealed = sealRelay(SECRET, body, 4, 1_700_000_000_000);
    expect(sealed?.mac).toBe(hmacHex(SECRET, relayCanonical(4, 1_700_000_000_000, body)));
    const seen = new Map<string, number>();
    expect(openRelay(SECRET, sealed, 1_700_000_000_500, seen)).toBe(body);
    expect(openRelay(SECRET, sealed, 1_700_000_000_500, seen)).toBeNull();
    expect(openRelay(SECRET, { ...sealed, mac: 'ab'.repeat(32) }, 1_700_000_000_500, new Map())).toBeNull();
    expect(openRelay(SECRET, sealed, 1_700_000_000_000 + RELAY_SKEW_MS + 5, new Map())).toBeNull();
    expect(openRelay('22'.repeat(32), sealed, 1_700_000_000_000, new Map())).toBeNull();
  });

  it('maps a signed watch command onto the same clock action as the direct link', () => {
    const command: WatchCommand = { v: 1, type: 'command', id: 'cmd-9', name: 'reset' };
    const body = JSON.stringify(command);
    const sealed = sealRelay(SECRET, body, 1, 5_000);
    const opened = openRelay(SECRET, sealed, 5_100, new Map());
    const message = opened ? decodeMessage(opened) : null;
    expect(message?.type).toBe('command');
    if (!message || message.type !== 'command') return;
    expect(message).toEqual(command);
    expect(mapWatchCommand(message.name, { phase: 'work', running: true, paused: false })).toBe('reset');
    expect(mapWatchCommand('start', { phase: 'work', running: true, paused: false })).toBe('ignore');
  });
});
