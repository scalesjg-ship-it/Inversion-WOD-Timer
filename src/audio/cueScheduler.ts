import {
  AndroidImportance,
  AndroidNotificationVisibility,
  SchedulableTriggerInputTypes,
  cancelAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
} from 'expo-notifications';
import { AppState, Platform } from 'react-native';

import { notificationPlan, selectUpcoming } from '@/src/timer/notificationPlan';
import type { EngineState, SoundName } from '@/src/timer/types';

const SOUND_FILE: Record<SoundName, string> = {
  tick: 'tick.wav',
  warning: 'warning.wav',
  start: 'start.wav',
  bell: 'bell.wav',
};

const PENDING_LIMIT = 60;

let generation = 0;
let ready = false;

function channelId(sound: SoundName): string {
  return `americana-${sound}`;
}

async function ensureNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (!ready) {
    setNotificationHandler({
      handleNotification: async () => {
        const foreground = AppState.currentState === 'active';
        return {
          shouldPlaySound: !foreground,
          shouldSetBadge: false,
          shouldShowBanner: !foreground,
          shouldShowList: !foreground,
        };
      },
    });
    await Promise.all(
      (Object.keys(SOUND_FILE) as SoundName[]).map((sound) =>
        setNotificationChannelAsync(channelId(sound), {
          name: `Americana ${sound}`,
          importance: AndroidImportance.MAX,
          sound: SOUND_FILE[sound],
          vibrationPattern: [0, 180, 80, 180],
          lockscreenVisibility: AndroidNotificationVisibility.PUBLIC,
        }),
      ),
    );
    ready = true;
  }

  const current = await getPermissionsAsync();
  if (current.status === 'granted') return true;
  if (current.status === 'denied') return false;
  const requested = await requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function clearScheduledCues(): Promise<void> {
  generation += 1;
  if (Platform.OS === 'web') return;
  try {
    await cancelAllScheduledNotificationsAsync();
  } catch {
    // Cancelling is best-effort if notifications were never authorized.
  }
}

export async function syncScheduledCues(
  state: EngineState,
  nowMs: number,
  gymName: string,
): Promise<void> {
  if (state.status !== 'running') {
    await clearScheduledCues();
    return;
  }
  const ticket = generation + 1;
  generation = ticket;

  try {
    const allowed = await ensureNotifications();
    if (!allowed || ticket !== generation) return;
    await cancelAllScheduledNotificationsAsync();
    if (ticket !== generation) return;
    const plan = selectUpcoming(notificationPlan(state, gymName), state, nowMs, PENDING_LIMIT);
    for (const entry of plan) {
      if (ticket !== generation) return;
      await scheduleNotificationAsync({
        content: {
          title: entry.item.title,
          body: entry.item.body,
          sound: SOUND_FILE[entry.item.sound],
          interruptionLevel: 'active',
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: new Date(entry.fireAtMs),
          channelId: channelId(entry.item.sound),
          delivery: 'alarmClock',
        },
      });
    }
  } catch {
    // Locked-screen bells require a dev or production build and notification permission.
  }
}
