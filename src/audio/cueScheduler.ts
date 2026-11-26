import { AppState, Platform } from 'react-native';

import { CUE_SOUND_FILE, notificationFallbackSound } from './cueFiles';
import { notificationPlan, selectUpcoming } from '@/src/timer/notificationPlan';
import type { CueScheduleOptions, EngineState, SoundName } from '@/src/timer/types';
import { allowsSystemNotifications } from '@/src/tv/controls';

// expo-notifications has no tvOS native module and throws when imported there,
// so it is loaded only after `allowsSystemNotifications` says this device can use it.
type NotificationsModule = typeof import('expo-notifications');

let notificationsModule: Promise<NotificationsModule> | null = null;

function loadNotifications(): Promise<NotificationsModule> {
  notificationsModule ??= import('expo-notifications');
  return notificationsModule;
}

const PENDING_LIMIT = 60;

let generation = 0;
let ready = false;

function channelId(sound: SoundName): string {
  return `americana-${sound}`;
}

async function ensureNotifications(): Promise<NotificationsModule | null> {
  if (!allowsSystemNotifications(Platform.isTV === true, Platform.OS)) return null;
  const notifications = await loadNotifications();
  if (!ready) {
    notifications.setNotificationHandler({
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
    for (const sound of Object.keys(CUE_SOUND_FILE) as SoundName[]) {
      try {
        await notifications.setNotificationChannelAsync(channelId(sound), {
          name: `Anthem Gym Timer ${sound}`,
          importance: notifications.AndroidImportance.MAX,
          sound: CUE_SOUND_FILE[sound],
          vibrationPattern: [0, 180, 80, 180],
          lockscreenVisibility: notifications.AndroidNotificationVisibility.PUBLIC,
        });
      } catch {
        // A voice channel that this binary cannot install must not block the horns.
      }
    }
    ready = true;
  }

  const current = await notifications.getPermissionsAsync();
  if (current.status === 'granted') return notifications;
  if (current.status === 'denied') return null;
  const requested = await notifications.requestPermissionsAsync();
  return requested.status === 'granted' ? notifications : null;
}

export async function clearScheduledCues(): Promise<void> {
  generation += 1;
  if (!allowsSystemNotifications(Platform.isTV === true, Platform.OS)) return;
  try {
    const notifications = await loadNotifications();
    await notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Cancelling is best-effort if notifications were never authorized.
  }
}

async function scheduleOne(
  notifications: NotificationsModule,
  entry: { fireAtMs: number; item: { title: string; body: string; sound: SoundName } },
  sound: SoundName,
): Promise<void> {
  await notifications.scheduleNotificationAsync({
    content: {
      title: entry.item.title,
      body: entry.item.body,
      sound: CUE_SOUND_FILE[sound],
      interruptionLevel: 'active',
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(entry.fireAtMs),
      channelId: channelId(sound),
      delivery: 'alarmClock',
    },
  });
}

export async function syncScheduledCues(
  state: EngineState,
  nowMs: number,
  gymName: string,
  options?: CueScheduleOptions,
): Promise<void> {
  if (state.status !== 'running') {
    await clearScheduledCues();
    return;
  }
  const ticket = generation + 1;
  generation = ticket;

  try {
    const notifications = await ensureNotifications();
    if (!notifications || ticket !== generation) return;
    await notifications.cancelAllScheduledNotificationsAsync();
    if (ticket !== generation) return;
    const plan = selectUpcoming(notificationPlan(state, gymName, options), state, nowMs, PENDING_LIMIT);
    for (const entry of plan) {
      if (ticket !== generation) return;
      try {
        await scheduleOne(notifications, entry, entry.item.sound);
      } catch {
        const fallback = notificationFallbackSound(entry.item.sound);
        if (!fallback || ticket !== generation) continue;
        try {
          await scheduleOne(notifications, entry, fallback);
        } catch {
          // One missing clip should not drop the bells that follow.
        }
      }
    }
  } catch {
    // Locked-screen bells require a dev or production build and notification permission.
  }
}
