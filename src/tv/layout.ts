import { TV_FOCUS_SCALE, tvTabBarHeight } from './controls';

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

/** Reference frame. Every TV length is this 1080p size times `tvScale`. */
export const TV_REF_WIDTH = 1920;
export const TV_REF_HEIGHT = 1080;

/** Apple TV overscan at 1080p. About 60pt horizontal and 80pt vertical. */
export const TV_SAFE_HORIZONTAL = 60;
export const TV_SAFE_VERTICAL = 80;

/**
 * Television overscan eats about 5% of each edge. The safe box is at least
 * this fraction of the window, and never smaller than the 1080p HIG inset
 * scaled with that window.
 */
export const TV_OVERSCAN = 0.05;

/** Couch-readable type at 1080p. Card titles stay inside the 48–60pt range. */
export const TV_MENU_FONT = 52;
export const TV_TITLE_FONT = 76;
export const TV_SECTION_FONT = 32;
export const TV_BODY_FONT = 36;

/**
 * Every menu row is fitted on screen. A later row must not start below the fold.
 * Focus gutters still keep a scaled card inside its cell.
 */

export function tvScale(width: number, height: number): number {
  const safeWidth = width > 0 ? width : TV_REF_WIDTH;
  const safeHeight = height > 0 ? height : TV_REF_HEIGHT;
  return Math.min(safeWidth / TV_REF_WIDTH, safeHeight / TV_REF_HEIGHT);
}

export function tvScaled(at1080: number, width: number, height: number): number {
  return Math.max(1, Math.round(at1080 * tvScale(width, height)));
}

export function tvSafeBox(tv: boolean, width = TV_REF_WIDTH, height = TV_REF_HEIGHT): { horizontal: number; vertical: number } {
  if (!tv) return { horizontal: 0, vertical: 0 };
  const safeWidth = width > 0 ? width : TV_REF_WIDTH;
  const safeHeight = height > 0 ? height : TV_REF_HEIGHT;
  const scale = tvScale(safeWidth, safeHeight);
  return {
    horizontal: Math.max(Math.round(safeWidth * TV_OVERSCAN), Math.round(TV_SAFE_HORIZONTAL * scale)),
    vertical: Math.max(Math.round(safeHeight * TV_OVERSCAN), Math.round(TV_SAFE_VERTICAL * scale)),
  };
}

const SCALED_STYLE_KEYS = new Set([
  'fontSize',
  'lineHeight',
  'minHeight',
  'height',
  'width',
  'minWidth',
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginHorizontal',
  'marginVertical',
  'borderRadius',
  'borderWidth',
  'gap',
  'letterSpacing',
]);

/** Multiply a plain TV style's lengths by the window scale. A 1080p scale of 1 is a copy. */
export function scaleTvStyle<T extends Record<string, unknown>>(style: T, scale: number): T {
  if (scale === 1) return style;
  const next = { ...style };
  for (const key of Object.keys(next)) {
    const value = next[key];
    if (typeof value === 'number' && SCALED_STYLE_KEYS.has(key)) {
      (next as Record<string, unknown>)[key] = Math.round(value * scale);
    }
  }
  return next;
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
  visibleRows: number;
  cardHeight: number;
  cardWidth: number;
  titleSize: number;
  detailSize: number;
  /** How many subtitle lines fit inside the card. */
  detailLines: 1 | 2 | 3;
  gutterX: number;
  gutterTop: number;
  gutterBottom: number;
  /** Outer width of one cell, including the focus gutter. Rows of these stay inside the safe box. */
  cellWidth: number;
  gymSize: number;
  gymLine: number;
  wordmarkSize: number;
  wordmarkLine: number;
  sectionSize: number;
  sectionLine: number;
  hintSize: number;
  hintLine: number;
  stackGap: number;
  gridGap: number;
  padTop: number;
  padBottom: number;
  padHorizontal: number;
  tabBlock: number;
  headerHeight: number;
  rowHeight: number;
  contentHeight: number;
  viewportHeight: number;
  /** True when later rows start at or below the bottom of the viewport. */
  scrolls: boolean;
}

/** Width that places `columns` cells on one row. Four decimals stay under 100% so the row does not wrap. */
export function tvColumnBasis(columns: number): string {
  const count = Math.max(1, columns);
  return `${(100 / count).toFixed(4)}%`;
}

/**
 * Cell padding that keeps a `TV_FOCUS_SCALE` transform inside the cell.
 * The focused card grows from its center and must not cover the neighbor.
 */
export function tvFocusGutter(span: number, focusScale = TV_FOCUS_SCALE): number {
  if (span <= 0 || focusScale <= 1) return 0;
  return Math.ceil((span * (1 - 1 / focusScale)) / 2);
}

