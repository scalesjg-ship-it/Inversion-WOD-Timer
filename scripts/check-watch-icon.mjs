import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ICON = join(ROOT, 'targets/watch/Assets.xcassets/AppIcon.appiconset/AppIcon.png');
const CONTENTS = join(ROOT, 'targets/watch/Assets.xcassets/AppIcon.appiconset/Contents.json');
const PLUGIN = join(ROOT, 'plugins/withAppleWatch.js');
const PLIST = join(ROOT, 'targets/watch/Info.plist');
const BACKGROUND = [12, 13, 16];
const TOLERANCE = 12;

function readPng(path) {
  const buf = readFileSync(path);
  if (buf.toString('ascii', 1, 4) !== 'PNG') {
    throw new Error(`${path} is not a PNG`);
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let hasTrns = false;
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
    } else if (type === 'tRNS') {
      hasTrns = true;
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
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
  return { width, height, channels, colorType, hasTrns, pixels };
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
  const rgb = [image.pixels[index], image.pixels[index + 1], image.pixels[index + 2]];
  const alpha = image.channels === 4 ? image.pixels[index + 3] : 255;
  return { rgb, alpha };
}

function nearBackground(rgb) {
  return rgb.every((channel, index) => Math.abs(channel - BACKGROUND[index]) <= TOLERANCE);
}

function contentBox(image) {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const sample = pixel(image, x, y);
      if (sample.alpha < 16 || nearBackground(sample.rgb)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function inspectWatchIcon() {
  const errors = [];
  const image = readPng(ICON);
  const box = contentBox(image);
  const fillWidth = box ? (box.width / image.width) * 100 : 0;
  const fillHeight = box ? (box.height / image.height) * 100 : 0;
  const corners = [
    pixel(image, 0, 0),
    pixel(image, image.width - 1, 0),
    pixel(image, 0, image.height - 1),
    pixel(image, image.width - 1, image.height - 1),
  ];
  const midX = Math.floor(image.width / 2);
  const midY = Math.floor(image.height / 2);
  const edges = [
    pixel(image, midX, 0),
    pixel(image, midX, image.height - 1),
    pixel(image, 0, midY),
    pixel(image, image.width - 1, midY),
  ];
  const contents = JSON.parse(readFileSync(CONTENTS, 'utf8'));
  const plugin = readFileSync(PLUGIN, 'utf8');
  const plist = readFileSync(PLIST, 'utf8');
  const images = Array.isArray(contents.images) ? contents.images : [];
  const iconEntry = images[0] ?? {};

  if (image.width !== 1024 || image.height !== 1024) {
    errors.push(`expected 1024x1024, got ${image.width}x${image.height}`);
  }
  if (image.colorType !== 2 || image.hasTrns || image.channels !== 3) {
    errors.push(`expected opaque RGB (color type 2, no tRNS), got color type ${image.colorType}`);
  }
  if (!box || fillWidth < 98 || fillHeight < 98) {
    errors.push(`content fill is ${fillWidth.toFixed(2)}% x ${fillHeight.toFixed(2)}%; the mark must reach the canvas`);
  }
  if (corners.some((sample) => sample.alpha !== 255 || !nearBackground(sample.rgb))) {
    errors.push('corners must stay the opaque square background, with no circular mask');
  }
  if (edges.some((sample) => nearBackground(sample.rgb))) {
    errors.push('edge midpoints are still background, so the mark is inset');
  }
  if (images.length !== 1) {
    errors.push(`Contents.json should have one watchOS image, found ${images.length}`);
  }
  if (
    iconEntry.idiom !== 'universal' ||
    iconEntry.platform !== 'watchos' ||
    iconEntry.size !== '1024x1024' ||
    iconEntry.filename !== 'AppIcon.png'
  ) {
    errors.push(`Contents.json entry is ${JSON.stringify(iconEntry)}`);
  }
  if (!plugin.includes("ASSETCATALOG_COMPILER_APPICON_NAME: 'AppIcon'")) {
    errors.push('watch target is missing ASSETCATALOG_COMPILER_APPICON_NAME AppIcon');
  }
  if (!plugin.includes("addResourceFile('Assets.xcassets'")) {
    errors.push('watch target does not compile Assets.xcassets');
  }
  if (!plist.includes('<key>CFBundleIconName</key>') || !plist.includes('<string>AppIcon</string>')) {
    errors.push('Watch Info.plist CFBundleIconName must be AppIcon');
  }

  return {
    ok: errors.length === 0,
    errors,
    width: image.width,
    height: image.height,
    colorType: image.colorType,
    hasAlpha: image.colorType !== 2 || image.hasTrns,
    box,
    fillWidth,
    fillHeight,
    corners: corners.map((sample) => sample.rgb),
    edges: edges.map((sample) => sample.rgb),
  };
}

function report(result) {
  const box = result.box
    ? `x=${result.box.x} y=${result.box.y} ${result.box.width}x${result.box.height}`
    : 'none';
  const lines = [
    'Watch AppIcon',
    `  dimensions: ${result.width}x${result.height}`,
    `  color type: ${result.colorType} (${result.hasAlpha ? 'has alpha' : 'RGB, no alpha'})`,
    `  content bounding box: ${box}`,
    `  content fill: width ${result.fillWidth.toFixed(2)}% height ${result.fillHeight.toFixed(2)}%`,
    `  corners: ${result.corners.map((rgb) => rgb.join(',')).join(' | ')}`,
    `  edge midpoints: ${result.edges.map((rgb) => rgb.join(',')).join(' | ')}`,
    `  result: ${result.ok ? 'ok' : 'failed'}`,
  ];
  if (!result.ok) lines.push(...result.errors.map((error) => `  error: ${error}`));
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = inspectWatchIcon();
  console.log(report(result));
  if (!result.ok) process.exit(1);
}
