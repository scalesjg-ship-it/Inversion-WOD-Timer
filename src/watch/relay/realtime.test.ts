import { describe, expect, it } from 'vitest';

import { relayConfigFromExtra } from './config';
import {
  broadcastMessage,
  connectRealtime,
  heartbeatMessage,
  joinMessage,
  parseRealtimeFrame,
  realtimeWebSocketUrl,
} from './realtime';

class FakeSocket {
  static last: FakeSocket | null = null;
  sent: string[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.onclose?.({});
  }
}

describe('realtime broadcast frames', () => {
  it('joins a public channel without replay or database changes', () => {
    const config = { url: 'https://example.supabase.co/', anonKey: 'anon-key-value-1234567890' };
    expect(realtimeWebSocketUrl(config)).toBe(
      'wss://example.supabase.co/realtime/v1/websocket?apikey=anon-key-value-1234567890&vsn=1.0.0',
    );
    const join = JSON.parse(joinMessage('americana-pair-123456', config.anonKey)) as {
      topic: string;
      event: string;
      payload: { config: { broadcast: { self: boolean; replay?: unknown }; presence: { enabled: boolean }; private: boolean; postgres_changes?: unknown }; access_token: string };
    };
    expect(join.topic).toBe('realtime:americana-pair-123456');
    expect(join.event).toBe('phx_join');
    expect(join.payload.config.private).toBe(false);
    expect(join.payload.config.broadcast.self).toBe(false);
    expect(join.payload.config.broadcast.replay).toBeUndefined();
    expect(join.payload.config.presence.enabled).toBe(false);
    expect(join.payload.config.postgres_changes).toBeUndefined();
    expect(join.payload.access_token).toBe(config.anonKey);
    expect(JSON.parse(heartbeatMessage('3'))).toMatchObject({ topic: 'phoenix', event: 'heartbeat' });
  });

  it('reads a broadcast payload and an error reply', () => {
    const frame = parseRealtimeFrame(
      broadcastMessage('americana-session-abcd', '2', { v: 1, kind: 'hello', nonce: 'aa' }),
    );
    expect(frame.kind).toBe('broadcast');
    if (frame.kind !== 'broadcast') return;
    expect(frame.event).toBe('americana');
    expect(frame.payload).toEqual({ v: 1, kind: 'hello', nonce: 'aa' });
    expect(parseRealtimeFrame('{"event":"phx_reply","topic":"realtime:room","ref":"1","payload":{"status":"error"}}')).toEqual({
      kind: 'reply',
      ref: '1',
      status: 'error',
      topic: 'realtime:room',
    });
  });

  it('sends the join, then a queued payload, and ignores its own topic only', () => {
    const messages: unknown[] = [];
    const link = connectRealtime({
      config: { url: 'https://example.supabase.co', anonKey: 'anon-key-value-1234567890' },
      channel: 'americana-pair-123456',
      listener: { joined: () => undefined, message: (payload) => messages.push(payload), closed: () => undefined },
      socket: (url) => new FakeSocket(url),
      every: () => ({ cancel: () => undefined }),
    });
    const socket = FakeSocket.last;
    expect(socket?.url).toContain('vsn=1.0.0');
    link.send({ v: 1, kind: 'offer' });
    socket?.onopen?.({});
    expect(JSON.parse(socket?.sent[0] ?? '{}')).toMatchObject({ event: 'phx_join' });
    socket?.onmessage?.({
      data: JSON.stringify({
        topic: 'realtime:americana-pair-123456',
        event: 'phx_reply',
        ref: '1',
        payload: { status: 'ok', response: {} },
      }),
    });
    expect(JSON.parse(socket?.sent[1] ?? '{}')).toMatchObject({
      event: 'broadcast',
      payload: { event: 'americana', payload: { v: 1, kind: 'offer' } },
    });
    socket?.onmessage?.({
      data: JSON.stringify({
        topic: 'realtime:americana-pair-123456',
        event: 'broadcast',
        payload: { type: 'broadcast', event: 'americana', payload: { v: 1, kind: 'hello' } },
      }),
    });
    expect(messages).toEqual([{ v: 1, kind: 'hello' }]);
  });

  it('reads the two env names and ignores empty placeholders', () => {
    expect(relayConfigFromExtra({ supabaseUrl: 'https://abc.supabase.co/', supabaseAnonKey: 'x'.repeat(20) })).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'x'.repeat(20),
    });
    expect(relayConfigFromExtra({ supabaseUrl: '', supabaseAnonKey: '' })).toBeNull();
    expect(relayConfigFromExtra({ supabaseUrl: '$(SUPABASE_URL)', supabaseAnonKey: 'x'.repeat(20) })).toBeNull();
    expect(relayConfigFromExtra({})).toBeNull();
  });
});