/**
 * Column count for a TV option list.
 * Six conditioning modes use three columns. Four round presets stay a pair.
 */
export function tvMenuColumns(screenWidth: number, optionCount: number): number {
  const count = Math.max(1, optionCount);
  if (count <= 1) return 1;
  const fitted = Math.max(1, Math.min(3, count, Math.floor(Math.max(0, screenWidth) / 260)));
  if (count === 4 && fitted > 2) return 2;
  return fitted;
}

const CARD_COPY_CHROME = 12;

/** Title and subtitle sizes that stay inside the card and still read from the couch. */
export function tvCardCopy(cardHeight: number, scale: number): { titleSize: number; detailSize: number; detailLines: 1 | 2 | 3 } {
  const safeScale = scale > 0 ? scale : 1;
  const titleCap = Math.max(1, Math.round(TV_MENU_FONT * safeScale));
  const detailCap = Math.max(1, Math.round(TV_BODY_FONT * safeScale));
  const titleMin = Math.max(1, Math.round(28 * safeScale));
  const detailMin = Math.max(1, Math.round(22 * safeScale));
  let titleSize = Math.min(titleCap, Math.max(titleMin, Math.floor(cardHeight * 0.18)));
  let detailSize = Math.min(detailCap, Math.max(detailMin, Math.floor(cardHeight * 0.1)));
  const block = (lines: number) => titleSize + Math.round(4 * safeScale) + (detailSize + Math.round(4 * safeScale)) * lines + Math.round(CARD_COPY_CHROME * safeScale);
  let detailLines: 1 | 2 | 3 = 3;
  if (block(3) > cardHeight) detailLines = 2;
  if (block(detailLines) > cardHeight) detailLines = 1;
  while (block(detailLines) > cardHeight && (titleSize > titleMin || detailSize > detailMin)) {
    if (titleSize > titleMin) titleSize -= 1;
    if (detailSize > detailMin) detailSize -= 1;
  }
  while (block(detailLines) > cardHeight && titleSize > 1) {
    titleSize -= 1;
    if (detailSize > 1) detailSize -= 1;
  }
  return { titleSize, detailSize, detailLines };
}

export interface TvMenuOptions {
  /** Space already taken inside the scene, such as a pinned footer. */
  reservedBottom?: number;
  /** Home stack (wordmark, gym, section) or a grid with no title block. */
  header?: 'home' | 'none';
  /** Apply the 1080p overscan box. Turn off when the parent already padded. */
  insets?: boolean;
  /** Reserve a body-sized hint under the grid. Home menus do. A bare grid does not. */
  hint?: boolean;
  /**
   * Full window height. Type and overscan follow the window, not the shorter
   * scene left above the tab bar. Defaults to `screenHeight`.
   */
  windowHeight?: number;
}

function readMenuOptions(
  reservedOrOptions: number | TvMenuOptions | undefined,
): Required<Pick<TvMenuOptions, 'reservedBottom' | 'header' | 'insets' | 'hint'>> & { windowHeight?: number } {
  if (typeof reservedOrOptions === 'number') {
    return { reservedBottom: reservedOrOptions, header: 'home', insets: true, hint: true };
  }
  const header = reservedOrOptions?.header ?? 'home';
  return {
    reservedBottom: reservedOrOptions?.reservedBottom ?? 0,
    header,
    insets: reservedOrOptions?.insets !== false,
    hint: reservedOrOptions?.hint ?? header === 'home',
    windowHeight: reservedOrOptions?.windowHeight,
  };
}

/**
 * Scene height for a menu that must sit above the tab bar.
 * A measured scroll view that is already shorter than the window is used as-is.
 * A full-window measurement means the tab bar is covering the scene, so the bar is removed.
 */
export function tvMenuSceneHeight(measuredHeight: number, windowHeight: number, extraChrome = 0): number {
  const tab = tvTabBarHeight(windowHeight);
  if (measuredHeight <= 0) return Math.max(1, windowHeight - tab - extraChrome);
  if (measuredHeight > windowHeight - tab * 0.5) return Math.max(1, measuredHeight - tab - extraChrome);
  return Math.max(1, measuredHeight);
}

/**
 * Sizes a TV menu so every card in the set sits on one screen, inside the safe area.
 * Cell gutters hold the focus scale, so a focused card cannot cover its neighbor or leave the cell.
 * `screenHeight` is the scene, not the full window, when the tab bar is already outside it.
 *
 * Type and overscan follow the window in dp. A Fire TV often reports 960×540 or 1280×720
 * for a 1080p panel, and a 4K panel often reports 1920×1080 or 960×540. Scaling against
 * 1920×1080 keeps the same physical size; card height comes from dividing the leftover
 * scene by the row count, not from stretching one row to the bezel.
 */
