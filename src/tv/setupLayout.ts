import { TV_FOCUS_BORDER, TV_FOCUS_SCALE, stepperControlSize, tvTabBarHeight } from './controls';
import { TV_OVERSCAN, tvFocusGutter, tvSafeBox, tvScaled } from './layout';

export interface StepperLinks {
  dec: number | null;
  inc: number | null;
}

export interface StepperFocus {
  decLeft: number | null;
  decRight: number | null;
  incLeft: number | null;
  incRight: number | null;
}

/**
 * Left and Right stay on this [-] value [+] cluster.
 * `outsideLeft` / `outsideRight` join the next cluster on the same row.
 */
export function stepperFocus(links: StepperLinks, outsideLeft: number | null, outsideRight: number | null): StepperFocus {
  return {
    decLeft: outsideLeft ?? links.dec,
    decRight: links.inc,
    incLeft: links.dec,
    incRight: outsideRight ?? links.inc,
  };
}

export interface TvSetupMetrics {
  labelWidth: number;
  labelSize: number;
  labelLine: number;
  /** Space between stacked rows. Holds the focus scale so a ring does not cover the next row. */
  rowGap: number;
  controlGap: number;
  button: number;
  /** Digits plus the unit. A fixed slot, not a share of the screen. */
  valueSlot: number;
  /** One [-] value [+] group. */
  cluster: number;
  /** Label plus minutes and seconds. */
  timeRow: number;
  /** Label plus hours, minutes, and seconds. */
  durationRow: number;
}

/** Width of a couch form. Clusters stay on their values instead of stretching to the bezel. */
export function tvSetupMetrics(width: number, height: number): TvSetupMetrics {
  const step = stepperControlSize(true, height > 0 ? height : 1080, true);
  const labelSize = tvScaled(26, width, height);
  const labelWidth = tvScaled(168, width, height);
  const controlGap = tvScaled(20, width, height);
  const focusGap = Math.ceil(step.button * (TV_FOCUS_SCALE - 1)) + 2;
  const rowGap = Math.max(tvScaled(12, width, height), focusGap);
  // Wide enough for "180 min" at the value size. The slot does not grow with the screen.
  const valueSlot = Math.max(step.valueMinWidth + tvScaled(44, width, height), Math.ceil(step.value * 5.2));
  const cluster = step.button + step.gap + valueSlot + step.gap + step.button;
  return {
    labelWidth,
    labelSize,
    labelLine: labelSize + tvScaled(4, width, height),
    rowGap,
    controlGap,
    button: step.button,
    valueSlot,
    cluster,
    timeRow: labelWidth + controlGap + cluster * 2 + controlGap,
    durationRow: labelWidth + controlGap + cluster * 3 + controlGap * 2,
  };
}

/** Built-in round cards plus the editor under them. */
export const TV_ROUNDS_FORM_ROWS = 4;

export interface TvRoundsLayout {
  padTop: number;
  padBottom: number;
  padHorizontal: number;
  titleSize: number;
  titleLine: number;
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  cardWidth: number;
  cardHeight: number;
  titleFont: number;
  detailFont: number;
  gutterX: number;
  gutterY: number;
  rowGap: number;
  contentHeight: number;
  viewportHeight: number;
  scrolls: boolean;
  formWidth: number;
}

/**
 * Rounds tab for a television, under the tab bar and inside overscan.
 * Cards hug the name and the round length, and stay under a third of a two-row fill.
 * A focused card scales inside its cell and does not cover the neighbor.
 */
