const TOKEN_BYTES = 16;

export function createPairingToken(readRandom?: (bytes: Uint8Array) => void): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  if (readRandom) readRandom(bytes);
  else crypto.getRandomValues(bytes);
  let token = '';
  for (const byte of bytes) {
    token += byte.toString(16).padStart(2, '0');
  }
  return token;
}

export function isPairingToken(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value);
}

/** Compare pairing tokens without returning early on the first mismatch. */
export function tokensEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}
