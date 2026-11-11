export function formatSeconds(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/** Countdown clocks hold the current second until it has fully elapsed. */
export function formatCountdown(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  const totalSeconds = safe === 0 ? 0 : Math.ceil(safe / 1000);
  return formatSeconds(totalSeconds);
}

export function formatCountUp(ms: number): string {
  const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  return formatSeconds(Math.floor(safe / 1000));
}
