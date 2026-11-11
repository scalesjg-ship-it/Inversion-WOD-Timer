import { useEffect, useRef } from 'react';
import { useTVEventHandler } from 'react-native';

import { mapRemoteEvent, shouldHandleKeyAction, type RemoteCommand, type RemoteContext } from './remoteMap';

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

  useTVEventHandler((event) => {
    if (!shouldHandleKeyAction(event.eventKeyAction as number | string | undefined)) return;
    const command = mapRemoteEvent(event.eventType, contextRef.current);
    if (command.type === 'ignore') return;
    onCommandRef.current(command);
  });
}
