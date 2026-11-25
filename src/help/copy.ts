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
  intervals: 'Work, rest, and rounds. Tabata is 20 seconds on and 10 seconds off for eight rounds. BJJ, boxing, MMA, and Muay Thai are one tap.',
  countdown: 'Any length, with warning beeps. Save it with your other presets.',
};

const MODE_ORDER: TimerMode[] = ['forTime', 'amrap', 'emom', 'intervals', 'countdown'];

function watchBlock(platform: HelpPlatform): HelpBlock {
  switch (platform) {
    case 'appletv':
      return {
        id: 'help-watch',
        title: 'Apple Watch',
        body: 'On an Apple TV 4K with tvOS 16 or later, the watch and this Apple TV use the same Wi-Fi and the same iCloud account, or a Family Sharing account. Open the Americana watch app. On the Apple TV, open Settings and choose Watch. Apple TV HD, and a 4K that cannot use that direct link, pairs with a 6-digit code instead. The TV shows the code, you enter it once on the watch, and both need internet. After that they reconnect on their own. The watch can start, pause, resume, and reset. It taps your wrist when the round or phase changes, and when the timer finishes. Unpair watch in Settings, or Forget TV on the watch, ends that pairing. The messages are not stored on a server.',
      };
    case 'phone':
      return {
        id: 'help-watch',
        title: 'Apple Watch',
        body: 'The watch controls the Apple TV app. An Apple TV 4K on tvOS 16 or later can pair on the same Wi-Fi with the same iCloud account, or Family Sharing. Apple TV HD pairs with a 6-digit code: the TV shows it, you enter it on the watch, and both need internet. Open the Americana watch app, then on the Apple TV open Settings and choose Watch. The watch can start, pause, resume, and reset, and it taps your wrist when the round or phase changes. Forget TV on the watch, or Unpair watch in Settings, ends a code pairing. Those messages are not stored on a server.',
      };
    case 'androidtv':
      return {
        id: 'help-watch',
        title: 'Apple Watch',
        body: 'Apple Watch control works with the Apple TV app (Apple TV 4K or Apple TV HD), not with this TV.',
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
        body: 'Select pauses or resumes. Back on a running timer pauses it and stays. Back again leaves. If Select already paused the timer, the first Back stays and the next Back leaves. Play/Pause also toggles the clock. Finish ends a For Time workout. Reset asks "Are you sure?" before it returns to the start, and Back closes that question.',
      };
    case 'phone':
      return {
        id: 'help-remote',
        title: 'Timer controls',
        body: 'Tap the clock to pause or resume. Finish ends a For Time workout. Reset asks "Are you sure?" before it returns to the start. Back leaves the timer.',
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
        body: 'On the Settings tab, open More and scan the QR code with your phone camera. The phone and this TV need the same Wi-Fi. The photo is saved on this TV and is not sent to a server.',
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

function soundBlock(platform: HelpPlatform): HelpBlock {
  const where = platform === 'phone' ? 'On the Brand tab, Voice countdown' : 'On the Settings tab, open Sound. Voice countdown';
  return {
    id: 'help-sound',
    title: 'Voice countdown',
    body: `${where} says three, two, and one before a round, a rest, or get ready ends. It stays off until you turn it on. The beep at zero still plays. A phone that is locked keeps the beeps for those three seconds. The Apple Watch still taps and does not speak.`,
  };
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
  return [watchBlock(platform), remoteBlock(platform), logoBlock(platform), presetBlock(), soundBlock(platform), ...modes];
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
