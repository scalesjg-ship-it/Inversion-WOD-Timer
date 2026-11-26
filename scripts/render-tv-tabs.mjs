import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

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
    const indexed = path.join(base, `index${ext}`);
    if (existsSync(indexed)) return indexed;
  }
  return null;
}

const rnWeb = {
  name: 'rn-web',
  setup(build) {
    build.onResolve({ filter: /^expo-modules-core$/ }, () => ({
      path: path.join(root, 'scripts/stub-expo-modules-core.ts'),
    }));
    build.onResolve({ filter: /^expo$/ }, () => ({
      path: path.join(root, 'scripts/stub-expo-modules-core.ts'),
    }));
    build.onResolve({ filter: /^expo-router$/ }, () => ({
      path: path.join(root, 'scripts/stub-expo-router.tsx'),
    }));
    build.onResolve({ filter: /^expo-audio$|^expo-haptics$|^expo-keep-awake$|^expo-notifications$/ }, () => ({
      path: path.join(root, 'scripts/stub-native-extras.ts'),
    }));
    build.onResolve({ filter: /codegenNativeComponent/ }, (args) => {
      console.log('codegen import from', args.importer);
      return { path: path.join(root, 'scripts/stub-native-extras.ts') };
    });
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
      const inSvg =
        resolved.includes(`${path.sep}react-native-svg${path.sep}`) ||
        args.importer.includes(`${path.sep}react-native-svg${path.sep}`);
      const inSafeArea =
        resolved.includes(`${path.sep}react-native-safe-area-context${path.sep}`) ||
        args.importer.includes(`${path.sep}react-native-safe-area-context${path.sep}`);
      const inApp =
        args.importer.startsWith(path.join(root, 'src') + path.sep) ||
        args.importer.startsWith(path.join(root, 'app') + path.sep) ||
        args.importer.startsWith(path.join(root, 'scripts') + path.sep);
      if (inSvg || inSafeArea || inApp) return { path: resolved };
      return null;
    });
  },
};

const outfile = '/tmp/tv-tabs-bundle.js';
await esbuild.build({
  absWorkingDir: root,
  entryPoints: [path.join(root, 'scripts/tv-tabs-entry.tsx')],
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
  loader: { '.ttf': 'empty', '.png': 'dataurl', '.wav': 'empty' },
});

const frames = [
  { tab: 'wod', width: 1920, height: 1080, file: 'tv-tab-wod-1920x1080.png' },
  { tab: 'brand', width: 1920, height: 1080, file: 'tv-tab-brand-1920x1080.png' },
  { tab: 'setup', width: 1920, height: 1080, file: 'tv-setup-fortime-1920x1080.png', seed: true, mode: 'forTime' },
  { tab: 'setup', width: 1920, height: 1080, file: 'tv-setup-intervals-preset-1920x1080.png', seed: true, mode: 'intervals' },
  { tab: 'setup', width: 1920, height: 1080, file: 'tv-setup-amrap-1920x1080.png', seed: true, mode: 'amrap' },
  { tab: 'setup', width: 960, height: 540, file: 'tv-setup-amrap-960x540.png', seed: true, mode: 'amrap' },
  { tab: 'setup', width: 1920, height: 1080, file: 'tv-setup-emom-1920x1080.png', seed: true, mode: 'emom' },
  { tab: 'setup', width: 1920, height: 1080, file: 'tv-setup-intervals-1920x1080.png', seed: true, mode: 'intervals' },
  { tab: 'countdown', width: 1920, height: 1080, file: 'tv-countdown-1920x1080.png', seed: true },
  { tab: 'timer', width: 1920, height: 1080, file: 'tv-timer-running-1920x1080.png' },
  { tab: 'wod', width: 960, height: 540, file: 'tv-tab-wod-960x540.png' },
  { tab: 'brand', width: 960, height: 540, file: 'tv-tab-brand-960x540.png' },
  { tab: 'setup', width: 960, height: 540, file: 'tv-setup-fortime-960x540.png', seed: true, mode: 'forTime' },
  { tab: 'setup', width: 960, height: 540, file: 'tv-setup-intervals-preset-960x540.png', seed: true, mode: 'intervals' },
  { tab: 'setup', width: 1280, height: 720, file: 'tv-setup-intervals-preset-1280x720.png', seed: true, mode: 'intervals' },
  { tab: 'countdown', width: 960, height: 540, file: 'tv-countdown-960x540.png', seed: true },
];

if (process.env.WATCH_UI_SHOTS === '1') {
  frames.length = 0;
  frames.push(
    {
      tab: 'brand',
      width: 1920,
      height: 1080,
      file: 'settings-watch-pair-1920x1080.png',
      category: 'watch',
      watchCode: '814947',
      watchMessage: 'Enter this code on your Apple Watch. Both need internet.',
    },
    { tab: 'timer', width: 1920, height: 1080, file: 'timer-without-pairing-1920x1080.png' },
  );
}

const outDir = '/opt/cursor/artifacts';
await mkdir(outDir, { recursive: true });

