/** Private, link-local, or carrier-grade NAT. A public address is not the gym Wi-Fi. */
export function isReachableLanIPv4(value: string): boolean {
  const ip = value.trim();
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!match) return false;
  const parts = [match[1], match[2], match[3], match[4]].map((part) => Number(part));
  if (parts.some((part) => part > 255)) return false;
  const first = parts[0] ?? 0;
  const second = parts[1] ?? 0;
  if (first === 10) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 169 && second === 254) return true;
  if (first === 100 && second >= 64 && second <= 127) return true;
  return false;
}

export function pairingUrl(ip: string, port: number, token: string): string {
  return `http://${ip}:${port}/?t=${token}`;
}
