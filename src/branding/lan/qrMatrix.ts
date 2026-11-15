import { encode } from 'uqr';

/** Drawn size at 1080p. `tvScale` multiplies it for the window. */
export const QR_MARK_AT_1080 = 240;

/** Four light modules, the quiet zone a phone camera expects. */
export const QR_QUIET_ZONE = 4;

/**
 * Module matrix for `value`, quiet zone included.
 * `uqr` is pure JavaScript: no `crypto`, no `TextEncoder`. Hermes on a TV has neither.
 */
export function qrModules(value: string): boolean[][] {
  return encode(value, { ecc: 'M', border: QR_QUIET_ZONE, boostEcc: false }).data;
}

export function moduleRuns(row: readonly boolean[]): { dark: boolean; length: number }[] {
  const runs: { dark: boolean; length: number }[] = [];
  let index = 0;
  while (index < row.length) {
    const dark = row[index] === true;
    let length = 1;
    while (index + length < row.length && (row[index + length] === true) === dark) length += 1;
    runs.push({ dark, length });
    index += length;
  }
  return runs;
}

/** One SVG path in module coordinates. Light modules, including the quiet zone, are left blank. */
export function qrSvgPath(matrix: readonly (readonly boolean[])[]): string {
  let path = '';
  for (let y = 0; y < matrix.length; y += 1) {
    const row = matrix[y] ?? [];
    let x = 0;
    for (const run of moduleRuns(row)) {
      if (run.dark) path += `M${x} ${y}h${run.length}v1H${x}z`;
      x += run.length;
    }
  }
  return path;
}

/** Integer module pixels, and never smaller than `target`. */
export function qrMarkSide(target: number, modules: number): number {
  const count = Math.max(1, Math.floor(modules));
  const safeTarget = Math.max(count, Math.round(target));
  const modulePx = Math.max(1, Math.ceil(safeTarget / count));
  return modulePx * count;
}
