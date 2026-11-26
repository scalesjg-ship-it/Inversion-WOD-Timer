import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { cueAudioMode } from '@/src/audio/mode';
import { soundsForCues, type Cue, type SoundName } from '@/src/timer/engine';
import { allowsDeviceHaptics } from '@/src/tv/controls';
import bell from '../../assets/sounds/bell.wav';
import one from '../../assets/sounds/one.wav';
import start from '../../assets/sounds/start.wav';
import three from '../../assets/sounds/three.wav';
import tick from '../../assets/sounds/tick.wav';
import two from '../../assets/sounds/two.wav';
import warning from '../../assets/sounds/warning.wav';

/**
 * Spoken counts are rendered clips, not on-device text-to-speech, so they
 * play offline on tvOS and Fire TV. Piper TTS 1.8.0 spoke "Three!", "Two!",
 * and "One!" with the en_US-ljspeech-medium voice. That voice was trained
 * from scratch on the public-domain LJ Speech recordings of Linda Johnson
 * (https://keithito.com/LJ-Speech-Dataset/). The model and the engine are
 * not bundled. Each clip is mono 16-bit PCM at 44.1 kHz, trimmed, faded,
 * and peak-normalized to -1 dBFS, and each is shorter than 0.7 seconds.
 */

const sources: Record<SoundName, number> = {
  tick,
  warning,
  start,
  bell,
  three,
  two,
  one,
};

const players = new Map<SoundName, AudioPlayer>();
let modeReady = false;

async function ensureMode(): Promise<void> {
  if (modeReady) return;
  await setAudioModeAsync(cueAudioMode(Platform.OS, Platform.isTV === true));
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

function hapticKind(name: SoundName): 'warning' | 'light' | 'heavy' {
  switch (name) {
    case 'warning':
      return 'warning';
    case 'tick':
    case 'three':
    case 'two':
    case 'one':
      return 'light';
    case 'start':
    case 'bell':
      return 'heavy';
    default: {
      const unexpected: never = name;
      return unexpected;
    }
  }
}

/** Pause cuts off a word that has already started. */
export function stopSounds(): void {
  for (const player of players.values()) {
    try {
      player.pause();
    } catch {
      // Stopping is best-effort if a player was never started.
    }
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
    const kind = hapticKind(name);
    if (kind === 'warning') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (kind === 'light') {
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
