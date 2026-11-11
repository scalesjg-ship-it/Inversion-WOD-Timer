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

/**
 * Oswald Bold's typographic line is 1.482em (ascender 1193 + descender 289).
 * A shorter line box clips the digits on iOS.
 */
export const CLOCK_LINE_HEIGHT_RATIO = 1.5;

/** Widest Oswald Bold digit is 0.55em. Extra room covers rasterization. */
const DIGIT_EM = 0.58;
const COLON_EM = 0.34;

export function clockAdvanceRatio(text: string): number {
  if (text.length === 0) return DIGIT_EM;
  let width = 0;
  for (const char of text) {
    width += char === ':' ? COLON_EM : DIGIT_EM;
  }
  return width;
}

/** Largest clock that keeps the full glyph run inside the safe box. */
export function fitClock(options: {
  text: string;
  screenWidth: number;
  screenHeight: number;
  tenFoot: boolean;
  horizontalInset: number;
  verticalInset: number;
}): { fontSize: number; lineHeight: number; width: number } {
  const width = Math.max(1, options.screenWidth - Math.max(0, options.horizontalInset));
  const heightBudget = Math.max(1, options.screenHeight - Math.max(0, options.verticalInset));
  const preferred = clockFontSize(options.screenWidth, options.screenHeight, options.tenFoot);
  const byWidth = width / clockAdvanceRatio(options.text);
  const byHeight = heightBudget / CLOCK_LINE_HEIGHT_RATIO;
  const fontSize = Math.max(1, Math.floor(Math.min(preferred, byWidth, byHeight)));
  return {
    fontSize,
    lineHeight: Math.ceil(fontSize * CLOCK_LINE_HEIGHT_RATIO),
    width,
  };
}
