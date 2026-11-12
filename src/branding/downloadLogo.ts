import { File, Paths } from 'expo-file-system';

import { parseLogoUrl } from './logoUrl';

/** Eight megabytes is enough for a gym mark and small enough to keep on a TV. */
export const LOGO_DOWNLOAD_LIMIT = 8_000_000;

/** Downloads an https image into the app cache and returns the local file URI. */
export async function downloadLogo(input: string): Promise<string> {
  const url = parseLogoUrl(input);
  if (!url) throw new Error('invalid-url');
  const destination = new File(Paths.cache, `gym-logo-${Date.now()}.img`);
  const file = await File.downloadFileAsync(url, destination, { idempotent: true });
  if (!file.exists || file.size <= 0) throw new Error('empty');
  if (file.size > LOGO_DOWNLOAD_LIMIT) {
    file.delete();
    throw new Error('too-large');
  }
  return file.uri;
}
