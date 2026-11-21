import { describe, expect, it } from 'vitest';

import { CUE_INTERRUPTION_MODE, cueAudioMode } from './mode';

describe('cue audio mode', () => {
  it('plays iPhone cues in the foreground and ducks other audio', () => {
    expect(cueAudioMode('ios', false)).toEqual({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: CUE_INTERRUPTION_MODE,
    });
  });

  it('keeps the Apple TV session foreground-only', () => {
    expect(cueAudioMode('ios', true).shouldPlayInBackground).toBe(false);
  });

  it('leaves Android phone background playback alone', () => {
    expect(cueAudioMode('android', false).shouldPlayInBackground).toBe(true);
    expect(cueAudioMode('android', true).shouldPlayInBackground).toBe(false);
  });
});
