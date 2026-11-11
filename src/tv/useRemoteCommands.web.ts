import { useEffect, useRef } from 'react';

import { mapRemoteEvent, type RemoteCommand, type RemoteContext } from './remoteMap';

function eventTypeFromKey(key: string): string | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'Enter':
    case ' ':
      return 'select';
    case 'MediaPlayPause':
    case 'k':
      return 'playPause';
    case 'Escape':
      return 'menu';
    case 'Backspace':
      return 'back';
    case 'r':
      return 'longSelect';
    default:
      return null;
  }
}

/** Web stand-in for the TV remote so the same mapping can be tried from a keyboard. */
export function useRemoteCommands(
  context: RemoteContext,
  onCommand: (command: RemoteCommand) => void,
): void {
  const contextRef = useRef(context);
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      const eventType = eventTypeFromKey(event.key);
      if (!eventType) return;
      const command = mapRemoteEvent(eventType, contextRef.current);
      if (command.type === 'ignore') return;
      event.preventDefault();
      onCommandRef.current(command);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
