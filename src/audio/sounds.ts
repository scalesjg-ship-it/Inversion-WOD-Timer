import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { soundsForCues, type Cue, type SoundName } from '@/src/timer/engine';
import { allowsDeviceHaptics } from '@/src/tv/controls';

const sources: Record<SoundName, number> = {
  tick: require('../../assets/sounds/tick.wav'),
  warning: require('../../assets/sounds/warning.wav'),
  start: require('../../assets/sounds/start.wav'),
  bell: require('../../assets/sounds/bell.wav'),
};

const players = new Map<SoundName, AudioPlayer>();
let modeReady = false;

async function ensureMode(): Promise<void> {
  if (modeReady) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'duckOthers',
  });
  modeReady = true;
}

function playerFor(name: SoundName): AudioPlayer {
  const existing = players.get(name);
  if (existing) return existing;
  const player = createAudioPlayer(sources[name]);
  player.volume = 1;
  players.set(name, player);
  return player;
}

/** Call from a press handler so browsers allow later timer cues. */
export function unlockAudio(): void {
  void ensureMode().catch(() => undefined);
  try {
    const player = playerFor('tick');
    player.volume = 0;
    player.play();
    player.volume = 1;
  } catch {
    // Web audio can reject outside a user gesture. The clock still runs.
  }
}

export async function playSound(name: SoundName): Promise<void> {
  try {
    await ensureMode();
    const player = playerFor(name);
    player.volume = 1;
    await player.seekTo(0);
    player.play();
  } catch {
    // A missing speaker should not stop the clock.
  }

  if (!allowsDeviceHaptics(Platform.isTV === true)) return;
  try {
    if (name === 'warning') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (name === 'tick') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  } catch {
    // Haptics are unavailable on TV, desktop browsers, and some devices.
  }
}

export async function playCueBatch(cues: Cue[]): Promise<void> {
  const sounds = soundsForCues(cues);
  for (const sound of sounds) {
    await playSound(sound);
  }
}
