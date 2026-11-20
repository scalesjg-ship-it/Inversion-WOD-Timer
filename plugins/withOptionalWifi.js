const { withAndroidManifest } = require('expo/config-plugins');

const WIFI_FEATURE = 'android.hardware.wifi';

/**
 * expo-network declares ACCESS_WIFI_STATE. Play treats that permission as a
 * required android.hardware.wifi feature, which hides the app from phones,
 * tablets, TVs, desktops, and Android XR that have no Wi-Fi radio.
 *
 * The timer does not need Wi-Fi hardware. The logo listener uses whatever
 * local network the TV has, including Ethernet. This marks the feature
 * optional and leaves the permission in place so a Wi-Fi device can still
 * read its address.
 *
 * config-tv owns touchscreen, faketouch, and leanback. This plugin only
 * writes the wifi feature. List it before @react-native-tvos/config-tv.
 * Manifest mods run in reverse registration order, so this mod runs after
 * config-tv and required="false" sticks.
 */
function setWifiFeatureOptional(androidManifest) {
  const manifest = androidManifest?.manifest;
  if (!manifest) return androidManifest;
  if (!Array.isArray(manifest['uses-feature'])) {
    manifest['uses-feature'] = [];
  }
  const features = manifest['uses-feature'];
  let found = false;
  for (const item of features) {
    if (item?.$?.['android:name'] !== WIFI_FEATURE) continue;
    item.$['android:required'] = 'false';
    found = true;
  }
  if (!found) {
    features.push({
      $: {
        'android:name': WIFI_FEATURE,
        'android:required': 'false',
      },
    });
  }
  return androidManifest;
}

function withOptionalWifi(config) {
  return withAndroidManifest(config, (mod) => {
    mod.modResults = setWifiFeatureOptional(mod.modResults);
    return mod;
  });
}

module.exports = withOptionalWifi;
module.exports.WIFI_FEATURE = WIFI_FEATURE;
module.exports.setWifiFeatureOptional = setWifiFeatureOptional;
