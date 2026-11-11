/** Share of the shorter screen edge used by a centered watermark. */
export const WATERMARK_SCALE = 0.88;

/** Low enough that a near full-screen mark does not compete with the digits. */
export const WATERMARK_OPACITY = 0.16;

/** Minimum gap between the mark and the screen edge when insets are zero. */
const EDGE_GUTTER = 8;

export interface WatermarkInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Largest square that stays inside the safe area and shares the screen's
 * center axis. Callers draw the logo with contain inside this square.
 */
export function watermarkFrame(
  width: number,
  height: number,
  insets: WatermarkInsets = { top: 0, right: 0, bottom: 0, left: 0 },
): { size: number; left: number; top: number } {
  const gutterX = Math.max(EDGE_GUTTER, insets.left, insets.right, 0);
  const gutterY = Math.max(EDGE_GUTTER, insets.top, insets.bottom, 0);
  const maxWidth = Math.max(0, width - gutterX * 2);
  const maxHeight = Math.max(0, height - gutterY * 2);
  const size = Math.min(Math.min(width, height) * WATERMARK_SCALE, maxWidth, maxHeight);
  return {
    size,
    left: (width - size) / 2,
    top: (height - size) / 2,
  };
}
