import { useEffect, useRef } from 'react';
import { useTVEventHandler } from 'react-native';

import { acceptRemotePress } from './keyAction';
import { mapRemoteEvent, type RemoteCommand, type RemoteContext } from './remoteMap';

export function useRemoteCommands(
  context: RemoteContext,
  onCommand: (command: RemoteCommand) => void,
): void {
  const contextRef = useRef(context);
  const onCommandRef = useRef(onCommand);
  const pendingDown = useRef(new Set<string>());

  useEffect(() => {
    contextRef.current = context;
  }, [context]);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useTVEventHandler((event) => {
    const decision = acceptRemotePress(
      event.eventType,
      event.eventKeyAction as number | string | undefined,
      pendingDown.current,
    );
    pendingDown.current = decision.pendingDown;
    if (!decision.accept) return;
    const command = mapRemoteEvent(event.eventType, contextRef.current);
    if (command.type === 'ignore') return;
    onCommandRef.current(command);
  });
}
