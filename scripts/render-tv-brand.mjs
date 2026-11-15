import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const extensions = ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js'];

function resolveWithExtension(base) {
  const webFirst = extensions.filter((ext) => ext.includes('.web.'));
  const rest = extensions.filter((ext) => !ext.includes('.web.'));
  for (const ext of [...webFirst, ...rest]) {
    const candidate = base + ext;
    if (existsSync(candidate)) return candidate;
  }
  for (const ext of [...webFirst, ...rest]) {
    const candidate = path.join(base, `index${ext}`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const rnWeb = {
  name: 'rn-web',
  setup(build) {
    build.onResolve({ filter: /^expo-image-picker$/ }, () => ({
      path: path.join(root, 'scripts/stub-image-picker.ts'),
    }));
    build.onResolve({ filter: /^expo-document-picker$/ }, () => ({
      path: path.join(root, 'scripts/stub-document-picker.ts'),
    }));
    build.onResolve({ filter: /^react-native$/ }, () => ({
      path: require.resolve('react-native-web'),
    }));
    build.onResolve({ filter: /useLogoReceiver$/ }, () => ({
      path: path.join(root, 'scripts/previewLogoReceiver.tsx'),
    }));
    build.onResolve({ filter: /^expo-image$/ }, () => ({
      path: path.join(root, 'scripts/stub-expo-image.tsx'),
    }));
    build.onResolve({ filter: /^expo-image-manipulator$/ }, () => ({
      path: path.join(root, 'scripts/stub-image-manipulator.ts'),
    }));
    build.onResolve({ filter: /^expo-file-system$/ }, () => ({
      path: path.join(root, 'scripts/stub-file-system.ts'),
    }));
    build.onResolve({ filter: /^@react-native\/assets-registry\/registry$/ }, () => ({
      path: path.join(root, 'scripts/stub-asset-registry.ts'),
    }));
    build.onResolve({ filter: /^@\// }, (args) => {
      const resolved = resolveWithExtension(path.join(root, args.path.slice(2)));
      if (!resolved) return { errors: [{ text: `Cannot resolve ${args.path}` }] };
      return { path: resolved };
    });
    build.onResolve({ filter: /^\./ }, (args) => {
      if (!args.importer || args.path.endsWith('useLogoReceiver')) return null;
      const resolved = resolveWithExtension(path.resolve(path.dirname(args.importer), args.path));
      if (!resolved) return null;
      const inSvg = resolved.includes(`${path.sep}react-native-svg${path.sep}`) || args.importer.includes(`${path.sep}react-native-svg${path.sep}`);
      const inSafeArea = resolved.includes(`${path.sep}react-native-safe-area-context${path.sep}`) || args.importer.includes(`${path.sep}react-native-safe-area-context${path.sep}`);
      const inApp = args.importer.startsWith(path.join(root, 'src') + path.sep) || args.importer.startsWith(path.join(root, 'app') + path.sep) || args.importer.startsWith(path.join(root, 'scripts') + path.sep);
      if (inSvg || inSafeArea || inApp) return { path: resolved };
      return null;
    });
  },
};

const outfile = '/tmp/tv-brand-bundle.js';

await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'scripts/tv-brand-entry.tsx')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  outfile,
  jsx: 'automatic',
  plugins: [rnWeb],
  define: {
    'process.env.NODE_ENV': '"development"',
    __DEV__: 'true',
  },
  loader: { '.ttf': 'empty' },
});

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: Oswald; src: url(/assets/fonts/Oswald-Bold.ttf); font-weight: 700; }
  @font-face { font-family: OswaldMedium; src: url(/assets/fonts/Oswald-Medium.ttf); font-weight: 500; }
  html, body, #root { margin: 0; width: 1920px; height: 1080px; background: #07080A; overflow: hidden; }
</style>
</head>
<body>
<div id="root"></div>
<script src="/bundle.js"></script>
</body>
</html>`;

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }
  if (url === '/bundle.js') {
    const body = await readFile(outfile);
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(body);
    return;
  }
  const file = path.join(root, decodeURIComponent(url.split('?')[0]));
  if (!file.startsWith(root) || !existsSync(file)) {
    res.writeHead(404);
    res.end('missing');
    return;
  }
  const body = await readFile(file);
  const type = file.endsWith('.ttf') ? 'font/ttf' : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  res.end(body);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('no port');
const origin = `http://127.0.0.1:${address.port}/`;
console.log(origin);

const puppeteer = require(process.env.PUPPETEER_CORE);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars'],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', (error) => console.error('PAGE', error));
page.on('console', (message) => console.log('CONSOLE', message.type(), message.text()));
await page.goto(origin, { waitUntil: 'networkidle0' });
await page.waitForSelector('[data-testid="tv-brand-qr"]', { timeout: 15000 });
await page.evaluate(() => document.fonts.ready);
const metrics = await page.evaluate(() => {
  const box = (id) => {
    const node = document.querySelector(`[data-testid="${id}"]`);
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right };
  };
  const path = document.querySelector('[data-testid="tv-brand-qr"] path');
  return {
    qr: box('tv-brand-qr'),
    url: box('tv-logo-pairing-url'),
    urlText: document.querySelector('[data-testid="tv-logo-pairing-url"]')?.textContent ?? '',
    reset: box('reset-brand'),
    preview: box('brand-preview'),
    pathLength: path?.getAttribute('d')?.length ?? 0,
    fill: path?.getAttribute('fill') ?? '',
    sceneText: document.body.innerText.slice(0, 400),
  };
});
console.log(JSON.stringify(metrics, null, 2));
const shot = process.env.SHOT_PATH ?? '/opt/cursor/artifacts/tv-brand-qr-1080.png';
await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
console.log('wrote', shot);
await browser.close();
server.close();
