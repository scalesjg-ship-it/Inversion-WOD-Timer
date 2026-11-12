export function clockStatusHint(tv: boolean, kind: 'running' | 'paused'): string {
  switch (kind) {
    case 'running':
      return tv ? 'Press select to pause' : 'Tap the clock to pause';
    case 'paused':
      return tv ? 'Paused · press select to resume' : 'Paused · tap to resume';
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}
