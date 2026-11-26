import { describe, expect, it } from 'vitest';

import { CUE_SOUND_FILE, isVoiceSound, notificationFallbackSound } from './cueFiles';
import type { SoundName } from '@/src/timer/types';

const SOUNDS: SoundName[] = ['tick', 'warning', 'start', 'bell', 'three', 'two', 'one'];

describe('notification cue files', () => {
  it('names a bundled file for every cue, including the spoken counts', () => {
    expect(SOUNDS.map((sound) => CUE_SOUND_FILE[sound])).toEqual([
      'tick.wav',
      'warning.wav',
      'start.wav',
      'bell.wav',
      'three.wav',
      'two.wav',
      'one.wav',
    ]);
  });

  it('falls back to the tick beep when a spoken count cannot play in the background', () => {
    expect(notificationFallbackSound('three')).toBe('tick');
    expect(notificationFallbackSound('two')).toBe('tick');
    expect(notificationFallbackSound('one')).toBe('tick');
    expect(notificationFallbackSound('bell')).toBeNull();
    expect(notificationFallbackSound('start')).toBeNull();
    expect(notificationFallbackSound('warning')).toBeNull();
    expect(notificationFallbackSound('tick')).toBeNull();
    expect(isVoiceSound('two')).toBe(true);
    expect(isVoiceSound('tick')).toBe(false);
  });
});
