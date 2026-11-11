import TcpSocket from 'react-native-tcp-socket';

import { encodeHtmlResponse, HttpAccumulator } from './http';
import { messagePage } from './page';
import type { LogoTransferSession } from './session';

export type LanServer = {
  port: number;
  close: () => void;
};

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

export function startLanServer(session: LogoTransferSession): Promise<LanServer> {
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
