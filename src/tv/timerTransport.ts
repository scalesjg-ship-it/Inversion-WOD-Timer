import type { Phase, TimerMode } from '@/src/timer/types';

export type TransportRole = 'primary' | 'stop' | 'reset';

export interface TransportButton {
  role: TransportRole;
  label: string;
  testID: string;
  variant: 'solid' | 'ghost';
}

export type BackStep = 'pause' | 'stay' | 'exit' | 'dismiss';

export type RunningFocus = 'back' | TransportRole;

export type FocusDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Buttons on the TV clock. Pause/Resume is first so focus can start there.
 * For Time keeps Finish while the work interval is paused, so the row does not
 * unmount under the focused control. Finish ends the workout. It is not a
 * second pause.
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
    buttons.push({ role: 'stop', label: 'Finish', testID: 'timer-finish', variant: 'ghost' });
  }
  if (input.phase !== 'idle') {
    buttons.push({ role: 'reset', label: 'Reset', testID: 'timer-reset', variant: 'ghost' });
  }
  return buttons;
}

export type TransportPress = 'pause' | 'resume' | 'start' | 'finish' | 'ask-reset';

/**
 * One press on a transport button.
 * Pause is only the primary control. Reset always asks first, including while
 * the clock is running, so it does not take a second press. Finish records
 * the For Time result immediately.
 */
export function transportPress(role: TransportRole, input: { running: boolean; phase: Phase }): TransportPress {
  switch (role) {
    case 'primary':
      if (input.running) return 'pause';
      if (input.phase === 'idle' || input.phase === 'finished') return 'start';
      return 'resume';
    case 'stop':
      return 'finish';
    case 'reset':
      return 'ask-reset';
    default: {
      const unexpected: never = role;
      return unexpected;
    }
  }
}

/** The reset question. No is the safe answer and the control the remote lands on. */
export const RESET_CONFIRM = {
  title: 'Are you sure?',
  yes: 'Yes',
  no: 'No',
  initialFocus: 'no',
} as const;

export type ResetConfirmFocus = typeof RESET_CONFIRM.initialFocus | 'yes';

/** No leaves the clock untouched. Yes is the only answer that resets. */
export function resetConfirmResult(answer: ResetConfirmFocus): 'keep' | 'reset' {
  switch (answer) {
    case 'no':
      return 'keep';
    case 'yes':
      return 'reset';
    default: {
      const unexpected: never = answer;
      return unexpected;
    }
  }
}

/** After the question closes, focus returns to Reset. */
export function focusAfterResetPrompt(): TransportRole {
  return 'reset';
}

/** The control the remote should land on when the clock appears. Never Back. */
export function preferredTransportRole(buttons: TransportButton[]): TransportRole {
  return buttons[0].role;
}

/**
 * Apple TV has no on-screen Back. Menu on the Siri Remote is the back button.
 * Phones and Android TV / Fire TV keep the control.
 * `Platform.OS` is `ios` on Apple TV and `android` on Fire TV and Android TV.
 */
export function showsOnScreenBack(tv: boolean, os: string): boolean {
  return !(tv && os === 'ios');
}

/**
 * Android TV still draws Back, but it stays out of the focus order.
 * Select on a focused Back would leave the workout. Hardware Back uses `backStep`.
 */
export function onScreenBackFocusable(tv: boolean): boolean {
  return !tv;
}

/**
 * If Select does reach the on-screen Back control, pause or resume.
 * Leaving is only for a clock that is idle or already finished.
 */
export function onScreenBackPress(input: { tv: boolean; running: boolean; paused: boolean }): 'phone-back' | 'toggle' | 'leave' {
  if (!input.tv) return 'phone-back';
  if (input.running || input.paused) return 'toggle';
  return 'leave';
}

/**
 * Back or Menu pauses a running clock and stays.
 * The same press on a clock that is already paused also stays, and arms the next
 * Back to leave. A reset question closes first. Idle and finished clocks leave.
 */
export function backStep(input: {
  running: boolean;
  paused: boolean;
  confirming: boolean;
  leaveArmed: boolean;
}): BackStep {
  if (input.confirming) return 'dismiss';
  if (input.running) return 'pause';
  if (input.paused && !input.leaveArmed) return 'stay';
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
 * Focus on the running clock. Left and Right move along the row and stop at the ends.
 * When the on-screen Back control exists, it sits above the row and Up lands there.
 * Apple TV does not draw that control, so Up and Down stay on the transport row.
 */
export function nextRunningFocus(
  current: RunningFocus,
  direction: FocusDirection,
  roles: TransportRole[],
  options?: { onScreenBack?: boolean },
): RunningFocus {
  const onScreenBack = options?.onScreenBack !== false;
  if (!onScreenBack) {
    const first = roles[0];
    if (first === undefined) return 'back';
    const role: TransportRole = current === 'back' ? first : current;
    switch (direction) {
      case 'left':
        return transportNeighbor(roles, role, -1);
      case 'right':
        return transportNeighbor(roles, role, 1);
      case 'up':
      case 'down':
        return role;
      default: {
        const unexpected: never = direction;
        return unexpected;
      }
    }
  }
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
