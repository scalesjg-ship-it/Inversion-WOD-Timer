import type { SoundName } from '@/src/timer/types';

export const CUE_SOUND_FILE: Record<SoundName, string> = {
  tick: 'tick.wav',
  warning: 'warning.wav',
  start: 'start.wav',
  bell: 'bell.wav',
  three: 'three.wav',
  two: 'two.wav',
  one: 'one.wav',
};

export function isVoiceSound(sound: SoundName): boolean {
  switch (sound) {
    case 'three':
    case 'two':
    case 'one':
      return true;
    case 'tick':
    case 'warning':
    case 'start':
    case 'bell':
      return false;
    default: {
      const unexpected: never = sound;
      return unexpected;
    }
  }
}

/**
 * A background notification can play one bundled file. If the voice clip
 * is not in this binary, the same cue is scheduled again as the tick beep
 * so the rest of the plan, including the horn at zero, still runs.
 */
export function notificationFallbackSound(sound: SoundName): SoundName | null {
  return isVoiceSound(sound) ? 'tick' : null;
}
