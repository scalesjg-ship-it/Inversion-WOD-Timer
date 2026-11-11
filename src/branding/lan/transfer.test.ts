import { describe, expect, it } from 'vitest';

import { DEFAULT_BRANDING } from '../types';
import { sanitizeBranding } from '../storage';
import { isReachableLanIPv4, pairingUrl } from './address';
import { applyUploadedLogo } from './applyUpload';
import { encodeHtmlResponse, HttpAccumulator, type Inbound } from './http';
import { MAX_IMAGE_BYTES } from './limits';
import { escapeHtml, formPage } from './page';
import { moduleRuns, qrModules } from './qrMatrix';
import { LogoSaveError, LogoTransferSession } from './session';
import { createPairingToken, isPairingToken, tokensEqual } from './token';
import { decideUpload, parseMultipart, sniffImage, type MultipartPart } from './upload';

const TOKEN = 'ab'.repeat(16);

describe('pairing token', () => {
  it('builds a 32 character hex token and compares it without matching a lookalike', () => {
    const token = createPairingToken((bytes) => {
      bytes.set([
        0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab, 0xab,
      ]);
    });
    expect(token).toBe(TOKEN);
    expect(isPairingToken(token)).toBe(true);
    expect(tokensEqual(token, TOKEN)).toBe(true);
    expect(tokensEqual(token, `${TOKEN.slice(0, -1)}c`)).toBe(false);
    expect(tokensEqual(token, TOKEN.slice(0, -1))).toBe(false);
    expect(tokensEqual('', '')).toBe(true);
    expect(isPairingToken('')).toBe(false);
    expect(isPairingToken(TOKEN.toUpperCase())).toBe(false);
  });
});

describe('lan address', () => {
  it('keeps a private IPv4 and rejects loopback', () => {
    expect(isReachableLanIPv4('192.168.1.20')).toBe(true);
    expect(isReachableLanIPv4('10.0.0.5')).toBe(true);
    expect(isReachableLanIPv4('172.16.0.1')).toBe(true);
    expect(isReachableLanIPv4('100.64.0.1')).toBe(true);
    expect(isReachableLanIPv4('169.254.1.1')).toBe(true);
    expect(isReachableLanIPv4('172.15.0.1')).toBe(false);
    expect(isReachableLanIPv4('8.8.8.8')).toBe(false);
    expect(isReachableLanIPv4('0.0.0.0')).toBe(false);
    expect(isReachableLanIPv4('127.0.0.1')).toBe(false);
    expect(isReachableLanIPv4('256.1.1.1')).toBe(false);
    expect(isReachableLanIPv4('::1')).toBe(false);
    expect(pairingUrl('192.168.1.20', 8741, TOKEN)).toBe(`http://192.168.1.20:8741/?t=${TOKEN}`);
  });
});

describe('qr matrix', () => {
  it('builds a square code with a quiet zone for the pairing url', () => {
    const matrix = qrModules(pairingUrl('192.168.1.20', 8741, TOKEN));
    expect(matrix.length).toBeGreaterThan(21);
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true);
    const runs = moduleRuns(matrix[0] ?? []);
    expect(runs.reduce((sum, run) => sum + run.length, 0)).toBe(matrix.length);
  });
});

