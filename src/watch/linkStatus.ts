/**
 * What the Apple TV timer shows while it tries to reach a watch.
 * DeviceDiscoveryUI is the preferred path on Apple TV 4K (tvOS 16+).
 * Apple TV HD, where that picker is unavailable, pairs with a 6-digit code
 * over the internet relay. The same code is the fallback on Apple TV 4K.
 */

export const WATCH_LINK_PHASES = [
  'idle',
  'looking',
  'connected',
  'pairing',
  'reconnecting',
  'picker-unavailable',
  'unavailable',
  'cancelled',
  'disconnected',
] as const;

export type WatchLinkPhase = (typeof WATCH_LINK_PHASES)[number];

export function watchLinkPhaseFromEvent(event: string): WatchLinkPhase | null {
  switch (event) {
    case 'connected':
    case 'pairing':
    case 'reconnecting':
    case 'picker-unavailable':
    case 'unavailable':
    case 'cancelled':
    case 'disconnected':
      return event;
    case 'unsupported':
      return 'pairing';
    case 'stopped':
      return 'idle';
    default:
      return null;
  }
}

export function watchLinkMessage(phase: WatchLinkPhase, configured = true): string | null {
  switch (phase) {
    case 'idle':
      return null;
    case 'looking':
      return 'Looking for Apple Watch…';
    case 'connected':
      return 'Watch connected';
    case 'pairing':
      return configured
        ? 'Enter this code on your Apple Watch. Both need internet.'
        : 'Enter this code on your Apple Watch. Both need internet. Pairing keys are not on this TV yet.';
    case 'reconnecting':
      return 'Reconnecting to Apple Watch…';
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

/** The Watch button stays available. HD uses it to show the pairing code. */
export function watchButtonVisible(phase: WatchLinkPhase): boolean {
  switch (phase) {
    case 'idle':
    case 'looking':
    case 'connected':
    case 'pairing':
    case 'reconnecting':
    case 'picker-unavailable':
    case 'unavailable':
    case 'cancelled':
    case 'disconnected':
      return true;
    default: {
      const unexpected: never = phase;
      return unexpected;
    }
  }
}

/**
 * "Pair with code" is the Apple TV 4K fallback after the system picker.
 * The code itself replaces that button while a handshake is on screen.
 */
export function watchPairOfferVisible(phase: WatchLinkPhase, relayPaired: boolean): boolean {
  if (relayPaired) return false;
  switch (phase) {
    case 'looking':
    case 'cancelled':
    case 'disconnected':
    case 'picker-unavailable':
    case 'unavailable':
      return true;
    case 'idle':
    case 'connected':
    case 'pairing':
    case 'reconnecting':
      return false;
    default: {
      const unexpected: never = phase;
      return unexpected;
    }
  }
}

export function watchUnpairVisible(relayPaired: boolean): boolean {
  return relayPaired;
}

export function watchLinkTone(phase: WatchLinkPhase): 'alert' | 'neutral' {
  switch (phase) {
    case 'picker-unavailable':
    case 'unavailable':
    case 'cancelled':
    case 'disconnected':
      return 'alert';
    case 'idle':
    case 'looking':
    case 'connected':
    case 'pairing':
    case 'reconnecting':
      return 'neutral';
    default: {
      const unexpected: never = phase;
      return unexpected;
    }
  }
}

/**
 * `presentPicker` resolves false when DeviceDiscoveryUI cannot run.
 * That is the code-pairing path, including Apple TV HD.
 */
export function watchLinkAfterPickerResult(phase: WatchLinkPhase, opened: boolean): WatchLinkPhase {
  if (opened) return phase === 'idle' ? 'looking' : phase;
  if (phase === 'looking' || phase === 'idle') return 'pairing';
  return phase;
}

export function displayedWatchPhase(
  direct: WatchLinkPhase,
  relay: { phase: 'off' | 'pairing' | 'joining' | 'connected' | 'reconnecting' | 'unconfigured'; code: string | null },
): WatchLinkPhase {
  if (relay.code && (relay.phase === 'pairing' || relay.phase === 'unconfigured')) return 'pairing';
  if (relay.phase === 'connected' || direct === 'connected') return 'connected';
  if (relay.phase === 'joining' || relay.phase === 'reconnecting') return 'reconnecting';
  if (direct === 'pairing') return 'pairing';
  return direct;
}

export function logWatchLink(phase: WatchLinkPhase, detail?: string): void {
  const extra = detail ? ` ${detail}` : '';
  console.log(`[AmericanaWatchLink] ${phase}${extra}`);
}
