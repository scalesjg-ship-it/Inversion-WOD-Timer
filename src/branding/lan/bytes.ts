/** UTF-8 and Latin-1 codecs that do not need the web TextEncoder global. Hermes on a TV may not have it. */

export function encodeUtf8(value: string): Uint8Array {
  const bytes: number[] = [];
  for (const symbol of value) {
    const code = symbol.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

export function encodeLatin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

export function decodeLatin1(bytes: Uint8Array): string {
  let text = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    const slice = bytes.subarray(index, index + step);
    text += String.fromCharCode(...slice);
  }
  return text;
}

export function decodeUtf8(bytes: Uint8Array): string {
  let text = '';
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index] ?? 0;
    if (byte < 0x80) {
      text += String.fromCharCode(byte);
      continue;
    }
    if ((byte & 0xe0) === 0xc0 && index + 1 < bytes.length) {
      const next = bytes[index + 1] ?? 0;
      text += String.fromCharCode(((byte & 0x1f) << 6) | (next & 0x3f));
      index += 1;
      continue;
    }
    if ((byte & 0xf0) === 0xe0 && index + 2 < bytes.length) {
      const next = bytes[index + 1] ?? 0;
      const last = bytes[index + 2] ?? 0;
      text += String.fromCharCode(((byte & 0x0f) << 12) | ((next & 0x3f) << 6) | (last & 0x3f));
      index += 2;
      continue;
    }
    text += '\uFFFD';
  }
  return text;
}
