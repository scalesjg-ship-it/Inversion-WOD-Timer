/**
 * Supabase Realtime broadcast, protocol v1, public channel.
 * No postgres changes and no replay, so the service does not keep the messages.
 */

export const REALTIME_EVENT = 'americana';
export const HEARTBEAT_MS = 20_000;

export interface RelayConfig {
  url: string;
  anonKey: string;
}

export interface RealtimeListener {
  joined: () => void;
  message: (payload: unknown) => void;
  closed: () => void;
}

export interface RealtimeLink {
  send: (payload: unknown) => void;
  close: () => void;
}

export type RealtimeFrame =
  | { kind: 'reply'; ref: string; status: 'ok' | 'error'; topic: string }
  | { kind: 'broadcast'; topic: string; event: string; payload: unknown }
  | { kind: 'close'; topic: string }
  | { kind: 'other' };

interface SocketLike {
  send: (data: string) => void;
  close: () => void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
}

export function realtimeTopic(channel: string): string {
  return `realtime:${channel}`;
}

export function realtimeWebSocketUrl(config: RelayConfig): string {
  const root = config.url.replace(/\/$/, '').replace(/^https:/i, 'wss:').replace(/^http:/i, 'ws:');
  const key = encodeURIComponent(config.anonKey);
  return `${root}/realtime/v1/websocket?apikey=${key}&vsn=1.0.0`;
}

export function joinMessage(channel: string, accessToken: string): string {
  return JSON.stringify({
    topic: realtimeTopic(channel),
    event: 'phx_join',
    payload: {
      config: {
        broadcast: { ack: false, self: false },
        presence: { enabled: false },
        private: false,
      },
      access_token: accessToken,
    },
    ref: '1',
    join_ref: '1',
  });
}

export function heartbeatMessage(ref: string): string {
  return JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref });
}

export function broadcastMessage(channel: string, ref: string, payload: unknown): string {
  return JSON.stringify({
    topic: realtimeTopic(channel),
    event: 'broadcast',
    payload: { type: 'broadcast', event: REALTIME_EVENT, payload },
    ref,
    join_ref: '1',
  });
}

export function leaveMessage(channel: string, ref: string): string {
  return JSON.stringify({
    topic: realtimeTopic(channel),
    event: 'phx_leave',
    payload: {},
    ref,
    join_ref: '1',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseRealtimeFrame(text: string): RealtimeFrame {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { kind: 'other' };
  }
  if (Array.isArray(value)) {
    if (value.length < 5) return { kind: 'other' };
    return interpretFrame(value[2], value[3], value[4], value[1]);
  }
  if (!isRecord(value)) return { kind: 'other' };
  return interpretFrame(value.topic, value.event, value.payload, value.ref);
}

function interpretFrame(topic: unknown, event: unknown, payload: unknown, ref: unknown): RealtimeFrame {
  const topicText = typeof topic === 'string' ? topic : '';
  const refText = typeof ref === 'string' || typeof ref === 'number' ? String(ref) : '';
  if (event === 'phx_close' || event === 'phx_error') return { kind: 'close', topic: topicText };
  if (event === 'phx_reply' && isRecord(payload)) {
    return {
      kind: 'reply',
      ref: refText,
      status: payload.status === 'ok' ? 'ok' : 'error',
      topic: topicText,
    };
  }
  if (event === 'broadcast' && isRecord(payload)) {
    return {
      kind: 'broadcast',
      topic: topicText,
      event: typeof payload.event === 'string' ? payload.event : '',
      payload: payload.payload,
    };
  }
  return { kind: 'other' };
}

export function connectRealtime(options: {
  config: RelayConfig;
  channel: string;
  listener: RealtimeListener;
  socket?: (url: string) => SocketLike;
  every?: (ms: number, fn: () => void) => { cancel: () => void };
}): RealtimeLink {
  const topic = realtimeTopic(options.channel);
  const openSocket = options.socket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  const every =
    options.every ??
    ((ms: number, fn: () => void) => {
      const id = setInterval(fn, ms);
      return { cancel: () => clearInterval(id) };
    });
  const ws = openSocket(realtimeWebSocketUrl(options.config));
  let settled = false;
  let joined = false;
  let ref = 1;
  let heart: { cancel: () => void } | null = null;
  const queue: unknown[] = [];

  const nextRef = () => {
    ref += 1;
    return String(ref);
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    heart?.cancel();
    heart = null;
    options.listener.closed();
  };

  const flush = (payload: unknown) => {
    ws.send(broadcastMessage(options.channel, nextRef(), payload));
  };

  ws.onopen = () => {
    if (settled) return;
    ws.send(joinMessage(options.channel, options.config.anonKey));
  };
  ws.onerror = () => finish();
  ws.onclose = () => finish();
  ws.onmessage = (event) => {
    if (settled || typeof event.data !== 'string') return;
    const frame = parseRealtimeFrame(event.data);
    if (frame.kind === 'reply' && frame.ref === '1') {
      if (frame.status !== 'ok' || frame.topic !== topic) {
        try {
          ws.close();
        } catch {
          finish();
        }
        return;
      }
      joined = true;
      options.listener.joined();
      for (const payload of queue) flush(payload);
      queue.length = 0;
      heart = every(HEARTBEAT_MS, () => {
        if (!settled) ws.send(heartbeatMessage(nextRef()));
      });
      return;
    }
    if (frame.kind === 'broadcast' && frame.topic === topic && frame.event === REALTIME_EVENT) {
      options.listener.message(frame.payload);
      return;
    }
    if (frame.kind === 'close' && frame.topic === topic) {
      try {
        ws.close();
      } catch {
        finish();
      }
    }
  };

  return {
    send(payload: unknown) {
      if (settled) return;
      if (!joined) {
        queue.push(payload);
        return;
      }
      flush(payload);
    },
    close() {
      if (settled) return;
      if (joined) {
        try {
          ws.send(leaveMessage(options.channel, nextRef()));
        } catch {
          // The socket is already going away.
        }
      }
      try {
        ws.close();
      } catch {
        finish();
      }
    },
  };
}
