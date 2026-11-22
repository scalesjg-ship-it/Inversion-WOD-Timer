import * as Crypto from 'expo-crypto';

/** Prefer Web Crypto. Fall back to expo-crypto, which tvOS Hermes can call. */
export function systemRandomBytes(count: number): Uint8Array | null {
  if (count < 1) return null;
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(count);
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  try {
    return Crypto.getRandomBytes(count);
  } catch {
    return null;
  }
}