function presetDocument() {
  const item = (id, name, mode, config, updatedAt) => ({ id, name, mode, config: { warningMarksSeconds: [], ...config }, updatedAt });
  return {
    version: 2,
    presets: [
      item('preset-spar', 'Sparring', 'intervals', { mode: 'intervals', leadInSeconds: 10, workSeconds: 180, restSeconds: 60, rounds: 5, warningSeconds: 10 }, 3),
      item('preset-morning', 'Morning roll', 'intervals', { mode: 'intervals', leadInSeconds: 10, workSeconds: 300, restSeconds: 60, rounds: 6, warningSeconds: 30 }, 2),
      item('preset-open', 'Open mat', 'intervals', { mode: 'intervals', leadInSeconds: 0, workSeconds: 600, restSeconds: 0, rounds: 1, warningSeconds: 0 }, 1),
      item('preset-ft12', 'For Time 12', 'forTime', { mode: 'forTime', leadInSeconds: 10, workSeconds: 720, restSeconds: 0, rounds: 1, warningSeconds: 0 }, 6),
      item('preset-ft20', 'For Time 20', 'forTime', { mode: 'forTime', leadInSeconds: 10, workSeconds: 1200, restSeconds: 0, rounds: 1, warningSeconds: 0 }, 5),
      item('preset-cap', 'Cap 8', 'forTime', { mode: 'forTime', leadInSeconds: 10, workSeconds: 480, restSeconds: 0, rounds: 1, warningSeconds: 0 }, 4),
      item('preset-warm', 'Warmup', 'countdown', { mode: 'countdown', leadInSeconds: 5, workSeconds: 180, restSeconds: 0, rounds: 1, warningSeconds: 0, warningMarksSeconds: [60, 10] }, 9),
      item('preset-cool', 'Cooldown', 'countdown', { mode: 'countdown', leadInSeconds: 0, workSeconds: 120, restSeconds: 0, rounds: 1, warningSeconds: 0 }, 8),
      item('preset-between', 'Between rounds', 'countdown', { mode: 'countdown', leadInSeconds: 0, workSeconds: 60, restSeconds: 0, rounds: 1, warningSeconds: 0 }, 7),
    ],
  };
}

function pageFor(tab, width, height, seed, confirm, mode, frameCategory, frameWatchCode, frameWatchMessage) {
  const storage = seed
    ? `localStorage.setItem('americana.presets.v1', ${JSON.stringify(JSON.stringify(presetDocument()))});`
    : `localStorage.removeItem('americana.presets.v1');`;
  const preview = confirm ? `globalThis.__TV_PRESET_PREVIEW__ = 'confirm';` : `delete globalThis.__TV_PRESET_PREVIEW__;`;
  const category = frameCategory ? `globalThis.__TV_SETTINGS_CATEGORY__ = ${JSON.stringify(frameCategory)};` : '';
  const watchCode = frameWatchCode ? `globalThis.__TV_WATCH_CODE__ = ${JSON.stringify(frameWatchCode)};` : '';
  const watchMessage = frameWatchMessage
    ? `globalThis.__TV_WATCH_MESSAGE__ = ${JSON.stringify(frameWatchMessage)};`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: Oswald; src: url(/assets/fonts/Oswald-Bold.ttf); font-weight: 700; }
  @font-face { font-family: OswaldMedium; src: url(/assets/fonts/Oswald-Medium.ttf); font-weight: 500; }
  html, body, #root { margin: 0; width: ${width}px; height: ${height}px; background: #07080A; overflow: hidden; display: flex; flex-direction: column; }
</style>
</head>
<body>
<div id="root"></div>
<script>
globalThis.global = globalThis;
globalThis.process = globalThis.process || { env: { NODE_ENV: 'development' } };
${storage}
${preview}
${category}
${watchCode}
${watchMessage}
globalThis.__TV_TAB__ = ${JSON.stringify(tab)};
globalThis.__TV_SETUP_MODE__ = ${JSON.stringify(mode ?? '')};
globalThis.__TV_FRAME__ = { width: ${width}, height: ${height} };
</script>
<script src="/bundle.js"></script>
</body>
</html>`;
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/';
  if (url.startsWith('/index.html')) {
    const params = new URL(url, 'http://127.0.0.1').searchParams;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(pageFor(
      params.get('tab') ?? 'wod',
      Number(params.get('w') ?? 1920),
      Number(params.get('h') ?? 1080),
      params.get('seed') === '1',
      params.get('confirm') === '1',
      params.get('mode') ?? '',
      params.get('category') ?? '',
      params.get('watchCode') ?? '',
      params.get('watchMessage') ?? '',
    ));
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
const port = address.port;

function shoot(frame) {
  const shot = path.join(outDir, frame.file);
  const url = `http://127.0.0.1:${port}/index.html?tab=${frame.tab}&w=${frame.width}&h=${frame.height}&seed=${frame.seed ? 1 : 0}&confirm=${frame.confirm ? 1 : 0}&mode=${encodeURIComponent(frame.mode ?? '')}&category=${encodeURIComponent(frame.category ?? '')}&watchCode=${encodeURIComponent(frame.watchCode ?? '')}&watchMessage=${encodeURIComponent(frame.watchMessage ?? '')}`;
  return new Promise((resolve, reject) => {
    const chrome = spawn(
      '/usr/bin/google-chrome-stable',
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--hide-scrollbars',
        '--virtual-time-budget=8000',
        `--window-size=${frame.width},${frame.height}`,
        `--screenshot=${shot}`,
        url,
      ],
      { stdio: 'inherit' },
    );
    chrome.on('error', reject);
    chrome.on('exit', (code) => (code === 0 ? resolve(shot) : reject(new Error(`chrome ${code} ${frame.file}`))));
  });
}

for (const frame of frames) {
  if (process.env.ONLY && !frame.file.includes(process.env.ONLY)) continue;
  const shot = await shoot(frame);
  console.log('wrote', shot);
}
server.close();
