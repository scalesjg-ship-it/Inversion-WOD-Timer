const TOKEN_BYTES = 16;

type RandomBytes = (count: number) => Uint8Array;

export function createPairingToken(readRandom?: (bytes: Uint8Array) => void): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  if (readRandom) readRandom(bytes);
  else fillRandom(bytes);
  let token = '';
  for (const byte of bytes) {
    token += byte.toString(16).padStart(2, '0');
  }
  return token;
}

/**
 * Hermes on Fire TV has no global `crypto`. Prefer expo-crypto, then a
 * `react-native-get-random-values` polyfill if that package is installed,
 * then Math.random so a missing native module cannot crash the Brand tab.
 *
 * expo-crypto's entry calls `requireNativeModule`, which throws in unit tests
 * and on a binary that has not linked the module yet. Load it at call time.
 */
function fillRandom(bytes: Uint8Array): void {
  if (readExpoCrypto(bytes)) return;
  if (readGlobalCrypto(bytes)) return;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
}

function readExpoCrypto(bytes: Uint8Array): boolean {
  try {
    // Static import runs requireNativeModule at load and throws when the module is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoCrypto = require('expo-crypto') as { getRandomBytes?: RandomBytes };
    if (typeof expoCrypto.getRandomBytes !== 'function') return false;
    const next = expoCrypto.getRandomBytes(bytes.length);
    if (!(next instanceof Uint8Array) || next.length < bytes.length) return false;
    bytes.set(next.subarray(0, bytes.length));
    return true;
  } catch {
    return false;
  }
}

function readGlobalCrypto(bytes: Uint8Array): boolean {
  try {
    // Optional polyfill. It is not a dependency; skip it when the package is absent.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-get-random-values');
  } catch {
    // The polyfill is optional. A global crypto object is still usable without it.
  }
  const cryptoObject = globalThis.crypto;
  if (!cryptoObject || typeof cryptoObject.getRandomValues !== 'function') return false;
  const copy = new Uint8Array(bytes.length);
  cryptoObject.getRandomValues(copy);
  bytes.set(copy);
  return true;
}

export function isPairingToken(value: string): boolean {
  return /^[0-9a-f]{32}$/.test(value);
}

/** Compare pairing tokens without returning early on the first mismatch. */
export function tokensEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length, 1);
  let diff = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    const a = index < left.length ? left.charCodeAt(index) : 0;
    const b = index < right.length ? right.charCodeAt(index) : 0;
    diff |= a ^ b;
  }
  return diff === 0;
}
