import { describe, expect, it } from 'vitest';

import {
  decodeMessage,
  encodeMessage,
  takeFrames,
  WATCH_MAX_BYTES,
  WATCH_PROTOCOL_VERSION,
  WATCH_SERVICE_NAME,
  type WatchCommand,
  type WatchEvent,
  type WatchMessage,
  type WatchState,
} from './protocol';

const state: WatchState = {
  v: 1,
  type: 'state',
  seq: 4,
  phase: 'work',
  running: true,
  paused: false,
  timeText: '00:42',
  phaseText: 'WORK',
  roundText: 'Round 3 of 8',
  round: 3,
  totalRounds: 8,
  primary: 'pause',
  canReset: true,
};

const event: WatchEvent = {
  v: 1,
  type: 'event',
  seq: 5,
  name: 'phase',
  phase: 'rest',
  round: 3,
  totalRounds: 8,
};

const command: WatchCommand = { v: 1, type: 'command', id: 'cmd-1', name: 'pause' };

function roundTrip(message: WatchMessage) {
  const encoded = encodeMessage(message);
  expect(encoded.endsWith('\n')).toBe(true);
  expect(decodeMessage(encoded)).toEqual(message);
  expect(decodeMessage(encoded.slice(0, -1))).toEqual(message);
}

describe('watch protocol', () => {
  it('uses version 1 and the Americana-Timer service name', () => {
    expect(WATCH_PROTOCOL_VERSION).toBe(1);
    expect(WATCH_SERVICE_NAME).toBe('Americana-Timer');
  });

  it('round-trips state, events, commands, and acks', () => {
    roundTrip(state);
    roundTrip(event);
    roundTrip({ ...event, name: 'round', phase: 'work', round: 4 });
    roundTrip({ ...event, name: 'finished', phase: 'finished' });
    roundTrip(command);
    roundTrip({ ...command, name: 'start' });
    roundTrip({ ...command, name: 'resume' });
    roundTrip({ ...command, name: 'reset' });
    roundTrip({ v: 1, type: 'ack', id: 'cmd-1', ok: true, action: 'pause' });
    roundTrip({ v: 1, type: 'ack', id: 'cmd-1', ok: false, action: 'ignore' });
  });

  it('splits a stream on newlines and keeps a partial tail', () => {
    const blob = `${encodeMessage(state)}${encodeMessage(command)}{"v":1`;
    const framed = takeFrames(blob);
    expect(framed.lines).toHaveLength(2);
    expect(decodeMessage(framed.lines[0])).toEqual(state);
    expect(decodeMessage(framed.lines[1])).toEqual(command);
    expect(framed.rest).toBe('{"v":1');
  });

  it('rejects another version, unknown commands, and broken JSON', () => {
    expect(decodeMessage('')).toBeNull();
    expect(decodeMessage('not-json')).toBeNull();
    expect(decodeMessage('[]')).toBeNull();
    expect(decodeMessage(JSON.stringify({ ...command, v: 2 }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ v: 1, type: 'command', id: 'x', name: 'exit' }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ v: 1, type: 'command', id: 'x', name: 'menu' }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ v: 1, type: 'command', id: 'x', name: 'back' }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ v: 1, type: 'command', id: '', name: 'pause' }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ v: 1, type: 'event', seq: 1, name: 'seek', phase: 'work', round: 1, totalRounds: 1 }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ ...state, phase: 'leadIn' }))).toBeNull();
    expect(decodeMessage('x'.repeat(WATCH_MAX_BYTES + 1))).toBeNull();
  });
});
