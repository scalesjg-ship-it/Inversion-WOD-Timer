const MAX_URL_LENGTH = 2000;

/** An https image link a TV keyboard can submit. http, file, and data URLs are rejected. */
export function parseLogoUrl(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (!url.hostname || !url.hostname.includes('.')) return null;
  return url.toString();
}
