import { createServer } from 'node:net';

import { DEFAULT_BRANDING } from '../src/branding/types';
import { encodeHtmlResponse, HttpAccumulator } from '../src/branding/lan/http';
import { messagePage } from '../src/branding/lan/page';
import { LogoTransferSession } from '../src/branding/lan/session';

const TOKEN = 'ab'.repeat(16);

export type SavedUpload = { bytes: Uint8Array; extension: string };

export function startLogoPage(): Promise<{ port: number; saved: SavedUpload[]; close: () => void }> {
  const saved: SavedUpload[] = [];
  const session = new LogoTransferSession(
    TOKEN,
    () => false,
    () => ({
      gymName: DEFAULT_BRANDING.gymName,
      colors: {
        workColor: DEFAULT_BRANDING.workColor,
        restColor: DEFAULT_BRANDING.restColor,
        leadInColor: DEFAULT_BRANDING.leadInColor,
        warningColor: DEFAULT_BRANDING.warningColor,
        digitColor: DEFAULT_BRANDING.digitColor,
        backgroundColor: DEFAULT_BRANDING.backgroundColor,
        uiColor: DEFAULT_BRANDING.uiColor,
      },
    }),
    async (upload) => {
      saved.push({ bytes: upload.image, extension: upload.extension });
      session.rotate('cd'.repeat(16));
    },
  );
  const server = createServer((socket) => {
    const accumulator = new HttpAccumulator();
    socket.on('data', (chunk) => {
      const inbound = accumulator.push(new Uint8Array(chunk));
      if (inbound.type === 'pending' || inbound.type === 'ignore') return;
      if (inbound.type === 'error') {
        socket.end(encodeHtmlResponse(inbound.status, messagePage('Try again', inbound.message)));
        return;
      }
      void session.handle(inbound.request).then((result) => {
        socket.end(encodeHtmlResponse(result.status, result.html));
      });
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('expected a port');
      resolve({
        port: address.port,
        saved,
        close: () => server.close(),
      });
    });
  });
}
