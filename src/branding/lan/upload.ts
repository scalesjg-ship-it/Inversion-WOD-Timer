import { normalizeHex } from '../color';
import type { BrandColors, LogoPlacement } from '../types';
import { MAX_IMAGE_BYTES } from './limits';

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

export type ImageKind = 'jpeg' | 'png' | 'heic';

export type MultipartPart = {
  name: string;
  filename?: string;
  contentType?: string;
  body: Uint8Array;
};

export type UploadPatch = Partial<BrandColors> & {
  gymName?: string;
  logoPlacement?: LogoPlacement;
};

export type AcceptedUpload = {
  image: Uint8Array;
  extension: 'jpg' | 'png' | 'heic';
  patch: UploadPatch;
};

export type UploadDecision =
  | { ok: true; upload: AcceptedUpload }
  | { ok: false; status: number; message: string };

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((byte, index) => bytes[index] === byte)) return 'png';
  if (bytes.length < 12) return null;
  const box = latin1(bytes.subarray(4, 8));
  const brand = latin1(bytes.subarray(8, 12)).toLowerCase();
  if (box === 'ftyp' && HEIC_BRANDS.has(brand)) return 'heic';
  return null;
}

export function extensionFor(kind: ImageKind): 'jpg' | 'png' | 'heic' {
  switch (kind) {
    case 'jpeg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'heic':
      return 'heic';
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

export function parseMultipart(body: Uint8Array, contentType: string): MultipartPart[] | null {
  const boundary = boundaryOf(contentType);
  if (!boundary) return null;
  const delimiter = latin1Bytes(`--${boundary}`);
  const parts: MultipartPart[] = [];
  let cursor = indexOfBytes(body, delimiter);
  if (cursor < 0) return null;
  while (cursor >= 0 && parts.length <= 20) {
    let next = cursor + delimiter.length;
    if (body[next] === 45 && body[next + 1] === 45) break;
    if (body[next] === 13 && body[next + 1] === 10) next += 2;
    else if (body[next] === 10) next += 1;
    else return null;
    const following = indexOfBytes(body, delimiter, next);
    if (following < 0) return null;
    let partEnd = following;
    if (partEnd >= 2 && body[partEnd - 2] === 13 && body[partEnd - 1] === 10) partEnd -= 2;
    else if (partEnd >= 1 && body[partEnd - 1] === 10) partEnd -= 1;
    const parsed = readPart(body.subarray(next, partEnd));
    if (!parsed) return null;
    parts.push(parsed);
    cursor = following;
  }
  return parts.length > 20 ? null : parts;
}

export function decideUpload(parts: MultipartPart[]): UploadDecision {
  const logo = parts.find((part) => part.name === 'logo');
  if (!logo || logo.body.length === 0) {
    return { ok: false, status: 400, message: 'Choose a logo first.' };
  }
  if (logo.body.length > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, message: 'That image is larger than 10 MB.' };
  }
  for (const part of parts) {
    if (part.name !== 'logo' && part.body.length > 2048) {
      return { ok: false, status: 400, message: 'That upload could not be read.' };
    }
  }
  const kind = sniffImage(logo.body);
  if (!kind) {
    return { ok: false, status: 415, message: 'Send a JPEG, PNG, or HEIC photo.' };
  }
  const patch: UploadPatch = {};
  const gymName = textField(parts, 'gymName').slice(0, 48);
  if (gymName) patch.gymName = gymName;
  const placement = placementOf(textField(parts, 'placement'));
  if (placement) patch.logoPlacement = placement;
  if (wantsColors(textField(parts, 'updateColors'))) {
    const colors: (keyof BrandColors)[] = [
      'workColor',
      'restColor',
      'leadInColor',
      'warningColor',
      'digitColor',
      'backgroundColor',
      'uiColor',
    ];
    for (const field of colors) {
      const hex = normalizeHex(textField(parts, field));
      if (hex) patch[field] = hex;
    }
  }
  return { ok: true, upload: { image: logo.body, extension: extensionFor(kind), patch } };
}

export function textField(parts: MultipartPart[], name: string): string {
  const part = parts.find((item) => item.name === name && !item.filename);
  if (!part) return '';
  return new TextDecoder('utf-8', { fatal: false }).decode(part.body).replace(/\0/g, '').trim();
}

function wantsColors(value: string): boolean {
  const flag = value.toLowerCase();
  return flag === 'on' || flag === 'true' || flag === 'yes' || flag === '1';
}

function placementOf(value: string): LogoPlacement | null {
  if (value === 'watermark' || value === 'fullBleed' || value === 'corner') return value;
  return null;
}

function readPart(bytes: Uint8Array): MultipartPart | null {
  const separator = indexOfBytes(bytes, new Uint8Array([13, 10, 13, 10]));
  const lfSeparator = separator < 0 ? indexOfBytes(bytes, new Uint8Array([10, 10])) : -1;
  const headerEnd = separator >= 0 ? separator : lfSeparator;
  const gap = separator >= 0 ? 4 : 2;
  if (headerEnd < 0) return null;
  const headerText = latin1(bytes.subarray(0, headerEnd));
  const disposition = headerValue(headerText, 'content-disposition');
  const name = dispositionParam(disposition, 'name');
  if (!name) return null;
  return {
    name,
    filename: dispositionParam(disposition, 'filename'),
    contentType: headerValue(headerText, 'content-type') ?? undefined,
    body: bytes.slice(headerEnd + gap),
  };
}

function boundaryOf(contentType: string): string | null {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const boundary = (match?.[1] ?? match?.[2] ?? '').trim();
  if (!boundary || boundary.length > 200) return null;
  return boundary;
}

function headerValue(headers: string, name: string): string | null {
  for (const line of headers.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    if (line.slice(0, colon).trim().toLowerCase() !== name) continue;
    return line.slice(colon + 1).trim();
  }
  return null;
}

function dispositionParam(header: string | null, key: string): string | undefined {
  if (!header) return undefined;
  const pattern = new RegExp(`${key}\\*=UTF-8''([^;]+)|${key}="([^"]*)"|${key}=([^;\\s]+)`, 'i');
  const match = pattern.exec(header);
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function latin1(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function latin1Bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function indexOfBytes(haystack: Uint8Array, needle: Uint8Array, from = 0): number {
  const last = haystack.length - needle.length;
  for (let index = from; index <= last; index += 1) {
    let matched = true;
    for (let offset = 0; offset < needle.length; offset += 1) {
      if (haystack[index + offset] !== needle[offset]) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}
