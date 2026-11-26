import { TV_FOCUS_BORDER } from './controls';
import { scaleTvStyle, tvScale } from './layout';

/**
 * 1080p transport button. BigButton scales these with `tvScale`.
 * The gap stays 24 until the row has to shrink, matching the timer row.
 */
const TRANSPORT_AT_1080 = {
  minHeight: 72,
  borderRadius: 18,
  paddingHorizontal: 36,
  minWidth: 240,
  fontSize: 32,
  letterSpacing: 1.2,
};

export interface TvTransportButtonMetrics {
  minWidth: number;
  minHeight: number;
  padX: number;
  radius: number;
  fontSize: number;
  letterSpacing: number;
  gap: number;
}

export interface TvAppleTimerFrame {
  button: TvTransportButtonMetrics;
  rowWidth: number;
  rowHeight: number;
  columnHeight: number;
  inset: number;
  /** Distance from the bottom of the screen to the bottom of the clock face. */
  faceBottom: number;
  /** Y of the top of the transport column, including the link status line. */
  transportTop: number;
  /** Lowest Y the cap / mode / Paused block can reach. It sits on the face bottom. */
  statusBottom: number;
  metaBlock: number;
  linkFont: number;
  linkLine: number;
  linkGap: number;
}

function scaledLine(at1080: number, scale: number): number {
  return scale === 1 ? at1080 : Math.round(at1080 * scale);
}

/**
 * Height under the digits for the cap, the workout name, and the optional
 * warning and Paused lines. Round and label follow `scaleTvStyle`. Warning
 * and Paused stay at the stylesheet size.
 */
export function tvTimerMetaBlock(scale: number, lines: { warning: boolean; paused: boolean }): number {
  let height = 8 + scaledLine(64, scale) + scaledLine(40, scale);
  if (lines.warning) height += 8 + 36;
  if (lines.paused) height += 8 + 34;
  return height;
}

/**
 * Apple TV clock column. The transport row, including Watch, is centered in
 * the safe area. Status text ends above that row.
 * Fire TV keeps the left-aligned row and does not use this frame.
 */
export function tvAppleTimerFrame(input: {
  screenWidth: number;
  screenHeight: number;
  safeBottom: number;
  safeHorizontal: number;
  buttonCount: number;
  linkStatus: boolean;
  /** Lines reserved under the clock for the watch status. Defaults to 2. */
  linkRows?: number;
  warning: boolean;
  paused: boolean;
}): TvAppleTimerFrame {
  const width = input.screenWidth > 0 ? input.screenWidth : 1920;
  const height = input.screenHeight > 0 ? input.screenHeight : 1080;
  const scale = tvScale(width, height);
  const preferred = scaleTvStyle({ ...TRANSPORT_AT_1080 }, scale);
  const count = Math.max(1, input.buttonCount);
  const inset = Math.max(0, input.safeHorizontal);
  const available = Math.max(1, width - inset * 2 - count * TV_FOCUS_BORDER * 2);
  let minWidth = preferred.minWidth;
  let gap = 24;
  let rowWidth = count * minWidth + (count - 1) * gap;
  let shrink = 1;
  if (rowWidth > available) {
    shrink = available / rowWidth;
    minWidth = Math.max(1, Math.floor(minWidth * shrink));
    gap = Math.max(0, Math.floor(24 * shrink));
    rowWidth = count * minWidth + Math.max(0, count - 1) * gap;
    while (rowWidth > available && minWidth > 1) {
      minWidth -= 1;
      rowWidth = count * minWidth + Math.max(0, count - 1) * gap;
    }
  }
  const minHeight = shrink === 1 ? preferred.minHeight : Math.max(1, Math.floor(preferred.minHeight * shrink));
  const fontSize = shrink === 1 ? preferred.fontSize : Math.max(1, Math.floor(preferred.fontSize * shrink));
  const letterSpacing =
    shrink === 1 ? preferred.letterSpacing : Math.max(0, Math.round(preferred.letterSpacing * shrink));
  const padX =
    shrink === 1 ? preferred.paddingHorizontal : Math.max(1, Math.floor(preferred.paddingHorizontal * shrink));
  const radius = shrink === 1 ? preferred.borderRadius : Math.max(1, Math.floor(preferred.borderRadius * shrink));
  const linkFont = scaledLine(28, scale);
  const linkLine = scaledLine(36, scale);
  const linkGap = scaledLine(8, scale);
  const linkRows = input.linkStatus ? Math.max(1, input.linkRows ?? 2) : 0;
  const linkBlock = linkRows > 0 ? linkLine * linkRows + linkGap : 0;
  const columnHeight = linkBlock + minHeight;
  const separation = Math.max(12, scaledLine(12, scale));
  const controlsLift = Math.max(0, input.safeBottom) + 8;
  const faceBottom = controlsLift + columnHeight + separation;
  return {
    button: { minWidth, minHeight, padX, radius, fontSize, letterSpacing, gap },
    rowWidth,
    rowHeight: minHeight,
    columnHeight,
    inset,
    faceBottom,
    transportTop: height - controlsLift - columnHeight,
    statusBottom: height - faceBottom,
    metaBlock: tvTimerMetaBlock(scale, { warning: input.warning, paused: input.paused }),
    linkFont,
    linkLine,
    linkGap,
  };
}

/** Left edge of a row centered inside the safe width. */
export function tvTransportLeft(screenWidth: number, inset: number, rowWidth: number): number {
  const content = Math.max(0, screenWidth - inset * 2);
  return inset + Math.max(0, (content - rowWidth) / 2);
}
