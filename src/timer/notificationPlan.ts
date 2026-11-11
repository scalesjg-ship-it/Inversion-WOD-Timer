import { cueTimeline, elapsedMs, soundsForCues } from './engine';
import type { Cue, EngineState, SoundName, TimerConfig } from './types';

export interface NotificationPlanItem {
  atElapsedMs: number;
  title: string;
  body: string;
  sound: SoundName;
}

export interface ScheduledNotification {
  fireAtMs: number;
  item: NotificationPlanItem;
}

interface CueGroup {
  atElapsedMs: number;
  cues: Cue[];
}

function groupCues(state: EngineState): CueGroup[] {
  const groups: CueGroup[] = [];
  for (const timed of cueTimeline(state)) {
    const last = groups[groups.length - 1];
    if (last && last.atElapsedMs === timed.atElapsedMs) {
      last.cues.push(timed.cue);
    } else {
      groups.push({ atElapsedMs: timed.atElapsedMs, cues: [timed.cue] });
    }
  }
  return groups;
}

function primarySound(sounds: SoundName[]): SoundName {
  if (sounds.includes('bell')) return 'bell';
  if (sounds.includes('start')) return 'start';
  if (sounds.includes('warning')) return 'warning';
  return 'tick';
}

function titleFor(sound: SoundName, cues: Cue[], config: TimerConfig): string {
  if (cues.some((cue) => cue.type === 'finished')) return 'Done';
  switch (sound) {
    case 'tick':
      return cues.some((cue) => cue.type === 'phase' && cue.phase === 'leadIn')
        ? 'Get ready'
        : 'Countdown';
    case 'warning':
      return `${config.warningSeconds}s warning`;
    case 'start':
      return 'Go';
    case 'bell':
      return 'Round over';
    default: {
      const exhaustive: never = sound;
      return exhaustive;
    }
  }
}

export function notificationPlan(state: EngineState, gymName: string): NotificationPlanItem[] {
  const items: NotificationPlanItem[] = [];
  for (const group of groupCues(state)) {
    const sounds = soundsForCues(group.cues);
    if (sounds.length === 0) continue;
    const sound = primarySound(sounds);
    items.push({
      atElapsedMs: group.atElapsedMs,
      title: titleFor(sound, group.cues, state.config),
      body: gymName,
      sound,
    });
  }
  return items;
}

/** Upcoming cues only, capped for the platform pending-notification limit. */
export function selectUpcoming(
  plan: NotificationPlanItem[],
  state: EngineState,
  nowMs: number,
  limit: number,
): ScheduledNotification[] {
  if (state.status !== 'running') return [];
  const elapsed = elapsedMs(state, nowMs);
  const upcoming: ScheduledNotification[] = [];
  for (const item of plan) {
    if (item.atElapsedMs <= elapsed + 400) continue;
    upcoming.push({
      fireAtMs: nowMs + (item.atElapsedMs - elapsed),
      item,
    });
    if (upcoming.length >= limit) break;
  }
  return upcoming;
}
