const { withInfoPlist } = require('@expo/config-plugins');

/** tvOS build 22. Phone iOS keeps the buildNumber in app.json. */
const TVOS_BUILD_NUMBER = '22';

function isTvBuild(env = process.env) {
  const tv = env.EXPO_TV;
  return tv === '1' || tv === 'true';
}

function applyTvBuildNumber(config, env = process.env) {
  if (!isTvBuild(env)) return config;
  return { ...config, ios: { ...config.ios, buildNumber: TVOS_BUILD_NUMBER } };
}

/**
 * Phone and tvOS share `ios.buildNumber`. This plugin sets CFBundleVersion to 22
 * only when EXPO_TV=1, so an iPhone archive still uses the number in app.json.
 */
function withTvBuildNumber(config) {
  const next = applyTvBuildNumber(config);
  if (!isTvBuild()) return next;
  return withInfoPlist(next, (mod) => {
    mod.modResults.CFBundleVersion = TVOS_BUILD_NUMBER;
    return mod;
  });
}

module.exports = withTvBuildNumber;
module.exports.TVOS_BUILD_NUMBER = TVOS_BUILD_NUMBER;
module.exports.applyTvBuildNumber = applyTvBuildNumber;
