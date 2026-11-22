import { describe, expect, it } from 'vitest';

import { decodeMessage } from '../protocol';

import { sealRelay } from './envelope';
import { TvRelay, type RelayLink, type RelaySnapshot } from './session';
import type { RealtimeListener } from './realtime';
import type { WatchPairing } from './pairing';

class FakeLink implements RelayLink {
  sent: unknown[] = [];
  closed = false;
  constructor(
    readonly channel: string,
    private readonly listener: RealtimeListener,
  ) {}
  send(payload: unknown) {
    this.sent.push(payload);
  }
  close() {
    this.closed = true;
    this.listener.closed();
  }
  join() {
    this.listener.joined();
  }
  deliver(payload: unknown) {
    this.listener.message(payload);
  }
}

function harness(config: { url: string; anonKey: string } | null = { url: 'https://example.supabase.co', anonKey: 'anon-key-value-1234567890' }) {
  let now = 1_700_000_000_000;
  let byte = 1;
  const saved: WatchPairing[] = [];
  const links: FakeLink[] = [];
  const timers: { ms: number; fn: () => void; cancelled: boolean }[] = [];
  const commands: string[] = [];
  let snapshot: RelaySnapshot = { phase: 'off', code: null, expiresAt: null, paired: false };
  const relay = new TvRelay(
    {
      now: () => now,
      randomBytes: (count: number) => {
        const out = new Uint8Array(count);
        for (let i = 0; i < count; i += 1) {
          byte = (byte * 37 + 11) % 241;
          out[i] = byte;
        }
        return out;
      },
      config,
      save: (pairing) => {
        saved.push(pairing);
      },
      clear: () => {
        saved.length = 0;
      },
      open: (channel, listener) => {
        const link = new FakeLink(channel, listener);
        links.push(link);
        return link;
      },
      schedule: (ms, fn) => {
        const timer = { ms, fn, cancelled: false };
        timers.push(timer);
        return {
          cancel: () => {
            timer.cancelled = true;
          },
        };
      },
    },
    (line) => commands.push(line),
    (next) => {
      snapshot = next;
    },
  );
  return {
    relay,
    links,
    timers,
    saved,
    commands,
    get snapshot() {
      return snapshot;
    },
    set now(value: number) {
      now = value;
    },
    fire(kind: 'retry' | 'expiry') {
      const pending = timers.filter((timer) => !timer.cancelled);
      const timer = kind === 'expiry' ? pending.find((item) => item.ms >= 60_000) : pending.find((item) => item.ms < 60_000);
      timer?.fn();
    },
  };
}

describe('tv relay session', () => {
  it('shows a code, offers one secret, then follows the watch onto the long channel', () => {
    const rig = harness();
    rig.relay.start(null);
    rig.relay.startPairing();
    expect(rig.snapshot.phase).toBe('pairing');
    expect(rig.snapshot.code).toMatch(/^\d{6}$/);
    const handshake = rig.links[0];
    expect(handshake?.channel).toBe(`americana-pair-${rig.snapshot.code}`);
    handshake?.join();
    const nonce = 'ab'.repeat(16);
    handshake?.deliver(TvRelay.hello(nonce));
    handshake?.deliver(TvRelay.hello('cd'.repeat(16)));
    expect(handshake?.sent).toHaveLength(1);
    const offer = handshake?.sent[0] as { kind: string; pairingId: string; secret: string };
    expect(offer.kind).toBe('offer');
    handshake?.deliver(TvRelay.accept('ff'.repeat(16), nonce));
    expect(rig.saved).toHaveLength(0);
    handshake?.deliver(TvRelay.accept(offer.pairingId, nonce));
    expect(rig.saved).toEqual([{ pairingId: offer.pairingId, secret: offer.secret, pairedAt: 1_700_000_000_000 }]);
    expect(handshake?.closed).toBe(true);
    const session = rig.links[1];
    expect(session?.channel).toBe(`americana-session-${offer.pairingId}`);
    session?.join();
    expect(rig.snapshot.phase).toBe('connected');
    expect(rig.snapshot.code).toBeNull();

    const command = '{"v":1,"type":"command","id":"cmd-1","name":"pause"}';
    const sealed = sealRelay(offer.secret, command, 2, 1_700_000_000_100);
    session?.deliver(sealed);
    expect(decodeMessage(rig.commands[0] ?? '')).toMatchObject({ type: 'command', name: 'pause' });
    rig.relay.send('{"v":1,"type":"state","seq":1}\n');
    expect(session?.sent).toHaveLength(1);
  });

  it('reconnects a saved pairing without a new code, and forgets it', () => {
    const rig = harness();
    const stored = { pairingId: 'aa'.repeat(16), secret: 'bb'.repeat(32), pairedAt: 10 };
    rig.relay.start(stored);
    expect(rig.snapshot.phase).toBe('reconnecting');
    expect(rig.snapshot.code).toBeNull();
    expect(rig.links[0]?.channel).toBe(`americana-session-${stored.pairingId}`);
    rig.links[0]?.close();
    expect(rig.snapshot.phase).toBe('reconnecting');
    rig.fire('retry');
    expect(rig.links[1]?.channel).toBe(rig.links[0]?.channel);
    rig.relay.forget();
    expect(rig.snapshot).toEqual({ phase: 'off', code: null, expiresAt: null, paired: false });
    expect(rig.saved).toHaveLength(0);
  });

  it('replaces the code when the 10 minutes run out', () => {
    const rig = harness();
    rig.relay.start(null);
    rig.relay.startPairing();
    const first = rig.snapshot.code;
    rig.now = 1_700_000_000_000 + 10 * 60 * 1000;
    rig.fire('expiry');
    expect(rig.snapshot.code).toMatch(/^\d{6}$/);
    expect(rig.snapshot.code).not.toBe(first);
    expect(rig.links.at(-1)?.channel).toBe(`americana-pair-${rig.snapshot.code}`);
  });

  it('still shows a code when the pairing keys are not set', () => {
    const rig = harness(null);
    rig.relay.start(null);
    rig.relay.startPairing();
    expect(rig.snapshot.phase).toBe('unconfigured');
    expect(rig.snapshot.code).toMatch(/^\d{6}$/);
    expect(rig.links).toHaveLength(0);
  });
});
