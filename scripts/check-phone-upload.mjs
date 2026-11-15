import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN = 'ab'.repeat(16);

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'scripts/logo-page-server.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: '/tmp/logo-page-server.mjs',
  external: ['expo-crypto', 'expo', 'expo-modules-core', 'react-native', 'react-native-get-random-values'],
});

const { startLogoPage } = await import('/tmp/logo-page-server.mjs');
const puppeteer = require(process.env.PUPPETEER_CORE);

function writePng(file, width, height, paint) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const [r, g, b] = paint(x, y);
      png.data[index] = r;
      png.data[index + 1] = g;
      png.data[index + 2] = b;
      png.data[index + 3] = 255;
    }
  }
  writeFileSync(file, PNG.sync.write(png));
}

function jpegSize(bytes) {
  let index = 2;
  while (index < bytes.length - 8) {
    if (bytes[index] !== 0xff) {
      index += 1;
      continue;
    }
    const marker = bytes[index + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: (bytes[index + 5] << 8) | bytes[index + 6], width: (bytes[index + 7] << 8) | bytes[index + 8] };
    }
    const length = (bytes[index + 2] << 8) | bytes[index + 3];
    if (!length) break;
    index += 2 + length;
  }
  return null;
}

function sniff(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  return 'other';
}

writePng('/tmp/wide-logo.png', 2400, 1800, (x, y) => [40 + (x % 180), 20 + (y % 80), 200]);
writePng('/tmp/small-logo.png', 320, 240, () => [220, 40, 30]);

async function runCase(browser, label, file, expect) {
  const server = await startLogoPage();
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error(label, 'PAGE', error));
  try {
    await page.goto(`http://127.0.0.1:${server.port}/?t=${TOKEN}`, { waitUntil: 'networkidle0' });
    const field = await page.$eval('input[type=file]', (node) => ({
      accept: node.getAttribute('accept'),
      capture: node.hasAttribute('capture'),
    }));
    if (field.accept !== 'image/*' || field.capture) {
      throw new Error(`${label} file input ${JSON.stringify(field)}`);
    }
    const input = await page.$('input[type=file]');
    if (typeof input.uploadFile === 'function') await input.uploadFile(file);
    else await input.setInputFiles(file);
    await page.click('button[type=submit]');
    await page.waitForFunction(
      () => document.getElementById('note')?.textContent?.includes('The TV has the logo'),
      { timeout: 20000 },
    );
    const ui = await page.$eval('#note', (node) => ({
      text: node.textContent,
      className: node.className,
      title: document.getElementById('title')?.textContent ?? '',
      formHidden: document.querySelector('form')?.hidden ?? false,
    }));
    const saved = server.saved[0];
    if (!saved) throw new Error(`${label} saved nothing. ui=${JSON.stringify(ui)}`);
    const kind = sniff(saved.bytes);
    const size = kind === 'jpeg' ? jpegSize(saved.bytes) : null;
    console.log(label, {
      ui,
      kind,
      extension: saved.extension,
      bytes: saved.bytes.length,
      size,
    });
    if (ui.text !== 'The TV has the logo. You can close this page.' || ui.className !== 'ok' || ui.title !== 'Logo saved' || !ui.formHidden) {
      throw new Error(`${label} success UI ${JSON.stringify(ui)}`);
    }
    if (kind !== expect.kind) throw new Error(`${label} kind ${kind}`);
    if (expect.maxEdge && size && Math.max(size.width, size.height) > expect.maxEdge) {
      throw new Error(`${label} still ${size.width}x${size.height}`);
    }
  } finally {
    await page.close();
    server.close();
  }
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});
try {
  await runCase(browser, 'chrome-wide-png', '/tmp/wide-logo.png', { kind: 'jpeg', maxEdge: 1600 });
  await runCase(browser, 'chrome-small-png', '/tmp/small-logo.png', { kind: 'png' });
  const webpPage = await browser.newPage();
  const webp = await webpPage.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2200;
    canvas.height = 1400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#2244aa';
    context.fillRect(0, 0, 2200, 1400);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return Array.from(bytes);
  });
  await webpPage.close();
  writeFileSync('/tmp/wide-logo.webp', Buffer.from(webp));
  await runCase(browser, 'chrome-wide-webp', '/tmp/wide-logo.webp', { kind: 'jpeg', maxEdge: 1600 });
} finally {
  await browser.close();
}
console.log('chrome phone upload page ok');

const playwright = require('/tmp/pup/node_modules/playwright-core');
const webkit = await playwright.webkit.launch();
try {
  await runCase(webkit, 'webkit-wide-png', '/tmp/wide-logo.png', { kind: 'jpeg', maxEdge: 1600 });
  await runCase(webkit, 'webkit-small-png', '/tmp/small-logo.png', { kind: 'png' });
  const webkitPage = await webkit.newPage();
  const webkitWebp = await webkitPage.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2200;
    canvas.height = 1400;
    const context = canvas.getContext('2d');
    context.fillStyle = '#2244aa';
    context.fillRect(0, 0, 2200, 1400);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob) return null;
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await webkitPage.close();
  if (webkitWebp) {
    writeFileSync('/tmp/wide-logo-webkit.webp', Buffer.from(webkitWebp));
    await runCase(webkit, 'webkit-wide-webp', '/tmp/wide-logo-webkit.webp', { kind: 'jpeg', maxEdge: 1600 });
  } else {
    console.log('webkit-wide-webp skipped: this WebKit build does not encode image/webp');
  }
} finally {
  await webkit.close();
}
console.log('webkit phone upload page ok');
