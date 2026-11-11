import { MAX_BODY_BYTES, MAX_HEADER_BYTES } from './limits';

const HEADER_END = new Uint8Array([13, 10, 13, 10]);

export type ParsedRequest = {
  method: string;
  pathname: string;
  query: URLSearchParams;
  headers: Map<string, string>;
  body: Uint8Array;
};

export type Inbound =
  | { type: 'pending' }
  | { type: 'ignore' }
  | { type: 'error'; status: number; message: string }
  | { type: 'request'; request: ParsedRequest };

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  400: 'Bad Request',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  431: 'Request Header Fields Too Large',
  500: 'Internal Server Error',
};

export class HttpAccumulator {
  private header = new Uint8Array(0);
  private body = new Uint8Array(0);
  private bodyFilled = 0;
  private expectedBody = 0;
  private headerDone = false;
  private finished = false;
  private requestHead: Omit<ParsedRequest, 'body'> | null = null;

  push(chunk: Uint8Array): Inbound {
    if (this.finished) return { type: 'ignore' };
    if (chunk.length === 0) return { type: 'pending' };
    if (!this.headerDone) return this.pushHeader(chunk);
    return this.fillBody(chunk);
  }

  private pushHeader(chunk: Uint8Array): Inbound {
    const merged = append(this.header, chunk);
    const headerEnd = indexOfBytes(merged, HEADER_END);
    if (headerEnd < 0) {
      if (merged.length > MAX_HEADER_BYTES) {
        this.finished = true;
        return error(431, 'That request was too large.');
      }
      this.header = merged;
      return { type: 'pending' };
    }
    if (headerEnd > MAX_HEADER_BYTES) {
      this.finished = true;
      return error(431, 'That request was too large.');
    }
    const parsed = parseHead(merged.subarray(0, headerEnd));
    if (parsed.type === 'error') {
      this.finished = true;
      return parsed;
    }
    this.headerDone = true;
    this.requestHead = parsed.head;
    const rest = merged.subarray(headerEnd + HEADER_END.length);
    if (parsed.head.method === 'GET' || parsed.head.method === 'HEAD') {
      this.finished = true;
      return { type: 'request', request: { ...parsed.head, body: new Uint8Array() } };
    }
    this.expectedBody = parsed.bodyLength;
    this.body = new Uint8Array(parsed.bodyLength);
    return this.fillBody(rest);
  }

  private fillBody(chunk: Uint8Array): Inbound {
    const head = this.requestHead;
    if (!head) {
      this.finished = true;
      return error(400, 'That request could not be read.');
    }
    const needed = this.expectedBody - this.bodyFilled;
    const take = Math.min(needed, chunk.length);
    if (take > 0) this.body.set(chunk.subarray(0, take), this.bodyFilled);
    this.bodyFilled += take;
    if (this.bodyFilled < this.expectedBody) return { type: 'pending' };
    this.finished = true;
    return { type: 'request', request: { ...head, body: this.body } };
  }
}

export function encodeHtmlResponse(status: number, html: string): Uint8Array {
  const body = new TextEncoder().encode(html);
  const reason = STATUS_TEXT[status] ?? 'OK';
  const head = [
    `HTTP/1.1 ${status} ${reason}`,
    'Content-Type: text/html; charset=utf-8',
    `Content-Length: ${body.byteLength}`,
    'Connection: close',
    'Cache-Control: no-store',
    'Referrer-Policy: no-referrer',
    "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'",
    'X-Content-Type-Options: nosniff',
    '',
    '',
  ].join('\r\n');
  const headBytes = new TextEncoder().encode(head);
  const out = new Uint8Array(headBytes.length + body.length);
  out.set(headBytes, 0);
  out.set(body, headBytes.length);
  return out;
}

function parseHead(headerBytes: Uint8Array):
  | { type: 'error'; status: number; message: string }
  | { type: 'head'; head: Omit<ParsedRequest, 'body'>; bodyLength: number } {
  const text = new TextDecoder('latin1').decode(headerBytes);
  const lines = text.split('\r\n');
  const requestLine = lines[0] ?? '';
  const match = /^([A-Z]+)\s+(\S+)\s+HTTP\/1\.[01]$/.exec(requestLine);
  if (!match) return error(400, 'That request could not be read.');
  const method = match[1] ?? '';
  const target = match[2] ?? '';
  const route = splitTarget(target);
  if (!route) return error(400, 'That request could not be read.');

  const headers = new Map<string, string>();
  let lengthCount = 0;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.length === 0) continue;
    const colon = line.indexOf(':');
    if (colon <= 0) return error(400, 'That request could not be read.');
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (name === 'content-length') lengthCount += 1;
    headers.set(name, value);
  }
  if (lengthCount > 1) return error(400, 'That request could not be read.');

  const head = { method, pathname: route.pathname, query: route.query, headers };
  if (method === 'GET' || method === 'HEAD') return { type: 'head', head, bodyLength: 0 };
  if (headers.has('transfer-encoding')) {
    return error(411, 'Send the photo again from the form on this page.');
  }
  const lengthRaw = headers.get('content-length');
  if (!lengthRaw || !/^\d+$/.test(lengthRaw)) {
    return error(411, 'Send the photo again from the form on this page.');
  }
  const bodyLength = Number(lengthRaw);
  if (!Number.isSafeInteger(bodyLength) || bodyLength > MAX_BODY_BYTES) {
    return error(413, 'That image is larger than 10 MB.');
  }
  return { type: 'head', head, bodyLength };
}

function splitTarget(target: string): { pathname: string; query: URLSearchParams } | null {
  if (target.includes('://') || target.includes('..')) return null;
  const queryIndex = target.indexOf('?');
  const pathname = queryIndex === -1 ? target : target.slice(0, queryIndex);
  if (!pathname.startsWith('/')) return null;
  const query = new URLSearchParams(queryIndex === -1 ? '' : target.slice(queryIndex + 1));
  return { pathname, query };
}

function error(status: number, message: string): { type: 'error'; status: number; message: string } {
  return { type: 'error', status, message };
}

function append(left: Uint8Array, right: Uint8Array) {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
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
