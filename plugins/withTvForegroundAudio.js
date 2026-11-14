const { withInfoPlist } = require('@expo/config-plugins');

/**
 * tvOS builds (EXPO_TV=1) do not keep playing after the app leaves the foreground.
 * Timer cues are in-app sounds. Strip the audio background mode the shared iOS
 * plist and expo-audio plugin add, and leave phone iOS builds alone.
 *
 * Info.plist mods run in reverse registration order, so list this plugin before
 * expo-audio. This mod then runs last and its removal sticks.
 */
function stripBackgroundAudioMode(infoPlist) {
  if (!infoPlist || !Array.isArray(infoPlist.UIBackgroundModes)) return infoPlist;
  const next = infoPlist.UIBackgroundModes.filter((mode) => mode !== 'audio');
  if (next.length === 0) delete infoPlist.UIBackgroundModes;
  else infoPlist.UIBackgroundModes = next;
  return infoPlist;
}

function withTvForegroundAudio(config) {
  const tv = process.env.EXPO_TV;
  if (tv !== '1' && tv !== 'true') return config;
  return withInfoPlist(config, (mod) => {
    stripBackgroundAudioMode(mod.modResults);
    return mod;
  });
}

module.exports = withTvForegroundAudio;
module.exports.stripBackgroundAudioMode = stripBackgroundAudioMode;
