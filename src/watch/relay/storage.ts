import AsyncStorage from '@react-native-async-storage/async-storage';

import { PAIRING_STORAGE_KEY, parsePairingRecord, type WatchPairing } from './pairing';

export async function loadWatchPairing(): Promise<WatchPairing | null> {
  try {
    const raw = await AsyncStorage.getItem(PAIRING_STORAGE_KEY);
    if (!raw) return null;
    return parsePairingRecord(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export async function saveWatchPairing(pairing: WatchPairing): Promise<void> {
  await AsyncStorage.setItem(PAIRING_STORAGE_KEY, JSON.stringify(pairing));
}

export async function clearWatchPairing(): Promise<void> {
  await AsyncStorage.removeItem(PAIRING_STORAGE_KEY);
}