describe('http upload parsing', () => {
  it('reads a split request and rejects an oversized or chunked body before buffering it', () => {
    const body = multipart('bound', [filePart('logo', 'logo.jpg', 'image/jpeg', jpeg())]);
    const raw = httpMessage(
      `POST /?t=${TOKEN} HTTP/1.1\r\nHost: tv\r\nContent-Type: multipart/form-data; boundary=bound\r\nContent-Length: ${body.byteLength}\r\n\r\n`,
      body,
    );
    const parsed = readAll(raw, 17);
    expect(parsed.type).toBe('request');
    if (parsed.type !== 'request') return;
    expect(parsed.request.method).toBe('POST');
    expect(parsed.request.query.get('t')).toBe(TOKEN);
    expect(parsed.request.body.byteLength).toBe(body.byteLength);

    const tooBig = readAll(textBytes('POST / HTTP/1.1\r\nContent-Length: 99999999\r\n\r\n'));
    expect(tooBig).toMatchObject({ type: 'error', status: 413 });

    const chunked = readAll(textBytes('POST / HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n'));
    expect(chunked).toMatchObject({ type: 'error', status: 411 });

    const partial = new HttpAccumulator();
    expect(partial.push(textBytes('GET /?t=abc HTTP/1.1\r\nHost: tv\r\n')).type).toBe('pending');
  });

  it('sniffs jpeg, png, and heic and rejects other files', () => {
    expect(sniffImage(jpeg())).toBe('jpeg');
    expect(sniffImage(png())).toBe('png');
    expect(sniffImage(heic())).toBe('heic');
    expect(sniffImage(textBytes('GIF89a'))).toBeNull();
    expect(sniffImage(textBytes('RIFF'))).toBeNull();
  });

  it('reads the logo and optional branding fields from the multipart body', () => {
    const parts = parseMultipart(
      multipart('bound', [
        filePart('logo', 'gym.png', 'image/png', png()),
        textPart('gymName', '  Northside Boxing  '),
        textPart('placement', 'corner'),
        textPart('updateColors', 'on'),
        textPart('workColor', '#112233'),
        textPart('restColor', 'nope'),
      ]),
      'multipart/form-data; boundary=bound',
    );
    expect(parts).not.toBeNull();
    const decision = decideUpload(parts ?? []);
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.upload.extension).toBe('png');
    expect(decision.upload.patch.gymName).toBe('Northside Boxing');
    expect(decision.upload.patch.logoPlacement).toBe('corner');
    expect(decision.upload.patch.workColor).toBe('#112233');
    expect(decision.upload.patch.restColor).toBeUndefined();
  });

  it('ignores colors unless asked, and rejects a file that is not a jpeg, png, or heic', () => {
    const kept = decideUpload([
      filePart('logo', 'logo.jpg', 'image/jpeg', jpeg()),
      textPart('updateColors', 'off'),
      textPart('workColor', '#00ff00'),
      textPart('placement', 'nope'),
    ]);
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.upload.patch.workColor).toBeUndefined();
    expect(kept.upload.patch.logoPlacement).toBeUndefined();

    const rejected = decideUpload([filePart('logo', 'logo.gif', 'image/gif', textBytes('GIF89a-not-an-image'))]);
    expect(rejected).toMatchObject({ ok: false, status: 415 });
  });

  it('rejects an image over 10 MB', () => {
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    huge.set(jpeg());
    const decision = decideUpload([filePart('logo', 'big.jpg', 'image/jpeg', huge)]);
    expect(decision).toMatchObject({ ok: false, status: 413 });
  });
});

