const { withAndroidManifest } = require('expo/config-plugins');

const ADAPTIVE_ICON = '@mipmap/ic_launcher';
const TV_DRAWABLE_ICON = '@drawable/tv_icon';

/**
 * `@react-native-tvos/config-tv` points `android:icon` at the 320×180 TV
 * drawable whenever `EXPO_TV=1` and `androidTVIcon` is set. Android TV reads
 * `android:banner` for the home row. The phone launcher reads `android:icon`.
 *
 * Google Play ships one app bundle to phones and Android TV, so that profile
 * sets `EXPO_KEEP_ADAPTIVE_ICON=1` and this plugin puts the adaptive icon back.
 * Leanback, the touchscreen feature, and the banner stay as config-tv wrote them.
 * Fire TV does not set the env, so its launcher icon is unchanged.
 *
 * List this plugin before `@react-native-tvos/config-tv`. Manifest mods run in
 * reverse registration order, so an earlier entry is the one that sticks.
 */
function restoreAdaptiveLauncherIcon(androidManifest) {
  const application = androidManifest?.manifest?.application?.[0];
  const attrs = application?.$;
  if (!attrs) return androidManifest;
  if (attrs['android:icon'] === TV_DRAWABLE_ICON) {
    attrs['android:icon'] = ADAPTIVE_ICON;
  }
  return androidManifest;
}

function withPlayAdaptiveIcon(config) {
  const keep = process.env.EXPO_KEEP_ADAPTIVE_ICON;
  if (keep !== '1' && keep !== 'true') return config;
  return withAndroidManifest(config, (mod) => {
    mod.modResults = restoreAdaptiveLauncherIcon(mod.modResults);
    return mod;
  });
}

module.exports = withPlayAdaptiveIcon;
module.exports.restoreAdaptiveLauncherIcon = restoreAdaptiveLauncherIcon;
