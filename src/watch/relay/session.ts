/**
 * TV side of the relay. The 6-digit channel is only the handshake.
 * The saved pairing is the long channel plus one secret.
 */

import { openRelay, sealRelay } from './envelope';
import {
  acceptMessage,
  createHandshake,
  handshakeChannel,
  helloMessage,
  offerMessage,
  parseHandshake,
  relayBackoffMs,
  sessionChannel,
  type HandshakeSession,
  type WatchPairing,
} from './pairing';
import type { RelayConfig, RealtimeListener } from './realtime';

export type RelayPhase = 'off' | 'pairing' | 'joining' | 'connected' | 'reconnecting' | 'unconfigured';

export interface RelaySnapshot {
  phase: RelayPhase;
  code: string | null;
  expiresAt: number | null;
  paired: boolean;
}

export interface RelayLink {
  send: (payload: unknown) => void;
  close: () => void;
}

export interface TvRelayDeps {
  now: () => number;
  randomBytes: (count: number) => Uint8Array;
  config: RelayConfig | null;
  save: (pairing: WatchPairing) => void;
  clear: () => void;
  open: (channel: string, listener: RealtimeListener) => RelayLink;
  schedule: (ms: number, fn: () => void) => { cancel: () => void };
}

const INITIAL: RelaySnapshot = { phase: 'off', code: null, expiresAt: null, paired: false };

export class TvRelay {
  snapshot: RelaySnapshot = { ...INITIAL };

  private handshake: HandshakeSession | null = null;
  private pairing: WatchPairing | null = null;
  private link: RelayLink | null = null;
  private mode: 'idle' | 'handshake' | 'session' = 'idle';
  private generation = 0;
  private attempt = 0;
  private seq = 0;
  private seen = new Map<string, number>();
  private retry: { cancel: () => void } | null = null;
  private expiry: { cancel: () => void } | null = null;
  private booted = false;
  private stopped = false;
  private pending: 'soft' | 'force' | null = null;

  constructor(
    private readonly deps: TvRelayDeps,
    private readonly onCommand: (line: string) => void,
    private readonly onChange: (snapshot: RelaySnapshot) => void,
  ) {}

  start(stored: WatchPairing | null): void {
    if (this.stopped) return;
    this.booted = true;
    if (stored) {
      this.pairing = stored;
      this.snapshot = {
        phase: this.deps.config ? 'reconnecting' : 'unconfigured',
        code: null,
        expiresAt: null,
        paired: true,
      };
      this.emit();
      if (this.deps.config) {
        this.attempt = 0;
        this.openLink(sessionChannel(stored.pairingId), 'session');
      }
    }
    if (this.pending) {
      const force = this.pending === 'force';
      this.pending = null;
      this.startPairing(force);
    }
  }

  /** `force` replaces a live code. A soft start keeps a saved pairing and a live code. */
  startPairing(force = false): void {
    if (this.stopped) return;
    if (!this.booted) {
      this.pending = force ? 'force' : this.pending ?? 'soft';
      return;
    }
    const live = this.handshake !== null && this.handshake.expiresAt > this.deps.now();
    if (!force && live) return;
    if (!force && this.pairing && !this.handshake) return;
    this.cancelRetry();
    this.cancelExpiry();
    this.closeLink();
    const created = createHandshake(this.deps.now(), this.deps.randomBytes);
    if (!created) {
      this.handshake = null;
      this.snapshot = { phase: 'unconfigured', code: null, expiresAt: null, paired: this.pairing !== null };
      this.emit();
      return;
    }
    this.handshake = created;
    this.snapshot = {
      phase: this.deps.config ? 'pairing' : 'unconfigured',
      code: created.code,
      expiresAt: created.expiresAt,
      paired: this.pairing !== null,
    };
    this.emit();
    this.armExpiry(created.expiresAt);
    if (!this.deps.config) return;
    this.attempt = 0;
    this.openLink(handshakeChannel(created.code), 'handshake');
  }

  /** Watch-side helper used by tests: build a hello the TV session understands. */
  static hello(nonce: string) {
    return helloMessage(nonce);
  }

  static accept(pairingId: string, nonce: string) {
    return acceptMessage(pairingId, nonce);
  }

  send(line: string): void {
    if (this.mode !== 'session' || this.snapshot.phase !== 'connected' || !this.pairing || !this.link) return;
    const body = line.endsWith('\n') ? line.slice(0, -1) : line;
    this.seq += 1;
    const sealed = sealRelay(this.pairing.secret, body, this.seq, this.deps.now());
    if (!sealed) return;
    this.link.send(sealed);
  }

