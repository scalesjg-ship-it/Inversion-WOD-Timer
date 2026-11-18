import type { Phase, TimerMode } from '@/src/timer/types';

export type TransportRole = 'primary' | 'stop' | 'reset';

export interface TransportButton {
  role: TransportRole;
  label: string;
  testID: string;
  variant: 'solid' | 'ghost';
}

export type BackStep = 'pause' | 'exit' | 'dismiss';

export type RunningFocus = 'back' | TransportRole;

export type FocusDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Buttons on the TV clock. Pause/Resume is first so focus can start there.
 * For Time keeps Stop while the work interval is paused, so the row does not
 * unmount under the focused control.
 */
export function tvTransportButtons(input: {
  phase: Phase;
  running: boolean;
  paused: boolean;
  mode: TimerMode;
}): TransportButton[] {
  const buttons: TransportButton[] = [];
  if (input.phase === 'idle') {
    buttons.push({ role: 'primary', label: 'Start', testID: 'timer-start', variant: 'solid' });
  } else if (input.phase === 'finished') {
    buttons.push({ role: 'primary', label: 'Go again', testID: 'timer-start', variant: 'solid' });
  } else if (input.running) {
    buttons.push({ role: 'primary', label: 'Pause', testID: 'timer-pause', variant: 'solid' });
  } else {
    buttons.push({ role: 'primary', label: 'Resume', testID: 'timer-pause', variant: 'solid' });
  }

  if (input.mode === 'forTime' && input.phase === 'work' && (input.running || input.paused)) {
    buttons.push({ role: 'stop', label: 'Stop', testID: 'timer-stop', variant: 'ghost' });
  }
  if (input.phase !== 'idle') {
    buttons.push({ role: 'reset', label: 'Reset', testID: 'timer-reset', variant: 'ghost' });
  }
  return buttons;
}

/** The control the remote should land on when the clock appears. Never Back. */
export function preferredTransportRole(buttons: TransportButton[]): TransportRole {
  return buttons[0].role;
}

/**
 * Back or Menu pauses a running clock and stays on the screen.
 * The next Back, once the clock is stopped, leaves. A reset question closes first.
 */
export function backStep(input: { running: boolean; confirming: boolean }): BackStep {
  if (input.confirming) return 'dismiss';
  if (input.running) return 'pause';
  return 'exit';
}

/** Neighbor in the bottom row. The ends stay put. */
export function transportNeighbor(roles: TransportRole[], role: TransportRole, direction: -1 | 1): TransportRole {
  const index = roles.indexOf(role);
  if (index < 0) return role;
  const next = index + direction;
  if (next < 0 || next >= roles.length) return role;
  return roles[next];
}

/**
 * Focus on the running clock. Back is above the row. Down from Back lands on
 * Pause/Resume. Left and Right move along the row and stop at the ends.
 */
export function nextRunningFocus(
  current: RunningFocus,
  direction: FocusDirection,
  roles: TransportRole[],
): RunningFocus {
  if (roles.length === 0) return 'back';
  if (current === 'back') {
    switch (direction) {
      case 'down':
        return roles[0];
      case 'up':
      case 'left':
      case 'right':
        return 'back';
      default: {
        const unexpected: never = direction;
        return unexpected;
      }
    }
  }
  switch (direction) {
    case 'left':
      return transportNeighbor(roles, current, -1);
    case 'right':
      return transportNeighbor(roles, current, 1);
    case 'up':
      return 'back';
    case 'down':
      return current;
    default: {
      const unexpected: never = direction;
      return unexpected;
    }
  }
}

/** Confirm dialogs stack the safe action above the one that leaves or resets. */
export function nextDialogFocus(
  current: 'safe' | 'destructive',
  direction: FocusDirection,
): 'safe' | 'destructive' {
  if (direction === 'down' && current === 'safe') return 'destructive';
  if (direction === 'up' && current === 'destructive') return 'safe';
  return current;
}
