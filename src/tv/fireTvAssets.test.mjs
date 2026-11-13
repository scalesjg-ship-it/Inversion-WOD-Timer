import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function readPng(path) {
  const buf = readFileSync(path);
  expect(buf.toString('ascii', 1, 4)).toBe('PNG');
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels) throw new Error(`unsupported PNG color type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const row = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[row - stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[row - stride + x - channels] : 0;
      pixels[row + x] = (raw[src] + reconstructed(filter, left, up, upLeft)) & 255;
      src += 1;
    }
  }
  return { width, height, channels, colorType, pixels };
}

function reconstructed(filter, left, up, upLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const diagonal = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= diagonal) return left;
  if (upDistance <= diagonal) return up;
  return upLeft;
}

function pixel(image, x, y) {
  const index = (y * image.width + x) * image.channels;
  return [image.pixels[index], image.pixels[index + 1], image.pixels[index + 2]];
}

function isMark(rgb) {
  const [red, green, blue] = rgb;
  const cream = red > 200 && green > 180 && blue > 160 && Math.abs(red - green) < 40;
  const ring = red > 180 && green < 110 && blue < 90;
  return cream || ring;
}

function markHits(image, box, step = 8) {
  let hits = 0;
  for (let y = box.top; y < box.bottom; y += step) {
    for (let x = box.left; x < box.right; x += step) {
      if (isMark(pixel(image, x, y))) hits += 1;
    }
  }
  return hits;
}

describe('Fire TV store and launcher art', () => {
  it('keeps the Americana name on main', () => {
    const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8'));
    expect(app.expo.name).toBe('Americana');
    expect(app.expo.android.package).toBe('com.garrettscales.americana');
  });

  it('puts a square mark on the Fire TV launcher icon', () => {
    const icon = readPng(join(ROOT, 'assets/tv/android-tv-icon.png'));
    expect(icon.width).toBe(icon.height);
    expect(icon.width).toBeGreaterThanOrEqual(320);
    expect(markHits(icon, { left: icon.width / 4, top: icon.height / 4, right: (icon.width * 3) / 4, bottom: (icon.height * 3) / 4 })).toBeGreaterThan(20);
    const banner = readPng(join(ROOT, 'assets/tv/android-tv-banner.png'));
    expect(banner.width).toBe(320);
    expect(banner.height).toBe(180);
  });

  it('places the hero mark in the right-hand safe zone, not the empty left side', () => {
    const hero = readPng(join(ROOT, 'assets/store/firetv-background-1920x1080.png'));
    expect(hero.width).toBe(1920);
    expect(hero.height).toBe(1080);
    expect(hero.colorType).toBe(2);
    expect(markHits(hero, { left: 1100, top: 150, right: 1850, bottom: 930 }, 12)).toBeGreaterThan(30);
    expect(markHits(hero, { left: 0, top: 0, right: 420, bottom: 1080 }, 12)).toBe(0);

    const wide = readPng(join(ROOT, 'assets/store/firetv-background-1280x720.png'));
    expect(wide.width).toBe(1280);
    expect(wide.height).toBe(720);
    expect(wide.colorType).toBe(2);
    expect(markHits(wide, { left: 430, top: 40, right: 850, bottom: 680 }, 10)).toBeGreaterThan(20);
  });
});
