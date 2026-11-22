export function clockStatusHint(tv: boolean, kind: 'running' | 'paused'): string {
  switch (kind) {
    case 'running':
      return tv ? 'Back pauses. Play/pause toggles.' : 'Tap the clock to pause';
    case 'paused':
      return tv ? 'Paused · select Resume. Back again leaves' : 'Paused · tap to resume';
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}
