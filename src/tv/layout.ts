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
  /** 2 when the card is tall enough for the subtitle, otherwise 1. */
  detailLines: 1 | 2;
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

/** Width that places `columns` cells on one row. Four decimals stay under 100% so the row does not wrap. */
export function tvColumnBasis(columns: number): string {
  const count = Math.max(1, columns);
  return `${(100 / count).toFixed(4)}%`;
}

/** Start button and its footer. Preset grids leave this much of the TV clear. */
export function tvStartReserve(screenHeight: number): number {
  return screenHeight < 1000 ? 148 : 164;
}

/**
 * Column count for a TV option list.
 * Six conditioning modes use three columns on a 720p or 1080p television, including
 * the 960dp width Fire TV reports for a 1080p panel. Four round presets stay a 2×2.
 */
export function tvMenuColumns(screenWidth: number, optionCount: number): number {
  const count = Math.max(1, optionCount);
  if (count <= 1) return 1;
  const fitted = Math.max(1, Math.min(3, count, Math.floor(Math.max(0, screenWidth) / 260)));
  if (count === 4 && fitted > 2) return 2;
  return fitted;
}

const CARD_COPY_CHROME = 12;

/** Title and subtitle sizes that stay inside the card, readable from the couch. */
export function tvCardCopy(cardHeight: number, compact: boolean): { titleSize: number; detailSize: number; detailLines: 1 | 2 } {
  let titleSize = Math.min(compact ? 28 : 34, Math.max(16, Math.floor(cardHeight * 0.26)));
  let detailSize = Math.min(compact ? 16 : 20, Math.max(12, Math.floor(cardHeight * 0.14)));
  const block = (lines: number) => titleSize + 2 + (detailSize + 2) * lines + CARD_COPY_CHROME;
  let detailLines: 1 | 2 = block(2) <= cardHeight ? 2 : 1;
  while (block(detailLines) > cardHeight && titleSize > 14) {
    titleSize -= 1;
    if (detailSize > 12) detailSize -= 1;
  }
  if (block(detailLines) > cardHeight) detailLines = 1;
  return { titleSize, detailSize, detailLines };
}

/**
 * Sizes a TV option list so every built-in choice fits on one 720p or 1080p screen.
 * `reservedBottom` is for a pinned control such as Start. The tab bar is already outside this viewport.
 * Card text is sized to the card. The minimum card height never pushes the list into a scroll.
 */
export function tvHomeLayout(
  screenWidth: number,
  screenHeight: number,
  optionCount: number,
  reservedBottom = 0,
): TvHomeLayout {
  const count = Math.max(1, optionCount);
  const columns = tvMenuColumns(screenWidth, count);
  const rows = Math.max(1, Math.ceil(count / columns));
  const tab = tabBarControlSize(true, screenHeight);
  const tabBlock = tab.barContentHeight + 16;
  const viewportHeight = Math.max(0, screenHeight - tabBlock - Math.max(0, reservedBottom));
  const compact = screenHeight < 1000 || viewportHeight < 520;
  const padTop = compact ? 10 : 20;
  const padBottom = compact ? 4 : 6;
  const stackGap = compact ? 4 : 6;
  const gridGap = compact ? 8 : 12;
  const wordmarkSize = compact ? 14 : 18;
  const gymSize = compact ? 24 : 36;
  const sectionSize = compact ? 14 : 18;
  const hintSize = compact ? 14 : 18;
  // Line boxes are 4px taller than the font so Oswald is not clipped.
  const header = padTop + (wordmarkSize + 4) + stackGap + (gymSize + 4) + stackGap + (sectionSize + 4) + stackGap;
  const footer = stackGap + (hintSize + 4) + padBottom;
  const gridExtra = rows * gridGap;
  const room = viewportHeight - header - footer - gridExtra;
  const cardHeight = Math.max(1, Math.floor(room / rows));
  const contentHeight = header + footer + rows * cardHeight + gridExtra;
  const copy = tvCardCopy(cardHeight, compact);
  return {
    columns,
    rows,
    cardHeight,
    ...copy,
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