describe('logo transfer session', () => {
  it('serves a self-contained page only for the pairing token', async () => {
    const session = sessionWith(async () => undefined);
    const page = await session.handle(getRequest(TOKEN));
    expect(page.status).toBe(200);
    expect(page.html).toContain('Send a logo');
    expect(page.html).toContain(`/?t=${TOKEN}`);
    expect(page.html).toContain('name="logo"');
    expect(page.html).not.toMatch(/https?:\/\//);
    expect(escapeHtml('<img src=x>')).toBe('&lt;img src=x&gt;');
    expect(formPage(TOKEN, defaults()).includes(TOKEN)).toBe(true);

    const denied = await session.handle(getRequest('cd'.repeat(16)));
    expect(denied.status).toBe(403);
    expect(denied.html).not.toContain('name="logo"');
  });

  it('saves one upload through the branding record and rejects the used token', async () => {
    const saved: { patch?: ReturnType<typeof sanitizeBranding> } = {};
    const session = sessionWith(async (upload) => {
      await applyUploadedLogo(upload, {
        writeTempFile: async () => 'file:///tmp/logo.jpg',
        prepareLogo: async (uri) => {
          expect(uri).toBe('file:///tmp/logo.jpg');
          return 'data:image/jpeg;base64,LOGO';
        },
        update: async (patch) => {
          saved.patch = sanitizeBranding({ ...DEFAULT_BRANDING, ...patch });
        },
        deleteTempFile: async () => undefined,
      });
      session.rotate('cd'.repeat(16));
    });

    const body = multipart('bound', [
      filePart('logo', 'logo.jpg', 'image/jpeg', jpeg()),
      textPart('t', TOKEN),
      textPart('gymName', 'Northside Boxing'),
      textPart('placement', 'fullBleed'),
    ]);
    const raw = httpMessage(
      `POST /upload?t=${TOKEN} HTTP/1.1\r\nContent-Type: multipart/form-data; boundary=bound\r\nContent-Length: ${body.byteLength}\r\n\r\n`,
      body,
    );
    const inbound = readAll(raw, 30);
    expect(inbound.type).toBe('request');
    if (inbound.type !== 'request') return;
    const response = await session.handle(inbound.request);
    expect(response.status).toBe(200);
    expect(response.html).toContain('The TV has the logo');
    expect(saved.patch?.logoUri).toBe('data:image/jpeg;base64,LOGO');
    expect(saved.patch?.gymName).toBe('Northside Boxing');
    expect(saved.patch?.logoPlacement).toBe('fullBleed');
    expect(saved.patch?.workColor).toBe(DEFAULT_BRANDING.workColor);

    const again = await session.handle(inbound.request);
    expect(again.status).toBe(403);

    const bytes = encodeHtmlResponse(response.status, response.html);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('HTTP/1.1 200 OK\r\n')).toBe(true);
    expect(text).toContain('Connection: close');
    expect(text).toContain(`Content-Length: ${new TextEncoder().encode(response.html).byteLength}`);
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('does not save branding when the image cannot be prepared', async () => {
    let updated = false;
    let deleted = false;
    await expect(
      applyUploadedLogo(
        { image: heic(), extension: 'heic', patch: { gymName: 'Nope' } },
        {
          writeTempFile: async () => 'file:///tmp/logo.heic',
          prepareLogo: async () => {
            throw new Error('decode');
          },
          update: async () => {
            updated = true;
          },
          deleteTempFile: async () => {
            deleted = true;
          },
        },
      ),
    ).rejects.toBeInstanceOf(LogoSaveError);
    expect(updated).toBe(false);
    expect(deleted).toBe(true);
  });

  it('closes the page after the listener expires', async () => {
    const session = new LogoTransferSession(TOKEN, () => true, defaults, async () => undefined);
    const response = await session.handle(getRequest(TOKEN));
    expect(response.status).toBe(410);
  });
});

function sessionWith(onUpload: ConstructorParameters<typeof LogoTransferSession>[3]): LogoTransferSession {
  return new LogoTransferSession(TOKEN, () => false, defaults, onUpload);
}

function defaults() {
  return {
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
  };
}

function getRequest(token: string) {
  const inbound = readAll(textBytes(`GET /?t=${token} HTTP/1.1\r\nHost: tv\r\n\r\n`));
  if (inbound.type !== 'request') throw new Error('expected a request');
  return inbound.request;
}

function readAll(bytes: Uint8Array, slice = 64): Inbound {
  const accumulator = new HttpAccumulator();
  let seen: Inbound = { type: 'pending' };
  if (bytes.length === 0) return accumulator.push(bytes);
  for (let index = 0; index < bytes.length; index += slice) {
    seen = accumulator.push(bytes.subarray(index, Math.min(bytes.length, index + slice)));
    if (seen.type === 'error' || seen.type === 'request') return seen;
  }
  return seen;
}

function httpMessage(head: string, body: Uint8Array): Uint8Array {
  const headBytes = textBytes(head);
  const out = new Uint8Array(headBytes.length + body.length);
  out.set(headBytes);
  out.set(body, headBytes.length);
  return out;
}

function multipart(boundary: string, parts: MultipartPart[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (const part of parts) {
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
      : `Content-Disposition: form-data; name="${part.name}"\r\n`;
    const type = part.contentType ? `Content-Type: ${part.contentType}\r\n` : '';
    chunks.push(textBytes(`--${boundary}\r\n${disposition}${type}\r\n`));
    chunks.push(part.body);
    chunks.push(textBytes('\r\n'));
  }
  chunks.push(textBytes(`--${boundary}--\r\n`));
  return concat(chunks);
}

function filePart(name: string, filename: string, contentType: string, body: Uint8Array): MultipartPart {
  return { name, filename, contentType, body };
}

function textPart(name: string, value: string): MultipartPart {
  return { name, body: textBytes(value) };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function jpeg(): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
}

function png(): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function heic(): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x00, 0x00, 0x00, 0x18], 0);
  bytes.set(textBytes('ftypheic'), 4);
  return bytes;
}
