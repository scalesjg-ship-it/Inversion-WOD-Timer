import { NativeModules } from 'react-native';

import { encodeHtmlResponse, HttpAccumulator } from './http';
import { messagePage } from './page';
import type { LogoTransferSession } from './session';

export type LanServer = {
  port: number;
  close: () => void;
};

/**
 * Apple TV's binary has no TcpSockets class: `SecPKCS12Import` is not in the
 * tvOS SDK, so the pod that claims tvOS support never registers. Importing
 * `react-native-tcp-socket` anyway runs `new NativeEventEmitter(null)` and
 * Expo rewrites that into "a native module that doesn't exist", which is the
 * Brand-tab error boundary. Load it only after the class is actually there.
 */
export class LanListenerUnavailableError extends Error {
  constructor() {
    super('This TV cannot open a link for a logo. Add the logo from the Americana app on your iPhone.');
    this.name = 'LanListenerUnavailableError';
  }
}

type TcpSocketModule = typeof import('react-native-tcp-socket').default;

async function loadTcpSocket(): Promise<TcpSocketModule> {
  let sockets: unknown;
  try {
    sockets = NativeModules.TcpSockets;
  } catch {
    throw new LanListenerUnavailableError();
  }
  if (sockets == null) throw new LanListenerUnavailableError();
  try {
    const loaded = await import('react-native-tcp-socket');
    const tcp = loaded.default;
    if (tcp == null || typeof tcp.createServer !== 'function') throw new LanListenerUnavailableError();
    return tcp;
  } catch (error) {
    if (error instanceof LanListenerUnavailableError) throw error;
    throw new LanListenerUnavailableError();
  }
}

/** Methods used from react-native-tcp-socket. The package types do not re-export the socket class. */
type ConnectedSocket = {
  on(event: 'data', listener: (data: Uint8Array | string) => void): void;
  on(event: 'error' | 'close' | 'timeout', listener: () => void): void;
  write(data: Uint8Array, encoding: undefined, callback: () => void): void;
  end(): void;
  destroy(): void;
  pause(): void;
  setTimeout(ms: number): void;
};

export async function startLanServer(session: LogoTransferSession): Promise<LanServer> {
  const TcpSocket = await loadTcpSocket();
  const sockets = new Set<ConnectedSocket>();
  const server = TcpSocket.createServer({ noDelay: true }, (socket) => {
    const connected = socket as unknown as ConnectedSocket;
    if (sockets.size >= 4) {
      connected.destroy();
      return;
    }
    sockets.add(connected);
    connected.on('close', () => {
      sockets.delete(connected);
    });
    serveConnection(connected, session);
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      reject(error);
    };
    const timer = setTimeout(() => {
      fail(new Error('The TV could not open a port on the local network.'));
    }, 8000);
    server.once('error', (error: Error) => {
      fail(error instanceof Error ? error : new Error('The TV could not open a port on the local network.'));
    });
    server.listen({ port: 0, host: '0.0.0.0', reuseAddress: true }, () => {
      if (settled) return;
      const info = server.address();
      if (!info?.port) {
        fail(new Error('The TV could not open a port on the local network.'));
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        port: info.port,
        close: () => {
          for (const socket of sockets) socket.destroy();
          server.close();
        },
      });
    });
  });
}

function serveConnection(socket: ConnectedSocket, session: LogoTransferSession): void {
  const accumulator = new HttpAccumulator();
  let closed = false;
  const finish = (bytes: Uint8Array) => {
    if (closed) return;
    closed = true;
    try {
      socket.write(bytes, undefined, () => {
        socket.end();
      });
    } catch {
      socket.destroy();
    }
  };

  socket.on('data', (data: Uint8Array | string) => {
    if (closed) return;
    const inbound = accumulator.push(asBytes(data));
    if (inbound.type === 'pending' || inbound.type === 'ignore') return;
    socket.pause();
    if (inbound.type === 'error') {
      finish(encodeHtmlResponse(inbound.status, messagePage('Try again', inbound.message)));
      return;
    }
    void session.handle(inbound.request).then(
      (result) => finish(encodeHtmlResponse(result.status, result.html)),
      () =>
        finish(
          encodeHtmlResponse(500, messagePage('Not saved', 'This TV could not save that image. Try a smaller JPEG or PNG.')),
        ),
    );
  });
  socket.on('error', () => {
    socket.destroy();
  });
  socket.setTimeout(30_000);
  socket.on('timeout', () => {
    socket.destroy();
  });
}

function asBytes(data: Uint8Array | string): Uint8Array {
  if (typeof data === 'string') return new TextEncoder().encode(data);
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}
