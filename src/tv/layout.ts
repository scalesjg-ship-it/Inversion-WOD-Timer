/** 1080p and larger, or a real TV runtime. iPad widths stay on the phone layout. */
export function isTenFootLayout(width: number, height: number, tvRuntime: boolean): boolean {
  if (tvRuntime) return true;
  return width >= 1600 && height >= 900;
}

export function clockFontSize(width: number, height: number, tenFoot: boolean): number {
  const shortSide = Math.min(width, height);
  if (tenFoot) return Math.round(Math.min(shortSide * 0.42, 520));
  const landscape = width > height;
  return Math.round(Math.min(shortSide * (landscape ? 0.46 : 0.3), 280));
}

/** Overscan margin so the clock is not clipped on a television. */
export function tvSafeInset(tenFoot: boolean): number {
  return tenFoot ? 64 : 0;
}
