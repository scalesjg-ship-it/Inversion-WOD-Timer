import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { patchTcpSocketSource } = require('../../plugins/withTvTcpSocket.js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(ROOT, 'node_modules/react-native-tcp-socket/ios/TcpSocketClient.m');

describe('tvOS tcp socket patch', () => {
  it('keeps PKCS#12 import on iOS and skips it on tvOS', () => {
    const original = readFileSync(SOURCE, 'utf8');
    const patched = patchTcpSocketSource(original);
    expect(patched).toContain('#if TARGET_OS_TV');
    expect(patched).toContain('return NO;');
    expect(patched).toContain('#else');
    expect(patched).toContain('SecPKCS12Import');
    expect(patched).toContain('#if !TARGET_OS_TV\n#import <Security/SecImportExport.h>\n#endif');
    const tvosBranch = patched.split('#if TARGET_OS_TV')[1]?.split('#else')[0] ?? '';
    expect(tvosBranch).not.toMatch(/SecPKCS12Import\s*\(/);
    expect(patchTcpSocketSource(patched)).toBe(patched);
  });
});
