import { createServer } from 'node:net';
import { expect, it } from 'vitest';

import { DEFAULT_BRANDING } from '../types';
import { encodeHtmlResponse, HttpAccumulator } from './http';
import { messagePage } from './page';
import { LogoTransferSession } from './session';
import { sniffImage } from './upload';

const TOKEN = 'ab'.repeat(16);

it('accepts one JPEG from a real TCP client and then rejects that token', async () => {
  const saved = {};
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
      saved.bytes = upload.image;
      saved.gymName = upload.patch.gymName;
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
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('expected a port');
  try {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const form = new FormData();
    form.set('t', TOKEN);
    form.set('gymName', 'Northside Boxing');
    form.set('placement', 'corner');
    form.set('logo', new File([jpeg], 'logo.jpg', { type: 'image/jpeg' }));
    const response = await fetch(`http://127.0.0.1:${address.port}/?t=${TOKEN}`, { method: 'POST', body: form });
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(text).toContain('The TV has the logo');
    expect(saved.gymName).toBe('Northside Boxing');
    expect(sniffImage(saved.bytes)).toBe('jpeg');

    const again = await fetch(`http://127.0.0.1:${address.port}/?t=${TOKEN}`, { method: 'POST', body: form });
    expect(again.status).toBe(403);
    await again.text();
  } finally {
    server.close();
  }
});
