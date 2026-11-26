import Constants from 'expo-constants';
import { useEffect, useMemo, useRef, useState } from 'react';

import { relayConfigFromExtra } from './relay/config';
import { systemRandomBytes } from './relay/random';
import { connectRealtime, type RealtimeListener } from './relay/realtime';
import { TvRelay, type RelaySnapshot } from './relay/session';
import { clearWatchPairing, loadWatchPairing, saveWatchPairing } from './relay/storage';

const IDLE: RelaySnapshot = { phase: 'off', code: null, expiresAt: null, paired: false };

export function useRelayLink(enabled: boolean, onCommand: (line: string) => void): {
  snapshot: RelaySnapshot;
  configured: boolean;
  startPairing: (force?: boolean) => void;
  forget: () => void;
  send: (line: string) => void;
} {
  const onCommandRef = useRef(onCommand);
  const sessionRef = useRef<TvRelay | null>(null);
  const [snapshot, setSnapshot] = useState<RelaySnapshot>(IDLE);
  const config = useMemo(() => relayConfigFromExtra(Constants.expoConfig?.extra), []);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    if (!enabled) return undefined;
    const session = new TvRelay(
      {
        now: () => Date.now(),
        randomBytes: (count) => systemRandomBytes(count) ?? new Uint8Array(),
        config,
        save: (pairing) => {
          void saveWatchPairing(pairing);
        },
        clear: () => {
          void clearWatchPairing();
        },
        open: (channel, listener: RealtimeListener) => {
          if (!config) {
            listener.closed();
            return { send: () => undefined, close: () => undefined };
          }
          return connectRealtime({ config, channel, listener });
        },
        schedule: (ms, fn) => {
          const id = setTimeout(fn, ms);
          return { cancel: () => clearTimeout(id) };
        },
      },
      (line) => onCommandRef.current(line),
      setSnapshot,
    );
    sessionRef.current = session;
    let alive = true;
    void loadWatchPairing().then((stored) => {
      if (!alive) return;
      session.start(stored);
    });
    return () => {
      alive = false;
      session.stop();
      sessionRef.current = null;
    };
  }, [config, enabled]);

  return {
    snapshot,
    configured: config !== null,
    startPairing: (force = false) => sessionRef.current?.startPairing(force),
    forget: () => sessionRef.current?.forget(),
    send: (line) => sessionRef.current?.send(line),
  };
}
