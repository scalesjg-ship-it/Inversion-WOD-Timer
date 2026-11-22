import type { TimerMode } from '@/src/timer/types';

export type RemoteCommand =
  | { type: 'toggle' }
  | { type: 'confirmReset' }
  | { type: 'dismissConfirm' }
  | { type: 'seek'; seconds: number }
  | { type: 'stepRound'; direction: -1 | 1 }
  | { type: 'showControls' }
  | { type: 'hideControls' }
  | { type: 'pause'; focusResume: boolean }
  | { type: 'menu' }
  | { type: 'exit' }
  | { type: 'ignore' };

export interface RemoteContext {
  mode: TimerMode;
  controlsVisible: boolean;
  confirmOpen: boolean;
  /**
   * Television keeps Pause and Finish mounted. Down must not unmount them.
   * A phone or a browser preview still hides the row.
   */
  stableControls: boolean;
  /** The clock is running. Select and Back pause it instead of leaving. */
  running: boolean;
}

const ROUND_STEP_MODES = new Set<TimerMode>(['intervals']);

function nudge(mode: TimerMode, direction: -1 | 1): RemoteCommand {
  if (ROUND_STEP_MODES.has(mode)) return { type: 'stepRound', direction };
  return { type: 'seek', seconds: direction * 10 };
}

/**
 * Map one remote event to a timer command.
 * D-pad and select cover every action, so a remote without media keys still works.
 * Home and microphone are not mapped: the TV keeps those.
 */
export function mapRemoteEvent(eventType: string, context: RemoteContext): RemoteCommand {
  if (context.confirmOpen) {
    if (eventType === 'back' || eventType === 'menu') return { type: 'dismissConfirm' };
    return { type: 'ignore' };
  }

  switch (eventType) {
    case 'select':
      // A visible row handles Select on the focused button. Mapping it to
      // Pause swallowed Reset and Finish, so those needed a second press.
      if (context.controlsVisible) return { type: 'ignore' };
      if (context.running) return { type: 'pause', focusResume: true };
      return { type: 'toggle' };
    case 'playPause':
    case 'play':
    case 'pause':
      return { type: 'toggle' };
    case 'longSelect':
      return { type: 'confirmReset' };
    case 'left':
    case 'swipeLeft':
    case 'rewind':
      return context.controlsVisible ? { type: 'ignore' } : nudge(context.mode, -1);
    case 'right':
    case 'swipeRight':
    case 'fastForward':
      return context.controlsVisible ? { type: 'ignore' } : nudge(context.mode, 1);
    case 'up':
    case 'swipeUp':
      return context.controlsVisible ? { type: 'ignore' } : { type: 'showControls' };
    case 'down':
    case 'swipeDown':
      if (context.stableControls) return { type: 'ignore' };
      return context.controlsVisible ? { type: 'hideControls' } : { type: 'ignore' };
    case 'back':
    case 'menu':
      // Television decides from the live clock. A phone preview still leaves once stopped.
      if (context.stableControls) return { type: 'menu' };
      return context.running ? { type: 'pause', focusResume: true } : { type: 'exit' };
    default:
      return { type: 'ignore' };
  }
}
