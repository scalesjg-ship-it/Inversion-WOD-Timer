import { useCallback, useEffect, useRef, useState } from 'react';

import type { TimerConfig, TimerSnapshot } from '@/src/timer/types';

import { watchControl, type WatchClockAction } from './commands';
import { buildWatchState, watchEvents } from './face';
import {
  logWatchLink,
  watchButtonVisible,
  watchLinkAfterPickerResult,
  watchLinkMessage,
  watchLinkPhaseFromEvent,
  type WatchLinkPhase,
} from './linkStatus';
import { eventJson, watchNative } from './native';
import { decodeMessage, encodeMessage } from './protocol';

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
  presentPicker: () => void;
} {
  const snapshotRef = useRef(input.snapshot);
  const configRef = useRef(input.config);
  const onActionRef = useRef(input.onAction);
  const previousRef = useRef<TimerSnapshot | null>(null);
  const seqRef = useRef(0);
  const publishRef = useRef<() => void>(() => {});
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState<WatchLinkPhase>('idle');

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
    if (!native) return undefined;
    native.start();

    const commandSub = native.addListener('command', (payload) => {
      const message = decodeMessage(eventJson(payload));
      if (!message || message.type !== 'command') return;
      const effect = watchControl(message.name, snapshotRef.current);
      onActionRef.current(effect.action);
      native.send(
        encodeMessage({
          v: 1,
          type: 'ack',
          id: message.id,
          ok: effect.action !== 'ignore',
          action: effect.action,
        }),
      );
    });
    const linkSub = native.addListener('link', (payload) => {
      const raw = eventJson(payload);
      const next = watchLinkPhaseFromEvent(raw);
      logWatchLink(next ?? 'idle', `event ${raw || 'empty'}`);
      if (!next) return;
      setPhase(next);
      setConnected(next === 'connected');
    });

    const nextSeq = () => {
      seqRef.current += 1;
      return seqRef.current;
    };
    const publish = () => {
      const snap = snapshotRef.current;
      const state = buildWatchState(snap, configRef.current, nextSeq());
      native.send(encodeMessage(state));
      for (const event of watchEvents(previousRef.current, snap, nextSeq())) {
        native.send(encodeMessage(event));
      }
      previousRef.current = snap;
    };
    publishRef.current = publish;
    publish();
    const id = setInterval(publish, 1000);
    return () => {
      clearInterval(id);
      publishRef.current = () => {};
      commandSub.remove();
      linkSub.remove();
      native.stop();
      previousRef.current = null;
      setConnected(false);
      setPhase('idle');
    };
  }, [input.enabled]);

  useEffect(() => {
    if (!input.enabled) return;
    publishRef.current();
  }, [input.enabled, input.snapshot.phase, input.snapshot.round, input.snapshot.running, input.snapshot.paused]);

  const presentPicker = useCallback(() => {
    if (!input.enabled) return;
    const native = watchNative();
    if (!native) {
      logWatchLink('unavailable', 'module missing');
      setPhase('unavailable');
      setConnected(false);
      return;
    }
    logWatchLink('looking', 'presentPicker');
    setPhase('looking');
    void native.presentPicker()
      .then((opened) => {
        logWatchLink(opened ? 'looking' : 'unsupported', `presentPicker returned ${opened}`);
        setPhase((current) => watchLinkAfterPickerResult(current, opened));
        if (!opened) setConnected(false);
      })
      .catch(() => {
        logWatchLink('unavailable', 'presentPicker rejected');
        setPhase((current) => (current === 'looking' || current === 'idle' ? 'unavailable' : current));
        setConnected(false);
      });
  }, [input.enabled]);

  return {
    connected,
    phase,
    message: watchLinkMessage(phase),
    watchControlVisible: watchButtonVisible(phase),
    presentPicker,
  };
}
