/**
 * What the Apple TV timer shows while it tries to reach a watch.
 * DeviceDiscoveryUI only runs on Apple TV 4K with tvOS 16 or later.
 * Apple TV HD (including A1625) makes `isSupported` return false.
 */

export const WATCH_LINK_PHASES = [
  'idle',
  'looking',
  'connected',
  'unsupported',
  'picker-unavailable',
  'unavailable',
  'cancelled',
  'disconnected',
] as const;

export type WatchLinkPhase = (typeof WATCH_LINK_PHASES)[number];

export function watchLinkPhaseFromEvent(event: string): WatchLinkPhase | null {
  switch (event) {
    case 'connected':
    case 'unsupported':
    case 'picker-unavailable':
    case 'unavailable':
    case 'cancelled':
    case 'disconnected':
      return event;
    case 'stopped':
      return 'idle';
    default:
      return null;
  }
}

export function watchLinkMessage(phase: WatchLinkPhase): string | null {
  switch (phase) {
    case 'idle':
      return null;
    case 'looking':
      return 'Looking for Apple Watch…';
    case 'connected':
      return 'Watch connected';
    case 'unsupported':
      return 'Apple Watch control needs an Apple TV 4K';
    case 'picker-unavailable':
    case 'unavailable':
      return "Couldn't open the watch picker";
    case 'cancelled':
      return 'Pairing cancelled';
    case 'disconnected':
      return 'Watch disconnected';
    default: {
      const unexpected: never = phase;
      return unexpected;
    }
  }
}

/** Hide Watch after the TV reports that pairing is impossible on this hardware. */
export function watchButtonVisible(phase: WatchLinkPhase): boolean {
  return phase !== 'unsupported';
}

export function watchLinkTone(phase: WatchLinkPhase): 'alert' | 'neutral' {
  switch (phase) {
    case 'unsupported':
    case 'picker-unavailable':
    case 'unavailable':
    case 'cancelled':
    case 'disconnected':
      return 'alert';
    case 'idle':
    case 'looking':
    case 'connected':
      return 'neutral';
    default: {
      const unexpected: never = phase;
      return unexpected;
    }
  }
}

/**
 * `presentPicker` resolves false when the picker never appeared.
 * A link event that already explained why wins over that boolean.
 */
export function watchLinkAfterPickerResult(phase: WatchLinkPhase, opened: boolean): WatchLinkPhase {
  if (opened) return phase === 'idle' ? 'looking' : phase;
  if (phase === 'looking' || phase === 'idle') return 'unsupported';
  return phase;
}

export function logWatchLink(phase: WatchLinkPhase, detail?: string): void {
  const extra = detail ? ` ${detail}` : '';
  console.log(`[AmericanaWatchLink] ${phase}${extra}`);
}
