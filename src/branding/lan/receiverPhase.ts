export type ReceiverPhase =
  | { kind: 'starting' }
  | { kind: 'ready'; url: string; saved: boolean }
  | { kind: 'expired' }
  | { kind: 'error'; message: string };
