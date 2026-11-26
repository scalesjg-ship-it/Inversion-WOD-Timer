import { requireOptionalNativeModule } from 'expo';

export { watchLinkEnabled } from './gate';

export interface WatchLinkNative {
  start: () => void;
  stop: () => void;
  send: (message: string) => void;
  presentPicker: () => Promise<boolean>;
  addListener: (
    event: 'command' | 'link',
    listener: (payload: { json?: string } | string) => void,
  ) => { remove: () => void };
}

export const WATCH_LINK_MODULE = 'AmericanaWatchLink';

export function watchNative(): WatchLinkNative | null {
  try {
    return requireOptionalNativeModule<WatchLinkNative>(WATCH_LINK_MODULE);
  } catch {
    return null;
  }
}

export function eventJson(payload: { json?: string } | string): string {
  if (typeof payload === 'string') return payload;
  return typeof payload.json === 'string' ? payload.json : '';
}
