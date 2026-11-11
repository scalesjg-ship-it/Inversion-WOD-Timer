import { encode } from 'uqr';

export function qrModules(value: string): boolean[][] {
  return encode(value, { ecc: 'M', border: 4 }).data;
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
