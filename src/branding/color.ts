export function normalizeHex(input: string): string | null {
  const value = input.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return `#${value.toUpperCase()}`;
}

export function relativeLuminance(hex: string): number {
  const parsed = normalizeHex(hex);
  if (!parsed) return 1;
  const channels = [1, 3, 5].map((index) => {
    const channel = Number.parseInt(parsed.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const red = channels[0] ?? 0;
  const green = channels[1] ?? 0;
  const blue = channels[2] ?? 0;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Keep the clock readable when a gym picks a color that disappears on black. */
export function digitColor(hex: string): string {
  return relativeLuminance(hex) < 0.18 ? '#F4F7FB' : normalizeHex(hex) ?? '#F4F7FB';
}
