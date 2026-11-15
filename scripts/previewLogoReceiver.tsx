import type { Branding } from '../src/branding/types';
import type { ReceiverPhase } from '../src/branding/lan/receiverPhase';

const TOKEN = 'ab'.repeat(16);

/** Screenshot stand-in for the TV listener. The pairing URL is the one the QR must show. */
export function useLogoReceiver(
  _branding: Branding,
  _update: (patch: Partial<Branding>) => Promise<void>,
): { phase: ReceiverPhase; restart: () => void } {
  return {
    phase: {
      kind: 'ready',
      url: `http://192.168.1.42:8741/?t=${TOKEN}`,
      saved: false,
    },
    restart: () => undefined,
  };
}
