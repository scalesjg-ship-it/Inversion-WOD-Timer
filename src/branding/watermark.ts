/** Share of the shorter screen edge used by a centered watermark. */
export const WATERMARK_SCALE = 0.88;

/** Low enough that a near full-screen mark does not compete with the digits. */
export const WATERMARK_OPACITY = 0.16;

export function watermarkFrame(width: number, height: number): { size: number; left: number; top: number } {
  const size = Math.min(width, height) * WATERMARK_SCALE;
  return {
    size,
    left: (width - size) / 2,
    top: (height - size) / 2,
  };
}
