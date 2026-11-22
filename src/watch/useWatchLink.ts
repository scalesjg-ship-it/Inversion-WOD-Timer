import { useCallback, useEffect, useRef, useState } from 'react';

import type { TimerConfig, TimerSnapshot } from '@/src/timer/types';

import { watchControl, type WatchClockAction } from './commands';
import { buildWatchState, watchEvents } from './face';
import {
  displayedWatchPhase,
  logWatchLink,
  watchButtonVisible,
  watchLinkAfterPickerResult,
  watchLinkMessage,
  watchLinkPhaseFromEvent,
  watchPairOfferVisible,
  watchUnpairVisible,
  type WatchLinkPhase,
} from './linkStatus';
import { eventJson, watchNative } from './native';
import { decodeMessage, encodeMessage } from './protocol';
import { useRelayLink } from './useRelayLink';

interface UseWatchLinkInput {
  enabled: boolean;
  snapshot: TimerSnapshot;
  config: TimerConfig;
  onAction: (action: WatchClockAction) => void;
}

export function useWatchLink(input: UseWatchLinkInput): {
  connected: boolean;
  phase: WatchLinkPhase;
  message: string | null;
  watchControlVisible: boolean;
  pairingCode: string | null;
  offerPairCode: boolean;
  offerUnpair: boolean;
  presentPicker: () => void;
  pairWithCode: () => void;
  unpair: () => void;
} {
  const snapshotRef = useRef(input.snapshot);
  const configRef = useRef(input.config);
  const onActionRef = useRef(input.onAction);
  const previousRef = useRef<TimerSnapshot | null>(null);
  const seqRef = useRef(0);
  const publishRef = useRef<() => void>(() => {});
  const relaySendRef = useRef<(line: string) => void>(() => {});
  const startPairingRef = useRef<(force?: boolean) => void>(() => {});
  const directReadyRef = useRef(false);
  const [directConnected, setDirectConnected] = useState(false);
  const [directPhase, setDirectPhase] = useState<WatchLinkPhase>('idle');

  const handleCommand = useCallback((line: string, via: 'direct' | 'relay') => {
    const message = decodeMessage(line);
    if (!message || message.type !== 'command') return;
    const effect = watchControl(message.name, snapshotRef.current);
    onActionRef.current(effect.action);
    const ack = encodeMessage({
      v: 1,
      type: 'ack',
      id: message.id,
      ok: effect.action !== 'ignore',
      action: effect.action,
    });
    if (via === 'direct') watchNative()?.send(ack);
    else relaySendRef.current(ack);
  }, []);

  const relay = useRelayLink(input.enabled, (line) => handleCommand(line, 'relay'));

  useEffect(() => {
    relaySendRef.current = relay.send;
    startPairingRef.current = relay.startPairing;
  }, [relay.send, relay.startPairing]);

  useEffect(() => {
    snapshotRef.current = input.snapshot;
  }, [input.snapshot]);

  useEffect(() => {
    configRef.current = input.config;
  }, [input.config]);

  useEffect(() => {
    onActionRef.current = input.onAction;
  }, [input.onAction]);

  useEffect(() => {
    if (!input.enabled) return undefined;
    const native = watchNative();
    native?.start();

    const commandSub = native?.addListener('command', (payload) => {
      handleCommand(eventJson(payload), 'direct');
    });
    const linkSub = native?.addListener('link', (payload) => {
      const raw = eventJson(payload);
      const next = watchLinkPhaseFromEvent(raw);
      logWatchLink(next ?? 'idle', `event ${raw || 'empty'}`);
      if (!next) return;
      if (next === 'pairing') {
        startPairingRef.current(false);
      }
      directReadyRef.current = next === 'connected';
      setDirectPhase(next);
      setDirectConnected(next === 'connected');
    });

    const nextSeq = () => {
      seqRef.current += 1;
      return seqRef.current;
    };
    const publish = () => {
      const snap = snapshotRef.current;
      const state = buildWatchState(snap, configRef.current, nextSeq());
      const stateLine = encodeMessage(state);
      native?.send(stateLine);
      if (!directReadyRef.current) relaySendRef.current(stateLine);
      for (const event of watchEvents(previousRef.current, snap, nextSeq())) {
        const line = encodeMessage(event);
        native?.send(line);
        if (!directReadyRef.current) relaySendRef.current(line);
      }
      previousRef.current = snap;
    };
    publishRef.current = publish;
    publish();
    const id = setInterval(publish, 1000);
    return () => {
      clearInterval(id);
      publishRef.current = () => {};
      commandSub?.remove();
      linkSub?.remove();
      native?.stop();
      previousRef.current = null;
      directReadyRef.current = false;
      setDirectConnected(false);
      setDirectPhase('idle');
    };
  }, [handleCommand, input.enabled]);

  useEffect(() => {
    if (!input.enabled) return;
    publishRef.current();
  }, [input.enabled, input.snapshot.phase, input.snapshot.round, input.snapshot.running, input.snapshot.paused]);

  useEffect(() => {
    if (!input.enabled || relay.snapshot.phase !== 'connected') return;
    publishRef.current();
  }, [input.enabled, relay.snapshot.phase]);

  const presentPicker = useCallback(() => {
    if (!input.enabled) return;
    if (directPhase === 'pairing' || relay.snapshot.code) {
      relay.startPairing(true);
      return;
    }
    const native = watchNative();
    if (!native) {
      logWatchLink('unavailable', 'module missing');
      directReadyRef.current = false;
      setDirectPhase('unavailable');
      setDirectConnected(false);
      return;
    }
    logWatchLink('looking', 'presentPicker');
    setDirectPhase('looking');
    void native
      .presentPicker()
      .then((opened) => {
        const next = watchLinkAfterPickerResult('looking', opened);
        logWatchLink(next, `presentPicker returned ${opened}`);
        if (!opened) startPairingRef.current(false);
        setDirectPhase((current) => (current === 'connected' ? current : next));
        if (!opened) setDirectConnected(false);
      })
      .catch(() => {
        logWatchLink('unavailable', 'presentPicker rejected');
        directReadyRef.current = false;
        setDirectPhase((current) => (current === 'looking' || current === 'idle' ? 'unavailable' : current));
        setDirectConnected(false);
      });
  }, [directPhase, input.enabled, relay]);

  const phase = displayedWatchPhase(directPhase, relay.snapshot);
  const joining = relay.snapshot.phase === 'joining';

  return {
    connected: directConnected || relay.snapshot.phase === 'connected',
    phase,
    message: joining ? 'Connecting to Apple Watch…' : watchLinkMessage(phase, relay.configured),
    watchControlVisible: watchButtonVisible(phase),
    pairingCode: relay.snapshot.code,
    offerPairCode: watchPairOfferVisible(phase, relay.snapshot.paired),
    offerUnpair: watchUnpairVisible(relay.snapshot.paired),
    presentPicker,
    pairWithCode: () => relay.startPairing(true),
    unpair: () => relay.forget(),
  };
}