  forget(): void {
    if (this.stopped) return;
    this.cancelRetry();
    this.cancelExpiry();
    this.closeLink();
    this.handshake = null;
    this.pairing = null;
    this.deps.clear();
    this.snapshot = { ...INITIAL };
    this.emit();
  }

  stop(): void {
    this.stopped = true;
    this.cancelRetry();
    this.cancelExpiry();
    this.closeLink();
  }

  private openLink(channel: string, mode: 'handshake' | 'session'): void {
    const gen = ++this.generation;
    this.mode = mode;
    this.link = this.deps.open(channel, {
      joined: () => {
        if (gen !== this.generation || this.stopped) return;
        this.attempt = 0;
        if (mode === 'session') {
          this.snapshot = { phase: 'connected', code: null, expiresAt: null, paired: true };
          this.emit();
        }
      },
      message: (payload) => {
        if (gen !== this.generation || this.stopped) return;
        this.onMessage(payload);
      },
      closed: () => {
        if (gen !== this.generation || this.stopped) return;
        this.noteDrop();
      },
    });
  }

  private onMessage(payload: unknown): void {
    if (this.mode === 'handshake' && this.handshake) {
      const handshake = this.handshake;
      if (handshake.expiresAt <= this.deps.now()) return;
      const message = parseHandshake(payload);
      if (!message) return;
      if (message.kind === 'hello') {
        if (handshake.watchNonce) return;
        this.handshake = { ...handshake, watchNonce: message.nonce };
        this.link?.send(offerMessage(this.handshake));
        return;
      }
      if (message.kind !== 'accept') return;
      if (!handshake.watchNonce || message.nonce !== handshake.watchNonce) return;
      if (message.pairingId !== handshake.pairingId) return;
      const record: WatchPairing = {
        pairingId: handshake.pairingId,
        secret: handshake.secret,
        pairedAt: this.deps.now(),
      };
      this.pairing = record;
      this.deps.save(record);
      this.handshake = null;
      this.cancelExpiry();
      this.closeLink();
      this.snapshot = { phase: 'joining', code: null, expiresAt: null, paired: true };
      this.emit();
      this.attempt = 0;
      this.openLink(sessionChannel(record.pairingId), 'session');
      return;
    }
    if (this.mode !== 'session' || !this.pairing) return;
    const body = openRelay(this.pairing.secret, payload, this.deps.now(), this.seen);
    if (!body) return;
    this.onCommand(body);
  }

  private noteDrop(): void {
    this.link = null;
    this.attempt += 1;
    const delay = relayBackoffMs(this.attempt);
    const handshake = this.handshake;
    if (handshake && handshake.expiresAt > this.deps.now()) {
      this.snapshot = {
        phase: 'pairing',
        code: handshake.code,
        expiresAt: handshake.expiresAt,
        paired: this.pairing !== null,
      };
      this.emit();
      this.armRetry(delay, () => this.openLink(handshakeChannel(handshake.code), 'handshake'));
      return;
    }
    const pairing = this.pairing;
    if (pairing && this.deps.config) {
      this.snapshot = { phase: 'reconnecting', code: null, expiresAt: null, paired: true };
      this.emit();
      this.armRetry(delay, () => this.openLink(sessionChannel(pairing.pairingId), 'session'));
      return;
    }
    if (handshake) this.startPairing(true);
  }

  private armExpiry(expiresAt: number): void {
    this.cancelExpiry();
    const delay = Math.max(0, expiresAt - this.deps.now());
    this.expiry = this.deps.schedule(delay, () => {
      this.expiry = null;
      if (this.stopped || this.mode === 'session') return;
      this.startPairing(true);
    });
  }

  private armRetry(ms: number, fn: () => void): void {
    this.cancelRetry();
    this.retry = this.deps.schedule(ms, () => {
      this.retry = null;
      if (!this.stopped) fn();
    });
  }

  private closeLink(): void {
    this.generation += 1;
    this.mode = 'idle';
    const link = this.link;
    this.link = null;
    link?.close();
  }

  private cancelRetry(): void {
    this.retry?.cancel();
    this.retry = null;
  }

  private cancelExpiry(): void {
    this.expiry?.cancel();
    this.expiry = null;
  }

  private emit(): void {
    this.onChange({ ...this.snapshot });
  }
}
