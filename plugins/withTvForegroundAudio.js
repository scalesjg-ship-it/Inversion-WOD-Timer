const { withInfoPlist } = require('@expo/config-plugins');

/**
 * Timer cues are short sounds while the app is open, plus local notifications
 * on a locked phone. That is not persistent background audio. Apple Guideline
 * 2.5.4 rejects an `audio` UIBackgroundMode without that feature.
 *
 * `ios.infoPlist` is shared by iPhone and tvOS. expo-audio's
 * `enableBackgroundPlayback` stays on for the Android media foreground service,
 * and that option also pushes `audio` onto the Apple Info.plist. Strip it for
 * every Apple prebuild. tvOS already shipped without the key; the phone binary
 * must match. Other background modes, if any, are left in place.
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
  return withInfoPlist(config, (mod) => {
    stripBackgroundAudioMode(mod.modResults);
    return mod;
  });
}

module.exports = withTvForegroundAudio;
module.exports.stripBackgroundAudioMode = stripBackgroundAudioMode;
