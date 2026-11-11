export const COUNTDOWN_MAX_SECONDS = 23 * 3600 + 59 * 60 + 59;

export const WARNING_MARK_CHOICES = [
  { id: '60', label: '1:00', seconds: 60 },
  { id: '30', label: '0:30', seconds: 30 },
  { id: '10', label: '0:10', seconds: 10 },
] as const;

export const FINAL_BEEP_SECONDS = [3, 2, 1] as const;

export function addCountdownSeconds(total: number, delta: number): number {
  const base = Number.isFinite(total) ? total : 0;
  const next = Math.round(base + delta);
  return Math.min(COUNTDOWN_MAX_SECONDS, Math.max(1, next));
}

export function splitDuration(total: number): { hours: number; minutes: number; seconds: number } {
  const safe = Math.max(0, Math.round(Number.isFinite(total) ? total : 0));
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor((safe % 3600) / 60),
    seconds: safe % 60,
  };
}

export function joinDuration(hours: number, minutes: number, seconds: number): number {
  const h = Number.isFinite(hours) ? hours : 0;
  const m = Number.isFinite(minutes) ? minutes : 0;
  const s = Number.isFinite(seconds) ? seconds : 0;
  return addCountdownSeconds(h * 3600 + m * 60 + s, 0);
}

export function sanitizeWarningMarks(marks: number[] | undefined, workSeconds: number): number[] {
  const unique = new Set<number>();
  for (const mark of marks ?? []) {
    if (!Number.isFinite(mark)) continue;
    const seconds = Math.round(mark);
    if (seconds > 0 && seconds < workSeconds) unique.add(seconds);
  }
  return [...unique].sort((left, right) => right - left);
}

export function withFinalBeeps(marks: number[], enabled: boolean, workSeconds: number): number[] {
  const without = marks.filter((mark) => !FINAL_BEEP_SECONDS.includes(mark as 1 | 2 | 3));
  const next = enabled ? [...without, ...FINAL_BEEP_SECONDS] : without;
  return sanitizeWarningMarks(next, workSeconds);
}

export function finalBeepsEnabled(marks: number[]): boolean {
  return FINAL_BEEP_SECONDS.every((seconds) => marks.includes(seconds));
}
