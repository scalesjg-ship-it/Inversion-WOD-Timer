const { withInfoPlist } = require('@expo/config-plugins');

/**
 * Default tvOS CFBundleVersion. Phone iOS keeps the buildNumber in app.json.
 * 1.0.1 (23) is already VALID on App Store Connect.
 * The signed TestFlight workflow sets TVOS_BUILD_NUMBER from its build_number input.
 */
const TVOS_BUILD_NUMBER = '24';
const BUILD_NUMBER_PATTERN = /^[1-9]\d{0,8}$/;

function isTvBuild(env = process.env) {
  const tv = env.EXPO_TV;
  return tv === '1' || tv === 'true';
}

function resolveTvBuildNumber(env = process.env) {
  const raw = env.TVOS_BUILD_NUMBER;
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return TVOS_BUILD_NUMBER;
  if (!BUILD_NUMBER_PATTERN.test(text)) {
    throw new Error(
      `TVOS_BUILD_NUMBER must be a positive integer CFBundleVersion with no leading zero (got ${JSON.stringify(text)})`,
    );
  }
  return text;
}

function applyTvBuildNumber(config, env = process.env) {
  if (!isTvBuild(env)) return config;
  return { ...config, ios: { ...config.ios, buildNumber: resolveTvBuildNumber(env) } };
}

/**
 * Phone and tvOS share `ios.buildNumber`. This plugin sets CFBundleVersion only
 * when EXPO_TV=1, so an iPhone archive still uses the number in app.json.
 * A non-empty TVOS_BUILD_NUMBER overrides the default above.
 */
function withTvBuildNumber(config) {
  const next = applyTvBuildNumber(config);
  if (!isTvBuild()) return next;
  const buildNumber = next.ios.buildNumber;
  return withInfoPlist(next, (mod) => {
    mod.modResults.CFBundleVersion = buildNumber;
    return mod;
  });
}

module.exports = withTvBuildNumber;
module.exports.TVOS_BUILD_NUMBER = TVOS_BUILD_NUMBER;
module.exports.resolveTvBuildNumber = resolveTvBuildNumber;
module.exports.applyTvBuildNumber = applyTvBuildNumber;
