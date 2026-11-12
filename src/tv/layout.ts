import { tabBarControlSize } from './controls';

/** 1080p and larger, or a real TV runtime. iPad widths stay on the phone layout. */
export function isTenFootLayout(width: number, height: number, tvRuntime: boolean): boolean {
  if (tvRuntime) return true;
  return width >= 1600 && height >= 900;
}

export function clockFontSize(width: number, height: number, tenFoot: boolean, fillFrame = false): number {
  const shortSide = Math.min(width, height);
  if (fillFrame) return Math.round(Math.min(width, height) * 0.62);
  if (tenFoot) return Math.round(Math.min(shortSide * 0.42, 520));
  const landscape = width > height;
  return Math.round(Math.min(shortSide * (landscape ? 0.46 : 0.3), 280));
}

/** Overscan margin so the clock is not clipped on a television. */
export function tvSafeInset(tenFoot: boolean): number {
  return tenFoot ? 64 : 0;
}

/** Apple TV overscan. Content stays inside this box on a 1920x1080 frame. */
export const TV_SAFE_HORIZONTAL = 60;
export const TV_SAFE_VERTICAL = 90;

/** Menu rows on TV. Kept inside the 48–60pt range Garrett asked for. */
export const TV_MENU_FONT = 56;
export const TV_TITLE_FONT = 84;
export const TV_SECTION_FONT = 32;
export const TV_BODY_FONT = 28;

export function tvSafeBox(tv: boolean): { horizontal: number; vertical: number } {
  if (!tv) return { horizontal: 0, vertical: 0 };
  return { horizontal: TV_SAFE_HORIZONTAL, vertical: TV_SAFE_VERTICAL };
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
  fillFrame?: boolean;
  horizontalInset: number;
  verticalInset: number;
}): { fontSize: number; lineHeight: number; width: number } {
  const width = Math.max(1, options.screenWidth - Math.max(0, options.horizontalInset));
  const heightBudget = Math.max(1, options.screenHeight - Math.max(0, options.verticalInset));
  const preferred = clockFontSize(options.screenWidth, options.screenHeight, options.tenFoot, options.fillFrame === true);
  const byWidth = width / clockAdvanceRatio(options.text);
  const byHeight = heightBudget / CLOCK_LINE_HEIGHT_RATIO;
  const fontSize = Math.max(1, Math.floor(Math.min(preferred, byWidth, byHeight)));
  return {
    fontSize,
    lineHeight: Math.ceil(fontSize * CLOCK_LINE_HEIGHT_RATIO),
    width,
  };
}

export interface TvHomeLayout {
  columns: number;
  rows: number;
  cardHeight: number;
  titleSize: number;
  detailSize: number;
  gymSize: number;
  wordmarkSize: number;
  sectionSize: number;
  hintSize: number;
  stackGap: number;
  gridGap: number;
  padTop: number;
  padBottom: number;
  tabBlock: number;
  contentHeight: number;
  viewportHeight: number;
}

/**
 * Sizes the WOD mode list so every built-in timer fits on one 720p or 1080p TV.
 * The tab bar is outside this viewport. Card text is sized to the card, not the other way around.
 */
export function tvHomeLayout(screenWidth: number, screenHeight: number, optionCount: number): TvHomeLayout {
  const columns = screenWidth >= 900 ? 2 : 1;
  const rows = Math.max(1, Math.ceil(Math.max(0, optionCount) / columns));
  const tab = tabBarControlSize(true, screenHeight);
  const tabBlock = tab.barContentHeight + 16;
  const viewportHeight = Math.max(0, screenHeight - tabBlock);
  const compact = screenHeight < 1000;
  const padTop = compact ? 20 : 36;
  const padBottom = 8;
  const stackGap = compact ? 6 : 8;
  const gridGap = compact ? 8 : 12;
  const wordmarkSize = compact ? 16 : 22;
  const gymSize = compact ? 28 : 44;
  const sectionSize = compact ? 16 : 22;
  const hintSize = compact ? 16 : 20;
  const header = padTop + wordmarkSize + stackGap + gymSize + stackGap + sectionSize + stackGap;
  const footer = stackGap + hintSize + padBottom;
  const gridExtra = rows * gridGap;
  const available = viewportHeight - header - footer - gridExtra;
  const cardHeight = Math.max(64, Math.floor(available / rows));
  const contentHeight = header + footer + rows * cardHeight + gridExtra;
  const titleSize = Math.min(compact ? 26 : 32, Math.max(18, Math.floor(cardHeight * 0.28)));
  const detailSize = Math.min(compact ? 16 : 18, Math.max(13, Math.floor(cardHeight * 0.16)));
  return {
    columns,
    rows,
    cardHeight,
    titleSize,
    detailSize,
    gymSize,
    wordmarkSize,
    sectionSize,
    hintSize,
    stackGap,
    gridGap,
    padTop,
    padBottom,
    tabBlock,
    contentHeight,
    viewportHeight,
  };
}

export interface TvClockChrome {
  logo: number;
  name: number;
  phase: number;
}

/** Header sizes for the running clock. The digits then take whatever height is left. */
export function tvClockChrome(screenHeight: number, hasLogo: boolean): TvClockChrome {
  const compact = screenHeight < 1000;
  const logoCap = compact ? 112 : 168;
  return {
    logo: hasLogo ? Math.round(Math.min(logoCap, Math.max(96, screenHeight * 0.15))) : 0,
    name: compact ? 36 : 56,
    phase: compact ? 28 : 44,
  };
}
