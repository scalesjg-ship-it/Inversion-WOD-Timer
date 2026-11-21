export interface SetupFocusChain {
  /** Controls on the last stepper row, left to right. */
  lastRow: readonly string[];
  /** Warning chips or another focusable row between the steppers and presets. */
  bridge: string | null;
  /** Save preset, when that control is on screen. */
  preset: string | null;
  start: string;
}

/**
 * Vertical focus on a television setup screen.
 * Down from every control on the last stepper row lands on the next focusable
 * row (warning chips, then Save preset, otherwise Start).
 * Up from Start returns to the first control of that stepper row.
 */
export function nextSetupVertical(current: string, direction: 'up' | 'down', chain: SetupFocusChain): string {
  const entry = chain.lastRow[0] ?? chain.start;
  const fromLast = chain.bridge ?? chain.preset ?? chain.start;
  const fromBridge = chain.preset ?? chain.start;
  if (chain.lastRow.includes(current)) {
    return direction === 'down' ? fromLast : current;
  }
  if (chain.bridge != null && current === chain.bridge) {
    return direction === 'down' ? fromBridge : entry;
  }
  if (chain.preset != null && current === chain.preset) {
    if (direction === 'down') return chain.start;
    return chain.bridge ?? entry;
  }
  if (current === chain.start) {
    return direction === 'up' ? entry : chain.start;
  }
  return current;
}

/** First mounted target. A missing row is skipped, not focused. */
export function firstFocusTag(tags: readonly (number | null)[]): number | null {
  for (const tag of tags) {
    if (tag != null) return tag;
  }
  return null;
}
