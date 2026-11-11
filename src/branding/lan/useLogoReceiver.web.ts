import type { Branding } from '../types';
import type { ReceiverPhase } from './receiverPhase';

/** Web has no TV logo listener. The Brand screen does not mount this on a phone or browser. */
export function useLogoReceiver(
  _branding: Branding,
  _update: (patch: Partial<Branding>) => Promise<void>,
): { phase: ReceiverPhase; restart: () => void } {
  return {
    phase: { kind: 'starting' },
    restart: () => undefined,
  };
}
