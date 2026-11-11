import type { TimerMode } from '@/src/timer/types';

export type RemoteCommand =
  | { type: 'toggle' }
  | { type: 'confirmReset' }
  | { type: 'dismissConfirm' }
  | { type: 'seek'; seconds: number }
  | { type: 'stepRound'; direction: -1 | 1 }
  | { type: 'showControls' }
  | { type: 'hideControls' }
  | { type: 'exit' }
  | { type: 'ignore' };

export interface RemoteContext {
  mode: TimerMode;
  controlsVisible: boolean;
  confirmOpen: boolean;
}

const ROUND_STEP_MODES = new Set<TimerMode>(['rounds', 'intervals', 'tabata']);

/**
 * Key-up repeats the same event. Act on key-down (0) and on events that do not
 * report an action (-1 or missing), which is how Apple TV often delivers them.
 */
export function shouldHandleKeyAction(eventKeyAction: number | string | undefined): boolean {
  return eventKeyAction !== 1 && eventKeyAction !== '1';
}

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
      return context.controlsVisible ? { type: 'ignore' } : { type: 'toggle' };
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
      return { type: 'showControls' };
    case 'down':
    case 'swipeDown':
      return context.controlsVisible ? { type: 'hideControls' } : { type: 'ignore' };
    case 'back':
    case 'menu':
      return { type: 'exit' };
    default:
      return { type: 'ignore' };
  }
}
