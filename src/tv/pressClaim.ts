export const DUPLICATE_PRESS_MS = 500;

export interface PressClaim {
  kind: string;
  at: number;
}

/**
 * One physical remote press reaches the app twice on Apple TV, Fire TV, and
 * Android TV: the focused control's onPress, and the TV key event. The second
 * delivery of the same kind inside the window is the duplicate and must not run.
 * Play/Pause is a different kind, so it is not swallowed by Select.
 */
export function claimPress(
  kind: string,
  now: number,
  previous: PressClaim | null,
  windowMs = DUPLICATE_PRESS_MS,
): { accept: boolean; claim: PressClaim } {
  if (previous && previous.kind === kind && now - previous.at >= 0 && now - previous.at < windowMs) {
    return { accept: false, claim: previous };
  }
  return { accept: true, claim: { kind, at: now } };
}
