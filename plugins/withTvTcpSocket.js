const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const MARKER = 'AMERICANA_TVOS_NO_PKCS12';

/**
 * `SecPKCS12Import` is not in the tvOS SDK. The stock pod still lists tvOS, so
 * Xcode drops the socket class out of the Apple TV binary (or fails the build).
 * The logo listener speaks plain HTTP and never calls `setSecureContext`.
 */
function patchTcpSocketSource(source) {
  if (source.includes(MARKER)) return source;
  const method = '- (BOOL)setSecureContext:(NSDictionary *)tlsOptions {\n';
  const ending = '           forKey:(NSString *)kCFStreamSSLCertificates];\n    _tls = true;\n    return true;\n}';
  if (!source.includes(method) || !source.includes(ending)) {
    throw new Error(
      'react-native-tcp-socket setSecureContext changed. Update plugins/withTvTcpSocket.js before building for Apple TV.',
    );
  }
  let next = source;
  const header = '#import <Security/SecImportExport.h>\n';
  if (next.includes(header)) {
    next = next.replace(header, `#if !TARGET_OS_TV\n${header}#endif\n`);
  }
  next = next.replace(
    method,
    `${method}#if TARGET_OS_TV\n    // ${MARKER}: SecPKCS12Import is not available on tvOS.\n    // The gym-logo listener uses plain HTTP and does not call this.\n    return NO;\n#else\n`,
  );
  next = next.replace(ending, `${ending.slice(0, -1)}\n#endif\n}`);
  return next;
}

function withTvTcpSocket(config) {
  return withDangerousMod(config, [
    'ios',
    (mod) => {
      const file = path.join(
        mod.modRequest.projectRoot,
        'node_modules/react-native-tcp-socket/ios/TcpSocketClient.m',
      );
      if (!fs.existsSync(file)) return mod;
      const source = fs.readFileSync(file, 'utf8');
      const patched = patchTcpSocketSource(source);
      if (patched !== source) fs.writeFileSync(file, patched);
      return mod;
    },
  ]);
}

module.exports = withTvTcpSocket;
module.exports.patchTcpSocketSource = patchTcpSocketSource;
