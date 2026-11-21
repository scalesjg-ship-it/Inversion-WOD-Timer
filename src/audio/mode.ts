export const CUE_INTERRUPTION_MODE = 'duckOthers' as const;

export type CueAudioMode = {
  playsInSilentMode: true;
  shouldPlayInBackground: boolean;
  interruptionMode: typeof CUE_INTERRUPTION_MODE;
};

/**
 * Timer cues play in the silent switch and duck whatever else is playing.
 * iOS must not keep the session alive after the app leaves the foreground:
 * the phone binary does not declare the `audio` UIBackgroundMode, and asking
 * expo-audio to stay active there logs a session error once iOS suspends it.
 * Android phones still may play in the background. A TV only sounds while open.
 */
export function cueAudioMode(os: string, isTV: boolean): CueAudioMode {
  return {
    playsInSilentMode: true,
    shouldPlayInBackground: os !== 'ios' && !isTV,
    interruptionMode: CUE_INTERRUPTION_MODE,
  };
}