export function tvHomeLayout(
  screenWidth: number,
  screenHeight: number,
  optionCount: number,
  reservedOrOptions: number | TvMenuOptions = 0,
): TvHomeLayout {
  const options = readMenuOptions(reservedOrOptions);
  const count = Math.max(1, optionCount);
  const scaleHeight = options.windowHeight && options.windowHeight > 0 ? options.windowHeight : screenHeight;
  const scale = tvScale(screenWidth, scaleHeight);
  const safe = tvSafeBox(true, screenWidth, scaleHeight);
  const columns = tvMenuColumns(screenWidth, count);
  const rows = Math.max(1, Math.ceil(count / columns));
  const visibleRows = rows;
  const padHorizontal = options.insets ? safe.horizontal : 0;
  const padTop = options.insets ? safe.vertical : 0;
  const contentWidth = Math.max(1, screenWidth - padHorizontal * 2);
  const stackGap = Math.max(4, Math.round(8 * scale));
  const lineExtra = Math.max(2, Math.round(4 * scale));
  const wordmarkSize = options.header === 'home' ? Math.max(1, Math.round(22 * scale)) : 0;
  const gymSize = options.header === 'home' ? Math.max(1, Math.round(40 * scale)) : 0;
  const sectionSize = options.header === 'home' ? Math.max(1, Math.round(TV_SECTION_FONT * scale)) : 0;
  const hintSize = Math.max(1, Math.round(TV_BODY_FONT * scale));
  const wordmarkLine = wordmarkSize === 0 ? 0 : wordmarkSize + lineExtra;
  const gymLine = gymSize === 0 ? 0 : gymSize + lineExtra;
  const sectionLine = sectionSize === 0 ? 0 : sectionSize + lineExtra;
  const hintLine = options.hint ? hintSize + lineExtra : 0;
  const headerHeight = options.header === 'home'
    ? padTop + wordmarkLine + stackGap + gymLine + stackGap + sectionLine + stackGap
    : padTop;
  // Gap before the hint, the hint line, and the content bottom padding. Matches the home screen.
  const hintBlock = options.hint ? stackGap + hintLine + stackGap : 0;
  const viewportHeight = Math.max(0, screenHeight);
  const room = Math.max(rows, viewportHeight - headerHeight - hintBlock - Math.max(0, options.reservedBottom));
  const rowHeight = Math.max(1, Math.floor(room / rows));
  const cellWidth = Math.max(1, Math.floor(contentWidth / columns));
  let gutterX = Math.max(tvFocusGutter(cellWidth), Math.round(12 * scale));
  if (gutterX * 2 >= cellWidth) gutterX = Math.max(0, Math.floor((cellWidth - 1) / 2));
  const focusY = tvFocusGutter(rowHeight);
  let gutterTop = Math.max(focusY, Math.round(8 * scale));
  let gutterBottom = gutterTop;
  if (gutterTop + gutterBottom >= rowHeight) {
    const budget = Math.max(0, rowHeight - 1);
    const share = Math.max(1, gutterTop + gutterBottom);
    gutterTop = Math.floor((budget * gutterTop) / share);
    gutterBottom = budget - gutterTop;
  }
  const cardHeight = Math.max(1, rowHeight - gutterTop - gutterBottom);
  const cardWidth = Math.max(1, cellWidth - gutterX * 2);
  const copy = tvCardCopy(cardHeight, scale);
  const contentHeight = headerHeight + rows * rowHeight + hintBlock + Math.max(0, options.reservedBottom);
  return {
    columns,
    rows,
    visibleRows,
    cardHeight,
    cardWidth,
    ...copy,
    gutterX,
    gutterTop,
    gutterBottom,
    cellWidth,
    gymSize,
    gymLine,
    wordmarkSize,
    wordmarkLine,
    sectionSize,
    sectionLine,
    hintSize,
    hintLine,
    stackGap,
    gridGap: gutterX * 2,
    padTop,
    padBottom: gutterBottom,
    padHorizontal,
    tabBlock: 0,
    headerHeight,
    rowHeight,
    contentHeight,
    viewportHeight,
    scrolls: contentHeight > viewportHeight + 1,
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
  const scale = screenHeight > TV_REF_HEIGHT ? screenHeight / TV_REF_HEIGHT : 1;
  const logoCap = Math.round((compact ? 112 : 168) * scale);
  const logoFloor = Math.round(96 * (compact ? 1 : scale));
  return {
    logo: hasLogo ? Math.round(Math.min(logoCap, Math.max(logoFloor, screenHeight * 0.15))) : 0,
    name: Math.round((compact ? 36 : 56) * scale),
    phase: Math.round((compact ? 28 : 44) * scale),
  };
}
