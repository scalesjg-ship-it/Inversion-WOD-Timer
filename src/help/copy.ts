import { modeTitle } from '../timer/labels';
import type { TimerMode } from '../timer/types';

/**
 * Help copy. The remote sentences follow `backStep` in src/tv/timerTransport.ts:
 * Back on a running clock pauses and stays. Back on a clock that is already
 * paused stays once, and the next Back leaves. Select pauses or resumes.
 */

export type HelpPlatform = 'appletv' | 'androidtv' | 'phone';

export interface HelpBlock {
  id: string;
  title: string;
  body: string;
}

export function helpPlatform(input: { os: string; tv: boolean }): HelpPlatform {
  if (input.tv && input.os === 'ios') return 'appletv';
  if (input.tv) return 'androidtv';
  return 'phone';
}

/** One line per timer mode. Adding a mode fails the build until this record grows. */
export const HELP_MODE_LINES: Record<TimerMode, string> = {
  forTime: 'Count up until you finish. Add a cap when the workout has one.',
  amrap: 'Countdown. As many reps or rounds as possible.',
  emom: 'Every X minutes. The clock resets when the interval does.',
  tabata: '20 seconds on, 10 seconds off, eight rounds.',
  intervals: 'Your own work, rest, and number of rounds.',
  rounds: 'Work and rest rounds. BJJ, boxing, MMA, and Muay Thai start on the Rounds tab.',
  countdown: 'Any length, with warning beeps. Save it with your other presets.',
};

const MODE_ORDER: TimerMode[] = ['forTime', 'amrap', 'emom', 'tabata', 'intervals', 'rounds', 'countdown'];

function watchBlock(platform: HelpPlatform): HelpBlock {
  switch (platform) {
    case 'appletv':
      return {
        id: 'help-watch',
        title: 'Apple Watch',
        body: 'Needs an Apple TV 4K, not an Apple TV HD, on tvOS 16 or later. The watch and this Apple TV use the same Wi-Fi and the same iCloud account, or a Family Sharing account. Open the Americana watch app first, then press Watch on the timer and pick your watch. The watch can start, pause, resume, and reset. It taps your wrist when the round or phase changes, and when the timer finishes.',
      };
    case 'phone':
      return {
        id: 'help-watch',
        title: 'Apple Watch',
        body: 'The watch controls the Apple TV app, and only an Apple TV 4K on tvOS 16 or later. Apple TV HD cannot pair. Use the same Wi-Fi and the same iCloud account, or Family Sharing. Open the Americana watch app, then on the Apple TV timer press Watch and pick your watch. The watch can start, pause, resume, and reset, and it taps your wrist when the round or phase changes.',
      };
    case 'androidtv':
      return {
        id: 'help-watch',
        title: 'Apple Watch',
        body: 'Apple Watch control works with the Apple TV 4K app only, not with this TV.',
      };
    default: {
      const unexpected: never = platform;
      return unexpected;
    }
  }
}

function remoteBlock(platform: HelpPlatform): HelpBlock {
  switch (platform) {
    case 'appletv':
    case 'androidtv':
      return {
        id: 'help-remote',
        title: 'Remote',
        body: 'Select pauses or resumes. Back on a running timer pauses it and stays. Back again leaves. If Select already paused the timer, the first Back stays and the next Back leaves. Play/Pause also toggles the clock.',
      };
    case 'phone':
      return {
        id: 'help-remote',
        title: 'Timer controls',
        body: 'Tap the clock to pause or resume. Stop ends a For Time workout. Reset returns to the start. Back leaves the timer.',
      };
    default: {
      const unexpected: never = platform;
      return unexpected;
    }
  }
}

function logoBlock(platform: HelpPlatform): HelpBlock {
  switch (platform) {
    case 'appletv':
    case 'androidtv':
      return {
        id: 'help-logo',
        title: 'Gym logo',
        body: 'On the Brand tab, scan the QR code with your phone camera. The phone and this TV need the same Wi-Fi. The photo is saved on this TV and is not sent to a server.',
      };
    case 'phone':
      return {
        id: 'help-logo',
        title: 'Gym logo',
        body: 'On the Brand tab, use Photo library or Files. The logo stays on this phone. To send one to the gym TV, open Brand on the TV and scan its QR code while the phone is on the same Wi-Fi.',
      };
    default: {
      const unexpected: never = platform;
      return unexpected;
    }
  }
}

function presetBlock(): HelpBlock {
  return {
    id: 'help-presets',
    title: 'Presets',
    body: 'On a timer setup, Save preset stores the current setup under a name. Select a saved name to load it. Update replaces that preset with the setup on screen. Rename changes the name. Delete asks you to confirm, then removes it from this device. Two presets for the same timer cannot share a name.',
  };
}

export function helpSections(platform: HelpPlatform): HelpBlock[] {
  const modes = MODE_ORDER.map((mode) => ({
    id: `help-mode-${mode}`,
    title: modeTitle(mode),
    body: HELP_MODE_LINES[mode],
  }));
  return [watchBlock(platform), remoteBlock(platform), logoBlock(platform), presetBlock(), ...modes];
}

export function helpVersionLine(version: string | null | undefined, build: string | null | undefined): string {
  const versionText = (version ?? '').trim() || '1.0.0';
  const buildText = (build ?? '').trim();
  return buildText ? `Version ${versionText} (${buildText})` : `Version ${versionText}`;
}

/** Up from the first section returns to the tab bar. Down from the last stays. */
export function helpNeighbors(ids: readonly string[]): { id: string; up: string | null; down: string | null }[] {
  return ids.map((id, index) => ({
    id,
    up: index === 0 ? null : (ids[index - 1] ?? null),
    down: index === ids.length - 1 ? id : (ids[index + 1] ?? id),
  }));
}