export function tvRoundsLayout(screenWidth: number, screenHeight: number, presetCount = 4): TvRoundsLayout {
  const width = screenWidth > 0 ? screenWidth : 1920;
  const height = screenHeight > 0 ? screenHeight : 1080;
  const safe = tvSafeBox(true, width, height);
  const viewportHeight = Math.max(1, height - tvTabBarHeight(height, 0, width));
  const metrics = tvSetupMetrics(width, height);
  const padHorizontal = safe.horizontal;
  let padBottom = safe.vertical;
  let padTop = Math.max(8, tvScaled(12, width, height));
  const padBottomFloor = Math.max(4, Math.round(height * TV_OVERSCAN));
  const padTopFloor = 4;
  const innerWidth = Math.max(1, width - padHorizontal * 2);
  const columns = presetCount <= 1 ? 1 : 2;
  const count = Math.max(1, presetCount);
  const cardRows = Math.max(1, Math.ceil(count / columns));
  const titleSize = tvScaled(36, width, height);
  const titleLine = titleSize + tvScaled(6, width, height);
  const titleFont = tvScaled(26, width, height);
  const detailFont = tvScaled(18, width, height);
  // Padding, name line, gap, meta line, and the focus border drawn inside the card.
  const border = tvScaled(TV_FOCUS_BORDER, width, height);
  const textHeight = titleFont + detailFont + 34 + border * 2;
  const cellWidth = Math.max(1, Math.floor(innerWidth / columns));
  let gutterX = Math.max(tvFocusGutter(cellWidth), tvScaled(8, width, height));
  if (gutterX * 2 >= cellWidth) gutterX = Math.max(0, Math.floor((cellWidth - 1) / 2));
  const cardWidth = Math.max(1, cellWidth - gutterX * 2);
  const rowBlock = Math.max(metrics.button, metrics.labelLine);
  const chip = Math.max(metrics.labelLine, tvScaled(52, width, height));
  const start = Math.max(metrics.button, tvScaled(72, width, height));
  const shelf = Math.max(36, tvScaled(44, width, height));
  const sceneForCards = Math.max(1, viewportHeight - padTop - padBottom - titleLine);
  const oldCell = Math.max(1, Math.floor(sceneForCards / cardRows));
  const oneThirdCap = Math.max(textHeight, Math.round(oldCell / 3 / TV_FOCUS_SCALE));

  const gapCount = 2 + (TV_ROUNDS_FORM_ROWS - 1) + 3;
  const measure = (nextCard: number, rowGap: number, top: number, bottom: number) => {
    const cellHeight = Math.max(nextCard + 2, Math.ceil(nextCard * TV_FOCUS_SCALE));
    const gutterY = Math.max(tvFocusGutter(cellHeight), Math.ceil((cellHeight - nextCard) / 2));
    const resolvedCell = Math.max(cellHeight, nextCard + gutterY * 2);
    const contentHeight =
      top +
      bottom +
      titleLine +
      rowGap * gapCount +
      cardRows * resolvedCell +
      TV_ROUNDS_FORM_ROWS * rowBlock +
      chip +
      start +
      shelf;
    return { cellHeight: resolvedCell, gutterY, contentHeight };
  };

  let cardHeight = Math.min(textHeight, oneThirdCap);
  let rowGap = metrics.rowGap;
  let fitted = measure(cardHeight, rowGap, padTop, padBottom);
  while (fitted.contentHeight > viewportHeight && cardHeight > textHeight) {
    cardHeight -= 1;
    fitted = measure(cardHeight, rowGap, padTop, padBottom);
  }
  while (fitted.contentHeight > viewportHeight && rowGap > 4) {
    rowGap -= 1;
    fitted = measure(cardHeight, rowGap, padTop, padBottom);
  }
  while (fitted.contentHeight > viewportHeight && (padBottom > padBottomFloor || padTop > padTopFloor)) {
    if (padBottom > padBottomFloor) padBottom -= 1;
    else padTop -= 1;
    fitted = measure(cardHeight, rowGap, padTop, padBottom);
  }

  return {
    padTop,
    padBottom,
    padHorizontal,
    titleSize,
    titleLine,
    columns,
    rows: cardRows,
    cellWidth,
    cellHeight: fitted.cellHeight,
    cardWidth,
    cardHeight,
    titleFont,
    detailFont,
    gutterX,
    gutterY: fitted.gutterY,
    rowGap,
    contentHeight: fitted.contentHeight,
    viewportHeight,
    scrolls: fitted.contentHeight > viewportHeight,
    formWidth: Math.min(metrics.timeRow, innerWidth),
  };
}
