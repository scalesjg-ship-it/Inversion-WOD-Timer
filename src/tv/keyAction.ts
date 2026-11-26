export type KeyPhase = 'down' | 'up' | 'press';

/** 0 is key-down, 1 is key-up. tvOS often omits the action; that is one complete press. */
export function keyPhase(eventKeyAction: number | string | undefined): KeyPhase {
  if (eventKeyAction === 0 || eventKeyAction === '0') return 'down';
  if (eventKeyAction === 1 || eventKeyAction === '1') return 'up';
  return 'press';
}

/**
 * Act once per press.
 *
 * A tvOS tap recognizer reports the click as key-up (`UIGestureRecognizerStateEnded`).
 * Android TV and Fire TV send only `ACTION_UP` unless key-down events are turned on
 * (`ReactFeatureFlags.enableKeyDownEvents` defaults to false). Dropping every key-up
 * therefore drops play/pause, menu, and the D-pad commands on every TV.
 *
 * When a key-down for the same event was already handled, the following key-up is the
 * pair and must not run the command again.
 */
export function acceptRemotePress(
  eventType: string,
  eventKeyAction: number | string | undefined,
  pendingDown: ReadonlySet<string>,
): { accept: boolean; pendingDown: Set<string> } {
  const phase = keyPhase(eventKeyAction);
  const next = new Set(pendingDown);
  switch (phase) {
    case 'down':
      next.add(eventType);
      return { accept: true, pendingDown: next };
    case 'up':
      if (next.delete(eventType)) return { accept: false, pendingDown: next };
      return { accept: true, pendingDown: next };
    case 'press':
      return { accept: true, pendingDown: next };
    default: {
      const unexpected: never = phase;
      return unexpected;
    }
  }
}
